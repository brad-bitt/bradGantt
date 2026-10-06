# BradGantt — Hiérarchie visuelle et navigation — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chaque écran de BradGantt une action principale évidente, une navigation de projet dans l'en-tête noir (fil d'Ariane, onglets Gantt / Tickets / Membres) et un vocabulaire entièrement français, sans changer le style néo-brutaliste ni le schéma.

**Architecture:** Trois niveaux de poids portés par `Button` (`primary` / `secondary` / `quiet`, plus le destructif) et un composant `Menu` « ⋯ » accessible, réutilisé partout. Les routes passent dans deux groupes, `(accueil)` et `(projet)`, chacun avec son en-tête ; le layout de projet lit une fois le projet et ses membres et rend `ProjectHeader` (serveur) avec `ProjectTabs` (client). « Membres » devient une page. Les barres d'outils du Gantt et des tickets ne gardent que les commandes de vue ; le Gantt gagne une mise en évidence du retard (`highlightLate`) et un recentrage rappelable (`scrollTarget`) dans son store.

**Tech Stack:** Next.js 15 (App Router, groupes de routes, Server Actions), TypeScript, Tailwind v4, Supabase (Postgres, RLS), Zustand, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-bradgantt-hierarchie-navigation-design.md`

## Global Constraints

- **Branche de travail : `feat/05-hierarchie-navigation`.** Elle existe déjà et porte la spec. Ne jamais commiter sur `master`.
- **`npx supabase db reset` et `npx supabase db push` ne doivent JAMAIS être lancés par l'agent** (bloqués dans cet environnement). Ce lot n'a de toute façon aucune migration ni changement de RLS.
- **Ports non standards :** application sur `3100`, API Supabase sur `54421`, Postgres sur `54422`.
- **Politique d'erreur du projet :** une erreur de **validation** part en message inline dans le formulaire, un échec de **persistance** part en toast. Jamais les deux pour un même échec.
- **Écritures sur une seule ligne :** toujours `{ count: 'exact' }` puis rejet si `count !== 1`.
- **Isolation inter-projets :** toute lecture de `tasks`, `dependencies` ou `tickets` dans une page de projet porte `.eq('project_id', id)`. La RLS autorise la lecture de TOUS les projets dont on est membre.
- **Langue :** interface et commentaires en français. Les commentaires expliquent le **pourquoi**, jamais le quoi.
- **Trois niveaux de poids (spec §3) :** un seul bouton noir (`primary`) visible par écran ; `secondary` = bordure 3 px sans ombre ; `quiet` = texte seul souligné au survol ; destructif `danger-quiet` au repos, `danger` seulement sur la confirmation. Capitales grasses réservées aux titres de page et aux en-têtes de section ou de colonne ; `font-mono` réservée aux chiffres, dates, numéros de ticket et au badge « ⌗ 1/2 ». Jaune = actif (onglet courant, segment choisi, focus). Révélation au survol par l'OPACITÉ (`opacity-0 group-hover/…:opacity-100 focus-visible:opacity-100 touch:opacity-100`), jamais par rendu conditionnel.
- **Ne jamais écrire dans « Projet démo » (`c0000000-0000-0000-0000-000000000001`) depuis un test e2e.** Écrire dans des projets jetables (`Date.now()` dans le nom) ; « Projet tickets » (`c0000000-0000-0000-0000-000000000003`) seulement en lecture.
- **Commandes de vérification :** `npm test` (Vitest), `npm run test:db` (pgTAP), `npm run test:e2e` (Playwright), `npm run typecheck`, `npm run lint`.
- **Serveur de dev :** il tourne en tâche de fond sur 3100 (`run_in_background`). Ne jamais le tuer avec `pkill -f <motif>` ; ne jamais lancer `npm run build` pendant que `npm run dev` tourne.
- **Échecs e2e environnementaux connus** (dates du seed local périmées), à ignorer tant que Léo n'a pas relancé un `db reset` : gantt-drag « un lecteur ne peut pas déplacer une barre », gantt-view « la vue s'ouvre recentrée sur aujourd'hui », projects « chaque carte porte sa vignette ».
- **Commits :** `git add <fichiers>` explicites, jamais `git add -A` ; pas d'`--amend`, pas de `--no-verify`. Chaque message de commit se termine par exactement cette ligne, en dernier paragraphe :

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

- **Déplacer un fichier de route dans un groupe (`(accueil)`, `(projet)`) se fait avec `git mv`**, pour que l'historique suive.
- **Tests unitaires et `.next/types` :** `tsconfig.json` inclut `.next/types/**/*.ts`. Après les `git mv` de la tâche 4, si `npm run typecheck` signale des fichiers de `.next/types` qui pointent vers les anciens chemins, supprimer `.next/types` (`rm -rf .next/types`) : `next dev` le régénère.

## Review Focus

1. **Un clic dans un menu « ⋯ » posé sur une surface active** (carte de ticket qu'on glisse et qu'on double-clique, carte de projet entièrement cliquable) : seul le menu doit réagir — ni glisser armé, ni éditeur ouvert, ni navigation. Testé dans `Menu.test.tsx` (tâche 2) et `TicketCard.test.tsx` (tâche 14).
2. **Un nom de projet de 100 caractères sur un téléphone de 390 px** : l'en-tête tronque le nom, passe sur deux rangées, garde les onglets et le menu du compte atteignables, sans défilement horizontal. Testé dans `mobile.spec.ts` (tâche 15).
3. **Supprimer le projet depuis l'en-tête de ce même projet** : on doit atterrir sur `/projects`, jamais sur une 404 du projet qu'on vient de supprimer. Testé dans `actions.test.ts` et `ProjectMenu.test.tsx`, puis de bout en bout dans `projects.spec.ts` (tâche 6).
4. **Désactiver les tickets depuis l'en-tête alors qu'on est sur la page Tickets** : la page doit basculer d'elle-même sur la carte d'activation, sans rechargement manuel. Testé dans `projects.spec.ts` (tâche 6).
5. **`?filtre=retard` sans aucun projet en retard, ou `?filtre=` avec une valeur inconnue** : un message explicite et « Tout afficher », jamais une grille vide muette ; une valeur inconnue est ignorée. Testé dans `filter.test.ts` (tâche 7).

---

## Carte des fichiers

**Créés**

| Fichier | Responsabilité |
| --- | --- |
| `components/ui/Menu.tsx` | Menu « ⋯ » accessible (portail, clavier, retour du focus) |
| `lib/projects/roles.ts` | Libellés et couleurs des rôles (Propriétaire / Éditeur / Lecteur) |
| `lib/projects/members.ts` | Lignes `memberships` → `Member[]`, rôle lu sur les lignes brutes |
| `lib/projects/filter.ts` | Filtre `?filtre=retard` de la liste des projets |
| `components/layout/ProfileProvider.tsx` | Profil courant partagé par les deux en-têtes |
| `components/layout/UserMenu.tsx` | Avatar + menu (nom, thème, déconnexion) |
| `components/layout/ProjectHeader.tsx` | En-tête noir d'un projet (serveur) |
| `components/layout/ProjectTabs.tsx` | Onglets Gantt / Tickets / Membres (client, `usePathname`) |
| `app/(app)/(accueil)/layout.tsx` | En-tête hors projet |
| `app/(app)/(projet)/projects/[id]/layout.tsx` | Lecture du projet et en-tête de projet |
| `app/(app)/(projet)/projects/[id]/membres/page.tsx` | Page Membres (serveur) |
| `components/members/MembersPage.tsx` | Contenu de la page Membres, repris de `MembersDialog` |
| `components/project/ProjectMenu.tsx` | Menu « ⋯ » d'un projet (carte et en-tête) |
| `components/project/ProjectsSummaryLine.tsx` | Ligne de synthèse, remplace `ProjectsOverview` |
| `components/tickets/TicketFilterFields.tsx` | Les trois filtres du backlog |
| `components/tickets/status.ts` | Couleur d'accent de chaque statut |

**Déplacés (`git mv`)**

| Avant | Après |
| --- | --- |
| `app/(app)/projects/page.tsx` | `app/(app)/(accueil)/projects/page.tsx` |
| `app/(app)/projects/actions.ts` | `app/(app)/(accueil)/projects/actions.ts` |
| `app/(app)/projects/[id]/page.tsx` | `app/(app)/(projet)/projects/[id]/page.tsx` |
| `app/(app)/projects/[id]/members-actions.ts` | `app/(app)/(projet)/projects/[id]/members-actions.ts` |
| `app/(app)/projects/[id]/tickets/page.tsx` | `app/(app)/(projet)/projects/[id]/tickets/page.tsx` |

**Supprimés :** `components/project/ProjectsOverview.tsx`, `components/project/MembersDialog.tsx`.

**Modifiés :** `Button`, `Badge`, `Input`, `Select`, `Textarea`, `Dialog`, `ThemeToggle`, `AppHeader`, `app/(app)/layout.tsx`, `app/globals.css`, `ProjectCard`, `MiniGantt`, `RenameProjectDialog` (import), `NewProjectDialog` (import), `MemberRow`, `GanttPage`, `GanttToolbar`, `ZoomControls`, `GanttView`, `SidebarRow`, `ContextMenu`, `GanttSummary`, `TaskBar`, `MilestoneMark`, `GroupBar`, `TaskEditor`, `useKeyboardShortcuts`, `lib/gantt/store.ts`, `lib/gantt/summary.ts`, `TicketsPage`, `TicketsToolbar`, `TicketBoard`, `TicketColumn`, `TicketCard`, `TicketList`, `TicketEditor`, `TicketsDisabled`, `lib/tickets/types.ts`, `app/invite/[token]/InviteError.tsx`, `README.md`.

## Décisions prises là où la spec laisse un détail ouvert

- **Le thème vit dans le menu du compte, dans les deux en-têtes.** La spec liste « le thème » à côté de l'avatar dans un projet ET dans « le même menu utilisateur » : deux commandes au même nom accessible (« Passer au thème sombre ») sur un écran. Une seule place, le menu.
- **Le contexte de profil est un composant client.** Un contexte React n'existe pas côté serveur : `ProfileProvider` est client, posé par `app/(app)/layout.tsx`, et seul `UserMenu` (client) le lit.
- **La suppression depuis l'en-tête redirige côté serveur** (`deleteProject(id, true)` appelle `redirect('/projects')`). Une redirection client après coup laisserait Next re-rendre la page du projet supprimé, donc une 404 fugitive.
- **La pile d'avatars de l'en-tête est décorative** (`aria-hidden`), pas un second lien « Membres » à côté de l'onglet.
- **Le compteur de la barre des tickets** dit « 3 tickets » sans filtre et « 1 sur 3 tickets » avec filtre : un filtre qui cache tout ne doit pas se lire comme un backlog vide.
- **Sur la page Membres, une ligne modifiable montre le sélecteur de rôle et non le badge** : badge et sélecteur disaient deux fois la même chose côte à côte.
- **Le badge « ⌗ 1/2 » garde un texte masqué (`sr-only`) au lieu d'un `aria-label`** : sur un `<span>` sans rôle, `aria-label` n'est pas annoncé de façon fiable (constat déjà fait au lot 4), et l'e2e lit ce texte.
- **Sur un compte sans projet, le bouton « Nouveau projet » du titre disparaît** : la carte d'accueil porte déjà le sien, deux boutons noirs pour un même geste.
- **`invitations` quitte le store du Gantt** : seule la fenêtre Membres les lisait ; la page Membres les lit elle-même.
- **La barre des tickets garde le badge « Lecture seule »** pour un lecteur, à la place de « + Ticket » (même règle que le Gantt).

---

# Lot 1 — Primitives

## Task 1: Poids des boutons, badges et libellés en casse mixte

**Files:**
- Modify: `components/ui/Button.tsx`
- Modify: `components/ui/Badge.tsx`
- Modify: `components/ui/Input.tsx`, `components/ui/Select.tsx`, `components/ui/Textarea.tsx` (libellé de champ)
- Modify: `components/ui/Dialog.tsx:115` (bouton « Fermer »)
- Modify: `components/gantt/TaskEditor.tsx:208` (bouton « Supprimer »)
- Create: `lib/projects/roles.ts`
- Test: `tests/unit/components/ui/Button.test.tsx`, `tests/unit/components/ui/Badge.test.tsx`, `tests/unit/components/ui/Casing.test.tsx` (nouveau)

**Interfaces:**
- Consomme : rien.
- Produit : `Button` avec `variant?: 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-quiet'` (`ghost` disparaît) ; `BadgeColor` gagne `'paper'` ; `ROLE_LABELS: Record<Role, string>` et `ROLE_BADGE: Record<Role, BadgeColor>` dans `lib/projects/roles.ts`.

- [ ] **Step 1: Écrire les tests qui échouent**

Remplacer `tests/unit/components/ui/Button.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('rend le libellé et déclenche onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Créer</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applique la classe de variante', () => {
    render(<Button variant="danger">Supprimer</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-danger')
  })

  it('est de type button par défaut', () => {
    render(<Button>Ok</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('ne déclenche pas onClick si désactivé', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Ok</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('ne met plus le libellé en capitales', () => {
    render(<Button>Nouveau projet</Button>)
    expect(screen.getByRole('button')).not.toHaveClass('uppercase')
  })

  it('seul le niveau 1 porte l\'ombre brutale', () => {
    render(
      <>
        <Button>Principal</Button>
        <Button variant="secondary">Secondaire</Button>
        <Button variant="quiet">Discret</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Principal' })).toHaveClass('brutal')
    const secondary = screen.getByRole('button', { name: 'Secondaire' })
    expect(secondary).not.toHaveClass('brutal')
    expect(secondary).toHaveClass('border-ink')
    expect(screen.getByRole('button', { name: 'Discret' })).not.toHaveClass('brutal')
    expect(screen.getByRole('button', { name: 'Discret' })).toHaveClass('border-transparent')
  })

  it('le destructif discret est rouge sans fond au repos', () => {
    render(<Button variant="danger-quiet">Supprimer</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-danger', 'bg-transparent')
    expect(screen.getByRole('button')).not.toHaveClass('brutal')
  })
})
```

Remplacer `tests/unit/components/ui/Badge.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('rend le contenu avec la couleur demandée', () => {
    render(<Badge color="cyan">Lecteur</Badge>)
    expect(screen.getByText('Lecteur')).toHaveClass('bg-cyan')
  })
  it('est encre par défaut', () => {
    render(<Badge>Propriétaire</Badge>)
    expect(screen.getByText('Propriétaire')).toHaveClass('bg-ink')
  })
  it('est en casse mixte et hors police mono', () => {
    render(<Badge>Éditeur</Badge>)
    expect(screen.getByText('Éditeur')).not.toHaveClass('uppercase')
    expect(screen.getByText('Éditeur')).not.toHaveClass('font-mono')
  })
  it('a une couleur papier, celle du statut « À faire »', () => {
    render(<Badge color="paper">À faire</Badge>)
    expect(screen.getByText('À faire')).toHaveClass('bg-paper', 'text-ink')
  })
})
```

Créer `tests/unit/components/ui/Casing.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

// Spec §3 : les capitales grasses ne servent plus qu'aux titres. Un libellé de champ en
// capitales criait plus fort que le titre de la fenêtre qui le contenait.
describe('libellés de champ en casse mixte', () => {
  it('Input, Select et Textarea', () => {
    render(
      <>
        <Input label="Titre" />
        <Select label="Statut" options={[{ value: 'a', label: 'A' }]} />
        <Textarea label="Description" />
      </>,
    )
    for (const name of ['Titre', 'Statut', 'Description']) {
      expect(screen.getByText(name)).not.toHaveClass('uppercase')
    }
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/ui/Button.test.tsx tests/unit/components/ui/Badge.test.tsx tests/unit/components/ui/Casing.test.tsx`
Attendu : ÉCHEC — `uppercase` présent, `secondary` porte `brutal`, `quiet` et `paper` n'existent pas.

- [ ] **Step 3: Implémenter**

Remplacer `components/ui/Button.tsx` :

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-quiet'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  /* Niveau 1 : l'action principale, une seule par écran. C'est le seul bouton qui porte l'ombre
     brutale — quand chaque bouton en avait une, aucun ne se détachait. */
  primary: 'bg-ink text-cream brutal brutal-press',
  /* Niveau 2 : même bordure, sans ombre. Il se voit, il ne réclame pas. */
  secondary: 'bg-paper text-ink border-[3px] border-ink hover:bg-band',
  /* Niveau 3 : du texte. La bordure transparente garde la hauteur des deux autres niveaux, pour
     qu'une barre qui les mélange ne sautille pas d'un bouton à l'autre. */
  quiet: 'bg-transparent text-ink border-[3px] border-transparent underline-offset-4 hover:underline',
  /* Réservé au bouton de CONFIRMATION d'une suppression : l'accent va à la décision, pas à la
     tentation. */
  danger: 'bg-danger text-on-data brutal brutal-press',
  /* Destructif au repos : rouge, mais sans aplat. Sur une liste de projets, « Supprimer » en
     aplat rouge était l'élément le plus visible de l'écran alors que c'est l'action la plus rare. */
  'danger-quiet': 'bg-transparent text-danger border-[3px] border-transparent hover:bg-danger hover:text-on-data',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-5 py-2 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        // `whitespace-nowrap` : dans une barre qui replie ses boutons, un bouton ne se casse pas
        // en deux lignes, c'est la barre qui passe à la ligne. Casse mixte : les capitales sont
        // réservées aux titres (spec §3).
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-ui font-bold brutal-focus disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
```

Dans `components/ui/Badge.tsx`, remplacer le type, la table et la classe de base :

```tsx
import { cn } from '@/lib/utils'

export type BadgeColor = 'violet' | 'blue' | 'cyan' | 'rose' | 'emerald' | 'yellow' | 'ink' | 'paper'

// Texte `on-data` (encre noire fixe) sur toute couleur de DONNÉE : les couleurs sont calées assez
// claires pour ça, et le thème sombre ne doit pas y poser une encre crème. `paper` est l'exception :
// c'est une couleur de STRUCTURE (le statut « À faire »), son texte suit donc le thème.
const colors: Record<BadgeColor, string> = {
  violet: 'bg-violet text-on-data',
  blue: 'bg-blue text-on-data',
  cyan: 'bg-cyan text-on-data',
  rose: 'bg-rose text-on-data',
  emerald: 'bg-emerald text-on-data',
  yellow: 'bg-yellow text-on-data',
  ink: 'bg-ink text-cream',
  paper: 'bg-paper text-ink',
}

export function Badge({ color = 'ink', className, children }: { color?: BadgeColor; className?: string; children: React.ReactNode }) {
  // Casse mixte et police d'interface : un badge de rôle ou de statut est un mot, pas un chiffre.
  return (
    <span className={cn('inline-block border-[3px] border-ink px-2 py-0.5 text-xs font-bold', colors[color], className)}>
      {children}
    </span>
  )
}
```

Créer `lib/projects/roles.ts` :

```ts
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
```

Dans `components/ui/Input.tsx`, `components/ui/Select.tsx` et `components/ui/Textarea.tsx`, remplacer sur la ligne du `<label>` :

```tsx
className="font-bold uppercase text-sm"
```

par :

```tsx
className="font-bold text-sm"
```

Dans `components/ui/Dialog.tsx`, remplacer :

```tsx
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">✕</Button>
```

par :

```tsx
          <Button variant="quiet" size="sm" onClick={onClose} aria-label="Fermer">✕</Button>
```

Dans `components/gantt/TaskEditor.tsx`, remplacer :

```tsx
          {existing && <Button variant="danger" onClick={remove} disabled={busy} className="mr-auto">Supprimer</Button>}
```

par :

```tsx
          {/* Destructif au repos : « Enregistrer » doit rester le seul noir de la fenêtre (spec §3). */}
          {existing && <Button variant="danger-quiet" onClick={remove} disabled={busy} className="mr-auto">Supprimer</Button>}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/ui`
Attendu : PASS.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert. `typecheck` attrape toute utilisation restante de `variant="ghost"` (il n'y en avait qu'une, dans `Dialog`).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Button.tsx components/ui/Badge.tsx components/ui/Input.tsx components/ui/Select.tsx components/ui/Textarea.tsx components/ui/Dialog.tsx components/gantt/TaskEditor.tsx lib/projects/roles.ts tests/unit/components/ui/Button.test.tsx tests/unit/components/ui/Badge.test.tsx tests/unit/components/ui/Casing.test.tsx
git commit -m "feat(ui): trois niveaux de poids et casse mixte" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Menu « ⋯ » accessible

**Files:**
- Create: `components/ui/Menu.tsx`
- Modify: `app/globals.css` (utilitaire `brutal-focus-header`)
- Test: `tests/unit/components/ui/Menu.test.tsx`

**Interfaces:**
- Consomme : `cn` (`lib/utils`).
- Produit :

```ts
export type MenuEntry =
  | { kind?: 'item'; id: string; label: string; onSelect: () => void; danger?: boolean }
  | { kind: 'heading'; id: string; label: React.ReactNode }

export interface MenuProps {
  label: string                 // nom accessible du déclencheur ET de la liste
  entries: MenuEntry[]
  trigger?: React.ReactNode     // « ⋯ » par défaut
  triggerClassName?: string
  align?: 'start' | 'end'       // 'end' par défaut
  tone?: 'default' | 'header'   // 'header' : focus jaune, lisible sur la bande noire
  className?: string
}
export function Menu(props: MenuProps): JSX.Element
```

Utilitaire CSS `.brutal-focus-header`, réutilisé par tout élément focusable de l'en-tête noir.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/unit/components/ui/Menu.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Menu, type MenuEntry } from '@/components/ui/Menu'

function setup() {
  const onRename = vi.fn()
  const onDelete = vi.fn()
  const entries: MenuEntry[] = [
    { id: 'rename', label: 'Renommer', onSelect: onRename },
    { kind: 'heading', id: 'move', label: 'Déplacer vers…' },
    { id: 'doing', label: 'En cours', onSelect: vi.fn() },
    { id: 'delete', label: 'Supprimer', danger: true, onSelect: onDelete },
  ]
  render(
    <>
      <Menu label="Actions du projet" entries={entries} />
      <button type="button">Ailleurs</button>
    </>,
  )
  return { onRename, onDelete, trigger: screen.getByRole('button', { name: 'Actions du projet' }) }
}

describe('Menu', () => {
  it('annonce un menu replié, puis l\'ouvre avec le focus sur le premier item', async () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu', { name: 'Actions du projet' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toHaveFocus()
  })

  it('les flèches parcourent les items en boucle et sautent l\'intitulé', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'En cours' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toHaveFocus()
  })

  it('Échap referme et rend le focus au déclencheur', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('Entrée déclenche l\'item, referme et rend le focus', async () => {
    const { trigger, onRename } = setup()
    await userEvent.click(trigger)
    await userEvent.keyboard('{Enter}')
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('un item destructif est rouge', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Supprimer' })).toHaveClass('text-danger')
    expect(screen.getByRole('menuitem', { name: 'Renommer' })).not.toHaveClass('text-danger')
  })

  it('un clic ailleurs referme sans rien déclencher', async () => {
    const { trigger, onRename, onDelete } = setup()
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: 'Ailleurs' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  // Review Focus 1 : le menu vit sur des surfaces actives (carte qu'on glisse, carte-lien).
  it('ni le pointeur, ni le clic, ni le double-clic ne remontent au parent', async () => {
    const onPointerDown = vi.fn()
    const onClick = vi.fn()
    const onDoubleClick = vi.fn()
    const onSelect = vi.fn()
    render(
      <div onPointerDown={onPointerDown} onClick={onClick} onDoubleClick={onDoubleClick}>
        <Menu label="Actions" entries={[{ id: 'a', label: 'Faire', onSelect }]} />
      </div>,
    )
    await userEvent.dblClick(screen.getByRole('button', { name: 'Actions' }))
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Faire' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
    expect(onDoubleClick).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/ui/Menu.test.tsx`
Attendu : ÉCHEC — `Failed to resolve import "@/components/ui/Menu"`.

- [ ] **Step 3: Implémenter**

Dans `app/globals.css`, ajouter à la fin du bloc `@layer utilities` (avant son `}`) :

```css
  /* Focus dans l'en-tête : le contour pointillé d'encre de `brutal-focus` disparaît sur la bande
     noire. Le jaune y prend le relais — il signifie déjà « actif », et le focus en est un. */
  .brutal-focus-header { @apply outline-none focus-visible:outline-[3px] focus-visible:outline-dashed focus-visible:outline-yellow focus-visible:outline-offset-2; }
```

Créer `components/ui/Menu.tsx` :

```tsx
'use client'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type MenuEntry =
  | { kind?: 'item'; id: string; label: string; onSelect: () => void; danger?: boolean }
  /** Intitulé non interactif : un nom d'utilisateur, ou « Déplacer vers… » au-dessus de ses cibles. */
  | { kind: 'heading'; id: string; label: ReactNode }

export interface MenuProps {
  /** Nom accessible du déclencheur et de la liste : « ⋯ » seul ne dit rien à un lecteur d'écran. */
  label: string
  entries: MenuEntry[]
  /** Contenu visible du déclencheur. « ⋯ » par défaut. */
  trigger?: ReactNode
  triggerClassName?: string
  /** Bord du déclencheur sur lequel la liste s'aligne. */
  align?: 'start' | 'end'
  /** `header` : le focus passe au jaune, l'encre ne se voit pas sur la bande noire. */
  tone?: 'default' | 'header'
  className?: string
}

/** Marge minimale entre la liste et le bord de la fenêtre, en pixels. */
const EDGE = 8
/** Écart entre le déclencheur et la liste. */
const GAP = 4

const stop = (e: SyntheticEvent) => e.stopPropagation()

/**
 * Menu « ⋯ » : un déclencheur discret (niveau 3) et une liste de commandes posée dessous.
 *
 * La liste passe par un PORTAIL dans `body`, en `position: fixed`. Rendue en place, elle était
 * rognée par le défilement des colonnes du kanban et passait SOUS la carte suivante dès que la
 * sienne était translucide (une carte terminée est à 75 % d'opacité, donc un contexte
 * d'empilement à elle). Les événements React traversent quand même le portail : le `span`
 * englobant les arrête, si bien qu'un clic dans le menu n'arme pas le glisser d'une carte de
 * ticket, n'ouvre pas son éditeur au double-clic, et ne suit pas le lien d'une carte de projet.
 */
export function Menu({ label, entries, trigger, triggerClassName, align = 'end', tone = 'default', className }: MenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    // `preventScroll` : sur un téléphone, rendre le focus pouvait faire défiler la page, et le
    // défilement referme… le menu suivant.
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const t = triggerRef.current
    const l = listRef.current
    if (!t || !l) return
    // Mesure AVANT peinture : la liste ne s'affiche jamais à sa position provisoire (0, 0).
    const r = t.getBoundingClientRect()
    const { width, height } = l.getBoundingClientRect()
    const left = align === 'end' ? r.right - width : r.left
    const below = r.bottom + GAP
    setPos({
      left: Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE)),
      // Pas la place en dessous (une carte en bas d'écran) : la liste se pose au-dessus.
      top: below + height > window.innerHeight - EDGE ? Math.max(EDGE, r.top - GAP - height) : below,
    })
    l.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
  }, [open, align])

  useEffect(() => {
    if (!open) return
    // Clic ailleurs, défilement, redimensionnement : la liste fixe se détacherait de son
    // déclencheur, on la referme plutôt que de la laisser flotter.
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close(false)
    }
    const onMove = () => close(false)
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, close])

  function onListKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => {
      e.preventDefault()
      items[(n + items.length) % items.length].focus({ preventScroll: true })
    }
    switch (e.key) {
      case 'ArrowDown': go(i + 1); break
      case 'ArrowUp': go(i <= 0 ? items.length - 1 : i - 1); break
      case 'Home': go(0); break
      case 'End': go(items.length - 1); break
      case 'Escape':
        // Arrêtée ici : sans ça, l'Échap du Gantt (désélection) ou d'une fenêtre ouverte en
        // dessous partirait avec, et un seul appui fermerait deux choses.
        e.preventDefault()
        e.stopPropagation()
        close(true)
        break
      case 'Tab':
        // La liste vit en fin de `body` : laisser Tab avancer sortirait de la page.
        e.preventDefault()
        close(true)
        break
    }
  }

  const dots = trigger === undefined

  return (
    <span className={cn('relative inline-flex', className)} onPointerDown={stop} onClick={stop} onDoubleClick={stop}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          'inline-flex items-center justify-center',
          tone === 'header' ? 'brutal-focus-header' : 'brutal-focus',
          // Une seule taille pour tous les « ⋯ » : un `size-*` ajouté par l'appelant entrerait en
          // conflit avec celui-ci, et l'ordre des classes générées déciderait au hasard.
          dots && 'size-7 text-base font-bold leading-none hover:bg-yellow hover:text-on-data',
          triggerClassName,
        )}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) }
        }}
      >
        {trigger ?? <span aria-hidden>⋯</span>}
      </button>
      {open && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="menu"
          aria-label={label}
          // Surface posée : bordure, fond papier, ombre brutale (spec §3). `text-ink` explicite :
          // ouvert depuis l'en-tête, la liste hériterait sinon de l'encre crème de la bande noire.
          className="fixed z-50 min-w-52 border-[3px] border-ink bg-paper py-1 text-ink shadow-brutal"
          style={{ top: pos.top, left: pos.left }}
          onKeyDown={onListKeyDown}
          onPointerDown={stop}
          onClick={stop}
          onDoubleClick={stop}
        >
          {entries.map((entry) =>
            entry.kind === 'heading' ? (
              <div key={entry.id} role="presentation" className="px-4 pb-1 pt-2 font-mono text-xs text-ink-soft">
                {entry.label}
              </div>
            ) : (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                // Hors de l'ordre de tabulation : on circule aux flèches, Tab sort du menu.
                tabIndex={-1}
                onClick={() => { close(true); entry.onSelect() }}
                className={cn(
                  'block w-full px-4 py-2 text-left text-sm font-bold outline-none',
                  entry.danger
                    // Destructif sobre au repos, aplat rouge seulement sous le pointeur ou le focus.
                    ? 'text-danger hover:bg-danger hover:text-on-data focus:bg-danger focus:text-on-data'
                    : 'hover:bg-yellow hover:text-on-data focus:bg-yellow focus:text-on-data',
                )}
              >
                {entry.label}
              </button>
            ),
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/components/ui/Menu.test.tsx`
Attendu : PASS, sept tests.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Menu.tsx app/globals.css tests/unit/components/ui/Menu.test.tsx
git commit -m "feat(ui): menu ⋯ accessible" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Lot 2 — Ossature et navigation

