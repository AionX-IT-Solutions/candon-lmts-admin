import { useMemo, useState } from 'react'
import { FileCheck, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { addDocument, deleteDocumentWithFile, openStoredFile } from '../../lib/db'
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
import type { Resolution } from '../../types'
import { formatDate, getFullName, sortByField } from '../../lib/utils'
import { ResolutionFormModal } from './ResolutionFormModal'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'

const CATEGORIES = ['General Resolutions', 'Commendations', 'Posthumous']

const catColor = (c: string) => {
  if (c === 'General Resolutions') return 'purple'
  if (c === 'Commendations') return 'blue'
  if (c === 'Posthumous') return 'gray'
  return 'gray'
}

const columns: Column<Resolution>[] = [
  { key: 'resolutionNumber', header: 'Res. No.', width: 'w-28' },
  {
    key: 'category',
    header: 'Category',
    width: 'w-40',
    render: (r) => (
      <Badge variant={catColor(r.category) as 'purple' | 'blue' | 'gray'}>{r.category}</Badge>
    )
  },
  { key: 'title', header: 'Title' },
  { key: 'author', header: 'Author', width: 'w-36' },
  { key: 'tag', header: 'Tag', width: 'w-28' },
  {
    key: 'dateApprovedSp',
    header: 'Date Approved',
    width: 'w-32',
    render: (r) => <span className="text-xs">{formatDate(r.dateApprovedSp)}</span>
  },
  { key: 'actionSp', header: 'Action (SP)', width: 'w-28' }
]

export function ResolutionsPage() {
  const user = useAuthStore((s) => s.user)
  const [category, setCategory] = useState('General Resolutions')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const filters = useMemo(
    () => [{ field: 'category', op: '==' as const, value: category }],
    [category]
  )
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'resolutions',
      // See OrdinancesPage: codeSortKey is backfilled and Firestore-sortable,
      // so pagination can rely on the server-side order again.
      sortParam: 'codeSortKey|desc',
      dataKey: 'resolution',
      limit: 100,
      filters,
      searchQuery: debouncedSearch
    })

  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'resolutions')

  const [selected, setSelected] = useState<Resolution | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const base = items as unknown as Resolution[]
    const q = debouncedSearch.toLowerCase()
    const result = !debouncedSearch.trim()
      ? base
      : base.filter((r) =>
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
    ) as unknown as Resolution[]
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
      await deleteDocumentWithFile('resolutions', selected.id)
      await logActivity(`Deleted Resolution Number ${selected.resolutionNumber}`)
      toast.success('Resolution deleted')
      setShowDelete(false)
      setSelected(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  function openFile() {
    if (selected?.filePath) void openStoredFile(selected.filePath)
    else toast.error('No file attached')
  }

  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="Resolutions"
          subtitle="Adopted resolutions and their approval history"
          icon={<FileCheck size={20} />}
          actions={
            <>
              <button className="btn-ghost" onClick={reload}>
                <RefreshCw size={15} />
                Refresh
              </button>
              <Allowed action="add">
                <button className="btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Add Resolution
                </button>
              </Allowed>
            </>
          }
        />
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by number, title, author, tag…"
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
            onRowClick={(row) => setSelected(row as unknown as Resolution)}
            rowActions={(row) => {
              const r = row as unknown as Resolution
              return (
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
              )
            }}
            onRowDoubleClick={openFile}
            loading={loading}
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
            emptyMessage="No resolutions found"
          />
        </div>
        <ResolutionFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <ResolutionFormModal
            open={showEdit}
            onClose={() => setShowEdit(false)}
            onSuccess={() => {
              setShowEdit(false)
              reload()
            }}
            logActivity={logActivity}
            resolution={selected}
          />
        )}
        <ConfirmDialog
          open={showDelete}
          title="Delete Resolution"
          message={`Delete Resolution No. ${selected?.resolutionNumber}?`}
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
