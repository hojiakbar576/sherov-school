import { useSearchParams } from 'react-router'

/**
 * Keeps list filters in the URL (?q=…&group=…) so they survive refreshes and
 * links like "/students?tuition=overdue" open with the right filter applied.
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()
  const values = Object.fromEntries(keys.map((k) => [k, params.get(k) ?? ''])) as Record<K, string>
  const page = Math.max(1, Number(params.get('page')) || 1)

  const set = (key: K | 'page', value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        if (key !== 'page') next.delete('page') // new filter, back to page 1
        return next
      },
      { replace: true },
    )
  }

  const clear = () => setParams(new URLSearchParams(), { replace: true })
  const active = keys.some((k) => values[k])

  return { values, page, set, setPage: (p: number) => set('page', p > 1 ? String(p) : ''), clear, active }
}
