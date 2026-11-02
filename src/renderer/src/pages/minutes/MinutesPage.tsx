import { useState, useMemo, useEffect } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { BookOpen, Plus, RefreshCw } from 'lucide-react'
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
import { CategoryTabs } from '../../components/ui/CategoryTabs'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select } from '../../components/ui/FormField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { OfficialsPickerField } from '../../components/ui/OfficialsPickerField'
import { Spinner } from '../../components/ui/Spinner'
import type { Minutes, Term } from '../../types'
import { formatDate, getFullName, toInputDate } from '../../lib/utils'
import { currentTerm, useTerms } from '../../lib/terms'
import { useOfficials } from '../../lib/officials'

const CATEGORIES = ['Regular Session', 'Special Session']

const parseSessionNo = (sessionNo?: string) => {
  const m = /^(\d+)SP_(\d+)/i.exec(sessionNo ?? '')
  if (m) return { group: 0, primary: parseInt(m[1], 10), secondary: parseInt(m[2], 10) }
  return { group: 1, primary: parseInt(sessionNo ?? '', 10) || 0, secondary: 0 }
}

const compareSessionNoDesc = (a?: string, b?: string) => {
  const pa = parseSessionNo(a)
  const pb = parseSessionNo(b)
  if (pa.group !== pb.group) return pa.group - pb.group
  if (pa.primary !== pb.primary) return pb.primary - pa.primary
  return pb.secondary - pa.secondary
}

const SESSION_TYPES = [
  { value: 'Regular Session', label: 'Regular Session' },
  { value: 'Special Session', label: 'Special Session' }
]

const CATEGORY_BADGE: Record<string, 'blue' | 'purple'> = {
  'Regular Session': 'blue',
  'Special Session': 'purple'
}

const columns: Column<Minutes>[] = [
  { key: 'sessionNo', header: 'Session No.', width: 'w-36' },
  {
    key: 'category',
    header: 'Category',
    width: 'w-40',
    render: (r) => <Badge variant={CATEGORY_BADGE[r.category] ?? 'gray'}>{r.category}</Badge>
  },
  { key: 'date', header: 'Date', width: 'w-56', render: (r) => formatDate(r.date) },
  { key: 'termName', header: 'Term', width: 'w-44' }
]

const EMPTY_FORM = {
  sessionNo: '',
  date: '',
  category: 'Regular Session',
  tag: '',
  termId: '',
  callOrder: '',
  prayer: '',
  present: [] as string[],
  absent: [] as string[],
  adjournmentTime: ''
}

