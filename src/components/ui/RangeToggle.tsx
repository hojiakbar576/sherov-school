import { cn } from '../../lib/cn'

/** Two-option segmented control; a real radio group for keyboard users. */
export function RangeToggle<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-control border border-line-strong bg-canvas p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 rounded-[6px] px-2.5 text-xs font-medium',
            value === o.value ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(23_32_51/0.08)]' : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
