import { useState, useMemo, useEffect } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { UserCog, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { addDocument, removeStoredFile, uploadFile } from '../../lib/db'
import {
  createAccount,
  deleteAccount,
  getAccountOfficialIds,
  updateAccount
} from '../../lib/accounts'
import { useFileUrl } from '../../hooks/useFileUrl'
import { useAuthStore } from '../../store/authStore'
import { Layout, PageContainer } from '../../components/layout/Layout'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, Column } from '../../components/ui/DataTable'
import { useColumnVisibility, ColumnsMenuButton } from '../../components/ui/ColumnsMenu'
import { TableToolbar } from '../../components/ui/TableToolbar'
import { RowActions } from '../../components/ui/RowActions'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { Spinner } from '../../components/ui/Spinner'
import type { Account } from '../../types'
import { getFullName, toInputDate, sortByField } from '../../lib/utils'
import { FULL_ACCESS_ROLES, ROLES, canManageRole, normalizePrivileges } from '../../lib/permissions'
import { Allowed } from '../../components/ui/Allowed'
import { PrivilegeMatrix } from './PrivilegeMatrix'
import { useOfficials } from '../../lib/officials'
import { officialName } from '../../lib/orgChart'
import { useTerms } from '../../lib/terms'

const ROLE_BADGES: Record<string, 'purple' | 'red' | 'blue' | 'yellow'> = {
  Developer: 'purple',
  Admin: 'red',
  Secretary: 'blue',
  Pending: 'yellow'
}
const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' }
]

type AccountForm = {
  username: string
  password: string
  email: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  role: string
  officialIds: string[]
  contactNumber: string
  birthday: string
  gender: string
  address: string
}

const columns: Column<Account>[] = [
  { key: 'username', header: 'Username', width: 'w-36' },
  { key: 'email', header: 'Email', width: 'w-48' },
  { key: 'firstName', header: 'First Name', width: 'w-28' },
  { key: 'middleName', header: 'Middle Name', width: 'w-28' },
  { key: 'lastName', header: 'Last Name', width: 'w-28' },
  {
    key: 'role',
    header: 'Role',
    width: 'w-24',
    render: (r) => <Badge variant={ROLE_BADGES[r.role] ?? 'gray'}>{r.role}</Badge>
  },
  { key: 'contactNumber', header: 'Contact No.', width: 'w-32' },
  { key: 'address', header: 'Address' }
]

