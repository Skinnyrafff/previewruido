import { useState, useEffect } from 'react'
import sql from '../lib/db'
import Modal from './Modal'
import ImportarCSV from './ImportarCSV'
import { TIPOS, TIPO_COLORS, SIZE_RANGES } from '../lib/constants'
import { fmtSeg, getSize } from '../lib/format'
import Avatar from './ui/Avatar'

function UserLink({ username, link }) {
  if (!username) return <span style={{ color: '#CCC' }}>—</span>
  if (link) return (
    <a href={link} target="_blank" rel="noopener noreferrer"
      style={{ color: '#E8313A', textDecoration: 'none', fontSize: 12.5 }}
      onMouseEnter={e => e.target.style.textDecoration = 'underline'}
      onMouseLeave={e => e.target.style.textDecoration = 'none'}
    >{username} ↗</a>
  )
  return <span style={{ fontSize: 12.5, color: '#555' }}>{username}</span>
}

function TiposBadges({ tipos }) {
  if (!tipos || tipos.length === 0) return <span style={{ color: '#CCC', fontSize: 11 }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
      {tipos.map(t => {
        const c = TIPO_COLORS[t] || TIPO_COLORS['Otros']
        return (
          <span key={t} style={{ background: c.bg, color: c.color, padding: '1px 7px', borderRadius: 20, fontSize: 10.5 }}>
            {t}
          </span>
        )
      })}
    </div>
  )
}

function TiposCheckboxes({ selected, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {TIPOS.map(t => {
        const isSelected = selected.includes(t)
        const c = TIPO_COLORS[t] || TIPO_COLORS['Otros']
        return (
          <div
            key={t}
            onClick={() => {
              if (isSelected) onChange(selected.filter(x => x !== t))
              else onChange([...selected, t])
            }}
            style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              background: isSelected ? c.bg : '#F7F7F5',
              color: isSelected ? c.color : '#888',
              border: `0.5px solid ${isSelected ? c.color + '44' : '#E5E5E2'}`,
              transition: 'all .12s', userSelect: 'none',
            }}
          >
            {isSelected ? '✓ ' : ''}{t}
          </div>
        )
      })}
    </div>
  )
}

const EMPTY = {
  nombre: '', ig_usuario: '', ig_seguidores: '', ig_link: '',
  tt_usuario: '', tt_seguidores: '', tt_link: '',
  tipos_contenido: [], estado: 'Activo', notas: '',
}

function getDuplicateMessage(errorMsg) {
  if (!errorMsg) return null
  const msg = errorMsg.toLowerCase()
  if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('already exists') || msg.includes('violates')) {
    if (msg.includes('tt_usuario')) return 'Ya existe un influencer con ese usuario de TikTok.'
    if (msg.includes('ig_usuario')) return 'Ya existe un influencer con ese usuario de Instagram.'
    return 'Ya existe un influencer con ese usuario de TikTok o Instagram.'
  }
  return null
}

