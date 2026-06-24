import sql from './db.js'
import { normalizePostUrl, sanitizeUrlInput } from './format.js'

async function ensureCampaignPost({ campaignId, influencerId, plataforma, url }) {
  const cleanUrl = sanitizeUrlInput(url)
  if (!cleanUrl) return false
  const normalizedTarget = normalizePostUrl(cleanUrl)

  const existing = await sql`
    SELECT id, url FROM posts
    WHERE campaign_id = ${campaignId}
      AND influencer_id = ${influencerId}
      AND plataforma = ${plataforma}
  `

  const matching = existing.find(post => normalizePostUrl(post.url) === normalizedTarget)
  if (matching) {
    if (matching.url !== cleanUrl) {
      await sql`UPDATE posts SET url = ${cleanUrl} WHERE id = ${matching.id}`
    }
  } else {
    await sql`
      INSERT INTO posts (campaign_id, influencer_id, plataforma, url, fecha_publicacion, descripcion)
      VALUES (${campaignId}, ${influencerId}, ${plataforma}, ${cleanUrl}, null, '')
    `
  }

  const stalePosts = existing.filter(post => normalizePostUrl(post.url) !== normalizedTarget)
  for (const post of stalePosts) {
    await sql`DELETE FROM post_metrics WHERE post_id = ${post.id}`
    await sql`DELETE FROM posts WHERE id = ${post.id}`
  }

  return !matching
}

async function removeCampaignPosts({ campaignId, influencerId, plataforma }) {
  const posts = await sql`
    SELECT id FROM posts
    WHERE campaign_id = ${campaignId}
      AND influencer_id = ${influencerId}
      AND plataforma = ${plataforma}
  `

  for (const post of posts) {
    await sql`DELETE FROM post_metrics WHERE post_id = ${post.id}`
    await sql`DELETE FROM posts WHERE id = ${post.id}`
  }
}

export async function syncCampaignInfluencerVideoLinks({
  campaignId,
  influencerId,
  videoLinkTT,
  videoLinkIG,
}) {
  let createdPosts = 0

  if (String(videoLinkTT || '').trim()) {
    if (await ensureCampaignPost({
      campaignId,
      influencerId,
      plataforma: 'TikTok',
      url: videoLinkTT,
    })) {
      createdPosts++
    }
  } else {
    await removeCampaignPosts({ campaignId, influencerId, plataforma: 'TikTok' })
  }

  if (String(videoLinkIG || '').trim()) {
    if (await ensureCampaignPost({
      campaignId,
      influencerId,
      plataforma: 'Instagram',
      url: videoLinkIG,
    })) {
      createdPosts++
    }
  } else {
    await removeCampaignPosts({ campaignId, influencerId, plataforma: 'Instagram' })
  }

  return { createdPosts }
}
