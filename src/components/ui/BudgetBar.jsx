import { fmtMoney } from '../../lib/format'

export default function BudgetBar({ usado = 0, total = 0, moneda = 'CLP', compact = false }) {
  const pct = total > 0 ? Math.min(100, Math.round((usado / total) * 100)) : 0
  const barColor = pct >= 100 ? '#E24B4A' : pct >= 90 ? '#EF9F27' : '#639922'
  const textColor = pct >= 100 ? '#A32D2D' : pct >= 90 ? '#854F0B' : '#3B6D11'
  const bgColor = pct >= 100 ? '#FCEBEB' : pct >= 90 ? '#FAEEDA' : '#EAF3DE'

  if (compact) {
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ height: 4, background: '#F0F0EE', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 10.5, color: '#AAA' }}>
          <span style={{ color: barColor }}>{pct}%</span>
          <span>{fmtMoney(usado, moneda)} / {fmtMoney(total, moneda)}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, background: bgColor, color: textColor, padding: '1px 7px', borderRadius: 20 }}>
          {pct}% usado
        </span>
        <span style={{ fontSize: 11, color: '#AAA' }}>
          {fmtMoney(usado, moneda)} / {fmtMoney(total, moneda)}
        </span>
      </div>
      <div style={{ height: 4, background: '#F0F0EE', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2 }} />
      </div>
    </div>
  )
}
