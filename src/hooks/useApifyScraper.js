import { useState, useEffect, useRef } from 'react'
import sql from '../lib/db'
import { STORAGE_KEYS, LOCALE } from '../lib/constants'
import { startActorRun, pollActorRun, fetchDatasetItems } from '../lib/apify'
import { mergeProfileLists } from '../lib/scraper/profiles'
import { saveScrapedPosts } from '../lib/scraper/savePosts'
import { saveScrapedProfiles } from '../lib/scraper/saveProfiles'

export function useApifyScraper(config) {
  const {
    platform,
    actorId,
    rosterUsernameField,
    buildRunBody,
    parseItems,
    noProfilesAlert,
    limitUnit = 'publicaciones',
  } = config

  const [apifyToken, setApifyToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [limit, setLimit] = useState(5)
  const [campaigns, setCampaigns] = useState([])
  const [roster, setRoster] = useState([])
  const [campaignInfluencerIds, setCampaignInfluencerIds] = useState({})
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [selectedRosterProfiles, setSelectedRosterProfiles] = useState([])
  const [manualProfiles, setManualProfiles] = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [logs, setLogs] = useState([])
  const [statusText, setStatusText] = useState('')
  const [results, setResults] = useState([])
  const [isSavingDb, setIsSavingDb] = useState(false)
  const [isSavingProfiles, setIsSavingProfiles] = useState(false)

  const pollCleanupRef = useRef(null)

  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEYS.apifyToken) || import.meta.env.VITE_APIFY_TOKEN || ''
    setApifyToken(savedToken)
    fetchDbData()
    return () => {
      if (pollCleanupRef.current) pollCleanupRef.current()
    }
  }, [])

  async function fetchDbData() {
    try {
      const campData = await sql`
        SELECT id, nombre, cliente, plataforma FROM campaigns
        ORDER BY created_at DESC
      `
      const campaignInfluencersData = await sql`
        SELECT campaign_id, influencer_id
        FROM campaign_influencers
      `
      const groupedCampaignInfluencers = {}
      campaignInfluencersData.forEach(row => {
        if (!groupedCampaignInfluencers[row.campaign_id]) {
          groupedCampaignInfluencers[row.campaign_id] = new Set()
        }
        groupedCampaignInfluencers[row.campaign_id].add(row.influencer_id)
      })
      setCampaigns(campData)
      setCampaignInfluencerIds(groupedCampaignInfluencers)
      setRoster(await config.fetchRoster())
    } catch (e) {
      console.error('Error cargando datos de BD:', e)
      addLog('Error cargando campañas o roster desde la base de datos.')
    }
  }

  const visibleRoster = selectedCampaignId
    ? roster.filter(inf => campaignInfluencerIds[selectedCampaignId]?.has(inf.id))
    : roster

  useEffect(() => {
    const visibleUsernames = new Set(
      visibleRoster
        .map(r => r[rosterUsernameField])
        .filter(Boolean)
    )
    setSelectedRosterProfiles(prev => prev.filter(profile => visibleUsernames.has(profile)))
  }, [visibleRoster, rosterUsernameField])

  function addLog(text) {
    const time = new Date().toLocaleTimeString(LOCALE)
    setLogs(prev => [...prev, `[${time}] ${text}`])
  }

  function saveToken(token) {
    setApifyToken(token)
    localStorage.setItem(STORAGE_KEYS.apifyToken, token)
    addLog('Token de Apify guardado localmente.')
  }

  function toggleRosterProfile(profileName) {
    setSelectedRosterProfiles(prev =>
      prev.includes(profileName)
        ? prev.filter(p => p !== profileName)
        : [...prev, profileName]
    )
  }

  function selectAllRoster() {
    setSelectedRosterProfiles(visibleRoster.map(r => r[rosterUsernameField]))
  }

  function selectNoneRoster() {
    setSelectedRosterProfiles([])
  }

  function getProfilesToScrape() {
    return mergeProfileLists(selectedRosterProfiles, manualProfiles)
  }

  async function handleStartScrape() {
    const profiles = getProfilesToScrape()
    if (profiles.length === 0) {
      alert(noProfilesAlert)
      return
    }
    if (!apifyToken.trim()) {
      alert('Por favor ingresa un token de API de Apify.')
      return
    }

    if (pollCleanupRef.current) pollCleanupRef.current()

    setLogs([])
    setResults([])
    setIsScraping(true)
    setStatusText('Iniciando...')
    addLog(`Iniciando extracción para ${profiles.length} perfiles: ${profiles.join(', ')}`)
    addLog(`Límite por perfil: ${limit} ${limitUnit}.`)

    try {
      addLog('Llamando a la API de Apify para iniciar el scraper...')
      const { runId, datasetId } = await startActorRun(actorId, apifyToken, buildRunBody(profiles, limit))
      addLog(`Ejecución iniciada con éxito. Run ID: ${runId}`)

      pollCleanupRef.current = pollActorRun({
        runId,
        datasetId,
        token: apifyToken,
        onStatus: status => {
          setStatusText(status)
          addLog(`Estado de la ejecución: ${status}...`)
        },
        onSuccess: () => {
          addLog('¡Ejecución de Apify exitosa! Descargando los datos recolectados...')
          fetchDataset(datasetId)
        },
        onError: error => {
          addLog(`ERROR durante polling: ${error.message}`)
          setIsScraping(false)
          setStatusText('Error')
        },
      })
    } catch (error) {
      addLog(`ERROR: ${error.message}`)
      setIsScraping(false)
      setStatusText('Error')
    }
  }

  async function fetchDataset(datasetId) {
    try {
      const items = await fetchDatasetItems(datasetId, apifyToken)
      addLog(`Descargados ${items.length} registros desde Apify. Procesando datos...`)

      const parsedItems = parseItems(items)
      setResults(parsedItems)
      addLog('Limpieza de datos finalizada.')

      if (selectedCampaignId) {
        await saveToDatabase(parsedItems, selectedCampaignId)
      } else {
        addLog('Modo local: Los datos no se guardaron automáticamente en Neon.')
      }

      setIsScraping(false)
      setStatusText('Completado')
    } catch (error) {
      addLog(`ERROR procesando datos: ${error.message}`)
      setIsScraping(false)
      setStatusText('Error')
    }
  }

  async function saveToDatabase(items, campaignId) {
    try {
      await saveScrapedPosts({ items, campaignId, roster, platform, addLog })
      await fetchDbData()
    } catch (e) {
      console.error(e)
      addLog(`Error al guardar en campaña: ${e.message}`)
    }
  }

  async function saveToProfiles(items) {
    try {
      await saveScrapedProfiles({ items, roster, platform, addLog })
      await fetchDbData()
    } catch (e) {
      console.error(e)
      addLog(`Error al guardar perfiles: ${e.message}`)
    }
  }

  async function handleSyncToDb() {
    if (results.length === 0) {
      alert('No hay métricas para guardar todavía.')
      return
    }
    if (!selectedCampaignId) {
      alert('Por favor selecciona una campaña en el panel izquierdo.')
      return
    }
    setIsSavingDb(true)
    try {
      await saveToDatabase(results, selectedCampaignId)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSavingDb(false)
    }
  }

  async function handleSyncProfiles() {
    if (results.length === 0) {
      alert('No hay métricas para guardar todavía.')
      return
    }
    setIsSavingProfiles(true)
    try {
      await saveToProfiles(results)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSavingProfiles(false)
    }
  }

  return {
    apifyToken,
    showToken,
    setShowToken,
    limit,
    setLimit,
    campaigns,
    roster: visibleRoster,
    selectedCampaignId,
    setSelectedCampaignId,
    selectedRosterProfiles,
    manualProfiles,
    setManualProfiles,
    isScraping,
    logs,
    statusText,
    results,
    isSavingDb,
    isSavingProfiles,
    saveToken,
    toggleRosterProfile,
    selectAllRoster,
    selectNoneRoster,
    handleStartScrape,
    handleSyncToDb,
    handleSyncProfiles,
    addLog,
    rosterUsernameField,
  }
}
