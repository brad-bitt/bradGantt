import { NewProjectDialog } from './NewProjectDialog'

/**
 * Premier écran d'un compte neuf.
 *
 * Il remplace une phrase posée dans une boîte (« Aucun projet. Crée le premier ! ») qui ne disait
 * pas ce qu'on allait y faire. Les trois repères en bas sont les gestes propres à un Gantt : ce
 * sont eux qui distinguent cet outil d'une liste de tâches, autant les annoncer avant.
 */
export function NoProjects() {
  return (
    <div className="mx-auto max-w-2xl bg-paper brutal shadow-brutal-xl p-8 space-y-5">
      <h2 className="text-3xl">Rien à planifier pour l’instant</h2>
      <p className="font-bold">
        Un projet BradGantt, c’est une frise partagée : des tâches, des groupes, des jalons, et les
        flèches qui disent ce qui attend quoi.
      </p>
      <NewProjectDialog />
      <ul className="grid gap-3 border-t-[3px] border-ink pt-5 sm:grid-cols-3">
        <li>
          <p className="font-display text-sm uppercase">Enchaîner</p>
          <p className="font-mono text-xs text-ink-soft">Une tâche démarre le lendemain de celle qui la précède.</p>
        </li>
        <li>
          <p className="font-display text-sm uppercase">Partager</p>
          <p className="font-mono text-xs text-ink-soft">Invite qui tu veux en lecture ou en écriture.</p>
        </li>
        <li>
          <p className="font-display text-sm uppercase">Déplacer</p>
          <p className="font-mono text-xs text-ink-soft">Glisse les barres, la frise suit.</p>
        </li>
      </ul>
    </div>
  )
}
