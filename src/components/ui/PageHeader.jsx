export default function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 style={{ fontSize: 20, fontWeight: 500 }}>{title}</h1>
      {subtitle && (
        <p style={{ fontSize: 12, color: '#AAA', marginTop: 2 }}>{subtitle}</p>
      )}
    </div>
  )
}
