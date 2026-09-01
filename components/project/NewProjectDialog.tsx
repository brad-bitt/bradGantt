'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { createProject } from '@/app/(app)/projects/actions'
import { toast } from '@/lib/toast/store'

export function NewProjectDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await createProject(name)
      // Politique d'erreur unifiée : validation -> inline dans le formulaire,
      // persistance -> toast.
      // On efface d'abord tout message inline précédent : une erreur de validation
      // suivie d'un échec de persistance ne doit pas laisser les deux affichés à la
      // fois (le message inline resterait affiché sous le toast sinon).
      setError(null)
      if (res.fieldError) { setError(res.fieldError); return }
      if (res.error || !res.id) { toast.error(res.error ?? 'Création impossible, réessaie.'); return }
      setOpen(false); setName('')
      // Le plan 1 se contentait de `revalidatePath('/projects')` côté serveur faute de page
      // projet ; celle-ci existe depuis la tâche 9, on emmène donc l'utilisateur droit dans le
      // Gantt du projet qu'il vient de créer.
      router.push(`/projects/${res.id}`)
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Nouveau projet</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nouveau projet">
        <form id="new-project" onSubmit={submit}>
          <Input label="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} autoFocus />
        </form>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
          <Button type="submit" form="new-project" disabled={pending}>Créer</Button>
        </div>
      </Dialog>
    </>
  )
}
