import { useState, type FormEvent } from 'react'
import { Pencil, Plus, ShieldAlert } from 'lucide-react'
import { BRANCH_STAFF_ROLES, branchSeatHolder, type Role, type User } from '../../types'
import { useSchool } from '../../data/school-context'
import { useListParams } from '../../hooks/useListParams'
import { useToast } from '../../components/ui/toast-context'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button, IconButton } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import { TableScroll, td, th } from '../../components/ui/misc'
import { roleLabel } from '../../lib/auth'
import { roleDescription, ROLE_SECTIONS } from '../../app/permissions'
import { formatPhone, isValidPhone } from '../../lib/format'
import { cn } from '../../lib/cn'
import { tr } from '../../i18n'

const STAFF_ROLES: readonly Role[] = BRANCH_STAFF_ROLES
const ROLE_ORDER: Role[] = ['owner', 'admin', 'accountant', 'teacher']
const FILTERS = ['role', 'branch'] as const

/**
 * Everyone who can sign in: create front-office accounts, move them between
 * branches, and turn accounts off (they can't sign in, but their history stays).
 * Teacher accounts come with their teacher record.
 */
export function OwnerUsersPage() {
  const { owner, actions } = useSchool()
  const toast = useToast()
  const { values, set } = useListParams(FILTERS)
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const data = owner!.data
  const branchName = new Map(data.branches.map((b) => [b.id, b.name]))
  const teacherBranch = new Map(data.teachers.map((t) => [t.id, t.branchId]))
  const branchOf = (u: User) => (u.role === 'teacher' ? teacherBranch.get(u.teacherId ?? '') : u.branchId) ?? null
  const users = data.users
    .filter((u) => (!values.role || u.role === values.role) && (!values.branch || branchOf(u) === values.branch))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.fullName.localeCompare(b.fullName))

  return (
    <>
      <PageHeader
        title={tr("Users and access")}
        description={tr("Who can sign in, at which branch, and what each role can open.")}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            {tr("Add staff account")}
          </Button>
        }
      />

      <div role="note" className="mb-6 flex gap-3 rounded-panel border border-warning-mark/40 bg-warning-soft px-4 py-3 text-sm text-ink">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>
          {tr("Demo sign-in: every staff account uses the demo password, and access is only checked in the browser. Real passwords, password resets and server-side permissions come with the database.")}
        </p>
      </div>

      <section aria-label={tr("What each role can do")} className="mb-6 grid gap-3 sm:grid-cols-3">
        {(['admin', 'accountant', 'teacher'] as Role[]).map((r) => (
          <div key={r} className="rounded-panel border border-line bg-surface px-4 py-3">
            <p className="font-medium text-ink">{roleLabel[r]}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{roleDescription[r]}</p>
            {r !== 'teacher' && r !== 'admin' && <p className="mt-1 text-xs text-ink-faint">{ROLE_SECTIONS[r].length}{' '}{tr("sections")}</p>}
          </div>
        ))}
      </section>

      <section aria-label={tr("Accounts")} className="rounded-panel border border-line bg-surface">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <Select aria-label={tr("Role")} value={values.role} onChange={(e) => set('role', e.target.value)} className="w-44">
            <option value="">{tr("Every role")}</option>
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </Select>
          <Select aria-label={tr("Branch")} value={values.branch} onChange={(e) => set('branch', e.target.value)} className="w-44">
            <option value="">{tr("Every branch")}</option>
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <p className="num ml-auto self-center text-sm text-ink-muted">{users.length}{' '}{tr("accounts")}</p>
        </div>
        <TableScroll>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-canvas">
              <tr className="border-b border-line">
                <th scope="col" className={th}>{tr("Name")}</th>
                <th scope="col" className={th}>{tr("Username")}</th>
                <th scope="col" className={th}>{tr("Role")}</th>
                <th scope="col" className={th}>{tr("Branch")}</th>
                <th scope="col" className={th}>{tr("Status")}</th>
                <th scope="col" className={th}><span className="sr-only">{tr("Actions")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => {
                const active = u.active !== false
                const staff = STAFF_ROLES.includes(u.role)
                return (
                  <tr key={u.id} className={cn(!active && 'text-ink-faint')}>
                    <td className={cn(td, 'font-medium', active ? 'text-ink' : 'text-ink-faint')}>{u.fullName}</td>
                    <td className={cn(td, 'font-mono text-xs')}>{u.username}</td>
                    <td className={td}>{roleLabel[u.role]}</td>
                    <td className={td}>{u.role === 'owner' ? tr("All branches") : (branchName.get(branchOf(u) ?? '') ?? '—')}</td>
                    <td className={td}>{active ? <Badge tone="success">{tr("Can sign in")}</Badge> : <Badge>{tr("Turned off")}</Badge>}</td>
                    <td className={cn(td, 'text-right whitespace-nowrap')}>
                      {staff && (
                        <>
                          <IconButton label={tr("Edit {0}", u.fullName)} onClick={() => setEditing(u)}>
                            <Pencil />
                          </IconButton>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const holder = active ? undefined : branchSeatHolder(data.users, u.role, u.branchId, u.id)
                              if (holder) {
                                toast.show(tr("{0} already has an active {1}: {2}. Turn that account off first.", branchName.get(u.branchId ?? '') ?? '', roleLabel[u.role].toLowerCase(), holder.fullName))
                                return
                              }
                              actions.setUserActive(u.id, !active)
                              toast.show(active ? tr("{0} can no longer sign in.", u.fullName) : tr("{0} can sign in again.", u.fullName))
                            }}
                          >
                            {active ? tr("Turn off") : tr("Turn on")}
                          </Button>
                        </>
                      )}
                      {u.role === 'teacher' && <span className="text-xs text-ink-muted">{tr("Managed on the teacher’s record")}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroll>
      </section>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? tr("Add staff account") : tr("Edit account")}>
        {editing !== null && <UserForm user={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      </Dialog>
    </>
  )
}

function UserForm({ user, onClose }: { user?: User; onClose: () => void }) {
  const { owner, actions } = useSchool()
  const toast = useToast()
  const data = owner!.data
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    username: user?.username ?? '',
    role: (user?.role ?? 'admin') as Role,
    branchId: user?.branchId ?? data.branches[0]?.id ?? '',
    phone: user?.phone ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => ({ ...e, [k]: '' }))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const e: Record<string, string> = {}
    const username = form.username.trim().toLowerCase()
    if (form.fullName.trim().length < 3) e.fullName = tr("Enter the full name.")
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) e.username = tr("Use 3–30 lowercase letters, numbers, dots or dashes.")
    else if (data.users.some((u) => u.username === username && u.id !== user?.id)) e.username = tr("That username is taken.")
    if (form.phone.trim() && !isValidPhone(form.phone)) e.phone = tr("Enter a phone like +998 90 123 45 67.")
    const holder = user?.active === false ? undefined : branchSeatHolder(data.users, form.role, form.branchId, user?.id)
    if (holder) e.branchId = tr("This branch already has an active {0}: {1}. Turn that account off first.", roleLabel[form.role].toLowerCase(), holder.fullName)
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    const input = { fullName: form.fullName.trim(), username, role: form.role, branchId: form.branchId, phone: form.phone.trim() ? formatPhone(form.phone) : undefined }
    if (user) actions.updateUser(user.id, input)
    else actions.addUser(input)
    toast.show(user ? tr("Account saved.") : tr("Account created. {0} signs in as “{1}”.", input.fullName, username))
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label={tr("Full name")} error={errors.fullName} className="sm:col-span-2">
        {(p) => <Input {...p} autoFocus value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />}
      </Field>
      <Field label={tr("Username")} error={errors.username} hint={tr("Used to sign in.")}>
        {(p) => <Input {...p} value={form.username} autoCapitalize="none" spellCheck={false} onChange={(e) => set('username', e.target.value)} placeholder={tr("e.g. admin.chilonzor2")} />}
      </Field>
      <Field label={tr("Phone")} optional error={errors.phone}>
        {(p) => <Input {...p} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}
      </Field>
      <Field label={tr("Role")} hint={roleDescription[form.role]}>
        {(p) => (
          <Select {...p} value={form.role} onChange={(e) => set('role', e.target.value)}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={tr("Branch")} error={errors.branchId} hint={tr("Each branch has one administrator and one accountant.")}>
        {(p) => (
          <Select {...p} value={form.branchId} onChange={(e) => set('branchId', e.target.value)}>
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4 sm:col-span-2">
        <Button onClick={onClose}>{tr("Cancel")}</Button>
        <Button type="submit" variant="primary">
          {user ? tr("Save") : tr("Create account")}
        </Button>
      </div>
    </form>
  )
}
