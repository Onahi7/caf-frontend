import { useEffect, useRef } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

interface UpdatePromptProps {
  isOpen: boolean
  isApplying: boolean
  title?: string
  description?: string
  body?: string
  actionLabel?: string
  pendingLabel?: string
  dismissLabel?: string
  canDismiss?: boolean
  onUpdate: () => void
  onDismiss: () => void
}

export const UpdatePrompt = ({
  isOpen,
  isApplying,
  title = 'Update ready',
  description = 'A new CAREFARM POS update has been downloaded.',
  body = 'Apply it now to restart the app with the latest version, or continue working and update later.',
  actionLabel = 'Update now',
  pendingLabel = 'Updating...',
  dismissLabel = 'Later',
  canDismiss = true,
  onUpdate,
  onDismiss,
}: UpdatePromptProps) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => {
        modalRef.current?.focus()
      })
    }
    return () => {
      document.body.style.overflow = 'unset'
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canDismiss && !isApplying) {
        onDismiss()
        return
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, canDismiss, isApplying, onDismiss])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-prompt-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-slate-900/95 shadow-2xl shadow-black/80 backdrop-blur-2xl outline-none overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between border-b border-white/[0.08] bg-slate-950/40 p-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shadow-md">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 id="update-prompt-title" className="text-base font-bold text-white tracking-tight">
                {title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {description}
              </p>
            </div>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              disabled={isApplying}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Dismiss update"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed text-slate-300">
            {body}
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end pt-2">
            {canDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                disabled={isApplying}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {dismissLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onUpdate}
              disabled={isApplying}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-950/40 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApplying ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{isApplying ? pendingLabel : actionLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
