'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast/store'
import { setTicketsEnabled } from '@/app/(app)/projects/actions'

/**
 * Ce que voit le PROPRIÉTAIRE d'un projet sans tickets. Tout autre membre reçoit un 404 depuis
 * la page serveur : lui montrer un écran qu'il ne peut pas débloquer serait une impasse.
 */
export function TicketsDisabled({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  function enable() {
    start(async () => {
      const res = await setTicketsEnabled(projectId, true)
      if (res.error) { toast.error(res.error); return }
      // L'action ne revalide que `/projects` : sans ce refresh la carte resterait affichée
      // alors que les tickets sont activés.
      router.refresh()
    })
  }

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <Link href={`/projects/${projectId}`} className="font-mono text-sm underline brutal-focus">← {projectName}</Link>
      <div className="mt-6 bg-paper brutal p-6 space-y-3">
        <h1 className="text-2xl">Tickets</h1>
        <p className="text-sm">
          Ce projet n&apos;a pas de backlog. En l&apos;activant, tu obtiens une liste de tickets
          numérotés, rattachables aux tâches de la frise.
        </p>
        <p className="font-mono text-xs text-ink-soft">
          Rien n&apos;est perdu si tu changes d&apos;avis : désactiver masque les tickets, ne les supprime pas.
        </p>
        <Button onClick={enable} disabled={pending}>Activer les tickets</Button>
      </div>
    </main>
  )
}
