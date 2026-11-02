import { createPortal } from 'react-dom'
import { Toaster as SonnerToaster } from 'sonner'
import { useUIStore } from '../../store/uiStore'

export function Toaster() {
  const theme = useUIStore((s) => s.theme)

  // #root has `isolation: isolate`, which would trap the toaster below modals —
  // portal it to <body> so toasts stay on top of open dialogs.
  return createPortal(
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-primary)',
          fontSize: '13px',
          fontFamily: 'inherit',
          boxShadow: 'var(--shadow-card)'
        }
      }}
      richColors
      closeButton
      gap={8}
    />,
    document.body
  )
}
