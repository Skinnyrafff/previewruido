import { parsePublishDate } from '../format.js'

export function parseTikTokItems(items) {
  return items.map(item => {
    const author = item.author?.uniqueId || item.authorMeta?.uniqueId || item.authorMeta?.name || item.author || item.nickname || 'desconocido'
    const videoId = item.id || item.id_str
    const url = item.webVideoUrl || item.videoUrl || item.shareUrl || item.url || (videoId ? `https://www.tiktok.com/@${author}/video/${videoId}` : '')

    const views = Number(item.playCount || item.views || item.video?.playCount || 0)
    const likes = Number(item.diggCount || item.likes || 0)
    const comments = Number(item.commentCount || item.comments || 0)
    const shares = Number(item.shareCount || item.shares || 0)
    const saves = Number(item.collectCount || item.saves || 0)

    const authorFollowers = Number(
      item.authorMeta?.fans ||
      item.authorMeta?.followerCount ||
      item.authorMeta?.followers ||
      item.authorStats?.followerCount ||
      item.author?.followerCount ||
      item.author?.fans ||
      item.author?.followers ||
      0
    )

    const description = item.desc || item.text || item.description || ''
    const publishDate = parsePublishDate(item.createTime || item.createdAt)

    return { author, url, views, likes, comments, shares, saves, description, publishDate, authorFollowers }
  })
}
