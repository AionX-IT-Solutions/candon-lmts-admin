import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'

interface TooltipProps {
  children: ReactNode
  content: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  delayDuration?: number
}

export function Tooltip({ children, content, side = 'top', delayDuration = 300 }: TooltipProps) {
  if (!content) return <>{children}</>
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            style={{
              background: 'var(--tooltip-bg)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--tooltip-border)',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '12px',
              color: 'var(--text-primary)',
              boxShadow: 'var(--tooltip-shadow)',
              zIndex: 9999,
              maxWidth: '220px',
              lineHeight: '1.4'
            }}
          >
            {content}
            <TooltipPrimitive.Arrow style={{ fill: 'var(--tooltip-arrow)' }} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
