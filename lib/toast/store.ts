import { create } from 'zustand'

export type ToastKind = 'success' | 'error'
export interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastState {
  toasts: ToastItem[]
  push: (kind: ToastKind, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    if (typeof window !== 'undefined') {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
}
