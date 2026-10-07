'use client'
import { useTicketsStore } from '@/lib/tickets/store'
import { STATUS_LABELS, STATUS_ORDER, type TicketStatus } from '@/lib/tickets/types'
import { Select } from '@/components/ui/Select'

/**
 * Les trois filtres du backlog. Ils vivent dans le STORE et s'appliquent aux deux vues : poser
 * « Terminé » en liste puis passer au kanban montre la même sélection, et le compteur de la
 * barre d'outils ne ment sur aucune des deux.
 *
 * `compact` (barre d'outils) : un libellé visible coûterait une ligne de hauteur. Il passe en
 * `aria-label`, et la première option dit d'elle-même ce que le champ filtre.
 *
 * `'all'` et la chaîne vide sont DEUX valeurs distinctes : « tout le monde » et « personne ».
 * Les confondre rendrait le second filtre inatteignable.
 */
export function TicketFilterFields({ compact = false }: { compact?: boolean }) {
  const filters = useTicketsStore((s) => s.filters)
  const setFilter = useTicketsStore((s) => s.setFilter)
  const members = useTicketsStore((s) => s.members)
  const tasks = useTicketsStore((s) => s.tasks)
  const named = (label: string) => (compact ? { 'aria-label': label, className: 'py-1 text-sm' } : { label })

  return (
    <>
      <Select
        {...named('Statut')}
        value={filters.status}
        onChange={(e) => setFilter('status', e.target.value as TicketStatus | 'all')}
        options={[{ value: 'all', label: 'Tous les statuts' }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
      />
      <Select
        {...named('Assigné')}
        value={filters.assigneeId}
        onChange={(e) => setFilter('assigneeId', e.target.value)}
        options={[{ value: 'all', label: 'Tout le monde' }, { value: '', label: 'Personne' }, ...members.map((m) => ({ value: m.userId, label: m.displayName }))]}
      />
      <Select
        {...named('Tâche')}
        value={filters.taskId}
        onChange={(e) => setFilter('taskId', e.target.value)}
        options={[{ value: 'all', label: 'Toutes les tâches' }, { value: '', label: 'Aucune' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
      />
    </>
  )
}
