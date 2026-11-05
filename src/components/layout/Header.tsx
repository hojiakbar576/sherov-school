import { useState } from 'react'
import { useLocation } from 'react-router'
import { Menu, Search, X } from 'lucide-react'
import { pageTitle } from '../../app/navigation'
import { useSchool } from '../../data/school-context'
import { toISODate } from '../../lib/dates'
import { formatLongDate } from '../../lib/format'
import { IconButton } from '../ui/Button'
import { cn } from '../../lib/cn'
import { HeaderSearch } from './HeaderSearch'
import { NotificationsMenu } from './NotificationsMenu'
import { ProfileMenu } from './ProfileMenu'
import { BranchSwitcher } from './BranchSwitcher'
import { tr } from '../../i18n'

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { pathname } = useLocation()
  const { now, user, branch } = useSchool()
  const [mobileSearch, setMobileSearch] = useState(false)
  const isTeacher = user?.role === 'teacher'

  return (
    <header
      className={cn(
        'sticky top-0 z-30 print:hidden bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85',
        isTeacher ? 'mx-3 mt-3 rounded-2xl border border-line lg:mx-4' : 'border-b border-line',
      )}
    >
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 lg:px-8">
        <IconButton label={tr("Open navigation")} onClick={onOpenMenu} className="-ml-1 lg:hidden">
          <Menu />
        </IconButton>

        <div className="min-w-0 flex-1 md:flex-none md:w-44 xl:w-56">
          <p className="truncate font-semibold text-ink">{pageTitle(pathname, user?.role)}</p>
          <p className="hidden truncate text-xs text-ink-muted sm:block">
            <time dateTime={toISODate(now)}>{formatLongDate(now)}</time>
          </p>
        </div>

        <HeaderSearch className="hidden max-w-md flex-1 md:block" />

        <div className="ml-auto flex items-center gap-1">
          {isTeacher && branch && (
            <span className="mr-2 hidden items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-sm font-medium text-ink lg:inline-flex">
              <span aria-hidden className="size-2 rounded-full bg-brand" />
              {branch.name}{' '}{tr("branch")}
            </span>
          )}
          <BranchSwitcher />
          <IconButton label={mobileSearch ? tr("Close search") : tr("Search")} onClick={() => setMobileSearch((v) => !v)} className="md:hidden">
            {mobileSearch ? <X /> : <Search />}
          </IconButton>
          <NotificationsMenu />
          <ProfileMenu />
        </div>
      </div>
      {mobileSearch && (
        <div className="border-t border-line px-4 py-3 md:hidden">
          <HeaderSearch autoFocus />
        </div>
      )}
    </header>
  )
}
