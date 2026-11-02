import { useState, useMemo, useEffect } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { ClipboardList, Plus, RefreshCw } from 'lucide-react'
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
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select, TextArea } from '../../components/ui/FormField'
import { SessionField } from '../../components/ui/SessionField'
import { CommitteeField } from '../../components/ui/CommitteeField'
import { DraftReferencesField } from '../../components/ui/DraftReferencesField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { Spinner } from '../../components/ui/Spinner'
import type { CommitteeReport } from '../../types'
import { formatDate, getFullName, toInputDate, sortByField } from '../../lib/utils'
import { useSessions } from '../../lib/sessions'
import { useCommittees } from '../../lib/committees'
import { useDraftReferences } from '../../lib/draftReferences'

// The module also keeps the minutes of committee meetings and hearings
const REPORT_TYPES = ['Committee Report', 'Committee Meeting Minutes', 'Committee Hearing Minutes']

const columns: Column<CommitteeReport>[] = [
  { key: 'committeeReportsNo', header: "Report's No.", width: 'w-32' },
  {
    key: 'reportType',
    header: 'Type',
    width: 'w-48',
    render: (r) => r.reportType || REPORT_TYPES[0]
  },
  { key: 'committee', header: 'Committee', width: 'w-48' },
  { key: 'title', header: 'Title' },
  { key: 'measures', header: 'Measures', width: 'w-48' },
  { key: 'sessionNo', header: 'Session No.', width: 'w-28' },
  { key: 'tag', header: 'Tag', width: 'w-32' },
  {
    key: 'dateReceived',
    header: 'Date Received',
    width: 'w-32',
    render: (r) => <span className="text-xs">{formatDate(r.dateReceived)}</span>
  }
]

const EMPTY_FORM = {
  reportType: REPORT_TYPES[0],
  committeeReportsNo: '',
  committee: '',
  title: '',
  measures: [] as string[],
  sessionNo: '',
  tag: '',
  dateReceived: '',
  timeReceived: ''
}

function CommitteeReportFormModal({
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
  record?: CommitteeReport
}) {
  const isEdit = !!record
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const { sessions, reload: reloadSessions } = useSessions()
  const { committees, reload: reloadCommittees } = useCommittees()
  const { references, reload: reloadReferences } = useDraftReferences()

  useEffect(() => {
    if (open) {
      void reloadSessions()
      void reloadCommittees()
      void reloadReferences()
      setForm(
        record
          ? {
              reportType: record.reportType || REPORT_TYPES[0],
              committeeReportsNo: record.committeeReportsNo ?? '',
              committee: record.committee ?? '',
              title: record.title ?? '',
              measures: record.measures ?? [],
              sessionNo: record.sessionNo ?? '',
              tag: record.tag ?? '',
              dateReceived: toInputDate(record.dateReceived),
              timeReceived: record.timeReceived ?? ''
            }
          : EMPTY_FORM
      )
      setFile(null)
    }
  }, [open, record, reloadSessions, reloadCommittees, reloadReferences])

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.committeeReportsNo.trim() || !form.title.trim()) {
      toast.error("Report's Number and Title are required")
      return
    }
    setSaving(true)
    try {
      const data = {
        reportType: form.reportType,
        committeeReportsNo: form.committeeReportsNo,
        committee: form.committee,
        title: form.title,
        measures: form.measures,
        sessionNo: form.sessionNo,
        tag: form.tag,
        dateReceived: form.dateReceived,
        timeReceived: form.timeReceived
      }

      if (isEdit)
        await updateDocumentWithFile(
          'committee_reports',
          record!.id,
          data,
          'CommitteeReports',
          `CommitteeReportsNo._${form.committeeReportsNo}`,
          file,
          record?.filePath ?? '',
          record?.fileType ?? ''
        )
      else
        await addDocumentWithFile(
          'committee_reports',
          data,
          'CommitteeReports',
          `CommitteeReportsNo._${form.committeeReportsNo}`,
          file
        )
      await logActivity(
        `${isEdit ? 'Updated' : 'Created'} Committee Report's Number ${form.committeeReportsNo}`
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
      title={isEdit ? 'Edit Committee Report' : 'Add Committee Report'}
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
        <FormField label="Type">
          <Select
            options={REPORT_TYPES.map((t) => ({ value: t, label: t }))}
            value={form.reportType}
            onChange={set('reportType')}
          />
        </FormField>
        <FormField label="Committee Report's Number" required>
          <Input
            value={form.committeeReportsNo}
            onChange={set('committeeReportsNo')}
            placeholder="e.g. 001-2026"
          />
        </FormField>
        <FormField label="Committee" className="col-span-2">
          <CommitteeField
            value={form.committee}
            onChange={(committee) => setForm((f) => ({ ...f, committee }))}
            committees={committees}
          />
        </FormField>
        <FormField label="Title" required className="col-span-2">
          <TextArea value={form.title} onChange={set('title')} rows={5} />
        </FormField>
        <FormField label="Measures" className="col-span-2">
          <DraftReferencesField
            values={form.measures}
            onChange={(measures) => setForm((f) => ({ ...f, measures }))}
            references={references}
          />
          <p className="text-xs text-slate-500 mt-1.5">
            For a joint report with numbered items — e.g. “(1) Draft Resolution No. 206-2026” — pick
            each one referenced
          </p>
        </FormField>
        <FormField label="Session Number">
          <SessionField
            value={form.sessionNo}
            onChange={(sessionNo) => setForm((f) => ({ ...f, sessionNo }))}
            sessions={sessions}
          />
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

export function CommitteeReportsPage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'committee_reports',
      sortParam: 'committeeReportsNo|desc',
      dataKey: 'committeeReports',
      limit: 100,
      searchQuery: debouncedSearch
    })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'committee-reports')

  const [selected, setSelected] = useState<CommitteeReport | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const filtered = useMemo(() => {
    const arr = items as unknown as CommitteeReport[]
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
    ) as unknown as CommitteeReport[]
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
      await deleteDocumentWithFile('committee_reports', selected.id)
      await logActivity(`Deleted Committee Report's Number ${selected.committeeReportsNo}`)
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
          title="Committee Reports & Minutes"
          subtitle="Committee reports, and minutes of committee meetings and hearings"
          icon={<ClipboardList size={20} />}
          actions={
            <>
              <button className="btn-ghost" onClick={reload}>
                <RefreshCw size={15} />
                Refresh
              </button>
              <Allowed action="add">
                <button className="btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Add Report
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
            emptyMessage="No committee report records found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
        <CommitteeReportFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <CommitteeReportFormModal
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
          title="Delete Report"
          message={`Delete Report ${selected?.committeeReportsNo}?`}
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
