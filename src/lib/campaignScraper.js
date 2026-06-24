import sql from './db.js'
import { APIFY_ACTORS } from './constants.js'
import { startActorRunWithRotation, waitForActorRun, fetchDatasetItems, parseApifyTokens } from './apify.js'
import { parseTikTokItems } from './scraper/tiktok.js'
import { parseInstagramItems } from './scraper/instagram.js'
import { calcEngagementRate, calcTikTokEngagement, calcInstagramEngagement } from './engagement.js'
import { normalizePostUrl } from './format.js'
import { syncCampaignInfluencerVideoLinks } from './campaignPostLinks.js'

const PLATFORM_CONFIG = {
  TikTok: {
    actorId: APIFY_ACTORS.tiktok,
    parseItems: parseTikTokItems,
    buildRunBody: urls => ({
      postURLs: urls,
      scrapeRelatedVideos: false,
    }),
    getFollowersField: 'tt_seguidores',
    updateFollowers: (influencerId, count) => sql`
      UPDATE influencers SET tt_seguidores = ${count} WHERE id = ${influencerId}
    `,
    calcEngagement: calcTikTokEngagement,
    getMetrics: item => ({
      views: Number(item.views) || 0,
      likes: Number(item.likes) || 0,
      comentarios: Number(item.comments) || 0,
      shares: Number(item.shares) || 0,
      saves: Number(item.saves) || 0,
    }),
    source: 'apify-campaign-tiktok',
  },
  Instagram: {
    actorId: APIFY_ACTORS.instagram,
    parseItems: parseInstagramItems,
    buildRunBody: urls => ({
      directUrls: urls,
      resultsType: 'details',
      addParentData: false,
    }),
    getFollowersField: 'ig_seguidores',
    updateFollowers: (influencerId, count) => sql`
      UPDATE influencers SET ig_seguidores = ${count} WHERE id = ${influencerId}
    `,
    calcEngagement: calcInstagramEngagement,
    getMetrics: item => ({
      views: Number(item.views) || 0,
      likes: Number(item.likes) || 0,
      comentarios: Number(item.comments) || 0,
      shares: 0,
      saves: 0,
    }),
    source: 'apify-campaign-instagram',
  },
}

export function collectCampaignScrapeTargets(camp) {
  const targets = []

  for (const inf of camp.influencers || []) {
    if (inf.video_link_tt) {
      targets.push({
        platform: 'TikTok',
        influencerId: inf.influencer_id,
        influencerName: inf.nombre,
        url: inf.video_link_tt,
      })
    }

    if (inf.video_link_ig) {
      targets.push({
        platform: 'Instagram',
        influencerId: inf.influencer_id,
        influencerName: inf.nombre,
        url: inf.video_link_ig,
      })
    }
  }

  return targets
}

export async function syncCampaignLinks(camp) {
  for (const inf of camp.influencers || []) {
    await syncCampaignInfluencerVideoLinks({
      campaignId: camp.id,
      influencerId: inf.influencer_id,
      videoLinkTT: inf.video_link_tt,
      videoLinkIG: inf.video_link_ig,
    })
  }
}

