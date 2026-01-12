import type { ReactNode } from 'react'

type ModalShellProps = {
  isOpen: boolean
  ariaLabel: string
  onClose: () => void
  closeLabel: string
  children: ReactNode
}

const ModalShell = ({
  isOpen,
  ariaLabel,
  onClose,
  closeLabel,
  children,
}: ModalShellProps) => {
  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="modal-card">
        <div className="modal-actions">
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default ModalShell
