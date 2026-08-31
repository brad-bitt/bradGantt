'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { createProject } from '@/app/(app)/projects/actions'
import { toast } from '@/lib/toast/store'

export function NewProjectDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await createProject(name)
      // Politique d'erreur unifiée : validation -> inline dans le formulaire,
      // persistance -> toast. `revalidatePath('/projects')` côté serveur (dans
      // createProject) suffit à rafraîchir la liste ; pas besoin de router.refresh().
      if (res.fieldError) { setError(res.fieldError); return }
      if (res.error) { toast.error(res.error); return }
      setOpen(false); setName(''); setError(null)
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
