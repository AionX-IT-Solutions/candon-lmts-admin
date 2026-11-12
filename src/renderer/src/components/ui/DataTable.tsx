import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Inbox,
  Loader2
} from 'lucide-react'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => ReactNode
  width?: string
  align?: 'left' | 'center' | 'right'
  /** Click-to-sort on the header (default true) */
  sortable?: boolean
}

// Maps the Tailwind width classes used across table column configs to a px value,
// used as each column's initial (user-resizable) width.
const WIDTH_CLASS_PX: Record<string, number> = {
  'w-16': 64,
  'w-20': 80,
  'w-24': 96,
  'w-28': 112,
  'w-32': 128,
  'w-36': 144,
  'w-40': 160,
  'w-44': 176,
  'w-48': 192,
  'w-56': 224,
  'w-64': 256
}

const MIN_COL_WIDTH = 60
const ACTIONS_WIDTH = 116
const PAGE_SIZE_OPTIONS = [25, 50, 100]

function initialColumnWidth(width?: string): number {
  return (width && WIDTH_CLASS_PX[width]) || 240
}

interface DataTableProps<T extends { id?: string }> {
  columns: Column<T>[]
  data: T[]
  /** Still accepted from pages, but the selected row is not highlighted */
  selectedId?: string | null
  onRowClick?: (row: T) => void
  onRowDoubleClick?: (row: T) => void
  /** Renders the trailing Actions column (e.g. <RowActions />) */
  rowActions?: (row: T) => ReactNode
  loading?: boolean
  loadingMore?: boolean
  /** More rows exist on the server — called when the user pages to the end of what's loaded */
  onEndReached?: () => void
  emptyMessage?: string
}

const pagerButton = (disabled: boolean) => ({
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  border: '1px solid var(--c-border)',
  background: 'var(--bg-elevated)',
  color: disabled ? 'var(--c-text-3)' : 'var(--c-text-2)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.45 : 1,
  padding: 0
})