export default function Roster() {
  const [influencers, setInfluencers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterSize, setFilterSize] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [sortAsc, setSortAsc] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [duplicateError, setDuplicateError] = useState(null)

  useEffect(() => { fetchInfluencers() }, [])

  async function fetchInfluencers() {
    setLoading(true)
    try {
      const data = await sql`
        SELECT *, (ig_seguidores + tt_seguidores) AS total_seguidores
        FROM influencers
        ORDER BY (ig_seguidores + tt_seguidores) DESC
      `
      setInfluencers(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY)
    setEditId(null)
    setDuplicateError(null)
    setModalOpen(true)
  }

  function openEdit(inf) {
    setForm({
      nombre: inf.nombre,
      ig_usuario: inf.ig_usuario || '',
      ig_seguidores: inf.ig_seguidores,
      ig_link: inf.ig_link || '',
      tt_usuario: inf.tt_usuario || '',
      tt_seguidores: inf.tt_seguidores,
      tt_link: inf.tt_link || '',
      tipos_contenido: inf.tipos_contenido || [],
      estado: inf.estado,
      notas: inf.notas || '',
    })
    setEditId(inf.id)
    setDuplicateError(null)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    setDuplicateError(null)
    try {
      const ig_seg = parseInt(form.ig_seguidores) || 0
      const tt_seg = parseInt(form.tt_seguidores) || 0
      if (editId) {
        await sql`
          UPDATE influencers SET
            nombre = ${form.nombre},
            ig_usuario = ${form.ig_usuario},
            ig_seguidores = ${ig_seg},
            ig_link = ${form.ig_link},
            tt_usuario = ${form.tt_usuario},
            tt_seguidores = ${tt_seg},
            tt_link = ${form.tt_link},
            tipos_contenido = ${form.tipos_contenido},
            estado = ${form.estado},
            notas = ${form.notas}
          WHERE id = ${editId}
        `
      } else {
        await sql`
          INSERT INTO influencers (
            nombre, ig_usuario, ig_seguidores, ig_link,
            tt_usuario, tt_seguidores, tt_link,
            tipos_contenido, estado, notas
          ) VALUES (
            ${form.nombre}, ${form.ig_usuario}, ${ig_seg}, ${form.ig_link},
            ${form.tt_usuario}, ${tt_seg}, ${form.tt_link},
            ${form.tipos_contenido}, ${form.estado}, ${form.notas}
          )
        `
      }
      setModalOpen(false)
      await fetchInfluencers()
    } catch (e) {
      const dupMsg = getDuplicateMessage(e.message)
      if (dupMsg) setDuplicateError(dupMsg)
      else console.error(e)
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    try {
      await sql`DELETE FROM influencers WHERE id = ${id}`
      setDeleteId(null)
      await fetchInfluencers()
    } catch (e) { console.error(e) }
  }

  const filtered = influencers
    .filter(i => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        i.nombre.toLowerCase().includes(q) ||
        (i.ig_usuario || '').toLowerCase().includes(q) ||
        (i.tt_usuario || '').toLowerCase().includes(q)
      const tipos = i.tipos_contenido || []
      const matchTipo = !filterTipo || tipos.includes(filterTipo)
      const matchEstado = !filterEstado || i.estado === filterEstado
      const matchSize = !filterSize || (
        getSize(i.ig_seguidores).label === filterSize ||
        getSize(i.tt_seguidores).label === filterSize
      )
      return matchSearch && matchTipo && matchEstado && matchSize
    })
    .sort((a, b) => {
      const diff = Number(b.total_seguidores) - Number(a.total_seguidores)
      return sortAsc ? -diff : diff
    })

  return (
    <div style={{ padding: '20px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500 }}>Roster</h1>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {influencers.length} influencers · {influencers.filter(i => i.estado === 'Activo').length} activos
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ImportarCSV onDone={fetchInfluencers} />
          <button className="btn-red" onClick={openNew}>+ Nuevo influencer</button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="input"
          placeholder="Buscar nombre o usuario..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ minWidth: 220, flex: 1, maxWidth: 300 }}
        />
        <select className="input" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="input" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
          <option value="">Todos los tamaños</option>
          {SIZE_RANGES.map(s => <option key={s.label}>{s.label}</option>)}
        </select>
        <select className="input" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option>Activo</option>
          <option>Inactivo</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#AAA', fontSize: 13 }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#AAA', fontSize: 13 }}>
            {search || filterTipo || filterEstado || filterSize
              ? 'Sin resultados para ese filtro'
              : 'Aún no hay influencers. Agrega el primero o importa un CSV.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#F7F7F5', borderBottom: '0.5px solid #E5E5E2' }}>
                  <th className="th" style={{ width: 200 }}>Influencer</th>
                  <th className="th" style={{ width: 160 }}>Instagram</th>
                  <th className="th" style={{ width: 160 }}>TikTok</th>
                  <th
                    className="th"
                    style={{ width: 110, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setSortAsc(s => !s)}
                  >
                    Total seg. {sortAsc ? '↑' : '↓'}
                  </th>
                  <th className="th" style={{ width: 200 }}>Categorías</th>
                  <th className="th" style={{ width: 80 }}>Estado</th>
                  <th className="th" style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inf, i) => {
                  const igSize = getSize(inf.ig_seguidores)
                  const ttSize = getSize(inf.tt_seguidores)
                  return (
                    <tr key={inf.id} style={{ borderBottom: '0.5px solid #F0F0EE' }}>
                      <td className="td">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <Avatar nombre={inf.nombre} index={i} />
                          <span style={{ fontWeight: 500, fontSize: 13 }}>{inf.nombre}</span>
                        </div>
                      </td>
                      <td className="td">
                        <UserLink username={inf.ig_usuario} link={inf.ig_link} />
                        {inf.ig_seguidores > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: '#AAA' }}>{fmtSeg(inf.ig_seguidores)}</span>
                            <span style={{ background: igSize.bg, color: igSize.color, padding: '0 6px', borderRadius: 20, fontSize: 10 }}>
                              {igSize.label}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="td">
                        <UserLink username={inf.tt_usuario} link={inf.tt_link} />
                        {inf.tt_seguidores > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: '#AAA' }}>{fmtSeg(inf.tt_seguidores)}</span>
                            <span style={{ background: ttSize.bg, color: ttSize.color, padding: '0 6px', borderRadius: 20, fontSize: 10 }}>
                              {ttSize.label}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="td">
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{fmtSeg(Number(inf.total_seguidores))}</span>
                      </td>
                      <td className="td">
                        <TiposBadges tipos={inf.tipos_contenido} />
                      </td>
                      <td className="td">
                        <span style={{
                          background: inf.estado === 'Activo' ? '#EAF3DE' : '#F1EFE8',
                          color: inf.estado === 'Activo' ? '#27500A' : '#5F5E5A',
                          padding: '2px 9px', borderRadius: 20, fontSize: 11,
                        }}>
                          {inf.estado}
                        </span>
                      </td>
                      <td className="td">
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" onClick={() => openEdit(inf)} title="Editar">✎</button>
                          <button className="btn-icon btn-icon-danger" onClick={() => setDeleteId(inf.id)} title="Eliminar">✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setDuplicateError(null) }} title={editId ? 'Editar influencer' : 'Nuevo influencer'}>
        <div className="fg">
          <label className="label">Nombre</label>
          <input className="input" value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder="Nombre completo" />
        </div>
        <div className="form-row-2">
          <div className="fg">
            <label className="label">Usuario Instagram</label>
            <input className="input" value={form.ig_usuario}
              onChange={e => { setForm(f => ({ ...f, ig_usuario: e.target.value })); setDuplicateError(null) }}
              placeholder="@usuario" />
          </div>
          <div className="fg">
            <label className="label">Seguidores Instagram</label>
            <input className="input" type="number" value={form.ig_seguidores}
              onChange={e => setForm(f => ({ ...f, ig_seguidores: e.target.value }))}
              placeholder="0" />
          </div>
        </div>
        <div className="fg">
          <label className="label">Link Instagram</label>
          <input className="input" value={form.ig_link}
            onChange={e => setForm(f => ({ ...f, ig_link: e.target.value }))}
            placeholder="https://instagram.com/usuario" />
        </div>
        <div className="form-row-2">
          <div className="fg">
            <label className="label">Usuario TikTok</label>
            <input className="input" value={form.tt_usuario}
              onChange={e => { setForm(f => ({ ...f, tt_usuario: e.target.value })); setDuplicateError(null) }}
              placeholder="@usuario" />
          </div>
          <div className="fg">
            <label className="label">Seguidores TikTok</label>
            <input className="input" type="number" value={form.tt_seguidores}
              onChange={e => setForm(f => ({ ...f, tt_seguidores: e.target.value }))}
              placeholder="0" />
          </div>
        </div>
        <div className="fg">
          <label className="label">Link TikTok</label>
          <input className="input" value={form.tt_link}
            onChange={e => setForm(f => ({ ...f, tt_link: e.target.value }))}
            placeholder="https://tiktok.com/@usuario" />
        </div>
        <div className="fg">
          <label className="label">Categorías de contenido</label>
          <TiposCheckboxes
            selected={form.tipos_contenido}
            onChange={tipos => setForm(f => ({ ...f, tipos_contenido: tipos }))}
          />
          {form.tipos_contenido.length === 0 && (
            <div style={{ fontSize: 11, color: '#CCC', marginTop: 4 }}>Selecciona al menos una categoría</div>
          )}
        </div>
        <div className="fg">
          <label className="label">Estado</label>
          <select className="input" value={form.estado}
            onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
            <option>Activo</option>
            <option>Inactivo</option>
          </select>
        </div>
        <div className="fg">
          <label className="label">Notas internas</label>
          <textarea className="input" rows={2} value={form.notas}
            onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            placeholder="Solo visible para el equipo..."
            style={{ resize: 'vertical' }} />
        </div>
        {duplicateError && (
          <div style={{
            background: '#FCEBEB',
            border: '0.5px solid #F7C1C1',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 4,
            fontSize: 13,
            color: '#791F1F',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span>!</span>
            <span>{duplicateError} Busca el influencer existente para editarlo.</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn-ghost" onClick={() => { setModalOpen(false); setDuplicateError(null) }}>Cancelar</button>
          <button className="btn-red" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </Modal>

      {/* Modal confirmar eliminar */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Eliminar influencer">
        <p style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>
          ¿Estás segura? Esta acción no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={() => setDeleteId(null)}>Cancelar</button>
          <button className="btn-danger" onClick={() => handleDelete(deleteId)}>Eliminar</button>
        </div>
      </Modal>
    </div>
  )
}
