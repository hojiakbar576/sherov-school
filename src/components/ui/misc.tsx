import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/cn'
import { initials } from '../../lib/format'

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-subtle text-ink-muted">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="font-medium text-ink">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const avatarTints = ['bg-[#E8EAFD] text-[#3730A3]', 'bg-[#E3F1EA] text-[#25603F]', 'bg-[#FBEEDD] text-[#7C4A06]', 'bg-[#EDEFF3] text-[#3A4559]', 'bg-[#F7E6EF] text-[#8A2754]']

/** Initials avatar with a tint chosen from the name, so it stays stable. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const tint = avatarTints[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % avatarTints.length]
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' ? 'size-7 text-[0.6875rem]' : 'size-9 text-xs',
        tint,
      )}
    >
      {initials(name)}
    </span>
  )
}

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  noun: string
}

export function Pagination({ page, pageSize, total, onPage, noun }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const navButton = 'inline-flex size-8 items-center justify-center rounded-control border border-line-strong bg-surface text-ink hover:bg-subtle disabled:opacity-40 disabled:pointer-events-none'
  return (
    <nav aria-label={`${noun} pages`} className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm text-ink-muted">
      <p className="num">
        {from}–{to} of {total} {noun}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" className={navButton} onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          <span className="num min-w-16 text-center">
            Page {page} of {pages}
          </span>
          <button type="button" className={navButton} onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Next page">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </nav>
  )
}

/** Search box used at the top of list pages. */
export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-control pl-9"
      />
    </div>
  )
}

/**
 * Wrapper that lets wide tables scroll inside their panel, never the page.
 * `relative` keeps visually hidden (absolutely positioned) labels inside it.
 */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="relative overflow-x-auto">{children}</div>
}

export const th = 'px-5 py-2.5 text-left text-xs font-medium text-ink-muted whitespace-nowrap first:pl-5'
export const td = 'px-5 py-3 align-middle'
