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