export async function scrapeCampaignMetrics({ camp, token, addLog }) {
  const targets = collectCampaignScrapeTargets(camp)
  if (targets.length === 0) {
    throw new Error('Esta campana no tiene links para scrapear.')
  }

  const configuredTokens = parseApifyTokens(token)
  if (configuredTokens.length === 0) {
    throw new Error('No hay tokens de Apify configurados.')
  }

  await syncCampaignLinks(camp)

  const byPlatform = {
    TikTok: targets.filter(target => target.platform === 'TikTok'),
    Instagram: targets.filter(target => target.platform === 'Instagram'),
  }

  let totalSaved = 0

  for (const [platform, platformTargets] of Object.entries(byPlatform)) {
    if (platformTargets.length === 0) continue

    const config = PLATFORM_CONFIG[platform]
    const urls = platformTargets.map(target => target.url)

    addLog(`Iniciando scraping ${platform}: ${urls.length} link${urls.length === 1 ? '' : 's'}.`)
    const { runId, datasetId, tokenUsed, tokenIndex } = await startActorRunWithRotation(config.actorId, token, config.buildRunBody(urls))
    if (configuredTokens.length > 1) addLog(`${platform}: token rotado #${tokenIndex + 1}.`)

    addLog(`${platform}: run ${runId} iniciado en Apify.`)
    await waitForActorRun({
      runId,
      token: tokenUsed,
      onStatus: status => addLog(`${platform}: estado ${status}.`),
    })

    const datasetItems = await fetchDatasetItems(datasetId, tokenUsed)
    addLog(`${platform}: ${datasetItems.length} item${datasetItems.length === 1 ? '' : 's'} descargado${datasetItems.length === 1 ? '' : 's'}.`)

    const parsedItems = config.parseItems(datasetItems)
    const saved = await saveCampaignMetricsByUrl({
      campaignId: camp.id,
      platform,
      items: parsedItems,
      targets: platformTargets,
      addLog,
    })

    totalSaved += saved
  }

  return { totalSaved, totalTargets: targets.length }
}

async function saveCampaignMetricsByUrl({ campaignId, platform, items, targets, addLog }) {
  const config = PLATFORM_CONFIG[platform]
  const targetMap = new Map(
    targets.map(target => [normalizePostUrl(target.url), target])
  )

  const campaignPosts = await sql`
    SELECT
      p.id,
      p.url,
      p.influencer_id,
      i.ig_seguidores,
      i.tt_seguidores
    FROM posts p
    JOIN influencers i ON i.id = p.influencer_id
    WHERE p.campaign_id = ${campaignId}
      AND p.plataforma = ${platform}
  `

  const postMap = new Map(
    campaignPosts.map(post => [
      `${post.influencer_id}:${normalizePostUrl(post.url)}`,
      post,
    ])
  )

  let savedCount = 0

  for (const item of items) {
    const normalizedUrl = normalizePostUrl(item.url)
    const target = targetMap.get(normalizedUrl)

    if (!target) {
      addLog(`${platform}: item omitido por no coincidir con un link activo de la campana.`)
      continue
    }

    const postKey = `${target.influencerId}:${normalizedUrl}`
    let post = postMap.get(postKey)

    if (!post) {
      const created = await sql`
        INSERT INTO posts (campaign_id, influencer_id, plataforma, url, fecha_publicacion, descripcion)
        VALUES (
          ${campaignId},
          ${target.influencerId},
          ${platform},
          ${item.url || target.url},
          ${item.publishDate || null},
          ${item.description || ''}
        )
        RETURNING id, url, influencer_id
      `
      post = {
        ...created[0],
        ig_seguidores: 0,
        tt_seguidores: 0,
      }
      postMap.set(postKey, post)
    } else {
      await sql`
        UPDATE posts SET
          url = ${item.url || target.url},
          fecha_publicacion = ${item.publishDate || null},
          descripcion = ${item.description || ''}
        WHERE id = ${post.id}
      `
    }

    const scrapedFollowers = Number(item.authorFollowers) || 0
    const currentFollowers = Number(post[config.getFollowersField]) || 0
    const followers = scrapedFollowers > 0 ? scrapedFollowers : currentFollowers

    if (scrapedFollowers > 0 && scrapedFollowers !== currentFollowers) {
      await config.updateFollowers(target.influencerId, scrapedFollowers)
      post[config.getFollowersField] = scrapedFollowers
    }

    const metrics = config.getMetrics(item)
    const engagementRate = calcEngagementRate(config.calcEngagement(item), followers)

    await sql`
      INSERT INTO post_metrics (post_id, views, likes, comentarios, shares, saves, engagement_rate, fuente)
      VALUES (
        ${post.id},
        ${metrics.views},
        ${metrics.likes},
        ${metrics.comentarios},
        ${metrics.shares},
        ${metrics.saves},
        ${engagementRate},
        ${config.source}
      )
    `

    savedCount++
    addLog(`${platform}: metricas guardadas para ${target.influencerName}.`)
  }

  return savedCount
}
