import { useState, type FormEvent } from 'react'
import { Pencil, Plus, ShieldAlert } from 'lucide-react'
import type { Role, User } from '../../types'
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

const STAFF_ROLES: Role[] = ['admin', 'reception', 'accountant']
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
    .sort((a, b) => ['owner', 'admin', 'reception', 'accountant', 'teacher'].indexOf(a.role) - ['owner', 'admin', 'reception', 'accountant', 'teacher'].indexOf(b.role) || a.fullName.localeCompare(b.fullName))

  return (
    <>
      <PageHeader
        title="Users and access"
        description="Who can sign in, at which branch, and what each role can open."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            Add staff account
          </Button>
        }
      />

      <div role="note" className="mb-6 flex gap-3 rounded-panel border border-warning-mark/40 bg-warning-soft px-4 py-3 text-sm text-ink">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
        <p>
          Demo sign-in: every staff account uses the demo password, and access is only checked in the browser. Real passwords, password resets and server-side
          permissions come with the database.
        </p>
      </div>

      <section aria-label="What each role can do" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(['admin', 'reception', 'accountant', 'teacher'] as Role[]).map((r) => (
          <div key={r} className="rounded-panel border border-line bg-surface px-4 py-3">
            <p className="font-medium text-ink">{roleLabel[r]}</p>
            <p className="mt-0.5 text-sm text-ink-muted">{roleDescription[r]}</p>
            {r !== 'teacher' && r !== 'admin' && <p className="mt-1 text-xs text-ink-faint">{ROLE_SECTIONS[r].length} sections</p>}
          </div>
        ))}
      </section>

      <section aria-label="Accounts" className="rounded-panel border border-line bg-surface">
        <div className="flex flex-wrap gap-3 border-b border-line p-4">
          <Select aria-label="Role" value={values.role} onChange={(e) => set('role', e.target.value)} className="w-44">
            <option value="">Every role</option>
            {(['owner', 'admin', 'reception', 'accountant', 'teacher'] as Role[]).map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </Select>
          <Select aria-label="Branch" value={values.branch} onChange={(e) => set('branch', e.target.value)} className="w-44">
            <option value="">Every branch</option>
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <p className="num ml-auto self-center text-sm text-ink-muted">{users.length} accounts</p>
        </div>
        <TableScroll>
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-canvas">
              <tr className="border-b border-line">
                <th scope="col" className={th}>Name</th>
                <th scope="col" className={th}>Username</th>
                <th scope="col" className={th}>Role</th>
                <th scope="col" className={th}>Branch</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={th}><span className="sr-only">Actions</span></th>
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
                    <td className={td}>{u.role === 'owner' ? 'All branches' : (branchName.get(branchOf(u) ?? '') ?? '—')}</td>
                    <td className={td}>{active ? <Badge tone="success">Can sign in</Badge> : <Badge>Turned off</Badge>}</td>
                    <td className={cn(td, 'text-right whitespace-nowrap')}>
                      {staff && (
                        <>
                          <IconButton label={`Edit ${u.fullName}`} onClick={() => setEditing(u)}>
                            <Pencil />
                          </IconButton>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              actions.setUserActive(u.id, !active)
                              toast.show(active ? `${u.fullName} can no longer sign in.` : `${u.fullName} can sign in again.`)
                            }}
                          >
                            {active ? 'Turn off' : 'Turn on'}
                          </Button>
                        </>
                      )}
                      {u.role === 'teacher' && <span className="text-xs text-ink-muted">Managed on the teacher’s record</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableScroll>
      </section>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add staff account' : 'Edit account'}>
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
    role: (user?.role ?? 'reception') as Role,
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
    if (form.fullName.trim().length < 3) e.fullName = 'Enter the full name.'
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) e.username = 'Use 3–30 lowercase letters, numbers, dots or dashes.'
    else if (data.users.some((u) => u.username === username && u.id !== user?.id)) e.username = 'That username is taken.'
    if (form.phone.trim() && !isValidPhone(form.phone)) e.phone = 'Enter a phone like +998 90 123 45 67.'
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    const input = { fullName: form.fullName.trim(), username, role: form.role, branchId: form.branchId, phone: form.phone.trim() ? formatPhone(form.phone) : undefined }
    if (user) actions.updateUser(user.id, input)
    else actions.addUser(input)
    toast.show(user ? 'Account saved.' : `Account created. ${input.fullName} signs in as “${username}”.`)
    onClose()
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName} className="sm:col-span-2">
        {(p) => <Input {...p} autoFocus value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />}
      </Field>
      <Field label="Username" error={errors.username} hint="Used to sign in.">
        {(p) => <Input {...p} value={form.username} autoCapitalize="none" spellCheck={false} onChange={(e) => set('username', e.target.value)} placeholder="e.g. reception.chilonzor2" />}
      </Field>
      <Field label="Phone" optional error={errors.phone}>
        {(p) => <Input {...p} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />}
      </Field>
      <Field label="Role" hint={roleDescription[form.role]}>
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
      <Field label="Branch">
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
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          {user ? 'Save' : 'Create account'}
        </Button>
      </div>
    </form>
  )
}
