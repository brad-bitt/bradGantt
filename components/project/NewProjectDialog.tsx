'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { createProject } from '@/app/(app)/projects/actions'

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
      if (res.error) { setError(res.error); return }
      setOpen(false); setName(''); setError(null)
      router.refresh()
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
