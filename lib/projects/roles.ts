import type { Role } from '@/lib/gantt/types'
import type { BadgeColor } from '@/components/ui/Badge'

/**
 * Le rôle tel qu'on le LIT. Les valeurs `owner` / `editor` / `viewer` sont celles de la base ;
 * elles s'affichaient telles quelles, seul mot anglais d'une interface française.
 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propriétaire',
  editor: 'Éditeur',
  viewer: 'Lecteur',
}

/**
 * Une seule table pour la carte de projet, la page Membres et les invitations : un rôle garde sa
 * couleur d'un écran à l'autre. Import de TYPE seul, aucun composant n'est tiré dans `lib`.
 */
export const ROLE_BADGE: Record<Role, BadgeColor> = {
  owner: 'violet',
  editor: 'blue',
  viewer: 'cyan',
}
