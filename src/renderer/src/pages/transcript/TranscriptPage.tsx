import { useState, useMemo, useEffect } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { Mic, Plus, RefreshCw } from 'lucide-react'
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
import { FormField, Input, Select } from '../../components/ui/FormField'
import { SessionField } from '../../components/ui/SessionField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { Spinner } from '../../components/ui/Spinner'
import type { Transcript } from '../../types'
import { getFullName, sortByField } from '../../lib/utils'
import { useSessions } from '../../lib/sessions'

const SESSION_TYPES = [
  { value: 'Regular Session', label: 'Regular Session' },
  { value: 'Special Session', label: 'Special Session' }
]

const SESSION_TYPE_BADGE: Record<string, 'blue' | 'purple'> = {
  'Regular Session': 'blue',
  'Special Session': 'purple'
}

const columns: Column<Transcript>[] = [
  { key: 'transcriptNo', header: 'Transcript No.', width: 'w-28' },
  { key: 'sessionNo', header: 'Session No.', width: 'w-28' },
  {
    key: 'sessionCategory',
    header: 'Session Type',
    width: 'w-32',
    render: (r) => (
      <Badge variant={SESSION_TYPE_BADGE[r.sessionCategory] ?? 'gray'}>{r.sessionCategory}</Badge>
    )
  },
  { key: 'tag', header: 'Tag', width: 'w-32' }
]

const EMPTY_FORM = {
  sessionNo: '',
  sessionCategory: 'Regular Session',
  transcriptNo: '',
  tag: ''
}

function TranscriptFormModal({
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
  record?: Transcript
}) {
  const isEdit = !!record
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const { sessions, reload: reloadSessions } = useSessions()

  useEffect(() => {
    if (open) {
      void reloadSessions()
      setForm(
        record
          ? {
              sessionNo: record.sessionNo ?? '',
              sessionCategory: record.sessionCategory ?? 'Regular Session',
              transcriptNo: record.transcriptNo ?? '',
              tag: record.tag ?? ''
            }
          : EMPTY_FORM
      )
      setFile(null)
    }
  }, [open, record, reloadSessions])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.sessionNo.trim()) {
      toast.error('Session number is required')
      return
    }
    setSaving(true)
    try {
      if (isEdit)
        await updateDocumentWithFile(
          'transcripts',
          record!.id,
          { ...form },
          'TranscriptOfProceedings',
          `TranscriptNo._${form.sessionNo}`,
          file,
          record?.filePath ?? '',
          record?.fileType ?? ''
        )
      else
        await addDocumentWithFile(
          'transcripts',
          { ...form },
          'TranscriptOfProceedings',
          `TranscriptNo._${form.sessionNo}`,
          file
        )
      await logActivity(`${isEdit ? 'Updated' : 'Created'} Transcript Session ${form.sessionNo}`)
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
      title={isEdit ? 'Edit Transcript' : 'Add Transcript'}
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
        <FormField label="Session Number" required>
          <SessionField
            value={form.sessionNo}
            onChange={(sessionNo, session) =>
              setForm((f) => ({
                ...f,
                sessionNo,
                sessionCategory: session?.category || f.sessionCategory
              }))
            }
            sessions={sessions}
          />
        </FormField>
        <FormField label="Session Type">
          <Select
            options={SESSION_TYPES}
            value={form.sessionCategory}
            onChange={set('sessionCategory')}
          />
        </FormField>
        <FormField label="Transcript No.">
          <Input value={form.transcriptNo} onChange={set('transcriptNo')} placeholder="e.g. 024" />
        </FormField>
        <FormField label="Tag" className="col-span-2">
          <Input value={form.tag} onChange={set('tag')} placeholder="Keywords/tags" />
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

export function TranscriptPage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'transcripts',
      sortParam: 'transcriptNo|desc',
      dataKey: 'transcript',
      searchQuery: debouncedSearch
    })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'minutes-transcript')

  const [selected, setSelected] = useState<Transcript | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const filtered = useMemo(() => {
    const arr = items as unknown as Transcript[]
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
    ) as unknown as Transcript[]
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
      await deleteDocumentWithFile('transcripts', selected.id)
      await logActivity(`Deleted Transcript Session ${selected.sessionNo}`)
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
          title="Transcript of Proceedings"
          subtitle="Transcribed records of session proceedings"
          icon={<Mic size={20} />}
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
            emptyMessage="No transcript records found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
        <TranscriptFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <TranscriptFormModal
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
          title="Delete Transcript"
          message={`Delete transcript for Session ${selected?.sessionNo}?`}
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
