import { useState, useMemo } from 'react'
import { useListData } from '../../hooks/useListData'
import { useDebounce } from '../../hooks/useDebounce'
import { Activity } from 'lucide-react'
import { Layout, PageContainer } from '../../components/layout/Layout'
import { PageHeader } from '../../components/ui/PageHeader'
import { useColumnVisibility, ColumnsMenuButton } from '../../components/ui/ColumnsMenu'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { TableToolbar } from '../../components/ui/TableToolbar'
import type { Log } from '../../types'
import { sortByField } from '../../lib/utils'

type LogRow = Log & { id: string; index: number }

const columns: Column<LogRow>[] = [
  { key: 'index', header: '#', width: 'w-16', sortable: false },
  {
    key: 'name',
    header: 'User',
    width: 'w-44',
    render: (r) => (
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)' }}>
        {r.name}
      </span>
    )
  },
  { key: 'activity', header: 'Activity' },
  { key: 'date', header: 'Date / Time', width: 'w-64' }
]

export function LogsPage() {
  const { visibleColumns, hidden, toggle } = useColumnVisibility(columns, 'activity-log')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const { items, loading, loadingMore, hasMore, loadMore, sortField, sortDirection } = useListData<
    Record<string, unknown>
  >({
    endpoint: 'activity_logs',
    sortParam: 'createdAt|desc',
    dataKey: 'activity_logs',
    searchQuery: debouncedSearch
  })

  const filtered = useMemo(() => {
    const base = items as unknown as (Log & { id: string })[]
    const q = debouncedSearch.toLowerCase()
    const result = !debouncedSearch.trim()
      ? base
      : base.filter(
          (l) =>
            l.name?.toLowerCase().includes(q) ||
            l.activity?.toLowerCase().includes(q) ||
            l.date?.toLowerCase().includes(q)
        )
    const sorted = sortByField(
      result as unknown as Record<string, unknown>[],
      sortField,
      sortDirection
    ) as unknown as (Log & { id: string })[]
    return sorted.map((l, i): LogRow => ({ ...l, index: i + 1 }))
  }, [items, debouncedSearch, sortField, sortDirection])

  return (
    <Layout>
      <PageContainer>
        <PageHeader
          title="Activity Log"
          subtitle="Every change made in LMTS, newest first"
          icon={<Activity size={18} />}
        />
        <TableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by user, activity or date…"
          count={filtered.length}
          hasMore={hasMore}
          columnsSlot={<ColumnsMenuButton columns={columns} hidden={hidden} onToggle={toggle} />}
        />
        <div className="card flex flex-col flex-1 min-h-0">
          <DataTable
            columns={visibleColumns}
            data={filtered}
            loading={loading}
            emptyMessage="No activity logs found"
            loadingMore={loadingMore}
            onEndReached={hasMore ? loadMore : undefined}
          />
        </div>
      </PageContainer>
    </Layout>
  )
}
