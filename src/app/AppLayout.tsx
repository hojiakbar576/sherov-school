import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { TriangleAlert, X } from 'lucide-react'
import { Header } from '../components/layout/Header'
import { Logo } from '../components/layout/Logo'
import { DemoDataNote, Sidebar, SidebarNav } from '../components/layout/Sidebar'
import { IconButton } from '../components/ui/Button'
import { useSchool } from '../data/school-context'

const COLLAPSED_KEY = 'sherov-school:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

/** Mobile navigation drawer, built on <dialog> for focus trapping and Escape. */
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label="Navigation"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="drawer m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-line bg-surface p-0"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <IconButton label="Close navigation" onClick={onClose} className="-mr-2">
            <X />
          </IconButton>
        </div>
        <SidebarNav onNavigate={onClose} />
        <DemoDataNote />
      </div>
    </dialog>
  )
}

function LoadProblemBanner() {
  const { loadProblem, dismissLoadProblem } = useSchool()
  if (!loadProblem) return null
  return (
    <div role="alert" className="flex items-start gap-3 border-b border-warning-mark/40 bg-warning-soft px-4 py-3 text-sm text-ink lg:px-8">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <p className="flex-1">{loadProblem}</p>
      <button type="button" onClick={dismissLoadProblem} className="font-medium text-warning hover:underline">
        Dismiss
      </button>
    </div>
  )
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { pathname, hash } = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      // Not important enough to report.
    }
  }, [collapsed])

  // Start each page at the top, or at the #section it links to.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only z-50 rounded bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMenu={() => setDrawerOpen(true)} />
        <LoadProblemBanner />
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 focus:outline-none sm:py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
