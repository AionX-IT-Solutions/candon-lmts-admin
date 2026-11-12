import { useState, useMemo, useEffect } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { FileEdit, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  addDocument,
  deleteDocumentWithFile,
  deleteDocumentsWhere,
  addDocumentWithFile,
  updateDocumentWithFile,
  upsertDocument,
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
import { SessionField } from '../../components/ui/SessionField'
import { PersonPickerField } from '../../components/ui/PersonPickerField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { Spinner } from '../../components/ui/Spinner'
import type { DraftResolution } from '../../types'
import { formatDate, getFullName } from '../../lib/utils'
import { useSessions } from '../../lib/sessions'
import { officialIdsForNames, usePeopleAndCommittees } from '../../lib/peopleAndCommittees'

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

const compareDraftNoDesc = (a?: string, b?: string) =>
  (b ?? '').localeCompare(a ?? '', undefined, { numeric: true, sensitivity: 'base' })

const READING_OPTIONS = [
  { value: '1st reading', label: '1st Reading' },
  { value: '2nd reading', label: '2nd Reading' },
  { value: '3rd reading', label: '3rd Reading' }
]

const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Disapproved', label: 'Disapproved' }
]

const statusVariant = (status: string): 'green' | 'red' | 'yellow' =>
  status === 'Approved' ? 'green' : status === 'Disapproved' ? 'red' : 'yellow'

const columns: Column<DraftResolution>[] = [
  { key: 'draftResolutionNumber', header: 'Draft No.', width: 'w-48' },
  { key: 'sessionNo', header: 'Session No.', width: 'w-28' },
  { key: 'reading', header: 'Reading', width: 'w-28' },
  {
    key: 'status',
    header: 'Status',
    width: 'w-28',
    render: (r) => <Badge variant={statusVariant(r.status)}>{r.status || 'Pending'}</Badge>
  },
  { key: 'title', header: 'Title' },
  { key: 'author', header: 'Author', width: 'w-32' },
  { key: 'coAuthor', header: 'Co-Author', width: 'w-32' },
  { key: 'sponsor', header: 'Sponsor', width: 'w-32' },
  { key: 'tag', header: 'Tag', width: 'w-40' },
  { key: 'actionOfOfficer', header: 'Action', width: 'w-40' },
  {
    key: 'dateReceived',
    header: 'Date Received',
    width: 'w-32',
    render: (r) => <span className="text-xs">{formatDate(r.dateReceived)}</span>
  }
]

const EMPTY_FORM = {
  draftResolutionNumber: '',
  title: '',
  author: [] as string[],
  coAuthor: [] as string[],
  sponsor: [] as string[],
  tag: '',
  sessionNo: '',
  reading: '1st reading',
  status: 'Pending',
  actionOfOfficer: '',
  dateReceived: '',
  dateOfReading: '',
  timeReceived: ''
}

