import { useState, useEffect } from 'react'
import sql from '../lib/db'
import { TIPO_COLORS } from '../lib/constants'
import { fmtSeg, getSizeLabel, normalizePostUrl } from '../lib/format'
import Avatar from './ui/Avatar'

function ProfileLink({ username, link }) {
  const cleanLink = normalizePostUrl(link)
  if (!username) return <span style={{ color: '#CCC', fontSize: 13 }}>—</span>
  if (link) return (
    <a href={cleanLink} target="_blank" rel="noopener noreferrer"
      style={{ color: '#E8313A', fontWeight: 500, textDecoration: 'none', fontSize: 13 }}
      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
    >{username} <span style={{ fontSize: 10, opacity: 0.6 }}>↗</span></a>
  )
  return <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{username}</span>
}

export default function VistaCliente({ token }) {
  const [camp, setCamp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { if (token) fetchPublicCamp(token) }, [token])

  async function fetchPublicCamp(t) {
    setLoading(true)
    try {
      const rows = await sql`
        SELECT
          c.nombre AS camp_nombre, c.cliente, c.plataforma,
          i.nombre,
          i.ig_usuario, i.ig_seguidores, i.ig_link,
          i.tt_usuario, i.tt_seguidores, i.tt_link,
          i.tipos_contenido, i.avatar_url,
          ci.video_link_tt, ci.video_link_ig
        FROM campaigns c
        JOIN campaign_influencers ci ON ci.campaign_id = c.id
        JOIN influencers i ON i.id = ci.influencer_id
        WHERE c.share_token = ${t} AND c.share_active = true
      `
      if (rows.length === 0) {
        const check = await sql`SELECT id FROM campaigns WHERE share_token = ${t}`
        setError(check.length === 0 ? 'not_found' : 'inactive')
      } else {
        setCamp({
          nombre: rows[0].camp_nombre,
          cliente: rows[0].cliente,
          plataforma: rows[0].plataforma || 'Ambas',
          influencers: rows,
        })
      }
    } catch (e) { console.error(e); setError('error') }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5' }}>
      <div style={{ fontSize: 13, color: '#AAA' }}>Cargando propuesta...</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F7F5' }}>
      <div style={{ textAlign: 'center', color: '#AAA' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◇</div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#555', marginBottom: 6 }}>
          {error === 'not_found' ? 'Propuesta no encontrada' : error === 'inactive' ? 'Este link ha sido desactivado' : 'Error al cargar'}
        </div>
        <div style={{ fontSize: 13 }}>
          {error === 'not_found' ? 'Verifica el link con tu agencia.' : 'Contacta a tu agencia para obtener un link actualizado.'}
        </div>
      </div>
    </div>
  )

  const plat = camp.plataforma || 'Ambas'
  const showIG = plat === 'Ambas' || plat === 'Instagram'
  const showTT = plat === 'Ambas' || plat === 'TikTok'
  const showBoth = plat === 'Ambas'

  const totalIG = camp.influencers.reduce((s, i) => s + Number(i.ig_seguidores), 0)
  const totalTT = camp.influencers.reduce((s, i) => s + Number(i.tt_seguidores), 0)
  const totalSeg = (showIG ? totalIG : 0) + (showTT ? totalTT : 0)

  const hasVideoTT = showTT && camp.influencers.some(i => i.video_link_tt)
  const hasVideoIG = showIG && camp.influencers.some(i => i.video_link_ig)
  const hasAnyVideo = hasVideoTT || hasVideoIG

  return (
    <div style={{ minHeight: '100vh', background: '#F7F7F5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '28px 40px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, background: '#E8313A', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>R</div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', letterSpacing: '.05em' }}>RUIDO LAB — Influencer MKT</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#fff', marginBottom: 4 }}>{camp.nombre}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Propuesta para {camp.cliente}
            {plat !== 'Ambas' && <span style={{ marginLeft: 8, background: 'rgba(255,255,255,0.1)', padding: '1px 8px', borderRadius: 20, fontSize: 11 }}>{plat}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 20, textAlign: 'right', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Influencers</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>{camp.influencers.length}</div>
          </div>
          {showIG && (
            <div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Instagram</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>{fmtSeg(totalIG)}</div>
            </div>
          )}
          {showTT && (
            <div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>TikTok</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>{fmtSeg(totalTT)}</div>
            </div>
          )}
          {showBoth && (
            <div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Alcance total</div>
              <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>{fmtSeg(totalSeg)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div style={{ padding: '28px 40px' }}>
        <div style={{ background: '#fff', border: '0.5px solid #E5E5E2', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F7F7F5', borderBottom: '0.5px solid #E5E5E2' }}>
                  <th style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: '#AAA', minWidth: 180 }}>Influencer</th>
                  {showIG && <th style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: '#AAA', minWidth: 150 }}>Instagram</th>}
                  {showTT && <th style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: '#AAA', minWidth: 150 }}>TikTok</th>}
                  <th style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: '#AAA', minWidth: 150 }}>Categorías</th>
                  {hasVideoIG && <th style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: '#AAA', minWidth: 80 }}>Post IG</th>}
                  {hasVideoTT && <th style={{ padding: '11px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: '#AAA', minWidth: 80 }}>Video TT</th>}
                </tr>
              </thead>
              <tbody>
                {camp.influencers.map((inf, i) => {
                  const tipos = inf.tipos_contenido || []
                  const igSize = getSizeLabel(inf.ig_seguidores)
                  const ttSize = getSizeLabel(inf.tt_seguidores)
                  return (
                    <tr key={i} style={{ borderBottom: i < camp.influencers.length - 1 ? '0.5px solid #F0F0EE' : 'none' }}>
                      <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar nombre={inf.nombre} index={i} />
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{inf.nombre}</span>
                        </div>
                      </td>
                      {showIG && (
                        <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                          <ProfileLink username={inf.ig_usuario} link={inf.ig_link} />
                          {inf.ig_seguidores > 0 && (
                            <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>
                              {fmtSeg(inf.ig_seguidores)}
                              <span style={{ marginLeft: 4, fontSize: 10, background: '#F1EFE8', color: '#5F5E5A', padding: '0 5px', borderRadius: 10 }}>{igSize}</span>
                            </div>
                          )}
                        </td>
                      )}
                      {showTT && (
                        <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                          <ProfileLink username={inf.tt_usuario} link={inf.tt_link} />
                          {inf.tt_seguidores > 0 && (
                            <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>
                              {fmtSeg(inf.tt_seguidores)}
                              <span style={{ marginLeft: 4, fontSize: 10, background: '#F1EFE8', color: '#5F5E5A', padding: '0 5px', borderRadius: 10 }}>{ttSize}</span>
                            </div>
                          )}
                        </td>
                      )}
                      <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {tipos.map(t => {
                            const c = TIPO_COLORS[t] || TIPO_COLORS['Otros']
                            return <span key={t} style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>{t}</span>
                          })}
                          {tipos.length === 0 && <span style={{ color: '#CCC', fontSize: 12 }}>—</span>}
                        </div>
                      </td>
                      {hasVideoIG && (
                        <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                          {inf.video_link_ig ? (
                            <a href={normalizePostUrl(inf.video_link_ig)} target="_blank" rel="noopener noreferrer"
                              style={{ color: '#C2185B', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            >Ver ↗</a>
                          ) : <span style={{ color: '#CCC', fontSize: 12 }}>—</span>}
                        </td>
                      )}
                      {hasVideoTT && (
                        <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                          {inf.video_link_tt ? (
                            <a href={normalizePostUrl(inf.video_link_tt)} target="_blank" rel="noopener noreferrer"
                              style={{ color: '#1A1A1A', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            >Ver ↗</a>
                          ) : <span style={{ color: '#CCC', fontSize: 12 }}>—</span>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer totales */}
          <div style={{ padding: '14px 16px', background: '#F7F7F5', borderTop: '0.5px solid #E5E5E2', display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em' }}>Total influencers</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{camp.influencers.length}</div>
            </div>
            {showIG && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em' }}>Instagram</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{fmtSeg(totalIG)}</div>
              </div>
            )}
            {showTT && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em' }}>TikTok</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{fmtSeg(totalTT)}</div>
              </div>
            )}
            {showBoth && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em' }}>Alcance total</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{fmtSeg(totalSeg)}</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#CCC' }}>
          Propuesta generada por RUIDO LAB — Influencer MKT
        </div>
      </div>
    </div>
  )
}


