import { Link } from 'react-router'
import { ChevronDown, RotateCcw, Settings } from 'lucide-react'
import { Popover } from '../ui/Popover'

export function ProfileMenu() {
  return (
    <Popover
      label="Account"
      className="w-72"
      trigger={(props) => (
        <button type="button" {...props} aria-label="Account menu" className="flex h-10 items-center gap-2 rounded-control pr-1.5 pl-1 hover:bg-subtle">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
            SA
          </span>
          <span className="hidden text-left leading-tight xl:block">
            <span className="block text-sm font-medium text-ink">Admin</span>
            <span className="block text-xs text-ink-muted">School Administrator</span>
          </span>
          <ChevronDown aria-hidden className="hidden size-4 text-ink-faint sm:block" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">School Administrator</p>
            <p className="text-xs text-ink-muted">Sherov School</p>
          </div>
          <ul className="py-1">
            <li>
              <Link to="/settings" onClick={close} className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-subtle">
                <Settings aria-hidden className="size-4 text-ink-faint" />
                Centre settings
              </Link>
            </li>
            <li>
              <Link to="/settings#demo-data" onClick={close} className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-subtle">
                <RotateCcw aria-hidden className="size-4 text-ink-faint" />
                Reset demo data
              </Link>
            </li>
          </ul>
          <p className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">
            Sign-in isn't set up yet. This demo has no user accounts.
          </p>
        </>
      )}
    </Popover>
  )
}
