import { useLocation } from 'react-router'
import { Hammer } from 'lucide-react'
import { SOON_PAGES } from '../../app/menu'
import { ButtonLink } from '../../components/ui/Button'
import { tr } from '../../i18n'

/** Placeholder for LC UP sections we haven't built yet, so the menu works end to end. */
export function ComingSoonPage() {
  const { pathname } = useLocation()
  const page = SOON_PAGES.find((p) => p.to === pathname)
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-panel border border-line bg-surface p-8 text-center">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Hammer aria-hidden className="size-6" />
      </span>
      <h1 className="text-xl font-semibold text-ink">{page?.label ?? tr("Coming soon")}</h1>
      {page?.about && <p className="mt-2 text-ink-muted">{page.about}</p>}
      <p className="mt-4 text-sm text-ink-muted">{tr("This section is planned but not built yet. If your centre needs it, tell us and we’ll build it next; if not, we’ll remove it from the menu.")}</p>
      <ButtonLink to="/" className="mt-6">
        {tr("Back to dashboard")}
      </ButtonLink>
    </div>
  )
}
