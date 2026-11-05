// Interface languages: English (the source text), Uzbek and Russian.
// Write interface text in English inside tr('...'); the Uzbek and Russian
// catalogs (uz.ts, ru.ts) map that English text to a translation. Missing
// entries fall back to English, so new screens work before they're translated.
// To find untranslated text: run `npm run i18n:check` (lists missing keys).

import { uz } from './uz'
import { ru } from './ru'

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
  'nav.expenses': 'Expenses',
  'nav.salaries': 'Teacher salaries',
  'nav.staffAttendance': 'Staff attendance',
  'nav.activity': 'Activity log',
  'nav.office': 'Office',
  'nav.users': 'Users & access',
  'nav.settings': 'Settings',
  'nav.organisation': 'Organisation',
  'nav.ownerOverview': 'Overview',
  'nav.branches': 'Branches',
  'nav.teacherRating': 'Teachers & rating',
  'nav.branchWork': 'Branch work',
  'nav.ownerSettings': 'Owner settings',
} as const

export type MessageKey = keyof typeof en

const STORAGE_KEY = 'sherov-school:locale'

export const localeName: Record<Locale, string> = { en: 'English', uz: 'O‘zbekcha', ru: 'Русский' }

function readLocale(): Locale {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale
  } catch {
    // Storage blocked: fall back to English.
  }
  return 'en'
}

/** The interface language, chosen once per page load (changing it reloads the page). */
export const currentLocale: Locale = readLocale()
if (typeof document !== 'undefined') document.documentElement.lang = currentLocale

/** Switch language. Reloads so every screen, including text worked out at start-up, follows. */
export function setLocale(locale: Locale): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale)
  } catch {
    // Not saved; still switch for this visit.
  }
  window.location.reload()
}

// Developer aid: with localStorage 'sherov-school:i18n-debug' = '1', every
// translatable text is shown in ⟦brackets⟧, so untranslated text stands out.
const DEBUG = (() => {
  try {
    return globalThis.localStorage?.getItem('sherov-school:i18n-debug') === '1'
  } catch {
    return false
  }
})()

const CATALOGS: Record<Locale, Readonly<Record<string, string>> | null> = { en: null, uz, ru }

/**
 * Translate interface text. The English text itself is the key, so English
 * needs no catalog and a missing translation simply shows English.
 * Placeholders {0}, {1}… are filled from the extra arguments:
 * tr('{0} students', 12).
 */
export function tr(text: string, ...args: unknown[]): string {
  let out = CATALOGS[currentLocale]?.[text] || text
  if (DEBUG) out = `⟦${out}⟧`
  return args.length ? out.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? '')) : out
}

// Count words: English one/many, Russian one/few/many, Uzbek always singular.
const WORDS: Record<string, { uz: string; ru: [string, string, string] }> = {
  class: { uz: 'dars', ru: ['занятие', 'занятия', 'занятий'] },
  lesson: { uz: 'dars', ru: ['урок', 'урока', 'уроков'] },
  note: { uz: 'izoh', ru: ['заметка', 'заметки', 'заметок'] },
  day: { uz: 'kun', ru: ['день', 'дня', 'дней'] },
  group: { uz: 'guruh', ru: ['группа', 'группы', 'групп'] },
  'running group': { uz: 'faol guruh', ru: ['действующая группа', 'действующие группы', 'действующих групп'] },
  assignment: { uz: 'topshiriq', ru: ['задание', 'задания', 'заданий'] },
  student: { uz: 'o‘quvchi', ru: ['ученик', 'ученика', 'учеников'] },
  enquiry: { uz: 'murojaat', ru: ['заявка', 'заявки', 'заявок'] },
  'trial result': { uz: 'sinov natijasi', ru: ['результат пробного', 'результата пробного', 'результатов пробного'] },
}
const ruRule = new Intl.PluralRules('ru-RU')

/** The word for a count, e.g. plural(3, 'student', 'students') → 'students' / 'учеников' / 'o‘quvchi'. */
export function plural(n: number, one: string, many: string): string {
  const w = WORDS[one]
  if (currentLocale === 'uz' && w) return w.uz
  if (currentLocale === 'ru' && w) {
    const cat = ruRule.select(n)
    return w.ru[cat === 'one' ? 0 : cat === 'few' ? 1 : 2]
  }
  return n === 1 ? one : many
}

/** Navigation labels by key (kept for the sidebar). */
export function t(key: MessageKey): string {
  return tr(en[key])
}
