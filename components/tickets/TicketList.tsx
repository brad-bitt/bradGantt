'use client'
import { useMemo } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { filterTickets } from '@/lib/tickets/summary'
import { STATUS_LABELS, STATUS_ORDER, type TicketStatus } from '@/lib/tickets/types'
import type { BadgeColor } from '@/components/ui/Badge'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Select } from '@/components/ui/Select'

const STATUS_COLOR: Record<TicketStatus, BadgeColor> = { todo: 'ink', doing: 'blue', done: 'emerald' }

export function TicketList() {
  const tickets = useTicketsStore((s) => s.tickets)
  const filters = useTicketsStore((s) => s.filters)
  const setFilter = useTicketsStore((s) => s.setFilter)
  const members = useTicketsStore((s) => s.members)
  const tasks = useTicketsStore((s) => s.tasks)
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)

  // Mémoïsé : `filterTickets` rend un tableau neuf à chaque appel, et le sélecteur Zustand
  // compare par référence — le calculer dans le sélecteur bouclerait.
  const rows = useMemo(() => filterTickets(Object.values(tickets), filters), [tickets, filters])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label="Statut"
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value as TicketStatus | 'all')}
          options={[{ value: 'all', label: 'Tous' }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
        />
        {/* `'all'` et la chaîne vide sont DEUX valeurs distinctes : « tout le monde » et
            « personne ». Les confondre rendrait le second filtre inatteignable. */}
        <Select
          label="Assigné"
          value={filters.assigneeId}
          onChange={(e) => setFilter('assigneeId', e.target.value)}
          options={[{ value: 'all', label: 'Tous' }, { value: '', label: 'Personne' }, ...members.map((m) => ({ value: m.userId, label: m.displayName }))]}
        />
        <Select
          label="Tâche"
          value={filters.taskId}
          onChange={(e) => setFilter('taskId', e.target.value)}
          options={[{ value: 'all', label: 'Toutes' }, { value: '', label: 'Aucune' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
        />
      </div>

      {rows.length === 0 ? (
        // Un tableau vide sans un mot laisse croire que le projet n'a pas de ticket, alors que
        // c'est le filtre qui les cache.
        <p className="font-mono text-sm text-ink-soft">Aucun ticket ne correspond à ces filtres.</p>
      ) : (
        // Le tableau défile DANS son propre cadre : sur un téléphone, laisser la page défiler
        // horizontalement décalerait aussi la barre d'outils.
        <div className="overflow-x-auto border-[3px] border-ink">
          <table className="w-full border-collapse bg-paper text-sm">
            <thead>
              <tr className="border-b-[3px] border-ink bg-band text-left">
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">#</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Titre</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Statut</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Assigné</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Tâche</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const assignee = members.find((m) => m.userId === t.assigneeId)
                const task = tasks.find((k) => k.id === t.taskId)
                return (
                  <tr key={t.id} className="border-b border-ink/20 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">#{t.number}</td>
                    <td className="px-3 py-2">
                      {/* Un vrai bouton et non une ligne cliquable : la liste doit se parcourir
                          au clavier, et une balise `tr` avec un `onClick` n'est atteignable par
                          aucune tabulation. */}
                      {canEdit ? (
                        <button
                          type="button"
                          // Le numéro a sa propre colonne : le répéter à l'écran serait du bruit, mais
                          // un lecteur d'écran n'a pas le contexte de la colonne en parcourant les boutons.
                          aria-label={`#${t.number} ${t.title}`}
                          className="text-left font-bold underline brutal-focus"
                          onClick={() => openEditor({ mode: 'edit', ticketId: t.id })}
                        >
                          {t.title}
                        </button>
                      ) : (
                        <span className="font-bold">{t.title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2"><Badge color={STATUS_COLOR[t.status]}>{STATUS_LABELS[t.status]}</Badge></td>
                    <td className="px-3 py-2">
                      {assignee
                        ? <span className="flex items-center gap-2"><Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />{assignee.displayName}</span>
                        : <span className="font-mono text-xs text-ink-soft">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">{task?.title ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
