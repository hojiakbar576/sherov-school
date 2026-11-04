// The admissions pipeline: enquiry → contacted → trial lesson → placement →
// enrolled (or lost). Labels and the "what's next" rules live here so the
// Leads pages, the dashboard and notifications all say the same thing.

import type { ISODate, Lead, LeadStage } from '../types'
import { formatDate } from './format'

export const leadStageLabel: Record<LeadStage, string> = {
  new: 'New enquiry',
  contacted: 'Contacted',
  trial_scheduled: 'Trial scheduled',
  trial_done: 'Trial done',
  enrolled: 'Enrolled',
  lost: 'Lost',
}

/** The stages a lead moves through, in order (lost is off to the side). */
export const PIPELINE: LeadStage[] = ['new', 'contacted', 'trial_scheduled', 'trial_done', 'enrolled']

export const LEAD_SOURCES = ['Instagram', 'Telegram channel', 'Friend’s recommendation', 'Walk-in', 'Google Maps', 'School flyer', 'Phone call', 'Other']
export const LOST_REASONS = ['Price too high', 'Chose another centre', 'Schedule doesn’t fit', 'Not answering calls', 'Not interested any more', 'Other']

export function isOpenLead(lead: Lead): boolean {
  return lead.stage !== 'enrolled' && lead.stage !== 'lost'
}

/** What the administrator should do next, in a few words. */
export function nextStep(lead: Lead, today: ISODate): string {
  switch (lead.stage) {
    case 'new':
      return 'Call back'
    case 'contacted':
      return 'Schedule a trial lesson'
    case 'trial_scheduled':
      if (!lead.trial) return 'Schedule a trial lesson'
      if (lead.trial.date < today) return 'Record the trial result'
      return lead.trial.date === today ? `Trial today at ${lead.trial.time}` : `Trial ${formatDate(lead.trial.date)}, ${lead.trial.time}`
    case 'trial_done':
      return 'Enroll as a student'
    case 'enrolled':
      return 'Enrolled'
    case 'lost':
      return lead.lostReason ? `Lost: ${lead.lostReason}` : 'Lost'
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