function DraftResFormModal({
  open,
  onClose,
  onSuccess,
  logActivity,
  record
}: {
  open: boolean
  onClose: () => void
  onSuccess: (updatedRecord?: DraftResolution) => void
  logActivity: (a: string) => Promise<void>
  record?: DraftResolution
}) {
  const isEdit = !!record
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const { sessions, reload: reloadSessions } = useSessions()
  const { people, reload: reloadPeople } = usePeopleAndCommittees()

  useEffect(() => {
    if (open) {
      void reloadSessions()
      void reloadPeople()
      setForm(
        record
          ? {
              draftResolutionNumber: record.draftResolutionNumber ?? '',
              title: record.title ?? '',
              author: record.author ?? [],
              coAuthor: record.coAuthor ?? [],
              sponsor: record.sponsor ?? [],
              tag: record.tag ?? '',
              sessionNo: record.sessionNo ?? '',
              reading: record.reading ?? '1st reading',
              status: record.status ?? 'Pending',
              actionOfOfficer: record.actionOfOfficer ?? '',
              dateReceived: record.dateReceived ?? '',
              dateOfReading: record.dateOfReading ?? '',
              timeReceived: record.timeReceived ?? ''
            }
          : EMPTY_FORM
      )
      setFile(null)
    }
  }, [open, record, reloadSessions, reloadPeople])

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit() {
    if (!form.draftResolutionNumber.trim() || !form.title.trim()) {
      toast.error('Draft number and Title are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        authorOfficialIds: officialIdsForNames(form.author, people),
        coAuthorOfficialIds: officialIdsForNames(form.coAuthor, people),
        sponsorOfficialIds: officialIdsForNames(form.sponsor, people)
      }
      let updatedRecord: DraftResolution | undefined
      if (isEdit) {
        const savedFilePath = await updateDocumentWithFile(
          'draft_resolutions',
          record!.id,
          payload,
          'DraftResolutions',
          `ResolutionNo._${form.draftResolutionNumber}`,
          file,
          record?.filePath ?? '',
          record?.fileType ?? ''
        )
        updatedRecord = {
          ...record!,
          ...form,
          ...payload,
          id: record!.id,
          filePath: savedFilePath,
          fileType: file ? `.${file.name.split('.').pop() ?? ''}` : (record?.fileType ?? '')
        }
      } else {
        await addDocumentWithFile(
          'draft_resolutions',
          payload,
          'DraftResolutions',
          `ResolutionNo._${form.draftResolutionNumber}`,
          file
        )
      }
      // Snapshot this session's reading stage so it stays on this session's Order of
      // Business even after the draft later advances in a later session.
      if (form.sessionNo.trim()) {
        await upsertDocument(
          'draft_resolution_readings',
          { draftNo: form.draftResolutionNumber, sessionNo: form.sessionNo, reading: form.reading },
          ['draftNo', 'sessionNo']
        )
      }
      await logActivity(
        `${isEdit ? 'Updated' : 'Created'} Draft Resolution ${form.draftResolutionNumber}`
      )
      toast.success(isEdit ? 'Updated' : 'Created')
      onSuccess(updatedRecord)
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
      title={isEdit ? 'Edit Draft Resolution' : 'Add Draft Resolution'}
      size="lg"
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
        <FormField label="Draft Resolution Number" required className="col-span-2">
          <Input
            value={form.draftResolutionNumber}
            onChange={set('draftResolutionNumber')}
            placeholder="e.g. 206-2026"
          />
        </FormField>
        <FormField label="Title" required className="col-span-2">
          <TextArea value={form.title} onChange={set('title')} rows={3} />
        </FormField>
        <FormField label="Author">
          <PersonPickerField
            values={form.author}
            onChange={(author) => setForm((f) => ({ ...f, author }))}
            people={people}
          />
        </FormField>
        <FormField label="Co-Author">
          <PersonPickerField
            values={form.coAuthor}
            onChange={(coAuthor) => setForm((f) => ({ ...f, coAuthor }))}
            people={people}
          />
        </FormField>
        <FormField label="Sponsor" className="col-span-2">
          <PersonPickerField
            values={form.sponsor}
            onChange={(sponsor) => setForm((f) => ({ ...f, sponsor }))}
            people={people}
          />
        </FormField>
        <FormField label="Tag" className="col-span-2">
          <Input value={form.tag} onChange={set('tag')} />
        </FormField>
        <FormField label="Session No.">
          <SessionField
            value={form.sessionNo}
            onChange={(sessionNo) => setForm((f) => ({ ...f, sessionNo }))}
            sessions={sessions}
          />
        </FormField>
        <FormField label="Reading">
          <Select options={READING_OPTIONS} value={form.reading} onChange={set('reading')} />
        </FormField>
        <FormField label="Status">
          <Select options={STATUS_OPTIONS} value={form.status} onChange={set('status')} />
        </FormField>
        <FormField label="Action taken by SP">
          <Input value={form.actionOfOfficer} onChange={set('actionOfOfficer')} />
        </FormField>
        <FormField label="Date Received">
          <Input
            value={form.dateReceived}
            onChange={set('dateReceived')}
            placeholder="e.g. Friday, 14 June 2024"
          />
        </FormField>
        <FormField label="Time Received">
          <Input
            value={form.timeReceived}
            onChange={set('timeReceived')}
            placeholder="e.g. 10:44:54 am"
          />
        </FormField>
        <FormField label="Date of Reading" className="col-span-2">
          <Input
            value={form.dateOfReading}
            onChange={set('dateOfReading')}
            placeholder="e.g. Tuesday, 18 June 2024"
          />
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

export function DraftResolutionsPage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore } = useListData<
    Record<string, unknown>
  >({
    endpoint: 'draft_resolutions',
    sortParam: 'sessionNo|desc',
    dataKey: 'draftResolution',
    limit: 100,
    searchQuery: debouncedSearch
  })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'draft-resolutions')

  const [selected, setSelected] = useState<DraftResolution | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const base = items as unknown as DraftResolution[]
    const q = debouncedSearch.toLowerCase()
    const result = !debouncedSearch.trim()
      ? base
      : base.filter(
          (r) =>
            r.title?.toLowerCase().includes(q) ||
            r.draftResolutionNumber?.toLowerCase().includes(q) ||
            (r.author ?? []).some((a) => a.toLowerCase().includes(q)) ||
            (r.coAuthor ?? []).some((a) => a.toLowerCase().includes(q)) ||
            (r.sponsor ?? []).some((a) => a.toLowerCase().includes(q)) ||
            r.sessionNo?.toLowerCase().includes(q) ||
            r.reading?.toLowerCase().includes(q) ||
            r.tag?.toLowerCase().includes(q) ||
            r.dateReceived?.toLowerCase().includes(q)
        )
    return [...result].sort((a, b) => {
      const sessionCmp = compareSessionNoDesc(a.sessionNo, b.sessionNo)
      if (sessionCmp !== 0) return sessionCmp
      return compareDraftNoDesc(a.draftResolutionNumber, b.draftResolutionNumber)
    })
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
      await deleteDocumentWithFile('draft_resolutions', selected.id)
      await deleteDocumentsWhere(
        'draft_resolution_readings',
        'draftNo',
        selected.draftResolutionNumber
      )
      await logActivity(`Deleted Draft Resolution ${selected.draftResolutionNumber}`)
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
          title="Draft Resolutions"
          subtitle="Proposed resolutions and their readings"
          icon={<FileEdit size={20} />}
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
          searchPlaceholder="Search by number or title…"
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
            emptyMessage="No draft resolution records found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
        <DraftResFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <DraftResFormModal
            open={showEdit}
            onClose={() => setShowEdit(false)}
            onSuccess={(updatedRecord) => {
              setShowEdit(false)
              if (updatedRecord) {
                setSelected((current) =>
                  current?.id === updatedRecord.id ? { ...current, ...updatedRecord } : current
                )
              }
              reload()
            }}
            logActivity={logActivity}
            record={selected}
          />
        )}
        <ConfirmDialog
          open={showDelete}
          title="Delete Draft Resolution"
          message={`Delete Draft Resolution ${selected?.draftResolutionNumber}?`}
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
