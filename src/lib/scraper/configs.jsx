import sql from '../db'
import { APIFY_ACTORS, LOCALE } from '../constants'
import { parseTikTokItems } from './tiktok'
import { parseInstagramItems } from './instagram'
import { escapeCsvField } from '../csv'

async function fetchTikTokRoster() {
  return sql`
    SELECT id, nombre, tt_usuario, tt_seguidores FROM influencers
    WHERE estado = 'Activo' AND tt_usuario IS NOT NULL AND tt_usuario != ''
    ORDER BY nombre ASC
  `
}

async function fetchInstagramRoster() {
  return sql`
    SELECT id, nombre, ig_usuario, ig_seguidores FROM influencers
    WHERE estado = 'Activo' AND ig_usuario IS NOT NULL AND ig_usuario != ''
    ORDER BY nombre ASC
  `
}

export const TIKTOK_SCRAPER_CONFIG = {
  platform: 'tiktok',
  actorId: APIFY_ACTORS.tiktok,
  rosterUsernameField: 'tt_usuario',
  fetchRoster: fetchTikTokRoster,
  noProfilesAlert: 'Por favor ingresa o selecciona al menos un perfil de TikTok.',
  limitUnit: 'videos',
  title: 'Extractor de Métricas de TikTok',
  subtitle: 'Conecta con Apify para descargar métricas en vivo de perfiles públicos e integrarlas a tu base de datos de campañas.',
  limitLabel: 'Límite de videos por perfil',
  emptyRosterMessage: 'No hay influencers con TikTok en Roster',
  manualProfilesTitle: 'Otros Perfiles de TikTok',
  manualProfilesPlaceholder: 'ej: @khaby.lame, bellapoarch, tiktok',
  startButtonLabel: 'Iniciar Extracción Live ⚡',
  consoleTitle: 'CONSOLA DE EVENTOS RUIDO LAB',
  saveCheckboxId: 'saveToDbCheckbox',
  csvFilenamePrefix: 'tiktok_metrics',
  buildRunBody: (profiles, limit) => ({
    profiles,
    resultsPerPage: Number(limit),
    profileSorting: 'latest',
  }),
  parseItems: parseTikTokItems,
  summaryCards: results => [
    { label: 'Videos Extraídos', value: results.length, color: '#1A1A1A' },
    { label: 'Total Reproducciones', value: results.reduce((s, r) => s + r.views, 0).toLocaleString(LOCALE), color: '#E8313A' },
    { label: 'Total Me Gusta', value: results.reduce((s, r) => s + r.likes, 0).toLocaleString(LOCALE), color: '#0C447C' },
    { label: 'Total Comentarios', value: results.reduce((s, r) => s + r.comments, 0).toLocaleString(LOCALE), color: '#3B6D11' },
  ],
  csvExport: results => ({
    headers: ['Perfil', 'Seguidores', 'URL Video', 'Views', 'Likes', 'Comentarios', 'Shares', 'Saves', 'Descripcion', 'Fecha Publicacion'],
    rows: results.map(r => [
      r.author,
      r.authorFollowers || 0,
      r.url,
      r.views,
      r.likes,
      r.comments,
      r.shares,
      r.saves,
      escapeCsvField(r.description),
      r.publishDate,
    ]),
  }),
  tableColumns: [
    { key: 'author', label: 'Perfil', width: 140 },
    { key: 'followers', label: 'Seguidores', width: 100 },
    { key: 'publishDate', label: 'Fecha Pub.', width: 100 },
    { key: 'views', label: 'Views', width: 100 },
    { key: 'likes', label: 'Likes', width: 90 },
    { key: 'comments', label: 'Comentarios', width: 100 },
    { key: 'shares', label: 'Shares', width: 90 },
    { key: 'saves', label: 'Saves', width: 80 },
    { key: 'description', label: 'Descripción del Video', width: 220 },
    { key: 'action', label: 'Acción', width: 80 },
  ],
  renderCell: (row, key) => {
    switch (key) {
      case 'author':
        return <span style={{ fontWeight: 500 }}>@{row.author}</span>
      case 'followers':
        return row.authorFollowers ? row.authorFollowers.toLocaleString(LOCALE) : '—'
      case 'publishDate':
        return <span style={{ color: '#888' }}>{row.publishDate || '—'}</span>
      case 'views':
        return <span style={{ fontWeight: 500 }}>{row.views.toLocaleString(LOCALE)}</span>
      case 'likes':
      case 'comments':
      case 'shares':
      case 'saves':
        return row[key].toLocaleString(LOCALE)
      case 'description':
        return row.description
          ? <span style={{ color: '#666', fontSize: 12 }} title={row.description}>{row.description}</span>
          : <span style={{ color: '#CCC', fontStyle: 'italic' }}>Sin descripción</span>
      case 'action':
        return (
          <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ color: '#E8313A', textDecoration: 'none', fontWeight: 500 }}>
            Ver ↗
          </a>
        )
      default:
        return '—'
    }
  },
}

