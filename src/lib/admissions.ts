// The admissions pipeline: enquiry → contacted → trial lesson → placement →
// enrolled (or lost). The "what's next" rules live here so the Leads pages,
// the dashboard and notifications all say the same thing. The stage list
// itself (names, colours, order) is data the owner manages: lib/lead-stages.ts.

import type { ISODate, Lead } from '../types'
import { formatDate } from './format'
import { tr } from '../i18n'

export const LEAD_SOURCES = ['Instagram', 'Telegram channel', 'Friend’s recommendation', 'Walk-in', 'Google Maps', 'School flyer', 'Phone call', 'Other']
export const LOST_REASONS = ['Price too high', 'Chose another centre', 'Schedule doesn’t fit', 'Not answering calls', 'Not interested any more', 'Other']

export function isOpenLead(lead: Lead): boolean {
  return lead.stage !== 'enrolled' && lead.stage !== 'lost'
}

/** What the administrator should do next, in a few words. */
export function nextStep(lead: Lead, today: ISODate): string {
  switch (lead.stage) {
    case 'new':
      return tr("Call back")
    case 'contacted':
      return tr("Schedule a trial lesson")
    case 'trial_scheduled':
      if (!lead.trial) return tr("Schedule a trial lesson")
      if (lead.trial.date < today) return tr("Record the trial result")
      return lead.trial.date === today ? tr("Trial today at {0}", lead.trial.time) : tr("Trial {0}, {1}", formatDate(lead.trial.date), lead.trial.time)
    case 'trial_done':
      return tr("Enroll as a student")
    case 'enrolled':
      return tr("Enrolled")
    case 'lost':
      return lead.lostReason ? tr("Lost: {0}", lead.lostReason) : tr("Lost")
    default:
      // A stage the owner added: no automatic step, the team moves it on.
      return tr("Move to the next stage when ready")
  }
}

/** Trial lessons booked for a day, earliest first. */
export function trialsOn(leads: Lead[], date: ISODate): Lead[] {
  return leads
    .filter((l) => l.stage === 'trial_scheduled' && l.trial?.date === date)
    .sort((a, b) => (a.trial?.time ?? '').localeCompare(b.trial?.time ?? ''))
}

/** Scheduled trials whose day has passed without a result. */
export function trialsAwaitingResult(leads: Lead[], today: ISODate): Lead[] {
  return leads.filter((l) => l.stage === 'trial_scheduled' && l.trial && l.trial.date < today)
}
