import { useApifyScraper } from '../../hooks/useApifyScraper'
import PageHeader from '../ui/PageHeader'
import LogConsole from '../ui/LogConsole'
import KpiCard from '../ui/KpiCard'
import { downloadCsv } from '../../lib/csv'

export default function ApifyScraperPage({ config }) {
  const scraper = useApifyScraper(config)
  const {
    apifyToken,
    showToken,
    setShowToken,
    limit,
    setLimit,
    campaigns,
    roster,
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
  } = scraper

  function downloadCSV() {
    if (results.length === 0) return
    const { headers, rows } = config.csvExport(results)
    const filename = `${config.csvFilenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`
    downloadCsv(filename, headers, rows)
    addLog('Archivo CSV descargado con exito.')
  }

  return (
    <div className="page">
      <PageHeader title={config.title} subtitle={config.subtitle} />

      {config.warningBanner && (
        <div className="warning-banner">
          <span>!</span>
          <span>{config.warningBanner}</span>
        </div>
      )}

      <div className="scraper-grid">
        <div className="scraper-sidebar">
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>Configuracion de Apify</div>
              <button className="btn-ghost" style={{ padding: '2px 8px', fontSize: 10.5 }} onClick={() => setShowToken(!showToken)}>
                {showToken ? 'Ocultar' : 'Ver'}
              </button>
            </div>
            <div className="fg" style={{ marginBottom: 10 }}>
              <label className="label">API Token</label>
              <input
                className="input"
                type={showToken ? 'text' : 'password'}
                value={apifyToken}
                onChange={e => saveToken(e.target.value)}
                placeholder="apify_api_..."
              />
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="label">{config.limitLabel}</label>
              <input
                className="input"
                type="number"
                value={limit}
                onChange={e => setLimit(Math.max(1, parseInt(e.target.value, 10) || 1))}
                min="1"
                max="50"
              />
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 10 }}>Destino de los datos</div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="label">Campana para guardar metricas</label>
              <select className="input" value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)}>
                <option value="">No guardar en campana (solo reporte local)</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.cliente})</option>
                ))}
              </select>
              <div style={{ fontSize: 11.5, color: '#888', marginTop: 8 }}>
                El boton de guardado en campana usa esta seleccion.
              </div>
              {selectedCampaignId && (
                <>
                  <div className="success-pill">Campana seleccionada para vinculacion.</div>
                  <div style={{ fontSize: 12, color: '#333', marginTop: 10 }}>
                    Guardado automatico al terminar la extraccion: <strong>Siempre activo</strong>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>Perfiles de roster ({roster.length})</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="link-accent" onClick={selectAllRoster}>Todos</span>
                <span style={{ fontSize: 11, color: '#AAA' }}>.</span>
                <span style={{ fontSize: 11, color: '#666', cursor: 'pointer', userSelect: 'none' }} onClick={selectNoneRoster}>Ninguno</span>
              </div>
            </div>
            <div className="roster-picker">
              {roster.length === 0 ? (
                <div style={{ padding: 10, fontSize: 11.5, color: '#AAA', textAlign: 'center' }}>{config.emptyRosterMessage}</div>
              ) : roster.map(r => {
                const username = r[rosterUsernameField]
                const selected = selectedRosterProfiles.includes(username)
                return (
                  <div
                    key={r.id}
                    onClick={() => toggleRosterProfile(username)}
                    className="roster-picker__item"
                    style={{ background: selected ? '#FCEBEB' : 'transparent' }}
                  >
                    <div className="roster-picker__check" style={{
                      borderColor: selected ? '#E8313A' : '#D0D0CC',
                      background: selected ? '#E8313A' : 'transparent',
                    }}
                    >
                      {selected ? 'OK' : ''}
                    </div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 500 }}>{r.nombre}</span>
                      <span style={{ color: '#888' }}> ({username})</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 8 }}>{config.manualProfilesTitle}</div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="label">Agregar manualmente (uno por linea o por coma)</label>
              <textarea
                className="input"
                rows={3}
                value={manualProfiles}
                onChange={e => setManualProfiles(e.target.value)}
                placeholder={config.manualProfilesPlaceholder}
                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
          </div>
        </div>

        <div className="scraper-main">
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 500 }}>Panel de control</h3>
                {isScraping && (
                  <p style={{ fontSize: 12, color: '#E8313A', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="pulse-dot" />
                    Scraper activo en Apify (Estado: <strong>{statusText}</strong>)
                  </p>
                )}
              </div>
              <button
                className="btn-red"
                onClick={handleStartScrape}
                disabled={isScraping}
                style={{ padding: '10px 22px', fontSize: 13.5, fontWeight: 500 }}
              >
                {isScraping ? 'Extrayendo metricas...' : config.startButtonLabel}
              </button>
            </div>
            <LogConsole
              title={config.consoleTitle}
              logs={logs}
              emptyMessage="Listo para iniciar. Ingresa o selecciona perfiles y ejecuta la extraccion."
            />
          </div>

          {results.length > 0 && (
            <div className="kpi-grid">
              {config.summaryCards(results).map((card, i) => (
                <KpiCard key={i} label={card.label} value={card.value} color={card.color} />
              ))}
            </div>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="card" style={{ padding: 18, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500 }}>Metricas obtenidas</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {selectedCampaignId ? (
                <button className="btn-red" onClick={handleSyncToDb} disabled={isSavingDb} style={{ padding: '8px 16px', fontSize: 12 }}>
                  {isSavingDb ? 'Guardando en campana...' : 'Guardar en campana'}
                </button>
              ) : (
                <span style={{ fontSize: 11.5, color: '#AAA', alignSelf: 'center', fontStyle: 'italic', marginRight: 8 }}>
                  Selecciona una campana si quieres persistir posts y snapshots alli.
                </span>
              )}
              <button className="btn-ghost" onClick={handleSyncProfiles} disabled={isSavingProfiles} style={{ padding: '8px 16px', fontSize: 12 }}>
                {isSavingProfiles ? 'Guardando perfiles...' : 'Guardar en perfil'}
              </button>
              <button className="btn-ghost" onClick={downloadCSV} style={{ padding: '8px 16px', fontSize: 12 }}>
                Exportar a Excel (CSV)
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#F7F7F5', borderBottom: '0.5px solid #E5E5E2' }}>
                  {config.tableColumns.map(col => (
                    <th key={col.key} className="th" style={{ width: col.width }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={`${row.author}-${row.url}-${i}`} style={{ borderBottom: '0.5px solid #F0F0EE' }}>
                    {config.tableColumns.map(col => (
                      <td
                        key={col.key}
                        className="td"
                        style={col.key === 'description' ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : undefined}
                      >
                        {config.renderCell(row, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
