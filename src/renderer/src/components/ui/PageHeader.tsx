import type { ReactNode } from 'react'

interface PageHeaderProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  icon?: ReactNode
}

export function PageHeader({ title, subtitle, actions, icon }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        flexShrink: 0,
        minHeight: 36,
        gap: 12
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
        {icon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              filter: 'drop-shadow(0 0 6px var(--accent-primary-glow))'
            }}
          >
            {icon}
          </div>
        )}
        {title && (
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {title}
          </h1>
        )}
        {subtitle && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-muted)',
              padding: '4px 10px',
              borderRadius: 20,
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-default)',
              whiteSpace: 'nowrap'
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  )
}
