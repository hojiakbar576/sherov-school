import { Link, useNavigate } from 'react-router'
import { ChevronDown, LogOut, RotateCcw, Settings } from 'lucide-react'
import { useSchool } from '../../data/school-context'
import { roleLabel } from '../../lib/auth'
import { initials } from '../../lib/format'
import { Popover } from '../ui/Popover'
import { tr } from '../../i18n'
import { LanguageSwitcher } from './LanguageSwitcher'

export function ProfileMenu() {
  const { user, branch, data, signOut } = useSchool()
  const navigate = useNavigate()
  if (!user) return null
  const isManager = user.role !== 'teacher'
  const place = branch ? tr('{0} branch', branch.name) : tr('All branches')

  return (
    <Popover
      label={tr("Account")}
      className="w-72"
      trigger={(props) => (
        <button type="button" {...props} aria-label={tr("Account menu, {0}", user.fullName)} className="flex h-10 items-center gap-2 rounded-control pr-1.5 pl-1 hover:bg-subtle">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
            {initials(user.fullName)}
          </span>
          <span className="hidden text-left leading-tight xl:block">
            <span className="block max-w-40 truncate text-sm font-medium text-ink">{user.fullName}</span>
            <span className="block text-xs text-ink-muted">
              {roleLabel[user.role]}, {branch?.name ?? tr("all branches")}
            </span>
          </span>
          <ChevronDown aria-hidden className="hidden size-4 text-ink-faint sm:block" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">{user.fullName}</p>
            <p className="text-xs text-ink-muted">
              {roleLabel[user.role]} · {place}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint">{data.settings.centerName}</p>
          </div>
          <ul className="py-1">
            {isManager && (
              <>
                <li>
                  <Link to={user.role === 'owner' ? '/owner/settings' : '/settings'} onClick={close} className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-subtle">
                    <Settings aria-hidden className="size-4 text-ink-faint" />
                    {tr("Centre settings")}
                  </Link>
                </li>
                <li>
                  <Link to="/settings#demo-data" onClick={close} className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-subtle">
                    <RotateCcw aria-hidden className="size-4 text-ink-faint" />
                    {tr("Reset demo data")}
                  </Link>
                </li>
              </>
            )}
            <li>
              <button
                type="button"
                onClick={() => {
                  close()
                  signOut()
                  navigate(user.role === 'owner' ? '/owner/login' : '/login', { replace: true })
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink hover:bg-subtle"
              >
                <LogOut aria-hidden className="size-4 text-ink-faint" />
                {tr("Sign out")}
              </button>
            </li>
          </ul>
          <LanguageSwitcher showLabel className="justify-between border-t border-line px-4 py-2.5" />
          <p className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">
            {tr("Signed in securely. School data is still sample data in this browser until it moves to the database.")}
          </p>
        </>
      )}
    </Popover>
  )
}
