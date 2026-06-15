import { parsePublishDate } from '../format.js'

export function parseInstagramItems(items) {
  return items.map(item => {
    const author = item.ownerUsername || item.username || item.owner?.username || 'desconocido'

    const url = item.url
      || (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : '')

    const likes = Number(item.likesCount || item.likes || 0)
    const comments = Number(item.commentsCount || item.comments || 0)
    const views = Number(item.videoViewCount || item.videoPlayCount || item.views || 0)

    const authorFollowers = Number(
      item.ownerFollowersCount ||
      item.followersCount ||
      item.owner?.followersCount ||
      0
    )

    const postType = item.type || (item.isVideo ? 'Video/Reel' : 'Imagen')
    const description = item.caption || item.description || ''
    const publishDate = parsePublishDate(item.timestamp || item.takenAt)

    return { author, url, likes, comments, views, authorFollowers, postType, description, publishDate }
  })
}
