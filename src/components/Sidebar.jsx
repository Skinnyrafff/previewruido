export default function Sidebar({ page, setPage, onLogout }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: 'D' },
    { id: 'roster', label: 'Roster', icon: 'R' },
    { id: 'campanas', label: 'Campañas', icon: 'C' },
  ]

  return (
    <aside style={{
      width: 208, background: '#fff', borderRight: '0.5px solid #E5E5E2',
      display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: '100vh',
    }}>
      <div style={{ padding: '20px 16px', borderBottom: '0.5px solid #E5E5E2', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, background: '#E8313A', borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>R</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>RUIDO LAB</div>
          <div style={{ fontSize: 11, color: '#AAA' }}>Influencer MKT</div>
        </div>
      </div>

      <nav style={{ padding: '8px 0', flex: 1 }}>
        {items.map(item => (
          <div
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', margin: '1px 6px', borderRadius: 8,
              cursor: 'pointer', fontSize: 13,
              background: page === item.id ? '#FCEBEB' : 'transparent',
              color: page === item.id ? '#A32D2D' : '#666',
              transition: 'all .12s',
            }}
            onMouseEnter={e => { if (page !== item.id) e.currentTarget.style.background = '#F7F7F5' }}
            onMouseLeave={e => { if (page !== item.id) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              fontSize: 11, width: 16, height: 16, textAlign: 'center',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 999, background: page === item.id ? '#E8313A' : '#ECECE8',
              color: page === item.id ? '#fff' : '#666', fontWeight: 700,
            }}>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>

      <div style={{ padding: '12px 8px', borderTop: '0.5px solid #E5E5E2' }}>
        <div
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, color: '#AAA',
            transition: 'all .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FCEBEB'; e.currentTarget.style.color = '#A32D2D' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#AAA' }}
        >
          <span style={{ fontSize: 15, width: 16, textAlign: 'center' }}>→</span>
          Cerrar sesión
        </div>
      </div>
    </aside>
  )
}
