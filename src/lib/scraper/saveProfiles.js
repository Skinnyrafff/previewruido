import sql from '../db.js'
import { LOCALE } from '../constants.js'
import { normalizeUsername } from '../format.js'

const PLATFORM_HANDLERS = {
  tiktok: {
    usernameField: 'tt_usuario',
    getFollowers: inf => Number(inf.tt_seguidores) || 0,
    getLink: inf => inf.tt_link || '',
    buildProfileLink: username => `https://www.tiktok.com/@${username}`,
    updateProfile: ({ influencerId, followers, link }) => sql`
      UPDATE influencers
      SET tt_seguidores = ${followers}, tt_link = ${link}
      WHERE id = ${influencerId}
    `,
  },
  instagram: {
    usernameField: 'ig_usuario',
    getFollowers: inf => Number(inf.ig_seguidores) || 0,
    getLink: inf => inf.ig_link || '',
    buildProfileLink: username => `https://www.instagram.com/${username}/`,
    updateProfile: ({ influencerId, followers, link }) => sql`
      UPDATE influencers
      SET ig_seguidores = ${followers}, ig_link = ${link}
      WHERE id = ${influencerId}
    `,
  },
}

export async function saveScrapedProfiles({ items, roster, platform, addLog }) {
  const handler = PLATFORM_HANDLERS[platform]
  if (!handler) throw new Error(`Plataforma no soportada: ${platform}`)

  let actualizados = 0
  let omitidos = 0

  addLog('Sincronizando métricas a nivel perfil...')

  for (const item of items) {
    const cleanAuthor = normalizeUsername(item.author)
    const influencerMatch = roster.find(inf =>
      normalizeUsername(inf[handler.usernameField]) === cleanAuthor
    )

    if (!influencerMatch) {
      omitidos++
      addLog(`Perfil omitido: '@${item.author}' no existe en el roster.`)
      continue
    }

    const seguidoresActuales = handler.getFollowers(influencerMatch)
    const seguidoresNuevos = Number(item.authorFollowers) || 0
    const perfilActual = handler.getLink(influencerMatch)
    const perfilSugerido = cleanAuthor ? handler.buildProfileLink(cleanAuthor) : ''
    const followersFinal = seguidoresNuevos > 0 ? seguidoresNuevos : seguidoresActuales
    const linkFinal = perfilActual || perfilSugerido
    let huboCambios = false

    if (seguidoresNuevos > 0 && seguidoresNuevos !== seguidoresActuales) {
      huboCambios = true
      addLog(
        `Actualizando seguidores de @${cleanAuthor}: ${seguidoresActuales.toLocaleString(LOCALE)} → ${seguidoresNuevos.toLocaleString(LOCALE)}`
      )
    }
    if (!perfilActual && perfilSugerido) {
      huboCambios = true
      addLog(`Completando link de perfil para @${cleanAuthor}.`)
    }

    if (!huboCambios) continue

    await handler.updateProfile({
      influencerId: influencerMatch.id,
      followers: followersFinal,
      link: linkFinal,
    })
    actualizados++
  }

  addLog(`Sincronización de perfiles lista. ${actualizados} perfiles actualizados, ${omitidos} omitidos.`)
  return { actualizados, omitidos }
}
