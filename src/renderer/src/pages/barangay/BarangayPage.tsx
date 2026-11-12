import { useState, useMemo, useEffect } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { Building2, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  addDocument,
  deleteDocumentWithFile,
  addDocumentWithFile,
  updateDocumentWithFile,
  openStoredFile
} from '../../lib/db'
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
import { FormField, Input, Select, TextArea } from '../../components/ui/FormField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { Spinner } from '../../components/ui/Spinner'
import type { BrgyAction } from '../../types'
import { formatDate, getFullName, toInputDate, sortByField } from '../../lib/utils'

// The 42 barangays of the City of Candon
const BARANGAYS = [
  'ALLANGIGAN PRIMERO',
  'ALLANGIGAN SEGUNDO',
  'AMGUID',
  'AYUDANTE',
  'BAGANI CAMPOSANTO',
  'BAGANI GABOR',
  'BAGANI TOCGO',
  'BAGANI UBBOG',
  'BAGAR',
  'BALINGAOAN',
  'BUGNAY',
  'CALAOAAN',
  'CALONGBUYAN',
  'CATERMAN',
  'CUBCUBBOOT',
  'DARAPIDAP',
  'LANGLANGCA PRIMERO',
  'LANGLANGCA SEGUNDO',
  'OAIG-DAYA',
  'PALACAPAC',
  'PARAS',
  'PARIOC PRIMERO',
  'PARIOC SEGUNDO',
  'PATPATA PRIMERO',
  'PATPATA SEGUNDO',
  'PAYPAYAD',
  'SALVADOR PRIMERO',
  'SALVADOR SEGUNDO',
  'SAN AGUSTIN',
  'SAN ANDRES',
  'SAN ANTONIO (POB.)',
  'SAN ISIDRO (POB.)',
  'SAN JOSE (POB.)',
  'SAN JUAN (POB.)',
  'SAN NICOLAS',
  'SAN PEDRO',
  'SANTO TOMAS',
  'TABLAC',
  'TALOGTOG',
  'TAMURONG PRIMERO',
  'TAMURONG SEGUNDO',
  'VILLARICA'
]

const BARANGAY_OPTIONS = BARANGAYS.map((b) => ({ value: b, label: b }))

const CATEGORIES = [
  { value: 'Ordinance', label: 'Ordinance' },
  { value: 'Resolution', label: 'Resolution' }
]
const ACTION_OPTIONS = [
  { value: 'Valid', label: 'Valid' },
  { value: 'Returned', label: 'Returned' },
  { value: 'Invalid', label: 'Invalid' },
  { value: 'Others', label: 'Others' }
]

const CATEGORY_BADGE: Record<string, 'blue' | 'purple'> = {
  Ordinance: 'blue',
  Resolution: 'purple'
}

const columns: Column<BrgyAction>[] = [
  { key: 'brgy', header: 'Barangay', width: 'w-40' },
  {
    key: 'category',
    header: 'Category',
    width: 'w-28',
    render: (r) => <Badge variant={CATEGORY_BADGE[r.category] ?? 'gray'}>{r.category}</Badge>
  },
  { key: 'measuresNo', header: 'Measures No.', width: 'w-32' },
  { key: 'measuresTitle', header: 'Measures Title' },
  { key: 'resolutionNumber', header: 'Resolution/Ordinance No.', width: 'w-44' },
  { key: 'action', header: 'Action', width: 'w-24' },
  { key: 'tag', header: 'Tag', width: 'w-32' },
  {
    key: 'dateApproved',
    header: 'Date Approved',
    width: 'w-28',
    render: (r) => <span className="text-xs">{formatDate(r.dateApproved)}</span>
  }
]

const EMPTY_FORM = {
  brgy: BARANGAYS[0],
  category: 'Ordinance',
  measuresNo: '',
  measuresTitle: '',
  resolutionNumber: '',
  action: 'Valid',
  actionOther: '',
  tag: '',
  dateApproved: '',
  dateReceived: '',
  timeReceived: '',
  dateReleased: '',
  timeReleased: ''
}

