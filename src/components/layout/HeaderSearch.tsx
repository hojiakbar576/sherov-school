import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { GraduationCap, Search, Users, UsersRound, type LucideIcon } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { cn } from '../../lib/cn'

interface Result {
  id: string
  kind: 'Student' | 'Teacher' | 'Group'
  icon: LucideIcon
  title: string
  detail: string
  to: string
}

const MAX_RESULTS = 8

/** Searches students, teachers and groups in the local demo data. */
export function HeaderSearch({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const { data } = useSchool()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  // Press "/" anywhere to jump to search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const digits = q.replace(/\D/g, '')
    const groupName = new Map(data.groups.map((g) => [g.id, g.name]))
    const teacherName = new Map(data.teachers.map((t) => [t.id, t.fullName]))
    const found: Result[] = []
    for (const s of data.students) {
      if (s.fullName.toLowerCase().includes(q) || (digits.length >= 3 && s.phone.replace(/\D/g, '').includes(digits))) {
        found.push({ id: s.id, kind: 'Student', icon: Users, title: s.fullName, detail: `${groupName.get(s.groupId ?? '') ?? 'No group'}, ${s.phone}`, to: `/students/${s.id}` })
      }
    }
    for (const t of data.teachers) {
      if (t.fullName.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)) {
        found.push({ id: t.id, kind: 'Teacher', icon: GraduationCap, title: t.fullName, detail: t.subject, to: `/teachers?q=${encodeURIComponent(t.fullName)}` })
      }
    }
    for (const g of data.groups) {
      if (g.name.toLowerCase().includes(q) || g.room.toLowerCase().includes(q)) {
        found.push({ id: g.id, kind: 'Group', icon: UsersRound, title: g.name, detail: `${teacherName.get(g.teacherId) ?? ''}, ${g.room}`, to: `/groups?q=${encodeURIComponent(g.name)}` })
      }
    }
    return found.slice(0, MAX_RESULTS)
  }, [query, data])

  const go = (result: Result) => {
    navigate(result.to)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const showList = open && query.trim().length >= 2

  return (
    <div className={cn('relative', className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search students, teachers and groups"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        autoFocus={autoFocus}
        value={query}
        placeholder="Search students, teachers, groups"
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActive((i) => Math.min(i + 1, results.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (event.key === 'Enter' && results[active]) {
            event.preventDefault()
            go(results[active])
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
        className="h-10 w-full rounded-control border border-line bg-canvas pr-10 pl-9 text-sm text-ink placeholder:text-ink-faint hover:border-line-strong focus:bg-surface"
      />
      <kbd aria-hidden className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line bg-surface px-1.5 text-2xs text-ink-muted md:block">
        /
      </kbd>
      {showList && (
        <div className="absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-panel border border-line bg-surface shadow-pop">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">No students, teachers or groups match “{query.trim()}”.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Search results" className="max-h-96 overflow-y-auto py-1">
              {results.map((result, index) => {
                const Icon = result.icon
                return (
                  <li
                    key={`${result.kind}-${result.id}`}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(result)}
                    onMouseEnter={() => setActive(index)}
                    className={cn('flex cursor-pointer items-center gap-3 px-4 py-2', index === active && 'bg-subtle')}
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-ink-faint" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{result.title}</span>
                      <span className="block truncate text-xs text-ink-muted">{result.detail}</span>
                    </span>
                    <span className="text-xs text-ink-faint">{result.kind}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
