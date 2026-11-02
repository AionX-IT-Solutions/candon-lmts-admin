import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  addDocument,
  addDocumentWithFile,
  deleteDocumentWithFile,
  openStoredFile,
  updateDocumentWithFile,
  type TableName
} from '../../lib/db'
import { currentTerm, useTerms } from '../../lib/terms'
import { useSessions } from '../../lib/sessions'
import { useCommittees } from '../../lib/committees'
import { findDraftReferenceFile, useDraftReferences } from '../../lib/draftReferences'
import { formatDate, getFullName, toInputDate } from '../../lib/utils'
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
import { CategoryTabs } from '../../components/ui/CategoryTabs'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select, TextArea } from '../../components/ui/FormField'
import { SessionField } from '../../components/ui/SessionField'
import { CommitteeField } from '../../components/ui/CommitteeField'
import { DraftReferenceField } from '../../components/ui/DraftReferenceField'
import { FileUploadField } from '../../components/ui/FileUploadField'
import { Spinner } from '../../components/ui/Spinner'
import type { Committee, Term } from '../../types'

/** One field of a records module: in the form, and (unless `column: false`) in the table. */
export interface RecordField {
  /** App field name; its column is listed for the table in lib/db/schema.ts */
  key: string
  label: string
  /**
   * text (default) · date (date picker) · textarea · select (from `options`) ·
   * committee (Standing Committees of the chosen term) · term (council term) ·
   * session (a session from Order of Business, most recent first; stores its number) ·
   * draftReference (a Draft Ordinance/Draft Resolution/Communication, most recent first;
   * stores its own code — e.g. draftOrdinanceNumber)
   */
  kind?:
    | 'text'
    | 'date'
    | 'textarea'
    | 'select'
    | 'committee'
    | 'term'
    | 'session'
    | 'draftReference'
  options?: string[]
  /** kind 'session': form fields filled from the picked session, e.g. { category: 'category' } */
  fills?: Record<string, 'category' | 'termId' | 'date'>
  required?: boolean
  placeholder?: string
  /** Shown (muted) in the table while the field is blank, and as the form's placeholder */
  emptyText?: string
  /** Spans both form columns */
  wide?: boolean
  /** Table column width, or false to leave the field out of the table */
  column?: { width?: string } | false
}

/** A records module: a table of records, usually with a PDF and a council term (term filter). */
export interface RecordsConfig {
  table: TableName
  /** Storage folder for the PDFs (private.folder_privilege maps it to the module's privilege) */
  folder: string
  title: string
  subtitle: string
  icon: ReactNode
  /** What one record is called — form title, messages and the activity log */
  noun: string
  fields: RecordField[]
  /** The field that names a record in messages (e.g. 'title' or 'sessionNo') */
  nameField: string
  /** Newest first by this field */
  dateField: string
  /** A PDF must be attached when adding */
  fileRequired: boolean
  /** false: records have no attachment (the form has no file field) */
  attachments?: boolean
  /** Tabs over a select field (e.g. Regular / Special Session) */
  tabs?: { field: string; options: string[] }
}

type RecordRow = Record<string, unknown> & {
  id: string
  filePath?: string
  fileType?: string
  termName?: string
}

const NO_TERMS = '— Add terms under City Councils → Terms —'

