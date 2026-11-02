import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { Tooltip } from '../ui/Tooltip'
import { PAGE_TITLES } from './navigation'

export function Breadcrumb() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const page = PAGE_TITLES[pathname]
  if (!page) return null

  const crumbs = [page.group, page.label].filter(Boolean) as string[]

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        paddingLeft: 24,
        paddingRight: 24,
        flexShrink: 0
      }}
    >
      <Tooltip content="Dashboard" side="bottom">
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '3px 4px',
            borderRadius: 5,
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Home size={13} />
        </button>
      </Tooltip>

      {crumbs.map((label, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ChevronRight size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: isLast ? 500 : 400,
                color: isLast ? 'var(--text-primary)' : 'var(--text-muted)',
                userSelect: 'none'
              }}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