function MinutesFormModal({
  open,
  onClose,
  onSuccess,
  logActivity,
  record,
  terms
}: {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  logActivity: (a: string) => Promise<void>
  record?: Minutes
  /** Council terms — the "Term" choices */
  terms: Term[]
}) {
  const isEdit = !!record
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const { officials, reload: reloadOfficials } = useOfficials()

  useEffect(() => {
    if (open) {
      void reloadOfficials()
      setForm(
        record
          ? {
              sessionNo: record.sessionNo ?? '',
              // Older sessions kept the date as text (e.g. "Tuesday, 7 October 2025")
              date: toInputDate(record.date),
              category: record.category ?? 'Regular Session',
              tag: record.tag ?? '',
              termId: record.termId ?? '',
              callOrder: record.callOrder ?? '',
              prayer: record.prayer ?? '',
              present: record.present ?? [],
              absent: record.absent ?? [],
              adjournmentTime: record.adjournmentTime ?? ''
            }
          : { ...EMPTY_FORM, termId: currentTerm(terms)?.id ?? '' }
      )
      setFile(null)
    }
  }, [open, record, terms, reloadOfficials])

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit() {
    if (!form.sessionNo.trim()) {
      toast.error('Session number is required')
      return
    }
    setSaving(true)
    try {
      const data = {
        sessionNo: form.sessionNo,
        date: form.date,
        category: form.category,
        tag: form.tag,
        termId: form.termId || null,
        callOrder: form.callOrder,
        prayer: form.prayer,
        present: form.present,
        absent: form.absent,
        adjournmentTime: form.adjournmentTime
      }

      if (isEdit)
        await updateDocumentWithFile(
          'minutes',
          record!.id,
          data,
          'minutes',
          `SessionNo._${form.sessionNo}`,
          file,
          record?.filePath ?? '',
          record?.fileType ?? ''
        )
      else
        await addDocumentWithFile('minutes', data, 'minutes', `SessionNo._${form.sessionNo}`, file)
      await logActivity(`${isEdit ? 'Updated' : 'Created'} Minutes Session ${form.sessionNo}`)
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
      title={isEdit ? 'Edit Session' : 'Add Session'}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => handleSubmit()} disabled={saving}>
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
        <FormField label="Session Number" required>
          <Input value={form.sessionNo} onChange={set('sessionNo')} placeholder="e.g. 001-2026" />
        </FormField>
        <FormField label="Session Type">
          <Select options={SESSION_TYPES} value={form.category} onChange={set('category')} />
        </FormField>
        <FormField label="Term">
          <Select
            options={terms.map((t) => ({ value: t.id, label: t.name }))}
            placeholder={terms.length ? '— No term —' : '— Add terms under City Councils → Terms —'}
            value={form.termId}
            onChange={set('termId')}
          />
        </FormField>
        <FormField label="Date">
          <Input type="date" value={form.date} onChange={set('date')} />
        </FormField>
        <FormField label="Tag" className="col-span-2">
          <Input value={form.tag} onChange={set('tag')} placeholder="Keywords/tags" />
        </FormField>
        {/* Feeds the mobile app's own Order of Business sections I/II/V/XIII — everything else
            on that screen (Reference of Business, Committee Reports, Calendar of Business, ...)
            is assembled automatically from each Draft/Report/Communication's own Session No. and
            Reading, not typed here. */}
        <div className="col-span-2 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500 mb-3">
            Order of Business sections I, II, V and XIII — optional, shown on the mobile app only
            when filled in.
          </p>
        </div>
        <FormField label="Call to Order">
          <Input value={form.callOrder} onChange={set('callOrder')} />
        </FormField>
        <FormField label="Prayer">
          <Input value={form.prayer} onChange={set('prayer')} />
        </FormField>
        <FormField label="Present (Roll Call)">
          <OfficialsPickerField
            values={form.present}
            onChange={(present) => setForm((f) => ({ ...f, present }))}
            officials={officials}
            placeholder="Select present officials…"
          />
        </FormField>
        <FormField label="Absent (Roll Call)">
          <OfficialsPickerField
            values={form.absent}
            onChange={(absent) => setForm((f) => ({ ...f, absent }))}
            officials={officials}
            placeholder="Select absent officials…"
          />
        </FormField>
        <FormField label="Adjournment Time" className="col-span-2">
          <Input
            value={form.adjournmentTime}
            onChange={set('adjournmentTime')}
            placeholder="e.g. 5:30 PM"
          />
        </FormField>
        <div className="col-span-2 border-t border-slate-100 pt-3">
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

export function MinutesPage() {
  const user = useAuthStore((s) => s.user)
  const [category, setCategory] = useState('Regular Session')
  // Term filter: defaults to the term running today ('' = all terms)
  const { terms } = useTerms()
  const [termFilter, setTermFilter] = useState<string | null>(null)
  const activeTermId = termFilter ?? currentTerm(terms)?.id ?? ''
  const filters = useMemo(
    () => [
      { field: 'category', op: '==' as const, value: category },
      ...(activeTermId ? [{ field: 'termId', op: '==' as const, value: activeTermId }] : [])
    ],
    [category, activeTermId]
  )
  const { items, loading, loadingMore, hasMore, reload, loadMore } = useListData<
    Record<string, unknown>
  >({
    endpoint: 'minutes',
    sortParam: 'sessionNo|desc',
    dataKey: 'minutes',
    limit: 100,
    filters
  })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'calendar-of-business')

  const [selected, setSelected] = useState<Minutes | null>(null)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const filtered = useMemo(() => {
    const termById = new Map(terms.map((t) => [t.id, t.name]))
    let arr = (items as unknown as Minutes[]).map((m) => ({
      ...m,
      termName: m.termId ? (termById.get(m.termId) ?? '') : ''
    }))
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      arr = arr.filter((m) =>
        Object.values(m as unknown as Record<string, unknown>).some((v) =>
          String(v ?? '')
            .toLowerCase()
            .includes(q)
        )
      )
    }
    return [...arr].sort((a, b) => compareSessionNoDesc(a.sessionNo, b.sessionNo))
  }, [items, terms, debouncedSearch])

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
      await deleteDocumentWithFile('minutes', selected.id)
      await logActivity(`Deleted Minutes Session ${selected.sessionNo}`)
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
          title="Order of Business"
          subtitle="Regular and special sessions"
          icon={<BookOpen size={20} />}
          actions={
            <>
              <select
                value={activeTermId}
                onChange={(e) => {
                  setTermFilter(e.target.value)
                  setSelected(null)
                }}
                className="input-field"
                style={{ width: 190, padding: '7px 10px' }}
                aria-label="Term"
              >
                <option value="">All terms</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
        >
          <CategoryTabs
            options={CATEGORIES}
            value={category}
            onChange={(cat) => {
              setCategory(cat)
              setSelected(null)
            }}
          />
        </TableToolbar>
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
            emptyMessage="No minutes records found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>

        <MinutesFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
          terms={terms}
        />
        {selected && (
          <MinutesFormModal
            open={showEdit}
            onClose={() => setShowEdit(false)}
            onSuccess={() => {
              setShowEdit(false)
              reload()
            }}
            logActivity={logActivity}
            terms={terms}
            record={selected}
          />
        )}
        <ConfirmDialog
          open={showDelete}
          title="Delete Minutes"
          message={`Delete minutes for Session ${selected?.sessionNo}?`}
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
