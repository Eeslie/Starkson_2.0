const { supabase } = require('../config/database')
const { BRANCHES } = require('../constants/branches')

let cachedAcronyms = null
let cacheTime = 0
const CACHE_MS = 60000 // 1 minute

async function getValidAcronyms() {
  if (cachedAcronyms && Date.now() - cacheTime < CACHE_MS) {
    return cachedAcronyms
  }
  try {
    const { data, error } = await supabase.from('branches').select('acronym')
    if (!error && data && data.length > 0) {
      cachedAcronyms = new Set(data.map((r) => r.acronym))
      cacheTime = Date.now()
      return cachedAcronyms
    }
  } catch (e) {
    console.warn('Branches table not available, using constants:', e.message)
  }
  cachedAcronyms = new Set(BRANCHES.map((b) => b.acronym))
  cacheTime = Date.now()
  return cachedAcronyms
}

function invalidateCache() {
  cachedAcronyms = null
}

module.exports = { getValidAcronyms, invalidateCache }
