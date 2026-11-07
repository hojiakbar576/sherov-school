import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { GraduationCap, Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { ExportButtons } from '../../components/ui/ExportButtons'
import { toISODate } from '../../lib/dates'
import type { Teacher } from '../../types'
import { useSchool } from '../../data/school-context'
import { useBranchChoice } from '../../hooks/useBranchChoice'
import { useListParams } from '../../hooks/useListParams'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { ConfirmDialog, Dialog } from '../../components/ui/Dialog'
import { Avatar, EmptyState, SearchInput } from '../../components/ui/misc'
import { TeacherStatusBadge } from '../../components/StatusBadges'
import { dayPatternShort, teacherStatusLabel } from '../../lib/format'
import { enrolmentByGroup } from '../../lib/metrics'
import { TeacherFormDialog } from './TeacherFormDialog'
import { plural, tr } from '../../i18n'

const FILTERS = ['q', 'subject', 'status'] as const

export function TeachersPage() {
  const { data, actions, user, now } = useSchool()
  // Only the owner adds, edits or removes teachers; administrators can look.
  const isOwner = user?.role === 'owner'
  const needsBranch = useBranchChoice()
  const toast = useToast()
  const { values, set, clear, active } = useListParams(FILTERS)
  const [editing, setEditing] = useState<Teacher | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Teacher | null>(null)

  const enrolment = useMemo(() => enrolmentByGroup(data), [data])
  const groupsByTeacher = useMemo(() => {
    const map = new Map<string, typeof data.groups>()
    for (const g of data.groups) map.set(g.teacherId, [...(map.get(g.teacherId) ?? []), g])
    return map
  }, [data.groups])

  const filtered = data.teachers
    .filter((t) => {
      const q = values.q.trim().toLowerCase()
      if (q && !t.fullName.toLowerCase().includes(q) && !t.email.toLowerCase().includes(q)) return false
      if (values.subject && t.subject !== values.subject) return false
      if (values.status && t.status !== values.status) return false
      return true
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName))

  const deletingGroups = deleting ? (groupsByTeacher.get(deleting.id) ?? []) : []

  return (
    <>
      <PageHeader
        title={tr("Teachers")}
        description={tr("{0} teachers, {1} currently teaching.", data.teachers.length, data.teachers.filter((t) => t.status === 'active').length)}
        actions={
          <>
            <ExportButtons
              name="teachers"
              date={toISODate(now)}
              rows={() => [
                [tr("Teacher"), tr("Course"), tr("Phone"), tr("Email"), tr("Status"), tr("Running groups"), tr("Active students"), tr("Pay share %"), tr("Joined")],
                ...filtered.map((t) => {
                  const groups = (groupsByTeacher.get(t.id) ?? []).filter((g) => g.status === 'active')
                  return [t.fullName, t.subject, t.phone, t.email, teacherStatusLabel[t.status], groups.map((g) => g.name).join('; '), groups.reduce((sum, g) => sum + (enrolment.get(g.id) ?? 0), 0), t.salaryPercent, t.joinedOn]
                }),
              ]}
            />
            {isOwner && (
              <Button variant="primary" onClick={() => setEditing('new')} disabled={Boolean(needsBranch)} title={needsBranch ?? undefined}>
                <Plus aria-hidden />
                {tr("Add teacher")}
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput label={tr("Search teachers")} value={values.q} onChange={(v) => set('q', v)} placeholder={tr("Name or email")} />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select aria-label={tr("Filter by subject")} value={values.subject} onChange={(e) => set('subject', e.target.value)} className="sm:w-48">
            <option value="">{tr("All subjects")}</option>
            {data.courses.map((c) => c.name).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select aria-label={tr("Filter by status")} value={values.status} onChange={(e) => set('status', e.target.value)} className="sm:w-36">
            <option value="">{tr("All statuses")}</option>
            {Object.entries(teacherStatusLabel).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {active && (
          <Button variant="ghost" size="sm" onClick={clear}>
            {tr("Clear filters")}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon={GraduationCap} title={tr("No teachers match")} action={<Button onClick={clear}>{tr("Clear filters")}</Button>}>
            {tr("Try another name or subject.")}
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((t) => {
            const groups = (groupsByTeacher.get(t.id) ?? []).filter((g) => g.status === 'active')
            const students = groups.reduce((sum, g) => sum + (enrolment.get(g.id) ?? 0), 0)
            return (
              <li key={t.id} className="flex flex-col rounded-panel border border-line bg-surface">
                <div className="flex items-start gap-3 p-5 pb-4">
                  <Avatar name={t.fullName} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-ink">
                      <Link to={`/teachers/${t.id}`} className="hover:text-brand hover:underline">
                        {t.fullName}
                      </Link>
                    </h2>
                    <p className="text-sm text-ink-muted">{t.subject}</p>
                  </div>
                  <TeacherStatusBadge status={t.status} />
                </div>
                <dl className="space-y-1.5 px-5 text-sm">
                  <div className="flex items-center gap-2 text-ink-muted">
                    <dt>
                      <Phone aria-label={tr("Phone")} className="size-4 text-ink-faint" />
                    </dt>
                    <dd>
                      <a href={`tel:${t.phone.replace(/\s/g, '')}`} className="num hover:text-brand hover:underline">
                        {t.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="flex items-center gap-2 text-ink-muted">
                    <dt>
                      <Mail aria-label={tr("Email")} className="size-4 text-ink-faint" />
                    </dt>
                    <dd className="min-w-0 truncate">
                      <a href={`mailto:${t.email}`} className="hover:text-brand hover:underline">
                        {t.email}
                      </a>
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex-1 border-t border-line px-5 py-3">
                  <p className="mb-1.5 text-xs font-medium text-ink-muted">
                    {groups.length ? tr("{0} {1}, {2} students", groups.length, plural(groups.length, 'group', 'groups'), students) : tr("No running groups")}
                  </p>
                  <ul className="space-y-1 text-sm">
                    {groups.map((g) => (
                      <li key={g.id} className="flex justify-between gap-3">
                        <span className="truncate text-ink">{g.name}</span>
                        <span className="num shrink-0 text-ink-muted">
                          {dayPatternShort[g.days]}, {g.startTime}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {isOwner && (
                  <div className="flex justify-end gap-1 border-t border-line px-3 py-2">
                    <IconButton label={tr("Edit {0}", t.fullName)} onClick={() => setEditing(t)}>
                      <Pencil />
                    </IconButton>
                    <IconButton label={tr("Delete {0}", t.fullName)} onClick={() => setDeleting(t)} className="hover:bg-danger-soft hover:text-danger">
                      <Trash2 />
                    </IconButton>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <TeacherFormDialog open={editing !== null} teacher={editing === 'new' || editing === null ? undefined : editing} onClose={() => setEditing(null)} />

      {/* A teacher with groups can't be deleted; explain instead of failing silently. */}
      <Dialog
        open={deleting !== null && deletingGroups.length > 0}
        onClose={() => setDeleting(null)}
        title={tr("Reassign groups first")}
        size="sm"
        footer={<Button onClick={() => setDeleting(null)}>{tr("OK")}</Button>}
      >
        <p className="text-sm text-ink-muted">
          {deleting?.fullName}{' '}{tr("still teaches")}{' '}{deletingGroups.map((g) => g.name).join(', ')}{tr(". Give these groups another teacher on the Groups page, then try again. To keep their record, set their status to “On leave” instead.")}
        </p>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null && deletingGroups.length === 0}
        title={tr("Delete teacher?")}
        confirmLabel={tr("Delete teacher")}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting && actions.deleteTeacher(deleting.id)) toast.show(tr("{0} was deleted.", deleting.fullName))
        }}
      >
        <p>{deleting?.fullName}{' '}{tr("will be removed from the demo data. They have no groups.")}</p>
      </ConfirmDialog>
    </>
  )
}
