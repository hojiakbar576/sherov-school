// Translation foundation. The interface is English for now; Uzbek and Russian
// come next. New interface text goes in `messages.en` under a stable key and
// is read with `t('key')`. To add a language: copy `en`, translate the
// values, add it to `MESSAGES`, and switch `currentLocale` (later, a user
// setting). Keys that are missing in a language fall back to English, so a
// translation can be filled in gradually.
//
// So far the navigation uses it; page text moves over screen by screen
// instead of in one rushed pass.

export const LOCALES = ['en', 'uz', 'ru'] as const
export type Locale = (typeof LOCALES)[number]

const en = {
  'nav.overview': 'Overview',
  'nav.dashboard': 'Dashboard',
  'nav.admissions': 'Admissions',
  'nav.leads': 'Leads & trials',
  'nav.people': 'People',
  'nav.students': 'Students',
  'nav.teachers': 'Teachers',
  'nav.teaching': 'Teaching',
  'nav.groups': 'Groups',
  'nav.schedule': 'Schedule',
  'nav.attendance': 'Attendance',
  'nav.assessments': 'Assessments',
  'nav.finance': 'Finance',
  'nav.payments': 'Payments',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
} as const

export type MessageKey = keyof typeof en

const MESSAGES: Partial<Record<Locale, Partial<Record<MessageKey, string>>>> = { en }

/** The interface language. Fixed to English until translations exist. */
export const currentLocale: Locale = 'en'

export function t(key: MessageKey, locale: Locale = currentLocale): string {
  return MESSAGES[locale]?.[key] ?? en[key]
}
