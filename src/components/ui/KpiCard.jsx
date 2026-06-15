export default function KpiCard({ label, value, color = '#1A1A1A' }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #E5E5E2', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: '#AAA', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 500, color }}>{value}</div>
    </div>
  )
}
