import { useState, useEffect } from 'react'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Roster from './components/Roster'
import Campanas from './components/Campanas'
import VistaCliente from './components/VistaCliente'
import VistaReporte from './components/VistaReporte'
import TikTokScraper from './components/TikTokScraper'
import InstagramScraper from './components/InstagramScraper'
import './index.css'

import { STORAGE_KEYS } from './lib/constants'

function hasActiveSession() {
  return sessionStorage.getItem(STORAGE_KEYS.auth) === 'true'
}

export default function App() {
  const [auth, setAuth] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [publicToken, setPublicToken] = useState(null)
  const [reportToken, setReportToken] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    const report = params.get('report')
    if (token) { setPublicToken(token); return }
    if (report) { setReportToken(report); return }
    localStorage.removeItem(STORAGE_KEYS.auth)
    if (hasActiveSession()) setAuth(true)
  }, [])

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEYS.auth)
    localStorage.removeItem(STORAGE_KEYS.auth)
    setAuth(false)
  }

  if (publicToken) return <VistaCliente token={publicToken} />
  if (reportToken) return <VistaReporte token={reportToken} />
  if (!auth) return <Login onLogin={() => setAuth(true)} />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F7F5' }}>
      <Sidebar page={page} setPage={setPage} onLogout={handleLogout} />
      <main style={{ flex: 1, minWidth: 0 }}>
        {page === 'dashboard' && <Dashboard onNavigate={setPage} />}
        {page === 'roster' && <Roster />}
        {page === 'campanas' && <Campanas />}
        {page === 'scraper-tiktok' && <TikTokScraper />}
        {page === 'scraper-instagram' && <InstagramScraper />}
      </main>
    </div>
  )
}
