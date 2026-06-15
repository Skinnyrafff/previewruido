export function calcEngagementRate(totalEngagement, followers) {
  const seguidores = Number(followers) || 0
  if (seguidores <= 0) return 0
  return Math.round((totalEngagement / seguidores) * 10000) / 100
}

export function calcTikTokEngagement(item) {
  return (item.likes || 0) + (item.comments || 0) + (item.shares || 0) + (item.saves || 0)
}

export function calcInstagramEngagement(item) {
  return (item.likes || 0) + (item.comments || 0)
}