## Task 3: Profil partagé et menu du compte

**Files:**
- Create: `components/layout/ProfileProvider.tsx`
- Create: `components/layout/UserMenu.tsx`
- Modify: `components/layout/ThemeToggle.tsx` (exporte `currentTheme` et `toggleTheme`)
- Modify: `components/layout/AppHeader.tsx`
- Modify: `app/(app)/layout.tsx`
- Test: `tests/unit/components/layout/UserMenu.test.tsx`
- Modify (e2e): `tests/e2e/auth.spec.ts`, `tests/e2e/theme-and-templates.spec.ts`, `tests/e2e/mobile.spec.ts`

**Interfaces:**
- Consomme : `Menu` (tâche 2), `Avatar`, `signOut` (`app/(app)/projects/actions.ts`, déplacé en tâche 4).
- Produit :

```ts
export interface Profile { displayName: string; email: string; color: string; avatarUrl: string | null }
export function ProfileProvider(props: { profile: Profile; children: React.ReactNode }): JSX.Element
export function useProfile(): Profile
export function UserMenu(): JSX.Element            // déclencheur « Menu du compte »
export function currentTheme(): Theme              // ThemeToggle.tsx
export function toggleTheme(): Theme               // applique, enregistre, rend le thème obtenu
export function AppHeader(): JSX.Element           // plus aucune prop : le profil vient du contexte
```

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/unit/components/layout/UserMenu.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserMenu } from '@/components/layout/UserMenu'
import { ProfileProvider } from '@/components/layout/ProfileProvider'

const mockSignOut = vi.fn()
vi.mock('@/app/(app)/projects/actions', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

function renderMenu() {
  return render(
    <ProfileProvider profile={{ displayName: 'Alice Test', email: 'alice@test.local', color: '#FFD500', avatarUrl: null }}>
      <UserMenu />
    </ProfileProvider>,
  )
}

describe('UserMenu', () => {
  beforeEach(() => {
    mockSignOut.mockReset()
    document.documentElement.dataset.theme = 'light'
    localStorage.clear()
  })

  it('l\'avatar ouvre un menu qui dit qui est connecté', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
    const menu = screen.getByRole('menu', { name: 'Menu du compte' })
    expect(menu).toHaveTextContent('Alice Test')
    expect(menu).toHaveTextContent('alice@test.local')
  })

  it('bascule le thème, l\'enregistre, et le libellé suit', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Passer au thème sombre' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('bradgantt.theme')).toBe('dark')
    await userEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
    expect(screen.getByRole('menuitem', { name: 'Passer au thème clair' })).toBeInTheDocument()
  })

  it('« Déconnexion » appelle l\'action serveur', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Menu du compte' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Déconnexion' }))
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/layout/UserMenu.test.tsx`
Attendu : ÉCHEC — `Failed to resolve import "@/components/layout/UserMenu"`.

- [ ] **Step 3: Implémenter**

Créer `components/layout/ProfileProvider.tsx` :

```tsx
'use client'
import { createContext, useContext, type ReactNode } from 'react'

export interface Profile {
  displayName: string
  email: string
  color: string
  avatarUrl: string | null
}

const ProfileContext = createContext<Profile | null>(null)

/**
 * Le profil est lu UNE fois, par `app/(app)/layout.tsx`, puis partagé par contexte. Les deux
 * groupes de routes ont chacun leur en-tête ; sans ce contexte, chacun relirait le profil.
 *
 * Composant CLIENT : un contexte React n'existe pas côté serveur. Les en-têtes, eux, restent
 * serveur — seul `UserMenu` (client) consomme le profil.
 */
export function ProfileProvider({ profile, children }: { profile: Profile; children: ReactNode }) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

export function useProfile(): Profile {
  const profile = useContext(ProfileContext)
  if (!profile) throw new Error('useProfile hors de ProfileProvider')
  return profile
}
```

Dans `components/layout/ThemeToggle.tsx`, remplacer la fonction `current()` et la fonction `toggle()` du composant, et retirer les capitales du bouton. Le fichier devient :

```tsx
'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'bradgantt.theme'

/**
 * Script exécuté AVANT le premier rendu, inséré tel quel par le layout racine : il pose
 * `data-theme` sur <html> d'après le choix enregistré, sinon d'après le réglage du système.
 * Sans lui, une page sombre s'afficherait claire le temps que React se monte — un éclair blanc
 * à chaque navigation complète.
 *
 * Tout est dans un `try` : `localStorage` lève en navigation privée sur certains navigateurs,
 * et un thème qui ne se charge pas vaut mieux qu'une page qui ne se charge pas.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
}

/**
 * Bascule, applique ET enregistre. Partagée par la bascule de la page de connexion et par le
 * menu du compte : deux portes, une seule règle d'enregistrement. Rend le thème obtenu pour que
 * l'appelant mette son libellé à jour.
 */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  try { localStorage.setItem(THEME_STORAGE_KEY, next) } catch {}
  return next
}

/**
 * Bascule clair / sombre de la page de connexion. Un choix explicite est enregistré ; tant
 * qu'il n'y en a pas, la page suit le système, y compris quand il change en cours de session.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // `null` tant que le composant n'est pas monté : le serveur ne connaît pas le thème, et
  // rendre « Clair » puis corriger à l'hydratation ferait clignoter le libellé.
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(currentTheme())
    const media = matchMedia('(prefers-color-scheme: dark)')
    const follow = () => {
      let stored: string | null = null
      try { stored = localStorage.getItem(THEME_STORAGE_KEY) } catch {}
      if (stored) return
      const next: Theme = media.matches ? 'dark' : 'light'
      applyTheme(next)
      setTheme(next)
    }
    media.addEventListener('change', follow)
    return () => media.removeEventListener('change', follow)
  }, [])

  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      aria-pressed={dark}
      aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'}
      title={dark ? 'Thème clair' : 'Thème sombre'}
      className={cn(
        'inline-flex h-8 items-center gap-2 border-[3px] border-current px-2 text-xs font-bold brutal-focus',
        className,
      )}
    >
      {/* Le glyphe seul suffit à reconnaître la commande ; le mot n'apparaît qu'une fois le
          thème connu, pour ne pas afficher un libellé faux le temps du montage. */}
      <span aria-hidden className="text-base leading-none">{dark ? '☾' : '☼'}</span>
      {theme && <span className="hidden sm:inline">{dark ? 'Sombre' : 'Clair'}</span>}
    </button>
  )
}
```

Créer `components/layout/UserMenu.tsx` :

```tsx
'use client'
import { useEffect, useState, useTransition } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Menu } from '@/components/ui/Menu'
import { signOut } from '@/app/(app)/projects/actions'
import { currentTheme, toggleTheme, type Theme } from './ThemeToggle'
import { useProfile } from './ProfileProvider'

/**
 * L'avatar de l'utilisateur, à droite des deux en-têtes. Nom, thème et déconnexion passent
 * derrière lui : à côté du fil d'Ariane et des onglets d'un projet, trois commandes de compte
 * en clair dans la bande noire faisaient jeu égal avec la navigation.
 */
export function UserMenu() {
  const profile = useProfile()
  const [theme, setTheme] = useState<Theme>('light')
  const [, start] = useTransition()

  // Le thème vit sur <html>, hors de React : on le relit au montage pour que le libellé dise ce
  // que fera le clic, pas ce que supposait le rendu serveur.
  useEffect(() => { setTheme(currentTheme()) }, [])

  return (
    <Menu
      label="Menu du compte"
      tone="header"
      trigger={<Avatar name={profile.displayName} color={profile.color} src={profile.avatarUrl} size="sm" />}
      entries={[
        {
          kind: 'heading',
          id: 'who',
          label: (
            <>
              <span className="block font-ui text-sm font-bold text-ink">{profile.displayName}</span>
              <span className="block">{profile.email}</span>
            </>
          ),
        },
        {
          id: 'theme',
          label: theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre',
          onSelect: () => setTheme(toggleTheme()),
        },
        { id: 'signout', label: 'Déconnexion', onSelect: () => start(async () => { await signOut() }) },
      ]}
    />
  )
}
```

Remplacer `components/layout/AppHeader.tsx` :

```tsx
import Link from 'next/link'
import { UserMenu } from './UserMenu'
import { Wordmark } from './Logo'

/**
 * En-tête HORS projet (la liste « Mes projets ») : la marque, qui ramène à la liste, et le menu
 * du compte. L'en-tête d'un projet est `ProjectHeader`.
 */
export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b-[3px] border-ink bg-header px-3 text-on-header sm:px-6">
      {/* Signe + nom, sans filet jaune : le jaune ne signifie que « actif ». */}
      <Link href="/projects" className="brutal-focus-header"><Wordmark /></Link>
      <UserMenu />
    </header>
  )
}
```

Remplacer `app/(app)/layout.tsx` :

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { AppHeader } from '@/components/layout/AppHeader'
import { ProfileProvider } from '@/components/layout/ProfileProvider'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('display_name, color, avatar_url').eq('id', user.id).single()

  return (
    <ProfileProvider
      profile={{
        displayName: profile?.display_name ?? user.email ?? '',
        email: user.email ?? '',
        color: profile?.color ?? '#FFD500',
        avatarUrl: profile?.avatar_url ?? null,
      }}
    >
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <div className="flex-1">{children}</div>
      </div>
    </ProfileProvider>
  )
}
```

(L'en-tête quitte ce layout à la tâche 4, quand les groupes de routes portent chacun le leur.)

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/components/layout/UserMenu.test.tsx`
Attendu : PASS, trois tests.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Adapter les parcours e2e qui cliquaient « Déconnexion » en clair**

Dans `tests/e2e/auth.spec.ts`, remplacer le second test :

```ts
test('connexion puis déconnexion', async ({ page }) => {
  await loginAs(page, 'alice')
  // Nom, thème et déconnexion sont derrière l'avatar : c'est là qu'on vérifie qui est connecté.
  await page.getByRole('button', { name: 'Menu du compte' }).click()
  await expect(page.getByRole('menu').getByText(USERS.alice.name)).toBeVisible()
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL(/\/login/)
})
```

Dans `tests/e2e/theme-and-templates.spec.ts`, remplacer le premier test :

```ts
test('le thème sombre se choisit, survit au rechargement et à la navigation', async ({ page }) => {
  await loginAs(page, 'alice')
  const html = page.locator('html')
  const account = page.getByRole('button', { name: 'Menu du compte' })

  // Sans choix enregistré, la page suit le système — le navigateur de test est en clair.
  await expect(html).toHaveAttribute('data-theme', 'light')

  await account.click()
  await page.getByRole('menuitem', { name: 'Passer au thème sombre' }).click()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await account.click()
  await expect(page.getByRole('menuitem', { name: 'Passer au thème clair' })).toBeVisible()
  await page.keyboard.press('Escape')

  // Le fond a réellement changé : ce n'est pas seulement un attribut.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).not.toBe('rgb(253, 246, 227)')

  // Rechargement complet : le script de démarrage relit le choix avant le premier rendu.
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'dark')

  // Une autre page, hors application : la bascule y est aussi et le choix tient.
  await account.click()
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click()
  await page.waitForURL('**/login')
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Passer au thème clair' }).click()
  await expect(html).toHaveAttribute('data-theme', 'light')
})
```

Dans `tests/e2e/mobile.spec.ts`, premier test, remplacer :

```ts
  await expect(page.getByRole('button', { name: 'Déconnexion' })).toBeInViewport()
```

par :

```ts
  await expect(page.getByRole('button', { name: 'Menu du compte' })).toBeInViewport()
```

- [ ] **Step 6: Lancer les parcours touchés**

Le serveur de dev doit tourner (`npm run dev` en tâche de fond, port 3100).

Run: `npx playwright test tests/e2e/auth.spec.ts tests/e2e/theme-and-templates.spec.ts tests/e2e/mobile.spec.ts`
Attendu : PASS.

- [ ] **Step 7: Commit**

```bash
git add components/layout/ProfileProvider.tsx components/layout/UserMenu.tsx components/layout/ThemeToggle.tsx components/layout/AppHeader.tsx "app/(app)/layout.tsx" tests/unit/components/layout/UserMenu.test.tsx tests/e2e/auth.spec.ts tests/e2e/theme-and-templates.spec.ts tests/e2e/mobile.spec.ts
git commit -m "feat(layout): menu du compte et profil partagé" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Groupes de routes, en-tête de projet et onglets

**Files:**
- Move (`git mv`) : les cinq fichiers de route listés dans la carte des fichiers.
- Create: `app/(app)/(accueil)/layout.tsx`
- Create: `app/(app)/(projet)/projects/[id]/layout.tsx`
- Create: `components/layout/ProjectHeader.tsx`
- Create: `components/layout/ProjectTabs.tsx`
- Create: `lib/projects/members.ts`
- Modify: `app/(app)/layout.tsx` (l'en-tête en sort)
- Modify: `app/(app)/(accueil)/projects/actions.ts` (revalidation du layout de projet)
- Modify: `app/(app)/(projet)/projects/[id]/tickets/page.tsx` (appel de `TicketsDisabled`)
- Modify: `components/gantt/GanttToolbar.tsx`, `components/tickets/TicketsToolbar.tsx` (ni titre ni lien retour)
- Modify: `components/gantt/GanttPage.tsx`, `components/tickets/TicketsPage.tsx` (hauteur)
- Modify: `components/tickets/TicketsDisabled.tsx`
- Modify (imports) : `components/layout/UserMenu.tsx`, `components/project/*.tsx`, `components/tickets/TicketsDisabled.tsx`, `tests/unit/**`
- Test: `tests/unit/components/layout/ProjectTabs.test.tsx`, `tests/unit/lib/projects/members.test.ts`, `tests/unit/app/projects/actions.test.ts`
- Modify (e2e): `tests/e2e/projects.spec.ts`, `tests/e2e/authorization.spec.ts`, `tests/e2e/tickets.spec.ts`

**Interfaces:**
- Consomme : `UserMenu` (tâche 3), `Mark` (`components/layout/Logo.tsx`), `Avatar`, `requireUser`.
- Produit :

```ts
// lib/projects/members.ts
export interface MembershipRow {
  user_id: string
  role: Role
  profiles: { display_name: string; email: string; avatar_url: string | null; color: string } | null
}
export function rowsToMembers(rows: MembershipRow[]): Member[]
export function roleOf(rows: MembershipRow[], userId: string): Role | null

// components/layout/ProjectTabs.tsx
export type ProjectTab = 'gantt' | 'tickets' | 'membres'
export function currentTab(pathname: string, projectId: string): ProjectTab | null
export function ProjectTabs(props: { projectId: string; ticketsEnabled: boolean; isOwner: boolean; className?: string }): JSX.Element

// components/layout/ProjectHeader.tsx (serveur)
export interface ProjectHeaderProps { projectId: string; projectName: string; ticketsEnabled: boolean; myRole: Role; members: Member[] }
export function ProjectHeader(props: ProjectHeaderProps): JSX.Element

// components/tickets/TicketsDisabled.tsx
export function TicketsDisabled(props: { projectId: string }): JSX.Element
```

Nouveaux chemins d'import des actions : `@/app/(app)/(accueil)/projects/actions` et `@/app/(app)/(projet)/projects/[id]/members-actions`. L'onglet « Membres » pointe vers `/projects/[id]/membres`, page créée à la tâche 5.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/unit/components/layout/ProjectTabs.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { ProjectTabs } from '@/components/layout/ProjectTabs'

let mockPathname = '/projects/p1'
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname }))

describe('ProjectTabs', () => {
  it('Gantt est courant à la racine du projet, et seulement là', () => {
    mockPathname = '/projects/p1'
    render(<ProjectTabs projectId="p1" ticketsEnabled isOwner={false} />)
    expect(screen.getByRole('link', { name: 'Gantt' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Gantt' })).toHaveAttribute('href', '/projects/p1')
    expect(screen.getByRole('link', { name: 'Membres' })).not.toHaveAttribute('aria-current')
  })

  it('Tickets reste courant sur la vue liste', () => {
    mockPathname = '/projects/p1/tickets'
    render(<ProjectTabs projectId="p1" ticketsEnabled isOwner={false} />)
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Gantt' })).not.toHaveAttribute('aria-current')
  })

  it('Membres est courant sur sa page', () => {
    mockPathname = '/projects/p1/membres'
    render(<ProjectTabs projectId="p1" ticketsEnabled={false} isOwner={false} />)
    expect(screen.getByRole('link', { name: 'Membres' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Membres' })).toHaveAttribute('href', '/projects/p1/membres')
  })

  it('tickets désactivés : l\'onglet n\'existe que pour le propriétaire', () => {
    mockPathname = '/projects/p1'
    const { unmount } = render(<ProjectTabs projectId="p1" ticketsEnabled={false} isOwner={false} />)
    expect(screen.queryByRole('link', { name: 'Tickets' })).not.toBeInTheDocument()
    unmount()
    render(<ProjectTabs projectId="p1" ticketsEnabled={false} isOwner />)
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/projects/p1/tickets')
  })
})
```

Créer `tests/unit/lib/projects/members.test.ts` :

```ts
import { roleOf, rowsToMembers, type MembershipRow } from '@/lib/projects/members'

const rows: MembershipRow[] = [
  { user_id: 'u1', role: 'owner', profiles: { display_name: 'Alice', email: 'a@t.l', avatar_url: null, color: '#FFD500' } },
  // Profil masqué par la RLS : la ligne d'appartenance existe, le profil ne se lit pas.
  { user_id: 'u2', role: 'editor', profiles: null },
]

describe('rowsToMembers', () => {
  it('projette les profils lisibles et écarte les autres', () => {
    expect(rowsToMembers(rows)).toEqual([
      { userId: 'u1', role: 'owner', displayName: 'Alice', email: 'a@t.l', avatarUrl: null, color: '#FFD500' },
    ])
  })
})

describe('roleOf', () => {
  it('lit le rôle sur les lignes BRUTES, même quand le profil est masqué', () => {
    expect(roleOf(rows, 'u2')).toBe('editor')
  })
  it('rend null pour qui n\'est pas membre', () => {
    expect(roleOf(rows, 'u9')).toBeNull()
  })
})
```

Dans `tests/unit/app/projects/actions.test.ts`, dans le `describe('setTicketsEnabled')`, remplacer le premier test par :

```ts
  it('écrit la colonne et réinvalide la liste ET l\'en-tête de chaque page de projet', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    const res = await setTicketsEnabled('p1', true)
    expect(res.error).toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledWith({ tickets_enabled: true }, { count: 'exact' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects/[id]', 'layout')
  })
```

et ajouter à la fin du fichier :

```ts
describe('renameProject : réinvalidation', () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockRevalidatePath.mockClear()
  })

  // Le nom s'affiche dans l'en-tête de TOUTES les pages du projet : sans revalider leur layout,
  // l'en-tête garderait l'ancien nom jusqu'au prochain rechargement.
  it('réinvalide la liste et le layout de projet', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    await renameProject('p1', 'Nouveau nom')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects/[id]', 'layout')
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/layout/ProjectTabs.test.tsx tests/unit/lib/projects/members.test.ts tests/unit/app/projects/actions.test.ts`
Attendu : ÉCHEC — modules introuvables, et `revalidatePath('/projects/[id]', 'layout')` jamais appelé.

- [ ] **Step 3: Déplacer les routes avec `git mv` et suivre les imports**

```bash
mkdir -p "app/(app)/(accueil)/projects" "app/(app)/(projet)/projects/[id]/tickets"
git mv "app/(app)/projects/page.tsx" "app/(app)/(accueil)/projects/page.tsx"
git mv "app/(app)/projects/actions.ts" "app/(app)/(accueil)/projects/actions.ts"
git mv "app/(app)/projects/[id]/page.tsx" "app/(app)/(projet)/projects/[id]/page.tsx"
git mv "app/(app)/projects/[id]/members-actions.ts" "app/(app)/(projet)/projects/[id]/members-actions.ts"
git mv "app/(app)/projects/[id]/tickets/page.tsx" "app/(app)/(projet)/projects/[id]/tickets/page.tsx"
```

Puis réécrire les imports et les commentaires qui citent les anciens chemins :

```bash
grep -rlF 'app/(app)/projects/' components app lib tests | xargs sed -i \
  -e 's#app/(app)/projects/\[id\]/members-actions#app/(app)/(projet)/projects/[id]/members-actions#g' \
  -e 's#app/(app)/projects/\[id\]/page.tsx#app/(app)/(projet)/projects/[id]/page.tsx#g' \
  -e 's#app/(app)/projects/actions#app/(app)/(accueil)/projects/actions#g'
```

Vérifier qu'il ne reste rien :

Run: `grep -rnF 'app/(app)/projects/' components app lib tests`
Attendu : aucune ligne.

Le dossier `app/(app)/projects/` doit être vide ; le supprimer s'il reste des répertoires vides : `find "app/(app)/projects" -type d -empty -delete`.

- [ ] **Step 4: Implémenter**

Créer `lib/projects/members.ts` :

```ts
import type { Member, Role } from '@/lib/gantt/types'

/** Une ligne `memberships` telle que la lisent les pages de projet, profil embarqué. */
export interface MembershipRow {
  user_id: string
  role: Role
  profiles: { display_name: string; email: string; avatar_url: string | null; color: string } | null
}

/**
 * Projection d'AFFICHAGE. L'embed `profiles` est nullable (jointure non `!inner`) : une ligne
 * dont le profil est masqué est écartée plutôt que rendue sans nom.
 */
export function rowsToMembers(rows: MembershipRow[]): Member[] {
  return rows.flatMap((m) => m.profiles
    ? [{
        userId: m.user_id,
        role: m.role,
        displayName: m.profiles.display_name,
        email: m.profiles.email,
        avatarUrl: m.profiles.avatar_url,
        color: m.profiles.color,
      }]
    : [])
}

/**
 * Le rôle se lit sur les lignes BRUTES, jamais sur `rowsToMembers` : un profil masqué priverait
 * sinon l'utilisateur de ses droits. Une décision d'autorisation ne s'adosse pas à une jointure
 * d'affichage.
 */
export function roleOf(rows: MembershipRow[], userId: string): Role | null {
  return rows.find((m) => m.user_id === userId)?.role ?? null
}
```

Créer `components/layout/ProjectTabs.tsx` :

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export type ProjectTab = 'gantt' | 'tickets' | 'membres'

/** Onglet désigné par une URL. Le Gantt est la RACINE du projet : un préfixe l'allumerait partout. */
export function currentTab(pathname: string, projectId: string): ProjectTab | null {
  const base = `/projects/${projectId}`
  if (pathname === base) return 'gantt'
  if (pathname.startsWith(`${base}/tickets`)) return 'tickets'
  if (pathname.startsWith(`${base}/membres`)) return 'membres'
  return null
}

/**
 * Les trois sections d'un projet. Composant client pour la seule raison de `usePathname` :
 * l'en-tête qui l'accueille reste rendu côté serveur.
 *
 * L'onglet Tickets n'existe, tickets désactivés, que pour le PROPRIÉTAIRE : la page renvoie une
 * 404 à tout autre membre, et offrir une porte qui se referme serait pire que ne rien offrir.
 */
export function ProjectTabs({ projectId, ticketsEnabled, isOwner, className }: {
  projectId: string
  ticketsEnabled: boolean
  isOwner: boolean
  className?: string
}) {
  const current = currentTab(usePathname(), projectId)
  const base = `/projects/${projectId}`
  const tabs: { id: ProjectTab; label: string; href: string }[] = [
    { id: 'gantt', label: 'Gantt', href: base },
    ...(ticketsEnabled || isOwner ? [{ id: 'tickets' as const, label: 'Tickets', href: `${base}/tickets` }] : []),
    { id: 'membres', label: 'Membres', href: `${base}/membres` },
  ]

  return (
    // `overflow-x-auto` : sur un téléphone, la rangée des onglets défile plutôt que d'élargir la page.
    <nav aria-label="Sections du projet" className={cn('flex h-10 items-stretch gap-5 overflow-x-auto sm:h-14', className)}>
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          aria-current={current === t.id ? 'page' : undefined}
          className={cn(
            // Souligné de 3 px, jaune pour le courant : le jaune ne signifie que « actif ».
            'flex shrink-0 items-center border-b-[3px] text-sm font-bold brutal-focus-header',
            current === t.id ? 'border-yellow text-on-header' : 'border-transparent text-on-header/70 hover:text-on-header',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
```

Créer `components/layout/ProjectHeader.tsx` :

```tsx
import Link from 'next/link'
import type { Member, Role } from '@/lib/gantt/types'
import { Avatar } from '@/components/ui/Avatar'
import { Mark } from './Logo'
import { ProjectTabs } from './ProjectTabs'
import { UserMenu } from './UserMenu'

/** Au-delà, la pile empiète sur les onglets à 1024 px. */
const MAX_AVATARS = 4

export interface ProjectHeaderProps {
  projectId: string
  projectName: string
  ticketsEnabled: boolean
  myRole: Role
  members: Member[]
}

/**
 * En-tête noir d'un projet : où l'on est (fil d'Ariane), où l'on peut aller (onglets), avec qui
 * (pile d'avatars), et le compte. Composant SERVEUR : seuls les onglets et le menu du compte
 * ont besoin du client.
 *
 * Une seule rangée d'éléments en `flex-wrap` : sous `sm`, les onglets passent en `order-last
 * w-full` et forment la seconde rangée. Les rendre deux fois (une version par gabarit) aurait
 * doublé chaque lien dans le document.
 */
export function ProjectHeader({ projectId, projectName, ticketsEnabled, myRole, members }: ProjectHeaderProps) {
  const isOwner = myRole === 'owner'
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 border-b-[3px] border-ink bg-header px-3 text-on-header sm:h-14 sm:flex-nowrap sm:gap-x-6 sm:px-6">
      {/* Le signe seul ramène à la liste : sur téléphone, le fil d'Ariane se réduit au nom. */}
      <Link href="/projects" aria-label="Mes projets" className="flex h-12 shrink-0 items-center brutal-focus-header sm:h-auto">
        <Mark />
      </Link>
      <nav aria-label="Fil d'Ariane" className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm sm:flex-none">
        <Link href="/projects" className="hidden shrink-0 text-sm text-on-header/70 hover:text-on-header hover:underline brutal-focus-header sm:inline">
          Projets
        </Link>
        <span aria-hidden className="hidden text-on-header/50 sm:inline">/</span>
        {/* Le nom est LE titre de chaque page du projet : un `h1`, tronqué plutôt que replié. */}
        <h1 className="min-w-0 truncate text-base sm:text-lg" title={projectName}>{projectName}</h1>
      </nav>
      <ProjectTabs
        projectId={projectId}
        ticketsEnabled={ticketsEnabled}
        isOwner={isOwner}
        className="order-last w-full sm:order-none sm:w-auto"
      />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {/* Décorative : la liste des membres est l'onglet « Membres », un second lien vers elle
            ferait deux portes au même nom. */}
        <span aria-hidden className="hidden -space-x-2 sm:flex">
          {members.slice(0, MAX_AVATARS).map((m) => (
            <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />
          ))}
        </span>
        <UserMenu />
      </div>
    </header>
  )
}
```

Créer `app/(app)/(projet)/projects/[id]/layout.tsx` :

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { roleOf, rowsToMembers } from '@/lib/projects/members'
import { ProjectHeader } from '@/components/layout/ProjectHeader'
import { ProjectLoadError } from '@/components/gantt/ProjectLoadError'

/**
 * Layout de TOUTES les pages d'un projet. Il ne lit que ce que l'en-tête affiche — le projet et
 * ses membres, en UNE requête — et ne connaît ni les tâches ni les tickets : chaque page garde
 * ses propres lectures. Une requête de plus par navigation, acceptée par la spec, contre un
 * layout qui ne grossit pas avec chaque écran.
 */
export default async function ProjectLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  // La RLS ne montre le projet qu'à ses membres : un identifiant inconnu et un projet étranger
  // donnent tous deux zéro ligne, donc la même 404 — volontairement indistinguables.
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, tickets_enabled, memberships(user_id, role, profiles(display_name, email, avatar_url, color))')
    .eq('id', id)
    .maybeSingle()

  // Un échec technique n'est PAS une absence : le confondre avec une 404 ferait croire que le
  // projet a disparu. Cause au journal serveur, message générique à l'écran.
  if (error) {
    console.error(`[projects/${id}] lecture "projects" (layout) en échec :`, error.message)
    return <ProjectLoadError retryHref={`/projects/${id}`} />
  }
  if (!project) notFound()

  const myRole = roleOf(project.memberships, user.id)
  if (!myRole) notFound()

  return (
    // Hauteur de la fenêtre, en colonne : l'en-tête prend ce qu'il lui faut (une rangée au
    // bureau, deux sur téléphone) et la page le reste. Une hauteur calculée à la main
    // (`100dvh - 3.5rem`) se trompait dès que l'en-tête passait sur deux rangées.
    <div className="flex h-dvh flex-col">
      <ProjectHeader
        projectId={project.id}
        projectName={project.name}
        ticketsEnabled={project.tickets_enabled}
        myRole={myRole}
        members={rowsToMembers(project.memberships)}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
```

Si `npm run typecheck` refuse `project.memberships` comme `MembershipRow[]` (inférence de l'embed par `supabase-js`), le passer par `project.memberships as MembershipRow[]` en important le type : la forme est garantie par la chaîne `select`.

Créer `app/(app)/(accueil)/layout.tsx` :

```tsx
import { AppHeader } from '@/components/layout/AppHeader'

/** Hors projet : la marque et le compte, rien d'autre. */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <div className="flex-1">{children}</div>
    </>
  )
}
```

Dans `app/(app)/layout.tsx`, retirer l'en-tête — le `return` devient :

```tsx
  return (
    <ProfileProvider
      profile={{
        displayName: profile?.display_name ?? user.email ?? '',
        email: user.email ?? '',
        color: profile?.color ?? '#FFD500',
        avatarUrl: profile?.avatar_url ?? null,
      }}
    >
      {/* Pas d'en-tête ici : chaque groupe de routes porte le sien (liste, ou projet). */}
      <div className="min-h-screen flex flex-col">{children}</div>
    </ProfileProvider>
  )
```

et supprimer la ligne `import { AppHeader } from '@/components/layout/AppHeader'`.

Dans `app/(app)/(accueil)/projects/actions.ts`, ajouter sous `export interface ActionResult { … }` :

```ts
/**
 * Le nom du projet et l'onglet Tickets s'affichent dans l'EN-TÊTE de chaque page du projet.
 * Revalider `/projects` seul laissait l'en-tête sur l'ancien état jusqu'au prochain
 * rechargement ; le motif `[id]` en type `layout` couvre le Gantt, les tickets et les membres.
 */
function revalidateProject() {
  revalidatePath('/projects')
  revalidatePath('/projects/[id]', 'layout')
}
```

puis, dans `renameProject` ET dans `setTicketsEnabled`, remplacer `revalidatePath('/projects')` par `revalidateProject()`. (`createProject` et `deleteProject` gardent `revalidatePath('/projects')`.)

Remplacer `components/tickets/TicketsDisabled.tsx` :

```tsx
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
```

Dans `app/(app)/(projet)/projects/[id]/tickets/page.tsx`, remplacer :

```tsx
    return <TicketsDisabled projectId={project.id} projectName={project.name} />
```

par :

```tsx
    return <TicketsDisabled projectId={project.id} />
```

Remplacer `components/gantt/GanttToolbar.tsx` (étape intermédiaire : la tâche 5 en retire « Membres », la tâche 9 la réécrit) :

```tsx
'use client'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ZoomControls } from './ZoomControls'

export function GanttToolbar() {
  const members = useGanttStore((s) => s.members)
  const myRole = useGanttStore((s) => s.myRole)
  const canEdit = useGanttStore(selectCanEdit)
  const openEditor = useGanttStore((s) => s.openEditor)
  const setMembersDialogOpen = useGanttStore((s) => s.setMembersDialogOpen)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-ink bg-paper px-3 py-2 sm:gap-4 sm:px-6 sm:py-3 short:py-1">
      {/* Nom du projet, retour à la liste et lien Tickets sont montés dans l'en-tête : les
          répéter ici donnerait deux titres et deux liens identiques sur le même écran. */}
      {canEdit ? <Badge color={myRole === 'owner' ? 'violet' : 'blue'}>{myRole}</Badge> : <Badge color="cyan">Lecture seule</Badge>}
      <button type="button" onClick={() => setMembersDialogOpen(true)} aria-label="Membres" className="flex items-center gap-2 brutal-focus">
        <span className="flex -space-x-2">
          {members.map((m) => <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />)}
        </span>
        <span className="font-bold text-sm underline">Membres</span>
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <ZoomControls />
        {canEdit && (
          <>
            <Button size="sm" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'task' })}>+ Tâche</Button>
            <Button size="sm" variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'milestone' })}>+ Jalon</Button>
            <Button size="sm" variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'group' })}>+ Groupe</Button>
          </>
        )}
      </div>
    </div>
  )
}
```

Dans `components/tickets/TicketsToolbar.tsx`, supprimer ces deux lignes (le reste ne bouge pas avant la tâche 12) :

```tsx
      <Link href={`/projects/${projectId}`} className="font-mono text-sm underline brutal-focus">← Frise</Link>
      <h1 className="max-w-md truncate text-xl sm:text-2xl">{projectName}</h1>
