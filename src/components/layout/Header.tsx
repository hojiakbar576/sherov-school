import { useState } from 'react'
import { useLocation } from 'react-router'
import { Menu, Search, X } from 'lucide-react'
import { pageTitle } from '../../app/navigation'
import { useSchool } from '../../data/school-context'
import { toISODate } from '../../lib/dates'
import { formatLongDate } from '../../lib/format'
import { IconButton } from '../ui/Button'
import { HeaderSearch } from './HeaderSearch'
import { NotificationsMenu } from './NotificationsMenu'
import { ProfileMenu } from './ProfileMenu'

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { pathname } = useLocation()
  const { now } = useSchool()
  const [mobileSearch, setMobileSearch] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 lg:px-8">
        <IconButton label="Open navigation" onClick={onOpenMenu} className="-ml-1 lg:hidden">
          <Menu />
        </IconButton>

        <div className="min-w-0 flex-1 md:flex-none md:w-44 xl:w-56">
          <p className="truncate font-semibold text-ink">{pageTitle(pathname)}</p>
          <p className="hidden truncate text-xs text-ink-muted sm:block">
            <time dateTime={toISODate(now)}>{formatLongDate(now)}</time>
          </p>
        </div>

        <HeaderSearch className="hidden max-w-md flex-1 md:block" />

        <div className="ml-auto flex items-center gap-1">
          <IconButton label={mobileSearch ? 'Close search' : 'Search'} onClick={() => setMobileSearch((v) => !v)} className="md:hidden">
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
