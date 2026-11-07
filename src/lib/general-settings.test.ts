import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../data/seed'
import { defaultReasons, generalSettings, holidayOn, reasonError, REASON_EVENTS, RECEIPT_FIELDS } from './general-settings'

describe('general settings', () => {
  it('fills every part for settings saved before they existed', () => {
    const g = generalSettings({ ...DEFAULT_SETTINGS })
    expect(g.toggles.discountAffectsTeacher).toBe(true)
    expect(Object.keys(g.reasons.lists).sort()).toEqual([...REASON_EVENTS].sort())
    expect(RECEIPT_FIELDS.every((f) => g.receipt[f])).toBe(true)
    expect(g.holidays.length).toBeGreaterThan(0)
  })

  it('gives unsaved defaults the same ids every time, so edits find them', () => {
    const a = generalSettings({ ...DEFAULT_SETTINGS })
    const b = generalSettings({ ...DEFAULT_SETTINGS })
    expect(a.reasons.lists.absent.map((r) => r.id)).toEqual(b.reasons.lists.absent.map((r) => r.id))
    expect(a.holidays.map((h) => h.id)).toEqual(b.holidays.map((h) => h.id))
  })

  it('keeps saved values and adds switches introduced later', () => {
    const g = generalSettings({ ...DEFAULT_SETTINGS, general: { toggles: { leadSmsVerify: true } as never, receipt: { note: false } as never } })
    expect(g.toggles.leadSmsVerify).toBe(true)
    expect(g.toggles.receiptAfterPayment).toBe(true)
    expect(g.receipt.note).toBe(false)
    expect(g.receipt.amount).toBe(true)
  })

  it('finds yearly holidays in any year and one-off holidays only on their date', () => {
    const hol = [
      { id: 'a', name: 'Navro‘z', date: '2026-03-21', everyYear: true, affectsBalance: false },
      { id: 'b', name: 'Eid', date: '2026-03-20', everyYear: false, affectsBalance: true },
    ]
    expect(holidayOn(hol, '2028-03-21')?.name).toBe('Navro‘z')
    expect(holidayOn(hol, '2026-03-20')?.name).toBe('Eid')
    expect(holidayOn(hol, '2027-03-20')).toBeUndefined()
  })

  it('rejects empty or repeated reasons, but allows renaming a reason to itself', () => {
    const list = defaultReasons().lists.absent
    expect(reasonError(list, ' ')).toBe('Enter a reason.')
    expect(reasonError(list, '  betob ')).toBe('That reason is already on the list.')
    expect(reasonError(list, 'Betob', list[0].id)).toBeNull()
    expect(reasonError(list, 'Wedding')).toBeNull()
  })
})
