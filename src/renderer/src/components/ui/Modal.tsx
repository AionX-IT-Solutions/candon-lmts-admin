import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** `full` — nearly the whole window, for viewing documents */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  footer?: ReactNode
}

const sizes: Record<NonNullable<ModalProps['size']>, number> = {
  sm: 448,
  md: 520,
  lg: 672,
  xl: 896,
  '2xl': 1024,
  full: 1280
}

/** GSPIS-style dialog: white card with an indigo accent, animated in and out. */
export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="modal" style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15,15,35,0.55)',
              backdropFilter: 'blur(6px)'
            }}
          />

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              pointerEvents: 'none'
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              className="modal-light"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
                pointerEvents: 'auto',
                position: 'relative',
                width: sizes[size],
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 40px)',
                height: size === 'full' ? 'calc(100vh - 40px)' : undefined,
                display: 'flex',
                flexDirection: 'column',
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.09)',
                borderRadius: 16,
                boxShadow:
                  '0 24px 80px rgba(0,0,0,0.22), 0 4px 20px rgba(0,0,0,0.1), 0 0 0 1px rgba(99,102,241,0.06)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: 4,
                  flexShrink: 0,
                  background: 'linear-gradient(90deg, #6366f1 0%, #818cf8 55%, #a78bfa 100%)'
                }}
              />

              <div
                style={{
                  padding: '18px 24px 14px',
                  borderBottom: '1px solid rgba(0,0,0,0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexShrink: 0
                }}
              >
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#12122a',
                    margin: 0,
                    letterSpacing: '-0.015em'
                  }}
                >
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.05)',
                    border: '1px solid rgba(0,0,0,0.09)',
                    color: '#9ca3af',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239,68,68,0.09)'
                    e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'
                    e.currentTarget.style.color = '#ef4444'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.05)'
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.09)'
                    e.currentTarget.style.color = '#9ca3af'
                  }}
                >
                  <X size={14} />
                </button>
              </div>

              <div
                className="scrollbar-thin"
                style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}
              >
                {children}
              </div>

              {footer && (
                <div
                  style={{
                    padding: '14px 24px',
                    borderTop: '1px solid rgba(99,102,241,0.1)',
                    background: 'rgba(99,102,241,0.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 10,
                    flexShrink: 0
                  }}
                >
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
