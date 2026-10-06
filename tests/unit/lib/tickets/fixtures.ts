import type { Ticket } from '@/lib/tickets/types'

let n = 0

/** Ticket de test. Les champs non fournis prennent des valeurs neutres et stables. */
export function makeTicket(patch: Partial<Ticket> = {}): Ticket {
  n += 1
  return {
    id: `t${n}`,
    projectId: 'p1',
    number: n,
    title: `Ticket ${n}`,
    description: '',
    status: 'todo',
    assigneeId: null,
    taskId: null,
    createdAt: '2026-09-09T10:00:00Z',
    updatedAt: '2026-09-09T10:00:00Z',
    ...patch,
  }
}
