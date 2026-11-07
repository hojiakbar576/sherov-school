import { describe, expect, it } from 'vitest'
import { CSV_SEPARATOR, csvField, csvFileContent, toCSV, UTF8_BOM } from './csv'
import { parseCsv } from './xlsx-read'

describe('CSV export', () => {
  it('uses semicolons, a UTF-8 BOM and one line per row, so Excel puts each field in its own column', () => {
    expect(CSV_SEPARATOR).toBe(';')
    const file = csvFileContent([
      ['Student', 'Group'],
      ['Ali', 'IELTS'],
    ])
    expect(file.startsWith(UTF8_BOM)).toBe(true)
    expect(file).toBe('﻿Student;Group\r\nAli;IELTS\r\n')
  })

  it('quotes commas, semicolons, quotation marks and line breaks without breaking the columns', () => {
    const rows = [
      ['Name', 'Note', 'Groups'],
      ['Karimov, Ali', 'Said "hello"\nthen left', 'IELTS; Maths'],
    ]
    const text = toCSV(rows)
    expect(text).toContain('"Karimov, Ali"')
    expect(text).toContain('"Said ""hello""\nthen left"')
    expect(text).toContain('"IELTS; Maths"')
    expect(parseCsv(UTF8_BOM + text)).toEqual(rows)
  })

  it('keeps Uzbek and Russian letters as they are', () => {
    const rows = [['Ism', 'Имя'], ['G‘ayratjon O‘rinboyev', 'Шахноза Расулова']]
    expect(parseCsv(csvFileContent(rows))).toEqual(rows)
  })

  it('keeps phone numbers as text and never lets a cell run as a formula', () => {
    // Written as ="…" (Excel shows the text, runs nothing), then quoted as a CSV field.
    expect(csvField('+998 90 123 45 67')).toBe('"=""+998 90 123 45 67"""')
    expect(csvField('=HYPERLINK("http://x","click")')).toBe('"=""=HYPERLINK(""""http://x"""",""""click"""")"""')
    expect(csvField('@SUM(A1)')).toBe('"=""@SUM(A1)"""')
    expect(csvField('0012345')).toBe('"=""0012345"""')
    // Too long for Excel's ="…" text: falls back to a leading apostrophe.
    expect(csvField('-' + 'x'.repeat(300)).startsWith("'-")).toBe(true)
    // …and reads back as the original text when imported again
    const rows = [['Phone', 'Formula'], ['+998 90 123 45 67', '=1+1']]
    expect(parseCsv(csvFileContent(rows))).toEqual(rows)
  })

  it('writes numbers plainly (decimals with a comma to match the semicolon list) and blanks for missing values', () => {
    expect(csvField(1250000)).toBe('1250000')
    expect(csvField(-5)).toBe('-5')
    expect(csvField(4.5)).toBe('"4,5"')
    expect(csvField(null)).toBe('')
    expect(csvField(undefined)).toBe('')
    expect(csvField(Number.NaN)).toBe('')
    expect(csvField('93%')).toBe('93%')
    expect(csvField('2026-11-06')).toBe('2026-11-06')
  })
})

describe('one export path', () => {
  it('pages export through <ExportButtons>, never by building files themselves', () => {
    const sources = import.meta.glob(['../features/**/*.{ts,tsx}', '../app/**/*.{ts,tsx}', '!**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    // The import dialog's blank template is a download, but not an export of data.
    const allowed = ['../features/students/ImportStudentsDialog.tsx']
    const offenders = Object.entries(sources)
      .filter(([path, code]) => !allowed.includes(path) && /downloadCSV\(|downloadXlsx\(/.test(code))
      .map(([path]) => path)
    expect(Object.keys(sources).length).toBeGreaterThan(20)
    expect(offenders).toEqual([])
  })
})
