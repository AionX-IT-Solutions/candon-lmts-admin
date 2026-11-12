import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false
}: ConfirmDialogProps) {
  const iconBg = danger ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'
  const iconColor = danger ? '#f87171' : '#fbbf24'

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="confirm" style={{ position: 'fixed', inset: 0, zIndex: 1300 }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={loading ? undefined : onCancel}
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
              padding: 16,
              pointerEvents: 'none'
            }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-label={title}
              className="modal-light"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.18 }}
              style={{
                pointerEvents: 'auto',
                position: 'relative',
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.09)',
                borderRadius: 16,
                overflow: 'hidden',
                maxWidth: 420,
                width: '100%',
                boxShadow:
                  '0 24px 80px rgba(0,0,0,0.22), 0 4px 20px rgba(0,0,0,0.1), 0 0 0 1px rgba(99,102,241,0.06)'
              }}
            >
              <div
                style={{
                  height: 4,
                  background: danger
                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                    : 'linear-gradient(90deg, #6366f1 0%, #818cf8 55%, #a78bfa 100%)'
                }}
              />

              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: 24 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <AlertTriangle size={18} color={iconColor} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#12122a', marginBottom: 6 }}>
                    {title}
                  </h3>
                  <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>{message}</p>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  padding: '14px 24px',
                  borderTop: '1px solid rgba(99,102,241,0.1)',
                  background: 'rgba(99,102,241,0.03)'
                }}
              >
                <button className="btn-secondary" onClick={onCancel} disabled={loading}>
                  Cancel
                </button>
                <button
                  className={danger ? 'btn-danger' : 'btn-primary'}
                  onClick={onConfirm}
                  disabled={loading}
                >
                  {loading ? 'Processing…' : confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
