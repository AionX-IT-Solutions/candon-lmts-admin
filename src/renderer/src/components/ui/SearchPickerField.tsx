import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SearchPickerFieldProps<T> {
  /** The plain string value currently stored on the record (a code/number/title, never an id —
   *  same "store the name, not a foreign key" convention every field built on this already
   *  used before this was generalized). */
  value: string
  /** Fires only when a real item is clicked — never from typing, so the stored value can never
   *  drift from an item that doesn't exist. `item` is the full picked record, for callers that
   *  also want one of its other fields. */
  onChange: (value: string, item?: T) => void
  items: T[]
  getKey: (item: T) => string
  getValue: (item: T) => string
  getLabel: (item: T) => string
  /** What's matched against the search box — defaults to getLabel. */
  getSearchText?: (item: T) => string
  placeholder?: string
  searchPlaceholder?: string
  /** Shown in the list when `items` is empty (e.g. "— Add sessions under Sessions → Order of
   *  Business —"), pointing staff at where to create the first one. */
  emptyMessage: string
  error?: boolean
  disabled?: boolean
}

/**
 * The searchable, pick-only alternative to a plain `<Input>` or native `<select>` for a field
 * that references another collection (Order of Business sessions, Standing Committees, draft
 * measures, ...). Typing in the search box only filters the list; the stored value only ever
 * changes when a row is clicked, so a typo can no longer silently point at something that
 * doesn't exist. A `value` that doesn't match any current item (data saved before this field
 * existed, or the item since deleted/renamed) still displays as its own raw text instead of
 * going blank. Portaled with position:fixed computed from the trigger's own rect — same
 * approach ColumnsMenu.tsx already established, avoiding the clipping an absolutely-positioned
 * popover would risk inside a Modal's own overflow.
 */
export function SearchPickerField<T>({
  value,
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
}: SearchPickerFieldProps<T>) {
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
          !value && 'text-[var(--c-text-3)]',
          error && 'border-red-500/60',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <span className="truncate">{value || placeholder}</span>
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
                  return (
                    <div
                      key={getKey(item)}
                      onClick={() => {
                        onChange(itemValue, item)
                        setOpen(false)
                      }}
                      style={{
                        padding: '7px 14px',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: itemValue === value ? 'var(--c-accent)' : 'var(--c-text-1)',
                        fontWeight: itemValue === value ? 600 : 400,
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--popover-item-hover)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {getLabel(item)}
                    </div>
                  )
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