```

ainsi que la ligne `const projectName = useTicketsStore((s) => s.projectName)`, devenue inutile.

Dans `components/gantt/GanttPage.tsx` ET `components/tickets/TicketsPage.tsx`, remplacer :

```tsx
    <div className="flex flex-col h-[calc(100dvh-3.5rem)]">
```

par :

```tsx
    // La hauteur vient du layout de projet (colonne pleine fenêtre sous l'en-tête) : une
    // soustraction en dur se trompait dès que l'en-tête passait sur deux rangées.
    <div className="flex min-h-0 flex-1 flex-col">
```

- [ ] **Step 5: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/layout tests/unit/lib/projects tests/unit/app/projects/actions.test.ts`
Attendu : PASS.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert (voir la contrainte globale sur `.next/types` si `typecheck` cite les anciens chemins).

- [ ] **Step 6: Adapter les parcours e2e**

Dans `tests/e2e/projects.spec.ts` et `tests/e2e/authorization.spec.ts`, remplacer chaque :

```ts
  await page.getByRole('link', { name: '← Projets' }).click()
```

(et la variante `alicePage.getByRole('link', { name: '← Projets' })`) par :

```ts
  await page.getByRole('link', { name: 'Projets', exact: true }).click()
```

(`alicePage.getByRole('link', { name: 'Projets', exact: true })` dans `authorization.spec.ts`). `exact` : le signe porte le nom « Mes projets ».

Dans `tests/e2e/tickets.spec.ts`, remplacer :

```ts
  await page.getByRole('link', { name: '← Frise' }).click()
```

par :

```ts
  await page.getByRole('link', { name: 'Gantt', exact: true }).click()
```

Ajouter à la fin de `tests/e2e/authorization.spec.ts` :

```ts
test('l\'onglet Tickets d\'un projet sans backlog n\'existe que pour son propriétaire', async ({ page }) => {
  const demo = '/projects/c0000000-0000-0000-0000-000000000001'
  const tabs = page.getByRole('navigation', { name: 'Sections du projet' })

  // Bob est éditeur du projet démo, qui n'a pas de tickets : la page lui répondrait 404.
  await loginAs(page, 'bob')
  await page.goto(demo)
  await expect(tabs.getByRole('link', { name: 'Gantt' })).toHaveAttribute('aria-current', 'page')
  await expect(tabs.getByRole('link', { name: 'Membres' })).toBeVisible()
  await expect(tabs.getByRole('link', { name: 'Tickets' })).toHaveCount(0)

  // Alice, propriétaire, voit l'onglet : il mène à la carte d'activation.
  await loginAs(page, 'alice')
  await page.goto(demo)
  await expect(tabs.getByRole('link', { name: 'Tickets' })).toBeVisible()
})
```

- [ ] **Step 7: Lancer les parcours touchés**

Run: `npx playwright test tests/e2e/projects.spec.ts tests/e2e/authorization.spec.ts tests/e2e/tickets.spec.ts tests/e2e/gantt-view.spec.ts`
Attendu : PASS, sauf l'échec environnemental connu « chaque carte porte sa vignette » et « la vue s'ouvre recentrée sur aujourd'hui ». `gantt-view` vérifie l'isolation inter-projets : le layout ne lit que `projects` et `memberships`, aucune donnée du projet voisin ne doit apparaître dans le HTML.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)/layout.tsx" "app/(app)/(accueil)/layout.tsx" "app/(app)/(accueil)/projects/page.tsx" "app/(app)/(accueil)/projects/actions.ts" "app/(app)/(projet)/projects/[id]/layout.tsx" "app/(app)/(projet)/projects/[id]/page.tsx" "app/(app)/(projet)/projects/[id]/members-actions.ts" "app/(app)/(projet)/projects/[id]/tickets/page.tsx"
git add components/layout/ProjectHeader.tsx components/layout/ProjectTabs.tsx components/layout/UserMenu.tsx lib/projects/members.ts components/gantt/GanttToolbar.tsx components/gantt/GanttPage.tsx components/tickets/TicketsToolbar.tsx components/tickets/TicketsPage.tsx components/tickets/TicketsDisabled.tsx
git add components/project/MembersDialog.tsx components/project/MemberRow.tsx components/project/NewProjectDialog.tsx components/project/RenameProjectDialog.tsx components/project/ProjectCard.tsx
git add tests/unit/components/layout/ProjectTabs.test.tsx tests/unit/components/layout/UserMenu.test.tsx tests/unit/lib/projects/members.test.ts tests/unit/app/projects/actions.test.ts tests/unit/components/project/NewProjectDialog.test.tsx tests/unit/components/project/RenameProjectDialog.test.tsx
git add tests/e2e/projects.spec.ts tests/e2e/authorization.spec.ts tests/e2e/tickets.spec.ts tests/e2e/gantt-view.spec.ts
git status --short
git commit -m "feat(layout): groupes de routes, en-tête de projet et onglets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Les `git mv` ont déjà indexé les renommages ; les `git add` ci-dessus y ajoutent les contenus modifiés (imports réécrits par `sed`, `TicketsDisabled`, revalidation). Relire `git status --short` avant le commit : la liste doit être vide de fichiers non indexés appartenant à cette tâche, et ne rien contenir d'étranger à elle.

---

## Task 5: La page Membres

