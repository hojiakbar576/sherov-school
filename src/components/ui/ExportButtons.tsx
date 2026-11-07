import { FileSpreadsheet, FileText } from 'lucide-react'
import { downloadCSV, type CsvCell } from '../../lib/csv'
import { downloadXlsx } from '../../lib/xlsx'
import { Button } from './Button'
import { tr } from '../../i18n'

export interface ExportButtonsProps {
  /** Becomes the file name: "students" → sherov-school-students-2026-11-06.csv */
  name: string
  /** Date (or month) stamped into the file name. */
  date: string
  /** The table to export, first row = column headers. Called only when a button is pressed. */
  rows: () => CsvCell[][]
  /** What is being exported, for screen readers and the tooltip, e.g. "attendance for November 2026". */
  what?: string
  /** Called after a download with the number of data rows (headers not counted). */
  onExport?: (rows: number) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

/**
 * The app's export buttons: the same table as an Excel (.xlsx) workbook or a
 * CSV file. Every page that offers a download uses this, so both formats and
 * their fixes (lib/xlsx.ts, lib/csv.ts) apply everywhere.
 */
export function ExportButtons({ name, date, rows, what, onExport, disabled, size = 'md' }: ExportButtonsProps) {
  const file = `sherov-school-${name}-${date}`
  const run = (save: (table: CsvCell[][]) => void) => {
    const table = rows()
    save(table)
    onExport?.(Math.max(0, table.length - 1))
  }
  return (
    <>
      <Button
        size={size}
        onClick={() => run((t) => downloadXlsx(`${file}.xlsx`, t, name))}
        disabled={disabled}
        aria-label={what ? tr("Download {0} as Excel", what) : undefined}
        title={what ? tr("Download {0} as Excel", what) : tr("Download as an Excel workbook (.xlsx)")}
      >
        <FileSpreadsheet aria-hidden />
        {tr("Excel")}
      </Button>
      <Button
        size={size}
        onClick={() => run((t) => downloadCSV(`${file}.csv`, t))}
        disabled={disabled}
        aria-label={what ? tr("Download {0} as CSV", what) : undefined}
        title={what ? tr("Download {0} as CSV", what) : tr("Download as CSV (opens in Excel with one column per field)")}
      >
        <FileText aria-hidden />
        {tr("CSV")}
      </Button>
    </>
  )
}
