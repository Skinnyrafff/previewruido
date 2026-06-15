import sql from '../db.js'
import { LOCALE } from '../constants.js'
import { normalizeUsername } from '../format.js'
import { calcEngagementRate, calcTikTokEngagement, calcInstagramEngagement } from '../engagement.js'

const PLATFORM_HANDLERS = {
  tiktok: {
    plataforma: 'TikTok',
    metricsSource: 'apify',
    autoAddNote: 'Agregado automáticamente por extractor TikTok',
    getUsername: inf => inf.tt_usuario,
    getFollowers: inf => Number(inf.tt_seguidores) || 0,
    calcEngagement: calcTikTokEngagement,
    metricsValues: item => ({
      views: item.views,
      likes: item.likes,
      comments: item.comments,
      shares: item.shares,
      saves: item.saves,
    }),
    fetchCampInfs: campaignId => sql`
      SELECT ci.influencer_id, i.nombre, i.tt_usuario, i.tt_seguidores
      FROM campaign_influencers ci
      JOIN influencers i ON i.id = ci.influencer_id
      WHERE ci.campaign_id = ${campaignId}
    `,
    updateFollowers: (influencerId, count) => sql`
      UPDATE influencers SET tt_seguidores = ${count} WHERE id = ${influencerId}
    `,
  },
  instagram: {
    plataforma: 'Instagram',
    metricsSource: 'apify-instagram',
    autoAddNote: 'Agregado automáticamente por extractor Instagram',
    getUsername: inf => inf.ig_usuario,
    getFollowers: inf => Number(inf.ig_seguidores) || 0,
    calcEngagement: calcInstagramEngagement,
    metricsValues: item => ({
      views: item.views,
      likes: item.likes,
      comments: item.comments,
      shares: 0,
      saves: 0,
    }),
    fetchCampInfs: campaignId => sql`
      SELECT ci.influencer_id, i.nombre, i.ig_usuario, i.ig_seguidores
      FROM campaign_influencers ci
      JOIN influencers i ON i.id = ci.influencer_id
      WHERE ci.campaign_id = ${campaignId}
    `,
    updateFollowers: (influencerId, count) => sql`
      UPDATE influencers SET ig_seguidores = ${count} WHERE id = ${influencerId}
    `,
  },
}

export async function saveScrapedPosts({ items, campaignId, roster, platform, addLog }) {
  const handler = PLATFORM_HANDLERS[platform]
  if (!handler) throw new Error(`Plataforma no soportada: ${platform}`)

  addLog(`Iniciando guardado en Base de Datos para Campaña ID: ${campaignId}...`)
  let guardadosCount = 0
  let asociadosCount = 0

  const campInfs = await handler.fetchCampInfs(campaignId)

  for (const item of items) {
    const cleanAuthor = normalizeUsername(item.author)

    const influencerMatch = roster.find(inf =>
      normalizeUsername(handler.getUsername(inf)) === cleanAuthor
    )

    if (!influencerMatch) {
      addLog(`Advertencia: No se encontró '@${item.author}' en el Roster. Se omitió.`)
      continue
    }

    asociadosCount++
    const influencerId = influencerMatch.id
    let seguidores = handler.getFollowers(influencerMatch)

    const scrapedFollowers = Number(item.authorFollowers) || 0
    if (scrapedFollowers > 0 && scrapedFollowers !== seguidores) {
      addLog(`Actualizando seguidores para @${item.author}: ${seguidores.toLocaleString(LOCALE)} → ${scrapedFollowers.toLocaleString(LOCALE)}`)
      try {
        await handler.updateFollowers(influencerId, scrapedFollowers)
        seguidores = scrapedFollowers
      } catch (err) {
        addLog(`Error al actualizar seguidores: ${err.message}`)
      }
    }

    const inCamp = campInfs.find(ci => ci.influencer_id === influencerId)
    if (!inCamp) {
      addLog(`Asociando automáticamente a '${influencerMatch.nombre}' a la campaña...`)
      await sql`
        INSERT INTO campaign_influencers (campaign_id, influencer_id, costo, piezas, estado, notas)
        VALUES (${campaignId}, ${influencerId}, 0, 1, 'Publicado', ${handler.autoAddNote})
      `
    }

    const postCheck = await sql`
      SELECT id FROM posts
      WHERE campaign_id = ${campaignId}
        AND influencer_id = ${influencerId}
        AND url = ${item.url}
      LIMIT 1
    `

    let postId = postCheck.length > 0 ? postCheck[0].id : null

    if (!postId) {
      const newPost = await sql`
        INSERT INTO posts (campaign_id, influencer_id, plataforma, url, fecha_publicacion, descripcion)
        VALUES (${campaignId}, ${influencerId}, ${handler.plataforma}, ${item.url}, ${item.publishDate || null}, ${item.description})
        RETURNING id
      `
      postId = newPost[0].id
    }

    const totalEng = handler.calcEngagement(item)
    const er = calcEngagementRate(totalEng, seguidores)
    const metrics = handler.metricsValues(item)

    await sql`
      INSERT INTO post_metrics (post_id, views, likes, comentarios, shares, saves, engagement_rate, fuente)
      VALUES (
        ${postId},
        ${metrics.views},
        ${metrics.likes},
        ${metrics.comments},
        ${metrics.shares},
        ${metrics.saves},
        ${er},
        ${handler.metricsSource}
      )
    `
    guardadosCount++
  }

  addLog(`¡Sincronización exitosa! Se guardaron ${guardadosCount} registros para ${asociadosCount} influencers.`)
  return { guardadosCount, asociadosCount }
}
