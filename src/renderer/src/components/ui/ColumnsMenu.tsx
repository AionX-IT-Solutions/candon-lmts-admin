import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SlidersHorizontal } from 'lucide-react'
import type { Column } from './DataTable'

function loadHidden(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(`lis.hiddenColumns.${storageKey}`)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

// Per-table column visibility, persisted per storageKey so each module
// remembers its own hidden columns across sessions.
export function useColumnVisibility<T>(columns: Column<T>[], storageKey: string) {
  const [hidden, setHidden] = useState<Set<string>>(() => loadHidden(storageKey))

  useEffect(() => {
    try {
      localStorage.setItem(`lis.hiddenColumns.${storageKey}`, JSON.stringify([...hidden]))
    } catch {
      // ignore write failures (e.g. storage disabled)
    }
  }, [storageKey, hidden])

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        // Never let the last visible column be hidden — an empty table has no recovery path.
        if (columns.length - next.size <= 1) return prev
        next.add(key)
      }
      return next
    })
  }

  const visibleColumns = columns.filter((c) => !hidden.has(String(c.key)))

  return { visibleColumns, hidden, toggle }
}

interface ColumnsMenuButtonProps<T> {
  columns: Column<T>[]
  hidden: Set<string>
  onToggle: (key: string) => void
}

/** "Columns" toggle with a badge of hidden columns and a portaled checklist (GSPIS style). */
export function ColumnsMenuButton<T>({ columns, hidden, onToggle }: ColumnsMenuButtonProps<T>) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function toggleOpen() {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((v) => !v)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn-ghost"
        onClick={toggleOpen}
        style={{
          gap: 6,
          background: open ? 'var(--c-accent)' : undefined,
          color: open ? '#fff' : undefined
        }}
      >
        <SlidersHorizontal size={14} />
        Columns
        {hidden.size > 0 && (
          <span
            style={{
              background: open ? 'rgba(255,255,255,0.3)' : 'var(--c-accent)',
              color: '#fff',
              borderRadius: 10,
              padding: '0 5px',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: '16px',
              minWidth: 16,
              textAlign: 'center'
            }}
          >
            {hidden.size}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="animate-scale-in"
            style={{
              position: 'fixed',
              top: menuPos.top,
              right: menuPos.right,
              zIndex: 9999,
              background: 'var(--popover-bg)',
              border: '1px solid var(--popover-border)',
              borderRadius: 10,
              padding: '6px 0',
              minWidth: 190,
              maxHeight: 360,
              overflowY: 'auto',
              boxShadow: 'var(--popover-shadow)'
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--c-text-3)',
                padding: '4px 14px 8px'
              }}
            >
              Toggle columns
            </p>
            {columns.map((col) => {
              const key = String(col.key)
              return (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 14px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--c-text-1)',
                    transition: 'background 0.1s'
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--popover-item-hover)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={!hidden.has(key)}
                    onChange={() => onToggle(key)}
                    style={{ accentColor: 'var(--c-accent)', width: 14, height: 14 }}
                  />
                  {col.header}
                </label>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
