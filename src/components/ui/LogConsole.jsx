export default function LogConsole({ title, logs, emptyMessage }) {
  return (
    <div className="log-console">
      <div className="log-console__header">{title}</div>
      {logs.length === 0 ? (
        <div className="log-console__empty">{emptyMessage}</div>
      ) : logs.map((log, index) => (
        <div key={index} className="log-console__line">{log}</div>
      ))}
    </div>
  )
}
