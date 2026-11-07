import { describe, expect, it } from 'vitest'
import { cellOf, toXlsx } from './xlsx'
import { readSpreadsheet } from './xlsx-read'
import { parseDate } from './student-import'

describe('Excel files', () => {
  it('stores numbers, percentages and dates as real values, everything else as text', () => {
    expect(cellOf(1250000)).toEqual({ kind: 'number', number: 1250000, style: 2 })
    expect(cellOf(4.5)).toEqual({ kind: 'number', number: 4.5, style: 5 })
    expect(cellOf('93%')).toEqual({ kind: 'number', number: 0.93, style: 3 })
    expect(cellOf('2026-11-05')).toEqual({ kind: 'number', number: 46331, style: 4 })
    expect(cellOf('2026-02-31')).toEqual({ kind: 'text', text: '2026-02-31' })
    expect(cellOf('+998 90 123 45 67')).toEqual({ kind: 'text', text: '+998 90 123 45 67' })
    expect(cellOf('2026-11')).toEqual({ kind: 'text', text: '2026-11' })
    expect(cellOf('')).toBeNull()
  })

  it('what the app writes, it reads back (so exported files can be imported again)', async () => {
    const rows = [
      ['Student', 'Enrolled', 'Monthly tuition (UZS)', 'Attendance rate'],
      ['Ali', '2026-10-01', 450000, '93%'],
    ]
    const back = await readSpreadsheet(Object.assign(new Blob([toXlsx(rows) as BlobPart]), { name: 'x.xlsx' }))
    expect(back[0]).toEqual(rows[0])
    expect(back[1][0]).toBe('Ali')
    expect(parseDate(back[1][1])).toBe('2026-10-01')
    expect(back[1][2]).toBe('450000')
    expect(back[1][3]).toBe('0.93')
  })
})
