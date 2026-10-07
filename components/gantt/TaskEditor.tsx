'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'
import { validateTaskInput, type TaskErrors } from '@/lib/gantt/validate'
import { TASK_COLORS, nextColor } from '@/lib/gantt/palette'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { addDays, parseDate } from '@/lib/gantt/dates'
import { anchorBounds } from '@/lib/gantt/scheduling'
import type { Task, TaskType } from '@/lib/gantt/types'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { STATUS_LABELS, TICKET_STATUS_BADGE } from '@/lib/tickets/types'
import { cn } from '@/lib/utils'

const TITLES: Record<TaskType, { create: string; edit: string }> = {
  task: { create: 'Nouvelle tâche', edit: 'Modifier la tâche' },
  milestone: { create: 'Nouveau jalon', edit: 'Modifier le jalon' },
  group: { create: 'Nouveau groupe', edit: 'Modifier le groupe' },
}

/** Noms lisibles des couleurs de la palette : un `aria-label` à « #FF6B9D » n'aide personne. */
/** Noms lisibles des couleurs de tâches : ce sont les seuls libellés de ces six boutons
 *  sans texte, donc la seule prise pour un lecteur d'écran comme pour un test. */
const COLOR_NAMES: Record<string, string> = {
  '#FF8A3D': 'tangerine',
  '#FF6FA3': 'rose',
  '#5B9DFF': 'bleu',
  '#3ECF8E': 'émeraude',
  '#A78BFA': 'violet',
  '#34D3E0': 'cyan',
  '#B4E45C': 'lime',
  '#E9B44C': 'ocre',
}

/** Contrainte `tasks.title` en base : `char_length(trim(title)) between 1 and 200`. */
const TITLE_MAX_LENGTH = 200

const FORM_ID = 'task-editor'

type TaskPatch = Partial<Omit<Task, 'id' | 'projectId'>>

export function TaskEditor() {
  const editor = useGanttStore((s) => s.editor)
  const canEdit = useGanttStore(selectCanEdit)
  const existing = useGanttStore((s) => (editor?.mode === 'edit' ? s.tasks[editor.taskId] : undefined))

  if (!editor) return null
  // Défense en profondeur : les trois points d'ouverture (toolbar, double-clic barre, double-clic
  // ligne de sidebar) filtrent déjà sur `canEdit`, mais `openEditor` reste appelable et un lecteur
  // ne doit jamais voir un formulaire dont chaque écriture serait refusée par la RLS.
  if (!canEdit) return null
  // La tâche visée a disparu pendant que la modale était ouverte (suppression optimiste, ou
  // rechargement du projet) : on ne rend pas un formulaire sur du vide.
  if (editor.mode === 'edit' && !existing) return null

  return (
    <TaskEditorForm
      // La clé remonte le MODE, le TYPE et l'ANCRE, pas seulement l'identifiant : sans le type,
      // passer de « + Tâche » à « + Jalon » sans fermer la modale réutiliserait l'état du
      // formulaire précédent (`create`/`create` ont le même identifiant : aucun) ; sans l'ancre,
      // enchaîner après une deuxième tâche garderait les dates calculées pour la première.
      key={editor.mode === 'edit' ? `edit:${editor.taskId}` : `create:${editor.type}:${editor.parentId ?? ''}:${editor.afterTaskId ?? ''}:${editor.startDate ?? ''}`}
      existing={existing}
      defaultType={editor.mode === 'create' ? editor.type : existing!.type}
      defaultParentId={editor.mode === 'create' ? editor.parentId : existing!.parentId}
      afterTaskId={editor.mode === 'create' ? (editor.afterTaskId ?? null) : null}
      presetStart={editor.mode === 'create' ? (editor.startDate ?? null) : null}
    />
  )
}

/** Champs réellement modifiés : inutile d'écrire (et d'annuler) ce que l'utilisateur n'a pas touché. */
function changedFields(before: Task, next: TaskPatch): TaskPatch {
  const out: Record<string, unknown> = {}
  const source = before as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(next)) {
    if (source[key] !== value) out[key] = value
  }
  return out as TaskPatch
}

