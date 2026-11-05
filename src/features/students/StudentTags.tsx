import { useSchool } from '../../data/school-context'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

/** A student's tags as small chips. */
export function TagChips({ tags, className }: { tags?: string[]; className?: string }) {
  const { data } = useSchool()
  if (!tags?.length) return null
  const name = new Map(data.catalogs.studentTags.map((t) => [t.id, t.name]))
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {tags.map((id) => (
        <span key={id} className="rounded-full border border-line-strong bg-surface px-2 py-0.5 text-xs text-ink-muted">
          {name.get(id) ?? tr("Tag")}
        </span>
      ))}
    </span>
  )
}

/** Pick tags: each is a toggle button. Turned-off tags still show if the student has them. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const { data } = useSchool()
  const tags = data.catalogs.studentTags.filter((t) => t.active || value.includes(t.id))
  if (tags.length === 0) return <p className="text-sm text-ink-muted">{tr("No tags yet. Add some in Settings → Lists.")}</p>
  return (
    <div role="group" aria-label={tr("Tags")} className="flex flex-wrap gap-1.5">
      {tags.map((t) => {
        const on = value.includes(t.id)
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
            className={cn('h-8 rounded-full border px-3 text-sm', on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line-strong bg-surface text-ink-muted hover:text-ink')}
          >
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
