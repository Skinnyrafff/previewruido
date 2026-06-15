import { useState, useEffect } from 'react'
import sql from '../lib/db'
import { fmtSeg, fmtMoney } from '../lib/format'
import Avatar from './ui/Avatar'
import BudgetBar from './ui/BudgetBar'
import PageHeader from './ui/PageHeader'

function KPI({ label, value, sub, subColor }) {
  return (
    <div style={{
      background: '#fff', border: '0.5px solid #E5E5E2',
      borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 11, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 500, color: '#1A1A1A', lineHeight: 1 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, color: subColor || '#AAA', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  )
}

function formatTipoLabel(tipos) {
  if (!tipos || tipos.length === 0) return ''
  return Array.isArray(tipos) ? tipos.join(', ') : String(tipos)
}

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { fetchDashboard() }, [])

  async function fetchDashboard() {
    setLoading(true)
    setError(null)
    try {
      const [infRows, campRows, ciRows] = await Promise.all([
        sql`
          SELECT id, nombre, ig_seguidores, tt_seguidores, tipos_contenido, estado,
            (ig_seguidores + tt_seguidores) AS total_seguidores
          FROM influencers
          ORDER BY (ig_seguidores + tt_seguidores) DESC
        `,
        sql`SELECT * FROM campaigns ORDER BY created_at DESC`,
        sql`SELECT campaign_id, influencer_id, costo FROM campaign_influencers`,
      ])

      const now = new Date()
      const mesActual = now.getMonth()
      const anioActual = now.getFullYear()

      const campsConDatos = campRows.map(c => {
        const infs = ciRows.filter(ci => ci.campaign_id === c.id)
        const usado = infs.reduce((s, i) => s + Number(i.costo), 0)
        const creado = new Date(c.created_at)
        const esMes = creado.getMonth() === mesActual && creado.getFullYear() === anioActual
        return { ...c, usado, esMes }
      })

      setData({
        influencers: infRows,
        campaigns: campsConDatos,
        totalSeg: infRows.reduce((s, i) => s + Number(i.total_seguidores), 0),
        activos: infRows.filter(i => i.estado === 'Activo').length,
      })
    } catch (e) {
      console.error(e)
      setError('No se pudo cargar el dashboard. Verifica la conexión a la base de datos.')
    }
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, color: '#AAA', fontSize: 13 }}>Cargando...</div>
  if (error) return <div style={{ padding: 40, color: '#A32D2D', fontSize: 13 }}>{error}</div>
  if (!data) return null

  const campsMes = data.campaigns.filter(c => c.esMes)
  const topInfs = data.influencers.slice(0, 8)
  const mesNombre = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      />

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KPI label="Influencers en roster" value={data.influencers.length} sub={`${data.activos} activos`} subColor="#3B6D11" />
        <KPI label="Campañas totales" value={data.campaigns.length} sub={`${campsMes.length} este mes`} subColor="#0C447C" />
        <KPI label="Alcance total roster" value={fmtSeg(data.totalSeg)} sub="seguidores acumulados" />
        <KPI
          label="Presupuesto administrado"
          value={fmtMoney(data.campaigns.reduce((s, c) => s + Number(c.budget), 0), 'CLP')}
          sub="en todas las campañas"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 500 }}>Top influencers por seguidores</h2>
            <span style={{ fontSize: 12, color: '#E8313A', cursor: 'pointer' }} onClick={() => onNavigate('roster')}>
              Ver roster →
            </span>
          </div>
          <div style={{ background: '#fff', border: '0.5px solid #E5E5E2', borderRadius: 12, overflow: 'hidden' }}>
            {topInfs.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#AAA', fontSize: 13 }}>
                Aún no hay influencers en el roster.
              </div>
            ) : topInfs.map((inf, i) => (
              <div
                key={inf.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px',
                  borderBottom: i < topInfs.length - 1 ? '0.5px solid #F0F0EE' : 'none',
                }}
              >
                <span style={{ fontSize: 11, color: '#CCC', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <Avatar nombre={inf.nombre} index={i} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inf.nombre}
                  </div>
                  <div style={{ fontSize: 11, color: '#AAA' }}>{formatTipoLabel(inf.tipos_contenido)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fmtSeg(inf.total_seguidores)}</div>
                  <div style={{ fontSize: 10, color: '#CCC' }}>
                    IG {fmtSeg(inf.ig_seguidores)} · TT {fmtSeg(inf.tt_seguidores)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 500 }}>Campañas — {mesNombre}</h2>
            <span style={{ fontSize: 12, color: '#E8313A', cursor: 'pointer' }} onClick={() => onNavigate('campanas')}>
              Ver todas →
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {campsMes.length === 0 ? (
              <div style={{
                background: '#fff', border: '0.5px solid #E5E5E2', borderRadius: 12,
                padding: 32, textAlign: 'center', color: '#AAA', fontSize: 13,
              }}>
                No hay campañas creadas este mes.
              </div>
            ) : campsMes.map(camp => (
              <div
                key={camp.id}
                className="card"
                style={{ padding: '14px 16px', cursor: 'pointer', transition: 'border-color .15s' }}
                onClick={() => onNavigate('campanas')}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#E8313A'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E5E2'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, flex: 1, paddingRight: 8 }}>{camp.nombre}</div>
                  <span style={{
                    fontSize: 10.5, padding: '1px 7px', borderRadius: 20, flexShrink: 0,
                    background: camp.estado === 'Activa' ? '#EAF3DE' : '#F1EFE8',
                    color: camp.estado === 'Activa' ? '#27500A' : '#5F5E5A',
                  }}>
                    {camp.estado}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#AAA', marginBottom: 8 }}>{camp.cliente}</div>
                <BudgetBar usado={camp.usado} total={Number(camp.budget)} moneda={camp.moneda} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
