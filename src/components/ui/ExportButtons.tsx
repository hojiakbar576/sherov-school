import { Download, FileSpreadsheet } from 'lucide-react'
import { downloadCSV } from '../../lib/csv'
import { downloadXlsx } from '../../lib/xlsx'
import { Button } from './Button'

type Cell = string | number | null | undefined

/**
 * Export the same rows as Excel (.xlsx) or CSV. `rows` is called only when
 * a button is pressed. `name` becomes the file name, e.g. "students" →
 * sherov-school-students-2026-11-04.xlsx.
 */
export function ExportButtons({ name, date, rows, disabled, size = 'md' }: { name: string; date: string; rows: () => Cell[][]; disabled?: boolean; size?: 'sm' | 'md' }) {
  const file = `sherov-school-${name}-${date}`
  return (
    <>
      <Button size={size} onClick={() => downloadXlsx(`${file}.xlsx`, rows(), name)} disabled={disabled}>
        <FileSpreadsheet aria-hidden />
        Excel
      </Button>
      <Button size={size} variant="ghost" onClick={() => downloadCSV(`${file}.csv`, rows())} disabled={disabled}>
        <Download aria-hidden />
        CSV
      </Button>
    </>
  )
}
