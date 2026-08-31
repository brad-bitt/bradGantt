// Garde d'activation de la porte de test `/e2e-login`. Volontairement PAS en
// `NEXT_PUBLIC_*` : ces variables sont inlinées par Next.js au moment du build,
// y compris dans le code serveur. Un build produit avec `E2E_ENABLED=1` figerait
// la comparaison à "vrai" dans le binaire compilé, et aucune variable au runtime
// ne pourrait plus refermer la page — il faudrait reconstruire. `E2E_ENABLED`
// reste donc une variable serveur uniquement, lue au runtime.
export function isE2EEnabled(env: Record<string, string | undefined>): boolean {
  return env.E2E_ENABLED === '1'
}
