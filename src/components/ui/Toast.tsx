import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'

type ToastKind = 'success' | 'error'

interface ToastItem {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId++
      setItems((prev) => [...prev, { id, kind, message }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss]
  )

  const value: ToastContextValue = {
    toast: {
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
    },
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className="pointer-events-auto flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-popover"
          >
            {item.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-600" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
            )}
            <span className="flex-1 text-slate-700">{item.message}</span>
            <button
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}
