import { normalizeUsername } from '../format'

export function mergeProfileLists(selectedProfiles, manualText) {
  const list = []

  selectedProfiles.forEach(p => {
    const clean = normalizeUsername(p)
    if (clean && !list.includes(clean)) list.push(clean)
  })

  manualText.split(/[\n,]+/).forEach(p => {
    const clean = normalizeUsername(p)
    if (clean && !list.includes(clean)) list.push(clean)
  })

  return list
}