**Files:**
- Create: `app/(app)/(projet)/projects/[id]/membres/page.tsx`
- Create: `components/members/MembersPage.tsx`
- Delete: `components/project/MembersDialog.tsx` (`git rm`)
- Modify: `components/project/MemberRow.tsx`
- Modify: `app/(app)/(projet)/projects/[id]/members-actions.ts`
- Modify: `components/gantt/GanttToolbar.tsx`, `components/gantt/GanttPage.tsx`
- Modify: `lib/gantt/store.ts`
- Modify: `app/(app)/(projet)/projects/[id]/page.tsx` (plus d'invitations)
- Test: `tests/unit/components/members/MembersPage.test.tsx`, `tests/unit/app/projects/members-actions.test.ts`, `tests/unit/lib/gantt/store.test.ts`
- Modify (e2e): `tests/e2e/members.spec.ts`, `tests/e2e/invite.spec.ts`

**Interfaces:**
- Consomme : `rowsToMembers`, `roleOf` (tâche 4), `ROLE_LABELS`, `ROLE_BADGE` (tâche 1), `MemberRow`, `InviteForm`, `revokeInvitation`.
- Produit :

```ts
export interface MembersPageProps {
  projectId: string
  members: Member[]
  invitations: PendingInvitation[]
  isOwner: boolean
}
export function MembersPage(props: MembersPageProps): JSX.Element
```

Le store du Gantt perd `membersDialogOpen`, `setMembersDialogOpen` et `invitations` ; `HydratePayload` perd `invitations`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/unit/components/members/MembersPage.test.tsx` :

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MembersPage } from '@/components/members/MembersPage'
import type { Member } from '@/lib/gantt/types'

const mockRevoke = vi.fn()
vi.mock('@/app/(app)/(projet)/projects/[id]/members-actions', () => ({
  revokeInvitation: (...args: unknown[]) => mockRevoke(...args),
  changeMemberRole: vi.fn(),
  removeMember: vi.fn(),
}))
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh, push: vi.fn() }) }))

const members: Member[] = [
  { userId: 'u2', role: 'viewer', displayName: 'Zoé', email: 'z@t.l', avatarUrl: null, color: '#5B9DFF' },
  { userId: 'u1', role: 'owner', displayName: 'Alice', email: 'a@t.l', avatarUrl: null, color: '#FFD500' },
  { userId: 'u3', role: 'editor', displayName: 'Bob', email: 'b@t.l', avatarUrl: null, color: '#FF8A3D' },
]
const invitations = [{ id: 'i1', email: 'x@t.l', role: 'viewer' as const, createdAt: '2026-10-01' }]

describe('MembersPage', () => {
  beforeEach(() => { mockRevoke.mockReset(); mockRefresh.mockReset() })

  it('est une région « Membres », propriétaire en tête puis ordre alphabétique', () => {
    render(<MembersPage projectId="p1" members={members} invitations={[]} isOwner={false} />)
    const items = within(screen.getByRole('region', { name: 'Membres' })).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Alice'),
      expect.stringContaining('Bob'),
      expect.stringContaining('Zoé'),
    ])
  })

  it('un non-propriétaire lit les rôles en français, sans aucune commande', () => {
    render(<MembersPage projectId="p1" members={members} invitations={invitations} isOwner={false} />)
    expect(screen.getByText('Propriétaire')).toBeInTheDocument()
    expect(screen.getByText('Éditeur')).toBeInTheDocument()
    expect(screen.getByText('Lecteur')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Inviter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retirer' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('pending-list')).not.toBeInTheDocument()
  })

  it('pour le propriétaire, une ligne modifiable montre le sélecteur au lieu du badge', () => {
    render(<MembersPage projectId="p1" members={members} invitations={[]} isOwner />)
    const bob = screen.getAllByRole('listitem').find((li) => li.textContent?.includes('Bob'))!
    expect(within(bob).getByLabelText('Rôle de Bob')).toHaveValue('editor')
    expect(within(bob).queryByText('Éditeur', { selector: 'span' })).not.toBeInTheDocument()
  })

  it('le propriétaire voit les invitations en attente et peut en révoquer une', async () => {
    mockRevoke.mockResolvedValue({})
    render(<MembersPage projectId="p1" members={members} invitations={invitations} isOwner />)
    const pending = screen.getByTestId('pending-list')
    expect(within(pending).getByText('x@t.l')).toBeInTheDocument()
    expect(within(pending).getByText('Lecteur')).toBeInTheDocument()
    await userEvent.click(within(pending).getByRole('button', { name: 'Révoquer' }))
    expect(mockRevoke).toHaveBeenCalledWith('p1', 'i1')
    expect(screen.getByRole('button', { name: 'Inviter' })).toBeInTheDocument()
  })
})
```

Créer `tests/unit/app/projects/members-actions.test.ts` :

```ts
// Écritures sur une seule ligne : `count !== 1` et non `count === 0`. Un `count` null (en-tête
// content-range absente) passait sinon pour un succès alors que la RLS avait refusé.
const mockEq2 = vi.fn()
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }))
const mockUpdate = vi.fn(() => ({ eq: mockEq1 }))
const mockDelete = vi.fn(() => ({ eq: mockEq1 }))
const mockFrom = vi.fn(() => ({ update: mockUpdate, delete: mockDelete }))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({ from: mockFrom })) }))
const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args) }))

import { changeMemberRole, removeMember, revokeInvitation } from '@/app/(app)/(projet)/projects/[id]/members-actions'

describe('actions des membres', () => {
  beforeEach(() => { mockEq2.mockReset(); mockRevalidatePath.mockClear() })

  it.each([
    ['changeMemberRole', () => changeMemberRole('p1', 'u2', 'viewer')],
    ['removeMember', () => removeMember('p1', 'u2')],
    ['revokeInvitation', () => revokeInvitation('p1', 'i1')],
  ])('%s : count null est un échec', async (_name, call) => {
    mockEq2.mockResolvedValue({ error: null, count: null })
    expect((await call()).error).toBe('Modification non enregistrée')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('un succès revalide le layout du projet, où vit la pile d\'avatars', async () => {
    mockEq2.mockResolvedValue({ error: null, count: 1 })
    await removeMember('p1', 'u2')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects/p1', 'layout')
  })
})
```

Dans `tests/unit/lib/gantt/store.test.ts`, supprimer entièrement le test `it('hydrate charge les invitations en attente (vide par défaut)', …)` et ajouter à sa place :

```ts
  it('le store ne porte plus ni invitations ni fenêtre des membres : la page Membres les lit', () => {
    const s = useGanttStore.getState() as unknown as Record<string, unknown>
    expect(s.invitations).toBeUndefined()
    expect(s.membersDialogOpen).toBeUndefined()
  })
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/members tests/unit/app/projects/members-actions.test.ts tests/unit/lib/gantt/store.test.ts`
Attendu : ÉCHEC — `MembersPage` introuvable, `count: null` accepté, `invitations` encore dans le store.

- [ ] **Step 3: Implémenter**

Dans `app/(app)/(projet)/projects/[id]/members-actions.ts`, pour les trois actions : remplacer `if (error || count === 0) return { error: FAIL }` par `if (error || count !== 1) return { error: FAIL }`, et `revalidatePath(`/projects/${projectId}`)` par `revalidatePath(`/projects/${projectId}`, 'layout')`. Remplacer le commentaire de tête par :

```ts
/**
 * Ces trois actions ne vérifient pas les droits : elles écrivent avec le client de
 * l'utilisateur, donc sous RLS, où seul l'owner peut toucher aux memberships et aux
 * invitations. Chacune vise UNE ligne : `count !== 1` rend un refus visible — un `count` null
 * ou nul repartirait sinon en succès silencieux.
 *
 * Revalidation en type `layout` : la pile d'avatars de l'en-tête vit dans le layout du projet,
 * et doit suivre un ajout ou un retrait sans rechargement.
 */
```

Créer `components/members/MembersPage.tsx` :

```tsx
'use client'
import { useId, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast/store'
import { MemberRow } from '@/components/project/MemberRow'
import { InviteForm } from '@/components/project/InviteForm'
import { revokeInvitation } from '@/app/(app)/(projet)/projects/[id]/members-actions'
import { ROLE_BADGE, ROLE_LABELS } from '@/lib/projects/roles'
import type { Member } from '@/lib/gantt/types'
import type { PendingInvitation } from '@/lib/invitations/types'

export interface MembersPageProps {
  projectId: string
  members: Member[]
  invitations: PendingInvitation[]
  isOwner: boolean
}

/**
 * Contenu de l'onglet « Membres », repris de l'ancienne fenêtre. Une PAGE et non plus une
 * fenêtre : elle a son URL, se partage, et ne se superpose plus au Gantt qu'elle cachait.
 */
export function MembersPage({ projectId, members, invitations, isOwner }: MembersPageProps) {
  const router = useRouter()
  const titleId = useId()
  const [, start] = useTransition()

  function revoke(id: string) {
    start(async () => {
      const res = await revokeInvitation(projectId, id)
      if (res.error) toast.error(res.error)
      else router.refresh()
    })
  }

  // L'owner en tête, les autres par ordre alphabétique : la liste ne se réordonne pas sous les
  // yeux quand un rôle change.
  const sorted = [...members].sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.displayName.localeCompare(b.displayName)))

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <section aria-labelledby={titleId} className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
        <h2 id={titleId} className="text-3xl">Membres</h2>
        <div className="border-[3px] border-ink bg-paper px-4 shadow-brutal">
          <ul data-testid="members-list" className="divide-y-[3px] divide-ink/10">
            {sorted.map((m) => <MemberRow key={m.userId} member={m} projectId={projectId} isOwner={isOwner} />)}
          </ul>
        </div>
        {isOwner && invitations.length > 0 && (
          <section aria-label="Invitations en attente" className="space-y-2">
            <h3 className="text-lg">Invitations en attente</h3>
            <ul data-testid="pending-list" className="space-y-2">
              {invitations.map((i) => (
                <li key={i.id} className="flex items-center gap-3">
                  <span className="flex-1 truncate font-mono text-sm">{i.email}</span>
                  <Badge color={ROLE_BADGE[i.role]}>{ROLE_LABELS[i.role]}</Badge>
                  {/* Commande d'objet : niveau 3. « Inviter » reste le seul bouton noir de la page. */}
                  <Button size="sm" variant="quiet" onClick={() => revoke(i.id)}>Révoquer</Button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {isOwner && <InviteForm projectId={projectId} />}
      </section>
    </div>
  )
}
```

Remplacer `components/project/MemberRow.tsx` :

```tsx
'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { toast } from '@/lib/toast/store'
import { ROLE_BADGE, ROLE_LABELS } from '@/lib/projects/roles'
import type { Member } from '@/lib/gantt/types'
import type { InviteRole } from '@/lib/invitations/types'
import { changeMemberRole, removeMember } from '@/app/(app)/(projet)/projects/[id]/members-actions'

export function MemberRow({ member, projectId, isOwner }: { member: Member; projectId: string; isOwner: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  // La ligne `owner` est intouchable : pas de transfert de propriété dans cette version, et la
  // RLS refuserait de toute façon l'écriture.
  const editable = isOwner && member.role !== 'owner'

  function setRole(role: InviteRole) {
    start(async () => {
      const res = await changeMemberRole(projectId, member.userId, role)
      if (res.error) toast.error(res.error)
      else router.refresh()
    })
  }
  function remove() {
    if (!window.confirm(`Retirer ${member.displayName} du projet ?`)) return
    start(async () => {
      const res = await removeMember(projectId, member.userId)
      if (res.error) toast.error(res.error)
      else router.refresh()
    })
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <Avatar name={member.displayName} color={member.color} src={member.avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-bold truncate">{member.displayName}</p>
        <p className="font-mono text-xs truncate">{member.email}</p>
      </div>
      {editable ? (
        // Le sélecteur DIT le rôle : un badge à côté répétait la même information.
        <>
          <Select aria-label={`Rôle de ${member.displayName}`} value={member.role} disabled={pending} onChange={(e) => setRole(e.target.value as InviteRole)}
            options={[{ value: 'editor', label: ROLE_LABELS.editor }, { value: 'viewer', label: ROLE_LABELS.viewer }]} className="py-1 text-sm" />
          <Button size="sm" variant="danger-quiet" onClick={remove} disabled={pending}>Retirer</Button>
        </>
      ) : (
        <Badge color={ROLE_BADGE[member.role]}>{ROLE_LABELS[member.role]}</Badge>
      )}
    </li>
  )
}
```

Créer `app/(app)/(projet)/projects/[id]/membres/page.tsx` :

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { roleOf, rowsToMembers } from '@/lib/projects/members'
import type { InviteRole } from '@/lib/invitations/types'
import { MembersPage } from '@/components/members/MembersPage'
import { ProjectLoadError } from '@/components/gantt/ProjectLoadError'

export default async function ProjectMembersRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  const supabase = await createClient()

  // L'appartenance est déjà vérifiée par le layout (404 sinon). Les deux lectures portent
  // `.eq('project_id', id)` : la RLS ouvre tous les projets dont on est membre, pas celui-ci.
  const [membershipsRes, invitationsRes] = await Promise.all([
    supabase.from('memberships').select('user_id, role, profiles(display_name, email, avatar_url, color)').eq('project_id', id),
    // La RLS ne montre les invitations qu'à l'owner : pour tout autre membre, liste vide —
    // exactement l'affichage voulu.
    supabase.from('invitations').select('id, email, role, created_at').eq('project_id', id).is('accepted_at', null).order('created_at'),
  ])

  // Une liste de membres en erreur ne se présente jamais comme une liste vide : l'owner se
  // croirait seul et réinviterait tout le monde.
  if (membershipsRes.error) {
    console.error(`[projects/${id}/membres] lecture "memberships" en échec :`, membershipsRes.error.message)
    return <ProjectLoadError retryHref={`/projects/${id}/membres`} />
  }
  // Les invitations ne sont qu'un complément : leur échec n'empêche pas de voir l'équipe.
  if (invitationsRes.error) console.error(`[projects/${id}/membres] lecture "invitations" en échec :`, invitationsRes.error.message)

  const rows = membershipsRes.data ?? []
  return (
    <MembersPage
      projectId={id}
      members={rowsToMembers(rows)}
      invitations={(invitationsRes.data ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role as InviteRole, createdAt: i.created_at }))}
      isOwner={roleOf(rows, user.id) === 'owner'}
    />
  )
}
```

Supprimer la fenêtre :

```bash
git rm components/project/MembersDialog.tsx
```

Dans `components/gantt/GanttPage.tsx`, supprimer `import { MembersDialog } from '@/components/project/MembersDialog'` et la ligne `<MembersDialog />`.

Dans `components/gantt/GanttToolbar.tsx`, supprimer l'import d'`Avatar`, les sélecteurs `members` et `setMembersDialogOpen`, et tout le `<button … aria-label="Membres">…</button>`.

Dans `lib/gantt/store.ts` :
- supprimer `import type { PendingInvitation } from '@/lib/invitations/types'` ;
- dans `HydratePayload`, supprimer le champ `invitations?: PendingInvitation[]` et son commentaire ;
- dans `GanttState`, supprimer `invitations: PendingInvitation[]`, `membersDialogOpen: boolean` et `setMembersDialogOpen: (open: boolean) => void` ;
- dans l'état initial, supprimer `invitations: [],` et `membersDialogOpen: false,` ;
- dans `hydrate`, supprimer `invitations: p.invitations ?? [],` et le commentaire sur `membersDialogOpen` ;
- supprimer `setMembersDialogOpen: (membersDialogOpen) => set({ membersDialogOpen }),`.

Dans `app/(app)/(projet)/projects/[id]/page.tsx` :
- supprimer `import type { InviteRole } from '@/lib/invitations/types'` ;
- dans le `Promise.all`, supprimer la lecture `invitations` et son commentaire, et retirer `invitationsRes` de la déstructuration, qui devient `const [membershipsRes, tasksRes, depsRes, ticketsRes] = await Promise.all([` ;
- supprimer le commentaire « Les invitations ne sont PAS dans les échecs bloquants… » (les trois lignes qui le portent) ;
- dans la charge utile de `GanttPage`, supprimer la ligne `invitations: (invitationsRes.data ?? []).map(…),`.

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/members tests/unit/app/projects tests/unit/lib/gantt/store.test.ts`
Attendu : PASS.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert. `grep -rn "membersDialogOpen\|MembersDialog\|invitations" components/gantt lib/gantt` ne doit plus rien rendre hors de `lib/gantt/templates.ts` (une tâche de modèle s'appelle « Invitations »).

- [ ] **Step 5: Adapter les parcours e2e**

Remplacer `tests/e2e/members.spec.ts` :

```ts
import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

async function newProject(page: Page, name: string) {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  return page.url()
}

/** La page Membres, atteinte par son onglet : c'est le chemin que la spec décrit. */
async function openMembers(page: Page) {
  await page.getByRole('navigation', { name: 'Sections du projet' }).getByRole('link', { name: 'Membres' }).click()
  await page.waitForURL('**/membres')
  return page.getByRole('region', { name: 'Membres' })
}

/** Les membres uniquement : la section « invitations en attente » a sa propre liste. */
const memberItems = (page: Page) => page.getByRole('region', { name: 'Membres' }).getByTestId('members-list').getByRole('listitem')

test('owner : ajouter un membre existant, changer son rôle, le retirer', async ({ page, browser }) => {
  await loginAs(page, 'alice')
  const url = await newProject(page, `Membres ${Date.now()}`)

  const region = await openMembers(page)
  await expect(memberItems(page)).toHaveCount(1)

  await region.getByLabel('Email').fill('dave@test.local')
  await region.getByLabel('Rôle', { exact: true }).selectOption('viewer')
  await region.getByRole('button', { name: 'Inviter' }).click()
  await expect(memberItems(page)).toHaveCount(2)
  const dave = memberItems(page).filter({ hasText: 'Dave Test' })
  await expect(dave.getByLabel('Rôle de Dave Test')).toHaveValue('viewer')

  await region.getByLabel('Email').fill('dave@test.local')
  await region.getByRole('button', { name: 'Inviter' }).click()
  await expect(region.getByRole('alert')).toHaveText('Cette personne est déjà membre')

  await dave.getByLabel('Rôle de Dave Test').selectOption('editor')
  await expect(dave.getByLabel('Rôle de Dave Test')).toHaveValue('editor')

  // Le rôle n'est pas qu'un affichage : Dave doit réellement pouvoir écrire dans ce projet.
  const daveCtx = await browser.newContext()
  const davePage = await daveCtx.newPage()
  await loginAs(davePage, 'dave')
  await davePage.goto(url)
  await expect(davePage.getByRole('button', { name: '+ Tâche' })).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await dave.getByRole('button', { name: 'Retirer' }).click()
  await expect(memberItems(page)).toHaveCount(1)

  // Et le retrait lui reprend l'accès, pas seulement la ligne dans la liste.
  const res = await davePage.goto(url)
  expect(res?.status()).toBe(404)
  await daveCtx.close()
})

test('owner : inviter une adresse sans compte laisse une invitation en attente, révocable', async ({ page }) => {
  await loginAs(page, 'alice')
  await newProject(page, `Invits ${Date.now()}`)
  const region = await openMembers(page)

  const inconnu = `inconnu-${Date.now()}@test.local`
  await region.getByLabel('Email').fill(inconnu)
  await region.getByRole('button', { name: 'Inviter' }).click()

  // Personne n'a été ajouté : c'est une invitation, pas une membership.
  await expect(memberItems(page)).toHaveCount(1)
  const pending = region.getByTestId('pending-list').getByRole('listitem')
  await expect(pending).toHaveCount(1)
  await expect(pending.first()).toContainText(inconnu)
  await expect(region.getByTestId('invite-url')).toContainText('/invite/')

  // Une seconde invitation pour la même adresse est refusée.
  await region.getByLabel('Email').fill(inconnu)
  await region.getByRole('button', { name: 'Inviter' }).click()
  await expect(region.getByRole('alert')).toHaveText('Une invitation est déjà en attente pour cette adresse')

  await region.getByRole('button', { name: 'Révoquer' }).click()
  await expect(region.getByTestId('pending-list')).toHaveCount(0)
})

test('editor : voit les membres mais aucune commande', async ({ page }) => {
  await loginAs(page, 'bob')
  // Lecture seule du projet démo : on ne fait que regarder.
  await page.goto('/projects/c0000000-0000-0000-0000-000000000001/membres')
  const region = page.getByRole('region', { name: 'Membres' })
  await expect(memberItems(page)).toHaveCount(3)
  await expect(region.getByRole('button', { name: 'Inviter' })).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'Retirer' })).toHaveCount(0)
})
```

Dans `tests/e2e/invite.spec.ts`, remplacer la fonction `inviteUnknown` :

```ts
/** Invite une adresse SANS compte et récupère le lien, exposé seulement sous `E2E_ENABLED`. */
async function inviteUnknown(page: Page, email: string, role: 'editor' | 'viewer') {
  await page.getByRole('navigation', { name: 'Sections du projet' }).getByRole('link', { name: 'Membres' }).click()
  await page.waitForURL('**/membres')
  const region = page.getByRole('region', { name: 'Membres' })
  await region.getByLabel('Email').fill(email)
  await region.getByLabel('Rôle', { exact: true }).selectOption(role)
  await region.getByRole('button', { name: 'Inviter' }).click()
  const text = await region.getByTestId('invite-url').textContent()
  return text!.match(/https?:\/\/\S+/)![0]
}
```

puis remplacer :

```ts
  await page.getByRole('button', { name: 'Membres' }).click()
  await expect(page.getByRole('dialog').getByTestId('pending-list')).toContainText(frankEmail)
  await page.keyboard.press('Escape')
```

par :

```ts
  await expect(page.getByRole('region', { name: 'Membres' }).getByTestId('pending-list')).toContainText(frankEmail)
```

et, à la fin du test, remplacer :

```ts
  await page.reload()
  await page.getByRole('button', { name: 'Membres' }).click()
  const dialog = page.getByRole('dialog', { name: 'Membres' })
  await expect(dialog.getByTestId('pending-list')).not.toContainText(frankEmail)
  await expect(dialog.getByTestId('members-list')).toContainText(frankEmail)
```

par :

```ts
  await page.reload()
  const region = page.getByRole('region', { name: 'Membres' })
  await expect(region.getByTestId('pending-list')).not.toContainText(frankEmail)
  await expect(region.getByTestId('members-list')).toContainText(frankEmail)
```

(`page` est restée sur `/membres` depuis le second `inviteUnknown`.)

- [ ] **Step 6: Lancer les parcours touchés**

Run: `npx playwright test tests/e2e/members.spec.ts tests/e2e/invite.spec.ts tests/e2e/gantt-readonly.spec.ts`
Attendu : PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/(projet)/projects/[id]/membres/page.tsx" "app/(app)/(projet)/projects/[id]/members-actions.ts" "app/(app)/(projet)/projects/[id]/page.tsx" components/members/MembersPage.tsx components/project/MemberRow.tsx components/gantt/GanttToolbar.tsx components/gantt/GanttPage.tsx lib/gantt/store.ts tests/unit/components/members/MembersPage.test.tsx tests/unit/app/projects/members-actions.test.ts tests/unit/lib/gantt/store.test.ts tests/e2e/members.spec.ts tests/e2e/invite.spec.ts
git commit -m "feat(members): Membres devient une page du projet" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(`git rm` a déjà indexé la suppression de `MembersDialog.tsx`.)

---

## Task 6: Menu « ⋯ » d'un projet, dans l'en-tête

**Files:**
- Create: `components/project/ProjectMenu.tsx`
- Modify: `components/layout/ProjectHeader.tsx`
- Modify: `app/(app)/(accueil)/projects/actions.ts` (`deleteProject(id, leave)`)
- Test: `tests/unit/components/project/ProjectMenu.test.tsx`, `tests/unit/app/projects/actions.test.ts`
- Modify (e2e): `tests/e2e/projects.spec.ts`

**Interfaces:**
- Consomme : `Menu` (tâche 2), `RenameProjectDialog`, `renameProject`, `setTicketsEnabled`, `deleteProject`.
- Produit :

```ts
export async function deleteProject(projectId: string, leave?: boolean): Promise<ActionResult>
// leave = true : redirect('/projects') après une suppression réussie.

export interface ProjectMenuProps {
  projectId: string
  projectName: string
  ticketsEnabled: boolean
  /** Vrai dans l'en-tête : la page courante appartient au projet supprimé. */
  leaveOnDelete?: boolean
  tone?: 'default' | 'header'
  triggerClassName?: string
}
export function ProjectMenu(props: ProjectMenuProps): JSX.Element
```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/unit/components/project/ProjectMenu.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectMenu } from '@/components/project/ProjectMenu'
import { useToastStore } from '@/lib/toast/store'

const mockDelete = vi.fn()
const mockSetTickets = vi.fn()
vi.mock('@/app/(app)/(accueil)/projects/actions', () => ({
  deleteProject: (...args: unknown[]) => mockDelete(...args),
  setTicketsEnabled: (...args: unknown[]) => mockSetTickets(...args),
  renameProject: vi.fn(),
}))

async function open(props: Partial<React.ComponentProps<typeof ProjectMenu>> = {}) {
  render(<ProjectMenu projectId="p1" projectName="Alpha" ticketsEnabled={false} {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Actions du projet' }))
}

describe('ProjectMenu', () => {
  beforeEach(() => {
    mockDelete.mockReset()
    mockSetTickets.mockReset()
    useToastStore.setState({ toasts: [] })
  })

  it('propose d\'activer les tickets quand ils sont désactivés, de les désactiver sinon', async () => {
    await open({ ticketsEnabled: false })
    expect(screen.getByRole('menuitem', { name: 'Activer les tickets' })).toBeInTheDocument()
  })

  it('« Désactiver les tickets » écrit false ; un échec part en toast', async () => {
    mockSetTickets.mockResolvedValue({ error: 'Modification non enregistrée' })
    await open({ ticketsEnabled: true })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Désactiver les tickets' }))
    expect(mockSetTickets).toHaveBeenCalledWith('p1', false)
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Modification non enregistrée')
  })

  it('« Renommer » ouvre la fenêtre pré-remplie', async () => {
    await open()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
    expect(screen.getByRole('dialog', { name: 'Renommer le projet' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nom du projet')).toHaveValue('Alpha')
  })

  it('« Supprimer » demande confirmation ; un refus ne supprime rien', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await open()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(confirm).toHaveBeenCalledWith('Supprimer « Alpha » et toutes ses tâches ?')
    expect(mockDelete).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('depuis l\'en-tête, la suppression demande au serveur de quitter la page', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDelete.mockResolvedValue({})
    await open({ leaveOnDelete: true })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(mockDelete).toHaveBeenCalledWith('p1', true)
    confirm.mockRestore()
  })
})
```

Dans `tests/unit/app/projects/actions.test.ts`, ajouter sous le `vi.mock('next/cache', …)` :

```ts
const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({ redirect: (...args: unknown[]) => mockRedirect(...args) }))
```

et à la fin du fichier :

```ts
describe('deleteProject : quitter la page du projet supprimé', () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockRedirect.mockReset()
  })

  // Supprimé depuis son propre en-tête, le projet ne doit pas être re-rendu : son layout
  // répondrait 404 avant que le client ait eu le temps de naviguer.
  it('avec leave, redirige vers la liste après une suppression réussie', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    await deleteProject('p1', true)
    expect(mockRedirect).toHaveBeenCalledWith('/projects')
  })

  it('sans leave, ne redirige pas (la carte de la liste disparaît d\'elle-même)', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    await deleteProject('p1')
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('un échec ne redirige jamais', async () => {
    mockEq.mockResolvedValue({ error: null, count: 0 })
    expect((await deleteProject('p1', true)).error).toBe('Suppression impossible')
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/project/ProjectMenu.test.tsx tests/unit/app/projects/actions.test.ts`
Attendu : ÉCHEC — `ProjectMenu` introuvable, `redirect` jamais appelé.

- [ ] **Step 3: Implémenter**

Dans `app/(app)/(accueil)/projects/actions.ts`, remplacer `deleteProject` :

```ts
/**
 * `leave` : la suppression part de l'en-tête du projet lui-même. La redirection se fait CÔTÉ
 * SERVEUR, dans la réponse de l'action : rediriger depuis le client après coup laissait Next
 * re-rendre d'abord la page courante — celle d'un projet qui n'existe plus, donc une 404.
 */
export async function deleteProject(projectId: string, leave = false): Promise<ActionResult> {
  const supabase = await createClient()
  const { error, count } = await supabase.from('projects').delete({ count: 'exact' }).eq('id', projectId)
  if (error || count !== 1) return { error: 'Suppression impossible' }
  revalidatePath('/projects')
  if (leave) redirect('/projects')
  return {}
}
```

Créer `components/project/ProjectMenu.tsx` :

```tsx
'use client'
import { useState, useTransition } from 'react'
import { Menu, type MenuEntry } from '@/components/ui/Menu'
import { RenameProjectDialog } from './RenameProjectDialog'
import { deleteProject, setTicketsEnabled } from '@/app/(app)/(accueil)/projects/actions'
import { toast } from '@/lib/toast/store'

export interface ProjectMenuProps {
  projectId: string
  projectName: string
  ticketsEnabled: boolean
  /** Vrai dans l'en-tête : la page courante appartient au projet supprimé, il faut en sortir. */
  leaveOnDelete?: boolean
  tone?: 'default' | 'header'
  triggerClassName?: string
}

/**
 * Les commandes rares d'un projet, réservées au propriétaire : renommer, basculer les tickets,
 * supprimer. Le MÊME menu sur la carte et dans l'en-tête — deux listes finiraient par diverger.
 *
 * Le libellé de bascule dit l'action (« Activer » / « Désactiver ») : dans un menu, il n'y a pas
 * d'état enfoncé à lire comme sur l'ancien bouton « Tickets ».
 */
export function ProjectMenu({ projectId, projectName, ticketsEnabled, leaveOnDelete = false, tone, triggerClassName }: ProjectMenuProps) {
  const [renaming, setRenaming] = useState(false)
  const [, start] = useTransition()

  function toggleTickets() {
    start(async () => {
      const res = await setTicketsEnabled(projectId, !ticketsEnabled)
      if (res.error) toast.error(res.error)
    })
  }

  function remove() {
    if (!window.confirm(`Supprimer « ${projectName} » et toutes ses tâches ?`)) return
    start(async () => {
      // Avec `leaveOnDelete`, l'action redirige : la promesse ne revient pas avec un résultat.
      const res = await deleteProject(projectId, leaveOnDelete)
      if (res?.error) toast.error(res.error)
    })
  }

  const entries: MenuEntry[] = [
    { id: 'rename', label: 'Renommer', onSelect: () => setRenaming(true) },
    { id: 'tickets', label: ticketsEnabled ? 'Désactiver les tickets' : 'Activer les tickets', onSelect: toggleTickets },
    { id: 'delete', label: 'Supprimer', danger: true, onSelect: remove },
  ]

  return (
    <>
      <Menu label="Actions du projet" entries={entries} tone={tone} triggerClassName={triggerClassName} />
      {renaming && <RenameProjectDialog projectId={projectId} currentName={projectName} open onClose={() => setRenaming(false)} />}
    </>
  )
}
```

Dans `components/layout/ProjectHeader.tsx`, ajouter l'import :

```tsx
import { ProjectMenu } from '@/components/project/ProjectMenu'
```

et, dans le `<nav aria-label="Fil d'Ariane">`, juste après le `<h1>`, ajouter :

```tsx
        {isOwner && (
          // Même menu que la carte de projet : le propriétaire agit sur son projet sans revenir
          // à la liste. `leaveOnDelete` : supprimé d'ici, le projet emporte la page courante.
          <ProjectMenu
            projectId={projectId}
            projectName={projectName}
            ticketsEnabled={ticketsEnabled}
            leaveOnDelete
            tone="header"
            triggerClassName="shrink-0 text-on-header"
          />
        )}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/project tests/unit/app/projects/actions.test.ts`
Attendu : PASS.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Écrire le parcours e2e de l'en-tête**

Ajouter à la fin de `tests/e2e/projects.spec.ts` :

```ts
test('le menu du nom de projet, dans l\'en-tête : renommer, basculer les tickets, supprimer', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Entête ${Date.now()}`
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)

  const header = page.getByRole('banner')
  const actions = header.getByRole('button', { name: 'Actions du projet' })

  // Renommer depuis le Gantt : l'en-tête suit sans rechargement (revalidation du layout).
  await actions.click()
  await page.getByRole('menuitem', { name: 'Renommer' }).click()
  await page.getByLabel('Nom du projet').fill(`${name} v2`)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(header.getByRole('heading', { name: `${name} v2` })).toBeVisible()

  // Review Focus 4 : désactiver les tickets DEPUIS la page Tickets bascule la page d'elle-même.
  await header.getByRole('link', { name: 'Tickets', exact: true }).click()
  await page.waitForURL('**/tickets')
  await page.getByRole('button', { name: 'Activer les tickets' }).click()
  await expect(page.getByRole('region', { name: 'À faire' })).toBeVisible()
  await actions.click()
  await page.getByRole('menuitem', { name: 'Désactiver les tickets' }).click()
  await expect(page.getByRole('button', { name: 'Activer les tickets' })).toBeVisible()

  // Review Focus 3 : supprimer depuis l'en-tête ramène à la liste, sans passer par une 404.
  page.once('dialog', (d) => d.accept())
  await actions.click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await page.waitForURL(/\/projects$/)
  await expect(page.getByRole('heading', { name: 'Mes projets' })).toBeVisible()
  await expect(page.getByRole('article', { name: `${name} v2` })).toHaveCount(0)
})
```

- [ ] **Step 6: Lancer le parcours**

Run: `npx playwright test tests/e2e/projects.spec.ts tests/e2e/authorization.spec.ts`
Attendu : PASS, sauf l'échec environnemental connu « chaque carte porte sa vignette ». `authorization.spec` forge toujours `deleteProject` avec `[targetId]` seul : `leave` vaut `false`, le message « Suppression impossible » reste attendu.

- [ ] **Step 7: Commit**

```bash
git add components/project/ProjectMenu.tsx components/layout/ProjectHeader.tsx "app/(app)/(accueil)/projects/actions.ts" tests/unit/components/project/ProjectMenu.test.tsx tests/unit/app/projects/actions.test.ts tests/e2e/projects.spec.ts
git commit -m "feat(projects): menu ⋯ du projet dans l'en-tête" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Lot 3 — Mes projets

## Task 7: Ligne de synthèse et filtre « en retard »

**Files:**
- Create: `components/project/ProjectsSummaryLine.tsx`
- Create: `lib/projects/filter.ts`
- Modify: `app/(app)/(accueil)/projects/page.tsx`
- Delete: `components/project/ProjectsOverview.tsx` (`git rm`)
- Test: `tests/unit/components/project/ProjectsSummaryLine.test.tsx`, `tests/unit/lib/projects/filter.test.ts`
- Modify (e2e): `tests/e2e/projects.spec.ts`, `tests/e2e/mobile.spec.ts`

**Interfaces:**
- Consomme : `projectSummary` (`lib/gantt/summary.ts`), `ProjectListItem` (`components/project/ProjectCard.tsx`).
- Produit :

```ts
// lib/projects/filter.ts
export const LATE_FILTER = 'retard'
export function visibleProjects<T extends { summary: { lateCount: number } }>(projects: T[], filtre: string | undefined): T[]

// components/project/ProjectsSummaryLine.tsx
export interface SummaryFigures { projects: number; tasks: number; upcomingMilestones: number; late: number }
export function ProjectsSummaryLine(props: { figures: SummaryFigures; lateOnly: boolean }): JSX.Element
```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/unit/lib/projects/filter.test.ts` :

```ts
import { LATE_FILTER, visibleProjects } from '@/lib/projects/filter'

const late = { id: 'a', summary: { lateCount: 2 } }
const calm = { id: 'b', summary: { lateCount: 0 } }

describe('visibleProjects', () => {
  it('sans filtre, rend tout', () => {
    expect(visibleProjects([late, calm], undefined)).toEqual([late, calm])
  })
  it('« retard » ne garde que les projets avec au moins une tâche en retard', () => {
    expect(visibleProjects([late, calm], LATE_FILTER)).toEqual([late])
  })
  // Review Focus 5 : une URL bricolée ne doit pas vider la page.
  it('une valeur inconnue est ignorée', () => {
    expect(visibleProjects([late, calm], 'nimporte')).toEqual([late, calm])
  })
  it('« retard » sans projet en retard rend une liste vide (la page l\'explique)', () => {
    expect(visibleProjects([calm], LATE_FILTER)).toEqual([])
  })
})
```

Créer `tests/unit/components/project/ProjectsSummaryLine.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { ProjectsSummaryLine } from '@/components/project/ProjectsSummaryLine'

describe('ProjectsSummaryLine', () => {
  it('accorde chaque nombre : singulier à 0 et 1, pluriel au-delà', () => {
    render(<ProjectsSummaryLine figures={{ projects: 1, tasks: 0, upcomingMilestones: 1, late: 0 }} lateOnly={false} />)
    expect(screen.getByTestId('projects-summary')).toHaveTextContent('1 projet · 0 tâche · 1 jalon sous 14 jours · 0 en retard')
  })

  it('met les pluriels', () => {
    render(<ProjectsSummaryLine figures={{ projects: 12, tasks: 317, upcomingMilestones: 8, late: 2 }} lateOnly={false} />)
    expect(screen.getByTestId('projects-summary')).toHaveTextContent('12 projets · 317 tâches · 8 jalons sous 14 jours · 2 en retard')
  })

  it('à zéro retard, rien à cliquer', () => {
    render(<ProjectsSummaryLine figures={{ projects: 3, tasks: 4, upcomingMilestones: 0, late: 0 }} lateOnly={false} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('« N en retard » est un lien rouge vers le filtre', () => {
    render(<ProjectsSummaryLine figures={{ projects: 3, tasks: 4, upcomingMilestones: 0, late: 2 }} lateOnly={false} />)
    const link = screen.getByRole('link', { name: '2 en retard' })
    expect(link).toHaveAttribute('href', '/projects?filtre=retard')
    expect(link).toHaveClass('text-danger')
    expect(screen.queryByRole('link', { name: 'Tout afficher' })).not.toBeInTheDocument()
  })

  it('filtre actif : le lien est marqué courant et « Tout afficher » ramène à la liste entière', () => {
    render(<ProjectsSummaryLine figures={{ projects: 3, tasks: 4, upcomingMilestones: 0, late: 2 }} lateOnly />)
    expect(screen.getByRole('link', { name: '2 en retard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Tout afficher' })).toHaveAttribute('href', '/projects')
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/lib/projects/filter.test.ts tests/unit/components/project/ProjectsSummaryLine.test.tsx`
Attendu : ÉCHEC — modules introuvables.

- [ ] **Step 3: Implémenter**

Créer `lib/projects/filter.ts` :

```ts
/** Valeur de `?filtre=` qui restreint la liste aux projets en retard. */
export const LATE_FILTER = 'retard'

/**
 * Les projets à montrer pour un `?filtre=` donné. Une valeur inconnue est IGNORÉE plutôt que de
 * vider la page : une URL bricolée ou périmée ne doit pas faire croire que les projets ont disparu.
 */
export function visibleProjects<T extends { summary: { lateCount: number } }>(projects: T[], filtre: string | undefined): T[] {
  return filtre === LATE_FILTER ? projects.filter((p) => p.summary.lateCount > 0) : projects
}
```

Créer `components/project/ProjectsSummaryLine.tsx` :

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LATE_FILTER } from '@/lib/projects/filter'

export interface SummaryFigures {
  projects: number
  tasks: number
  /** Jalons dans les quatorze prochains jours, aujourd'hui compris. */
  upcomingMilestones: number
  late: number
}

/** Singulier jusqu'à 1 inclus : « 0 tâche », comme on le dit en français. */
function n(count: number, one: string, many: string) {
  return (
    <span>
      <span className="font-mono font-bold text-ink">{count}</span> {count > 1 ? many : one}
    </span>
  )
}

const dot = <span aria-hidden>·</span>

/**
 * Une LIGNE sous le titre, à la place des quatre tuiles. Les tuiles pesaient autant que les
 * cartes de projet qu'elles résumaient ; une phrase se lit d'un coup d'œil et laisse la place
 * aux projets. Seul le retard est une commande : c'est le seul chiffre qui appelle un geste.
 */
export function ProjectsSummaryLine({ figures, lateOnly }: { figures: SummaryFigures; lateOnly: boolean }) {
  return (
    // `flex-wrap` : sur un téléphone, la phrase passe à la ligne au lieu d'élargir la page.
    <p data-testid="projects-summary" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-ink-soft">
      {n(figures.projects, 'projet', 'projets')}
      {dot}
      {n(figures.tasks, 'tâche', 'tâches')}
      {dot}
      {n(figures.upcomingMilestones, 'jalon sous 14 jours', 'jalons sous 14 jours')}
      {dot}
      {figures.late > 0 ? (
        <Link
          href={`/projects?filtre=${LATE_FILTER}`}
          aria-current={lateOnly ? 'page' : undefined}
          className={cn(
            'font-bold text-danger underline-offset-4 hover:underline brutal-focus',
            // Jaune = actif : le filtre posé se voit comme un segment sélectionné.
            lateOnly && 'bg-yellow px-1 text-on-data',
          )}
        >
          <span className="font-mono">{figures.late}</span> en retard
        </Link>
      ) : (
        <span><span className="font-mono font-bold text-ink">0</span> en retard</span>
      )}
      {lateOnly && (
        <Link href="/projects" className="text-ink underline-offset-4 hover:underline brutal-focus">Tout afficher</Link>
      )}
    </p>
  )
}
```

Remplacer `app/(app)/(accueil)/projects/page.tsx` :

```tsx
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { addDays, parseDate, todayISO } from '@/lib/gantt/dates'
import { projectSummary } from '@/lib/gantt/summary'
import { LATE_FILTER, visibleProjects } from '@/lib/projects/filter'
import { ProjectCard, type ProjectListItem, type CardTask } from '@/components/project/ProjectCard'
import { NewProjectDialog } from '@/components/project/NewProjectDialog'
import { NoProjects } from '@/components/project/NoProjects'
import { ProjectsSummaryLine } from '@/components/project/ProjectsSummaryLine'
import type { Member } from '@/lib/gantt/types'

/** Horizon des « jalons à venir » de la synthèse, en jours, aujourd'hui compris. */
const MILESTONE_HORIZON_DAYS = 14

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre } = await searchParams
  const user = await requireUser()
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id, name, created_at, tickets_enabled, memberships!inner(role, user_id)')
    .eq('memberships.user_id', user.id)
    .order('created_at', { ascending: false })

  const rows = data ?? []

  // DEUX lectures groupées pour toute la page, jamais une par carte. Les tâches ne ramènent que
  // les colonnes dont la synthèse et la vignette ont besoin — le reste (assigné, rang, repli)
  // n'est lu qu'en ouvrant le projet.
  //
  // SANS filtre `in(project_id, …)` : la RLS restreint déjà les deux tables aux projets dont on
  // est membre, c'est-à-dire exactement ceux que la page liste. Le filtre était donc redondant,
  // et il cassait la page au-delà d'environ 170 projets — la bibliothèque encode chaque
  // identifiant entre guillemets, l'URL dépassait les 8 Ko acceptés par PostgREST et la lecture
  // revenait en « URI too long » : toutes les cartes se rendaient vides d'un coup.
  const [tasksRes, membersRes] = rows.length
    ? await Promise.all([
        supabase.from('tasks').select('project_id, type, title, start_date, end_date, progress, color'),
        supabase.from('memberships').select('project_id, user_id, role, profiles(display_name, email, avatar_url, color)'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]

  // Un échec de ces lectures d'appoint ne doit PAS priver l'utilisateur de sa liste de projets :
  // les cartes se rendent alors sans chiffres ni avatars, ce qui reste un écran utilisable.
  // Politique d'erreur du projet : la cause technique part au journal serveur, l'écran reste muet.
  if (tasksRes.error) console.error('[projects] lecture "tasks" en échec :', tasksRes.error.message)
  if (membersRes.error) console.error('[projects] lecture "memberships" en échec :', membersRes.error.message)
  const tasksByProject = new Map<string, CardTask[]>()
  for (const t of tasksRes.data ?? []) {
    const list = tasksByProject.get(t.project_id) ?? []
    list.push({ type: t.type, title: t.title, startDate: t.start_date, endDate: t.end_date, progress: t.progress, color: t.color })
    tasksByProject.set(t.project_id, list)
  }

  const membersByProject = new Map<string, Member[]>()
  for (const m of membersRes.data ?? []) {
    if (!m.profiles) continue
    const list = membersByProject.get(m.project_id) ?? []
    list.push({
      userId: m.user_id,
      role: m.role,
      displayName: m.profiles.display_name,
      email: m.profiles.email,
      avatarUrl: m.profiles.avatar_url,
      color: m.profiles.color,
    })
    membersByProject.set(m.project_id, list)
  }

  const today = todayISO()
  const projects: ProjectListItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.created_at,
    ticketsEnabled: p.tickets_enabled,
    role: p.memberships[0].role,
    tasks: tasksByProject.get(p.id) ?? [],
    summary: projectSummary(tasksByProject.get(p.id) ?? [], today),
    members: membersByProject.get(p.id) ?? [],
    today,
  }))

  // Les chiffres portent sur TOUS les projets, filtre ou non : « 2 en retard » doit rester vrai
  // une fois le filtre posé, sinon le lien se contredirait.
  const allTasks = projects.flatMap((p) => p.tasks)
  const horizon = addDays(today, MILESTONE_HORIZON_DAYS - 1)
  const figures = {
    projects: projects.length,
    tasks: allTasks.filter((t) => t.type === 'task').length,
    upcomingMilestones: allTasks.filter((t) => t.type === 'milestone' && t.startDate >= today && t.startDate <= horizon).length,
    late: projects.reduce((n, p) => n + p.summary.lateCount, 0),
  }
  const lateOnly = filtre === LATE_FILTER
  const shown = visibleProjects(projects, filtre)

  return (
    <main className="mx-auto max-w-7xl p-4 space-y-6 sm:p-8 sm:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          {/* La date du jour en surtitre : c'est un tableau de bord, il dit quand on le regarde. */}
          <p className="font-mono text-xs text-ink-soft">
            {format(parseDate(today), 'EEEE d MMMM yyyy', { locale: fr })}
          </p>
          <h1 className="text-4xl">Mes projets</h1>
          {/* Seulement avec au moins un projet : sur un compte neuf, une ligne de zéros ne dirait
              rien que la carte d'accueil ne dise mieux. */}
          {projects.length > 0 && <ProjectsSummaryLine figures={figures} lateOnly={lateOnly} />}
        </div>
        {/* Sur un compte vide, la carte d'accueil porte déjà « Nouveau projet » : deux boutons
            noirs pour un même geste, c'est ce que la règle des trois niveaux interdit. */}
        {projects.length > 0 && <NewProjectDialog />}
      </div>

      {projects.length === 0 ? (
        <NoProjects />
      ) : shown.length === 0 ? (
        // Le filtre ne garde rien : le dire, plutôt qu'une grille vide qui ferait croire que les
        // projets ont disparu. « Tout afficher » est juste au-dessus, dans la ligne de synthèse.
        <p className="text-sm text-ink-soft">Aucun projet en retard.</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => <li key={p.id}><ProjectCard project={p} /></li>)}
        </ul>
      )}
    </main>
  )
}
```

Supprimer les tuiles :

```bash
git rm components/project/ProjectsOverview.tsx
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/lib/projects tests/unit/components/project`
Attendu : PASS.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Adapter et écrire les parcours e2e**

Dans `tests/e2e/projects.spec.ts`, ajouter en tête de fichier, sous les imports :

```ts
function isoInDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function createProject(page: Page, name: string) {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
}
```

et changer la ligne d'import en `import { test, expect, type Page } from '@playwright/test'`.

Remplacer, dans le test « la liste ouvre sur un bandeau de chiffres… », le titre et le bloc du bandeau :

```ts
test('la liste ouvre sur une ligne de synthèse et chaque carte porte sa vignette', async ({ page }) => {
  await loginAs(page, 'alice')

  // La ligne n'a de sens qu'avec au moins un projet : le compte de test en a toujours (seed).
  const summary = page.getByTestId('projects-summary')
  await expect(summary).toBeVisible()
  await expect(summary).toContainText(/\d+ projets?/)
  await expect(summary).toContainText('en retard')
```

(la suite du test, sur la carte du projet démo, ne change pas).

Ajouter à la fin du fichier :

```ts
test('« N en retard » ne garde que les projets en retard, « Tout afficher » rend la liste', async ({ page }) => {
  await loginAs(page, 'alice')
  const stamp = Date.now()
  const calm = `Calme ${stamp}`
  const late = `Retard ${stamp}`

  // Un projet vide n'est jamais en retard ; l'autre reçoit une tâche finie il y a cinq jours.
  await createProject(page, calm)
  await createProject(page, late)
  await page.getByRole('button', { name: '+ Tâche' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await dialog.getByLabel('Titre').fill('En souffrance')
  await dialog.getByLabel('Début').fill(isoInDays(-10))
  await dialog.getByLabel('Fin').fill(isoInDays(-5))
  await dialog.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(page.locator('[data-row-task-id]', { hasText: 'En souffrance' })).toHaveCount(1)

  await page.goto('/projects')
  await page.getByTestId('projects-summary').getByRole('link', { name: /en retard$/ }).click()
  await page.waitForURL('**/projects?filtre=retard')
  await expect(page.getByRole('article', { name: late })).toBeVisible()
  await expect(page.getByRole('article', { name: calm })).toHaveCount(0)

  await page.getByRole('link', { name: 'Tout afficher' }).click()
  await page.waitForURL(/\/projects$/)
  await expect(page.getByRole('article', { name: calm })).toBeVisible()
})
```

Dans `tests/e2e/mobile.spec.ts`, premier test, remplacer :

```ts
  await expect(page.getByTestId('projects-overview')).toBeVisible()
```

par :

```ts
  await expect(page.getByTestId('projects-summary')).toBeVisible()
```

- [ ] **Step 6: Lancer les parcours touchés**

Run: `npx playwright test tests/e2e/projects.spec.ts tests/e2e/mobile.spec.ts`
Attendu : PASS, sauf l'échec environnemental connu « chaque carte porte sa vignette ».

- [ ] **Step 7: Commit**

```bash
git add components/project/ProjectsSummaryLine.tsx lib/projects/filter.ts "app/(app)/(accueil)/projects/page.tsx" tests/unit/components/project/ProjectsSummaryLine.test.tsx tests/unit/lib/projects/filter.test.ts tests/e2e/projects.spec.ts tests/e2e/mobile.spec.ts
git commit -m "feat(projects): ligne de synthèse et filtre des projets en retard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: La carte de projet entièrement cliquable

**Files:**
- Modify: `components/project/ProjectCard.tsx` (réécriture)
- Modify: `components/project/MiniGantt.tsx` (« Aucune tâche »)
- Modify: `app/(app)/(accueil)/projects/page.tsx` (compte de tickets)
- Test: `tests/unit/components/project/ProjectCard.test.tsx`
- Modify (e2e): `tests/e2e/projects.spec.ts`, `tests/e2e/authorization.spec.ts`, `tests/e2e/helpers.ts`

**Interfaces:**
- Consomme : `ProjectMenu` (tâche 6), `ROLE_LABELS` / `ROLE_BADGE` (tâche 1).
- Produit : `ProjectListItem` gagne `ticketCount: number | null` (`null` = lecture en échec, le lien s'affiche sans chiffre). Le lien « Tickets · N » a pour nom accessible `Tickets · N`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/unit/components/project/ProjectCard.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { ProjectCard, type ProjectListItem } from '@/components/project/ProjectCard'
import { projectSummary } from '@/lib/gantt/summary'

vi.mock('@/app/(app)/(accueil)/projects/actions', () => ({
  deleteProject: vi.fn(),
  setTicketsEnabled: vi.fn(),
  renameProject: vi.fn(),
}))

const TODAY = '2026-10-06'

function item(patch: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: 'p1',
    name: 'Alpha',
    role: 'owner',
    createdAt: '2026-09-01T00:00:00Z',
    ticketsEnabled: true,
    ticketCount: 3,
    tasks: [],
    summary: projectSummary([], TODAY),
    members: [],
    today: TODAY,
    ...patch,
  }
}

describe('ProjectCard', () => {
  it('le titre est le lien du Gantt, et son pseudo-élément couvre toute la carte', () => {
    render(<ProjectCard project={item()} />)
    const link = screen.getByRole('link', { name: 'Alpha' })
    expect(link).toHaveAttribute('href', '/projects/p1')
    expect(link).toHaveClass('after:absolute', 'after:inset-0')
  })

  it('dit le rôle en toutes lettres', () => {
    render(<ProjectCard project={item({ role: 'editor' })} />)
    expect(screen.getByText('Éditeur')).toBeInTheDocument()
  })

  it('le menu ⋯ n\'est offert qu\'au propriétaire, posé au-dessus du lien de la carte', () => {
    const { unmount } = render(<ProjectCard project={item()} />)
    const trigger = screen.getByRole('button', { name: 'Actions du projet' })
    expect(trigger.closest('.z-10')).not.toBeNull()
    unmount()
    render(<ProjectCard project={item({ role: 'viewer' })} />)
    expect(screen.queryByRole('button', { name: 'Actions du projet' })).not.toBeInTheDocument()
  })

  it('« Tickets · N » mène au kanban quand les tickets sont activés', () => {
    render(<ProjectCard project={item({ ticketCount: 3 })} />)
    expect(screen.getByRole('link', { name: 'Tickets · 3' })).toHaveAttribute('href', '/projects/p1/tickets')
  })

  it('pas de lien Tickets sur un projet qui ne les active pas', () => {
    render(<ProjectCard project={item({ ticketsEnabled: false })} />)
    expect(screen.queryByRole('link', { name: /Tickets/ })).not.toBeInTheDocument()
  })

  it('un compte illisible garde le lien, sans chiffre', () => {
    render(<ProjectCard project={item({ ticketCount: null })} />)
    expect(screen.getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('un projet vide dit « Aucune tâche » dans sa vignette', () => {
    render(<ProjectCard project={item()} />)
    expect(screen.getByText('Aucune tâche')).toBeInTheDocument()
    expect(screen.queryByText('Frise vide')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/project/ProjectCard.test.tsx`
Attendu : ÉCHEC — `ticketCount` inconnu du type, pas de menu, « owner » au lieu de « Propriétaire ».

- [ ] **Step 3: Implémenter**

Dans `components/project/MiniGantt.tsx`, `MiniGanttPlaceholder` : retirer `uppercase tracking-wide` de la classe et remplacer le texte `Frise vide` par `Aucune tâche`. La ligne de classe devient :

```tsx
      className="flex w-full items-center justify-center border-[3px] border-dashed border-ink/30 text-xs text-ink-soft"
```

Remplacer `components/project/ProjectCard.tsx` :

```tsx
import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { MiniGantt, MiniGanttPlaceholder } from './MiniGantt'
import { ProjectMenu } from './ProjectMenu'
import { ROLE_BADGE, ROLE_LABELS } from '@/lib/projects/roles'
import { parseDate } from '@/lib/gantt/dates'
import type { ProjectSummary, SummaryTask } from '@/lib/gantt/summary'
import type { MiniTask } from '@/lib/gantt/mini'
import type { Member } from '@/lib/gantt/types'

/** Ce que la carte sait d'une tâche : de quoi la résumer ET la dessiner en vignette. */
export type CardTask = SummaryTask & MiniTask

export interface ProjectListItem {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  createdAt: string
  ticketsEnabled: boolean
  /** `null` : la lecture des tickets a échoué ; le lien s'affiche, sans chiffre. */
  ticketCount: number | null
  tasks: CardTask[]
  summary: ProjectSummary
  members: Member[]
  today: string
}

/** Trois avatars au plus, puis un compteur : au-delà, la pile déborde de la carte. */
const MAX_AVATARS = 3

function short(iso: string) {
  return format(parseDate(iso), 'd MMM yyyy', { locale: fr })
}

/**
 * Carte d'un projet. TOUTE la carte ouvre le Gantt : le titre est le lien, et son pseudo-élément
 * `after:` la couvre entière — un seul arrêt de tabulation, un seul nom annoncé, et un clic
 * n'importe où mène au projet. Ce qui doit rester cliquable pour soi (le menu, le lien Tickets)
 * est posé AU-DESSUS, en `relative z-10`.
 */
export function ProjectCard({ project }: { project: ProjectListItem }) {
  const { summary, members, tasks, today } = project
  const base = `/projects/${project.id}`
  const empty = summary.taskCount === 0 && summary.milestoneCount === 0
  /**
   * Seuls les compteurs NON NULS sont énoncés : « 0 tâche · 1 jalon » se lisait comme un
   * défaut de calcul sur un projet qui ne contient qu'un jalon.
   */
  const counts = [
    summary.taskCount > 0 && `${summary.taskCount} tâche${summary.taskCount > 1 ? 's' : ''}`,
    summary.groupCount > 0 && `${summary.groupCount} groupe${summary.groupCount > 1 ? 's' : ''}`,
    summary.milestoneCount > 0 && `${summary.milestoneCount} jalon${summary.milestoneCount > 1 ? 's' : ''}`,
  ].filter((x): x is string => typeof x === 'string')

  return (
    <article
      aria-label={project.name}
      className={
        'group/card relative flex h-full cursor-pointer flex-col gap-3 bg-paper brutal p-4 outline-offset-2 transition-shadow ' +
        // Liseré jaune au survol et au focus du lien : le jaune dit « c'est ceci que tu vises ».
        'hover:shadow-brutal-lg hover:outline-[3px] hover:outline-yellow ' +
        'has-[[data-card-link]:focus-visible]:outline-[3px] has-[[data-card-link]:focus-visible]:outline-yellow'
      }
    >
      <div className="flex items-start justify-between gap-3">
        <Link
          href={base}
          data-card-link
          className="font-display text-xl uppercase leading-tight outline-none after:absolute after:inset-0 after:content-['']"
        >
          {project.name}
        </Link>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <Badge color={ROLE_BADGE[project.role]}>{ROLE_LABELS[project.role]}</Badge>
          {project.role === 'owner' && (
            <ProjectMenu
              projectId={project.id}
              projectName={project.name}
              ticketsEnabled={project.ticketsEnabled}
              // Révélé au survol de la carte, au focus, menu ouvert, et toujours au doigt.
              triggerClassName="opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 touch:opacity-100"
            />
          )}
        </div>
      </div>

      {/* La vignette d'abord : c'est l'image du projet, elle se reconnaît avant de se lire. */}
      {empty || !summary.range ? <MiniGanttPlaceholder /> : <MiniGantt tasks={tasks} range={summary.range} today={today} />}

      {empty ? (
        // Un projet vide ne se décrit pas par des zéros : la carte dit ce qu'il reste à faire.
        <p className="flex-1 text-xs text-ink-soft">Ouvre-le pour poser la première tâche.</p>
      ) : (
        <div className="flex-1 space-y-2">
          <p className="font-mono text-xs text-ink-soft">{counts.join(' · ')}</p>
          {summary.range && (
            <p className="font-mono text-xs text-ink-soft">{short(summary.range.start)} → {short(summary.range.end)}</p>
          )}
          {/* Pas de barre d'avancement sans tâche à faire avancer : sur un projet qui ne contient
              que des jalons, « 0 % » décrivait un retard imaginaire. */}
          {summary.taskCount > 0 && (
            <div className="flex items-center gap-2">
              <div
                role="progressbar"
                aria-valuenow={summary.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Avancement de ${project.name}`}
                className="relative h-3 flex-1 border-[3px] border-ink bg-paper"
              >
                <span className="absolute inset-y-0 left-0 hatch opacity-40" style={{ width: `${summary.progress}%` }} />
              </div>
              <span className="w-10 text-right font-mono text-xs font-bold">{summary.progress} %</span>
            </div>
          )}
          {summary.lateCount > 0 && (
            // Sobre au repos, comme toute alerte du projet : du texte rouge, jamais un aplat.
            <p className="text-sm font-bold text-danger"><span className="font-mono">{summary.lateCount}</span> en retard</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-ink pt-3">
        <span className="flex -space-x-2">
          {members.slice(0, MAX_AVATARS).map((m) => (
            <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />
          ))}
          {members.length > MAX_AVATARS && (
            <span className="ml-3 self-center font-mono text-xs text-ink-soft">+{members.length - MAX_AVATARS}</span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-3 text-sm">
          {summary.nextMilestone && (
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="size-2 shrink-0 rotate-45 bg-ink" />
              <span className="truncate font-bold">{summary.nextMilestone.title}</span>
              <span className="shrink-0 font-mono text-xs text-ink-soft">{short(summary.nextMilestone.date)}</span>
            </span>
          )}
          {project.ticketsEnabled && (
            // Niveau 3 : un lien discret, au-dessus du lien de la carte pour mener au kanban.
            <Link href={`${base}/tickets`} className="relative z-10 shrink-0 text-ink-soft underline-offset-4 hover:text-ink hover:underline brutal-focus">
              Tickets{project.ticketCount !== null && <> · <span className="font-mono">{project.ticketCount}</span></>}
            </Link>
          )}
        </span>
      </div>
    </article>
  )
}
```

Dans `app/(app)/(accueil)/projects/page.tsx`, ajouter la lecture des tickets au `Promise.all` — remplacer :

```tsx
  const [tasksRes, membersRes] = rows.length
    ? await Promise.all([
        supabase.from('tasks').select('project_id, type, title, start_date, end_date, progress, color'),
        supabase.from('memberships').select('project_id, user_id, role, profiles(display_name, email, avatar_url, color)'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
```

par :

```tsx
  // La troisième lecture ne ramène que `project_id` : de quoi compter les tickets de chaque
  // carte, groupés ici même. Comme les tâches au-dessus, elle est plafonnée par le `max_rows` de
  // PostgREST (1000 lignes) : au-delà, les comptes seraient sous-estimés.
  const [tasksRes, membersRes, ticketsRes] = rows.length
    ? await Promise.all([
        supabase.from('tasks').select('project_id, type, title, start_date, end_date, progress, color'),
        supabase.from('memberships').select('project_id, user_id, role, profiles(display_name, email, avatar_url, color)'),
        supabase.from('tickets').select('project_id'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
```

sous les deux `console.error` existants, ajouter :

```tsx
  if (ticketsRes.error) console.error('[projects] lecture "tickets" en échec :', ticketsRes.error.message)
  const ticketCounts = new Map<string, number>()
  for (const t of ticketsRes.data ?? []) ticketCounts.set(t.project_id, (ticketCounts.get(t.project_id) ?? 0) + 1)
```

et, dans `rows.map((p) => ({ … }))`, sous `ticketsEnabled: p.tickets_enabled,`, ajouter :

```tsx
    // Lecture en échec : `null`, le lien reste sans chiffre plutôt que d'afficher un faux « 0 ».
    ticketCount: ticketsRes.error ? null : (ticketCounts.get(p.id) ?? 0),
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/project`
Attendu : PASS.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Adapter les parcours e2e**

Dans `tests/e2e/helpers.ts`, remplacer la fin de `createProjectWithTickets` :

```ts
  await page.goto('/projects')
  const card = page.getByRole('article', { name })
  await card.getByRole('button', { name: 'Tickets' }).click()
  await expect(card.getByRole('button', { name: 'Tickets' })).toHaveAttribute('aria-pressed', 'true')
}
```

par :

```ts
  await page.goto('/projects')
  const card = page.getByRole('article', { name })
  // Le menu ⋯ se révèle au survol de la carte : on survole comme le ferait l'utilisateur.
  await card.hover()
  await card.getByRole('button', { name: 'Actions du projet' }).click()
  await page.getByRole('menuitem', { name: 'Activer les tickets' }).click()
  await expect(card.getByRole('link', { name: /^Tickets · \d+$/ })).toBeVisible()
}
```

Dans `tests/e2e/projects.spec.ts`, premier test, remplacer le bloc qui va de `await expect(card.getByText('owner')).toBeVisible()` jusqu'à la fin du test par :

```ts
  await expect(card.getByText('Propriétaire')).toBeVisible()

  await card.hover()
  await card.getByRole('button', { name: 'Actions du projet' }).click()
  await page.getByRole('menuitem', { name: 'Renommer' }).click()
  await page.getByLabel('Nom du projet').fill(`${name} v2`)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  const renamed = page.getByRole('article', { name: `${name} v2` })
  await expect(renamed).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await renamed.hover()
  await renamed.getByRole('button', { name: 'Actions du projet' }).click()
  await page.getByRole('menuitem', { name: 'Supprimer' }).click()
  await expect(renamed).toHaveCount(0)
})
```

Dans le test « la liste ouvre sur une ligne de synthèse… », remplacer :

```ts
  await expect(demo.getByText('Frise vide')).toHaveCount(0)
```

par :

```ts
  await expect(demo.getByText('Aucune tâche', { exact: true })).toHaveCount(0)
```

Ajouter à la fin de `tests/e2e/projects.spec.ts` :

```ts
test('toute la carte ouvre le Gantt, mais son menu ⋯ n\'y emmène pas', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Carte ${Date.now()}`
  await createProject(page, name)
  await page.goto('/projects')
  const card = page.getByRole('article', { name })

  // Le menu est posé au-dessus du lien de la carte : l'ouvrir ne navigue pas.
  await card.hover()
  await card.getByRole('button', { name: 'Actions du projet' }).click()
  await expect(page.getByRole('menu', { name: 'Actions du projet' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/projects$/)

  // Un clic au milieu de la carte, loin du titre, ouvre le projet.
  const box = (await card.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
})
```

Dans `tests/e2e/authorization.spec.ts`, remplacer le renommage d'alice :

```ts
      await targetCard.getByRole('button', { name: 'Renommer' }).click()
```

par :

```ts
      await targetCard.hover()
      await targetCard.getByRole('button', { name: 'Actions du projet' }).click()
      await alicePage.getByRole('menuitem', { name: 'Renommer' }).click()
```

et la suppression :

```ts
      await throwCard.getByRole('button', { name: 'Supprimer' }).click()
```

par :

```ts
      await throwCard.hover()
      await throwCard.getByRole('button', { name: 'Actions du projet' }).click()
      await alicePage.getByRole('menuitem', { name: 'Supprimer' }).click()
```

Mettre à jour le commentaire d'en-tête du même fichier : « les boutons "Renommer"/"Supprimer" de ProjectCard » devient « les entrées "Renommer"/"Supprimer" du menu ⋯ de ProjectCard », et « ils ne sont rendus que pour project.role === 'owner' » devient « le menu n'est rendu que pour project.role === 'owner' ».

- [ ] **Step 6: Lancer les parcours touchés**

Run: `npx playwright test tests/e2e/projects.spec.ts tests/e2e/authorization.spec.ts tests/e2e/tickets.spec.ts`
Attendu : PASS, sauf l'échec environnemental connu « chaque carte porte sa vignette ». `tickets.spec` passe par `createProjectWithTickets`, désormais branché sur le menu.

- [ ] **Step 7: Commit**

```bash
git add components/project/ProjectCard.tsx components/project/MiniGantt.tsx "app/(app)/(accueil)/projects/page.tsx" tests/unit/components/project/ProjectCard.test.tsx tests/e2e/helpers.ts tests/e2e/projects.spec.ts tests/e2e/authorization.spec.ts
git commit -m "feat(projects): carte entièrement cliquable, menu ⋯ et lien Tickets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Lot 4 — Gantt

## Task 9: Barre d'outils de vue et bouton « Aujourd'hui »

**Files:**
- Modify: `components/gantt/GanttToolbar.tsx` (réécriture)
- Modify: `components/gantt/ZoomControls.tsx`
- Modify: `lib/gantt/store.ts` (`scrollTarget`, `scrollToDate`)
- Modify: `components/gantt/GanttView.tsx` (recentrage à la demande)
- Test: `tests/unit/components/gantt/GanttToolbar.test.tsx` (nouveau), `tests/unit/components/gantt/GanttView.test.tsx`, `tests/unit/lib/gantt/store.test.ts`
- Modify (e2e): `tests/e2e/gantt-readonly.spec.ts`

**Interfaces:**
- Consomme : `Menu` (tâche 2), `initialScrollLeft`, `dateToX` (`lib/gantt/geometry.ts`).
- Produit (store du Gantt) :

```ts
scrollTarget: { date: string; seq: number } | null   // remis à null par hydrate
scrollToDate: (date: string) => void                 // seq strictement croissant à chaque appel
```

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/unit/components/gantt/GanttToolbar.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GanttToolbar } from '@/components/gantt/GanttToolbar'
import { useGanttStore } from '@/lib/gantt/store'

function hydrate(myRole: 'owner' | 'editor' | 'viewer') {
  act(() => {
    useGanttStore.getState().hydrate({
      projectId: 'p1', projectName: 'P', myRole, members: [], tasks: [], dependencies: [], today: '2026-10-06',
    })
  })
}

describe('GanttToolbar', () => {
  beforeEach(() => useGanttStore.setState({ zoom: 'day' }))

  it('un lecteur voit « Lecture seule » et aucun bouton de création', () => {
    hydrate('viewer')
    render(<GanttToolbar />)
    expect(screen.getByText('Lecture seule')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Tâche' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument()
  })

  it('un éditeur : « + Tâche » est le seul principal, « + Jalon » et « + Groupe » secondaires', () => {
    hydrate('editor')
    render(<GanttToolbar />)
    expect(screen.getByRole('button', { name: '+ Tâche' })).toHaveClass('bg-ink')
    expect(screen.getByRole('button', { name: '+ Jalon' })).toHaveClass('bg-paper')
    expect(screen.getByRole('button', { name: '+ Groupe' })).toHaveClass('bg-paper')
    // Le rôle d'un éditeur n'est plus affiché : seul l'état « lecture seule » mérite d'être dit.
    expect(screen.queryByText('Lecture seule')).not.toBeInTheDocument()
  })

  it('« + Tâche » ouvre l\'éditeur en création', async () => {
    hydrate('editor')
    render(<GanttToolbar />)
    await userEvent.click(screen.getByRole('button', { name: '+ Tâche' }))
    expect(useGanttStore.getState().editor).toEqual({ mode: 'create', parentId: null, type: 'task' })
  })

  it('« Aujourd\'hui » demande un recentrage sur le jour courant', async () => {
    hydrate('viewer')
    render(<GanttToolbar />)
    await userEvent.click(screen.getByRole('button', { name: 'Aujourd\'hui' }))
    expect(useGanttStore.getState().scrollTarget?.date).toBe('2026-10-06')
  })

  it('le « + » du téléphone propose Tâche, Jalon et Groupe', async () => {
    hydrate('editor')
    render(<GanttToolbar />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Jalon' }))
    expect(useGanttStore.getState().editor).toEqual({ mode: 'create', parentId: null, type: 'milestone' })
  })

  it('le zoom courant est en jaune, sans ombre', () => {
    hydrate('viewer')
    render(<GanttToolbar />)
    expect(screen.getByRole('button', { name: 'Jour' })).toHaveClass('bg-yellow')
    expect(screen.getByRole('group', { name: 'Zoom' })).not.toHaveClass('shadow-brutal')
  })
})
```

Dans `tests/unit/components/gantt/GanttView.test.tsx`, ajouter à la fin du `describe('GanttView : recentrage initial sur aujourd\'hui', …)` :

```tsx
  it('« Aujourd\'hui » recentre à la demande, même après un défilement manuel', () => {
    hydrate()
    render(<GanttView />)
    scroller().scrollLeft = 0
    act(() => { useGanttStore.getState().scrollToDate(TODAY) })
    expect(scroller().scrollLeft).toBe(expected('day'))

    // Une seconde demande sur la MÊME date recentre encore : c'est le geste qui compte.
    scroller().scrollLeft = 0
    act(() => { useGanttStore.getState().scrollToDate(TODAY) })
    expect(scroller().scrollLeft).toBe(expected('day'))
  })
```

Dans `tests/unit/lib/gantt/store.test.ts`, ajouter dans le `describe` :

```ts
  it('scrollToDate pose une demande dont le numéro change à chaque appel ; hydrate l\'efface', () => {
    useGanttStore.getState().scrollToDate('2026-09-01')
    const first = useGanttStore.getState().scrollTarget!
    useGanttStore.getState().scrollToDate('2026-09-01')
    const second = useGanttStore.getState().scrollTarget!
    expect(second.date).toBe('2026-09-01')
    expect(second.seq).toBeGreaterThan(first.seq)
    useGanttStore.getState().hydrate(payload)
    expect(useGanttStore.getState().scrollTarget).toBeNull()
  })
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/gantt/GanttToolbar.test.tsx tests/unit/components/gantt/GanttView.test.tsx tests/unit/lib/gantt/store.test.ts`
Attendu : ÉCHEC — `scrollToDate` n'existe pas, pas de bouton « Aujourd'hui » ni « Ajouter ».

- [ ] **Step 3: Implémenter**

Dans `lib/gantt/store.ts` :

Au-dessus de `export const useGanttStore`, ajouter :

```ts
/**
 * Compteur de module des demandes de recentrage. Hors du store : `hydrate` remet la demande à
 * `null`, et un compteur rangé dans l'état repartirait à 1 — `GanttView`, qui retient le dernier
 * numéro traité, prendrait la première demande du projet suivant pour une demande déjà servie.
 */
let scrollSeq = 0
```

Dans `GanttState`, sous `menu: ContextMenuState`, ajouter :

```ts
  /**
   * Demande de recentrage de la frise sur une date. `seq` change à CHAQUE demande, même pour la
   * même date : « Aujourd'hui » cliqué deux fois doit recentrer deux fois.
   */
  scrollTarget: { date: string; seq: number } | null
```

et sous `closeMenu: () => void`, ajouter :

```ts
  scrollToDate: (date: string) => void
```

Dans l'état initial, sous `menu: null,`, ajouter `scrollTarget: null,`. Dans `hydrate`, sous `menu: null,`, ajouter `scrollTarget: null,`. Sous `closeMenu: () => set({ menu: null }),`, ajouter :

```ts
  scrollToDate: (date) => set({ scrollTarget: { date, seq: ++scrollSeq } }),
```

Dans `components/gantt/GanttView.tsx`, sous `const select = useGanttStore((s) => s.select)`, ajouter :

```tsx
  const scrollTarget = useGanttStore((s) => s.scrollTarget)
  /** Numéro de la dernière demande de recentrage servie : chacune ne s'applique qu'une fois. */
  const servedSeq = useRef(0)
```

et, juste après l'effet de recentrage initial (celui qui se termine par `}, [projectId, zoom, today, layout.range, viewportWidth, sidebarWidth])`), ajouter :

```tsx
  // Recentrage À LA DEMANDE (« Aujourd'hui », mise en évidence du retard). Même calcul que le
  // recentrage d'ouverture, mais déclenché par un numéro de demande : une demande servie ne se
  // rejoue pas quand `layout` change à chaque image d'un glisser.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !scrollTarget || viewportWidth === null || scrollTarget.seq === servedSeq.current) return
    servedSeq.current = scrollTarget.seq
    el.scrollLeft = initialScrollLeft(dateToX(scrollTarget.date, layout.range, zoom), el.clientWidth, sidebarWidth)
  }, [scrollTarget, layout.range, zoom, viewportWidth, sidebarWidth])
```

Remplacer `components/gantt/ZoomControls.tsx` :

```tsx
'use client'
import { useGanttStore } from '@/lib/gantt/store'
import type { Zoom } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

const LEVELS: { value: Zoom; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
]

/**
 * Segments de zoom : une commande de niveau 2 (bordure, pas d'ombre), le segment courant en
 * jaune — le jaune ne signifie que « actif ». L'aplat noir d'avant faisait du zoom l'élément le
 * plus lourd de la barre, à égalité avec « + Tâche ».
 */
export function ZoomControls() {
  const zoom = useGanttStore((s) => s.zoom)
  const setZoom = useGanttStore((s) => s.setZoom)
  return (
    <div role="group" aria-label="Zoom" className="inline-flex border-[3px] border-ink bg-paper">
      {LEVELS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => setZoom(l.value)}
          aria-pressed={zoom === l.value}
          // Le nom accessible reste le mot entier quel que soit l'écran : sur un téléphone, seule
          // l'initiale est PEINTE, pour que zoom et boutons tiennent sur une ligne.
          aria-label={l.label}
          className={cn(
            'px-2 py-1 text-sm font-bold border-r-[3px] border-ink last:border-r-0 brutal-focus sm:px-3',
            zoom === l.value ? 'bg-yellow text-on-data' : 'hover:bg-band',
          )}
        >
          <span aria-hidden className="sm:hidden">{l.label[0]}</span>
          <span aria-hidden className="hidden sm:inline">{l.label}</span>
        </button>
      ))}
    </div>
  )
}
```

Remplacer `components/gantt/GanttToolbar.tsx` :

```tsx
'use client'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import type { TaskType } from '@/lib/gantt/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { ZoomControls } from './ZoomControls'

/**
 * Barre d'outils de VUE. Nom du projet, rôle, membres et lien Tickets sont dans l'en-tête ; ne
 * restent ici que les commandes qui agissent sur le diagramme : regarder (zoom, aujourd'hui) à
 * gauche, créer à droite.
 */
export function GanttToolbar() {
  const canEdit = useGanttStore(selectCanEdit)
  const openEditor = useGanttStore((s) => s.openEditor)
  const today = useGanttStore((s) => s.today)
  const scrollToDate = useGanttStore((s) => s.scrollToDate)
  const create = (type: TaskType) => openEditor({ mode: 'create', parentId: null, type })

  return (
    <div className="flex shrink-0 items-center gap-2 border-b-[3px] border-ink bg-paper px-3 py-2 sm:gap-3 sm:px-6 short:py-1">
      <ZoomControls />
      <Button size="sm" variant="secondary" onClick={() => scrollToDate(today)}>Aujourd&apos;hui</Button>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {canEdit ? (
          <>
            {/* Ordre de lecture : les secondaires d'abord, le principal au bout de la barre,
                là où l'œil finit sa course. */}
            <span className="hidden items-center gap-2 sm:flex sm:gap-3">
              <Button size="sm" variant="secondary" onClick={() => create('milestone')}>+ Jalon</Button>
              <Button size="sm" variant="secondary" onClick={() => create('group')}>+ Groupe</Button>
              <Button size="sm" onClick={() => create('task')}>+ Tâche</Button>
            </span>
            {/* Sur téléphone, trois boutons ne tiennent pas à côté du zoom : un seul « + »
                principal, qui ouvre le choix. */}
            <Menu
              label="Ajouter"
              className="sm:hidden"
              trigger={<span aria-hidden className="text-lg leading-none">+</span>}
              triggerClassName="size-8 bg-ink text-cream brutal brutal-press font-bold"
              entries={[
                { id: 'task', label: 'Tâche', onSelect: () => create('task') },
                { id: 'milestone', label: 'Jalon', onSelect: () => create('milestone') },
                { id: 'group', label: 'Groupe', onSelect: () => create('group') },
              ]}
            />
          </>
        ) : (
          <Badge color="cyan">Lecture seule</Badge>
        )}
      </div>
    </div>
  )
}
```

`TaskType` est exporté par `lib/gantt/types.ts` (`'task' | 'milestone' | 'group'`), et `openEditor` accepte `{ mode: 'create', parentId, type }` sans `startDate` ni `afterTaskId`.

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/gantt tests/unit/lib/gantt`
Attendu : PASS.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Adapter le parcours e2e**

Dans `tests/e2e/gantt-readonly.spec.ts`, second test, remplacer :

```ts
  await expect(page.getByText('editor')).toBeVisible()
```

par :

```ts
  // Le rôle d'un éditeur n'est plus affiché dans la barre : seul « Lecture seule » mérite d'être dit.
  await expect(page.getByText('Lecture seule')).toHaveCount(0)
```

- [ ] **Step 6: Lancer les parcours touchés**

Run: `npx playwright test tests/e2e/gantt-readonly.spec.ts tests/e2e/gantt-view.spec.ts tests/e2e/gantt-tasks.spec.ts tests/e2e/mobile.spec.ts`
Attendu : PASS, sauf l'échec environnemental connu « la vue s'ouvre recentrée sur aujourd'hui ». `gantt-view` clique « Jour » / « Semaine » / « Mois » par nom exact : les `aria-label` n'ont pas bougé.

- [ ] **Step 7: Commit**

```bash
git add components/gantt/GanttToolbar.tsx components/gantt/ZoomControls.tsx components/gantt/GanttView.tsx lib/gantt/store.ts tests/unit/components/gantt/GanttToolbar.test.tsx tests/unit/components/gantt/GanttView.test.tsx tests/unit/lib/gantt/store.test.ts tests/e2e/gantt-readonly.spec.ts
git commit -m "feat(gantt): barre d'outils de vue et bouton Aujourd'hui" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Ligne de tâche — badge « ⌗ », menu « ⋯ »

**Files:**
- Modify: `components/gantt/SidebarRow.tsx`
- Modify: `components/gantt/ContextMenu.tsx` (casse mixte, retour du focus)
- Test: `tests/unit/components/gantt/SidebarTicketCount.test.tsx`, `tests/unit/components/gantt/SidebarRow.test.tsx` (nouveau)
- Modify (e2e): `tests/e2e/context-menu.spec.ts`

**Interfaces:**
- Consomme : `openMenu`, `select` du store du Gantt ; `ContextMenu` existant (`buildMenuItems`).
- Produit : bouton `Actions de « <titre> »` sur chaque ligne d'un éditeur, qui ouvre le menu contextuel existant ancré sous lui (`openMenu({ x: rect.left, y: rect.bottom + 4, target: { kind: 'task', id } })`). Badge visible `⌗ {done}/{total}` doublé d'un texte masqué `« N ticket(s) terminé(s) sur M »`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `tests/unit/components/gantt/SidebarTicketCount.test.tsx`, remplacer chaque `'2/5'` par `'⌗ 2/5'`, et la regex `/\d+\/\d+/` par `/⌗/`. Le premier test devient :

```tsx
  it('affiche « ⌗ terminés/total » sur une tâche qui a des tickets', () => {
    hydrate({ enabled: true, done: 2, total: 5 })
    renderSidebar(false)
    expect(screen.getByText('2 tickets terminés sur 5')).toHaveClass('sr-only')
    expect(screen.getByText('⌗ 2/5')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('⌗ 2/5')).toHaveClass('font-mono')
  })
```

Créer `tests/unit/components/gantt/SidebarRow.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '@/components/gantt/Sidebar'
import { GanttViewContext } from '@/components/gantt/GanttView'
import { useGanttStore } from '@/lib/gantt/store'
import { computeLayout } from '@/lib/gantt/layout'
import { makeTask } from '../../lib/gantt/fixtures'

const task = makeTask({ id: 'k1', title: 'Développement' })

function renderSidebar({ role = 'editor', compact = false }: { role?: 'editor' | 'viewer'; compact?: boolean } = {}) {
  useGanttStore.getState().hydrate({
    projectId: 'p1', projectName: 'D', myRole: role, members: [], today: '2026-09-09',
    tasks: [task], dependencies: [],
  })
  const s = useGanttStore.getState()
  const layout = computeLayout({ tasks: s.tasks, dependencies: s.dependencies }, null, 'day', s.today, 800)
  return render(
    <GanttViewContext.Provider
      value={{ layout, canEdit: role !== 'viewer', drag: { onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} } as never, reorder: { onGripPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} }, sidebarWidth: 260, compact }}
    >
      <Sidebar />
    </GanttViewContext.Provider>,
  )
}

describe('SidebarRow : menu ⋯', () => {
  it('ouvre le menu contextuel de la tâche, ancré sous le bouton, et sélectionne la ligne', async () => {
    renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'Actions de « Développement »' }))
    const s = useGanttStore.getState()
    expect(s.menu?.target).toEqual({ kind: 'task', id: 'k1' })
    expect(s.selection).toEqual({ kind: 'task', id: 'k1' })
    // Un clic sur le bouton ne doit pas, en remontant, rouvrir l'éditeur ni désélectionner.
    expect(s.editor).toBeNull()
  })

  it('révélé au survol au bureau, visible en permanence en mode compact', () => {
    const { unmount } = renderSidebar()
    expect(screen.getByRole('button', { name: 'Actions de « Développement »' })).toHaveClass('opacity-0')
    unmount()
    renderSidebar({ compact: true })
    expect(screen.getByRole('button', { name: 'Actions de « Développement »' })).not.toHaveClass('opacity-0')
  })

  it('un lecteur n\'a pas de ⋯ : le menu contextuel ne lui propose rien', () => {
    renderSidebar({ role: 'viewer' })
    expect(screen.queryByRole('button', { name: /Actions de/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/gantt/SidebarTicketCount.test.tsx tests/unit/components/gantt/SidebarRow.test.tsx`
Attendu : ÉCHEC — texte `2/5` sans `⌗`, aucun bouton « Actions de … ».

- [ ] **Step 3: Implémenter**

Dans `components/gantt/SidebarRow.tsx`, sous `const openMenu = useOpenContextMenu()`, ajouter :

```tsx
  const openMenuAt = useGanttStore((s) => s.openMenu)
```

Remplacer le bloc du compteur de tickets :

```tsx
          <span className="shrink-0 font-mono text-xs text-ink-soft">
            <span className="sr-only">{`${done} ticket${done > 1 ? 's' : ''} terminé${done > 1 ? 's' : ''} sur ${total}`}</span>
            <span aria-hidden>{done}/{total}</span>
          </span>
```

par :

```tsx
          <span className="shrink-0">
            <span className="sr-only">{`${done} ticket${done > 1 ? 's' : ''} terminé${done > 1 ? 's' : ''} sur ${total}`}</span>
            {/* « ⌗ » dit de quoi parle la fraction : un « 1/2 » nu se lisait comme une date. */}
            <span aria-hidden className="border border-ink/40 px-1 font-mono text-xs text-ink-soft">⌗ {done}/{total}</span>
          </span>
```

À la fin de la ligne, juste avant le `</div>` fermant (après le bouton `Ajouter une tâche au groupe`), ajouter :

```tsx
      {/* Le chemin VISIBLE vers le menu de la ligne. Clic droit et double-clic restent, mais ne
          se devinent pas — et au doigt, ce bouton est la seule porte : il reste affiché en
          permanence en mode compact. Il ouvre le MÊME menu contextuel, ancré sous lui, pour ne
          pas maintenir deux listes de commandes. */}
      {canEdit && (
        <button
          type="button"
          aria-label={`Actions de « ${task.title} »`}
          aria-haspopup="menu"
          className={cn(
            'size-6 shrink-0 font-bold leading-none hover:bg-yellow hover:text-on-data brutal-focus',
            compact ? 'opacity-100' : 'opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 touch:opacity-100',
          )}
          onClick={(e) => {
            e.stopPropagation()
            const r = e.currentTarget.getBoundingClientRect()
            select({ kind: 'task', id: task.id })
            openMenuAt({ x: r.left, y: r.bottom + 4, target: { kind: 'task', id: task.id } })
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <span aria-hidden>⋯</span>
        </button>
      )}
```

Dans `components/gantt/ContextMenu.tsx`, fonction `Menu` :

Sous `const ref = useRef<HTMLDivElement>(null)`, ajouter :

```tsx
  // Élément qui avait le focus à l'ouverture — le « ⋯ » d'une ligne, quand on vient du clavier.
  // Lu au premier rendu, AVANT que `useLayoutEffect` ne déplace le focus sur le premier item.
  const opener = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)
```

Ajouter, après le `useEffect` des écouteurs de fenêtre :

```tsx
  useEffect(() => {
    const node = ref.current
    const from = opener.current
    return () => {
      // À la fermeture, le focus revient d'où il venait — seulement s'il était dans le menu (le
      // menu retiré, il retombe sur `body`) : un clic ailleurs a déjà posé le focus là où
      // l'utilisateur le voulait.
      const active = document.activeElement
      const lost = active === document.body || (node?.contains(active) ?? false)
      if (lost && from instanceof HTMLElement && document.contains(from)) from.focus({ preventScroll: true })
    }
  }, [])
```

Dans la classe des items, remplacer :

```tsx
            'block w-full px-4 py-2 text-left text-sm font-bold uppercase tracking-wide outline-none hover:bg-yellow hover:text-on-data focus-visible:bg-yellow focus-visible:text-on-data',
```

par :

```tsx
            // Casse mixte : un menu est une liste de commandes, pas une suite de titres.
            'block w-full px-4 py-2 text-left text-sm font-bold outline-none hover:bg-yellow hover:text-on-data focus-visible:bg-yellow focus-visible:text-on-data',
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/gantt`
Attendu : PASS.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Écrire le parcours e2e**

Ajouter à la fin de `tests/e2e/context-menu.spec.ts` :

```ts
test('le ⋯ d\'une ligne ouvre le même menu que le clic droit, et Échap rend le focus', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Points ${Date.now()}`)
  await createTask(page, 'Cadrage', isoInDays(0), isoInDays(3))

  const row = page.locator('[data-row-task-id]', { hasText: 'Cadrage' })
  const dots = row.getByRole('button', { name: 'Actions de « Cadrage »' })
  // Révélé au survol de la ligne, par l'opacité : le bouton existe déjà dans le document.
  await expect(dots).toHaveCSS('opacity', '0')
  await row.hover()
  await expect(dots).toHaveCSS('opacity', '1')

  await dots.click()
  const menu = page.getByRole('menu')
  // Premier item du menu d'une tâche (`buildMenuItems`) : « Modifier… ».
  await expect(menu.getByRole('menuitem', { name: 'Modifier…' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(dots).toBeFocused()

  await dots.click()
  await page.getByRole('menuitem', { name: 'Dupliquer' }).click()
  await expect(page.locator('[data-row-task-id]', { hasText: 'Cadrage (copie)' })).toHaveCount(1)
})
```

- [ ] **Step 6: Lancer les parcours touchés**

Run: `npx playwright test tests/e2e/context-menu.spec.ts tests/e2e/gantt-chaining.spec.ts tests/e2e/tickets.spec.ts`
Attendu : PASS. `context-menu` lit les titres par `[data-row-task-id] span.flex-1` : le titre garde sa classe `flex-1`, le badge et le bouton n'en ont pas. `tickets.spec` attend toujours « 0 ticket terminé sur 1 » (texte masqué inchangé).

- [ ] **Step 7: Commit**

```bash
git add components/gantt/SidebarRow.tsx components/gantt/ContextMenu.tsx tests/unit/components/gantt/SidebarTicketCount.test.tsx tests/unit/components/gantt/SidebarRow.test.tsx tests/e2e/context-menu.spec.ts
git commit -m "feat(gantt): menu ⋯ et badge de tickets sur la ligne de tâche" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Pied de page lisible et mise en évidence du retard

**Files:**
- Modify: `lib/gantt/summary.ts` (`isLate`)
- Modify: `lib/gantt/store.ts` (`highlightLate`, `toggleHighlightLate`, `setHighlightLate`)
- Modify: `components/gantt/GanttSummary.tsx` (réécriture)
- Modify: `components/gantt/TaskBar.tsx`, `components/gantt/MilestoneMark.tsx`, `components/gantt/GroupBar.tsx`
- Modify: `components/gantt/useKeyboardShortcuts.ts` (Échap)
- Test: `tests/unit/lib/gantt/summary.test.ts`, `tests/unit/lib/gantt/store.test.ts`, `tests/unit/components/gantt/GanttSummary.test.tsx` (nouveau), `tests/unit/components/gantt/GanttView.test.tsx`
- Modify (e2e): `tests/e2e/gantt-view.spec.ts`

**Interfaces:**
- Consomme : `scrollTarget` / `scrollSeq` (tâche 9).
- Produit :

```ts
// lib/gantt/summary.ts
export function isLate(t: SummaryTask, today: string): boolean   // tâche (pas jalon ni groupe), < 100 %, fin passée

// store du Gantt
highlightLate: boolean                 // remis à false par hydrate
toggleHighlightLate: () => void        // en allumant : recentre sur la tâche en retard qui commence le plus tôt
setHighlightLate: (on: boolean) => void
```

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `tests/unit/lib/gantt/summary.test.ts`, ajouter `isLate` à l'import depuis `@/lib/gantt/summary` et ajouter à la fin du fichier :

```ts
describe('isLate', () => {
  const today = '2026-10-06'
  it('une tâche inachevée dont la fin est passée', () => {
    expect(isLate({ type: 'task', title: 'a', startDate: '2026-09-01', endDate: '2026-10-05', progress: 50 }, today)).toBe(true)
  })
  it('pas une tâche qui finit aujourd\'hui : la journée n\'est pas écoulée', () => {
    expect(isLate({ type: 'task', title: 'a', startDate: '2026-09-01', endDate: today, progress: 0 }, today)).toBe(false)
  })
  it('ni une tâche achevée, ni un jalon, ni un groupe', () => {
    expect(isLate({ type: 'task', title: 'a', startDate: '2026-09-01', endDate: '2026-09-02', progress: 100 }, today)).toBe(false)
    expect(isLate({ type: 'milestone', title: 'm', startDate: '2026-09-01', endDate: '2026-09-01', progress: 0 }, today)).toBe(false)
    expect(isLate({ type: 'group', title: 'g', startDate: '2026-09-01', endDate: '2026-09-02', progress: 0 }, today)).toBe(false)
  })
})
```

Dans `tests/unit/lib/gantt/store.test.ts`, ajouter dans le `describe` :

```ts
  it('allumer la mise en évidence du retard recentre sur la tâche en retard qui commence le plus tôt', () => {
    useGanttStore.getState().hydrate({
      ...payload,
      today: '2026-10-06',
      tasks: [
        makeTask({ id: 'late-b', startDate: '2026-09-20', endDate: '2026-09-25', progress: 0 }),
        makeTask({ id: 'late-a', startDate: '2026-09-10', endDate: '2026-09-12', progress: 40 }),
        makeTask({ id: 'ok', startDate: '2026-10-05', endDate: '2026-10-10', progress: 0 }),
      ],
      dependencies: [],
    })
    useGanttStore.getState().toggleHighlightLate()
    expect(useGanttStore.getState().highlightLate).toBe(true)
    expect(useGanttStore.getState().scrollTarget?.date).toBe('2026-09-10')

    // L'éteindre ne bouge pas la vue.
    const seq = useGanttStore.getState().scrollTarget!.seq
    useGanttStore.getState().toggleHighlightLate()
    expect(useGanttStore.getState().highlightLate).toBe(false)
    expect(useGanttStore.getState().scrollTarget!.seq).toBe(seq)
  })

  it('hydrate éteint la mise en évidence : elle n\'est jamais persistée', () => {
    useGanttStore.getState().setHighlightLate(true)
    useGanttStore.getState().hydrate(payload)
    expect(useGanttStore.getState().highlightLate).toBe(false)
  })
```

Créer `tests/unit/components/gantt/GanttSummary.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GanttSummary } from '@/components/gantt/GanttSummary'
import { useGanttStore } from '@/lib/gantt/store'
import { makeTask } from '../../lib/gantt/fixtures'
import type { Task } from '@/lib/gantt/types'

const TODAY = '2026-10-06'

function hydrate(tasks: Task[]) {
  act(() => {
    useGanttStore.getState().hydrate({ projectId: 'p1', projectName: 'P', myRole: 'viewer', members: [], tasks, dependencies: [], today: TODAY })
  })
}

describe('GanttSummary', () => {
  it('pas de bouton de retard quand rien n\'est en retard', () => {
    hydrate([makeTask({ startDate: '2026-10-05', endDate: '2026-10-10' })])
    render(<GanttSummary />)
    expect(screen.queryByRole('button', { name: /en retard/ })).not.toBeInTheDocument()
  })

  it('« N en retard » bascule la mise en évidence et dit son état', async () => {
    hydrate([makeTask({ startDate: '2026-09-01', endDate: '2026-09-05', progress: 0 })])
    render(<GanttSummary />)
    const button = screen.getByRole('button', { name: '1 en retard' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveClass('text-danger')

    await userEvent.click(button)
    expect(useGanttStore.getState().highlightLate).toBe(true)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveClass('bg-yellow')

    await userEvent.click(button)
    expect(useGanttStore.getState().highlightLate).toBe(false)
  })

  it('libellés en casse mixte, chiffres en mono', () => {
    hydrate([makeTask({ startDate: '2026-10-05', endDate: '2026-10-10' })])
    render(<GanttSummary />)
    expect(screen.getByText('Tâches')).not.toHaveClass('uppercase')
    expect(screen.getByText('1', { selector: '.font-mono' })).toBeInTheDocument()
  })
})
```

Dans `tests/unit/components/gantt/GanttView.test.tsx`, changer la première ligne d'import en :

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
```

et ajouter à la fin du fichier :

```tsx
describe('GanttView : mise en évidence du retard', () => {
  const late = makeTask({ id: 'late', projectId: 'p1', startDate: '2026-09-01', endDate: '2026-09-05', progress: 0 })

  function hydrateWithLate() {
    act(() => {
      useGanttStore.getState().hydrate({
        projectId: 'p1', projectName: 'Projet', myRole: 'owner', members: [], tasks: [task, late], dependencies: [], today: TODAY,
      })
    })
  }

  it('liseré rouge sur la barre en retard, demi-opacité pour les autres', () => {
    hydrateWithLate()
    const { container } = render(<GanttView />)
    act(() => { useGanttStore.getState().toggleHighlightLate() })
    const lateBar = container.querySelector('[data-task-id="late"]')!
    const other = container.querySelector('[data-task-id="a"]')!
    expect(lateBar).toHaveClass('border-danger')
    expect(lateBar).not.toHaveClass('opacity-50')
    expect(other).toHaveClass('opacity-50')
    expect(other).toHaveClass('border-ink')
  })

  it('Échap éteint la mise en évidence avant de désélectionner', () => {
    hydrateWithLate()
    render(<GanttView />)
    act(() => {
      useGanttStore.getState().select({ kind: 'task', id: 'a' })
      useGanttStore.getState().toggleHighlightLate()
    })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useGanttStore.getState().highlightLate).toBe(false)
    expect(useGanttStore.getState().selection).toEqual({ kind: 'task', id: 'a' })
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/lib/gantt tests/unit/components/gantt`
Attendu : ÉCHEC — `isLate`, `toggleHighlightLate` et le bouton de retard n'existent pas.

- [ ] **Step 3: Implémenter**

Dans `lib/gantt/summary.ts`, ajouter au-dessus de `projectSummary` :

```ts
/**
 * Une tâche en retard : une TÂCHE (un jalon n'a pas d'avancement, un groupe pas de dates
 * propres), inachevée, dont la fin est passée. Une tâche qui finit AUJOURD'HUI n'est pas en
 * retard : la journée n'est pas écoulée. Partagée par la synthèse et par la mise en évidence
 * du Gantt : les deux doivent compter les mêmes barres.
 */
export function isLate(t: SummaryTask, today: string): boolean {
  return t.type === 'task' && t.progress < 100 && t.endDate < today
}
```

et, dans `projectSummary`, remplacer :

```ts
    lateCount: plain.filter((t) => t.progress < 100 && t.endDate < today).length,
```

par :

```ts
    lateCount: plain.filter((t) => isLate(t, today)).length,
```

(en retirant le commentaire « Une tâche qui finit AUJOURD'HUI… » au-dessus, désormais porté par `isLate`).

Dans `lib/gantt/store.ts` :
- ajouter l'import `import { isLate } from './summary'` ;
- dans `GanttState`, sous `scrollTarget: …`, ajouter :

```ts
  /**
   * Mise en évidence du retard, allumée depuis le pied de page. Un regard, pas une donnée : rien
   * n'est persisté, et `hydrate` l'éteint.
   */
  highlightLate: boolean
```

  et sous `scrollToDate: (date: string) => void`, ajouter :

```ts
  toggleHighlightLate: () => void
  setHighlightLate: (on: boolean) => void
```

- remplacer `export const useGanttStore = create<GanttState>((set) => ({` par `export const useGanttStore = create<GanttState>((set, get) => ({` ;
- dans l'état initial, sous `scrollTarget: null,`, ajouter `highlightLate: false,` ; dans `hydrate`, sous `scrollTarget: null,`, ajouter `highlightLate: false,` ;
- sous `scrollToDate: …`, ajouter :

```ts
  toggleHighlightLate: () => {
    const s = get()
    if (s.highlightLate) { set({ highlightLate: false }); return }
    // En allumant, la frise va chercher le retard le plus ANCIEN : il peut être loin à gauche
    // d'une vue recentrée sur aujourd'hui, et une mise en évidence hors champ ne montre rien.
    const first = Object.values(s.tasks)
      .filter((t) => isLate(t, s.today))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    set(first
      ? { highlightLate: true, scrollTarget: { date: first.startDate, seq: ++scrollSeq } }
      : { highlightLate: true })
  },
  setHighlightLate: (highlightLate) => set({ highlightLate }),
```

Dans `components/gantt/useKeyboardShortcuts.ts`, remplacer :

```ts
      if (e.key === 'Escape') {
        if (s.editor) s.closeEditor()
        else s.select(null)
        return
      }
```

par :

```ts
      if (e.key === 'Escape') {
        // Un Échap défait UNE chose, la plus récente en surface : l'éditeur, puis la mise en
        // évidence du retard, puis la sélection.
        if (s.editor) s.closeEditor()
        else if (s.highlightLate) s.setHighlightLate(false)
        else s.select(null)
        return
      }
```

Dans `components/gantt/TaskBar.tsx` :
- ajouter l'import `import { isLate } from '@/lib/gantt/summary'` ;
- sous `const openEditor = …`, ajouter :

```tsx
  const highlightLate = useGanttStore((s) => s.highlightLate)
  const today = useGanttStore((s) => s.today)
  const late = isLate(task, today)
```

- dans le `cn(` de la barre, remplacer `'group/bar absolute flex items-center border-[3px] border-ink shadow-brutal select-none touch-none',` par :

```tsx
        'group/bar absolute flex items-center border-[3px] shadow-brutal select-none touch-none',
        // Mise en évidence : le retard prend un liseré rouge, tout le reste recule de moitié.
        highlightLate && late ? 'border-danger' : 'border-ink',
        highlightLate && !late && 'opacity-50',
```

Dans `components/gantt/MilestoneMark.tsx`, sous `const openMenu = useOpenContextMenu()`, ajouter `const highlightLate = useGanttStore((s) => s.highlightLate)`, et remplacer la classe du conteneur :

```tsx
      className={cn('group/ms absolute flex items-center select-none touch-none', canEdit && 'cursor-grab active:cursor-grabbing')}
```

par :

```tsx
      // Un jalon n'est jamais « en retard » : pendant la mise en évidence, il recule avec le reste.
      className={cn('group/ms absolute flex items-center select-none touch-none', canEdit && 'cursor-grab active:cursor-grabbing', highlightLate && 'opacity-50')}
```

Dans `components/gantt/GroupBar.tsx`, sous `const openMenu = useOpenContextMenu()`, ajouter `const highlightLate = useGanttStore((s) => s.highlightLate)`, et remplacer :

```tsx
      className={cn('absolute bg-ink-soft select-none', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2')}
```

par :

```tsx
      className={cn('absolute bg-ink-soft select-none', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2', highlightLate && 'opacity-50')}
```

Remplacer `components/gantt/GanttSummary.tsx` :

```tsx
'use client'
import { useMemo } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useGanttStore } from '@/lib/gantt/store'
import { projectSummary } from '@/lib/gantt/summary'
import { parseDate } from '@/lib/gantt/dates'
import { cn } from '@/lib/utils'

function short(iso: string) {
  return format(parseDate(iso), 'd MMM yyyy', { locale: fr })
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-baseline gap-2">
      {/* Casse mixte, encre douce : l'intitulé s'efface devant le chiffre qu'il présente. */}
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-sm font-bold">{children}</span>
    </div>
  )
}

/**
 * Barre de synthèse sous le diagramme : les chiffres qu'on allait autrement chercher en comptant
 * les barres à l'œil. Elle reste du DÉCOR (encre douce, aplat blanc), sauf le retard — le seul
 * signal à voir, et la seule commande : il allume la mise en évidence des barres en retard.
 */
export function GanttSummary() {
  const tasks = useGanttStore((s) => s.tasks)
  const today = useGanttStore((s) => s.today)
  const highlightLate = useGanttStore((s) => s.highlightLate)
  const toggleHighlightLate = useGanttStore((s) => s.toggleHighlightLate)
  const summary = useMemo(() => projectSummary(Object.values(tasks), today), [tasks, today])

  if (summary.taskCount === 0 && summary.milestoneCount === 0) return null

  return (
    <div
      data-testid="gantt-summary"
      // `hidden sm:flex` : sur un téléphone, la barre repliée sur quatre lignes mangeait le tiers de
      // la hauteur ; la carte du projet dans la liste porte déjà ces chiffres.
      className="hidden shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-t-[3px] border-ink bg-paper px-6 py-2 sm:flex short:hidden"
    >
      <Stat label="Tâches"><span className="font-mono">{summary.taskCount}</span></Stat>
      {summary.groupCount > 0 && <Stat label="Groupes"><span className="font-mono">{summary.groupCount}</span></Stat>}
      {summary.milestoneCount > 0 && <Stat label="Jalons"><span className="font-mono">{summary.milestoneCount}</span></Stat>}

      {summary.range && (
        <Stat label="Période">
          <span className="font-mono text-xs">{short(summary.range.start)} → {short(summary.range.end)}</span>
        </Stat>
      )}

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm text-ink-soft">Avancement</span>
        {/* Hachures d'encre, comme l'avancement d'une tâche : même information, même vocabulaire. */}
        <span
          role="progressbar"
          aria-valuenow={summary.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement du projet"
          className="relative block h-4 w-24 border-[3px] border-ink bg-paper"
        >
          <span className="absolute inset-y-0 left-0 hatch opacity-40" style={{ width: `${summary.progress}%` }} />
        </span>
        <span className="font-mono text-sm font-bold">{summary.progress} %</span>
      </div>

      {summary.nextMilestone && (
        <Stat label="Prochain jalon">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="size-2 rotate-45 bg-ink" />
            {summary.nextMilestone.title}
            <span className="font-mono text-xs font-normal text-ink-soft">{short(summary.nextMilestone.date)}</span>
          </span>
        </Stat>
      )}

      {summary.lateCount > 0 && (
        // Niveau 3 au repos (texte rouge, jamais un aplat) ; jaune quand la mise en évidence est
        // allumée — le jaune dit « actif ». Un second clic ou Échap l'éteint.
        <button
          type="button"
          aria-pressed={highlightLate}
          onClick={toggleHighlightLate}
          title={highlightLate ? 'Ne plus distinguer le retard (Échap)' : 'Distinguer les tâches en retard'}
          className={cn(
            'ml-auto shrink-0 border-[3px] px-2 py-0.5 text-sm font-bold brutal-focus',
            highlightLate ? 'border-ink bg-yellow text-on-data' : 'border-transparent text-danger underline-offset-4 hover:underline',
          )}
        >
          <span className="font-mono">{summary.lateCount}</span> en retard
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/lib/gantt tests/unit/components/gantt`
Attendu : PASS.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Écrire le parcours e2e**

Ajouter en tête de `tests/e2e/gantt-view.spec.ts`, sous les constantes :

```ts
function isoInDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```

et à la fin du fichier :

```ts
test('« N en retard » met les barres en retard en évidence, Échap l\'éteint', async ({ page }) => {
  await loginAs(page, 'alice')
  // Projet jetable : jamais d'écriture dans le projet démo.
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Retard ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)

  for (const [title, start, end] of [['Ancienne', -10, -5], ['Actuelle', 0, 3]] as const) {
    await page.getByRole('button', { name: '+ Tâche' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
    await dialog.getByLabel('Titre').fill(title)
    await dialog.getByLabel('Début').fill(isoInDays(start))
    await dialog.getByLabel('Fin').fill(isoInDays(end))
    await dialog.getByRole('button', { name: 'Créer', exact: true }).click()
    await expect(page.locator('[data-row-task-id]', { hasText: title })).toHaveCount(1)
  }

  const late = page.locator('[data-task-id]', { hasText: 'Ancienne' })
  const current = page.locator('[data-task-id]', { hasText: 'Actuelle' })
  const toggle = page.getByTestId('gantt-summary').getByRole('button', { name: '1 en retard' })

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(late).toHaveClass(/border-danger/)
  await expect(current).toHaveCSS('opacity', '0.5')
  // La frise est allée chercher le retard : la barre est dans le champ.
  await expect(late).toBeInViewport()

  await page.keyboard.press('Escape')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(current).toHaveCSS('opacity', '1')
})
```

- [ ] **Step 6: Lancer les parcours touchés**

Run: `npx playwright test tests/e2e/gantt-view.spec.ts tests/e2e/gantt-chaining.spec.ts tests/e2e/gantt-drag.spec.ts`
Attendu : PASS, sauf les échecs environnementaux connus (« la vue s'ouvre recentrée sur aujourd'hui », « un lecteur ne peut pas déplacer une barre »).

- [ ] **Step 7: Commit**

```bash
git add lib/gantt/summary.ts lib/gantt/store.ts components/gantt/GanttSummary.tsx components/gantt/TaskBar.tsx components/gantt/MilestoneMark.tsx components/gantt/GroupBar.tsx components/gantt/useKeyboardShortcuts.ts tests/unit/lib/gantt/summary.test.ts tests/unit/lib/gantt/store.test.ts tests/unit/components/gantt/GanttSummary.test.tsx tests/unit/components/gantt/GanttView.test.tsx tests/e2e/gantt-view.spec.ts
git commit -m "feat(gantt): pied de page lisible et mise en évidence du retard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Lot 5 — Tickets

## Task 12: Barre d'outils des tickets et filtres communs aux deux vues

**Files:**
- Create: `components/tickets/TicketFilterFields.tsx`
- Modify: `components/tickets/TicketsToolbar.tsx` (réécriture)
- Modify: `components/tickets/TicketList.tsx` (réécriture : plus de filtres, badge de statut)
- Modify: `components/tickets/TicketBoard.tsx` (les filtres s'appliquent)
- Modify: `lib/tickets/types.ts` (`TICKET_STATUS_BADGE.todo` → `'paper'`)
- Test: `tests/unit/components/tickets/TicketsToolbar.test.tsx` (nouveau), `tests/unit/components/tickets/TicketList.test.tsx`, `tests/unit/components/tickets/TicketBoard.test.tsx`
- Modify (e2e): `tests/e2e/tickets.spec.ts`

**Interfaces:**
- Consomme : `filters` / `setFilter` du store des tickets, `filterTickets` (`lib/tickets/summary.ts`), `Dialog`, `Select`.
- Produit :

```ts
export function TicketFilterFields(props: { compact?: boolean }): JSX.Element
// Trois <select> nommés « Statut », « Assigné », « Tâche » (libellé visible, ou aria-label en compact).
```

Le compteur de la barre porte `data-testid="tickets-count"` : « N tickets » sans filtre, « n sur N tickets » avec.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/unit/components/tickets/TicketsToolbar.test.tsx` :

```tsx
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketsToolbar } from '@/components/tickets/TicketsToolbar'
import { useTicketsStore } from '@/lib/tickets/store'
import { NO_FILTERS } from '@/lib/tickets/types'
import { makeTicket } from '../../lib/tickets/fixtures'

function hydrate(myRole: 'editor' | 'viewer' = 'editor') {
  act(() => {
    useTicketsStore.getState().hydrate({
      projectId: 'p1', projectName: 'P', myRole, members: [], tasks: [],
      tickets: [makeTicket({ id: 'a', status: 'todo' }), makeTicket({ id: 'b', status: 'done' }), makeTicket({ id: 'c', status: 'done' })],
    })
  })
}

describe('TicketsToolbar', () => {
  beforeEach(() => useTicketsStore.setState({ filters: NO_FILTERS, editor: null }))

  it('compte les tickets, et dit « n sur N » quand un filtre en cache', () => {
    hydrate()
    render(<TicketsToolbar view="board" />)
    expect(screen.getByTestId('tickets-count')).toHaveTextContent('3 tickets')
    act(() => useTicketsStore.getState().setFilter('status', 'todo'))
    expect(screen.getByTestId('tickets-count')).toHaveTextContent('1 sur 3 tickets')
  })

  it('la vue courante est un segment jaune, marqué courant', () => {
    hydrate()
    render(<TicketsToolbar view="list" />)
    const list = screen.getByRole('link', { name: 'Liste' })
    expect(list).toHaveAttribute('aria-current', 'page')
    expect(list).toHaveClass('bg-yellow')
    expect(list).toHaveAttribute('href', '/projects/p1/tickets?vue=liste')
    expect(screen.getByRole('link', { name: 'Kanban' })).not.toHaveAttribute('aria-current')
  })

  it('n\'a plus ni titre ni lien retour : ils sont dans l\'en-tête', () => {
    hydrate()
    render(<TicketsToolbar view="board" />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Frise|Gantt/ })).not.toBeInTheDocument()
  })

  it('un lecteur voit « Lecture seule » à la place de « + Ticket »', () => {
    hydrate('viewer')
    render(<TicketsToolbar view="board" />)
    expect(screen.getByText('Lecture seule')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Ticket' })).not.toBeInTheDocument()
  })

  it('« Filtres » ouvre une fenêtre avec les trois champs, branchés sur le store', async () => {
    hydrate()
    render(<TicketsToolbar view="board" />)
    await userEvent.click(screen.getByRole('button', { name: 'Filtres' }))
    const dialog = screen.getByRole('dialog', { name: 'Filtres' })
    await userEvent.selectOptions(within(dialog).getByLabelText('Statut'), 'done')
    expect(useTicketsStore.getState().filters.status).toBe('done')
    expect(within(dialog).getByLabelText('Assigné')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Tâche')).toBeInTheDocument()
  })
})
```

Dans `tests/unit/components/tickets/TicketList.test.tsx` :
- ajouter l'import `import { TicketFilterFields } from '@/components/tickets/TicketFilterFields'` et l'import `import { within } from '@testing-library/react'` (fusionné avec la ligne `render, screen` existante) ;
- ajouter sous `function hydrate() { … }` :

```tsx
/** Les filtres vivent dans la barre d'outils ; la liste se teste avec eux, comme à l'écran. */
function renderList() {
  return render(<><TicketFilterFields /><TicketList /></>)
}
```

- remplacer chaque `render(<TicketList />)` par `renderList()` ;
- ajouter à la fin du `describe` :

```tsx
  it('le statut est un badge en casse mixte dans la couleur du statut', () => {
    hydrate()
    renderList()
    const alpha = screen.getAllByRole('row').find((r) => r.textContent?.includes('Alpha'))!
    expect(within(alpha).getByText('À faire')).toHaveClass('bg-paper')
    expect(within(alpha).getByText('À faire')).not.toHaveClass('uppercase')
  })

  it('le titre est un bouton de niveau 3 : souligné au survol seulement', () => {
    hydrate()
    renderList()
    const button = screen.getByRole('button', { name: /#1 Alpha/ })
    expect(button).toHaveClass('hover:underline')
    expect(button).not.toHaveClass('underline')
  })
```

Dans `tests/unit/components/tickets/TicketBoard.test.tsx` :
- ajouter `import { NO_FILTERS } from '@/lib/tickets/types'` ;
- remplacer `beforeEach(() => updateTicket.mockClear())` par :

```tsx
beforeEach(() => {
  updateTicket.mockClear()
  // Les filtres survivent à `hydrate` (voulu) : sans remise à zéro, un test hériterait du précédent.
  useTicketsStore.setState({ filters: NO_FILTERS, drag: null, editor: null })
})
```

- ajouter à la fin du `describe` :

```tsx
  it('les filtres du store s\'appliquent aussi au kanban', () => {
    hydrate()
    useTicketsStore.getState().setFilter('status', 'doing')
    render(<TicketBoard />)
    expect(within(screen.getByRole('region', { name: 'À faire' })).getByText('Vide')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'À faire' })).getByText('0')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'En cours' })).getByRole('article', { name: '#2 En cours ça' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/tickets`
Attendu : ÉCHEC — `TicketFilterFields` introuvable, compteur sans `data-testid`, kanban non filtré.

- [ ] **Step 3: Implémenter**

Dans `lib/tickets/types.ts`, remplacer dans `TICKET_STATUS_BADGE` :

```ts
  todo: 'ink',
```

par :

```ts
  // Papier et non encre : un aplat noir faisait de « À faire » le statut le plus criard, alors
  // que c'est le plus banal. Même teinte que la pastille de colonne et l'accent de carte.
  todo: 'paper',
```

Créer `components/tickets/TicketFilterFields.tsx` :

```tsx
'use client'
import { useTicketsStore } from '@/lib/tickets/store'
import { STATUS_LABELS, STATUS_ORDER, type TicketStatus } from '@/lib/tickets/types'
import { Select } from '@/components/ui/Select'

/**
 * Les trois filtres du backlog. Ils vivent dans le STORE et s'appliquent aux deux vues : poser
 * « Terminé » en liste puis passer au kanban montre la même sélection, et le compteur de la
 * barre d'outils ne ment sur aucune des deux.
 *
 * `compact` (barre d'outils) : un libellé visible coûterait une ligne de hauteur. Il passe en
 * `aria-label`, et la première option dit d'elle-même ce que le champ filtre.
 *
 * `'all'` et la chaîne vide sont DEUX valeurs distinctes : « tout le monde » et « personne ».
 * Les confondre rendrait le second filtre inatteignable.
 */
export function TicketFilterFields({ compact = false }: { compact?: boolean }) {
  const filters = useTicketsStore((s) => s.filters)
  const setFilter = useTicketsStore((s) => s.setFilter)
  const members = useTicketsStore((s) => s.members)
  const tasks = useTicketsStore((s) => s.tasks)
  const named = (label: string) => (compact ? { 'aria-label': label, className: 'py-1 text-sm' } : { label })

  return (
    <>
      <Select
        {...named('Statut')}
        value={filters.status}
        onChange={(e) => setFilter('status', e.target.value as TicketStatus | 'all')}
        options={[{ value: 'all', label: 'Tous les statuts' }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
      />
      <Select
        {...named('Assigné')}
        value={filters.assigneeId}
        onChange={(e) => setFilter('assigneeId', e.target.value)}
        options={[{ value: 'all', label: 'Tout le monde' }, { value: '', label: 'Personne' }, ...members.map((m) => ({ value: m.userId, label: m.displayName }))]}
      />
      <Select
        {...named('Tâche')}
        value={filters.taskId}
        onChange={(e) => setFilter('taskId', e.target.value)}
        options={[{ value: 'all', label: 'Toutes les tâches' }, { value: '', label: 'Aucune' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
      />
    </>
  )
}
```

Remplacer `components/tickets/TicketsToolbar.tsx` :

```tsx
'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { filterTickets } from '@/lib/tickets/summary'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TicketFilterFields } from './TicketFilterFields'
import { cn } from '@/lib/utils'

const plural = (n: number) => `ticket${n > 1 ? 's' : ''}`

/**
 * Barre d'outils commune aux deux vues : la vue (segments), les filtres, le compte, et
 * « + Ticket ». Le titre et le retour au Gantt sont dans l'en-tête du projet.
 */
export function TicketsToolbar({ view }: { view: 'board' | 'list' }) {
  const projectId = useTicketsStore((s) => s.projectId)
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)
  const tickets = useTicketsStore((s) => s.tickets)
  const filters = useTicketsStore((s) => s.filters)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const total = Object.keys(tickets).length
  // Mémoïsé : `filterTickets` rend un tableau neuf, le calculer dans un sélecteur bouclerait.
  const shown = useMemo(() => filterTickets(Object.values(tickets), filters).length, [tickets, filters])
  const filtered = filters.status !== 'all' || filters.assigneeId !== 'all' || filters.taskId !== 'all'

  // La vue passe par l'URL et non par le store : elle se partage par lien, et un rechargement
  // rend la même page. Des liens et non des boutons : c'est une navigation.
  const segment = (target: 'board' | 'list', label: string) => (
    <Link
      href={target === 'list' ? `/projects/${projectId}/tickets?vue=liste` : `/projects/${projectId}/tickets`}
      aria-current={view === target ? 'page' : undefined}
      className={cn(
        'border-r-[3px] border-ink px-3 py-1 text-sm font-bold last:border-r-0 brutal-focus',
        view === target ? 'bg-yellow text-on-data' : 'bg-paper hover:bg-band',
      )}
    >
      {label}
    </Link>
  )

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-ink bg-paper px-3 py-2 sm:gap-4 sm:px-6">
      <nav aria-label="Vue" className="inline-flex border-[3px] border-ink">{segment('board', 'Kanban')}{segment('list', 'Liste')}</nav>
      {/* Au bureau, les filtres en ligne ; sur téléphone, derrière « Filtres » : trois sélecteurs
          côte à côte élargissaient la page. */}
      <div className="hidden items-center gap-2 sm:flex"><TicketFilterFields compact /></div>
      <Button size="sm" variant="secondary" className="sm:hidden" onClick={() => setFiltersOpen(true)}>
        Filtres{filtered && <span aria-hidden className="text-xs">●</span>}
      </Button>
      {/* Un filtre qui cache tout ne doit pas se lire comme un backlog vide : « 0 sur 7 ». */}
      <span data-testid="tickets-count" aria-live="polite" className="text-sm text-ink-soft">
        {filtered
          ? <><span className="font-mono">{shown}</span> sur <span className="font-mono">{total}</span> {plural(total)}</>
          : <><span className="font-mono">{total}</span> {plural(total)}</>}
      </span>
      <div className="ml-auto flex items-center gap-2">
        {canEdit
          ? <Button size="sm" onClick={() => openEditor({ mode: 'create', taskId: null })}>+ Ticket</Button>
          : <Badge color="cyan">Lecture seule</Badge>}
      </div>
      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtres"
        footer={<Button onClick={() => setFiltersOpen(false)}>Voir les tickets</Button>}
      >
        <div className="space-y-3"><TicketFilterFields /></div>
      </Dialog>
    </div>
  )
}
```

Dans `components/tickets/TicketBoard.tsx` :
- ajouter `import { filterTickets, ticketsByStatus } from '@/lib/tickets/summary'` à la place de l'import de `ticketsByStatus` seul ;
- sous `const tickets = …`, ajouter `const filters = useTicketsStore((s) => s.filters)` ;
- remplacer le `useMemo` par :

```tsx
  // Les filtres de la barre d'outils s'appliquent AUSSI ici : un « Terminé » posé en liste doit
  // se retrouver au kanban. Mémoïsé : `ticketsByStatus` construit trois tableaux neufs à chaque
  // appel, et le sélecteur Zustand compare par référence — le calculer dedans bouclerait.
  const columns = useMemo(() => ticketsByStatus(filterTickets(Object.values(tickets), filters)), [tickets, filters])
```

- remplacer la classe du conteneur `"grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-6 md:grid-cols-3"` par `"grid min-h-0 flex-1 content-start gap-6 overflow-y-auto p-3 sm:p-6 md:grid-cols-3"` (`content-start` : les colonnes ont la hauteur de leur contenu, plus celle de l'écran).

Remplacer `components/tickets/TicketList.tsx` :

```tsx
'use client'
import { useMemo } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { filterTickets } from '@/lib/tickets/summary'
import { STATUS_LABELS, TICKET_STATUS_BADGE } from '@/lib/tickets/types'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'

/** Vue tableau du backlog. Les filtres sont dans la barre d'outils, communs aux deux vues. */
export function TicketList() {
  const tickets = useTicketsStore((s) => s.tickets)
  const filters = useTicketsStore((s) => s.filters)
  const members = useTicketsStore((s) => s.members)
  const tasks = useTicketsStore((s) => s.tasks)
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)

  // Mémoïsé : `filterTickets` rend un tableau neuf à chaque appel, et le sélecteur Zustand
  // compare par référence — le calculer dans le sélecteur bouclerait.
  const rows = useMemo(() => filterTickets(Object.values(tickets), filters), [tickets, filters])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-6">
      {rows.length === 0 ? (
        // Un tableau vide sans un mot laisse croire que le projet n'a pas de ticket, alors que
        // c'est le filtre qui les cache.
        <p className="text-sm text-ink-soft">Aucun ticket ne correspond à ces filtres.</p>
      ) : (
        // Le tableau défile DANS son propre cadre : sur un téléphone, laisser la page défiler
        // horizontalement décalerait aussi la barre d'outils.
        <div className="overflow-x-auto border-[3px] border-ink">
          <table className="w-full border-collapse bg-paper text-sm">
            <thead>
              <tr className="border-b-[3px] border-ink bg-band text-left">
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">#</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Titre</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Statut</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Assigné</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Tâche</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const assignee = members.find((m) => m.userId === t.assigneeId)
                const task = tasks.find((k) => k.id === t.taskId)
                return (
                  <tr key={t.id} className="border-b border-ink/20 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">#{t.number}</td>
                    <td className="px-3 py-2">
                      {/* Un vrai bouton et non une ligne cliquable : la liste doit se parcourir
                          au clavier. Niveau 3 : texte seul, souligné au survol. */}
                      {canEdit ? (
                        <button
                          type="button"
                          className="text-left font-bold underline-offset-4 hover:underline brutal-focus"
                          onClick={() => openEditor({ mode: 'edit', ticketId: t.id })}
                        >
                          #{t.number} {t.title}
                        </button>
                      ) : (
                        <span className="font-bold">{t.title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2"><Badge color={TICKET_STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge></td>
                    <td className="px-3 py-2">
                      {assignee
                        ? <span className="flex items-center gap-2"><Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />{assignee.displayName}</span>
                        : <span className="text-xs text-ink-soft">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">{task?.title ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/tickets tests/unit/components/gantt/TaskEditorTickets.test.tsx`
Attendu : PASS. (`TaskEditorTickets` lit `TICKET_STATUS_BADGE` : il ne vérifie pas la couleur de « À faire ».)

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Écrire le parcours e2e**

Ajouter à la fin de `tests/e2e/tickets.spec.ts` :

```ts
test('les filtres de la barre d\'outils s\'appliquent au kanban et suivent en vue liste', async ({ page }) => {
  await loginAs(page, 'alice')
  // Lecture seule de « Projet tickets » : filtrer n'écrit rien.
  await page.goto(`/projects/${TICKETS_PROJECT.id}/tickets`)

  await page.getByLabel('Statut').selectOption('done')
  await expect(page.getByRole('region', { name: 'À faire' }).getByRole('article')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Terminé' }).getByRole('article')).toHaveCount(1)
  await expect(page.getByTestId('tickets-count')).toHaveText('1 sur 3 tickets')

  await page.getByRole('link', { name: 'Liste' }).click()
  await page.waitForURL('**/tickets?vue=liste')
  await expect(page.getByRole('row')).toHaveCount(2) // en-tête + le ticket terminé
})
```

- [ ] **Step 6: Lancer les parcours touchés**

Run: `npx playwright test tests/e2e/tickets.spec.ts`
Attendu : PASS. « la vue liste filtre » sélectionne par valeur (`'done'`, `'all'`) et la tâche par le libellé `Aucune`, inchangé.

- [ ] **Step 7: Commit**

```bash
git add components/tickets/TicketFilterFields.tsx components/tickets/TicketsToolbar.tsx components/tickets/TicketList.tsx components/tickets/TicketBoard.tsx lib/tickets/types.ts tests/unit/components/tickets/TicketsToolbar.test.tsx tests/unit/components/tickets/TicketList.test.tsx tests/unit/components/tickets/TicketBoard.test.tsx tests/e2e/tickets.spec.ts
git commit -m "feat(tickets): barre d'outils commune et filtres sur les deux vues" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 13: Colonnes du kanban allégées et emplacement de dépôt

**Files:**
- Create: `components/tickets/status.ts`
- Modify: `components/tickets/TicketColumn.tsx` (réécriture)
- Test: `tests/unit/components/tickets/TicketColumn.test.tsx` (nouveau)

**Interfaces:**
- Consomme : `drag` et `tickets` du store des tickets.
- Produit :

```ts
// components/tickets/status.ts
export const STATUS_SWATCH: Record<TicketStatus, string>   // { todo: 'bg-paper', doing: 'bg-blue', done: 'bg-emerald' }
```

Emplacement « Déposer ici » (`data-testid="drop-slot"`) dans chaque colonne autre que celle d'origine, pendant un glisser seulement.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/unit/components/tickets/TicketColumn.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import { TicketColumn } from '@/components/tickets/TicketColumn'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

const a = makeTicket({ id: 'a', number: 1, title: 'Alpha', status: 'todo' })

beforeEach(() => {
  act(() => {
    useTicketsStore.getState().hydrate({ projectId: 'p1', projectName: 'P', myRole: 'editor', members: [], tasks: [], tickets: [a] })
  })
})

describe('TicketColumn', () => {
  it('un en-tête : pastille de statut, nom, compte — et pas de cadre autour de la colonne', () => {
    render(<TicketColumn status="done" tickets={[]} onCardPointerDown={() => {}} />)
    const column = screen.getByRole('region', { name: 'Terminé' })
    expect(column).not.toHaveClass('border-[3px]')
    expect(screen.getByRole('heading', { name: 'Terminé' })).toBeInTheDocument()
    expect(screen.getByTestId('status-swatch')).toHaveClass('bg-emerald')
    expect(screen.getByText('0')).toHaveClass('font-mono')
  })

  it('hors glisser, aucun emplacement de dépôt', () => {
    render(<TicketColumn status="done" tickets={[]} onCardPointerDown={() => {}} />)
    expect(screen.queryByTestId('drop-slot')).not.toBeInTheDocument()
    expect(screen.getByText('Vide')).toBeInTheDocument()
  })

  it('pendant un glisser, les AUTRES colonnes offrent « Déposer ici », jaune quand on les survole', () => {
    render(<TicketColumn status="done" tickets={[]} onCardPointerDown={() => {}} />)
    act(() => useTicketsStore.getState().setDrag({ ticketId: 'a', overStatus: 'todo' }))
    const slot = screen.getByTestId('drop-slot')
    expect(slot).toHaveTextContent('Déposer ici')
    expect(slot).not.toHaveClass('bg-yellow')
    act(() => useTicketsStore.getState().setDrag({ ticketId: 'a', overStatus: 'done' }))
    expect(screen.getByTestId('drop-slot')).toHaveClass('bg-yellow')
  })

  it('la colonne d\'origine n\'offre pas d\'emplacement : y déposer ne ferait rien', () => {
    render(<TicketColumn status="todo" tickets={[a]} onCardPointerDown={() => {}} />)
    act(() => useTicketsStore.getState().setDrag({ ticketId: 'a', overStatus: 'todo' }))
    expect(screen.queryByTestId('drop-slot')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/tickets/TicketColumn.test.tsx`
Attendu : ÉCHEC — pas de pastille, colonne encadrée, pas d'emplacement de dépôt.

- [ ] **Step 3: Implémenter**

Créer `components/tickets/status.ts` :

```ts
import type { TicketStatus } from '@/lib/tickets/types'

/**
 * Aplat de chaque statut : pastille de colonne, bande d'accent de la carte et de la fenêtre de
 * ticket. Mêmes teintes que les badges de la liste (`TICKET_STATUS_BADGE`) : un statut garde sa
 * couleur d'une vue à l'autre. Couleurs de DONNÉES, identiques dans les deux thèmes.
 */
export const STATUS_SWATCH: Record<TicketStatus, string> = {
  todo: 'bg-paper',
  doing: 'bg-blue',
  done: 'bg-emerald',
}
```

Remplacer `components/tickets/TicketColumn.tsx` :

```tsx
'use client'
import type { PointerEvent } from 'react'
import { useTicketsStore } from '@/lib/tickets/store'
import { STATUS_LABELS, type Ticket, type TicketStatus } from '@/lib/tickets/types'
import { TicketCard } from './TicketCard'
import { STATUS_SWATCH } from './status'
import { cn } from '@/lib/utils'

/**
 * Une colonne du kanban, sans cadre : un en-tête (pastille, nom, compte, filet) et des cartes.
 * Le grand cadre d'avant mettait trois boîtes autour des cartes, qui sont déjà des boîtes.
 *
 * La SECTION entière reste la cible du dépôt (`data-column-status`, lu par `useTicketDrag`) :
 * sans cadre, la colonne garde au moins la hauteur d'une carte pour rester visable.
 */
export function TicketColumn({ status, tickets, onCardPointerDown }: {
  status: TicketStatus
  tickets: Ticket[]
  onCardPointerDown: (e: PointerEvent, ticketId: string) => void
}) {
  // Statut d'ORIGINE de la carte en vol : déposer dans sa propre colonne ne fait rien, on n'y
  // offre donc pas d'emplacement.
  const dragFrom = useTicketsStore((s) => (s.drag ? (s.tickets[s.drag.ticketId]?.status ?? null) : null))
  const hovered = useTicketsStore((s) => s.drag !== null && s.drag.overStatus === status)
  const showSlot = dragFrom !== null && dragFrom !== status

  return (
    <section data-column-status={status} aria-label={STATUS_LABELS[status]} className="flex flex-col gap-3">
      <header className="flex items-center gap-2 border-b-[3px] border-ink pb-2">
        <span aria-hidden data-testid="status-swatch" className={cn('size-3 shrink-0 border-2 border-ink', STATUS_SWATCH[status])} />
        <h2 className="font-display text-sm uppercase">{STATUS_LABELS[status]}</h2>
        <span className="ml-auto font-mono text-xs text-ink-soft">{tickets.length}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-3">
        {tickets.map((t) => <TicketCard key={t.id} ticket={t} onPointerDown={onCardPointerDown} />)}
        {tickets.length === 0 && !showSlot && <p className="p-2 text-xs text-ink-soft">Vide</p>}
        {showSlot && (
          // Rien hors glisser : un emplacement permanent serait du décor qui ne dit rien.
          <div
            data-testid="drop-slot"
            className={cn(
              'flex h-16 items-center justify-center border-[3px] border-dashed text-sm',
              hovered ? 'border-ink bg-yellow text-on-data' : 'border-ink/40 text-ink-soft',
            )}
          >
            Déposer ici
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/tickets`
Attendu : PASS. `TicketBoard.test` (« rend les trois colonnes… », « un geste annulé… ») reste vert : la section garde `data-column-status`, son nom, et le compte.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Lancer le parcours du glisser**

Run: `npx playwright test tests/e2e/tickets.spec.ts`
Attendu : PASS. « créer un ticket, le déplacer à la souris… » vise le CENTRE de la région « Terminé » ; la section s'étire à la hauteur de la plus haute colonne de la grille, le centre reste donc dans la cible.

- [ ] **Step 6: Commit**

```bash
git add components/tickets/status.ts components/tickets/TicketColumn.tsx tests/unit/components/tickets/TicketColumn.test.tsx
git commit -m "feat(tickets): colonnes sans cadre et emplacement de dépôt pendant le glisser" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 14: Carte de ticket à accent de statut, et fenêtre assortie

**Files:**
- Modify: `components/tickets/TicketCard.tsx` (réécriture)
- Modify: `components/ui/Dialog.tsx` (prop `accentClassName`)
- Modify: `components/tickets/TicketEditor.tsx`
- Test: `tests/unit/components/tickets/TicketCard.test.tsx` (nouveau), `tests/unit/components/tickets/TicketEditorAccent.test.tsx` (nouveau)

**Interfaces:**
- Consomme : `Menu` (tâche 2), `STATUS_SWATCH` (tâche 13), `getTicketCommands().updateTicket / deleteTicket`.
- Produit : `DialogProps` gagne `accentClassName?: string` (bande de 7 px à gauche du titre, `data-testid="dialog-accent"`). Carte : menu `Actions du ticket #N` avec « Modifier », intitulé « Déplacer vers… », les deux autres statuts, « Supprimer ».

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/unit/components/tickets/TicketCard.test.tsx` :

```tsx
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketCard } from '@/components/tickets/TicketCard'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

const updateTicket = vi.fn().mockResolvedValue(true)
const deleteTicket = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/tickets/client-commands', () => ({
  getTicketCommands: () => ({ createTicket: vi.fn(), updateTicket, deleteTicket }),
}))

const todo = makeTicket({ id: 'a', number: 1, title: 'Alpha', status: 'todo', taskId: 'k1' })
const done = makeTicket({ id: 'b', number: 2, title: 'Beta', status: 'done', taskId: null })

function hydrate(myRole: 'editor' | 'viewer' = 'editor') {
  act(() => {
    useTicketsStore.getState().hydrate({
      projectId: 'p1', projectName: 'P', myRole, members: [], tasks: [{ id: 'k1', title: 'Développement' }], tickets: [todo, done],
    })
  })
}

beforeEach(() => { updateTicket.mockClear(); deleteTicket.mockClear() })

describe('TicketCard', () => {
  it('porte une bande d\'accent dans la couleur de son statut', () => {
    hydrate()
    render(<TicketCard ticket={{ ...todo, status: 'doing' }} onPointerDown={() => {}} />)
    expect(screen.getByTestId('status-accent')).toHaveClass('bg-blue')
  })

  it('une carte terminée recule à 75 % ; une carte sans tâche le dit', () => {
    hydrate()
    render(<TicketCard ticket={done} onPointerDown={() => {}} />)
    expect(screen.getByRole('article', { name: '#2 Beta' })).toHaveClass('opacity-75')
    expect(screen.getByText('Sans tâche')).toBeInTheDocument()
  })

  it('la tâche liée est une puce « ↳ titre »', () => {
    hydrate()
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    expect(screen.getByText('↳ Développement')).toHaveClass('font-mono')
  })

  it('le ⋯ propose Modifier, les deux AUTRES statuts, et Supprimer', async () => {
    hydrate()
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Actions du ticket #1' }))
    const menu = screen.getByRole('menu', { name: 'Actions du ticket #1' })
    expect(within(menu).getAllByRole('menuitem').map((el) => el.textContent)).toEqual(['Modifier', 'En cours', 'Terminé', 'Supprimer'])
    expect(menu).toHaveTextContent('Déplacer vers…')
  })

  it('« Déplacer vers… Terminé » écrit le statut', async () => {
    hydrate()
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Actions du ticket #1' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Terminé' }))
    expect(updateTicket).toHaveBeenCalledWith('a', { status: 'done' })
  })

  it('« Supprimer » demande confirmation avant de supprimer', async () => {
    hydrate()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Actions du ticket #1' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(confirm).toHaveBeenCalledWith('Supprimer le ticket #1 « Alpha » ?')
    expect(deleteTicket).toHaveBeenCalledWith('a')
    confirm.mockRestore()
  })

  // Review Focus 1 : le menu vit sur une carte qu'on glisse et qu'on double-clique.
  it('ouvrir le menu et y choisir n\'arme pas le glisser et n\'ouvre pas l\'éditeur', async () => {
    hydrate()
    const onPointerDown = vi.fn()
    render(<TicketCard ticket={todo} onPointerDown={onPointerDown} />)
    const trigger = screen.getByRole('button', { name: 'Actions du ticket #1' })
    await userEvent.dblClick(trigger)
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('menuitem', { name: 'En cours' }))
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(useTicketsStore.getState().editor).toBeNull()
  })

  it('un lecteur n\'a ni flèches ni menu', () => {
    hydrate('viewer')
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    expect(screen.queryByRole('button', { name: /Actions du ticket/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Déplacer vers/ })).not.toBeInTheDocument()
  })
})
```

Créer `tests/unit/components/tickets/TicketEditorAccent.test.tsx` :

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketEditor } from '@/components/tickets/TicketEditor'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

vi.mock('@/lib/tickets/client-commands', () => ({
  getTicketCommands: () => ({ createTicket: vi.fn(), updateTicket: vi.fn(), deleteTicket: vi.fn() }),
}))

describe('TicketEditor : bande de statut', () => {
  it('le bandeau de titre porte la couleur du statut, et la suit quand on le change', async () => {
    act(() => {
      useTicketsStore.getState().hydrate({
        projectId: 'p1', projectName: 'P', myRole: 'editor', members: [], tasks: [],
        tickets: [makeTicket({ id: 'a', number: 3, status: 'doing' })],
      })
      useTicketsStore.getState().openEditor({ mode: 'edit', ticketId: 'a' })
    })
    render(<TicketEditor />)
    expect(screen.getByRole('dialog', { name: 'Ticket #3' })).toBeInTheDocument()
    expect(screen.getByTestId('dialog-accent')).toHaveClass('bg-blue')
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'done')
    expect(screen.getByTestId('dialog-accent')).toHaveClass('bg-emerald')
    // Un seul bouton noir dans la fenêtre : « Enregistrer ». « Supprimer » est sobre au repos.
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveClass('text-danger')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toHaveClass('bg-ink')
  })
})
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/tickets/TicketCard.test.tsx tests/unit/components/tickets/TicketEditorAccent.test.tsx`
Attendu : ÉCHEC — ni bande d'accent, ni menu, ni `dialog-accent`.

- [ ] **Step 3: Implémenter**

Dans `components/ui/Dialog.tsx` :
- ajouter `import { cn } from '@/lib/utils'` ;
- dans `DialogProps`, ajouter :

```tsx
  /**
   * Classe d'aplat d'une bande de 7 px à gauche du titre. La fenêtre d'un ticket y reprend la
   * couleur de son statut, comme la carte d'où elle s'ouvre : on reconnaît l'objet qu'on édite.
   */
  accentClassName?: string
```

- ajouter `accentClassName` à la déstructuration des props de `Dialog` ;
- remplacer le `<header>` :

```tsx
        <header className="flex shrink-0 items-center justify-between border-b-[3px] border-ink px-5 py-3 bg-cream">
          <h2 id={titleId} className="text-xl">{title}</h2>
          <Button variant="quiet" size="sm" onClick={onClose} aria-label="Fermer">✕</Button>
        </header>
```

par :

```tsx
        <header className="flex shrink-0 items-stretch justify-between border-b-[3px] border-ink px-5 py-3 bg-cream">
          <div className="flex min-w-0 items-center gap-3">
            {/* Marges négatives : la bande court du haut au bas du bandeau, padding compris. */}
            {accentClassName && (
              <span aria-hidden data-testid="dialog-accent" className={cn('-my-3 -ml-5 w-[7px] shrink-0 self-stretch border-r-[3px] border-ink', accentClassName)} />
            )}
            <h2 id={titleId} className="text-xl">{title}</h2>
          </div>
          <Button variant="quiet" size="sm" className="self-center" onClick={onClose} aria-label="Fermer">✕</Button>
        </header>
```

Dans `components/tickets/TicketEditor.tsx` :
- ajouter `import { STATUS_SWATCH } from './status'` ;
- dans `TicketEditorForm`, sur le `<Dialog`, ajouter la prop `accentClassName={STATUS_SWATCH[status]}` (le `status` de l'état du formulaire : la bande suit le sélecteur avant même l'enregistrement).

Remplacer `components/tickets/TicketCard.tsx` :

```tsx
'use client'
import type { PointerEvent } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { getTicketCommands } from '@/lib/tickets/client-commands'
import { STATUS_LABELS, STATUS_ORDER, type Ticket, type TicketStatus } from '@/lib/tickets/types'
import { Avatar } from '@/components/ui/Avatar'
import { Menu, type MenuEntry } from '@/components/ui/Menu'
import { STATUS_SWATCH } from './status'
import { cn } from '@/lib/utils'

/** Flèches de statut : commandes d'objet, niveau 3 — elles ne réclament rien au repos. */
const ARROW = 'size-6 font-mono text-xs leading-none text-ink-soft hover:bg-yellow hover:text-on-data brutal-focus'

export function TicketCard({ ticket, onPointerDown }: {
  ticket: Ticket
  onPointerDown: (e: PointerEvent, ticketId: string) => void
}) {
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)
  const dragging = useTicketsStore((s) => s.drag?.ticketId === ticket.id)
  const assignee = useTicketsStore((s) => s.members.find((m) => m.userId === ticket.assigneeId))
  const taskTitle = useTicketsStore((s) => s.tasks.find((t) => t.id === ticket.taskId)?.title)

  const index = STATUS_ORDER.indexOf(ticket.status)
  const previous = STATUS_ORDER[index - 1]
  const next = STATUS_ORDER[index + 1]

  function move(to: TicketStatus) {
    void getTicketCommands().updateTicket(ticket.id, { status: to })
  }

  function remove() {
    if (!window.confirm(`Supprimer le ticket #${ticket.number} « ${ticket.title} » ?`)) return
    void getTicketCommands().deleteTicket(ticket.id)
  }

  const entries: MenuEntry[] = [
    { id: 'edit', label: 'Modifier', onSelect: () => openEditor({ mode: 'edit', ticketId: ticket.id }) },
    { kind: 'heading', id: 'move', label: 'Déplacer vers…' },
    ...STATUS_ORDER.filter((s) => s !== ticket.status).map((s) => ({ id: `move-${s}`, label: STATUS_LABELS[s], onSelect: () => move(s) })),
    { id: 'delete', label: 'Supprimer', danger: true, onSelect: remove },
  ]

  return (
    <article
      data-ticket-id={ticket.id}
      aria-label={`#${ticket.number} ${ticket.title}`}
      onPointerDown={(e) => onPointerDown(e, ticket.id)}
      // Double-clic, comme les barres du Gantt : la carte capture le pointeur pendant le glisser,
      // si bien que chaque dépôt produirait aussi un clic simple qui ouvrirait la modale.
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', ticketId: ticket.id })}
      className={cn(
        // Surface posée : ombre brutale de 3 px (spec §7). `touch-none` réservé aux éditeurs, et
        // seulement dès md : sous ce seuil les colonnes s'empilent, la carte couvrirait presque
        // tout l'écran et empêcherait de faire défiler au doigt.
        'group/card flex border-[3px] border-ink bg-paper shadow-[3px_3px_0_var(--color-ink)] select-none',
        canEdit && 'cursor-grab active:cursor-grabbing md:touch-none',
        // Terminé : la carte recule, le travail restant passe devant.
        ticket.status === 'done' && 'opacity-75',
        // La carte en vol s'efface : c'est l'emplacement de dépôt qui dit où elle va tomber.
        dragging && 'opacity-40',
      )}
    >
      {/* L'accent de statut : la couleur se lit avant le texte, même colonne repliée. */}
      <span aria-hidden data-testid="status-accent" className={cn('w-[7px] shrink-0 border-r-[3px] border-ink', STATUS_SWATCH[ticket.status])} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex h-7 items-center gap-1">
          <span className="font-mono text-xs text-ink-soft">#{ticket.number}</span>
          {canEdit && (
            // Révélées au survol, au focus, menu ouvert, et toujours au doigt. Les flèches sont
            // l'équivalent ACCESSIBLE du glisser : sans elles, changer un statut serait impossible
            // au clavier. `onDoubleClick` arrêté : deux clics rapides ne doivent pas ouvrir l'éditeur.
            <div
              className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 touch:opacity-100 has-[[aria-expanded=true]]:opacity-100"
              onDoubleClick={(e) => e.stopPropagation()}
            >
              {previous && (
                <button
                  type="button"
                  aria-label={`Déplacer vers ${STATUS_LABELS[previous]}`}
                  className={ARROW}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); move(previous) }}
                >
                  ←
                </button>
              )}
              {next && (
                <button
                  type="button"
                  aria-label={`Déplacer vers ${STATUS_LABELS[next]}`}
                  className={ARROW}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); move(next) }}
                >
                  →
                </button>
              )}
              <Menu label={`Actions du ticket #${ticket.number}`} entries={entries} />
            </div>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-bold leading-snug">{ticket.title}</p>
        <div className="flex items-center gap-2">
          {taskTitle
            ? <span className="min-w-0 truncate border border-ink/40 px-1 font-mono text-xs">↳ {taskTitle}</span>
            : <span className="text-xs text-ink-soft">Sans tâche</span>}
          {assignee && (
            <span className="ml-auto shrink-0">
              <Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/tickets tests/unit/components/ui`
Attendu : PASS. `TicketBoard.test` (« range chaque ticket… montre sa tâche liée ») trouve toujours `↳ Développement`.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Lancer les parcours touchés**

Run: `npx playwright test tests/e2e/tickets.spec.ts`
Attendu : PASS. Le parcours clavier clique `card.getByRole('button', { name: 'Déplacer vers En cours' })` : les flèches gardent leurs noms.

- [ ] **Step 6: Commit**

```bash
git add components/tickets/TicketCard.tsx components/tickets/TicketEditor.tsx components/ui/Dialog.tsx tests/unit/components/tickets/TicketCard.test.tsx tests/unit/components/tickets/TicketEditorAccent.test.tsx
git commit -m "feat(tickets): carte à accent de statut, menu ⋯ et fenêtre assortie" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

# Lot 6 — Vocabulaire, téléphone, passe finale

## Task 15: Vocabulaire résiduel et téléphone

**Files:**
- Modify: `components/gantt/TaskEditor.tsx` (lien « + Nouveau ticket »)
- Modify: `app/invite/[token]/InviteError.tsx` (lien « Aller à mes projets »)
- Modify (e2e): `tests/e2e/mobile.spec.ts`

**Interfaces:**
- Consomme : tout ce qui précède. Ne produit rien de nouveau.

- [ ] **Step 1: Écrire les parcours téléphone**

Dans `tests/e2e/mobile.spec.ts`, changer l'import en `import { loginAs, TICKETS_PROJECT } from './helpers'` et ajouter à la fin :

```ts
test('l\'en-tête de projet passe sur deux rangées, même avec un nom de 100 caractères', async ({ page }) => {
  await loginAs(page, 'alice')
  // Review Focus 2 : le nom le plus long qu'accepte la validation.
  const name = `Projet au nom interminable ${Date.now()} `.padEnd(100, 'x')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const header = page.getByRole('banner')
  const tabs = header.getByRole('navigation', { name: 'Sections du projet' })
  await expect(tabs.getByRole('link', { name: 'Membres' })).toBeInViewport()
  await expect(header.getByRole('button', { name: 'Menu du compte' })).toBeInViewport()
  // Le fil d'Ariane se réduit au nom : le lien « Projets » est masqué, le signe en tient lieu.
  await expect(header.getByRole('link', { name: 'Projets', exact: true })).toBeHidden()

  // Deux rangées : les onglets passent SOUS le nom du projet.
  const title = (await header.getByRole('heading').boundingBox())!
  const tabsBox = (await tabs.boundingBox())!
  expect(tabsBox.y).toBeGreaterThanOrEqual(title.y + title.height)
})

test('les pages Tickets et Membres tiennent dans la largeur du téléphone', async ({ page }) => {
  await loginAs(page, 'alice')
  // Lecture seule : « Projet tickets » et la page Membres du démo ne font que s'afficher.
  for (const path of [
    `/projects/${TICKETS_PROJECT.id}/tickets`,
    `/projects/${TICKETS_PROJECT.id}/tickets?vue=liste`,
    `${DEMO}/membres`,
  ]) {
    await page.goto(path)
    await expect(page.getByRole('banner')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390)
  }
  // Sur téléphone, les filtres sont derrière un bouton : les trois sélecteurs n'élargissent rien.
  await page.goto(`/projects/${TICKETS_PROJECT.id}/tickets`)
  await page.getByRole('button', { name: 'Filtres' }).click()
  await expect(page.getByRole('dialog', { name: 'Filtres' }).getByLabel('Statut')).toBeVisible()
})
```

- [ ] **Step 2: Lancer les parcours**

Run: `npx playwright test tests/e2e/mobile.spec.ts`
Attendu : PASS. Ces tests VERROUILLENT ce que les tâches 4, 7 et 12 ont construit (deux rangées, synthèse repliable, filtres repliés) ; s'ils échouent, c'est l'une de ces tâches qu'il faut reprendre, pas le test. Cas typique : un `min-w-0` manquant sur le fil d'Ariane, et le nom long pousse la page au-delà de 390 px.

- [ ] **Step 3: Vocabulaire et casse résiduels**

Dans `components/gantt/TaskEditor.tsx`, sur le lien « + Nouveau ticket », remplacer :

```tsx
              className="inline-block font-bold uppercase text-sm underline brutal-focus"
```

par :

```tsx
              className="inline-block text-sm font-bold underline-offset-4 hover:underline brutal-focus"
```

Dans `app/invite/[token]/InviteError.tsx`, remplacer :

```tsx
            <Link href="/projects" className="inline-flex bg-paper brutal brutal-press px-5 py-2 font-bold uppercase brutal-focus">Aller à mes projets</Link>
```

par :

```tsx
            {/* Seule issue de l'écran : c'en est l'action principale (niveau 1). */}
            <Link href="/projects" className="inline-flex bg-ink text-cream brutal brutal-press px-5 py-2 font-bold brutal-focus">Aller à mes projets</Link>
```

Puis l'audit — chaque commande et ce qu'elle doit rendre :

Run: `grep -rnE "\{(member|project|i|m)\.role\}|\{myRole\}" components app`
Attendu : aucune ligne. Un rôle brut affiché à l'écran serait le dernier mot anglais de l'interface.

Run: `grep -rn "Frise" components app --include=*.tsx`
Attendu : seulement des commentaires (aucun texte rendu).

Run: `grep -rn "uppercase" components app --include=*.tsx`
Attendu : seulement des titres et en-têtes — `TimelineHeader`, `ProjectLoadError` (titre), `GanttView` (« Tâches », en-tête de colonne), `SidebarRow` (titre de groupe), `TaskEditor` (`legend` « Couleur », `h3` « Tickets »), `EmptyProject`, `NoProjects`, `app/(auth)/login/page.tsx`, `GanttPreview`, `TicketList` (`th`), `TicketColumn` (`h2`), `ProjectCard` (titre). Tout bouton, lien, badge ou libellé de champ trouvé là est à passer en casse mixte.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 4: Commit**

```bash
git add components/gantt/TaskEditor.tsx "app/invite/[token]/InviteError.tsx" tests/e2e/mobile.spec.ts
git commit -m "test(mobile): en-tête sur deux rangées, pages Tickets et Membres ; casse résiduelle" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 16: Passe e2e complète et README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consomme : tout le lot. Ne produit rien de nouveau.

- [ ] **Step 1: Mettre le README à jour**

Dans `README.md`, section « Tickets », remplacer le paragraphe :

```markdown
La fonctionnalité est **désactivée par défaut**. Le propriétaire l'active depuis le bouton
« Tickets » de la carte du projet, sur `/projects`. La désactiver masque les tickets sans en
supprimer aucun : les réactiver les rend tels quels.

Une fois activés, la barre d'outils de la frise porte un lien « Tickets » vers
`/projects/<id>/tickets`, qui s'ouvre sur un kanban à trois colonnes (`?vue=liste` pour la vue
tableau filtrable). Les lignes de la frise affichent alors un compteur « terminés / total », et
l'éditeur d'une tâche liste ses tickets.
```

par :

```markdown
La fonctionnalité est **désactivée par défaut**. Le propriétaire l'active depuis le menu « ⋯ »
du projet — sur sa carte dans `/projects`, ou à côté de son nom dans l'en-tête. La désactiver
masque les tickets sans en supprimer aucun : les réactiver les rend tels quels.

Une fois activés, l'en-tête du projet porte un onglet « Tickets » vers `/projects/<id>/tickets`,
qui s'ouvre sur un kanban à trois colonnes (`?vue=liste` pour la vue tableau). Les filtres de la
barre d'outils (statut, assigné, tâche) valent pour les deux vues. Les lignes du Gantt affichent
un badge « ⌗ terminés/total », et l'éditeur d'une tâche liste ses tickets.
```

Section « Thème sombre », remplacer la première phrase :

```markdown
La bascule est dans l'en-tête (et en haut à droite de la page de connexion). Un choix explicite
```

par :

```markdown
La bascule est dans le menu du compte (l'avatar, en haut à droite de l'en-tête) et en haut à
droite de la page de connexion. Un choix explicite
```

Section « Membres et invitations », remplacer le premier paragraphe :

```markdown
Le propriétaire d'un projet ouvre le dialog **Membres** (la pile d'avatars dans la barre du
projet) pour inviter, changer un rôle (`editor` / `viewer`) ou retirer quelqu'un. La ligne
`owner` est intouchable : pas de transfert de propriété dans cette version.
```

par :

```markdown
L'onglet **Membres** de l'en-tête du projet (`/projects/<id>/membres`) liste l'équipe. Le
propriétaire y invite, change un rôle (Éditeur / Lecteur) ou retire quelqu'un. La ligne du
propriétaire est intouchable : pas de transfert de propriété dans cette version.
```

Ajouter, juste avant la section « Tickets », une section :

```markdown
## Navigation

L'en-tête noir change selon le contexte. Sur `/projects`, il porte la marque et le menu du
compte. Dans un projet, il porte le fil d'Ariane « Projets / Nom », les onglets **Gantt**,
**Tickets** et **Membres**, la pile d'avatars et le menu du compte ; le propriétaire a un menu
« ⋯ » à côté du nom (renommer, activer ou désactiver les tickets, supprimer). Côté code, les
deux en-têtes vivent dans deux groupes de routes : `app/(app)/(accueil)` et `app/(app)/(projet)`.

Chaque écran n'a qu'une action principale (fond noir) ; les commandes secondaires ont une
bordure sans ombre, les commandes d'objet sont du texte révélé au survol. Sur `/projects`,
« N en retard » filtre la liste (`?filtre=retard`) ; dans le Gantt, le même chiffre en pied de
page met les barres en retard en évidence (Échap pour l'éteindre).
```

- [ ] **Step 2: Lancer toutes les vérifications**

Run: `npm test`
Attendu : PASS.

Run: `npm run typecheck && npm run lint`
Attendu : aucune erreur.

Run: `npm run test:db`
Attendu : PASS (aucune migration dans ce lot : c'est un contrôle de non-régression).

Run: `npm run test:e2e`
Attendu : PASS, à l'exception des trois échecs environnementaux connus (gantt-drag « un lecteur ne peut pas déplacer une barre », gantt-view « la vue s'ouvre recentrée sur aujourd'hui », projects « chaque carte porte sa vignette »). Tout autre échec est un défaut du lot : le corriger dans la tâche qui en est responsable (nouveau commit), jamais en affaiblissant un test.

- [ ] **Step 3: Contrôle visuel rapide**

Avec le serveur de dev sur 3100, ouvrir dans un navigateur : `/projects`, le Gantt du projet démo, `/projects/<id>/tickets` de « Projet tickets », `/projects/<id>/membres`, chacun en clair puis en sombre (menu du compte), puis à 390 px de large. Sur chaque écran, vérifier qu'un seul bouton noir est visible (spec §3), que l'onglet courant est souligné de jaune, et que rien ne déborde. Ne RIEN écrire dans le projet démo pendant ce contrôle.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: navigation de projet et hiérarchie dans le README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Intégration

Une fois les seize tâches passées, les cinq commandes de vérification au vert (hors échecs environnementaux connus) et l'accord de Léo :

```bash
git checkout master
git merge --ff-only feat/05-hierarchie-navigation
git push origin master
```

Le `--ff-only` est délibéré : ce dépôt intègre en avance rapide, sans demande de fusion. Si la fusion est refusée, c'est que `master` a bougé — rebaser `feat/05-hierarchie-navigation` dessus, relancer les vérifications, et recommencer.
