import { Compass } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/misc'
import { usePortalPath } from './portal'

export function NotFoundPage() {
  const portalPath = usePortalPath()
  return (
    <div className="rounded-panel border border-line bg-surface">
      <EmptyState icon={Compass} title="This page doesn't exist" action={<ButtonLink to={portalPath('') || '/'} variant="primary">Go to dashboard</ButtonLink>}>
        The link may be mistyped, or the record it pointed to was deleted.
      </EmptyState>
    </div>
  )
}
