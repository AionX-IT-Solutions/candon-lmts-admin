import { useMemo, useState } from 'react'
import { ScrollText, Plus, RefreshCw } from 'lucide-react'
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
import type { Ordinance } from '../../types'
import { formatDate, getFullName, sortByField } from '../../lib/utils'
import { OrdinanceFormModal } from './OrdinanceFormModal'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'

const CATEGORIES = ['General Ordinance', 'Appropriation', 'Tax Ordinance']

const categoryColor = (c: string) => {
  if (c === 'General Ordinance') return 'blue'
  if (c === 'Appropriation') return 'green'
  if (c === 'Tax Ordinance') return 'yellow'
  return 'gray'
}

const columns: Column<Ordinance>[] = [
  { key: 'ordinanceNumber', header: 'Ord. No.', width: 'w-28' },
  {
    key: 'category',
    header: 'Category',
    width: 'w-36',
    render: (row) => (
      <Badge variant={categoryColor(row.category) as 'blue' | 'green' | 'yellow' | 'gray'}>
        {row.category}
      </Badge>
    )
  },
  { key: 'title', header: 'Title' },
  { key: 'author', header: 'Author', width: 'w-36' },
  { key: 'tag', header: 'Tag', width: 'w-28' },
  {
    key: 'dateApprovedSp',
    header: 'Date Approved (SP)',
    width: 'w-36',
    render: (row) => <span className="text-xs">{formatDate(row.dateApprovedSp)}</span>
  },
  { key: 'actionSp', header: 'Action (SP)', width: 'w-32' },
  {
    key: 'dateReceived',
    header: 'Date Received',
    width: 'w-32',
    render: (row) => <span className="text-xs">{formatDate(row.dateReceived)}</span>
  }
]

export function OrdinancesPage() {
  const user = useAuthStore((s) => s.user)
  const [category, setCategory] = useState('General Ordinance')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const filters = useMemo(
    () => [{ field: 'category', op: '==' as const, value: category }],
    [category]
  )
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'ordinances',
      // codeSortKey is a backfilled, zero-padded field (see computeCodeSortKey
      // in utils.ts) that orders correctly at the Firestore level, so
      // pagination no longer has to guess — page 1 already contains the most
      // recent records.
      sortParam: 'codeSortKey|desc',
      dataKey: 'ordinance',
      limit: 100,
      filters,
      searchQuery: debouncedSearch
    })

  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'ordinances')

  const [selected, setSelected] = useState<Ordinance | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const base = items as unknown as Ordinance[]
    const q = debouncedSearch.toLowerCase()
    const result = !debouncedSearch.trim()
      ? base
      : base.filter((o) =>
          Object.values(o as unknown as Record<string, unknown>).some((v) =>
            String(v ?? '')
              .toLowerCase()
              .includes(q)
          )
        )
    return sortByField(
      result as unknown as Record<string, unknown>[],
      sortField,
      sortDirection
    ) as unknown as Ordinance[]
  }, [items, debouncedSearch, sortField, sortDirection])

  async function handleDelete() {
    if (!selected) return
    setDeleting(true)
    try {
      await deleteDocumentWithFile('ordinances', selected.id)
      await logActivity(`Deleted Ordinance Number ${selected.ordinanceNumber}`)
      toast.success('Ordinance deleted')
      setShowDelete(false)
      setSelected(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete ordinance')
    } finally {
      setDeleting(false)
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

  function openFile() {
    if (selected?.filePath) void openStoredFile(selected.filePath)
    else toast.error('No file attached')
  }

  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="Ordinances"
          subtitle="Enacted city ordinances and their approval history"
          icon={<ScrollText size={20} />}
          actions={
            <>
              <button className="btn-ghost" onClick={reload}>
                <RefreshCw size={15} />
                Refresh
              </button>
              <Allowed action="add">
                <button className="btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Add Ordinance
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
            onRowClick={(row) => setSelected(row as unknown as Ordinance)}
            rowActions={(row) => {
              const r = row as unknown as Ordinance
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
            emptyMessage="No ordinances found for this category"
          />
        </div>

        <OrdinanceFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <OrdinanceFormModal
            open={showEdit}
            onClose={() => setShowEdit(false)}
            onSuccess={() => {
              setShowEdit(false)
              reload()
            }}
            logActivity={logActivity}
            ordinance={selected}
          />
        )}
        <ConfirmDialog
          open={showDelete}
          title="Delete Ordinance"
          message={`Are you sure you want to delete Ordinance No. ${selected?.ordinanceNumber}? This cannot be undone.`}
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
