import { useState, useMemo, useEffect } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { BarChart2, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { addDocument, updateDocument, deleteDocument, fetchDocs } from '../../lib/db'
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
import { Spinner } from '../../components/ui/Spinner'
import type { Committee, Official, Term } from '../../types'
import { currentTerm, useTerms } from '../../lib/terms'
import { officialName } from '../../lib/orgChart'
import { getFullName, sortByField } from '../../lib/utils'

const columns: Column<Committee>[] = [
  { key: 'title', header: 'Title' },
  { key: 'termName', header: 'Term', width: 'w-32' },
  { key: 'chairman', header: 'Chairman', width: 'w-44' },
  { key: 'viceChairman', header: 'Vice Chairman', width: 'w-44' },
  {
    key: 'members',
    header: 'Members',
    render: (r) => <span className="text-xs">{(r.members ?? []).join(', ')}</span>
  }
]

const EMPTY_FORM = {
  title: '',
  termId: '',
  description: '',
  chairman: '',
  viceChairman: '',
  members: [] as string[]
}

function CommitteeFormModal({
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
  record?: Committee
  /** Council terms — the "Term" choices */
  terms: Term[]
}) {
  const isEdit = !!record
  const [saving, setSaving] = useState(false)
  const [officials, setOfficials] = useState<Official[]>([])
  const [loadingOfficials, setLoadingOfficials] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (open) {
      setForm(
        record
          ? {
              title: record.title ?? '',
              termId: record.termId ?? '',
              description: record.description ?? '',
              chairman: record.chairman ?? '',
              viceChairman: record.viceChairman ?? '',
              members: record.members ?? []
            }
          : { ...EMPTY_FORM, termId: currentTerm(terms)?.id ?? '' }
      )

      setLoadingOfficials(true)
      fetchDocs<Official>('officials', {
        orderByField: 'lastName',
        direction: 'asc',
        pageSize: 200
      })
        .then((res) => setOfficials(res.items))
        .catch((err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to load officials')
        )
        .finally(() => setLoadingOfficials(false))
    }
  }, [open, record, terms])

  // Officials of the chosen term (all officials when no term), keeping anyone already assigned
  const officialNames = useMemo(() => {
    const inTerm = officials
      .filter((o) => !form.termId || o.termId === form.termId)
      .map(officialName)
    const assigned = [form.chairman, form.viceChairman, ...form.members].filter(Boolean)
    return [...new Set([...inTerm, ...assigned])]
  }, [officials, form.termId, form.chairman, form.viceChairman, form.members])
  const officialOptions = useMemo(
    () => officialNames.map((name) => ({ value: name, label: name })),
    [officialNames]
  )

  const set =
    (k: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const toggleMember = (name: string) =>
    setForm((f) => ({
      ...f,
      members: f.members.includes(name) ? f.members.filter((m) => m !== name) : [...f.members, name]
    }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.chairman.trim() || !form.viceChairman.trim()) {
      toast.error('Title, Chairman, and Vice Chairman are required')
      return
    }
    setSaving(true)
    try {
      const data = { ...form, termId: form.termId || null }
      if (isEdit) await updateDocument('committees', record!.id, data)
      else await addDocument('committees', data)
      await logActivity(`${isEdit ? 'Updated' : 'Created'} Committee ${form.title}`)
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
      title={isEdit ? 'Edit Committee' : 'Add Committee'}
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
        <FormField label="Committee Title" required className="col-span-2">
          <Input
            value={form.title}
            onChange={set('title')}
            placeholder="e.g. Committee on Finance"
          />
        </FormField>
        <FormField label="Term">
          <Select
            options={terms.map((t) => ({ value: t.id, label: t.name }))}
            placeholder={terms.length ? '— No term —' : '— Add terms under City Councils → Terms —'}
            value={form.termId}
            onChange={set('termId')}
          />
        </FormField>
        <FormField label="Description" className="col-span-2">
          <TextArea value={form.description} onChange={set('description')} rows={3} />
        </FormField>
        <FormField label="Chairman" required>
          {loadingOfficials ? (
            <div className="input-field flex items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : (
            <Select
              options={officialOptions}
              value={form.chairman}
              onChange={set('chairman')}
              placeholder="Select chairman"
            />
          )}
        </FormField>
        <FormField label="Vice Chairman" required>
          {loadingOfficials ? (
            <div className="input-field flex items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : (
            <Select
              options={officialOptions}
              value={form.viceChairman}
              onChange={set('viceChairman')}
              placeholder="Select vice chairman"
            />
          )}
        </FormField>
        <FormField label="Members" className="col-span-2">
          {loadingOfficials ? (
            <div className="input-field flex items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
              {officialNames.length === 0 && (
                <p className="col-span-2 text-xs text-slate-500">
                  No officials in this term yet — add them under City Councils → Officials.
                </p>
              )}
              {officialNames.map((name) => (
                <label key={name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.members.includes(name)}
                    onChange={() => toggleMember(name)}
                  />
                  {name}
                </label>
              ))}
            </div>
          )}
        </FormField>
      </form>
    </Modal>
  )
}

export function CommitteesPage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'committees',
      sortParam: 'title|desc',
      dataKey: 'committee',
      searchQuery: debouncedSearch
    })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'standing-committees')

  const [selected, setSelected] = useState<Committee | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { terms } = useTerms()
  const filtered = useMemo(() => {
    const termById = new Map(terms.map((t) => [t.id, t.name]))
    const arr = (items as unknown as Committee[]).map((c) => ({
      ...c,
      termName: c.termId ? (termById.get(c.termId) ?? '') : ''
    }))
    const q = debouncedSearch.toLowerCase()
    const result = !debouncedSearch.trim()
      ? arr
      : arr.filter((r) =>
          Object.values(r as unknown as Record<string, unknown>).some((v) =>
            String(Array.isArray(v) ? v.join(', ') : (v ?? ''))
              .toLowerCase()
              .includes(q)
          )
        )
    return sortByField(
      result as unknown as Record<string, unknown>[],
      sortField,
      sortDirection
    ) as unknown as Committee[]
  }, [items, terms, debouncedSearch, sortField, sortDirection])

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
      await deleteDocument('committees', selected.id)
      await logActivity(`Deleted Committee ${selected.title}`)
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
          title="Standing Committees"
          subtitle="Standing committees and their members"
          icon={<BarChart2 size={20} />}
          actions={
            <>
              <button className="btn-ghost" onClick={reload}>
                <RefreshCw size={15} />
                Refresh
              </button>
              <Allowed action="add">
                <button className="btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Add Committee
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
            emptyMessage="No committee records found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
        <CommitteeFormModal
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
          <CommitteeFormModal
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
          title="Delete Committee"
          message={`Delete Committee ${selected?.title}?`}
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
