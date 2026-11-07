// A small, dependency-free .xlsx writer: one worksheet with a bold header
// row (frozen, with filter arrows). So the file reads well in Excel with any
// language setting: numbers are real numbers shown as 1,250,000; "93%" is a
// real percentage; 2026-11-05 is a real date shown as 05.11.2026. An .xlsx file is a zip of a few XML files; the zip is
// written uncompressed ("stored"), which every spreadsheet program accepts.

type Cell = string | number | null | undefined

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!)

function columnName(i: number): string {
  let name = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

// Cell styles (see styles.xml): 0 plain, 1 bold header, 2 whole number, 3 percent, 4 date, 5 decimal.
const DAY_MS = 86_400_000
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

/** What a cell holds and how Excel should show it. */
export function cellOf(value: Cell): { kind: 'text'; text: string } | { kind: 'number'; number: number; style: 2 | 3 | 4 | 5 } | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { kind: 'text', text: String(value) }
    return { kind: 'number', number: value, style: Number.isInteger(value) ? 2 : 5 }
  }
  const text = String(value)
  const percent = text.match(/^(-?\d+(?:\.\d+)?)%$/)
  if (percent) return { kind: 'number', number: Number(percent[1]) / 100, style: 3 }
  const date = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (date) {
    const ms = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3]))
    if (new Date(ms).getUTCDate() === Number(date[3])) return { kind: 'number', number: Math.round((ms - EXCEL_EPOCH) / DAY_MS), style: 4 }
  }
  return { kind: 'text', text }
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${columnName(c)}${r + 1}`
          // The header row is always bold text.
          const cell = r === 0 ? (value === null || value === undefined || value === '' ? null : { kind: 'text' as const, text: String(value) }) : cellOf(value)
          if (!cell) return ''
          if (cell.kind === 'number') return `<c r="${ref}" s="${cell.style}"><v>${cell.number}</v></c>`
          return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(cell.text)}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  const lastColumn = columnName(Math.max(0, (rows[0]?.length ?? 1) - 1))
  const filter = rows.length > 1 && rows[0]?.length ? `<autoFilter ref="A1:${lastColumn}${rows.length}"/>` : ''
  const widths = (rows[0] ?? []).map((_, c) => {
    // Numbers get room for their thousands separators.
    const longest = Math.max(...rows.map((row) => (typeof row[c] === 'number' ? Math.round(String(row[c]).length * 1.35) : String(row[c] ?? '').length)))
    return `<col min="${c + 1}" max="${c + 1}" width="${Math.min(60, Math.max(10, longest + 2))}" customWidth="1"/>`
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${widths.length ? `<cols>${widths.join('')}</cols>` : ''}<sheetData>${body}</sheetData>${filter}</worksheet>`
}

/** Excel sheet names: up to 31 characters, none of \\ / ? * [ ] : */
const safeSheet = (name: string) => name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet1'

function files(rows: Cell[][], sheetName: string): [string, string][] {
  return [
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(safeSheet(sheetName))}" sheetId="1" r:id="rId1"/></sheets>${rows.length > 1 && rows[0]?.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xml(safeSheet(sheetName).replace(/'/g, "''"))}'!$A$1:$${columnName(rows[0].length - 1)}$${rows.length}</definedName></definedNames>` : ''}</workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="6"><xf/><xf fontId="1" applyFont="1"/><xf numFmtId="3" applyNumberFormat="1"/><xf numFmtId="9" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="4" applyNumberFormat="1"/></cellXfs></styleSheet>'],
    ['xl/worksheets/sheet1.xml', sheetXml(rows)],
  ]
}

// ---- zip (stored, no compression)

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const b of bytes) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function zip(entries: [string, string][]): Uint8Array {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of entries) {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(text)
    const crc = crc32(data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(8, 0, true) // stored
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    parts.push(new Uint8Array(local.buffer), nameBytes, data)
    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, 0x02014b50, true)
    dir.setUint16(4, 20, true)
    dir.setUint16(6, 20, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, data.length, true)
    dir.setUint32(24, data.length, true)
    dir.setUint16(28, nameBytes.length, true)
    dir.setUint32(42, offset, true)
    central.push(new Uint8Array(dir.buffer), nameBytes)
    offset += 30 + nameBytes.length + data.length
  }
  const centralSize = central.reduce((s, b) => s + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((s, b) => s + b.length, 0))
  let at = 0
  for (const b of all) {
    out.set(b, at)
    at += b.length
  }
  return out
}

/** The bytes of an .xlsx workbook with one sheet. */
export function toXlsx(rows: Cell[][], sheetName = 'Sheet1'): Uint8Array {
  return zip(files(rows, sheetName))
}

/** Saves rows as an Excel (.xlsx) file in the browser. */
export function downloadXlsx(filename: string, rows: Cell[][], sheetName = 'Sheet1'): void {
  const blob = new Blob([toXlsx(rows, sheetName) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
