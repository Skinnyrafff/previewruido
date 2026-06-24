import { useState } from 'react'
import { STORAGE_KEYS } from '../lib/constants'

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(false)

    setTimeout(() => {
      if (password === import.meta.env.VITE_APP_PASSWORD) {
        sessionStorage.setItem(STORAGE_KEYS.auth, 'true')
        localStorage.removeItem(STORAGE_KEYS.auth)
        onLogin()
      } else {
        setError(true)
        setPassword('')
      }
      setLoading(false)
    }, 400)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F7F7F5',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', border: '0.5px solid #E5E5E2',
        borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 360,
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 32, height: 32, background: '#E8313A', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff',
          }}>R</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>RUIDO</div>
            <div style={{ fontSize: 11, color: '#AAA' }}>Influencer MKT</div>
          </div>
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>Bienvenido</h1>
        <p style={{ fontSize: 13, color: '#AAA', marginBottom: 24 }}>Ingresa la contraseña para acceder.</p>

        <form onSubmit={handleSubmit}>
          <div className="fg">
            <label className="label">Contraseña</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false) }}
              placeholder="••••••••"
              autoFocus
              style={{
                borderColor: error ? '#E8313A' : undefined,
                background: error ? '#FCEBEB' : undefined,
              }}
            />
            {error && (
              <div style={{ fontSize: 12, color: '#A32D2D', marginTop: 4 }}>
                Contraseña incorrecta. Intenta de nuevo.
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-red"
            disabled={loading || !password}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
