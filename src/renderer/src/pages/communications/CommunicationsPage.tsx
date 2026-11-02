import { useState, useMemo, useEffect } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { MessageSquare, Plus, RefreshCw } from 'lucide-react'
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
import { SessionField } from '../../components/ui/SessionField'
import { PersonPickerField } from '../../components/ui/PersonPickerField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { Spinner } from '../../components/ui/Spinner'
import type { Communication } from '../../types'
import { formatDate, getFullName, toInputDate, sortByField } from '../../lib/utils'
import { useSessions } from '../../lib/sessions'
import { officialIdsForNames, usePeopleAndCommittees } from '../../lib/peopleAndCommittees'

const SOURCE_OPTIONS = [
  { value: 'LCE', label: 'LCE' },
  { value: 'Others', label: 'Others' }
]

const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Disapproved', label: 'Disapproved' }
]

const statusVariant = (status: string): 'green' | 'red' | 'yellow' =>
  status === 'Approved' ? 'green' : status === 'Disapproved' ? 'red' : 'yellow'

const columns: Column<Communication>[] = [
  { key: 'communicationNo', header: 'Comm. No.', width: 'w-24' },
  { key: 'title', header: 'Title' },
  { key: 'author', header: 'Author', width: 'w-32' },
  { key: 'coAuthor', header: 'Co-Author', width: 'w-32' },
  { key: 'sponsor', header: 'Sponsor', width: 'w-32' },
  { key: 'source', header: 'Source', width: 'w-24' },
  { key: 'sessionNo', header: 'Session No.', width: 'w-28' },
  {
    key: 'status',
    header: 'Status',
    width: 'w-28',
    render: (r) => <Badge variant={statusVariant(r.status)}>{r.status || 'Pending'}</Badge>
  },
  { key: 'tag', header: 'Tag', width: 'w-28' },
  {
    key: 'dateReceived',
    header: 'Date Received',
    width: 'w-28',
    render: (r) => <span className="text-xs">{formatDate(r.dateReceived)}</span>
  }
]

const EMPTY_FORM = {
  communicationNo: '',
  title: '',
  author: [] as string[],
  coAuthor: [] as string[],
  sponsor: [] as string[],
  source: 'Others',
  sessionNo: '',
  status: 'Pending',
  tag: '',
  dateReceived: '',
  timeReceived: ''
}

function CommunicationFormModal({
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
  record?: Communication
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
              communicationNo: record.communicationNo ?? '',
              title: record.title ?? '',
              author: record.author ?? [],
              coAuthor: record.coAuthor ?? [],
              sponsor: record.sponsor ?? [],
              source: record.source || 'Others',
              sessionNo: record.sessionNo ?? '',
              status: record.status || 'Pending',
              tag: record.tag ?? '',
              dateReceived: toInputDate(record.dateReceived),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.communicationNo.trim() || !form.title.trim()) {
      toast.error('Communication Number and Title are required')
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
      if (isEdit)
        await updateDocumentWithFile(
          'communications',
          record!.id,
          payload,
          'OtherCommunications',
          `Comm_${form.communicationNo}`,
          file,
          record?.filePath ?? '',
          record?.fileType ?? ''
        )
      else
        await addDocumentWithFile(
          'communications',
          payload,
          'OtherCommunications',
          `Comm_${form.communicationNo}`,
          file
        )
      await logActivity(`${isEdit ? 'Updated' : 'Created'} Communication ${form.communicationNo}`)
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
      title={isEdit ? 'Edit Communication' : 'Add Communication'}
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
        <FormField label="Communication No." required>
          <Input
            value={form.communicationNo}
            onChange={set('communicationNo')}
            placeholder="e.g. 001-2026"
          />
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
        <FormField label="Source">
          <Select options={SOURCE_OPTIONS} value={form.source} onChange={set('source')} />
        </FormField>
        <FormField label="Title" required className="col-span-2">
          <TextArea value={form.title} onChange={set('title')} rows={3} />
        </FormField>
        <FormField label="Session No.">
          <SessionField
            value={form.sessionNo}
            onChange={(sessionNo) => setForm((f) => ({ ...f, sessionNo }))}
            sessions={sessions}
          />
        </FormField>
        <FormField label="Status">
          <Select options={STATUS_OPTIONS} value={form.status} onChange={set('status')} />
        </FormField>
        <FormField label="Tag">
          <Input value={form.tag} onChange={set('tag')} placeholder="Keywords/tags" />
        </FormField>
        <FormField label="Date Received">
          <Input type="date" value={form.dateReceived} onChange={set('dateReceived')} />
        </FormField>
        <FormField label="Time Received">
          <Input type="time" value={form.timeReceived} onChange={set('timeReceived')} />
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

export function CommunicationsPage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'communications',
      sortParam: 'communicationNo|desc',
      dataKey: 'communication',
      limit: 100,
      searchQuery: debouncedSearch
    })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'other-communications')

  const [selected, setSelected] = useState<Communication | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const filtered = useMemo(() => {
    const arr = items as unknown as Communication[]
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
    ) as unknown as Communication[]
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
      await deleteDocumentWithFile('communications', selected.id)
      await logActivity(`Deleted Communication ${selected.communicationNo}`)
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
          title="Other Communications"
          subtitle="Communications taken up by the Sanggunian"
          icon={<MessageSquare size={20} />}
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
            emptyMessage="No communication records found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
        <CommunicationFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <CommunicationFormModal
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
          title="Delete Communication"
          message={`Delete communication ${selected?.communicationNo}?`}
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
