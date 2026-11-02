import { useState, useMemo, useEffect } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { Users, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  addDocument,
  updateDocument,
  deleteDocumentWithFile,
  removeStoredFile,
  uploadFile
} from '../../lib/db'
import { buildOfficialsTree, collectDescendantIds, officialName } from '../../lib/orgChart'
import { useFileUrl } from '../../hooks/useFileUrl'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { POSITIONS } from './positions'
import { currentTerm, useTerms } from '../../lib/terms'
import { useAuthStore } from '../../store/authStore'
import { Layout, PageContainer } from '../../components/layout/Layout'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, Column } from '../../components/ui/DataTable'
import { useColumnVisibility, ColumnsMenuButton } from '../../components/ui/ColumnsMenu'
import { TableToolbar } from '../../components/ui/TableToolbar'
import { RowActions } from '../../components/ui/RowActions'
import { Allowed } from '../../components/ui/Allowed'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { Spinner } from '../../components/ui/Spinner'
import type { Official, Term } from '../../types'
import { getFullName, sortByField } from '../../lib/utils'

const POSITION_VARIANTS: Record<string, 'purple' | 'blue' | 'cyan'> = {
  'City Vice Mayor': 'purple',
  'City Councilor': 'blue',
  'Ex-Officio': 'cyan'
}

const columns: Column<Official>[] = [
  { key: 'title', header: 'Title', width: 'w-20' },
  { key: 'firstName', header: 'First Name', width: 'w-28' },
  { key: 'middleName', header: 'Middle Name', width: 'w-28' },
  { key: 'lastName', header: 'Last Name', width: 'w-28' },
  { key: 'suffix', header: 'Suffix', width: 'w-16' },
  {
    key: 'position',
    header: 'Position',
    width: 'w-36',
    render: (r) => <Badge variant={POSITION_VARIANTS[r.position] ?? 'gray'}>{r.position}</Badge>
  },
  { key: 'termName', header: 'Term', width: 'w-32' },
  { key: 'reportsToName', header: 'Reports To', width: 'w-40' }
]

