import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

interface TableToolbarProps {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /** Rows currently listed */
  count?: number
  /** More rows exist on the server than are loaded (shows "100+ rows") */
  hasMore?: boolean
  /** Extra controls (filters) placed after the search box */
  children?: ReactNode
  /** Usually <ColumnsMenuButton /> */
  columnsSlot?: ReactNode
}

/** Glass bar above a table: search, row count and the Columns menu (GSPIS style). */
export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  count,
  hasMore,
  children,
  columnsSlot
}: TableToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        padding: '10px 14px',
        marginBottom: 12,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid var(--glass-border)',
        borderRadius: 12,
        flexShrink: 0
      }}
    >
      {onSearchChange && (
        <div style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none'
            }}
          />
          <input
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              width: '100%',
              height: 32,
              paddingLeft: 30,
              paddingRight: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)'
              e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-primary-subtle)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-default)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
      )}

      {children}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
        {typeof count === 'number' && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 999,
              padding: '3px 10px',
              whiteSpace: 'nowrap'
            }}
          >
            {count}
            {hasMore ? '+' : ''} {count === 1 && !hasMore ? 'row' : 'rows'}
          </span>
        )}
        {columnsSlot}
      </div>
    </div>
  )
}
