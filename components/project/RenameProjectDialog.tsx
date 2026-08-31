'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { renameProject } from '@/app/(app)/projects/actions'
import { toast } from '@/lib/toast/store'

export function RenameProjectDialog({ projectId, currentName, open, onClose }: { projectId: string; currentName: string; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await renameProject(projectId, name)
      // Politique d'erreur unifiée : validation -> inline dans le formulaire,
      // persistance -> toast. Jamais les deux à la fois pour un même échec.
      if (res.fieldError) { setError(res.fieldError); return }
      if (res.error) { toast.error(res.error); return }
      onClose()
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Renommer le projet">
      <form id="rename-project" onSubmit={submit}>
        <Input label="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} autoFocus />
      </form>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" form="rename-project" disabled={pending}>Enregistrer</Button>
      </div>
    </Dialog>
  )
}
