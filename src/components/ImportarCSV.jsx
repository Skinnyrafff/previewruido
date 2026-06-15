import { useState, useRef } from 'react'
import sql from '../lib/db'
import Modal from './Modal'
import { TIPOS, TIPO_COLORS } from '../lib/constants'
import { fmtSeg } from '../lib/format'

function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''))

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Parsear respetando comillas dobles para campos con comas
    const values = []
    let current = ''
    let inQuotes = false
    for (let j = 0; j < line.length; j++) {
      const ch = line[j]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    values.push(current.trim())

    const row = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    rows.push(row)
  }
  return rows
}

function mapRow(row) {
  // Mapear columnas flexiblemente
  const get = (...keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== '') return row[k]
    }
    return ''
  }

  const ttSeg = parseInt(get('seguidores_tiktok', 'tt_seguidores', 'tiktok_followers', 'followers_tiktok')) || 0
  const igSeg = parseInt(get('seguidores_instagram', 'ig_seguidores', 'instagram_followers', 'followers_instagram')) || 0

  const ttUser = get('username_tiktok', 'tiktok_username', 'tt_usuario', 'tiktok')
  const igUser = get('username_instagram', 'instagram_username', 'ig_usuario', 'instagram')

  // Nombre: usar TikTok username limpio, o IG username
  const nombreRaw = ttUser || igUser || ''
  const nombre = nombreRaw.replace(/^@/, '')

  // Categorías
  const catRaw = get('categorias', 'categoria', 'categories', 'category', 'tipos_contenido')
  const tipos = catRaw
    ? catRaw.split(',').map(c => {
        const trimmed = c.trim()
        // Buscar match case-insensitive
        const match = TIPOS.find(t => t.toLowerCase() === trimmed.toLowerCase())
        return match || 'Otros'
      }).filter((v, i, arr) => arr.indexOf(v) === i) // deduplicar
    : ['Otros']

  return {
    nombre: nombre || 'Sin nombre',
    tt_usuario: ttUser,
    tt_seguidores: ttSeg,
    tt_link: get('link_tiktok', 'tiktok_link', 'tt_link', 'url_tiktok'),
    ig_usuario: igUser,
    ig_seguidores: igSeg,
    ig_link: get('link_instagram', 'instagram_link', 'ig_link', 'url_instagram'),
    tipos_contenido: tipos,
    estado: 'Activo',
  }
}

