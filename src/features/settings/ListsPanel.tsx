import { useState, type FormEvent } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import type { Catalogs } from '../../types'
import { useSchool, type CatalogName } from '../../data/school-context'
import { useToast } from '../../components/ui/toast-context'
import { Panel } from '../../components/ui/Panel'
import { Button, IconButton } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { cn } from '../../lib/cn'

const LISTS: { key: CatalogName; title: string; hint: string; placeholder: string }[] = [
  { key: 'paymentMethods', title: 'Payment methods', hint: 'Offered when recording a payment, an expense or a salary.', placeholder: 'e.g. Uzum' },
  { key: 'expenseCategories', title: 'Expense categories', hint: 'Used to group expenses in reports.', placeholder: 'e.g. Internet' },
  { key: 'studentTags', title: 'Student tags', hint: 'Short labels you can put on students and filter by.', placeholder: 'e.g. Olympiad' },
  { key: 'pauseReasons', title: 'Freeze reasons', hint: 'Offered when a student is paused.', placeholder: 'e.g. Summer holiday' },
  { key: 'leaveReasons', title: 'Leaving reasons', hint: 'Offered when a student leaves. Used in the retention report.', placeholder: 'e.g. Moved abroad' },
  { key: 'leadSources', title: 'Enquiry sources', hint: 'Where new enquiries came from.', placeholder: 'e.g. YouTube' },
]

/**
 * The lists the school manages itself. Turning an entry off hides it from new
 * records but keeps it on old ones, so history stays readable.
 */
export function ListsPanel() {
  const { data, actions } = useSchool()
  const toast = useToast()
  const [active, setActive] = useState<CatalogName>('paymentMethods')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const list = LISTS.find((l) => l.key === active)!
  const items = (data.catalogs as Catalogs)[active]

  const add = (event: FormEvent) => {
    event.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (clean.length < 2) return setError('Enter a name.')
    if (items.some((i) => i.name.toLowerCase() === clean.toLowerCase())) return setError('That’s already on the list.')
    actions.addListItem(active, clean)
    toast.show(`“${clean}” added to ${list.title.toLowerCase()}.`)
    setName('')
  }

  return (
    <Panel id="lists" title="Lists" description="Shared by every branch. Change them here instead of in the code." flush>
      <div role="tablist" aria-label="Which list" className="flex flex-wrap gap-1 border-t border-line px-4 pt-3">
        {LISTS.map((l) => (
          <button
            key={l.key}
            type="button"
            role="tab"
            aria-selected={active === l.key}
            onClick={() => {
              setActive(l.key)
              setError('')
              setRenaming(null)
            }}
            className={cn('rounded-full px-3 py-1.5 text-sm', active === l.key ? 'bg-brand text-white' : 'text-ink-muted hover:bg-subtle hover:text-ink')}
          >
            {l.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={list.title}>
        <p className="px-5 pt-3 text-sm text-ink-muted">{list.hint}</p>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 px-5 py-2 text-sm">
              {renaming?.id === i.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (renaming.name.trim().length < 2) return
                    actions.renameListItem(active, i.id, renaming.name)
                    setRenaming(null)
                  }}
                >
                  <Input aria-label={`New name for ${i.name}`} autoFocus value={renaming.name} onChange={(e) => setRenaming({ id: i.id, name: e.target.value })} className="h-8 flex-1" />
                  <IconButton label="Save name" type="submit">
                    <Check />
                  </IconButton>
                  <IconButton label="Cancel" onClick={() => setRenaming(null)}>
                    <X />
                  </IconButton>
                </form>
              ) : (
                <>
                  <span className={cn('flex-1', i.active ? 'text-ink' : 'text-ink-faint line-through')}>{i.name}</span>
                  {!i.active && <Badge>Off</Badge>}
                  <IconButton label={`Rename ${i.name}`} onClick={() => setRenaming({ id: i.id, name: i.name })}>
                    <Pencil />
                  </IconButton>
                  <Button size="sm" variant="ghost" onClick={() => actions.setListItemActive(active, i.id, !i.active)} aria-label={`${i.active ? 'Turn off' : 'Turn on'} ${i.name}`}>
                    {i.active ? 'Turn off' : 'Turn on'}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={add} noValidate className="flex items-start gap-2 px-5 py-4">
          <Field label={`Add to ${list.title.toLowerCase()}`} error={error || undefined} className="flex-1">
            {(p) => (
              <Input
                {...p}
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value)
                  setError('')
                }}
                placeholder={list.placeholder}
              />
            )}
          </Field>
          <Button type="submit" className="mt-[1.6rem]">
            Add
          </Button>
        </form>
      </div>
    </Panel>
  )
}