function TaskEditorForm({ existing, defaultType, defaultParentId, afterTaskId, presetStart }: {
  existing?: Task
  defaultType: TaskType
  defaultParentId: string | null
  afterTaskId: string | null
  /** Premier jour proposé par l'appelant (clic droit sur la frise), prioritaire sur l'ancre. */
  presetStart: string | null
}) {
  const closeEditor = useGanttStore((s) => s.closeEditor)
  const members = useGanttStore((s) => s.members)
  const tasks = useGanttStore((s) => s.tasks)
  const today = useGanttStore((s) => s.today)
  const projectId = useGanttStore((s) => s.projectId)
  const ticketsEnabled = useGanttStore((s) => s.ticketsEnabled)
  const ticketSummaries = useGanttStore((s) => (existing ? s.ticketsByTask[existing.id] : undefined))
  const groups = Object.values(tasks).filter((t) => t.type === 'group' && t.id !== existing?.id)

  const anchor = afterTaskId ? tasks[afterTaskId] : undefined
  /**
   * Départ par défaut : le LENDEMAIN de la fin de l'ancre — c'est le sens de « après ». Pour un
   * groupe, `anchorBounds` prend l'empan de ses enfants et non ses dates stockées, sans quoi la
   * suite d'une phase se placerait à une date que personne n'a vue à l'écran.
   */
  const anchorEnd = anchor ? anchorBounds(Object.values(tasks), anchor).endDate : null
  const defaultStart = presetStart ?? (anchorEnd ? addDays(anchorEnd, 1) : today)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [type, setType] = useState<TaskType>(defaultType)
  const [startDate, setStartDate] = useState(existing?.startDate ?? defaultStart)
  const [endDate, setEndDate] = useState(existing?.endDate ?? addDays(defaultStart, 2))
  // Cochée par défaut : cliquer « après » exprime déjà un enchaînement, la flèche ne fait que
  // le rendre visible sur le diagramme. Décocher reste possible pour un simple voisinage.
  const [link, setLink] = useState(true)
  // Saisie conservée en chaîne : convertir à chaque frappe faisait qu'un champ vidé pour être
  // retapé valait 0, et « Enregistrer » écrivait silencieusement 0 % en base. La conversion
  // n'a lieu qu'à l'envoi, une fois la saisie validée.
  const [progress, setProgress] = useState(String(existing?.progress ?? 0))
  const [color, setColor] = useState(() => existing?.color ?? nextColor(Object.values(tasks).map((t) => t.color)))
  const [assigneeId, setAssigneeId] = useState(existing?.assigneeId ?? '')
  const [parentId, setParentId] = useState(defaultParentId ?? '')
  const [errors, setErrors] = useState<TaskErrors>({})
  const [busy, setBusy] = useState(false)

  const isGroup = type === 'group'
  const isMilestone = type === 'milestone'
  const losses =
    isMilestone && existing && existing.type !== 'milestone'
      ? [
          ...(existing.endDate > existing.startDate ? [`la fin (${existing.endDate})`] : []),
          ...(existing.progress > 0 ? [`l'avancement (${existing.progress} %)`] : []),
        ]
      : []
  const dialogTitle = TITLES[type][existing ? 'edit' : 'create']

  async function submit(e: FormEvent) {
    e.preventDefault()
    const verdict = validateTaskInput({ title, type, startDate, endDate, progress })
    if (!verdict.ok) {
      setErrors(verdict.errors)
      return
    }
    // Politique d'erreur du projet : le message inline disparaît dès que la saisie est valide,
    // la suite ne peut plus échouer que sur la persistance — et cela se signale par un toast.
    setErrors({})
    setBusy(true)
    const cmd = getGanttCommands()
    const fields = {
      title: title.trim(),
      type,
      startDate,
      // Un jalon tient sur un jour (contrainte `tasks_milestone_single_day`) et un groupe comme
      // un jalon n'a pas d'avancement propre : on normalise ici, pas en base.
      endDate: isMilestone ? startDate : endDate,
      progress: isGroup || isMilestone ? 0 : Number(progress),
      color,
      assigneeId: assigneeId || null,
      // Un groupe ne peut pas avoir de parent (trigger `check_task_parent`).
      parentId: isGroup ? null : parentId || null,
    }

    let ok: boolean
    if (existing) {
      const patch = changedFields(existing, fields)
      // Enregistrer sans rien avoir changé n'a pas à produire d'écriture : `updateTask` refuse
      // d'ailleurs un patch vide, et laisser la modale ouverte sur ce refus serait incompréhensible.
      ok = Object.keys(patch).length === 0 ? true : await cmd.updateTask(existing.id, patch)
    } else {
      ok = (await cmd.createTask({
        ...fields,
        // Un groupe ne s'enchaîne pas à un autre par une flèche : c'est un contenant, son
        // empan est déduit de ses enfants. L'insertion dans l'ordre, elle, vaut pour les deux.
        ...(anchor ? { after: { taskId: anchor.id, link: link && !isGroup } } : {}),
      })) !== null
    }
    setBusy(false)
    if (ok) closeEditor()
  }

  async function remove() {
    if (!existing) return
    const label = existing.type === 'group'
      ? `Supprimer le groupe « ${existing.title} » et toutes ses tâches ?`
      : `Supprimer « ${existing.title} » ?`
    if (!window.confirm(label)) return
    // Fermeture AVANT l'attente : la suppression est optimiste, la tâche quitte le store
    // immédiatement et la modale n'aurait plus rien à éditer. Fermer après ferait clignoter la
    // modale sur un échec (le rollback recrée la tâche, donc le formulaire, avant qu'on le
    // ferme). L'échec reste signalé par le toast des commandes.
    closeEditor()
    await getGanttCommands().deleteTask(existing.id)
  }

  return (
    <Dialog
      open
      onClose={closeEditor}
      title={dialogTitle}
      footer={
        <>
          {/* Destructif au repos : « Enregistrer » doit rester le seul noir de la fenêtre (spec §3). */}
          {existing && <Button variant="danger-quiet" onClick={remove} disabled={busy} className="mr-auto">Supprimer</Button>}
          <Button variant="secondary" onClick={closeEditor} disabled={busy}>Annuler</Button>
          <Button type="submit" form={FORM_ID} disabled={busy}>{existing ? 'Enregistrer' : 'Créer'}</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-4">
        <Input
          label="Titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          maxLength={TITLE_MAX_LENGTH}
          autoFocus
        />

        {/* Un groupe ne change pas de type : le convertir en tâche laisserait ses enfants
            rattachés à un parent qui n'est plus un groupe (le trigger ne contrôle que la ligne
            écrite, pas ses enfants), et une tâche ne devient pas un groupe sans qu'il faille
            d'abord la sortir du sien. Tâche ↔ jalon, en revanche, est sans conséquence : ni
            l'un ni l'autre ne peut avoir d'enfant, et les deux acceptent le même parent. */}
        {!isGroup && (
          <Select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
            options={[{ value: 'task', label: 'Tâche' }, { value: 'milestone', label: 'Jalon' }]}
          />
        )}

        {!isGroup && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Début" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="font-mono" />
            {!isMilestone && (
              <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="font-mono" />
            )}
          </div>
        )}
        {errors.dates && <p role="alert" className="text-danger text-sm font-bold">{errors.dates}</p>}

        {/* Convertir une tâche en jalon écrase sa fin et son avancement, en un clic et sans
            retour possible : repasser en « tâche » ne rend ni l'une ni l'autre. La suppression,
            elle, demande confirmation — cette perte-là ne doit pas être plus discrète. On nomme
            les valeurs en jeu plutôt que d'avertir dans le vide. */}
        {losses.length > 0 && (
          <p role="status" className="brutal bg-yellow px-3 py-2 text-sm font-bold text-on-data">
            Un jalon tient sur un seul jour : {losses.join(' et ')} {losses.length > 1 ? 'seront perdus' : 'sera perdue'}.
          </p>
        )}

        {!isGroup && !isMilestone && (
          <Input
            label="Avancement"
            type="number"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
            className="font-mono"
          />
        )}
        {errors.progress && <p role="alert" className="text-danger text-sm font-bold">{errors.progress}</p>}

        {anchor && !existing && (
          <div className="brutal bg-band px-3 py-2 space-y-2">
            <p className="text-sm font-bold">
              Enchaînée après « {anchor.title} », qui se termine le{' '}
              {format(parseDate(anchorEnd!), 'd MMMM yyyy', { locale: fr })}.
            </p>
            {!isGroup && (
              <Checkbox
                label="Lier à la tâche précédente"
                checked={link}
                onChange={(e) => setLink(e.target.checked)}
              />
            )}
          </div>
        )}

        <fieldset>
          <legend className="mb-1 font-bold text-sm">Couleur</legend>
          <div className="flex gap-2">
            {TASK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={COLOR_NAMES[c] ?? c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn(
                  'inline-flex size-8 items-center justify-center border-[3px] border-ink brutal-focus',
                  color === c && 'shadow-brutal',
                )}
                style={{ backgroundColor: c }}
              >
                {/* Coche plutôt que l'`outline-dashed` employé ailleurs pour la sélection :
                    `brutal-focus` pose `outline-none`, qui l'emporte dans la cascade et
                    effaçait purement et simplement le liseré (vérifié : `outline-style`
                    calculé à `none` sur la pastille sélectionnée). Renoncer à `brutal-focus`
                    aurait coûté l'indicateur de focus clavier, seul repère sur ces six
                    boutons sans texte. */}
                {color === c && <span aria-hidden className="font-display text-base leading-none text-on-data">✓</span>}
              </button>
            ))}
          </div>
        </fieldset>

        {!isGroup && (
          <Select
            label="Assigné à"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            options={[{ value: '', label: 'Personne' }, ...members.map((m) => ({ value: m.userId, label: m.displayName }))]}
          />
        )}

        {!isGroup && groups.length > 0 && (
          <Select
            label="Groupe"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            options={[{ value: '', label: 'Aucun' }, ...groups.map((g) => ({ value: g.id, label: g.title }))]}
          />
        )}

        {/* Section présente uniquement en ÉDITION : une tâche en cours de création n'a pas
            encore d'identifiant, il n'y aurait rien à rattacher. Absente aussi sur un GROUPE :
            la page des tickets refuse de rattacher un groupe, le lien mènerait nulle part. */}
        {existing && existing.type !== 'group' && ticketsEnabled && (
          <section className="brutal bg-band px-3 py-2 space-y-2">
            <h3 className="font-bold uppercase text-sm">Tickets</h3>
            {!ticketSummaries || ticketSummaries.length === 0 ? (
              <p className="font-mono text-xs text-ink-soft">Aucun ticket rattaché.</p>
            ) : (
              <ul className="space-y-1">
                {ticketSummaries.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-ink-soft">#{t.number}</span>
                    <span className="flex-1 truncate">{t.title}</span>
                    <Badge color={TICKET_STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {/* Un LIEN, pas un bouton : la création n'a pas lieu ici. Le store du Gantt ne
                contient aucun ticket — c'était tout l'intérêt de séparer les deux modules — et
                y brancher les commandes de tickets pour ce seul formulaire réintroduirait le
                couplage qu'on a évité. On emmène l'utilisateur là où le backlog vit, la tâche
                déjà rattachée dans le formulaire. */}
            <Link
              href={`/projects/${projectId}/tickets?nouveau=${existing.id}`}
              className="inline-block text-sm font-bold underline-offset-4 hover:underline brutal-focus"
            >
              + Nouveau ticket
            </Link>
          </section>
        )}
      </form>
    </Dialog>
  )
}
