import { patchToRow, rowToTicket } from '@/lib/tickets/repository'
import type { Tables } from '@/lib/supabase/types'

const row: Tables<'tickets'> = {
  id: 'a',
  project_id: 'p1',
  number: 7,
  title: 'Corriger la frise',
  description: 'Détail',
  status: 'doing',
  assignee_id: 'u1',
  task_id: 'k1',
  created_at: '2026-09-09T10:00:00Z',
  updated_at: '2026-09-09T11:00:00Z',
}

describe('rowToTicket', () => {
  it('convertit une ligne en ticket, casse serpent vers casse chameau', () => {
    expect(rowToTicket(row)).toEqual({
      id: 'a',
      projectId: 'p1',
      number: 7,
      title: 'Corriger la frise',
      description: 'Détail',
      status: 'doing',
      assigneeId: 'u1',
      taskId: 'k1',
      createdAt: '2026-09-09T10:00:00Z',
      updatedAt: '2026-09-09T11:00:00Z',
    })
  })
})

describe('patchToRow', () => {
  it('ne retient que les champs présents', () => {
    expect(patchToRow({ status: 'done' })).toEqual({ status: 'done' })
  })

  it('sait écrire null sur l\'assigné et sur la tâche : c\'est « détacher », pas « ne pas toucher »', () => {
    expect(patchToRow({ assigneeId: null, taskId: null })).toEqual({ assignee_id: null, task_id: null })
  })

  it('n\'écrit JAMAIS le numéro ni la date de mise à jour', () => {
    // `number` est figé par trigger, `updatedAt` est posé par `set_updated_at` : les envoyer
    // ferait échouer l'écriture ou écraserait l'horodatage du serveur.
    expect(patchToRow({ updatedAt: '2026-01-01T00:00:00Z' } as never)).toEqual({})
  })

  it('rend un objet vide pour un patch vide', () => {
    expect(patchToRow({})).toEqual({})
  })
})