/** GSPIS-style data table: sortable headers, resizable columns, row actions and pagination. */
export function DataTable<T extends { id?: string }>({
  columns,
  data,
  onRowClick,
  onRowDoubleClick,
  rowActions,
  loading,
  loadingMore,
  onEndReached,
  emptyMessage = 'No records found'
}: DataTableProps<T>) {
  const colRefs = useRef<(HTMLTableColElement | null)[]>([])
  const [colWidths, setColWidths] = useState<number[]>(() =>
    columns.map((c) => initialColumnWidth(c.width))
  )
  const [resizingIndex, setResizingIndex] = useState<number | null>(null)
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Keep colWidths in sync if the column set changes shape (e.g. columns toggled)
  useEffect(() => {
    setColWidths((prev) => {
      if (prev.length === columns.length) return prev
      return columns.map((c, i) => prev[i] ?? initialColumnWidth(c.width))
    })
  }, [columns])

  // New data (search, reload) starts at page 1; rows appended by "load more" keep the page.
  const firstId = data[0]?.id
  const previous = useRef({ firstId, length: data.length })
  useEffect(() => {
    const p = previous.current
    if (!(p.firstId === firstId && data.length >= p.length)) setPage(1)
    previous.current = { firstId, length: data.length }
  }, [data, firstId])

  useEffect(() => {
    setPage(1)
  }, [sortKey, sortDir, pageSize])

  function startResize(e: React.MouseEvent, index: number) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = colWidths[index]
    const colEl = colRefs.current[index]
    setResizingIndex(index)

    function onMove(ev: MouseEvent) {
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + (ev.clientX - startX))
      if (colEl) colEl.style.width = `${newWidth}px`
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setResizingIndex(null)
      if (colEl) {
        const finalWidth = parseInt(colEl.style.width, 10)
        setColWidths((prev) => {
          const next = [...prev]
          next[index] = finalWidth
          return next
        })
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // While a column is being resized, show the resize cursor everywhere and stop text selection.
  useEffect(() => {
    if (resizingIndex === null) return
    const { style } = document.body
    style.cursor = 'col-resize'
    style.userSelect = 'none'
    return () => {
      style.cursor = ''
      style.userSelect = ''
    }
  }, [resizingIndex])

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const aVal = String((a as Record<string, unknown>)[sortKey] ?? '')
      const bVal = String((b as Record<string, unknown>)[sortKey] ?? '')
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir])

  const totalCount = sortedData.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalCount)
  const pageData = sortedData.slice((safePage - 1) * pageSize, safePage * pageSize)

  // On the last loaded page with more on the server → fetch the next batch.
  useEffect(() => {
    if (onEndReached && !loading && !loadingMore && safePage >= totalPages) onEndReached()
  }, [onEndReached, loading, loadingMore, safePage, totalPages])

  if (loading) {
    return (
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 40, borderRadius: 8, opacity: 1 - i * 0.1 }}
          />
        ))}
      </div>
    )
  }

  const colCount = columns.length + (rowActions ? 1 : 0)
  const thBase = {
    position: 'relative' as const,
    padding: '11px 16px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    userSelect: 'none' as const
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="scrollbar-thin" style={{ overflow: 'auto', flex: 1 }}>
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}
        >
          <colgroup>
            {columns.map((_, i) => (
              <col
                key={i}
                ref={(el) => {
                  colRefs.current[i] = el
                }}
                style={{ width: colWidths[i] }}
              />
            ))}
            {rowActions && <col style={{ width: ACTIONS_WIDTH }} />}
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr
              style={{
                background: 'var(--c-thead-bg)',
                borderBottom: '2px solid var(--c-divider)'
              }}
            >
              {columns.map((col, i) => {
                const key = String(col.key)
                const sortable = col.sortable !== false
                const isActive = sortKey === key
                return (
                  <th
                    key={key}
                    onClick={sortable ? () => handleSort(key) : undefined}
                    style={{
                      ...thBase,
                      textAlign:
                        col.align === 'right'
                          ? 'right'
                          : col.align === 'center'
                            ? 'center'
                            : 'left',
                      color: isActive ? 'var(--c-accent)' : 'var(--c-text-3)',
                      borderRight: i < colCount - 1 ? '1px solid var(--c-divider)' : 'none',
                      cursor: sortable ? 'pointer' : 'default',
                      transition: 'color 0.15s'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.header}
                      {sortable && (
                        <span
                          style={{ opacity: isActive ? 1 : 0.35, flexShrink: 0, lineHeight: 0 }}
                        >
                          {isActive ? (
                            sortDir === 'asc' ? (
                              <ChevronUp size={11} />
                            ) : (
                              <ChevronDown size={11} />
                            )
                          ) : (
                            <ChevronsUpDown size={11} />
                          )}
                        </span>
                      )}
                    </span>
                    {/* Resize handle — separate from the header's sort click */}
                    <div
                      onMouseDown={(e) => startResize(e, i)}
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-accent)')}
                      onMouseLeave={(e) => {
                        if (resizingIndex !== i) e.currentTarget.style.background = 'transparent'
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: -2,
                        bottom: 0,
                        width: 5,
                        cursor: 'col-resize',
                        zIndex: 11,
                        background: resizingIndex === i ? 'var(--c-accent)' : 'transparent'
                      }}
                    />
                  </th>
                )
              })}
              {rowActions && (
                <th style={{ ...thBase, textAlign: 'right', color: 'var(--c-text-3)' }}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={colCount}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      padding: '56px 0',
                      color: 'var(--c-text-3)'
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--c-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Inbox size={22} color="var(--c-text-3)" strokeWidth={1.5} />
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--c-text-3)', fontWeight: 500 }}>
                      {emptyMessage}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              pageData.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className="table-row-hover"
                  style={{
                    borderBottom: '1px solid var(--c-divider)',
                    cursor: onRowClick ? 'pointer' : 'default'
                  }}
                  onClick={() => onRowClick?.(row)}
                  onDoubleClick={() => onRowDoubleClick?.(row)}
                >
                  {columns.map((col, ci) => {
                    const rawVal = (row as Record<string, unknown>)[String(col.key)]
                    const val = col.render ? col.render(row) : String(rawVal ?? '-')
                    return (
                      <td
                        key={String(col.key)}
                        style={{
                          padding: '11px 16px',
                          color: 'var(--c-text-2)',
                          textAlign:
                            col.align === 'right'
                              ? 'right'
                              : col.align === 'center'
                                ? 'center'
                                : 'left',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          borderRight: ci < colCount - 1 ? '1px solid var(--c-divider)' : 'none',
                          fontSize: 13
                        }}
                        title={typeof val === 'string' ? val : undefined}
                      >
                        {val}
                      </td>
                    )
                  })}
                  {rowActions && (
                    <td style={{ padding: '5px 12px', textAlign: 'right' }}>{rowActions(row)}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderTop: '1px solid var(--c-divider)',
          background: 'var(--c-thead-bg)',
          flexShrink: 0,
          gap: 12,
          fontSize: 12,
          color: 'var(--c-text-3)'
        }}
      >
        <span
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
        >
          <span>
            Showing{' '}
            <b style={{ color: 'var(--c-text-2)' }}>
              {start}–{end}
            </b>{' '}
            of{' '}
            <b style={{ color: 'var(--c-text-2)' }}>
              {totalCount}
              {onEndReached ? '+' : ''}
            </b>
          </span>
          {loadingMore && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
              Loading more…
            </span>
          )}
        </span>

        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            border: '1px solid var(--c-border)',
            background: 'var(--bg-elevated)',
            color: 'var(--c-text-2)',
            fontSize: 12,
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <span>
            Page <b style={{ color: 'var(--c-text-2)' }}>{safePage}</b> of{' '}
            <b style={{ color: 'var(--c-text-2)' }}>
              {totalPages}
              {onEndReached ? '+' : ''}
            </b>
          </span>
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={pagerButton(safePage <= 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={pagerButton(safePage >= totalPages)}
            aria-label="Next page"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
