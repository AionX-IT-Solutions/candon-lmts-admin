import { useState, useMemo } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { Bike, Plus, RefreshCw } from 'lucide-react'
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
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import type { Tricycle } from '../../types'
import { formatDate, getFullName, sortByField } from '../../lib/utils'
import { TricycleFormModal } from './TricycleFormModal'

type Variant = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'indigo' | 'cyan'

const NATURE_BADGE: Record<string, Variant> = {
  New: 'green',
  Reissued: 'blue',
  Expired: 'gray',
  Compliance: 'cyan',
  'Legal Sale': 'indigo',
  'Illegal Sale': 'red',
  Amnesty: 'yellow',
  Transfer: 'purple'
}

const CATEGORY_BADGE: Record<string, Variant> = {
  City: 'blue',
  Barangay: 'green',
  Reissue: 'purple'
}

const columns: Column<Tricycle>[] = [
  { key: 'name', header: 'Applicant Name', width: 'w-40' },
  { key: 'franchiseNo', header: 'Franchise No.', width: 'w-28' },
  { key: 'ordinanceNumber', header: 'Ordinance No.', width: 'w-28' },
  { key: 'plateNo', header: 'Plate No.', width: 'w-24' },
  { key: 'make', header: 'Make/Model', width: 'w-28' },
  { key: 'motorNo', header: 'Motor No.', width: 'w-28' },
  {
    key: 'natureOfFranchise',
    header: 'Nature',
    width: 'w-28',
    render: (r) => (
      <Badge variant={NATURE_BADGE[r.natureOfFranchise] ?? 'gray'}>{r.natureOfFranchise}</Badge>
    )
  },
  {
    key: 'category',
    header: 'Category',
    width: 'w-28',
    render: (r) => <Badge variant={CATEGORY_BADGE[r.category] ?? 'gray'}>{r.category}</Badge>
  },
  { key: 'action', header: 'Action', width: 'w-28' },
  {
    key: 'expiration',
    header: 'Expiration',
    width: 'w-28',
    render: (r) => <span className="text-xs">{formatDate(r.expiration)}</span>
  },
  {
    key: 'dateReceived',
    header: 'Date Received',
    width: 'w-28',
    render: (r) => <span className="text-xs">{formatDate(r.dateReceived)}</span>
  }
]

export function TricyclePage() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, reload, loadMore, sortField, sortDirection } =
    useListData<Record<string, unknown>>({
      endpoint: 'tricycle_franchises',
      sortParam: 'franchiseNo|desc',
      dataKey: 'tricy',
      limit: 100,
      searchQuery: debouncedSearch
    })
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'tricycle-franchise')

  const [selected, setSelected] = useState<Tricycle | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const filtered = useMemo(() => {
    const base = items as unknown as Tricycle[]
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
    ) as unknown as Tricycle[]
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
      await deleteDocumentWithFile('tricycle_franchises', selected.id)
      await logActivity(`Deleted Tricycle Franchise: ${selected.name}`)
      toast.success('Franchise record deleted')
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
          title="Tricycle Franchise"
          subtitle="Tricycle franchises and their renewals"
          icon={<Bike size={20} />}
          actions={
            <>
              <button className="btn-ghost" onClick={reload}>
                <RefreshCw size={15} />
                Refresh
              </button>
              <Allowed action="add">
                <button className="btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={15} />
                  Add Franchise
                </button>
              </Allowed>
            </>
          }
        />
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, plate, franchise number…"
          count={filtered.length}
          hasMore={hasMore}
          columnsSlot={<ColumnsMenuButton columns={columns} hidden={hidden} onToggle={toggle} />}
        ></TableToolbar>
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
            emptyMessage="No tricycle franchise records found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
        <TricycleFormModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSuccess={() => {
            setShowAdd(false)
            reload()
          }}
          logActivity={logActivity}
        />
        {selected && (
          <TricycleFormModal
            open={showEdit}
            onClose={() => setShowEdit(false)}
            onSuccess={() => {
              setShowEdit(false)
              reload()
            }}
            logActivity={logActivity}
            tricycle={selected}
          />
        )}
        <ConfirmDialog
          open={showDelete}
          title="Delete Franchise"
          message={`Delete franchise record for ${selected?.name}?`}
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
