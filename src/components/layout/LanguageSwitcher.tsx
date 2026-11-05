import { Languages } from 'lucide-react'
import { currentLocale, LOCALES, localeName, setLocale, tr } from '../../i18n'
import { cn } from '../../lib/cn'

/** EN · UZ · RU. Choosing a language reloads the page in it and is remembered in this browser. */
export function LanguageSwitcher({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Languages aria-hidden className="size-4" />
          {tr('Language')}
        </span>
      )}
      <div role="radiogroup" aria-label={tr('Language')} className="inline-flex rounded-control border border-line bg-surface p-0.5">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={currentLocale === l}
            lang={l}
            title={localeName[l]}
            onClick={() => currentLocale !== l && setLocale(l)}
            className={cn(
              'h-7 rounded-[calc(var(--radius-control)-2px)] px-2.5 text-xs font-semibold uppercase',
              currentLocale === l ? 'bg-brand text-white' : 'text-ink-muted hover:bg-subtle hover:text-ink',
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}
