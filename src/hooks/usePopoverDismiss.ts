import { useEffect } from 'react'
import type { RefObject } from 'react'

type UsePopoverDismissArgs = {
  isOpen: boolean
  containerRef: RefObject<HTMLElement | null>
  onDismiss: () => void
}

export const usePopoverDismiss = ({
  isOpen,
  containerRef,
  onDismiss,
}: UsePopoverDismissArgs) => {
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      onDismiss()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [containerRef, isOpen, onDismiss])
}
