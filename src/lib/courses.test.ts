import { describe, expect, it } from 'vitest'
import type { SchoolData } from '../types'
import { createDemoData, DATA_VERSION } from '../data/seed'
import { migrate } from '../data/migrate'
import { validateSchoolData } from '../data/storage'
import { checkCourse, groupPath, levelOf, structureCourses, withGroupLabels } from './courses'

const NOW = new Date('2026-11-05T10:00:00+05:00')
const data = createDemoData(NOW)

describe('Course → Level → Group', () => {
  it('places every demo group in a real course and level', () => {
    expect(validateSchoolData(data)).toBeNull()
    for (const g of data.groups) {
      const { course, level } = levelOf(data.courses, g)
      expect(course, g.name).toBeDefined()
      expect(level, g.name).toBeDefined()
      expect(g.subject).toBe(course!.name)
      expect(g.level).toBe(level!.name)
    }
  })

  it('shows the full path', () => {
    const g = data.groups[0]
    expect(groupPath(data.courses, g)).toBe(`${g.subject} → ${g.level} → ${g.name}`)
  })

  it('upgrades version 9 data (levels as text, groups linked by name)', () => {
    const v9 = JSON.parse(JSON.stringify(data)) as Record<string, unknown> & SchoolData
    v9.version = 9
    ;(v9 as unknown as { courses: unknown[] }).courses = data.courses.map((c) => ({ ...c, levels: c.levels.map((l) => l.name) }))
    v9.groups = data.groups.map(({ courseId: _c, levelId: _l, ...g }) => g) as unknown as SchoolData['groups']
    // A group whose level isn't on its course's list, and one with no level at all.
    v9.groups[0] = { ...v9.groups[0], level: 'Night owls' }
    v9.groups[1] = { ...v9.groups[1], level: undefined }
    const up = migrate(v9, DATA_VERSION, NOW) as unknown as SchoolData
    expect(validateSchoolData(up)).toBeNull()
    expect(up.groups).toHaveLength(data.groups.length)
    expect(levelOf(up.courses, up.groups[0]).level?.name).toBe('Night owls')
    expect(levelOf(up.courses, up.groups[1]).level?.name).toBe('General')
    expect(levelOf(up.courses, up.groups[2]).level?.id).toBe(data.groups[2].levelId)
  })

  it('is safe to run twice', () => {
    const again = structureCourses(data)
    expect(again.courses).toEqual(data.courses)
    expect(again.groups).toEqual(data.groups)
  })

  it('renaming a course or level renames it on its groups', () => {
    const g = data.groups[0]
    const courses = data.courses.map((c) =>
      c.id === g.courseId ? { ...c, name: 'General English', levels: c.levels.map((l) => (l.id === g.levelId ? { ...l, name: 'INT' } : l)) } : c,
    )
    const renamed = withGroupLabels(data.groups, courses).find((x) => x.id === g.id)!
    expect(renamed.subject).toBe('General English')
    expect(renamed.level).toBe('INT')
    expect(renamed.levelId).toBe(g.levelId)
  })

  it('checks course names and levels', () => {
    const [a, b] = data.courses
    expect(checkCourse(data.courses, a.id, b.name, a.levels)).toMatch(/already/)
    expect(checkCourse(data.courses, a.id, a.name, [...a.levels, { ...a.levels[0], id: 'x' }])).toMatch(/same name/)
    expect(checkCourse(data.courses, a.id, 'IELTS', [{ id: 'l1', name: 'Band 6.5', active: true }])).toBeNull()
  })

  it('rejects a group linked to a missing level', () => {
    const broken = { ...data, groups: data.groups.map((g, i) => (i === 0 ? { ...g, levelId: 'nope' } : g)) }
    expect(validateSchoolData(broken)).toMatch(/not linked/)
  })
})
