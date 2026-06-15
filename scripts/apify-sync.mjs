import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

loadEnvFile(path.join(repoRoot, '.env'))

const [{ default: sql }, { APIFY_ACTORS, APIFY_FAILED_STATUSES }, { normalizeUsername }, { parseTikTokItems }, { parseInstagramItems }, { saveScrapedPosts }] = await Promise.all([
  import('../src/lib/db.js'),
  import('../src/lib/constants.js'),
  import('../src/lib/format.js'),
  import('../src/lib/scraper/tiktok.js'),
  import('../src/lib/scraper/instagram.js'),
  import('../src/lib/scraper/savePosts.js'),
])

const options = parseArgs(process.argv.slice(2))
const token = process.env.APIFY_TOKEN || process.env.VITE_APIFY_TOKEN

if (!token) {
  console.error('Falta APIFY_TOKEN o VITE_APIFY_TOKEN.')
  process.exit(1)
}

const PLATFORM_CONFIG = {
  tiktok: {
    actorId: APIFY_ACTORS.tiktok,
    usernameField: 'tt_usuario',
    parseItems: parseTikTokItems,
    buildRunBody: (profiles, limit) => ({
      profiles,
      resultsPerPage: limit,
      profileSorting: 'latest',
    }),
  },
  instagram: {
    actorId: APIFY_ACTORS.instagram,
    usernameField: 'ig_usuario',
    parseItems: parseInstagramItems,
    buildRunBody: (profiles, limit) => ({
      usernames: profiles,
      resultsLimit: limit,
      resultsType: 'posts',
    }),
  },
}

const platformConfig = PLATFORM_CONFIG[options.platform]
if (!platformConfig) {
  console.error(`Plataforma no soportada: ${options.platform}`)
  process.exit(1)
}

const log = message => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
}

