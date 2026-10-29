import { Compass } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/misc'

export function NotFoundPage() {
  return (
    <div className="rounded-panel border border-line bg-surface">
      <EmptyState icon={Compass} title="This page doesn't exist" action={<ButtonLink to="/" variant="primary">Go to dashboard</ButtonLink>}>
        The link may be mistyped, or the record it pointed to was deleted.
      </EmptyState>
    </div>
  )
}
