'use client'
import { useState, type FormEvent } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { getTicketCommands } from '@/lib/tickets/client-commands'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, validateTicketInput, type TicketErrors } from '@/lib/tickets/validate'
import { STATUS_LABELS, STATUS_ORDER, type Ticket, type TicketPatch, type TicketStatus } from '@/lib/tickets/types'
import { Dialog } from '@/components/ui/Dialog'
import { STATUS_SWATCH } from './status'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

const FORM_ID = 'ticket-editor'

export function TicketEditor() {
  const editor = useTicketsStore((s) => s.editor)
  const canEdit = useTicketsStore(selectCanEditTickets)
  const existing = useTicketsStore((s) => (editor?.mode === 'edit' ? s.tickets[editor.ticketId] : undefined))

  if (!editor) return null
  // Défense en profondeur : les points d'ouverture filtrent déjà sur `canEdit`, mais
  // `openEditor` reste appelable et un lecteur ne doit jamais voir un formulaire dont chaque
  // écriture serait refusée par la RLS.
  if (!canEdit) return null
  // Le ticket visé a disparu pendant que la modale était ouverte (suppression optimiste, ou
  // rechargement) : on ne rend pas un formulaire sur du vide.
  if (editor.mode === 'edit' && !existing) return null

  return (
    <TicketEditorForm
      // La clé remonte le mode ET l'ancre : sans elle, passer d'une création rattachée à une
      // autre garderait la tâche de la précédente dans l'état du formulaire.
      key={editor.mode === 'edit' ? `edit:${editor.ticketId}` : `create:${editor.taskId ?? ''}`}
      existing={existing}
      defaultTaskId={editor.mode === 'create' ? editor.taskId : (existing?.taskId ?? null)}
    />
  )
}

/** Champs réellement modifiés : inutile d'écrire (et d'annuler) ce que l'utilisateur n'a pas touché. */
function changedFields(before: Ticket, next: TicketPatch): TicketPatch {
  const out: Record<string, unknown> = {}
  const source = before as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(next)) {
    if (source[key] !== value) out[key] = value
  }
  return out as TicketPatch
}

function TicketEditorForm({ existing, defaultTaskId }: { existing?: Ticket; defaultTaskId: string | null }) {
  const closeEditor = useTicketsStore((s) => s.closeEditor)
  const members = useTicketsStore((s) => s.members)
  const tasks = useTicketsStore((s) => s.tasks)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [status, setStatus] = useState<TicketStatus>(existing?.status ?? 'todo')
  const [assigneeId, setAssigneeId] = useState(existing?.assigneeId ?? '')
  const [taskId, setTaskId] = useState(defaultTaskId ?? '')
  const [errors, setErrors] = useState<TicketErrors>({})
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const verdict = validateTicketInput({ title, description })
    if (!verdict.ok) {
      setErrors(verdict.errors)
      return
    }
    // Politique d'erreur du projet : le message inline disparaît dès que la saisie est valide,
    // la suite ne peut plus échouer que sur la persistance — signalée par un toast.
    setErrors({})
    setBusy(true)
    const cmd = getTicketCommands()
    const fields = {
      title,
      description,
      status,
      // Chaîne vide = « personne » / « aucune tâche ». En base, c'est `null`.
      assigneeId: assigneeId || null,
      taskId: taskId || null,
    }

    let ok: boolean
    if (existing) {
      const patch = changedFields(existing, { ...fields, title: title.trim() })
      // Enregistrer sans rien avoir changé n'a pas à produire d'écriture : `updateTicket`
      // refuse d'ailleurs un patch vide, et rester ouvert sur ce refus serait incompréhensible.
      ok = Object.keys(patch).length === 0 ? true : await cmd.updateTicket(existing.id, patch)
    } else {
      ok = (await cmd.createTicket(fields)) !== null
    }
    setBusy(false)
    if (ok) closeEditor()
  }

  async function remove() {
    if (!existing) return
    if (!window.confirm(`Supprimer le ticket #${existing.number} « ${existing.title} » ?`)) return
    // Fermeture AVANT l'attente : la suppression est optimiste, le ticket quitte le store
    // immédiatement et la modale n'aurait plus rien à éditer. L'échec reste signalé par le toast.
    closeEditor()
    await getTicketCommands().deleteTicket(existing.id)
  }

  return (
    <Dialog
      open
      onClose={closeEditor}
      accentClassName={STATUS_SWATCH[status]}
      title={existing ? `Ticket #${existing.number}` : 'Nouveau ticket'}
      footer={
        <>
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
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          maxLength={DESCRIPTION_MAX_LENGTH}
        />
        <Select
          label="Statut"
          value={status}
          onChange={(e) => setStatus(e.target.value as TicketStatus)}
          options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        <Select
          label="Assigné à"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          options={[{ value: '', label: 'Personne' }, ...members.map((m) => ({ value: m.userId, label: m.displayName }))]}
        />
        <Select
          label="Tâche liée"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          options={[{ value: '', label: 'Aucune' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
        />
      </form>
    </Dialog>
  )
}
