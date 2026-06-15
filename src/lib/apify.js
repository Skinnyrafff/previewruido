import { APIFY_FAILED_STATUSES } from './constants'

export const APIFY_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '/api-apify'
    : 'https://api.apify.com'

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
