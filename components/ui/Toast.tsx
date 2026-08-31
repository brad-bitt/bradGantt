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
          className={cn('brutal px-4 py-3 font-bold text-left min-w-64', t.kind === 'error' ? 'bg-danger text-paper' : 'bg-green text-ink')}>
          {t.message}
        </button>
      ))}
    </div>
  )
}