function RecordFormModal({
  config,
  open,
  onClose,
  onSuccess,
  logActivity,
  record,
  terms,
  committees,
  activeTab
}: {
  config: RecordsConfig
  open: boolean
  onClose: () => void
  onSuccess: () => void
  logActivity: (a: string) => Promise<void>
  record?: RecordRow
  terms: Term[]
  committees: Committee[]
  /** The tab shown on the page — a new record starts in it */
  activeTab: string
}) {
  const isEdit = !!record
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const termKey = config.fields.find((f) => f.kind === 'term')?.key
  const needsSessions = config.fields.some((f) => f.kind === 'session')
  const { sessions, reload: reloadSessions } = useSessions(needsSessions)
  const needsDraftReferences = config.fields.some((f) => f.kind === 'draftReference')
  const { references, reload: reloadReferences } = useDraftReferences(needsDraftReferences)

  useEffect(() => {
    if (!open) return
    if (needsSessions) void reloadSessions()
    if (needsDraftReferences) void reloadReferences()
    const initial: Record<string, string> = {}
    for (const f of config.fields) {
      if (record) initial[f.key] = record[f.key] == null ? '' : String(record[f.key])
      else if (f.kind === 'term') initial[f.key] = currentTerm(terms)?.id ?? ''
      else if (f.kind === 'select')
        initial[f.key] = (config.tabs?.field === f.key && activeTab) || f.options?.[0] || ''
      else initial[f.key] = ''
    }
    setForm(initial)
    setFile(null)
  }, [
    open,
    record,
    terms,
    config,
    activeTab,
    needsSessions,
    reloadSessions,
    needsDraftReferences,
    reloadReferences
  ])

  // Picking a session stores its number and fills the fields named in `fills` from it
  function pickSession(f: RecordField, id: string) {
    const session = sessions.find((s) => s.id === id)
    if (!session) {
      if (!id) setForm((prev) => ({ ...prev, [f.key]: '' }))
      return
    }
    setForm((prev) => {
      const next = { ...prev, [f.key]: session.sessionNo }
      for (const [target, source] of Object.entries(f.fills ?? {})) {
        const filled = source === 'date' ? toInputDate(session.date) : (session[source] ?? '')
        if (filled) next[target] = filled
      }
      return next
    })
  }

  // Committees of the term picked in the form (all of them without a term)
  const formTermId = termKey ? (form[termKey] ?? '') : ''
  const scopedCommittees = useMemo(
    () => committees.filter((c) => !formTermId || c.termId === formTermId),
    [committees, formTermId]
  )

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit() {
    for (const f of config.fields) {
      if (f.required && !(form[f.key] ?? '').trim()) {
        toast.error(`${f.label} is required`)
        return
      }
    }
    if (config.fileRequired && !isEdit && !file) {
      toast.error('Please attach a PDF file')
      return
    }
    setSaving(true)
    try {
      const data: Record<string, unknown> = {}
      for (const f of config.fields) {
        const value = (form[f.key] ?? '').trim()
        data[f.key] = f.kind === 'term' ? value || null : value
      }
      const name = String(data[config.nameField] ?? '')
      const filename = `${config.folder}_${name.slice(0, 60)}`
      if (isEdit)
        await updateDocumentWithFile(
          config.table,
          record!.id,
          data,
          config.folder,
          filename,
          file,
          record?.filePath ?? '',
          record?.fileType ?? ''
        )
      else await addDocumentWithFile(config.table, data, config.folder, filename, file)
      await logActivity(`${isEdit ? 'Updated' : 'Added'} ${config.noun} ${name}`)
      toast.success(isEdit ? 'Updated' : 'Added')
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  function input(f: RecordField) {
    const value = form[f.key] ?? ''
    switch (f.kind) {
      case 'date':
        return <Input type="date" value={value} onChange={set(f.key)} />
      case 'textarea':
        return (
          <TextArea
            value={value}
            onChange={set(f.key)}
            placeholder={f.placeholder ?? f.emptyText}
            rows={3}
          />
        )
      case 'select':
        return (
          <Select
            options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
            value={value}
            onChange={set(f.key)}
          />
        )
      case 'term':
        return (
          <Select
            options={terms.map((t) => ({ value: t.id, label: t.name }))}
            placeholder={terms.length ? '— No term —' : NO_TERMS}
            value={value}
            onChange={set(f.key)}
          />
        )
      case 'committee':
        return (
          <CommitteeField
            value={value}
            onChange={(title) => setForm((prev) => ({ ...prev, [f.key]: title }))}
            committees={scopedCommittees}
          />
        )
      case 'session':
        return (
          <SessionField
            value={value}
            onChange={(_sessionNo, session) => pickSession(f, session?.id ?? '')}
            sessions={sessions}
          />
        )
      case 'draftReference':
        return (
          <DraftReferenceField
            value={value}
            onChange={(code) => setForm((prev) => ({ ...prev, [f.key]: code }))}
            references={references}
          />
        )
      default:
        return (
          <Input value={value} onChange={set(f.key)} placeholder={f.placeholder ?? f.emptyText} />
        )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEdit ? 'Edit' : 'Add'} ${config.noun}`}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => void handleSubmit()} disabled={saving}>
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
        {config.fields.map((f) => (
          <FormField
            key={f.key}
            label={f.label}
            required={f.required}
            className={f.wide ? 'col-span-2' : undefined}
          >
            {input(f)}
          </FormField>
        ))}
        {config.attachments !== false && (
          <div className="col-span-2 border-t border-slate-100 pt-3">
            <FileUploadField
              value={file}
              onChange={setFile}
              required={config.fileRequired && !isEdit}
            />
            {isEdit && record?.filePath && !file && (
              <p className="text-xs text-slate-500 mt-1.5">
                Current file:{' '}
                <button
                  type="button"
                  onClick={() => void openStoredFile(record.filePath!)}
                  className="text-indigo-600 hover:underline cursor-pointer"
                >
                  View attached file
                </button>
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}

/**
 * Shared page for the document modules defined in recordPages.tsx: term filter, optional tabs,
 * a table, and an Add/Edit form with a PDF attachment.
 */
export function RecordsPage({ config }: { config: RecordsConfig }) {
  const user = useAuthStore((s) => s.user)
  const termKey = config.fields.find((f) => f.kind === 'term')?.key

  // Term filter: defaults to the term running today ('' = all terms)
  const { terms } = useTerms()
  const [termFilter, setTermFilter] = useState<string | null>(null)
  const activeTermId = termFilter ?? currentTerm(terms)?.id ?? ''
  const [tab, setTab] = useState(config.tabs?.options[0] ?? '')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const filters = useMemo(
    () => [
      ...(config.tabs ? [{ field: config.tabs.field, op: '==' as const, value: tab }] : []),
      ...(termKey && activeTermId
        ? [{ field: termKey, op: '==' as const, value: activeTermId }]
        : [])
    ],
    [config.tabs, tab, termKey, activeTermId]
  )
  const { items, loading, loadingMore, hasMore, reload, loadMore } = useListData<
    Record<string, unknown>
  >({
    endpoint: config.table,
    sortParam: `${config.dateField}|desc`,
    dataKey: config.table,
    filters,
    searchQuery: debouncedSearch
  })

  // Standing Committees, for modules that pick one
  const needsCommittees = config.fields.some((f) => f.kind === 'committee')
  const { committees } = useCommittees(needsCommittees)
  const draftCodeField = config.fields.find((f) => f.kind === 'draftReference')

  const columns = useMemo<Column<RecordRow>[]>(
    () =>
      config.fields.flatMap((f): Column<RecordRow>[] => {
        if (f.column === false) return []
        const width = f.column?.width
        if (f.kind === 'term') return [{ key: 'termName', header: 'Term', width: width ?? 'w-44' }]
        if (f.kind === 'date')
          return [
            {
              key: f.key,
              header: f.label,
              width: width ?? 'w-36',
              render: (r) => formatDate(String(r[f.key] ?? ''))
            }
          ]
        if (f.emptyText)
          return [
            {
              key: f.key,
              header: f.label,
              width,
              render: (r) =>
                r[f.key] ? String(r[f.key]) : <span className="text-slate-400">{f.emptyText}</span>
            }
          ]
        return [{ key: f.key, header: f.label, width }]
      }),
    [config.fields]
  )
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, config.table)

  const rows = useMemo(() => {
    const termById = new Map(terms.map((t) => [t.id, t.name]))
    return (items as RecordRow[]).map((r) => {
      const termId = termKey ? r[termKey] : undefined
      return { ...r, termName: typeof termId === 'string' ? (termById.get(termId) ?? '') : '' }
    })
  }, [items, terms, termKey])

  const [selected, setSelected] = useState<RecordRow | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const nameOf = (r: RecordRow | null) => String(r?.[config.nameField] ?? '')

  async function openRowFile(row: RecordRow) {
    if (!draftCodeField) {
      if (row.filePath) await openStoredFile(row.filePath)
      return
    }

    const code = String(row[draftCodeField.key] ?? '').trim()
    if (!code) {
      toast.error('This referral has no draft code')
      return
    }

    try {
      const reference = await findDraftReferenceFile(code)
      if (!reference) {
        toast.error(`No draft or communication found for code "${code}"`)
        return
      }
      if (!reference.filePath) {
        toast.error(`No file attached to ${reference.sourceLabel} "${code}"`)
        return
      }
      await openStoredFile(reference.filePath)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to find the referred draft')
    }
  }

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
      await deleteDocumentWithFile(config.table, selected.id)
      await logActivity(`Deleted ${config.noun} ${nameOf(selected)}`)
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
          title={config.title}
          subtitle={config.subtitle}
          icon={config.icon}
          actions={
            <>
              {termKey && (
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
              )}
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
          count={rows.length}
          hasMore={hasMore}
          columnsSlot={<ColumnsMenuButton columns={columns} hidden={hidden} onToggle={toggle} />}
        >
          {config.tabs && (
            <CategoryTabs
              options={config.tabs.options}
              value={tab}
              onChange={(value) => {
                setTab(value)
                setSelected(null)
              }}
            />
          )}
        </TableToolbar>
        <div className="card flex flex-col flex-1 min-h-0">
          <DataTable
            columns={visibleColumns}
            data={rows}
            selectedId={selected?.id}
            onRowClick={setSelected}
            rowActions={(r) => (
              <RowActions
                onOpen={draftCodeField || r.filePath ? () => void openRowFile(r) : undefined}
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
            onRowDoubleClick={(r) => void openRowFile(r)}
            loading={loading}
            emptyMessage={`No ${config.title.toLowerCase()} yet`}
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>

        <RecordFormModal
          config={config}
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
          terms={terms}
          committees={committees}
          activeTab={tab}
        />
        {selected && (
          <RecordFormModal
            config={config}
            open={showEdit}
            onClose={() => setShowEdit(false)}
            onSuccess={() => {
              setShowEdit(false)
              reload()
            }}
            logActivity={logActivity}
            record={selected}
            terms={terms}
            committees={committees}
            activeTab={tab}
          />
        )}
        <ConfirmDialog
          open={showDelete}
          title={`Delete ${config.noun}`}
          message={`Delete ${config.noun.toLowerCase()} "${nameOf(selected)}"?`}
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
