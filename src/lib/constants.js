export const STORAGE_KEYS = {
  auth: 'ruido_auth',
  apifyToken: 'ruido_apify_token',
}

export const LOCALE = 'es-CL'

export const TIPOS = [
  'Bailes', 'Reviewers', 'Humor', 'Lifestyle', 'Música',
  'Gaming', 'Moda', 'Fitness', 'Viajes', 'Otros',
]

export const TIPO_COLORS = {
  Bailes:    { bg: '#EEEDFE', color: '#3C3489' },
  Reviewers: { bg: '#E6F1FB', color: '#0C447C' },
  Humor:     { bg: '#FAEEDA', color: '#633806' },
  Lifestyle: { bg: '#E1F5EE', color: '#085041' },
  Música:    { bg: '#FAECE7', color: '#712B13' },
  Gaming:    { bg: '#FBEAF0', color: '#72243E' },
  Moda:      { bg: '#FEF0FB', color: '#6B1560' },
  Fitness:   { bg: '#E8F5E9', color: '#1B5E20' },
  Viajes:    { bg: '#E3F2FD', color: '#0D47A1' },
  Otros:     { bg: '#F1EFE8', color: '#444441' },
}

export const SIZE_RANGES = [
  { label: 'Nano',  min: 0,       max: 10000,    bg: '#F1EFE8', color: '#5F5E5A' },
  { label: 'Micro', min: 10000,   max: 150000,   bg: '#E6F1FB', color: '#0C447C' },
  { label: 'Mid',   min: 150000,  max: 750000,   bg: '#EEEDFE', color: '#3C3489' },
  { label: 'Macro', min: 750000,  max: 4000000,  bg: '#EAF3DE', color: '#27500A' },
  { label: 'Mega',  min: 4000000, max: Infinity, bg: '#FAEEDA', color: '#633806' },
]

export const AV_COLORS = [
  { bg: '#FDDADA', color: '#C0392B' },
  { bg: '#E6EEFF', color: '#3B5BDB' },
  { bg: '#E1F5EE', color: '#1D9E75' },
  { bg: '#F3E8FF', color: '#7C3AED' },
  { bg: '#FFF3CD', color: '#BA7517' },
  { bg: '#FDE8F0', color: '#C2185B' },
  { bg: '#D4F4FF', color: '#0369A1' },
  { bg: '#E8F5E9', color: '#2E7D32' },
]

export const ESTADOS_INF = [
  'Contactado', 'Negociando', 'Confirmado', 'Brief enviado', 'Contenido recibido', 'Publicado',
]

export const ESTADO_INF_COLORS = {
  Contactado:           { bg: '#F1EFE8', color: '#5F5E5A' },
  Negociando:           { bg: '#FAEEDA', color: '#633806' },
  Confirmado:           { bg: '#E1F5EE', color: '#085041' },
  'Brief enviado':      { bg: '#E6F1FB', color: '#0C447C' },
  'Contenido recibido': { bg: '#EEEDFE', color: '#3C3489' },
  Publicado:            { bg: '#EAF3DE', color: '#27500A' },
}

export const ESTADO_CAMP_COLORS = {
  Activa:    { bg: '#EAF3DE', color: '#27500A' },
  Pausada:   { bg: '#FAEEDA', color: '#633806' },
  Cerrada:   { bg: '#E6F1FB', color: '#0C447C' },
  Cancelada: { bg: '#FCEBEB', color: '#791F1F' },
}

export const PLATAFORMAS = ['Ambas', 'TikTok', 'Instagram']

export const APIFY_ACTORS = {
  tiktok: 'clockworks~tiktok-scraper',
  instagram: 'apify~instagram-scraper',
}

export const APIFY_FAILED_STATUSES = ['FAILED', 'ABORTED', 'TIMED-OUT']
