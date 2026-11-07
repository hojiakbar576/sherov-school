// The one place CSV files are made. Every CSV download in the app goes through
// `downloadCSV` (usually via the shared <ExportButtons>), so a fix here fixes
// every page.

export type CsvCell = string | number | null | undefined

/**
 * Semicolon, not comma. Excel splits a .csv into columns using the computer's
 * "list separator", which is a semicolon on Windows set to Uzbek, Russian and
 * most European formats. Comma-separated files open there as one long column A.
 * Google Sheets, LibreOffice and this app's own import detect the semicolon.
 */
export const CSV_SEPARATOR = ';'

/** UTF-8 byte order mark: tells Excel the file is UTF-8, so Uzbek (o‘, g‘) and Russian letters show correctly. */
export const UTF8_BOM = '﻿'

// Excel's formulas can hold text of at most 255 characters.
const FORMULA_TEXT_MAX = 250

/**
 * Turns one value into a CSV field:
 * - empty for null/undefined; numbers as plain digits (a "." decimal is written
 *   with the separator Excel expects next to a semicolon list, a comma);
 * - text that Excel would misread as a formula (starts with =, +, -, @, e.g.
 *   "+998 90 …" phone numbers, or a malicious "=HYPERLINK(…)") is written as
 *   ="…" so Excel shows it exactly as text and never runs it;
 * - long digit strings (Excel would drop leading zeros or round them) the same way;
 * - fields containing the separator, a comma, quotes or line breaks are quoted.
 */
export function csvField(value: CsvCell, separator = CSV_SEPARATOR): string {
  if (value === null || value === undefined) return ''
  let text: string
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    text = Number.isInteger(value) || separator === ',' ? String(value) : String(value).replace('.', ',')
  } else {
    text = value.replace(/\r\n?/g, '\n')
    const formulaLike = /^[=+\-@\t]/.test(text)
    const longDigits = /^0\d+$|^\d{12,}$/.test(text)
    if ((formulaLike || longDigits) && text.length <= FORMULA_TEXT_MAX && !text.includes('\n')) {
      text = `="${text.replace(/"/g, '""')}"`
    } else if (formulaLike) {
      // Too long for ="…": a leading apostrophe stops Excel treating it as a formula.
      text = `'${text}`
    }
  }
  const needsQuotes = text.includes(separator) || /[",;\n\r]/.test(text) || text !== text.trim()
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text
}

/** Rows to CSV text: one line per row (Windows line endings, which Excel prefers). No BOM. */
export function toCSV(rows: CsvCell[][], separator = CSV_SEPARATOR): string {
  return rows.map((row) => row.map((cell) => csvField(cell, separator)).join(separator)).join('\r\n') + '\r\n'
}

/** The complete file content: BOM + CSV text. */
export function csvFileContent(rows: CsvCell[][], separator = CSV_SEPARATOR): string {
  return UTF8_BOM + toCSV(rows, separator)
}

/** Saves rows as a .csv file that opens in Excel with one column per field. */
export function downloadCSV(filename: string, rows: CsvCell[][]): void {
  const name = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
  const blob = new Blob([csvFileContent(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // Let the browser start the download before the address is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
