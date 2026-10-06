/**
 * Aide de commande optimiste, partagée par `lib/gantt` et `lib/tickets`.
 *
 * Extraite de `lib/gantt/commands.ts` plutôt que dupliquée : elle porte deux décisions
 * subtiles qu'on ne veut pas voir diverger entre deux modules.
 */

/** Le minimum qu'un store doit exposer pour être piloté par ce coureur. Un store Zustand créé par `create()` le satisfait structurellement. */
export interface OptimisticStore<E> {
  getState(): { epoch: number; apply: (event: E) => void }
}

export interface RunnerDeps<E> {
  store: OptimisticStore<E>
  notify: (message: string) => void
  /** Message utilisateur en cas d'échec de persistance. Générique : la cause technique part au journal. */
  errorMessage: string
}

export type Runner<E> = (event: E | E[], inverse: E[], persist: () => Promise<void>) => Promise<boolean>

/**
 * Applique `event` (optimiste), persiste, puis en cas d'échec rejoue `inverse` pour annuler
 * *uniquement* ce que cette commande a fait — jamais un instantané global.
 *
 * Un instantané global casserait dès que deux commandes sont en vol en même temps (un
 * glisser-déposer suivi d'une autre action, typiquement) : le rollback de la première
 * effacerait le travail déjà réussi de la seconde. L'événement inverse, lui, ne touche que les
 * entités que cette commande a modifiées, donc il commute proprement avec le reste — y
 * compris, plus tard, avec des événements distants reçus en temps réel.
 *
 * Garde-fou de contexte : si les données affichées ont été remplacées pendant que la commande
 * était en vol, on n'annule rien. `epoch` change à chaque `hydrate`, ce qui couvre les deux
 * cas — navigation vers un autre projet (les entités de l'ancien corrompraient le nouveau) et
 * rechargement du même projet (l'état frais vient du serveur, y réinjecter des entités d'avant
 * y ferait réapparaître des fantômes). On signale simplement l'échec.
 */
export function createRunner<E>({ store, notify, errorMessage }: RunnerDeps<E>): Runner<E> {
  return async function run(event, inverse, persist) {
    const epoch = store.getState().epoch
    for (const e of Array.isArray(event) ? event : [event]) store.getState().apply(e)
    try {
      await persist()
      return true
    } catch (err) {
      // Cause technique préservée pour le diagnostic (RLS, réseau, requête) ; le message utilisateur reste générique.
      console.error(err)
      if (store.getState().epoch === epoch) {
        for (const e of inverse) store.getState().apply(e)
      }
      notify(errorMessage)
      return false
    }
  }
}
