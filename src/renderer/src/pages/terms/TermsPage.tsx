import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { addDocument, deleteDocument, updateDocument } from '../../lib/db'
import { compareTermsNewestFirst, termStatus } from '../../lib/terms'
import { formatDate, getFullName } from '../../lib/utils'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { useAuthStore } from '../../store/authStore'
import { Layout, PageContainer } from '../../components/layout/Layout'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { useColumnVisibility, ColumnsMenuButton } from '../../components/ui/ColumnsMenu'
import { TableToolbar } from '../../components/ui/TableToolbar'
import { RowActions } from '../../components/ui/RowActions'
import { Allowed } from '../../components/ui/Allowed'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input } from '../../components/ui/FormField'
import { Spinner } from '../../components/ui/Spinner'
import type { Term } from '../../types'

const STATUS_BADGE = { Current: 'green', Upcoming: 'blue', Past: 'gray', '—': 'gray' } as const

const columns: Column<Term>[] = [
  { key: 'name', header: 'Term', width: 'w-56' },
  {
    key: 'startDate',
    header: 'Start',
    width: 'w-36',
    render: (r) => (r.startDate ? formatDate(r.startDate) : '-')
  },
  {
    key: 'endDate',
    header: 'End',
    width: 'w-36',
    render: (r) => (r.endDate ? formatDate(r.endDate) : '-')
  },
  {
    key: 'status',
    header: 'Status',
    width: 'w-28',
    sortable: false,
    render: (r) => {
      const status = termStatus(r)
      return <Badge variant={STATUS_BADGE[status]}>{status}</Badge>
    }
  },
  { key: 'remarks', header: 'Remarks' }
]

const EMPTY_FORM = { name: '', startDate: '', endDate: '', remarks: '' }

function TermFormModal({
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
  record?: Term
}) {
  const isEdit = !!record
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (open) {
      setForm(
        record
          ? {
              name: record.name ?? '',
              startDate: record.startDate ?? '',
              endDate: record.endDate ?? '',
              remarks: record.remarks ?? ''
            }
          : EMPTY_FORM
      )
    }
  }, [open, record])

  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Term name is required')
      return
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      toast.error('The end date must be after the start date')
      return
    }
    setSaving(true)
    try {
      if (isEdit) await updateDocument('terms', record!.id, { ...form })
      else await addDocument('terms', { ...form })
      await logActivity(`${isEdit ? 'Updated' : 'Added'} Term ${form.name}`)
      toast.success(isEdit ? 'Term updated' : 'Term added')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Term' : 'Add Term'}
      size="md"
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
        <FormField label="Term" required className="col-span-2">
          <Input
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. 2025-2028 or 13th Sangguniang Panlungsod"
          />
        </FormField>
        <FormField label="Start Date">
          <Input type="date" value={form.startDate} onChange={set('startDate')} />
        </FormField>
        <FormField label="End Date">
          <Input type="date" value={form.endDate} onChange={set('endDate')} />
        </FormField>
        <FormField label="Remarks" className="col-span-2">
          <Input value={form.remarks} onChange={set('remarks')} />
        </FormField>
      </form>
    </Modal>
  )
}

export function TermsPage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore } = useListData<
    Record<string, unknown>
  >({
    endpoint: 'terms',
    sortParam: 'startDate|desc',
    dataKey: 'terms',
    searchQuery: debouncedSearch
  })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'terms')

  const [selected, setSelected] = useState<Term | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const base = items as unknown as Term[]
    const q = debouncedSearch.toLowerCase()
    const result = !debouncedSearch.trim()
      ? base
      : base.filter(
          (t) => t.name?.toLowerCase().includes(q) || t.remarks?.toLowerCase().includes(q)
        )
    return [...result].sort(compareTermsNewestFirst)
  }, [items, debouncedSearch])

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
      await deleteDocument('terms', selected.id)
      await logActivity(`Deleted Term ${selected.name}`)
      toast.success('Term deleted')
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
          title="Terms"
          subtitle="Council terms — officials and committees belong to one"
          icon={<CalendarRange size={20} />}
          actions={
            <>
              <button className="btn-ghost" onClick={reload}>
                <RefreshCw size={15} />
                Refresh
              </button>
              <Allowed action="add">
                <button className="btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Add Term
                </button>
              </Allowed>
            </>
          }
        />
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search terms…"
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
            emptyMessage="No terms yet — add the current council term first"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
        <TermFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <TermFormModal
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
          title="Delete Term"
          message={`Delete term ${selected?.name}? Officials and committees in it stay, without a term.`}
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
