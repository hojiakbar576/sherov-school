// A small, dependency-free spreadsheet reader: the first worksheet of an
// .xlsx file (from Excel, Google Sheets, LibreOffice or this app), or a .csv
// file. Returns the cells as text, row by row (row 1 first; blank rows kept
// so row numbers match the spreadsheet). Numbers come back as written
// in the file (dates as Excel serial numbers, e.g. "46331").

import { tr } from '../i18n'

/** Rows of text cells from an .xlsx or .csv file. */
export async function readSpreadsheet(file: Blob & { name?: string }): Promise<string[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b // "PK"
  if (isZip) return readXlsx(bytes)
  if (/\.xls$/i.test(file.name ?? '')) throw new Error(tr("Old .xls files can’t be read. In Excel choose File → Save As → Excel Workbook (.xlsx)."))
  return parseCsv(new TextDecoder('utf-8').decode(bytes))
}

// ---- CSV

/** Parses CSV text (comma or semicolon separated, quotes allowed). */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.slice(0, clean.indexOf('\n') === -1 ? undefined : clean.indexOf('\n'))
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

// ---- XLSX (a zip of XML files)

async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The "end of central directory" record sits in the last 64 KB.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error(tr("This file isn’t a readable Excel file."))
  const count = view.getUint16(eocd + 10, true)
  let at = view.getUint32(eocd + 16, true)
  const out = new Map<string, Uint8Array>()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) break
    const method = view.getUint16(at + 10, true)
    const compressed = view.getUint32(at + 20, true)
    const nameLen = view.getUint16(at + 28, true)
    const extraLen = view.getUint16(at + 30, true)
    const commentLen = view.getUint16(at + 32, true)
    const local = view.getUint32(at + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen))
    at += 46 + nameLen + extraLen + commentLen
    // Only the parts we read: the workbook, its links, shared text and worksheets.
    if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name)) continue
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const data = bytes.subarray(start, start + compressed)
    if (method === 0) out.set(name, data)
    else if (method === 8) out.set(name, await inflate(data))
    else throw new Error(tr("This Excel file uses a format that can’t be read. Save it again as .xlsx."))
  }
  return out
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const decodeXml = (s: string) =>
  s.replace(/&(lt|gt|amp|quot|apos|#x[0-9a-f]+|#\d+);/gi, (_, e: string) => {
    const k = e.toLowerCase()
    if (k === 'lt') return '<'
    if (k === 'gt') return '>'
    if (k === 'amp') return '&'
    if (k === 'quot') return '"'
    if (k === 'apos') return "'"
    return String.fromCodePoint(k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10))
  })

/** All the <t> text inside a piece of XML (rich text has several). */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('')

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const parts = await unzip(bytes)
  const text = (name: string) => {
    const b = parts.get(name)
    return b ? new TextDecoder('utf-8').decode(b) : undefined
  }

  // The first sheet in the workbook's tab order.
  let sheetPath = 'xl/worksheets/sheet1.xml'
  const workbook = text('xl/workbook.xml')
  const rels = text('xl/_rels/workbook.xml.rels')
  const firstId = workbook?.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1]
  if (firstId && rels) {
    const target = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstId}"`))?.[1]
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
  }
  const sheet = text(sheetPath) ?? [...parts.keys()].filter((k) => k.startsWith('xl/worksheets/')).map(text)[0]
  if (!sheet) throw new Error(tr("No worksheet found in this file."))

  const shared = [...(text('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))

  const rows: string[][] = []
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const r = Number(rowMatch[1].match(/\br="(\d+)"/)?.[1] ?? rows.length + 1) - 1
    const row: string[] = []
    let next = 0
    for (const c of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]
      const body = c[2] ?? ''
      const ref = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1]
      const col = ref ? columnIndex(ref) : next
      next = col + 1
      const type = attrs.match(/\bt="([^"]+)"/)?.[1]
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let value = ''
      if (type === 's') value = shared[Number(v)] ?? ''
      else if (type === 'inlineStr') value = textOf(body)
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE'
      else value = v === undefined ? '' : decodeXml(v)
      row[col] = value
    }
    rows[r] = Array.from(row, (x) => x ?? '')
  }
  // Blank rows stay, so row numbers match what the person sees in Excel.
  return Array.from(rows, (x) => x ?? [])
}
