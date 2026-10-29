type Cell = string | number | null | undefined

/** Quotes a cell and neutralises spreadsheet formulas (=, +, -, @ at the start). */
function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCSV(rows: Cell[][]): string {
  return rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')
}

/** Saves rows as a .csv file in the browser. A BOM keeps Excel happy with UTF-8. */
export function downloadCSV(filename: string, rows: Cell[][]): void {
  const blob = new Blob(['﻿', toCSV(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
