import type { MouseEvent, ReactNode } from 'react'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { usePagePermissions } from '../../hooks/usePagePermissions'
import { Tooltip } from './Tooltip'

function RowActionButton({
  title,
  onClick,
  danger,
  children
}: {
  title: string
  onClick: () => void
  danger?: boolean
  children: ReactNode
}) {
  // Keep the row's own click/double-click (select / open file) from also firing.
  const stop = (e: MouseEvent) => e.stopPropagation()
  return (
    <Tooltip content={title} side="top">
      <button
        type="button"
        aria-label={title}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onDoubleClick={stop}
        style={{
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 7,
          border: '1px solid transparent',
          background: 'transparent',
          color: 'var(--c-text-3)',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.12)' : 'var(--c-nav-hover)'
          e.currentTarget.style.borderColor = danger ? 'rgba(239,68,68,0.25)' : 'var(--c-border)'
          e.currentTarget.style.color = danger ? '#ef4444' : 'var(--c-text-1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
          e.currentTarget.style.color = 'var(--c-text-3)'
        }}
      >
        {children}
      </button>
    </Tooltip>
  )
}

/**
 * Per-row icon actions for a table's Actions column (GSPIS style). Edit and Delete show only
 * when the signed-in account may do them in the page's module.
 */
export function RowActions({
  onOpen,
  onEdit,
  onDelete
}: {
  /** Shows the record's attached file in the in-app viewer; omit when there is none */
  onOpen?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { canEdit, canDelete } = usePagePermissions()
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
      {onOpen && (
        <RowActionButton title="View" onClick={onOpen}>
          <Eye size={13} />
        </RowActionButton>
      )}
      {onEdit && canEdit && (
        <RowActionButton title="Edit" onClick={onEdit}>
          <Pencil size={13} />
        </RowActionButton>
      )}
      {onDelete && canDelete && (
        <RowActionButton title="Delete" onClick={onDelete} danger>
          <Trash2 size={13} />
        </RowActionButton>
      )}
    </div>
  )
}
