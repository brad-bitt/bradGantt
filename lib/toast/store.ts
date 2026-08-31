import { create } from 'zustand'

export type ToastKind = 'success' | 'error'
export interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastState {
  toasts: ToastItem[]
  push: (kind: ToastKind, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1
const timeoutMap = new Map<number, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    if (typeof window !== 'undefined') {
      const timeout = setTimeout(() => {
        timeoutMap.delete(id)
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, 4000)
      timeoutMap.set(id, timeout)
    }
  },
  dismiss: (id) => {
    const timeout = timeoutMap.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutMap.delete(id)
    }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
}
