export function fmtDateTime(ms) {
  return ms ? new Date(ms).toLocaleString() : '\u2014'
}

export function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleDateString() : '\u2014'
}

// 125000 -> "2:05"; 3725000 -> "1:02:05"
export function fmtClock(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function downloadCsv(filename, columns, rows) {
  const lines = [columns.map((column) => csvCell(column.label)).join(',')]
  for (const row of rows) lines.push(columns.map((column) => csvCell(column.value(row))).join(','))
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function toDayStart(dateString) {
  return dateString ? new Date(`${dateString}T00:00:00`).getTime() : null
}

export function toDayEnd(dateString) {
  return dateString ? new Date(`${dateString}T23:59:59.999`).getTime() : null
}
