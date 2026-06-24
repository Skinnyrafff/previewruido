import { useState, useEffect } from 'react'
import sql from '../lib/db'
import Modal from './Modal'
import SharePanel from './SharePanel'
import Reportes from './Reportes'
import {
  TIPOS, TIPO_COLORS, SIZE_RANGES, ESTADOS_INF, ESTADO_INF_COLORS, ESTADO_CAMP_COLORS, PLATAFORMAS, STORAGE_KEYS,
} from '../lib/constants'
import { fmtSeg, fmtMoney, getSize } from '../lib/format'
import { syncCampaignInfluencerVideoLinks } from '../lib/campaignPostLinks'
import { collectCampaignScrapeTargets, scrapeCampaignMetrics } from '../lib/campaignScraper'
import Avatar from './ui/Avatar'
import BudgetBar from './ui/BudgetBar'

const TABS_LISTA = ['Activas', 'Pausadas', 'Cerradas', 'Canceladas', 'Todas']
const TABS_DETALLE = ['influencers', 'reportes']
const SCRAPE_COOLDOWN_MS = 60 * 60 * 1000

function BudgetSummary({ camp }) {
  const usado = camp.influencers?.reduce((s, i) => s + Number(i.costo), 0) || 0
  const restante = camp.budget - usado
  const pct = camp.budget > 0 ? Math.min(100, Math.round((usado / camp.budget) * 100)) : 0
  const statusColor = pct >= 100 ? '#A32D2D' : pct >= 90 ? '#854F0B' : '#3B6D11'
  const statusBg = pct >= 100 ? '#FCEBEB' : pct >= 90 ? '#FAEEDA' : '#EAF3DE'
  const barColor = pct >= 100 ? '#E24B4A' : pct >= 90 ? '#EF9F27' : '#639922'
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
      background: '#F7F7F5', borderRadius: 12, padding: '14px 16px', marginBottom: 20,
      border: '0.5px solid #E5E5E2',
    }}>
      <div>
        <div style={{ fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Budget</div>
        <div style={{ fontSize: 20, fontWeight: 500 }}>{fmtMoney(camp.budget, camp.moneda)}</div>
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{camp.moneda}</div>
      </div>
      <div>
        <div style={{ fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Gastado</div>
        <div style={{ fontSize: 20, fontWeight: 500 }}>{fmtMoney(usado, camp.moneda)}</div>
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{camp.influencers?.length || 0} influencers</div>
      </div>
      <div>
        <div style={{ fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Restante</div>
        <div style={{ fontSize: 20, fontWeight: 500, color: statusColor }}>{fmtMoney(restante, camp.moneda)}</div>
        <div style={{ fontSize: 11, marginTop: 2 }}>
          <span style={{ background: statusBg, color: statusColor, padding: '1px 7px', borderRadius: 20 }}>{pct}% usado</span>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>Alcance total</div>
        <div style={{ fontSize: 20, fontWeight: 500 }}>
          {fmtSeg(camp.influencers?.reduce((s, i) => {
            const ig = camp.plataforma !== 'TikTok' ? Number(i.ig_seguidores || 0) : 0
            const tt = camp.plataforma !== 'Instagram' ? Number(i.tt_seguidores || 0) : 0
            return s + ig + tt
          }, 0) || 0)}
        </div>
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>{camp.plataforma || 'Ambas'}</div>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ height: 6, background: '#E5E5E2', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', background: barColor, borderRadius: 3 }} />
        </div>
      </div>
    </div>
  )
}

const EMPTY_CAMP = { nombre: '', cliente: '', budget: '', moneda: 'CLP', brief: '', plataforma: 'Ambas' }
const EMPTY_CI = { costo: '', piezas: '1', estado: 'Contactado', notas: '', video_link_tt: '', video_link_ig: '' }

export default function Campanas() {
  const [camps, setCamps] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentCamp, setCurrentCamp] = useState(null)
  const [roster, setRoster] = useState([])
  const [tab, setTab] = useState('Activas')
  const [campTab, setCampTab] = useState('influencers')

  const [modalNewCamp, setModalNewCamp] = useState(false)
  const [campForm, setCampForm] = useState(EMPTY_CAMP)
  const [savingCamp, setSavingCamp] = useState(false)
  const [editCampModal, setEditCampModal] = useState(false)
  const [editCampForm, setEditCampForm] = useState(EMPTY_CAMP)
  const [savingEditCamp, setSavingEditCamp] = useState(false)

  const [modalAddInf, setModalAddInf] = useState(false)
  const [infSearch, setInfSearch] = useState('')
  const [infFilterTipo, setInfFilterTipo] = useState('')
  const [infFilterSize, setInfFilterSize] = useState('')
  const [selInf, setSelInf] = useState(null)
  const [ciForm, setCiForm] = useState(EMPTY_CI)
  const [selectedInfIds, setSelectedInfIds] = useState([])
  const [savingCI, setSavingCI] = useState(false)

  const [editCIModal, setEditCIModal] = useState(false)
  const [editCI, setEditCI] = useState(null)
  const [editCIForm, setEditCIForm] = useState(EMPTY_CI)

  const [deleteCampId, setDeleteCampId] = useState(null)
  const [deleteCI, setDeleteCI] = useState(null)
  const [changeEstadoModal, setChangeEstadoModal] = useState(false)
  const [apifyToken, setApifyToken] = useState('')
  const [scrapingCamp, setScrapingCamp] = useState(false)
  const [scrapeLogs, setScrapeLogs] = useState([])
  const [nowTs, setNowTs] = useState(Date.now())

  useEffect(() => {
    const savedToken =
      localStorage.getItem(STORAGE_KEYS.apifyToken) ||
      import.meta.env.VITE_APIFY_TOKENS ||
      import.meta.env.VITE_APIFY_TOKEN ||
      ''
    setApifyToken(savedToken)
    fetchCamps()
    fetchRoster()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNowTs(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  async function fetchCamps() {
    setLoading(true)
    try {
      const data = await sql`
        SELECT
          c.*,
          ci.id AS ci_id, ci.costo, ci.piezas,
          ci.estado AS ci_estado, ci.notas AS ci_notas,
          ci.video_link_tt, ci.video_link_ig,
          ci.influencer_id,
          i.nombre AS inf_nombre,
          i.ig_usuario, i.ig_seguidores,
          i.tt_usuario, i.tt_seguidores,
          i.tipos_contenido, i.avatar_url
        FROM campaigns c
        LEFT JOIN campaign_influencers ci ON ci.campaign_id = c.id
        LEFT JOIN influencers i ON i.id = ci.influencer_id
        ORDER BY c.created_at DESC
      `
      const grouped = {}
      data.forEach(row => {
        if (!grouped[row.id]) {
          grouped[row.id] = {
            id: row.id, nombre: row.nombre, cliente: row.cliente,
            budget: row.budget, moneda: row.moneda, brief: row.brief,
            estado: row.estado, share_token: row.share_token,
            share_active: row.share_active, created_at: row.created_at,
            plataforma: row.plataforma || 'Ambas',
            influencers: [],
          }
        }
        if (row.ci_id) {
          grouped[row.id].influencers.push({
            ci_id: row.ci_id, influencer_id: row.influencer_id,
            costo: row.costo, piezas: row.piezas,
            ci_estado: row.ci_estado, ci_notas: row.ci_notas,
            video_link_tt: row.video_link_tt || '',
            video_link_ig: row.video_link_ig || '',
            nombre: row.inf_nombre,
            ig_usuario: row.ig_usuario, ig_seguidores: row.ig_seguidores,
            tt_usuario: row.tt_usuario, tt_seguidores: row.tt_seguidores,
            tipos_contenido: row.tipos_contenido || [],
          })
        }
      })
      const list = Object.values(grouped).map(camp => ({
        ...camp,
        influencers: camp.influencers.sort((a, b) =>
          (Number(b.ig_seguidores) + Number(b.tt_seguidores)) -
          (Number(a.ig_seguidores) + Number(a.tt_seguidores))
        ),
      }))
      setCamps(list)
      if (currentCamp) {
        const updated = list.find(c => c.id === currentCamp.id)
        if (updated) setCurrentCamp(updated)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function fetchRoster() {
    try {
      const data = await sql`
        SELECT * FROM influencers WHERE estado = 'Activo'
        ORDER BY (ig_seguidores + tt_seguidores) DESC
      `
      setRoster(data)
    } catch (e) { console.error(e) }
  }

  async function saveCamp() {
    if (!campForm.nombre.trim() || !campForm.cliente.trim()) return
    setSavingCamp(true)
    try {
      await sql`
        INSERT INTO campaigns (nombre, cliente, budget, moneda, brief, plataforma, share_token)
        VALUES (
          ${campForm.nombre}, ${campForm.cliente},
          ${parseInt(campForm.budget) || 0},
          ${campForm.moneda}, ${campForm.brief},
          ${campForm.plataforma}, ${crypto.randomUUID()}
        )
      `
      setModalNewCamp(false)
      setCampForm(EMPTY_CAMP)
      await fetchCamps()
    } catch (e) { console.error(e) }
    setSavingCamp(false)
  }

  function openEditCamp() {
    setEditCampForm({
      nombre: currentCamp.nombre,
      cliente: currentCamp.cliente,
      budget: currentCamp.budget,
      moneda: currentCamp.moneda,
      brief: currentCamp.brief || '',
      plataforma: currentCamp.plataforma || 'Ambas',
    })
    setEditCampModal(true)
  }

  async function saveEditCamp() {
    if (!editCampForm.nombre.trim() || !editCampForm.cliente.trim()) return
    setSavingEditCamp(true)
    try {
      await sql`
        UPDATE campaigns SET
          nombre = ${editCampForm.nombre},
          cliente = ${editCampForm.cliente},
          budget = ${parseInt(editCampForm.budget) || 0},
          moneda = ${editCampForm.moneda},
          plataforma = ${editCampForm.plataforma},
          brief = ${editCampForm.brief}
        WHERE id = ${currentCamp.id}
      `
      setEditCampModal(false)
      await fetchCamps()
    } catch (e) { console.error(e) }
    setSavingEditCamp(false)
  }

  async function updateEstado(id, estado) {
    try {
      await sql`UPDATE campaigns SET estado = ${estado} WHERE id = ${id}`
      setChangeEstadoModal(false)
      await fetchCamps()
    } catch (e) { console.error(e) }
  }

  async function deleteCamp(id) {
    try {
      await sql`DELETE FROM campaigns WHERE id = ${id}`
      setDeleteCampId(null)
      if (currentCamp?.id === id) setCurrentCamp(null)
      await fetchCamps()
    } catch (e) { console.error(e) }
  }

  function openAddInfModal() {
    setSelInf(null)
    setCiForm(EMPTY_CI)
    setSelectedInfIds([])
    setInfSearch('')
    setInfFilterTipo('')
    setInfFilterSize('')
    setModalAddInf(true)
  }

  function toggleInfSelection(id) {
    setSelectedInfIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  async function addSelectedInfluencers() {
    if (selectedInfIds.length === 0) return
    setSavingCI(true)
    try {
      for (const infId of selectedInfIds) {
        await sql`
          INSERT INTO campaign_influencers (campaign_id, influencer_id, costo, piezas, estado, notas, video_link_tt, video_link_ig)
          VALUES (${currentCamp.id}, ${infId}, 0, 1, 'Contactado', '', '', '')
        `
      }
      setModalAddInf(false)
      setSelectedInfIds([])
      await fetchCamps()
    } catch (e) { console.error(e) }
    setSavingCI(false)
  }

  async function removeInfluencer(ciId) {
    try {
      await sql`DELETE FROM campaign_influencers WHERE id = ${ciId}`
      setDeleteCI(null)
      await fetchCamps()
    } catch (e) { console.error(e) }
  }

  function openEditCI(inf) {
    setEditCI(inf)
    setEditCIForm({
      costo: inf.costo, piezas: inf.piezas,
      estado: inf.ci_estado, notas: inf.ci_notas || '',
      video_link_tt: inf.video_link_tt || '',
      video_link_ig: inf.video_link_ig || '',
    })
    setEditCIModal(true)
  }

  async function saveEditCI() {
    try {
      await sql`
        UPDATE campaign_influencers SET
          costo = ${parseInt(editCIForm.costo) || 0},
          piezas = ${parseInt(editCIForm.piezas) || 1},
          estado = ${editCIForm.estado},
          notas = ${editCIForm.notas},
          video_link_tt = ${editCIForm.video_link_tt},
          video_link_ig = ${editCIForm.video_link_ig}
        WHERE id = ${editCI.ci_id}
      `
      await syncCampaignInfluencerVideoLinks({
        campaignId: currentCamp.id,
        influencerId: editCI.influencer_id,
        videoLinkTT: editCIForm.video_link_tt,
        videoLinkIG: editCIForm.video_link_ig,
      })
      setEditCIModal(false)
      await fetchCamps()
    } catch (e) { console.error(e) }
  }

  function addScrapeLog(message) {
    const time = new Date().toLocaleTimeString('es-CL')
    setScrapeLogs(prev => [...prev, `[${time}] ${message}`])
  }

  function getCooldownKey(campaignId) {
    return `ruido_campaign_scrape_cooldown_${campaignId}`
  }

  function getCooldownUntil(campaignId) {
    if (!campaignId) return 0
    const raw = localStorage.getItem(getCooldownKey(campaignId))
    const value = Number(raw) || 0
    return value > Date.now() - (24 * SCRAPE_COOLDOWN_MS) ? value : 0
  }

  function setCooldown(campaignId) {
    const until = Date.now() + SCRAPE_COOLDOWN_MS
    localStorage.setItem(getCooldownKey(campaignId), String(until))
    setNowTs(Date.now())
  }

  function formatCooldown(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':')
  }

  async function handleCampaignScrape() {
    if (!currentCamp) return
    if (!apifyToken.trim()) {
      alert('Ingresa un token de Apify para scrapear esta campana.')
      return
    }

    const targets = collectCampaignScrapeTargets(currentCamp)
    if (targets.length === 0) {
      alert('Esta campana no tiene links cargados para scrapear.')
      return
    }

    setScrapeLogs([])
    setScrapingCamp(true)

    try {
      addScrapeLog(`Scraping iniciado para ${targets.length} link${targets.length === 1 ? '' : 's'} de la campana.`)
      const result = await scrapeCampaignMetrics({
        camp: currentCamp,
        token: apifyToken.trim(),
        addLog: addScrapeLog,
      })
      setCooldown(currentCamp.id)
      await fetchCamps()
      setCampTab('reportes')
      addScrapeLog(`Proceso finalizado. ${result.totalSaved} snapshot${result.totalSaved === 1 ? '' : 's'} guardado${result.totalSaved === 1 ? '' : 's'}.`)
    } catch (error) {
      console.error(error)
      addScrapeLog(`ERROR: ${error.message}`)
      alert(error.message)
    } finally {
      setScrapingCamp(false)
    }
  }

  const filteredCamps = camps.filter(c => {
    if (tab === 'Todas') return true
    return c.estado === tab.slice(0, -1)
  })

  const availableInfs = roster.filter(inf => {
    if (currentCamp?.influencers.find(i => i.influencer_id === inf.id)) return false
    const q = infSearch.toLowerCase()
    const matchSearch = !q || inf.nombre.toLowerCase().includes(q) ||
      (inf.ig_usuario || '').toLowerCase().includes(q) ||
      (inf.tt_usuario || '').toLowerCase().includes(q)
    const tipos = inf.tipos_contenido || []
    const matchTipo = !infFilterTipo || tipos.includes(infFilterTipo)
    const matchSize = !infFilterSize || (
      getSize(inf.ig_seguidores).label === infFilterSize ||
      getSize(inf.tt_seguidores).label === infFilterSize
    )
    return matchSearch && matchTipo && matchSize
  })

  const isReadOnly = currentCamp && (currentCamp.estado === 'Cerrada' || currentCamp.estado === 'Cancelada')
  const plat = currentCamp?.plataforma || 'Ambas'
  const showIG = plat === 'Ambas' || plat === 'Instagram'
  const showTT = plat === 'Ambas' || plat === 'TikTok'
  const campaignScrapeTargets = currentCamp ? collectCampaignScrapeTargets(currentCamp) : []
  const campaignTTLinks = campaignScrapeTargets.filter(target => target.platform === 'TikTok').length
  const campaignIGLinks = campaignScrapeTargets.filter(target => target.platform === 'Instagram').length
  const cooldownUntil = currentCamp ? getCooldownUntil(currentCamp.id) : 0
  const cooldownRemaining = Math.max(0, cooldownUntil - nowTs)
  const isCooldownActive = cooldownRemaining > 0

  function VideoLinkFields({ form, setForm }) {
    return (
      <>
        {showTT && (
          <div className="fg">
            <label className="label">Link video TikTok</label>
            <input className="input" value={form.video_link_tt}
              onChange={e => setForm(f => ({ ...f, video_link_tt: e.target.value }))}
              placeholder="https://tiktok.com/..." />
          </div>
        )}
        {showIG && (
          <div className="fg">
            <label className="label">Link post Instagram</label>
            <input className="input" value={form.video_link_ig}
              onChange={e => setForm(f => ({ ...f, video_link_ig: e.target.value }))}
              placeholder="https://instagram.com/p/..." />
          </div>
        )}
      </>
    )
  }

  function VideoCell({ inf }) {
    const hasTT = inf.video_link_tt
    const hasIG = inf.video_link_ig
    if (!hasTT && !hasIG) return <span style={{ color: '#CCC', fontSize: 12 }}>-</span>
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {showTT && hasTT && (
          <a href={hasTT} target="_blank" rel="noopener noreferrer"
            style={{ color: '#1A1A1A', fontSize: 11.5, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            <span style={{ fontSize: 10, background: '#F0F0EE', padding: '1px 5px', borderRadius: 4 }}>TT</span> Ver ↗
          </a>
        )}
        {showIG && hasIG && (
          <a href={hasIG} target="_blank" rel="noopener noreferrer"
            style={{ color: '#C2185B', fontSize: 11.5, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            <span style={{ fontSize: 10, background: '#FEF0FB', color: '#6B1560', padding: '1px 5px', borderRadius: 4 }}>IG</span> Ver ↗
          </a>
        )}
      </div>
    )
  }

  if (loading) return <div style={{ padding: 40, color: '#AAA', fontSize: 13 }}>Cargando...</div>

  // â”€â”€â”€ VISTA DETALLE â”€â”€â”€
  if (currentCamp) {
    const ec = ESTADO_CAMP_COLORS[currentCamp.estado] || ESTADO_CAMP_COLORS['Activa']
    return (
      <div style={{ padding: '20px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: '#AAA', cursor: 'pointer', marginBottom: 4 }}
              onClick={() => { setCurrentCamp(null); setCampTab('influencers') }}>
              ? Volver a campañas
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 20, fontWeight: 500 }}>{currentCamp.nombre}</h1>
              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: ec.bg, color: ec.color }}>{currentCamp.estado}</span>
              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 20, background: '#F0F0EE', color: '#666' }}>{plat}</span>
            </div>
            <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{currentCamp.cliente} · {currentCamp.moneda}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isReadOnly && <button className="btn-ghost" onClick={openEditCamp}>Editar campaña</button>}
            <button className="btn-ghost" onClick={() => setChangeEstadoModal(true)}>Cambiar estado</button>
            {!isReadOnly && campTab === 'influencers' && (
              <button className="btn-red" onClick={openAddInfModal}>+ Agregar influencer</button>
            )}
          </div>
        </div>

        {/* Aviso modo lectura */}
        {isReadOnly && (
          <div style={{
            background: currentCamp.estado === 'Cancelada' ? '#FCEBEB' : '#E6F1FB',
            border: `0.5px solid ${currentCamp.estado === 'Cancelada' ? '#F7C1C1' : '#B5D4F4'}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13,
            color: currentCamp.estado === 'Cancelada' ? '#791F1F' : '#0C447C',
          }}>
            Campaña {currentCamp.estado.toLowerCase()} - modo lectura.
          </div>
        )}

        {/* Budget */}
        <BudgetSummary camp={currentCamp} />

        {/* Share panel */}
        <SharePanel camp={currentCamp} onUpdate={fetchCamps} />

        {/* Tabs internos */}
        <div style={{ display: 'flex', gap: 2, background: '#F0F0EE', borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', border: '0.5px solid #E5E5E2' }}>
          {TABS_DETALLE.map(t => (
            <div key={t} onClick={() => setCampTab(t)} style={{
              padding: '6px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5,
              background: campTab === t ? '#fff' : 'transparent',
              color: campTab === t ? '#1A1A1A' : '#888',
              boxShadow: campTab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: campTab === t ? '0.5px solid #E5E5E2' : '0.5px solid transparent',
              textTransform: 'capitalize',
            }}>{t}</div>
          ))}
        </div>

        {/* â”€â”€ TAB INFLUENCERS â”€â”€ */}
        {campTab === 'influencers' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 500 }}>Influencers en campaña</h2>
              <span style={{ fontSize: 12, color: '#AAA' }}>{currentCamp.influencers.length} seleccionados</span>
            </div>

            <div className="card" style={{ padding: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 240, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Métricas de campaña</div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                    El sistema tomará solo los links cargados aquí y actualizará Reportes automáticamente.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ background: '#F7F7F5', border: '0.5px solid #E5E5E2', borderRadius: 10, padding: '8px 10px', minWidth: 84 }}>
                      <div style={{ fontSize: 18, fontWeight: 500, color: '#1A1A1A', lineHeight: 1 }}>{campaignScrapeTargets.length}</div>
                      <div style={{ fontSize: 10.5, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Links</div>
                    </div>
                    {showTT && (
                      <div style={{ background: '#F7F7F5', border: '0.5px solid #E5E5E2', borderRadius: 10, padding: '8px 10px', minWidth: 84 }}>
                        <div style={{ fontSize: 18, fontWeight: 500, color: '#1A1A1A', lineHeight: 1 }}>{campaignTTLinks}</div>
                        <div style={{ fontSize: 10.5, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>TikTok</div>
                      </div>
                    )}
                    {showIG && (
                      <div style={{ background: '#F7F7F5', border: '0.5px solid #E5E5E2', borderRadius: 10, padding: '8px 10px', minWidth: 84 }}>
                        <div style={{ fontSize: 18, fontWeight: 500, color: '#1A1A1A', lineHeight: 1 }}>{campaignIGLinks}</div>
                        <div style={{ fontSize: 10.5, color: '#888', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Instagram</div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <button
                      className="btn-red"
                      onClick={handleCampaignScrape}
                      disabled={scrapingCamp || campaignScrapeTargets.length === 0 || isCooldownActive}
                      style={{ padding: '12px 18px', fontSize: 13, fontWeight: 500, minWidth: 190 }}
                    >
                      {scrapingCamp ? 'Actualizando métricas...' : isCooldownActive ? 'Espera para volver a scrapear' : 'Actualizar métricas'}
                    </button>
                    {isCooldownActive && (
                      <div style={{ fontSize: 11.5, color: '#888', fontVariantNumeric: 'tabular-nums' }}>
                        Disponible en {formatCooldown(cooldownRemaining)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {scrapeLogs.length > 0 && (
                <div style={{
                  marginTop: 12, padding: '10px 12px', borderRadius: 8,
                  background: '#F7F7F5', border: '0.5px solid #E5E5E2',
                  maxHeight: 130, overflowY: 'auto',
                }}>
                  {scrapeLogs.map((log, index) => (
                  <div key={index} style={{ fontSize: 11.5, color: '#555', fontFamily: 'monospace', marginBottom: 4 }}>
                    {log}
                  </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ overflow: 'hidden' }}>
              {currentCamp.influencers.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#AAA', fontSize: 13 }}>
                  Agrega influencers desde el roster.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ background: '#F7F7F5', borderBottom: '0.5px solid #E5E5E2' }}>
                        <th className="th" style={{ width: 180 }}>Influencer</th>
                        {showIG && <th className="th" style={{ width: 100 }}>Instagram</th>}
                        {showTT && <th className="th" style={{ width: 100 }}>TikTok</th>}
                        <th className="th" style={{ width: 110 }}>Categorías</th>
                        <th className="th" style={{ width: 90 }}>Costo</th>
                        <th className="th" style={{ width: 50 }}>Piezas</th>
                        <th className="th" style={{ width: 120 }}>Estado</th>
                        <th className="th" style={{ width: 90 }}>Videos</th>
                        {!isReadOnly && <th className="th" style={{ width: 70 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {currentCamp.influencers.map((inf, i) => {
                        const ec = ESTADO_INF_COLORS[inf.ci_estado] || ESTADO_INF_COLORS['Contactado']
                        const igSize = getSize(inf.ig_seguidores)
                        const ttSize = getSize(inf.tt_seguidores)
                        const tipos = inf.tipos_contenido || []
                        return (
                          <tr key={inf.ci_id} style={{ borderBottom: '0.5px solid #F0F0EE' }}>
                            <td className="td">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Avatar nombre={inf.nombre} index={i} />
                                <div style={{ fontWeight: 500, fontSize: 13 }}>{inf.nombre}</div>
                              </div>
                            </td>
                            {showIG && (
                              <td className="td">
                                <div style={{ fontSize: 12.5, color: '#555' }}>{fmtSeg(inf.ig_seguidores)}</div>
                                <span style={{ background: igSize.bg, color: igSize.color, padding: '0 6px', borderRadius: 20, fontSize: 10 }}>{igSize.label}</span>
                              </td>
                            )}
                            {showTT && (
                              <td className="td">
                                <div style={{ fontSize: 12.5, color: '#555' }}>{fmtSeg(inf.tt_seguidores)}</div>
                                <span style={{ background: ttSize.bg, color: ttSize.color, padding: '0 6px', borderRadius: 20, fontSize: 10 }}>{ttSize.label}</span>
                              </td>
                            )}
                            <td className="td">
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                {tipos.slice(0, 2).map(t => {
                                  const c = TIPO_COLORS[t] || TIPO_COLORS['Otros']
                                  return <span key={t} style={{ background: c.bg, color: c.color, padding: '1px 6px', borderRadius: 20, fontSize: 10 }}>{t}</span>
                                })}
                                {tipos.length > 2 && <span style={{ fontSize: 10, color: '#AAA' }}>+{tipos.length - 2}</span>}
                              </div>
                            </td>
                            <td className="td" style={{ fontWeight: 500 }}>{fmtMoney(inf.costo, currentCamp.moneda)}</td>
                            <td className="td" style={{ color: '#555' }}>{inf.piezas}</td>
                            <td className="td">
                              <span style={{ background: ec.bg, color: ec.color, padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>{inf.ci_estado}</span>
                            </td>
                            <td className="td"><VideoCell inf={inf} /></td>
                            {!isReadOnly && (
                              <td className="td">
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn-icon" onClick={() => openEditCI(inf)}>✎</button>
                                  <button className="btn-icon btn-icon-danger" onClick={() => setDeleteCI(inf.ci_id)}>×</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* â”€â”€ TAB REPORTES â”€â”€ */}
        {campTab === 'reportes' && (
          <Reportes camp={currentCamp} roster={roster} />
        )}

        {/* â”€â”€ MODALES â”€â”€ */}

        {/* Cambiar estado campaña */}
        <Modal open={changeEstadoModal} onClose={() => setChangeEstadoModal(false)} title="Cambiar estado">
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Estado actual: <strong>{currentCamp.estado}</strong></p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {['Activa', 'Pausada', 'Cerrada', 'Cancelada'].filter(e => e !== currentCamp.estado).map(estado => {
              const ec = ESTADO_CAMP_COLORS[estado]
              return (
                <button key={estado} onClick={() => updateEstado(currentCamp.id, estado)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `0.5px solid ${ec.bg}`, background: '#fff',
                    fontSize: 13, fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = ec.bg}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <span>{estado}</span>
                  <span style={{ fontSize: 11, background: ec.bg, color: ec.color, padding: '2px 9px', borderRadius: 20 }}>
                    {estado === 'Activa' ? 'En curso' : estado === 'Pausada' ? 'Pausa temporal' : estado === 'Cerrada' ? 'Finalizada' : 'No ejecutada'}
                  </span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setChangeEstadoModal(false)}>Cancelar</button>
          </div>
        </Modal>

        {/* Agregar influencer */}
        <Modal open={modalAddInf} onClose={() => setModalAddInf(false)} title="Agregar influencer">
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input className="input" placeholder="Buscar..." value={infSearch}
              onChange={e => setInfSearch(e.target.value)} style={{ flex: 1 }} />
            <select className="input" style={{ width: 120 }} value={infFilterTipo}
              onChange={e => setInfFilterTipo(e.target.value)}>
              <option value="">Categoría</option>
              {TIPOS.map(t => <option key={t}>{t}</option>)}
            </select>
            <select className="input" style={{ width: 100 }} value={infFilterSize}
              onChange={e => setInfFilterSize(e.target.value)}>
              <option value="">Tamaño</option>
              {SIZE_RANGES.map(s => <option key={s.label}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ border: '0.5px solid #E5E5E2', borderRadius: 8, maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>
            {availableInfs.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#AAA', fontSize: 12 }}>Sin resultados</div>
            ) : availableInfs.map((inf, i) => {
              const igS = getSize(inf.ig_seguidores)
              const ttS = getSize(inf.tt_seguidores)
              const tipos = inf.tipos_contenido || []
              return (
                <div key={inf.id} onClick={() => toggleInfSelection(inf.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                    cursor: 'pointer', borderBottom: '0.5px solid #F0F0EE',
                    background: selectedInfIds.includes(inf.id) ? '#FEF9F9' : 'transparent',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                    border: '1.5px solid ' + (selectedInfIds.includes(inf.id) ? '#E8313A' : '#D0D0CC'),
                    background: selectedInfIds.includes(inf.id) ? '#E8313A' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#fff',
                  }}>{selectedInfIds.includes(inf.id) ? '?' : ''}</div>
                  <Avatar nombre={inf.nombre} index={i} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{inf.nombre}</div>
                    <div style={{ fontSize: 11, color: '#AAA', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      {showIG && <span>IG {fmtSeg(inf.ig_seguidores)} <span style={{ background: igS.bg, color: igS.color, padding: '0 5px', borderRadius: 10 }}>{igS.label}</span></span>}
                      {showTT && <span>TT {fmtSeg(inf.tt_seguidores)} <span style={{ background: ttS.bg, color: ttS.color, padding: '0 5px', borderRadius: 10 }}>{ttS.label}</span></span>}
                      {tipos.slice(0, 2).map(t => {
                        const c = TIPO_COLORS[t] || TIPO_COLORS['Otros']
                        return <span key={t} style={{ background: c.bg, color: c.color, padding: '0 5px', borderRadius: 10 }}>{t}</span>
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {selInf && (
            <div style={{ borderTop: '0.5px solid #F0F0EE', paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Configurando: <strong>{selInf.nombre}</strong></div>
              <div className="form-row-2">
                <div className="fg">
                  <label className="label">Costo ({currentCamp.moneda})</label>
                  <input className="input" type="number" value={ciForm.costo}
                    onChange={e => setCiForm(f => ({ ...f, costo: e.target.value }))} placeholder="0" />
                </div>
                <div className="fg">
                  <label className="label">Piezas</label>
                  <input className="input" type="number" value={ciForm.piezas}
                    onChange={e => setCiForm(f => ({ ...f, piezas: e.target.value }))} />
                </div>
              </div>
              <div className="fg">
                <label className="label">Estado</label>
                <select className="input" value={ciForm.estado}
                  onChange={e => setCiForm(f => ({ ...f, estado: e.target.value }))}>
                  {ESTADOS_INF.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
              <VideoLinkFields form={ciForm} setForm={setCiForm} />
              <div className="fg">
                <label className="label">Notas internas</label>
                <textarea className="input" rows={2} value={ciForm.notas}
                  onChange={e => setCiForm(f => ({ ...f, notas: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
            <div style={{ fontSize: 13, color: selectedInfIds.length > 0 ? '#1A1A1A' : '#AAA' }}>
              {selectedInfIds.length > 0
                ? <><strong>{selectedInfIds.length}</strong> seleccionado{selectedInfIds.length > 1 ? 's' : ''}</>
                : 'Selecciona uno o mas'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedInfIds.length > 0 && (
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setSelectedInfIds([])}>Limpiar</button>
              )}
              <button className="btn-ghost" onClick={() => setModalAddInf(false)}>Cancelar</button>
              <button className="btn-red" onClick={addSelectedInfluencers} disabled={selectedInfIds.length === 0 || savingCI}>
                {savingCI ? 'Agregando...' : `Agregar${selectedInfIds.length > 0 ? ` (${selectedInfIds.length})` : ''}`}
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={editCampModal} onClose={() => setEditCampModal(false)} title="Editar campaña">
          <div className="fg">
            <label className="label">Nombre de campaña</label>
            <input className="input" value={editCampForm.nombre}
              onChange={e => setEditCampForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="fg">
            <label className="label">Cliente</label>
            <input className="input" value={editCampForm.cliente}
              onChange={e => setEditCampForm(f => ({ ...f, cliente: e.target.value }))} />
          </div>
          <div className="form-row-2">
            <div className="fg">
              <label className="label">Budget</label>
              <input className="input" type="number" value={editCampForm.budget}
                onChange={e => setEditCampForm(f => ({ ...f, budget: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="label">Moneda</label>
              <select className="input" value={editCampForm.moneda}
                onChange={e => setEditCampForm(f => ({ ...f, moneda: e.target.value }))}>
                <option>CLP</option><option>USD</option>
              </select>
            </div>
          </div>
          <div className="fg">
            <label className="label">Plataforma</label>
            <select className="input" value={editCampForm.plataforma}
              onChange={e => setEditCampForm(f => ({ ...f, plataforma: e.target.value }))}>
              {PLATAFORMAS.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="label">Brief / descripción</label>
            <textarea className="input" rows={3} value={editCampForm.brief}
              onChange={e => setEditCampForm(f => ({ ...f, brief: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn-ghost" onClick={() => setEditCampModal(false)}>Cancelar</button>
            <button className="btn-red" onClick={saveEditCamp} disabled={savingEditCamp}>
              {savingEditCamp ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </Modal>

        {/* Editar influencer en campaña */}
        <Modal open={editCIModal} onClose={() => setEditCIModal(false)} title={`Editar - ${editCI?.nombre}`}>
          <div className="form-row-2">
            <div className="fg">
              <label className="label">Costo ({currentCamp.moneda})</label>
              <input className="input" type="number" value={editCIForm.costo}
                onChange={e => setEditCIForm(f => ({ ...f, costo: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="label">Piezas</label>
              <input className="input" type="number" value={editCIForm.piezas}
                onChange={e => setEditCIForm(f => ({ ...f, piezas: e.target.value }))} />
            </div>
          </div>
          <div className="fg">
            <label className="label">Estado</label>
            <select className="input" value={editCIForm.estado}
              onChange={e => setEditCIForm(f => ({ ...f, estado: e.target.value }))}>
              {ESTADOS_INF.map(e => <option key={e}>{e}</option>)}
            </select>
          </div>
          <VideoLinkFields form={editCIForm} setForm={setEditCIForm} />
          <div className="fg">
            <label className="label">Notas internas</label>
            <textarea className="input" rows={2} value={editCIForm.notas}
              onChange={e => setEditCIForm(f => ({ ...f, notas: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="btn-ghost" onClick={() => setEditCIModal(false)}>Cancelar</button>
            <button className="btn-red" onClick={saveEditCI}>Guardar</button>
          </div>
        </Modal>

        {/* Quitar influencer */}
        <Modal open={!!deleteCI} onClose={() => setDeleteCI(null)} title="Quitar influencer">
          <p style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>¿Quitar este influencer? Los datos se perderán.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setDeleteCI(null)}>Cancelar</button>
            <button className="btn-danger" onClick={() => removeInfluencer(deleteCI)}>Quitar</button>
          </div>
        </Modal>
      </div>
    )
  }

  // â”€â”€â”€ VISTA LISTA â”€â”€â”€
  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>Campañas</h1>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{camps.length} campañas en total</p>
        </div>
        <button className="btn-red" onClick={() => { setCampForm(EMPTY_CAMP); setModalNewCamp(true) }}>
          + Nueva campaña
        </button>
      </div>

      {/* Tabs lista */}
      <div style={{ display: 'flex', gap: 2, background: '#F0F0EE', borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content', border: '0.5px solid #E5E5E2' }}>
        {TABS_LISTA.map(t => {
          const count = t === 'Todas' ? camps.length : camps.filter(c => c.estado === t.slice(0, -1)).length
          return (
            <div key={t} onClick={() => setTab(t)} style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 5,
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#1A1A1A' : '#888',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              border: tab === t ? '0.5px solid #E5E5E2' : '0.5px solid transparent',
            }}>
              {t}
              {count > 0 && <span style={{ fontSize: 10, color: '#AAA' }}>{count}</span>}
            </div>
          )
        })}
      </div>

      {/* Grid campañas */}
      {filteredCamps.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#AAA', fontSize: 13 }}>
          No hay campañas {tab !== 'Todas' ? tab.toLowerCase() : ''}.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filteredCamps.map(camp => {
            const usado = camp.influencers.reduce((s, i) => s + Number(i.costo), 0)
            const ec = ESTADO_CAMP_COLORS[camp.estado] || ESTADO_CAMP_COLORS['Activa']
            const isInactive = camp.estado === 'Cerrada' || camp.estado === 'Cancelada'
            return (
              <div key={camp.id} className="card"
                style={{ padding: 18, cursor: 'pointer', transition: 'border-color .15s', opacity: isInactive ? 0.75 : 1 }}
                onClick={() => { setCurrentCamp(camp); setCampTab('influencers') }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#E8313A'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E5E2'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, flex: 1, paddingRight: 8 }}>{camp.nombre}</div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: 11,
                        lineHeight: 1,
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: ec.bg,
                        color: ec.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 62,
                        fontWeight: 500,
                      }}
                    >
                      {camp.estado}
                    </span>
                    <button
                      className="btn-icon btn-icon-danger"
                      title="Eliminar campaña"
                      aria-label="Eliminar campaña"
                      style={{
                        width: 32,
                        height: 32,
                        fontSize: 15,
                        color: '#B42318',
                        background: '#FDECEC',
                        borderColor: '#F3C2C2',
                        boxShadow: '0 1px 2px rgba(180, 35, 24, 0.08)',
                      }}
                      onClick={e => { e.stopPropagation(); setDeleteCampId(camp.id) }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{camp.cliente}</div>
                <div style={{ fontSize: 11, color: '#AAA', marginBottom: 10 }}>{camp.plataforma || 'Ambas'}</div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 10.5, color: '#AAA' }}>Influencers</div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{camp.influencers.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: '#AAA' }}>Alcance</div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>
                      {fmtSeg(camp.influencers.reduce((s, i) => s + Number(i.ig_seguidores || 0) + Number(i.tt_seguidores || 0), 0))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, color: '#AAA' }}>Moneda</div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{camp.moneda}</div>
                  </div>
                </div>
                <BudgetBar usado={usado} total={Number(camp.budget)} moneda={camp.moneda} compact />
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva campaña */}
      <Modal open={modalNewCamp} onClose={() => setModalNewCamp(false)} title="Nueva campaña">
        <div className="fg">
          <label className="label">Nombre de campaña</label>
          <input className="input" value={campForm.nombre}
            onChange={e => setCampForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej: Baby Rasta & Gringo - Visión" />
        </div>
        <div className="fg">
          <label className="label">Cliente</label>
          <input className="input" value={campForm.cliente}
            onChange={e => setCampForm(f => ({ ...f, cliente: e.target.value }))}
            placeholder="Nombre del cliente" />
        </div>
        <div className="form-row-2">
          <div className="fg">
            <label className="label">Budget</label>
            <input className="input" type="number" value={campForm.budget}
              onChange={e => setCampForm(f => ({ ...f, budget: e.target.value }))} placeholder="0" />
          </div>
          <div className="fg">
            <label className="label">Moneda</label>
            <select className="input" value={campForm.moneda}
              onChange={e => setCampForm(f => ({ ...f, moneda: e.target.value }))}>
              <option>CLP</option><option>USD</option>
            </select>
          </div>
        </div>
        <div className="fg">
          <label className="label">Plataforma</label>
          <select className="input" value={campForm.plataforma}
            onChange={e => setCampForm(f => ({ ...f, plataforma: e.target.value }))}>
            {PLATAFORMAS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="fg">
          <label className="label">Brief / descripción (opcional)</label>
          <textarea className="input" rows={3} value={campForm.brief}
            onChange={e => setCampForm(f => ({ ...f, brief: e.target.value }))} style={{ resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-ghost" onClick={() => setModalNewCamp(false)}>Cancelar</button>
          <button className="btn-red" onClick={saveCamp} disabled={savingCamp}>
            {savingCamp ? 'Creando...' : 'Crear campaña'}
          </button>
        </div>
      </Modal>

      {/* Modal eliminar campaña */}
      <Modal open={!!deleteCampId} onClose={() => setDeleteCampId(null)} title="Eliminar campaña">
        <p style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>
          ¿Eliminar esta campaña? Se borrarán todos los datos asociados.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => setDeleteCampId(null)}>Cancelar</button>
          <button className="btn-danger" onClick={() => deleteCamp(deleteCampId)}>Eliminar</button>
        </div>
      </Modal>
    </div>
  )
}




