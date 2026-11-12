import { useState } from 'react'
import { useFileUrl } from '../../hooks/useFileUrl'
import { officialName, type OfficialTreeNode } from '../../lib/orgChart'

const CONNECTOR_COLOR = 'var(--border-default)'
const AVATAR_PALETTE = [
  '#6366f1',
  '#06b6d4',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6'
]

function avatarColor(id: string): string {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}

interface OfficialOrgChartNodeProps {
  node: OfficialTreeNode
  editMode?: boolean
  draggedId?: string | null
  invalidDropIds?: Set<string>
  onDragStartNode?: (officialId: string) => void
  onDragEndNode?: () => void
  onReparent?: (officialId: string, newReportsToId: string | null) => void
  /** official id → their committees, listed under the position */
  committees?: Map<string, string[]>
}

/** One official in the organization chart, with its reports drawn underneath (GSPIS style). */
export function OfficialOrgChartNode({
  node,
  editMode = false,
  draggedId = null,
  invalidDropIds,
  onDragStartNode,
  onDragEndNode,
  onReparent,
  committees
}: OfficialOrgChartNodeProps) {
  const { official, children } = node
  const hasChildren = children.length > 0
  const [dragOver, setDragOver] = useState(false)
  const photoUrl = useFileUrl(official.filePath)
  const color = avatarColor(official.id)
  const name = officialName(official)
  const officialCommittees = committees?.get(official.id)
  const initials = `${official.firstName?.[0] ?? ''}${official.lastName?.[0] ?? ''}`.toUpperCase()

  const isBeingDragged = editMode && draggedId === official.id
  const isValidDropTarget =
    editMode && !!draggedId && draggedId !== official.id && !invalidDropIds?.has(official.id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div
        draggable={editMode}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', official.id)
          onDragStartNode?.(official.id)
        }}
        onDragEnd={() => {
          setDragOver(false)
          onDragEndNode?.()
        }}
        onDragOver={(e) => {
          if (!isValidDropTarget) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        }}
        onDragEnter={(e) => {
          if (!isValidDropTarget) return
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!isValidDropTarget || !draggedId) return
          e.preventDefault()
          e.stopPropagation()
          setDragOver(false)
          onReparent?.(draggedId, official.id)
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          width: 172,
          padding: '14px 10px',
          borderRadius: 12,
          background: dragOver ? 'var(--accent-primary-subtle)' : 'var(--glass-bg)',
          border: `1px solid ${dragOver ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
          cursor: editMode ? (isBeingDragged ? 'grabbing' : 'grab') : 'default',
          textAlign: 'center',
          flexShrink: 0,
          opacity: isBeingDragged ? 0.4 : 1,
          transition:
            'border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, opacity 0.15s ease'
        }}
        onMouseEnter={(e) => {
          if (dragOver) return
          e.currentTarget.style.borderColor = 'var(--accent-primary)'
          e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-primary-subtle)'
        }}
        onMouseLeave={(e) => {
          if (dragOver) return
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            overflow: 'hidden',
            background: `${color}22`,
            border: `1px solid ${color}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 700,
            color,
            flexShrink: 0
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={name}
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            initials
          )}
        </div>
        <div style={{ minWidth: 0, width: '100%' }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              lineHeight: 1.3,
              color: 'var(--text-primary)'
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {official.position}
          </div>
          {officialCommittees && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                marginTop: 6,
                paddingTop: 6,
                borderTop: '1px solid var(--border-subtle)'
              }}
            >
              {officialCommittees.map((line) => (
                <div
                  key={line}
                  style={{ fontSize: 10.5, lineHeight: 1.3, color: 'var(--text-secondary)' }}
                >
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
        {hasChildren && (
          <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>
            {children.length} {children.length === 1 ? 'member' : 'members'}
          </span>
        )}
      </div>

      {hasChildren && (
        <>
          <div style={{ width: 1, height: 20, background: CONNECTOR_COLOR, flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'flex-start' }}>
            {children.map((child, i) => (
              <div
                key={child.official.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0 16px',
                  position: 'relative'
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    height: 1,
                    background: CONNECTOR_COLOR,
                    left: i === 0 ? '50%' : 0,
                    right: i === children.length - 1 ? '50%' : 0
                  }}
                />
                <div style={{ width: 1, height: 20, background: CONNECTOR_COLOR, flexShrink: 0 }} />
                <OfficialOrgChartNode
                  node={child}
                  editMode={editMode}
                  draggedId={draggedId}
                  invalidDropIds={invalidDropIds}
                  onDragStartNode={onDragStartNode}
                  onDragEndNode={onDragEndNode}
                  onReparent={onReparent}
                  committees={committees}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
