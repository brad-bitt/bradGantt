'use client'
import { useState } from 'react'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { TEMPLATES, instantiate, type ProjectTemplate } from '@/lib/gantt/templates'
import { applyTemplate } from '@/lib/gantt/apply-template'
import { Button } from '@/components/ui/Button'
import { MiniGantt } from '@/components/project/MiniGantt'
import { useGanttView } from './GanttView'

/**
 * Écran d'accueil d'un projet sans aucune tâche.
 *
 * Il remplace une boîte de deux mots posée sur une grille nue : c'était le premier écran d'un
 * projet neuf, et il ne disait ni quoi faire ni par où commencer.
 *
 * Les trois boutons NE REPRENNENT PAS les libellés de la barre d'outils (« + Tâche »…) : deux
 * boutons de même nom coexisteraient à l'écran, indiscernables pour un lecteur d'écran comme
 * pour un test. « Première tâche » dit en plus ce que le geste a de particulier ici.
 *
 * `sticky` et non `absolute` : la carte est ancrée à la largeur de la sidebar, mesurée sur le
 * CONTENEUR défilé. Posée dans la timeline, le recentrage initial sur aujourd'hui la pousserait
 * hors du champ (mesuré à x = -639 sur un projet neuf) et on atterrirait sur une grille nue sans
 * la moindre indication ; ici, elle reste au même endroit quel que soit le défilement horizontal.
 */
export function EmptyProject() {
  const canEdit = useGanttStore(selectCanEdit)
  const openEditor = useGanttStore((s) => s.openEditor)
  const today = useGanttStore((s) => s.today)
  // Sur un écran étroit, la carte couvre la sidebar (vide, par définition) et prend toute la
  // largeur ; au bureau, elle se pose à droite de la colonne des tâches.
  const { sidebarWidth, compact } = useGanttView()
  // Identifiant du modèle en cours d'application : les autres boutons se désactivent, et la
  // carte disparaît d'elle-même dès la première ligne créée.
  const [applying, setApplying] = useState<string | null>(null)

  async function pickTemplate(id: string) {
    setApplying(id)
    await applyTemplate(id)
    setApplying(null)
  }

  return (
    <div
      data-testid="gantt-empty"
      className="pointer-events-auto sticky w-fit max-w-3xl bg-paper brutal shadow-brutal-lg p-4 sm:p-6 space-y-5"
      style={compact ? { left: 12, maxWidth: 'calc(100vw - 24px)' } : { left: sidebarWidth + 16 }}
    >
      <h2 className="text-2xl">Ce projet est vide</h2>
      {canEdit ? (
        <>
          <p className="font-bold">
            Pose une première tâche, un jalon ou un groupe. Le diagramme se construit ensuite de
            proche en proche.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => openEditor({ mode: 'create', parentId: null, type: 'task' })}>Première tâche</Button>
            <Button variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'milestone' })}>Premier jalon</Button>
            <Button variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'group' })}>Premier groupe</Button>
          </div>

          {/* Les modèles : un diagramme complet en un clic, daté d'aujourd'hui. C'est ce que
              font tous les outils du marché sur un projet vide, et c'est la façon la plus
              rapide de VOIR ce que le produit permet avant de le retailler. */}
          <div className="space-y-3 border-t-[3px] border-ink pt-5">
            <p className="font-display text-sm uppercase">Ou pars d’un modèle</p>
            <ul className="grid gap-3 sm:grid-cols-3">
              {TEMPLATES.map((t) => (
                <TemplateChoice key={t.id} template={t} today={today} busy={applying !== null} applying={applying === t.id} onUse={() => pickTemplate(t.id)} />
              ))}
            </ul>
          </div>

          <ul className="space-y-1 border-t-[3px] border-ink pt-3 font-mono text-xs text-ink-soft">
            <li>↳ sur une ligne enchaîne la suivante juste après elle.</li>
            <li>Glisse une barre pour la déplacer, ses bords pour l’allonger.</li>
            <li>Tire la pastille du bord droit d’une barre vers une autre pour les lier.</li>
          </ul>
        </>
      ) : (
        <p className="font-bold">Personne n’y a encore ajouté de tâche.</p>
      )}
    </div>
  )
}

function TemplateChoice({ template, today, busy, applying, onUse }: {
  template: ProjectTemplate
  today: string
  busy: boolean
  applying: boolean
  onUse: () => void
}) {
  const planned = instantiate(template, today)
  const dated = planned.filter((p) => p.type !== 'group')
  const range = { start: dated.map((p) => p.startDate).sort()[0], end: dated.map((p) => p.endDate).sort().at(-1)! }
  return (
    <li className="flex flex-col gap-2 border-[3px] border-ink p-3">
      <p className="font-bold leading-tight">{template.name}</p>
      {/* La vignette est celle des cartes de la liste : on reconnaît d'emblée ce qu'on obtiendra. */}
      <MiniGantt tasks={planned} range={range} today={today} />
      <p className="flex-1 text-xs text-ink-soft">{template.description}</p>
      <Button size="sm" variant="secondary" disabled={busy} onClick={onUse} aria-label={`Utiliser le modèle ${template.name}`}>
        {applying ? 'Création…' : `Utiliser · ${planned.length} lignes`}
      </Button>
    </li>
  )
}