try {
  const campaignRows = await fetchCampaignProfiles(options)
  if (campaignRows.length === 0) {
    log('No hay campañas/perfiles elegibles para sincronizar.')
    process.exit(0)
  }

  const campaignMap = new Map()
  const usernameCampaigns = new Map()

  for (const row of campaignRows) {
    const username = normalizeUsername(row[platformConfig.usernameField])
    if (!username) continue

    if (!campaignMap.has(row.campaign_id)) {
      campaignMap.set(row.campaign_id, {
        campaignId: row.campaign_id,
        campaignName: row.campaign_nombre,
        roster: [],
      })
    }

    campaignMap.get(row.campaign_id).roster.push(row)

    if (!usernameCampaigns.has(username)) usernameCampaigns.set(username, new Set())
    usernameCampaigns.get(username).add(row.campaign_id)
  }

  const profiles = [...usernameCampaigns.keys()]
  log(`Perfiles únicos a scrapear: ${profiles.length}`)
  log(`Campañas a actualizar: ${campaignMap.size}`)

  const { datasetId, runId } = await startActorRun(platformConfig.actorId, token, platformConfig.buildRunBody(profiles, options.limit))
  log(`Run iniciado en Apify. runId=${runId}`)

  await waitForRun(runId, token, status => {
    log(`Estado Apify: ${status}`)
  })

  const datasetItems = await fetchDatasetItems(datasetId, token)
  log(`Items descargados desde Apify: ${datasetItems.length}`)

  const parsedItems = platformConfig.parseItems(datasetItems)
  const itemsByCampaign = new Map()

  for (const item of parsedItems) {
    const username = normalizeUsername(item.author)
    const campaignIds = usernameCampaigns.get(username)
    if (!campaignIds) continue

    for (const campaignId of campaignIds) {
      if (!itemsByCampaign.has(campaignId)) itemsByCampaign.set(campaignId, [])
      itemsByCampaign.get(campaignId).push(item)
    }
  }

  const summary = []

  for (const campaign of campaignMap.values()) {
    const items = itemsByCampaign.get(campaign.campaignId) || []
    if (items.length === 0) {
      log(`Campaña ${campaign.campaignId} (${campaign.campaignName}): sin items para guardar.`)
      summary.push({ campaignId: campaign.campaignId, campaignName: campaign.campaignName, items: 0, guardados: 0 })
      continue
    }

    log(`Guardando ${items.length} items en campaña ${campaign.campaignId} (${campaign.campaignName})...`)
    const result = await saveScrapedPosts({
      items,
      campaignId: campaign.campaignId,
      roster: campaign.roster,
      platform: options.platform,
      addLog: log,
    })

    summary.push({
      campaignId: campaign.campaignId,
      campaignName: campaign.campaignName,
      items: items.length,
      guardados: result.guardadosCount,
      asociados: result.asociadosCount,
    })
  }

  log('Sincronización finalizada.')
  console.log(JSON.stringify({
    platform: options.platform,
    limit: options.limit,
    campaigns: summary,
  }, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const idx = line.indexOf('=')
    if (idx === -1) continue

    const key = line.slice(0, idx).trim()
    let value = line.slice(idx + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) process.env[key] = value
  }
}

function parseArgs(argv) {
  const defaults = {
    platform: 'tiktok',
    limit: 10,
    campaignId: null,
    status: 'Activa',
  }

  for (const arg of argv) {
    if (arg.startsWith('--platform=')) defaults.platform = arg.split('=')[1]
    if (arg.startsWith('--limit=')) defaults.limit = Number(arg.split('=')[1]) || defaults.limit
    if (arg.startsWith('--campaign=')) defaults.campaignId = Number(arg.split('=')[1]) || null
    if (arg.startsWith('--status=')) defaults.status = arg.split('=')[1]
  }

  return defaults
}

async function fetchCampaignProfiles(options) {
  const usernameField = options.platform === 'instagram' ? 'ig_usuario' : 'tt_usuario'

  if (options.campaignId && usernameField === 'ig_usuario') {
    return sql`
      SELECT
        c.id AS campaign_id,
        c.nombre AS campaign_nombre,
        c.estado AS campaign_estado,
        i.id,
        i.nombre,
        i.tt_usuario,
        i.tt_seguidores,
        i.ig_usuario,
        i.ig_seguidores
      FROM campaigns c
      JOIN campaign_influencers ci ON ci.campaign_id = c.id
      JOIN influencers i ON i.id = ci.influencer_id
      WHERE c.id = ${options.campaignId}
        AND i.estado = 'Activo'
        AND i.ig_usuario IS NOT NULL
        AND i.ig_usuario != ''
      ORDER BY c.id, i.nombre
    `
  }

  if (options.campaignId && usernameField === 'tt_usuario') {
    return sql`
      SELECT
        c.id AS campaign_id,
        c.nombre AS campaign_nombre,
        c.estado AS campaign_estado,
        i.id,
        i.nombre,
        i.tt_usuario,
        i.tt_seguidores,
        i.ig_usuario,
        i.ig_seguidores
      FROM campaigns c
      JOIN campaign_influencers ci ON ci.campaign_id = c.id
      JOIN influencers i ON i.id = ci.influencer_id
      WHERE c.id = ${options.campaignId}
        AND i.estado = 'Activo'
        AND i.tt_usuario IS NOT NULL
        AND i.tt_usuario != ''
      ORDER BY c.id, i.nombre
    `
  }

  if (usernameField === 'ig_usuario') {
    return sql`
      SELECT
        c.id AS campaign_id,
        c.nombre AS campaign_nombre,
        c.estado AS campaign_estado,
        i.id,
        i.nombre,
        i.tt_usuario,
        i.tt_seguidores,
        i.ig_usuario,
        i.ig_seguidores
      FROM campaigns c
      JOIN campaign_influencers ci ON ci.campaign_id = c.id
      JOIN influencers i ON i.id = ci.influencer_id
      WHERE c.estado = ${options.status}
        AND i.estado = 'Activo'
        AND i.ig_usuario IS NOT NULL
        AND i.ig_usuario != ''
      ORDER BY c.id, i.nombre
    `
  }

  return sql`
    SELECT
      c.id AS campaign_id,
      c.nombre AS campaign_nombre,
      c.estado AS campaign_estado,
      i.id,
      i.nombre,
      i.tt_usuario,
      i.tt_seguidores,
      i.ig_usuario,
      i.ig_seguidores
    FROM campaigns c
    JOIN campaign_influencers ci ON ci.campaign_id = c.id
    JOIN influencers i ON i.id = ci.influencer_id
    WHERE c.estado = ${options.status}
      AND i.estado = 'Activo'
      AND i.tt_usuario IS NOT NULL
      AND i.tt_usuario != ''
    ORDER BY c.id, i.nombre
  `
}

async function startActorRun(actorId, authToken, body) {
  const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${authToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.error?.message || 'No se pudo iniciar la corrida en Apify.')
  }

  const runData = await response.json()
  return {
    runId: runData.data.id,
    datasetId: runData.data.defaultDatasetId,
  }
}

async function fetchRunStatus(runId, authToken) {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${authToken}`)
  if (!response.ok) throw new Error('No se pudo obtener el estado de la corrida.')
  const runInfo = await response.json()
  return runInfo.data.status
}

async function waitForRun(runId, authToken, onStatus) {
  while (true) {
    const status = await fetchRunStatus(runId, authToken)
    onStatus(status)

    if (status === 'SUCCEEDED') return
    if (APIFY_FAILED_STATUSES.includes(status)) {
      throw new Error(`La corrida terminó con estado ${status}.`)
    }

    await sleep(4000)
  }
}

async function fetchDatasetItems(datasetId, authToken) {
  const response = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${authToken}`)
  if (!response.ok) throw new Error('No se pudieron descargar los items del dataset.')
  return response.json()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
