import { LOCALE, SIZE_RANGES } from './constants.js'

export function fmtNum(n) {
  n = Number(n) || 0
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'K'
  return n.toLocaleString(LOCALE)
}

export function fmtSeg(n) {
  return fmtNum(n)
}

export function fmtMoney(n, moneda = 'CLP') {
  n = Math.round(Number(n))
  if (moneda === 'USD') return '$' + n.toLocaleString('en-US')
  return '$' + n.toLocaleString(LOCALE)
}

export function getSize(n) {
  n = Number(n)
  return SIZE_RANGES.find(r => n >= r.min && n < r.max) || SIZE_RANGES[0]
}

export function getSizeLabel(n) {
  return getSize(n).label
}

export function parsePublishDate(rawTime) {
  if (!rawTime) return ''
  if (typeof rawTime === 'number') {
    return new Date(rawTime * 1000).toISOString().split('T')[0]
  }
  try {
    return new Date(rawTime).toISOString().split('T')[0]
  } catch {
    return ''
  }
}

export function normalizeUsername(value) {
  return String(value || '').replace(/^@/, '').toLowerCase().trim()
}

export function sanitizeUrlInput(value) {
  return String(value || '')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

export function normalizePostUrl(value) {
  const raw = sanitizeUrlInput(value)
  if (!raw) return ''

  try {
    const url = new URL(ensureUrlProtocol(raw))
    url.hash = ''
    url.search = ''
    url.hostname = url.hostname.toLowerCase()

    if (url.hostname === 'm.instagram.com') url.hostname = 'www.instagram.com'
    if (url.hostname === 'instagram.com') url.hostname = 'www.instagram.com'

    return url.toString().replace(/\/$/, '')
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()
  }
}

function ensureUrlProtocol(value) {
  const raw = sanitizeUrlInput(value)
  if (!raw) return ''
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}

export function isTikTokUrl(value) {
  try {
    const url = new URL(ensureUrlProtocol(value))
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    return hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com')
  } catch {
    return false
  }
}

export function isInstagramUrl(value) {
  try {
    const url = new URL(ensureUrlProtocol(value))
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
    return hostname === 'instagram.com' || hostname.endsWith('.instagram.com')
  } catch {
    return false
  }
}
