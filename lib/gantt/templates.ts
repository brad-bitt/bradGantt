import type { TaskType } from './types'
import { addDays } from './dates'

/**
 * Un élément de modèle : une tâche, un jalon ou un groupe, daté EN JOURS depuis le jour où le
 * modèle est appliqué. `parent` et `after` désignent d'autres éléments du même modèle par leur
 * clé — jamais par un identifiant de base, qui n'existe pas encore.
 */
export interface TemplateItem {
  key: string
  title: string
  type: TaskType
  /** Clé du groupe qui contient cet élément. Interdit sur un groupe. */
  parent?: string
  /** Premier jour, en jours après aujourd'hui (0 = aujourd'hui). Ignoré pour un groupe. */
  start: number
  /** Nombre de jours, 1 au minimum. Forcé à 1 pour un jalon, ignoré pour un groupe. */
  days: number
  color: string
  /** Clés des éléments dont celui-ci dépend (flèche fin → début). */
  after?: string[]
}

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  items: TemplateItem[]
}

/** Un élément daté, prêt à être créé. Les clés y sont conservées pour résoudre parent et liens. */
export interface PlannedItem {
  key: string
  title: string
  type: TaskType
  parent: string | null
  startDate: string
  endDate: string
  color: string
  after: string[]
}

// Couleurs du registre DONNÉES (lib/gantt/palette.ts), jamais le jaune.
const BLUE = '#5B9DFF'
const TANGERINE = '#FF8A3D'
const ROSE = '#FF6FA3'
const EMERALD = '#3ECF8E'
const VIOLET = '#A78BFA'
const CYAN = '#34D3E0'
const LIME = '#B4E45C'
const OCHRE = '#E9B44C'

/**
 * Les trois modèles proposés sur un projet vide. Ils sont volontairement COURTS — de six à neuf
 * lignes — : un modèle est un point de départ qu'on retaille, pas un plan qu'on subit. Chacun
 * montre les trois objets du produit (groupe, tâche, jalon) et au moins une chaîne de
 * dépendances, pour que le diagramme obtenu ressemble à un vrai et apprenne les gestes.
 */
export const TEMPLATES: ProjectTemplate[] = [
  {
    id: 'lancement',
    name: 'Lancement produit',
    description: 'Cadrage, conception, développement, recette, puis le jour J.',
    items: [
      { key: 'g-prep', title: 'Préparation', type: 'group', start: 0, days: 0, color: BLUE },
      { key: 'cadrage', title: 'Cadrage', type: 'task', parent: 'g-prep', start: 0, days: 5, color: BLUE },
      { key: 'conception', title: 'Conception', type: 'task', parent: 'g-prep', start: 5, days: 7, color: CYAN, after: ['cadrage'] },
      { key: 'g-real', title: 'Réalisation', type: 'group', start: 0, days: 0, color: TANGERINE },
      { key: 'dev', title: 'Développement', type: 'task', parent: 'g-real', start: 12, days: 15, color: TANGERINE, after: ['conception'] },
      { key: 'recette', title: 'Recette', type: 'task', parent: 'g-real', start: 27, days: 5, color: ROSE, after: ['dev'] },
      { key: 'lancement', title: 'Lancement', type: 'milestone', start: 33, days: 1, color: EMERALD, after: ['recette'] },
    ],
  },
  {
    id: 'sprint',
    name: 'Sprint de deux semaines',
    description: 'Planification, dix jours de travail, démo et rétrospective.',
    items: [
      { key: 'planif', title: 'Planification', type: 'task', start: 0, days: 1, color: VIOLET },
      { key: 'g-dev', title: 'Développement', type: 'group', start: 0, days: 0, color: BLUE },
      { key: 'lot1', title: 'Lot 1', type: 'task', parent: 'g-dev', start: 1, days: 5, color: BLUE, after: ['planif'] },
      { key: 'lot2', title: 'Lot 2', type: 'task', parent: 'g-dev', start: 4, days: 5, color: CYAN },
      { key: 'tests', title: 'Tests et corrections', type: 'task', start: 9, days: 3, color: OCHRE, after: ['lot1', 'lot2'] },
      { key: 'demo', title: 'Démo', type: 'milestone', start: 12, days: 1, color: EMERALD, after: ['tests'] },
      { key: 'retro', title: 'Rétrospective', type: 'task', start: 13, days: 1, color: LIME, after: ['demo'] },
    ],
  },
  {
    id: 'evenement',
    name: 'Événement',
    description: 'Lieu, communication, logistique, et le jour J en jalon.',
    items: [
      { key: 'g-orga', title: 'Organisation', type: 'group', start: 0, days: 0, color: ROSE },
      { key: 'lieu', title: 'Réserver le lieu', type: 'task', parent: 'g-orga', start: 0, days: 4, color: ROSE },
      { key: 'programme', title: 'Programme et intervenants', type: 'task', parent: 'g-orga', start: 4, days: 10, color: VIOLET, after: ['lieu'] },
      { key: 'g-com', title: 'Communication', type: 'group', start: 0, days: 0, color: TANGERINE },
      { key: 'invitations', title: 'Invitations', type: 'task', parent: 'g-com', start: 8, days: 6, color: TANGERINE, after: ['lieu'] },
      { key: 'relances', title: 'Relances', type: 'task', parent: 'g-com', start: 18, days: 4, color: OCHRE, after: ['invitations'] },
      { key: 'logistique', title: 'Logistique', type: 'task', start: 16, days: 8, color: CYAN, after: ['programme'] },
      { key: 'jourj', title: 'Jour J', type: 'milestone', start: 25, days: 1, color: EMERALD, after: ['relances', 'logistique'] },
    ],
  },
]

export function findTemplate(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

/**
 * Date les éléments d'un modèle à partir de `today`, dans l'ordre du modèle.
 *
 * Les groupes reçoivent l'empan de leurs enfants : la base exige des dates sur toute ligne, et
 * `computeLayout` recalcule cet empan de toute façon — autant qu'il soit juste dès l'insertion.
 * Un groupe sans enfant tient sur le jour même.
 */
export function instantiate(template: ProjectTemplate, today: string): PlannedItem[] {
  const planned = template.items.map((item): PlannedItem => {
    const days = item.type === 'milestone' ? 1 : Math.max(1, item.days)
    const startDate = addDays(today, item.start)
    return {
      key: item.key,
      title: item.title,
      type: item.type,
      parent: item.type === 'group' ? null : (item.parent ?? null),
      startDate,
      endDate: addDays(startDate, days - 1),
      color: item.color,
      after: item.after ?? [],
    }
  })
  for (const group of planned) {
    if (group.type !== 'group') continue
    const children = planned.filter((p) => p.parent === group.key)
    if (children.length === 0) {
      group.startDate = today
      group.endDate = today
      continue
    }
    group.startDate = children.map((c) => c.startDate).sort()[0]
    group.endDate = children.map((c) => c.endDate).sort().at(-1)!
  }
  return planned
}
