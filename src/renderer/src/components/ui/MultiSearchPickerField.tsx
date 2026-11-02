import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

interface MultiSearchPickerFieldProps<T> {
  /** The plain string values currently stored on the record (names/codes, never ids — same
   *  "store the name, not a foreign key" convention SearchPickerField already uses). */
  values: string[]
  onChange: (values: string[]) => void
  items: T[]
  getKey: (item: T) => string
  getValue: (item: T) => string
  getLabel: (item: T) => string
  /** What's matched against the search box — defaults to getLabel. */
  getSearchText?: (item: T) => string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage: string
  error?: boolean
  disabled?: boolean
}

/**
 * The multi-select sibling of SearchPickerField: picks any number of items instead of one.
 * Clicking a row toggles it in or out of `values` and the popover stays open, so several picks
 * can be made in a row — closing only on Escape or an outside click. Same portal/positioning
 * approach as SearchPickerField, for the same reason (avoids clipping inside a Modal's overflow).
 */
export function MultiSearchPickerField<T>({
  values,
  onChange,
  items,
  getKey,
  getValue,
  getLabel,
  getSearchText,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage,
  error,
  disabled
}: MultiSearchPickerFieldProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function openPopover() {
    if (disabled) return
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setQuery('')
    setOpen(true)
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  function toggle(itemValue: string) {
    onChange(
      values.includes(itemValue) ? values.filter((v) => v !== itemValue) : [...values, itemValue]
    )
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter((item) => (getSearchText ?? getLabel)(item).toLowerCase().includes(q))
    : items

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPopover())}
        className={cn(
          'input-field',
          'flex items-center justify-between gap-2 text-left',
          !values.length && 'text-[var(--c-text-3)]',
          error && 'border-red-500/60',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <span className="truncate">{values.length ? values.join(', ') : placeholder}</span>
        <ChevronDown size={14} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="animate-scale-in"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: Math.max(pos.width, 260),
              zIndex: 9999,
              background: 'var(--popover-bg)',
              border: '1px solid var(--popover-border)',
              borderRadius: 10,
              boxShadow: 'var(--popover-shadow)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderBottom: '1px solid var(--popover-border)'
              }}
            >
              <Search size={13} style={{ color: 'var(--c-text-3)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 13,
                  color: 'var(--c-text-1)'
                }}
              />
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
              {items.length === 0 ? (
                <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--c-text-3)' }}>
                  {emptyMessage}
                </p>
              ) : filtered.length === 0 ? (
                <p style={{ padding: '10px 14px', fontSize: 12, color: 'var(--c-text-3)' }}>
                  No matches
                </p>
              ) : (
                filtered.map((item) => {
                  const itemValue = getValue(item)
                  const selected = values.includes(itemValue)
                  return (
                    <div
                      key={getKey(item)}
                      onClick={() => toggle(itemValue)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '7px 14px',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: selected ? 'var(--c-accent)' : 'var(--c-text-1)',
                        fontWeight: selected ? 600 : 400,
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--popover-item-hover)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="truncate">{getLabel(item)}</span>
                      {selected && <Check size={14} style={{ flexShrink: 0 }} />}
                    </div>
                  )
                })
              )}
            </div>
            {values.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: '6px 10px',
                  borderTop: '1px solid var(--popover-border)'
                }}
              >
                <button
                  type="button"
                  onClick={() => onChange([])}
                  style={{
                    fontSize: 12,
                    color: 'var(--c-text-3)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  )
}
