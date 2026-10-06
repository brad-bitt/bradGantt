'use client'
import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast/store'
import { setTicketsEnabled } from '@/app/(app)/(accueil)/projects/actions'

/**
 * Ce que voit le PROPRIÉTAIRE d'un projet sans tickets. Tout autre membre reçoit une 404 depuis
 * la page serveur : lui montrer un écran qu'il ne peut pas débloquer serait une impasse.
 *
 * Plus de lien retour : le fil d'Ariane et les onglets de l'en-tête en tiennent lieu. Plus de
 * `router.refresh()` non plus : l'action revalide le layout du projet, la page se re-rend seule.
 */
export function TicketsDisabled({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition()

  function enable() {
    start(async () => {
      const res = await setTicketsEnabled(projectId, true)
      if (res.error) toast.error(res.error)
    })
  }

  return (
    <main className="mx-auto w-full max-w-2xl overflow-y-auto p-4 sm:p-8">
      <div className="bg-paper brutal p-6 space-y-3">
        <h2 className="text-2xl">Tickets</h2>
        <p className="text-sm">
          Ce projet n&apos;a pas de backlog. En l&apos;activant, tu obtiens une liste de tickets
          numérotés, rattachables aux tâches du Gantt.
        </p>
        <p className="text-xs text-ink-soft">
          Rien n&apos;est perdu si tu changes d&apos;avis : désactiver masque les tickets, ne les supprime pas.
        </p>
        <Button onClick={enable} disabled={pending}>Activer les tickets</Button>
      </div>
    </main>
  )
}