function BrgyFormModal({
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
  record?: BrgyAction
}) {
  const isEdit = !!record
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (open) {
      setForm(
        record
          ? {
              brgy: record.brgy ?? '',
              category: record.category ?? 'Ordinance',
              measuresNo: record.measuresNo ?? '',
              measuresTitle: record.measuresTitle ?? '',
              resolutionNumber: record.resolutionNumber ?? '',
              action: ACTION_OPTIONS.some((o) => o.value === record.action)
                ? record.action
                : record.action
                  ? 'Others'
                  : 'Valid',
              actionOther: ACTION_OPTIONS.some((o) => o.value === record.action)
                ? ''
                : (record.action ?? ''),
              tag: record.tag ?? '',
              dateApproved: toInputDate(record.dateApproved),
              dateReceived: toInputDate(record.dateReceived),
              timeReceived: record.timeReceived ?? '',
              dateReleased: toInputDate(record.dateReleased),
              timeReleased: record.timeReleased ?? ''
            }
          : EMPTY_FORM
      )
      setFile(null)
    }
  }, [open, record])

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.brgy.trim() || !form.measuresTitle.trim()) {
      toast.error('Barangay and Measures Title are required')
      return
    }
    setSaving(true)
    try {
      const data = {
        brgy: form.brgy,
        category: form.category,
        measuresNo: form.measuresNo,
        measuresTitle: form.measuresTitle,
        resolutionNumber: form.resolutionNumber,
        action: form.action === 'Others' ? form.actionOther : form.action,
        tag: form.tag,
        dateApproved: form.dateApproved,
        dateReceived: form.dateReceived,
        timeReceived: form.timeReceived,
        dateReleased: form.dateReleased,
        timeReleased: form.timeReleased
      }

      if (isEdit)
        await updateDocumentWithFile(
          'brgy_actions',
          record!.id,
          data,
          'BrgyActions',
          `${form.brgy}_${form.measuresNo || form.resolutionNumber}`,
          file,
          record?.filePath ?? '',
          record?.fileType ?? ''
        )
      else
        await addDocumentWithFile(
          'brgy_actions',
          data,
          'BrgyActions',
          `${form.brgy}_${form.measuresNo || form.resolutionNumber}`,
          file
        )
      await logActivity(
        `${isEdit ? 'Updated' : 'Created'} Barangay Action ${form.measuresNo || form.resolutionNumber}`
      )
      toast.success(isEdit ? 'Updated' : 'Created')
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
      title={isEdit ? 'Edit Barangay Action' : 'Add Barangay Action'}
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
        <FormField label="Barangay" required>
          <Select options={BARANGAY_OPTIONS} value={form.brgy} onChange={set('brgy')} />
        </FormField>
        <FormField label="Category">
          <Select options={CATEGORIES} value={form.category} onChange={set('category')} />
        </FormField>
        <FormField label="Measures No.">
          <Input
            value={form.measuresNo}
            onChange={set('measuresNo')}
            placeholder="e.g. R13-2025-047"
          />
        </FormField>
        <FormField label="Resolution/Ordinance No.">
          <Input
            value={form.resolutionNumber}
            onChange={set('resolutionNumber')}
            placeholder="e.g. APPROPRIATION ORDINANCE NO. 2025-01"
          />
        </FormField>
        <FormField label="Measures Title" required className="col-span-2">
          <TextArea value={form.measuresTitle} onChange={set('measuresTitle')} rows={3} />
        </FormField>
        <FormField label="Tag">
          <Input
            value={form.tag}
            onChange={set('tag')}
            placeholder="e.g. APPROPRIATIONS AND FINANCE"
          />
        </FormField>
        <FormField label="Action">
          <Select options={ACTION_OPTIONS} value={form.action} onChange={set('action')} />
        </FormField>
        {form.action === 'Others' && (
          <FormField label="Specify Action" className="col-span-2">
            <Input
              value={form.actionOther}
              onChange={set('actionOther')}
              placeholder="Specify action"
            />
          </FormField>
        )}
        <FormField label="Date Approved">
          <Input type="date" value={form.dateApproved} onChange={set('dateApproved')} />
        </FormField>
        <FormField label="Date Received">
          <Input type="date" value={form.dateReceived} onChange={set('dateReceived')} />
        </FormField>
        <FormField label="Time Received">
          <Input type="time" value={form.timeReceived} onChange={set('timeReceived')} />
        </FormField>
        <FormField label="Date Released">
          <Input type="date" value={form.dateReleased} onChange={set('dateReleased')} />
        </FormField>
        <FormField label="Time Released">
          <Input type="time" value={form.timeReleased} onChange={set('timeReleased')} />
        </FormField>
        <div className="col-span-2">
          <FileUploadField value={file} onChange={setFile} />
          {isEdit && record?.filePath && !file && (
            <p className="text-xs text-slate-500 mt-1.5">
              Current file:{' '}
              <button
                type="button"
                onClick={() => void openStoredFile(record.filePath)}
                className="text-indigo-600 hover:underline cursor-pointer"
              >
                View attached file
              </button>
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}

export function BarangayPage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'brgy_actions',
      sortParam: 'brgy|desc',
      dataKey: 'brgy',
      limit: 100,
      searchQuery: debouncedSearch
    })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'barangay-actions')

  const [selected, setSelected] = useState<BrgyAction | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const arr = items as unknown as BrgyAction[]
    const q = debouncedSearch.toLowerCase()
    const result = !debouncedSearch.trim()
      ? arr
      : arr.filter((r) =>
          Object.values(r as unknown as Record<string, unknown>).some((v) =>
            String(v ?? '')
              .toLowerCase()
              .includes(q)
          )
        )
    return sortByField(
      result as unknown as Record<string, unknown>[],
      sortField,
      sortDirection
    ) as unknown as BrgyAction[]
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
      await deleteDocumentWithFile('brgy_actions', selected.id)
      await logActivity(
        `Deleted Barangay Action ${selected.measuresNo || selected.resolutionNumber}`
      )
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
          title="Barangay Actions"
          subtitle="Barangay ordinances and resolutions acted on by the Sanggunian"
          icon={<Building2 size={20} />}
          actions={
            <>
              <button className="btn-ghost" onClick={reload}>
                <RefreshCw size={15} />
                Refresh
              </button>
              <Allowed action="add">
                <button className="btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Add
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
                onOpen={r.filePath ? () => void openStoredFile(r.filePath) : undefined}
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
            onRowDoubleClick={() => selected?.filePath && void openStoredFile(selected.filePath)}
            loading={loading}
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
            emptyMessage="No barangay action records found"
          />
        </div>
        <BrgyFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <BrgyFormModal
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
          title="Delete Barangay Action"
          message={`Delete ${selected?.measuresNo || selected?.resolutionNumber}?`}
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