function AccountFormModal({
  open,
  onClose,
  onSuccess,
  logActivity,
  record
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  logActivity: (a: string) => Promise<void>
  record?: Account
}) {
  const isEdit = !!record
  const callerRole = useAuthStore((s) => s.user?.role ?? '')
  const { officials } = useOfficials(open)
  const { terms } = useTerms()
  const [saving, setSaving] = useState(false)
  const [officialLinksLoading, setOfficialLinksLoading] = useState(false)
  const [officialLinksError, setOfficialLinksError] = useState('')
  const [officialSearch, setOfficialSearch] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [privileges, setPrivileges] = useState<string[]>([])
  const [form, setForm] = useState<AccountForm>({
    username: '',
    password: '',
    email: '',
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    role: 'Staff',
    officialIds: [],
    contactNumber: '',
    birthday: '',
    gender: 'Male',
    address: ''
  })

  useEffect(() => {
    if (open) {
      if (record) {
        setForm({
          username: record.username ?? '',
          password: '',
          email: record.email ?? '',
          firstName: record.firstName ?? '',
          middleName: record.middleName ?? '',
          lastName: record.lastName ?? '',
          suffix: record.suffix ?? '',
          role: record.role ?? 'Staff',
          officialIds: record.officialIds ?? (record.officialId ? [record.officialId] : []),
          contactNumber: record.contactNumber ?? '',
          birthday: toInputDate(record.birthday),
          gender: record.gender ?? 'Male',
          address: record.address ?? ''
        })
        setPrivileges(normalizePrivileges(record.privileges ?? []))
      } else {
        setForm({
          username: '',
          password: '',
          email: '',
          firstName: '',
          middleName: '',
          lastName: '',
          suffix: '',
          role: 'Staff',
          officialIds: [],
          contactNumber: '',
          birthday: '',
          gender: 'Male',
          address: ''
        })
        setPrivileges([])
      }
      setFile(null)
      setOfficialLinksError('')
      setOfficialSearch('')
      if (record) {
        setOfficialLinksLoading(true)
        void getAccountOfficialIds(record.id)
          .then((officialIds) => {
            setForm((current) => ({ ...current, officialIds }))
          })
          .catch((error: unknown) => {
            setOfficialLinksError(
              error instanceof Error ? error.message : 'Could not load linked officials.'
            )
          })
          .finally(() => setOfficialLinksLoading(false))
      } else {
        setOfficialLinksLoading(false)
      }
    }
  }, [open, record])

  const storedPhotoUrl = useFileUrl(record?.filePath)
  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file)
    return storedPhotoUrl
  }, [file, storedPhotoUrl])

  useEffect(() => {
    return () => {
      if (file && previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [file, previewUrl])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  const toggleOfficial = (officialId: string) =>
    setForm((current) => ({
      ...current,
      officialIds: current.officialIds.includes(officialId)
        ? current.officialIds.filter((id) => id !== officialId)
        : [...current.officialIds, officialId]
    }))
  const termNameById = new Map(terms.map((term) => [term.id, term.name || 'Unnamed term']))
  const normalizedOfficialSearch = officialSearch.trim().toLocaleLowerCase()
  const filteredOfficials = normalizedOfficialSearch
    ? officials.filter((official) => {
        const termName = official.termId
          ? (termNameById.get(official.termId) ?? 'Unknown term')
          : 'No term'
        return `${officialName(official)} ${official.position} ${termName}`
          .toLocaleLowerCase()
          .includes(normalizedOfficialSearch)
      })
    : officials
  // Only roles this account may give (a Developer makes Developers; Admins and up make Admins)
  const roleOptions = ROLES.filter(
    (r) => canManageRole(callerRole, r.value) || r.value === form.role
  )
  const fullAccess = FULL_ACCESS_ROLES.includes(form.role)
  const viewOnly = form.role === 'View Only'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.username.trim() || !form.email.trim() || (!isEdit && !form.password.trim())) {
      toast.error('Username, email, and password are required')
      return
    }
    setSaving(true)
    let uploadedPath = ''
    try {
      const previousPath = record?.filePath ?? ''
      if (file) uploadedPath = await uploadFile('Users', form.username, file)
      const { username, password, email, ...details } = form
      // Developers and Admins need none; View Only keeps just the View ticks
      const saved = fullAccess
        ? []
        : viewOnly
          ? privileges.filter((p) => p.endsWith(':view'))
          : privileges
      const profile = { ...details, privileges: saved, filePath: uploadedPath || previousPath }
      if (isEdit) {
        await updateAccount(record!.id, username.trim(), password, email.trim(), profile)
      } else {
        await createAccount(username.trim(), password, email.trim(), profile)
      }
      uploadedPath = ''
      if (file && previousPath) {
        try {
          await removeStoredFile(previousPath)
        } catch (cleanupError) {
          const reason =
            cleanupError instanceof Error ? cleanupError.message : 'unknown storage error'
          throw new Error(`Account saved, but the previous photo could not be removed: ${reason}`)
        }
      }
      await logActivity(`${isEdit ? 'Updated' : 'Created'} Account ${form.username}`)
      toast.success(isEdit ? 'Account updated' : 'Account created')
      onSuccess()
    } catch (err) {
      // the account wasn't saved, so drop the photo uploaded for it
      let message = err instanceof Error ? err.message : 'Failed to save'
      if (uploadedPath) {
        try {
          await removeStoredFile(uploadedPath)
        } catch (cleanupError) {
          const reason =
            cleanupError instanceof Error ? cleanupError.message : 'unknown storage error'
          message = `${message}. Uploaded-photo cleanup also failed: ${reason}`
        }
      }
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Account' : 'Create Account'}
      size="2xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={saving || officialLinksLoading || !!officialLinksError}
          >
            {saving ? (
              <>
                <Spinner size="sm" className="text-white" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4">
        <FormField label="Username" required>
          <Input value={form.username} onChange={set('username')} />
        </FormField>
        <FormField
          label={isEdit ? 'New Password (leave blank to keep)' : 'Password'}
          required={!isEdit}
        >
          <Input type="password" value={form.password} onChange={set('password')} />
        </FormField>
        <FormField label="Email" required className="col-span-2">
          <Input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="Email address used to sign in"
            required
          />
        </FormField>
        <FormField label="First Name" required>
          <Input value={form.firstName} onChange={set('firstName')} />
        </FormField>
        <FormField label="Middle Name">
          <Input value={form.middleName} onChange={set('middleName')} />
        </FormField>
        <FormField label="Last Name" required>
          <Input value={form.lastName} onChange={set('lastName')} />
        </FormField>
        <FormField label="Suffix">
          <Input value={form.suffix} onChange={set('suffix')} placeholder="Jr., Sr., III" />
        </FormField>
        <FormField label="Role">
          <Select options={roleOptions} value={form.role} onChange={set('role')} />
        </FormField>
        <FormField label="Linked Officials (select all terms)">
          <Input
            type="search"
            value={officialSearch}
            onChange={(event) => setOfficialSearch(event.target.value)}
            placeholder="Search by name, position, or term"
            aria-label="Search linked Officials"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {officials.length === 0 ? (
              <p className="px-2 py-1 text-sm text-slate-500">No Officials found.</p>
            ) : filteredOfficials.length === 0 ? (
              <p className="px-2 py-1 text-sm text-slate-500">No Officials match that search.</p>
            ) : (
              filteredOfficials.map((official) => {
                const termName = official.termId
                  ? (termNameById.get(official.termId) ?? 'Unknown term')
                  : 'No term'
                return (
                  <label
                    key={official.id}
                    className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.officialIds.includes(official.id)}
                      onChange={() => toggleOfficial(official.id)}
                      className="mt-0.5"
                    />
                    <span>
                      {officialName(official)} — {official.position} ({termName})
                    </span>
                  </label>
                )
              })
            )}
          </div>
          {officialLinksLoading && (
            <p className="text-xs text-slate-500">Loading linked Officials...</p>
          )}
          {officialLinksError && <p className="text-xs text-red-600">{officialLinksError}</p>}
        </FormField>
        <FormField label="Contact Number">
          <Input value={form.contactNumber} onChange={set('contactNumber')} />
        </FormField>
        <FormField label="Birthday">
          <Input type="date" value={form.birthday} onChange={set('birthday')} />
        </FormField>
        <FormField label="Gender">
          <Select options={GENDERS} value={form.gender} onChange={set('gender')} />
        </FormField>
        <FormField label="Address" className="col-span-2">
          <Input value={form.address} onChange={set('address')} />
        </FormField>
        <div className="col-span-2">
          <FormField label="Profile Picture">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCog size={28} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <FileUploadField value={file} onChange={setFile} accept="image/*" />
              </div>
            </div>
          </FormField>
        </div>
        <div className="col-span-2 border-t border-slate-100 pt-4">
          <p className="label mb-3">Privileges</p>
          {fullAccess ? (
            <p className="text-sm text-slate-500">
              {form.role}s can do everything, so they need no privileges.
            </p>
          ) : (
            <>
              {viewOnly && (
                <p className="text-xs text-slate-500 mb-2">
                  View Only accounts can only view — Add, Edit and Delete stay off.
                </p>
              )}
              <PrivilegeMatrix value={privileges} onChange={setPrivileges} viewOnly={viewOnly} />
            </>
          )}
        </div>
      </form>
    </Modal>
  )
}

export function AccountsPage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'users',
      sortParam: 'username|desc',
      dataKey: 'accounts',
      searchQuery: debouncedSearch
    })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'account-management')

  const [selected, setSelected] = useState<Account | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const filtered = useMemo(() => {
    const base = items as unknown as Account[]
    const q = debouncedSearch.toLowerCase()
    const result = !debouncedSearch.trim()
      ? base
      : base.filter(
          (r) =>
            r.username?.toLowerCase().includes(q) ||
            r.email?.toLowerCase().includes(q) ||
            r.firstName?.toLowerCase().includes(q) ||
            r.lastName?.toLowerCase().includes(q)
        )
    return sortByField(
      result as unknown as Record<string, unknown>[],
      sortField,
      sortDirection
    ) as unknown as Account[]
  }, [items, debouncedSearch, sortField, sortDirection])

  async function logActivity(activity: string) {
    if (!user) return
    const name = getFullName(user.firstName, user.middleName, user.lastName)
    const date =
      new Date().toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) +
      ' ' +
      new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
    await addDocument('activity_logs', { name, activity, date, year: new Date().getFullYear() })
  }

  async function handleDelete() {
    if (!selected) return
    setDeleting(true)
    try {
      await deleteAccount(selected.id)
      await logActivity(`Deleted Account ${selected.username}`)
      toast.success('Deleted')
      setShowDelete(false)
      setSelected(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="Account Management"
          subtitle="User accounts, roles and privileges"
          icon={<UserCog size={20} />}
          actions={
            <>
              <button className="btn-ghost" onClick={reload}>
                <RefreshCw size={15} />
                Refresh
              </button>
              <Allowed action="add">
                <button className="btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Create Account
                </button>
              </Allowed>
            </>
          }
        />
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, username or email…"
          count={filtered.length}
          hasMore={hasMore}
          columnsSlot={<ColumnsMenuButton columns={columns} hidden={hidden} onToggle={toggle} />}
        />
        <div className="card flex flex-col flex-1 min-h-0">
          <DataTable
            columns={visibleColumns}
            data={filtered}
            selectedId={selected?.id}
            onRowClick={setSelected}
            rowActions={(r) => {
              // Developer accounts are for Developers to change; Admin accounts for Admins and up
              const manageable = canManageRole(user?.role ?? '', r.role)
              return (
                <RowActions
                  onEdit={
                    manageable
                      ? () => {
                          setSelected(r)
                          setShowEdit(true)
                        }
                      : undefined
                  }
                  onDelete={
                    manageable && r.id !== user?.id
                      ? () => {
                          setSelected(r)
                          setShowDelete(true)
                        }
                      : undefined
                  }
                />
              )
            }}
            loading={loading}
            emptyMessage="No accounts found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
        <AccountFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <AccountFormModal
            open={showEdit}
            onClose={() => setShowEdit(false)}
            onSuccess={() => {
              setShowEdit(false)
              reload()
            }}
            logActivity={logActivity}
            record={selected}
          />
        )}
        <ConfirmDialog
          open={showDelete}
          title="Delete Account"
          message={`Delete account for ${selected?.username}?`}
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      </PageContainer>
    </Layout>
  )
}
