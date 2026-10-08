'use client'
import { useToastStore } from '@/lib/toast/store'
import { cn } from '@/lib/utils'

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <button key={t.id} type="button" onClick={() => dismiss(t.id)}
          className={cn('min-w-64 rounded-card px-4 py-3 text-left font-medium shadow-float', t.kind === 'error' ? 'bg-danger text-white' : 'bg-ink text-paper')}>
          {t.message}
        </button>
      ))}
    </div>
  )
}