export default function ImportarCSV({ onDone }) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('upload') // upload | preview | importing | done
  const [preview, setPreview] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [imported, setImported] = useState(0)
  const fileRef = useRef()

  function handleOpen() {
    setStep('upload')
    setPreview([])
    setErrors([])
    setProgress(0)
    setImported(0)
    setOpen(true)
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setErrors(['No se encontraron filas válidas en el CSV.'])
        return
      }
      const mapped = rows.map(mapRow)
      const errs = []
      mapped.forEach((r, i) => {
        if (!r.tt_usuario && !r.ig_usuario) {
          errs.push(`Fila ${i + 2}: sin usuario de TikTok ni Instagram`)
        }
      })
      setErrors(errs)
      setPreview(mapped)
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    setImporting(true)
    setStep('importing')
    let count = 0
    for (const inf of preview) {
      try {
        await sql`
          INSERT INTO influencers (
            nombre, tt_usuario, tt_seguidores, tt_link,
            ig_usuario, ig_seguidores, ig_link,
            tipos_contenido, estado
          ) VALUES (
            ${inf.nombre}, ${inf.tt_usuario}, ${inf.tt_seguidores}, ${inf.tt_link},
            ${inf.ig_usuario}, ${inf.ig_seguidores}, ${inf.ig_link},
            ${inf.tipos_contenido}, ${inf.estado}
          )
        `
        count++
        setProgress(Math.round((count / preview.length) * 100))
        setImported(count)
      } catch (e) {
        console.error('Error importando fila:', inf.nombre, e)
      }
    }
    setStep('done')
    setImporting(false)
    onDone?.()
  }

  function handleClose() {
    setOpen(false)
    if (step === 'done') onDone?.()
  }

  return (
    <>
      <button className="btn-ghost" onClick={handleOpen}>
        ↑ Importar CSV
      </button>

      <Modal open={open} onClose={handleClose} title="Importar influencers desde CSV">

        {/* STEP: UPLOAD */}
        {step === 'upload' && (
          <div>
            <p style={{ fontSize: 13, color: '#555', marginBottom: 16, lineHeight: 1.6 }}>
              Sube un archivo CSV exportado desde Excel. Las columnas deben llamarse:
            </p>
            <div style={{ background: '#F7F7F5', border: '0.5px solid #E5E5E2', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontFamily: 'monospace', fontSize: 12, color: '#555', lineHeight: 1.8 }}>
              username_tiktok, link_tiktok, seguidores_tiktok,<br />
              username_instagram, link_instagram, seguidores_instagram,<br />
              categorias
            </div>
            <p style={{ fontSize: 12, color: '#AAA', marginBottom: 16 }}>
              Las categorías con varias van separadas por coma dentro de comillas: <code style={{ background: '#F0F0EE', padding: '1px 5px', borderRadius: 4 }}>"Música,Lifestyle"</code>
            </p>
            <div
              style={{
                border: '1.5px dashed #D0D0CC', borderRadius: 10, padding: '32px 20px',
                textAlign: 'center', cursor: 'pointer', transition: 'all .15s',
                background: '#FAFAF8',
              }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#E8313A'; e.currentTarget.style.background = '#FEF9F9' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#D0D0CC'; e.currentTarget.style.background = '#FAFAF8' }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#555', marginBottom: 4 }}>Click para elegir archivo</div>
              <div style={{ fontSize: 12, color: '#AAA' }}>Solo archivos .csv</div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
            </div>

            {errors.length > 0 && (
              <div style={{ marginTop: 12, background: '#FCEBEB', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '10px 12px' }}>
                {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#791F1F' }}>{e}</div>)}
              </div>
            )}

            <div style={{ marginTop: 16, padding: '10px 0', borderTop: '0.5px solid #F0F0EE' }}>
              <div style={{ fontSize: 11, color: '#AAA', marginBottom: 6 }}>¿No tienes el CSV listo? Descarga la plantilla:</div>
              <button
                className="btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => {
                  const content = 'username_tiktok,link_tiktok,seguidores_tiktok,username_instagram,link_instagram,seguidores_instagram,categorias\n@ejemplo,https://tiktok.com/@ejemplo,50000,@ejemplo_ig,https://instagram.com/ejemplo,30000,"Música,Lifestyle"'
                  const blob = new Blob([content], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = 'plantilla_influencers.csv'; a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                ↓ Descargar plantilla
              </button>
            </div>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#555' }}>
                <strong>{preview.length}</strong> influencers listos para importar
                {errors.length > 0 && <span style={{ color: '#A32D2D', marginLeft: 8 }}>· {errors.length} advertencias</span>}
              </div>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { setStep('upload'); fileRef.current.value = '' }}>
                Cambiar archivo
              </button>
            </div>

            {errors.length > 0 && (
              <div style={{ marginBottom: 12, background: '#FAEEDA', border: '0.5px solid #F0D4A0', borderRadius: 8, padding: '10px 12px' }}>
                {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#633806' }}>⚠ {e}</div>)}
              </div>
            )}

            <div style={{ border: '0.5px solid #E5E5E2', borderRadius: 8, overflow: 'hidden', maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F7F7F5', borderBottom: '0.5px solid #E5E5E2' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em' }}>Nombre</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em' }}>TikTok</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em' }}>Instagram</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10.5, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em' }}>Categorías</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((inf, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid #F0F0EE' }}>
                      <td style={{ padding: '9px 12px', fontSize: 13, fontWeight: 500 }}>{inf.nombre}</td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: '#555' }}>
                        {inf.tt_usuario && <div>{inf.tt_usuario}</div>}
                        {inf.tt_seguidores > 0 && <div style={{ fontSize: 11, color: '#AAA' }}>{fmtSeg(inf.tt_seguidores)}</div>}
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 12, color: '#555' }}>
                        {inf.ig_usuario && <div>{inf.ig_usuario}</div>}
                        {inf.ig_seguidores > 0 && <div style={{ fontSize: 11, color: '#AAA' }}>{fmtSeg(inf.ig_seguidores)}</div>}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {inf.tipos_contenido.map(t => {
                            const c = TIPO_COLORS[t] || TIPO_COLORS['Otros']
                            return <span key={t} style={{ background: c.bg, color: c.color, padding: '1px 7px', borderRadius: 20, fontSize: 10.5 }}>{t}</span>
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={handleClose}>Cancelar</button>
              <button className="btn-red" onClick={handleImport}>
                Importar {preview.length} influencers
              </button>
            </div>
          </div>
        )}

        {/* STEP: IMPORTING */}
        {step === 'importing' && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16 }}>
              Importando... {imported} de {preview.length}
            </div>
            <div style={{ height: 6, background: '#F0F0EE', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: progress + '%', background: '#E8313A', borderRadius: 3, transition: 'width .2s' }} />
            </div>
            <div style={{ fontSize: 12, color: '#AAA' }}>{progress}%</div>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>
              {imported} influencers importados
            </div>
            <div style={{ fontSize: 13, color: '#AAA', marginBottom: 20 }}>
              Ya están disponibles en el roster.
            </div>
            <button className="btn-red" onClick={handleClose}>Listo</button>
          </div>
        )}

      </Modal>
    </>
  )
}