function OfficialFormModal({
  open,
  onClose,
  onSuccess,
  logActivity,
  record,
  officials,
  terms
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  logActivity: (a: string) => Promise<void>
  record?: Official
  /** Everyone in the module — the "Reports To" choices */
  officials: Official[]
  /** Council terms — the "Term" choices */
  terms: Term[]
}) {
  const isEdit = !!record
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    title: '',
    firstName: '',
    middleName: '',
    lastName: '',
    suffix: '',
    position: 'City Councilor',
    termId: '',
    reportsToId: ''
  })

  useEffect(() => {
    if (open) {
      setForm(
        record
          ? {
              title: record.title ?? '',
              firstName: record.firstName ?? '',
              middleName: record.middleName ?? '',
              lastName: record.lastName ?? '',
              suffix: record.suffix ?? '',
              position: record.position ?? 'City Councilor',
              termId: record.termId ?? '',
              reportsToId: record.reportsToId ?? ''
            }
          : {
              title: '',
              firstName: '',
              middleName: '',
              lastName: '',
              suffix: '',
              position: 'City Councilor',
              termId: currentTerm(terms)?.id ?? '',
              reportsToId: ''
            }
      )
      setFile(null)
    }
  }, [open, record, terms])

  // Anyone except this official and the people under them (that would make a reporting loop)
  const reportsToOptions = useMemo(() => {
    const blocked = record
      ? collectDescendantIds(buildOfficialsTree(officials), record.id)
      : new Set<string>()
    return officials
      .filter((o) => !blocked.has(o.id))
      .map((o) => ({ value: o.id, label: `${officialName(o)} — ${o.position}` }))
  }, [officials, record])

  const storedPhotoUrl = useFileUrl(record?.filePath)
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : storedPhotoUrl),
    [file, storedPhotoUrl]
  )
  useEffect(() => {
    return () => {
      if (file && previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [file, previewUrl])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First name and Last name are required')
      return
    }
    setSaving(true)
    let uploadedPath = ''
    try {
      const previousPath = record?.filePath ?? ''
      if (file)
        uploadedPath = await uploadFile('Officials', `${form.lastName}_${form.firstName}`, file)
      const data = {
        ...form,
        reportsToId: form.reportsToId || null,
        termId: form.termId || null,
        filePath: uploadedPath || previousPath
      }
      if (isEdit) await updateDocument('officials', record!.id, data)
      else await addDocument('officials', data)
      uploadedPath = ''
      if (file && previousPath) {
        try {
          await removeStoredFile(previousPath)
        } catch (cleanupError) {
          const reason =
            cleanupError instanceof Error ? cleanupError.message : 'unknown storage error'
          throw new Error(`Official saved, but the previous photo could not be removed: ${reason}`)
        }
      }
      await logActivity(
        `${isEdit ? 'Updated' : 'Added'} Official ${form.firstName} ${form.lastName}`
      )
      toast.success(isEdit ? 'Updated' : 'Added')
      onSuccess()
    } catch (err) {
      // the record wasn't saved, so drop the photo uploaded for it
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
      title={isEdit ? 'Edit Official' : 'Add Official'}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
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
        <FormField label="Title">
          <Input value={form.title} onChange={set('title')} placeholder="Atty., Dr., Engr." />
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
        <FormField label="Position">
          <Select options={POSITIONS} value={form.position} onChange={set('position')} />
        </FormField>
        <FormField label="Term" className="col-span-2">
          <Select
            options={terms.map((t) => ({ value: t.id, label: t.name }))}
            placeholder={terms.length ? '— No term —' : '— Add terms under City Councils → Terms —'}
            value={form.termId}
            onChange={set('termId')}
          />
        </FormField>
        <FormField label="Reports To (organization chart)" className="col-span-2">
          <Select
            options={reportsToOptions}
            placeholder="— No one (top of the chart) —"
            value={form.reportsToId}
            onChange={set('reportsToId')}
          />
        </FormField>
        <div className="col-span-2">
          <FormField label="Photo">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                {previewUrl ? (
                  <img src={previewUrl} alt="Official" className="w-full h-full object-cover" />
                ) : (
                  <Users size={28} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <FileUploadField value={file} onChange={setFile} accept="image/*" label="" />
              </div>
            </div>
          </FormField>
        </div>
      </form>
    </Modal>
  )
}

export function OfficialsPage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'officials',
      sortParam: 'createdAt|asc', // in the order added (members are entered by number)
      dataKey: 'officials',
      searchQuery: debouncedSearch
    })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'sp-members')

  const [selected, setSelected] = useState<Official | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const officials = items as unknown as Official[]
  const { terms } = useTerms()
  const filtered = useMemo(() => {
    // Show who each official reports to, and their term, by name
    const nameById = new Map(officials.map((o) => [o.id, officialName(o)]))
    const termById = new Map(terms.map((t) => [t.id, t.name]))
    const base = officials.map((o) => ({
      ...o,
      reportsToName: o.reportsToId ? (nameById.get(o.reportsToId) ?? '') : '',
      termName: o.termId ? (termById.get(o.termId) ?? '') : ''
    }))
    const q = debouncedSearch.toLowerCase()
    const result = !debouncedSearch.trim()
      ? base
      : base.filter(
          (r) =>
            r.title?.toLowerCase().includes(q) ||
            r.firstName?.toLowerCase().includes(q) ||
            r.lastName?.toLowerCase().includes(q) ||
            r.position?.toLowerCase().includes(q)
        )
    return sortByField(
      result as unknown as Record<string, unknown>[],
      sortField,
      sortDirection
    ) as unknown as Official[]
  }, [officials, terms, debouncedSearch, sortField, sortDirection])

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
      await deleteDocumentWithFile('officials', selected.id)
      await logActivity(`Deleted Official ${selected.firstName} ${selected.lastName}`)
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
          title="S.P Officials"
          subtitle="Members of the Sangguniang Panlungsod"
          icon={<Users size={20} />}
          actions={
            <>
              <button className="btn-ghost" onClick={reload}>
                <RefreshCw size={15} />
                Refresh
              </button>
              <Allowed action="add">
                <button className="btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Add Official
                </button>
              </Allowed>
            </>
          }
        />
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search…"
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
            rowActions={(r) => (
              <RowActions
                onEdit={() => {
                  setSelected(r)
                  setShowEdit(true)
                }}
                onDelete={() => {
                  setSelected(r)
                  setShowDelete(true)
                }}
              />
            )}
            loading={loading}
            emptyMessage="No official records found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
        <OfficialFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
          officials={officials}
          terms={terms}
        />
        {selected && (
          <OfficialFormModal
            open={showEdit}
            onClose={() => setShowEdit(false)}
            onSuccess={() => {
              setShowEdit(false)
              reload()
            }}
            logActivity={logActivity}
            record={selected}
            officials={officials}
            terms={terms}
          />
        )}
        <ConfirmDialog
          open={showDelete}
          title="Delete Official"
          message={`Delete ${selected?.firstName} ${selected?.lastName}?`}
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
