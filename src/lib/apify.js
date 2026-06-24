import { APIFY_FAILED_STATUSES, STORAGE_KEYS } from './constants'

export const APIFY_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '/api-apify'
    : 'https://api.apify.com'

export function parseApifyTokens(value) {
  if (Array.isArray(value)) {
    return value.map(token => String(token || '').trim()).filter(Boolean)
  }

  return String(value || '')
    .split(/[\n,;]+/)
    .map(token => token.trim())
    .filter(Boolean)
}

function getRotationStartIndex(size) {
  if (size <= 1) return 0

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.apifyTokenRotationIndex)
    const index = Number(raw) || 0
    return Math.abs(index) % size
  } catch {
    return 0
  }
}

function saveNextRotationIndex(nextIndex) {
  try {
    localStorage.setItem(STORAGE_KEYS.apifyTokenRotationIndex, String(nextIndex))
  } catch {}
}

export async function startActorRun(actorId, token, body) {
  const response = await fetch(`${APIFY_BASE}/v2/acts/${actorId}/runs?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errData = await response.json()
    throw new Error(errData.error?.message || 'Error al iniciar la ejecución del scraper en Apify.')
  }

  const runData = await response.json()
  return {
    runId: runData.data.id,
    datasetId: runData.data.defaultDatasetId,
  }
}

export async function startActorRunWithRotation(actorId, tokenSource, body) {
  const tokens = parseApifyTokens(tokenSource)
  if (tokens.length === 0) {
    throw new Error('No hay tokens de Apify configurados.')
  }

  const startIndex = getRotationStartIndex(tokens.length)
  let lastError = null

  for (let offset = 0; offset < tokens.length; offset++) {
    const tokenIndex = (startIndex + offset) % tokens.length
    const token = tokens[tokenIndex]

    try {
      const run = await startActorRun(actorId, token, body)
      saveNextRotationIndex(tokenIndex + 1)
      return { ...run, tokenUsed: token, tokenIndex }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('No se pudo iniciar la corrida en Apify.')
}

export async function fetchRunStatus(runId, token) {
  const response = await fetch(`${APIFY_BASE}/v2/actor-runs/${runId}?token=${token}`)
  if (!response.ok) throw new Error('No se pudo verificar el estado de la corrida.')
  const runInfo = await response.json()
  return runInfo.data.status
}

export async function fetchDatasetItems(datasetId, token) {
  const response = await fetch(`${APIFY_BASE}/v2/datasets/${datasetId}/items?token=${token}`)
  if (!response.ok) throw new Error('No se pudieron descargar los ítems del dataset.')
  return response.json()
}

export function pollActorRun({ runId, datasetId, token, onStatus, onSuccess, onError, intervalMs = 4000 }) {
  const interval = setInterval(async () => {
    try {
      const status = await fetchRunStatus(runId, token)
      onStatus(status)

      if (status === 'SUCCEEDED') {
        clearInterval(interval)
        onSuccess()
      } else if (APIFY_FAILED_STATUSES.includes(status)) {
        clearInterval(interval)
        onError(new Error(`La ejecución terminó con estado fallido: ${status}`))
      }
    } catch (error) {
      clearInterval(interval)
      onError(error)
    }
  }, intervalMs)

  return () => clearInterval(interval)
}

export async function waitForActorRun({ runId, token, onStatus, intervalMs = 4000 }) {
  while (true) {
    const status = await fetchRunStatus(runId, token)
    onStatus?.(status)

    if (status === 'SUCCEEDED') return status
    if (APIFY_FAILED_STATUSES.includes(status)) {
      throw new Error(`La ejecucion termino con estado fallido: ${status}`)
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
}