export const INSTAGRAM_SCRAPER_CONFIG = {
  platform: 'instagram',
  actorId: APIFY_ACTORS.instagram,
  rosterUsernameField: 'ig_usuario',
  fetchRoster: fetchInstagramRoster,
  noProfilesAlert: 'Por favor ingresa o selecciona al menos un perfil de Instagram.',
  limitUnit: 'publicaciones',
  title: 'Extractor de Métricas de Instagram',
  subtitle: 'Conecta con Apify para descargar métricas de perfiles públicos de Instagram e integrarlas a tus campañas.',
  limitLabel: 'Límite de posts por perfil',
  emptyRosterMessage: 'No hay influencers con Instagram en Roster',
  manualProfilesTitle: 'Otros Perfiles de Instagram',
  manualProfilesPlaceholder: 'ej: @cristiano, leomessi, natgeo',
  startButtonLabel: 'Iniciar Extracción IG ⚡',
  consoleTitle: 'CONSOLA DE EVENTOS RUIDO LAB — INSTAGRAM',
  saveCheckboxId: 'igSaveToDbCheckbox',
  csvFilenamePrefix: 'instagram_metrics',
  warningBanner: (
    <>
      Instagram tiene restricciones más estrictas que TikTok. El scraper puede requerir más tiempo y en algunos casos puede no retornar todos los posts si el perfil está limitado por Instagram.
      <br />
      <strong>Views</strong> solo están disponibles en publicaciones de tipo Reel/Video.
    </>
  ),
  buildRunBody: (profiles, limit) => ({
    usernames: profiles,
    resultsLimit: Number(limit),
    resultsType: 'posts',
  }),
  parseItems: parseInstagramItems,
  summaryCards: results => [
    { label: 'Posts Extraídos', value: results.length, color: '#1A1A1A' },
    { label: 'Total Views', value: results.reduce((s, r) => s + r.views, 0).toLocaleString(LOCALE), color: '#E8313A' },
    { label: 'Total Likes', value: results.reduce((s, r) => s + r.likes, 0).toLocaleString(LOCALE), color: '#C2185B' },
    { label: 'Total Comentarios', value: results.reduce((s, r) => s + r.comments, 0).toLocaleString(LOCALE), color: '#3B6D11' },
  ],
  csvExport: results => ({
    headers: ['Perfil', 'Seguidores', 'Tipo', 'URL', 'Views', 'Likes', 'Comentarios', 'Descripcion', 'Fecha'],
    rows: results.map(r => [
      r.author,
      r.authorFollowers || 0,
      r.postType,
      r.url,
      r.views,
      r.likes,
      r.comments,
      escapeCsvField(r.description),
      r.publishDate,
    ]),
  }),
  tableColumns: [
    { key: 'author', label: 'Perfil', width: 130 },
    { key: 'followers', label: 'Seguidores', width: 100 },
    { key: 'postType', label: 'Tipo', width: 80 },
    { key: 'publishDate', label: 'Fecha Pub.', width: 90 },
    { key: 'views', label: 'Views', width: 90 },
    { key: 'likes', label: 'Likes', width: 80 },
    { key: 'comments', label: 'Comentarios', width: 90 },
    { key: 'description', label: 'Descripción', width: 210 },
    { key: 'action', label: 'Acción', width: 70 },
  ],
  renderCell: (row, key) => {
    switch (key) {
      case 'author':
        return <span style={{ fontWeight: 500 }}>@{row.author}</span>
      case 'followers':
        return row.authorFollowers ? row.authorFollowers.toLocaleString(LOCALE) : '—'
      case 'postType':
        const isVideo = row.postType?.includes('Video') || row.postType?.includes('Reel')
        return (
          <span style={{
            fontSize: 10.5, padding: '2px 7px', borderRadius: 20,
            background: isVideo ? '#FEF0FB' : '#F0F0EE',
            color: isVideo ? '#6B1560' : '#555',
          }}>
            {row.postType || 'Post'}
          </span>
        )
      case 'publishDate':
        return <span style={{ color: '#888' }}>{row.publishDate || '—'}</span>
      case 'views':
        return <span style={{ fontWeight: 500 }}>{row.views > 0 ? row.views.toLocaleString(LOCALE) : '—'}</span>
      case 'likes':
      case 'comments':
        return row[key].toLocaleString(LOCALE)
      case 'description':
        return row.description
          ? <span style={{ color: '#666', fontSize: 12 }} title={row.description}>{row.description}</span>
          : <span style={{ color: '#CCC', fontStyle: 'italic' }}>Sin descripción</span>
      case 'action':
        return (
          <a href={row.url} target="_blank" rel="noopener noreferrer" style={{ color: '#E8313A', textDecoration: 'none', fontWeight: 500 }}>
            Ver ↗
          </a>
        )
      default:
        return '—'
    }
  },
}
