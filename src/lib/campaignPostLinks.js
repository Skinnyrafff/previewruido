import sql from './db.js'

async function ensureCampaignPost({ campaignId, influencerId, plataforma, url }) {
  const cleanUrl = String(url || '').trim()
  if (!cleanUrl) return false

  const existing = await sql`
    SELECT id FROM posts
    WHERE campaign_id = ${campaignId}
      AND influencer_id = ${influencerId}
      AND url = ${cleanUrl}
    LIMIT 1
  `

  if (existing.length > 0) return false

  await sql`
    INSERT INTO posts (campaign_id, influencer_id, plataforma, url, fecha_publicacion, descripcion)
    VALUES (${campaignId}, ${influencerId}, ${plataforma}, ${cleanUrl}, null, '')
  `

  return true
}

export async function syncCampaignInfluencerVideoLinks({
  campaignId,
  influencerId,
  videoLinkTT,
  videoLinkIG,
}) {
  let createdPosts = 0

  if (await ensureCampaignPost({
    campaignId,
    influencerId,
    plataforma: 'TikTok',
    url: videoLinkTT,
  })) {
    createdPosts++
  }

  if (await ensureCampaignPost({
    campaignId,
    influencerId,
    plataforma: 'Instagram',
    url: videoLinkIG,
  })) {
    createdPosts++
  }

  return { createdPosts }
}
