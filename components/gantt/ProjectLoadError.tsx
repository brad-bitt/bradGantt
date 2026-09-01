import Link from 'next/link'

/**
 * Écran d'échec de CHARGEMENT du projet. Il existe pour ne pas confondre deux situations que
 * l'utilisateur ne peut pas distinguer autrement : « ce projet n'a pas de tâches » (état nominal,
 * rendu par le Gantt lui-même) et « les données n'ont pas pu être lues » (panne). La confusion
 * coûte cher : elle pousse à recréer des tâches qui existent déjà en base.
 * Le message reste générique, la cause technique part au journal serveur.
 */
export function ProjectLoadError({ retryHref, projectName }: { retryHref: string; projectName?: string }) {
  return (
    <main className="p-8 space-y-6">
      <h1 className="text-4xl">{projectName ?? 'Projet'}</h1>
      <div role="alert" className="bg-paper brutal max-w-xl space-y-4 p-6">
        <p className="font-display text-2xl uppercase">Chargement impossible</p>
        <p className="font-bold">
          Les données de ce projet n&apos;ont pas pu être chargées. Rien n&apos;a été perdu : réessaie dans un instant.
        </p>
        <p className="font-mono text-sm">
          Ce n&apos;est pas un projet vide — ne recrée pas tes tâches.
        </p>
        <div className="flex gap-4">
          {/* `<a>` et non `<Link>` : on veut un rechargement complet, pas une reprise du cache routeur. */}
          <a href={retryHref} className="font-mono text-sm underline brutal-focus">Réessayer</a>
          <Link href="/projects" className="font-mono text-sm underline brutal-focus">← Projets</Link>
        </div>
      </div>
    </main>
  )
}
