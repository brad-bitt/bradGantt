# BradGantt — Identité éditoriale — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le néo-brutalisme de BradGantt par l'identité éditoriale de la spec (papier chaud, encre graphite, Fraunces + IBM Plex Sans, filets fins, arrondis, ombres réservées à ce qui flotte, or = actif, barres en teinte pâle et liseré), sans changer une seule fonctionnalité ni un parcours.

**Architecture:** Tout part des jetons de `app/globals.css` (Tailwind v4, `@theme`) : on les remplace d'abord, puis on fait suivre chaque composant, des primitives `components/ui/` vers les écrans. Les API des composants ne bougent pas ; seules les classes changent, plus trois utilitaires CSS nouveaux (`focus-ring`, `data-bar`, `data-bar-late`, `data-bar-progress`) et une variante `dark:`. Les tests qui vérifiaient une classe brutaliste sont réécrits vers la règle qu'ils protègent ; deux tests de design lisent les sources et interdisent le retour des capitales, des tailles sous 13 px et des utilitaires supprimés.

**Tech Stack:** Next 15 (App Router, `next/font/google`, `next/og`), React 19, Tailwind CSS v4 (`@theme`, `@custom-variant`, `@layer utilities`), Zustand, Vitest + Testing Library, Playwright, `sharp` (icônes).

**Spec:** `docs/superpowers/specs/2026-10-08-bradgantt-identite-editoriale-design.md`

## Global Constraints

- Branche `feat/06-identite-editoriale` (déjà créée depuis `master`), intégration en avance rapide à la fin, après l'accord de Léo. Jamais de `--amend`, jamais de `--no-verify`, `git add <fichier>` nommé.
- Aucune nouvelle fonctionnalité, aucun changement de données, de RLS ni de migration (spec §2).
- Les API des composants `ui/` ne changent pas : `Button` garde `primary | secondary | quiet | danger | danger-quiet` et `sm | md` ; `Badge` garde ses couleurs, `yellow` devenant `accent` ; `Dialog` garde `accentClassName` ; `Menu` perd seulement `tone` (spec §4).
- Un seul bouton d'encre pleine (`bg-ink`) visible par écran ; une fenêtre ouverte compte comme un écran (spec §4).
- Les commandes d'objet sont révélées par l'**opacité** au survol, jamais par rendu conditionnel (spec §4, tenu par `tests/e2e/gantt-deps.spec.ts`).
- Aucune capitale forcée (`uppercase`) nulle part ; aucune taille arbitraire sous 13 px ; `text-xs` = 13 px, `text-sm` = 14 px, `text-base` = 15 px (spec §3).
- Les utilitaires `brutal`, `brutal-press`, `brutal-focus`, `brutal-focus-field`, `brutal-focus-header`, `shadow-brutal*`, `hatch-data` et les jetons `cream`, `band`, `header`, `on-header`, `on-data`, `yellow` n'existent plus après le lot 1 ; aucun fichier ne doit les référencer à la fin (spec §3, §13).
- L'or (`accent`) ne signifie que « actif » (spec §3).
- Serveur de dev sur le port 3100, lancé en `run_in_background`, jamais tué par motif (`pkill`), relancé après tout `npm run build`.
- Ne JAMAIS écrire dans le projet démo pendant un contrôle visuel : neuf tests e2e en dépendent.
- Les trois échecs e2e environnementaux connus restent tolérés : gantt-drag « un lecteur ne peut pas déplacer une barre », gantt-view « la vue s'ouvre recentrée sur aujourd'hui », projects « chaque carte porte sa vignette ». Tout autre échec est un défaut du lot.
- Messages de commit en français, préfixés (`feat`, `fix`, `test`, `docs`, `refactor`), terminés par `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (ou le modèle qui exécute, s'il diffère).

## Review Focus

Cinq cas que la spec implique sans qu'un test les couvre d'emblée ; chacun reçoit son test dans la tâche qui possède le code.

1. **Thème sombre : l'encre claire sur une barre teintée.** À 45 % de couleur dans une surface sombre, un titre de tâche doit rester lisible. → Task 11 : test de `TaskBar` vérifiant que la barre pose `--bar-color` et la classe `data-bar` (le pourcentage vit dans le CSS, pas dans le composant), et contrôle de contraste manuel dans Task 16.
2. **Un `Badge color="yellow"` oublié.** Le renommage en `accent` casse silencieusement tout appelant non mis à jour (TypeScript le voit, mais pas une chaîne venue d'un `Record`). → Task 3 : grep de `"yellow"` dans `app/` et `components/`, et test `Badge` sur `accent`.
3. **Le menu « ⋯ » ouvert depuis un en-tête papier.** Sans `tone="header"`, le focus doit rester visible sur papier. → Task 6 : test `Menu` vérifiant la classe `focus-ring` sur le déclencheur.
4. **La ligne sélectionnée du Gantt et l'emplacement de dépôt du kanban.** Ils étaient en jaune plein ; un e2e (`context-menu.spec.ts`) et un unitaire (`TicketColumn.test.tsx`) les attendent. → Task 12 et Task 14 : assertions réécrites vers `bg-accent-soft`.
5. **La fenêtre modale sur un téléphone.** Elle vient du bas, pleine largeur ; son pied doit encore passer à la ligne (régression corrigée au lot 05). → Task 6 : test `Dialog` vérifiant `flex-wrap` sur le pied et `items-end sm:items-center` sur le voile.

---

## Carte des fichiers

| Fichier | Responsabilité après ce lot | Tâche |
| --- | --- | --- |
| `app/globals.css` | Jetons (structure, état, données, fontes, échelle, rayons, ombres), variante `dark`, utilitaires `focus-ring`, `hatch`, `day-tick`, `data-bar*` | 1 |
| `app/layout.tsx` | Fontes Fraunces, IBM Plex Sans, JetBrains Mono ; description sans « brutalement » | 1 |
| `lib/gantt/geometry.ts` | `ROW_HEIGHT` 48, `BAR_INSET` 10, `BAR_BORDER_PX` 1 | 1 |
| `tests/unit/design/tokens.test.ts` | Garde-fou : les jetons attendus existent, les anciens n'existent plus | 1 |
| `components/ui/Button.tsx` | Cinq variantes, deux tailles, `focus-ring` | 2 |
| `components/ui/Badge.tsx` | Pastille ; `accent` remplace `yellow` | 3 |
| `components/ui/Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Checkbox.tsx` | Champs à filet, 40 px, `focus-ring` | 4 |
| `components/ui/Avatar.tsx`, `Toast.tsx` | Rond ; toast en encre pleine | 5 |
| `components/ui/Dialog.tsx`, `Menu.tsx`, `components/project/ProjectMenu.tsx` | Couches flottantes ; `tone` supprimé | 6 |
| `components/layout/AppHeader.tsx`, `ProjectHeader.tsx`, `ProjectTabs.tsx`, `UserMenu.tsx`, `ThemeToggle.tsx` | Bandeau papier, onglets soulignés d'or | 7 |
| `components/layout/Logo.tsx`, `app/icon.svg`, `app/apple-icon.png`, `app/favicon.ico`, `app/opengraph-image.tsx` | Marque | 8 |
| `app/(auth)/login/page.tsx`, `LoginForm.tsx`, `app/invite/[token]/InviteError.tsx`, `lib/invitations/emails.ts` | Connexion, invitation, courriels | 9 |
| `components/project/ProjectCard.tsx`, `ProjectsSummaryLine.tsx`, `NoProjects.tsx`, `InviteForm.tsx`, `MiniGantt.tsx`, `components/layout/GanttPreview.tsx` | Mes projets et vignettes | 10 |
| `components/gantt/TaskBar.tsx` | Barre teinte + liseré + trait d'avancement | 11 |
| `components/gantt/TimelineGrid.tsx`, `TimelineHeader.tsx`, `Sidebar.tsx`, `SidebarRow.tsx`, `GroupBar.tsx`, `MilestoneMark.tsx`, `DependencyArrows.tsx`, `GanttView.tsx` | Grille, en-tête de frise, barre latérale, groupes, jalons, flèches | 12 |
| `components/gantt/GanttToolbar.tsx`, `ZoomControls.tsx`, `GanttSummary.tsx`, `ContextMenu.tsx`, `TaskEditor.tsx`, `EmptyProject.tsx`, `ProjectLoadError.tsx`, `RotateHint.tsx` | Barre d'outils, pied, menu contextuel, éditeur, états | 13 |
| `components/tickets/status.ts`, `TicketCard.tsx`, `TicketColumn.tsx`, `TicketList.tsx`, `TicketsToolbar.tsx`, `TicketEditor.tsx`, `TicketsDisabled.tsx` | Tickets | 14 |
| `components/members/MembersPage.tsx` | Membres | 15 |
| `tests/unit/design/typography.test.ts`, `README.md` | Garde-fou typographique, documentation | 16 |

## Décisions prises là où la spec laisse un détail ouvert

- **La trame de points du fond** (`body { background-image: radial-gradient(...) }`) disparaît : c'était un décor brutaliste, le papier éditorial est uni.
- **Le slogan « brutalement simples »** (métadonnées, page de connexion, image OpenGraph, `alt`) devient « Des Gantt partagés, simplement. » : garder le mot « brutalement » après avoir quitté le brutalisme serait un contresens. Léo peut le changer en un seul endroit par fichier.
- **Le texte sur `danger` plein et sur un avatar coloré** est fixe (`text-white` sur le rouge, `text-black/80` sur un avatar) : ce sont les deux seuls aplats dont le fond ne suit pas le thème.
- **Les rouges du thème sombre** restent éclaircis comme aujourd'hui (`today #FF5C52`, `danger #E8604C`) : `#C8321F` sur `#1C1915` ne passe pas 4,5:1 en texte.
- **La case à cocher** redevient native (`accent-color: var(--color-ink)`) au lieu d'un `appearance-none` à redessiner : la coche est garantie lisible dans les deux thèmes, et le navigateur rend déjà un carré arrondi à filet.
- **La teinte des barres** vit dans un utilitaire CSS (`.data-bar`) qui lit `--bar-color` et `--data-tint` ; le composant ne pose que la variable. Le thème sombre change `--data-tint`, pas le composant.
- **Les traits de lundi** passent en `ink-soft` à 50 %, les jours en `line` : la hiérarchie jour / semaine reste, en plus doux.
- **La colonne du jour** était déjà teintée (`bg-today/10`) ; elle passe en `accent-soft` comme le dit la spec, le trait rouge reste le repère.

---

# Lot 1 — Jetons

### Task 1: Jetons, fontes, géométrie et le test des jetons

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `lib/gantt/geometry.ts:7-10, 52`
- Create: `tests/unit/design/tokens.test.ts`

**Interfaces:**
- Produit : les classes Tailwind `bg-paper`, `bg-surface`, `text-ink`, `text-ink-soft`, `border-line`, `bg-accent`, `bg-accent-soft`, `text-danger`, `bg-today`, `rounded-dialog`, `rounded-card`, `rounded-control`, `rounded-bar`, `shadow-float`, `shadow-dialog`, `font-display`, `font-ui`, `font-mono`, la variante `dark:`, les utilitaires `focus-ring`, `hatch`, `day-tick`, `data-bar`, `data-bar-late`, `data-bar-progress`, les variables CSS `--bar-color` (posée par le composant) et `--data-tint` (32 % / 45 %). Toutes les tâches suivantes en dépendent.
- Produit : `ROW_HEIGHT = 48`, `BAR_INSET = 10`, `BAR_BORDER_PX = 1`.

- [ ] **Step 1: Écrire le test des jetons qui échoue**

Créer `tests/unit/design/tokens.test.ts` :

```ts
import { readFileSync } from 'node:fs'

// Garde-fou de la spec §3 : les jetons de l'identité éditoriale existent, ceux du brutalisme
// n'existent plus. Lu dans le fichier source : Vitest ne compile pas le CSS de Tailwind.
const css = readFileSync('app/globals.css', 'utf8')

describe('jetons de design', () => {
  it('pose les cinq jetons de structure, clair et sombre', () => {
    for (const token of ['--color-paper', '--color-surface', '--color-ink', '--color-ink-soft', '--color-line']) {
      expect(css.match(new RegExp(`${token}:`, 'g'))?.length, token).toBe(2)
    }
  })

  it('pose l’or « actif », sa version voilée, les deux rouges', () => {
    expect(css).toMatch(/--color-accent: #F2C319;/)
    expect(css).toMatch(/--color-accent-soft: color-mix\(in srgb, #F2C319 28%, transparent\);/)
    expect(css).toMatch(/--color-today: #E5342A;/)
    expect(css).toMatch(/--color-danger: #C8321F;/)
  })

  it('garde les huit couleurs de tâches', () => {
    for (const name of ['tangerine', 'rose', 'blue', 'emerald', 'violet', 'cyan', 'lime', 'ochre']) {
      expect(css).toMatch(new RegExp(`--color-${name}: #[0-9A-F]{6};`))
    }
  })

  it('remplace l’échelle Tailwind : rien sous 13 px', () => {
    expect(css).toMatch(/--text-xs: 13px;/)
    expect(css).toMatch(/--text-sm: 14px;/)
    expect(css).toMatch(/--text-base: 15px;/)
  })

  it('pose les rayons, les deux ombres et la teinte des barres', () => {
    for (const token of ['--radius-dialog: 12px', '--radius-card: 10px', '--radius-control: 7px', '--radius-bar: 6px', '--shadow-float:', '--shadow-dialog:', '--data-tint: 32%', '--data-tint: 45%']) {
      expect(css, token).toContain(token)
    }
  })

  it('définit les utilitaires de l’identité et la variante sombre', () => {
    for (const util of ['.focus-ring', '.hatch', '.day-tick', '.data-bar', '.data-bar-late', '.data-bar-progress']) {
      expect(css, util).toContain(`${util} `)
    }
    expect(css).toContain('@custom-variant dark')
  })

  it('ne contient plus rien du brutalisme', () => {
    for (const old of ['--color-cream', '--color-band', '--color-header', '--color-on-header', '--color-on-data', '--color-yellow', 'shadow-brutal', '.brutal', 'hatch-data', 'radial-gradient', 'border-radius: 0', 'uppercase']) {
      expect(css, old).not.toContain(old)
    }
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/design/tokens.test.ts`
Attendu : FAIL (« --color-surface » absent, `shadow-brutal` présent…).

- [ ] **Step 3: Réécrire `app/globals.css`**

Remplacer tout le fichier par :

```css
@import "tailwindcss";

/* Palette organisée par REGISTRE : une signification par couleur (spec §3).
   STRUCTURE (papier, surface, encre, encre douce, filet) : le décor, qui s'inverse la nuit.
   ÉTAT (accent) : l'or, et rien d'autre — actif, sélectionné, jour courant.
   REPÈRES (today, danger) : les deux rouges.
   DONNÉES (huit teintes) : les tâches, portées en teinte pâle et liseré, jamais en aplat.

   Les couleurs, ombres et rayons sont dans un `@theme` NON inline : les utilitaires générés
   (`bg-ink`, `shadow-float`…) référencent `var(--color-…)`, ce qui permet au thème sombre de les
   redéfinir plus bas d'un seul bloc. Les polices restent en `inline` : elles renvoient aux
   variables de next/font posées sur <html>. */
@theme {
  /* Structure */
  --color-paper: #F6F3EC;
  --color-surface: #FBF9F4;
  --color-ink: #2A2622;
  --color-ink-soft: #746D62;
  --color-line: #DED7C8;

  /* État — l'or : actif, et rien d'autre */
  --color-accent: #F2C319;
  --color-accent-soft: color-mix(in srgb, #F2C319 28%, transparent);

  /* Repères */
  --color-today: #E5342A;
  --color-danger: #C8321F;

  /* Données — couleurs de tâches, identiques dans les deux thèmes. Elles ne sont plus posées en
     aplat : une barre les porte en teinte pâle (`.data-bar`) et en liseré, le texte dessus est
     l'encre du thème. */
  --color-tangerine: #FF8A3D;
  --color-rose: #FF6FA3;
  --color-blue: #5B9DFF;
  --color-emerald: #3ECF8E;
  --color-violet: #A78BFA;
  --color-cyan: #34D3E0;
  --color-lime: #B4E45C;
  --color-ochre: #E9B44C;

  /* Échelle « aérée » (spec §3) : elle REMPLACE les tailles Tailwind, pour que les classes
     existantes restent valables et que rien ne puisse descendre sous 13 px. */
  --text-xs: 13px;
  --text-xs--line-height: 1.4;
  --text-sm: 14px;
  --text-sm--line-height: 1.5;
  --text-base: 15px;
  --text-base--line-height: 1.55;

  /* Rayons */
  --radius-dialog: 12px;
  --radius-card: 10px;
  --radius-control: 7px;
  --radius-bar: 6px;

  /* Ombres : seulement sur ce qui flotte. En encre, donc elles suivent le thème. */
  --shadow-float: 0 8px 24px color-mix(in srgb, var(--color-ink) 14%, transparent), 0 2px 6px color-mix(in srgb, var(--color-ink) 8%, transparent);
  --shadow-dialog: 0 24px 60px color-mix(in srgb, var(--color-ink) 22%, transparent);
}

/* Variante « toucher » : un appareil sans survol. Les commandes révélées au survol (poignées,
   boutons de ligne) y sont visibles en permanence, sinon elles n'existent pas. */
@custom-variant touch (@media (hover: none));
/* Variante « fenêtre basse » : un téléphone en paysage. Ce qui n'est pas le diagramme s'efface. */
@custom-variant short (@media (max-height: 500px));
/* Variante « sombre » : pilotée par l'attribut posé sur <html>, jamais par le média système. */
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));

@theme inline {
  --font-display: var(--font-fraunces), Georgia, serif;
  --font-ui: var(--font-plex), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;
}

:root {
  /* Part de couleur dans le fond d'une barre de tâche (`.data-bar`). */
  --data-tint: 32%;
}

/* Thème sombre : la structure s'inverse (encre claire, fonds sombres), les données ne bougent
   pas. Piloté par l'attribut `data-theme` posé sur <html> avant le premier rendu (voir le
   script du layout racine), jamais par `prefers-color-scheme` directement : c'est le script
   qui tranche entre le choix enregistré et le réglage du système, le CSS n'a qu'une source. */
:root[data-theme="dark"] {
  color-scheme: dark;
  --color-paper: #1C1915;
  --color-surface: #242019;
  --color-ink: #EFE8DA;
  --color-ink-soft: #A39B8D;
  --color-line: #3B362F;
  --color-accent-soft: color-mix(in srgb, #F2C319 22%, transparent);
  /* Rouges éclaircis : les valeurs du jour ne passent pas 4,5:1 sur le papier sombre. */
  --color-today: #FF5C52;
  --color-danger: #E8604C;
  /* Une ombre à 14 % ne se voit pas sur du brun. */
  --shadow-float: 0 8px 24px color-mix(in srgb, var(--color-ink) 40%, transparent), 0 2px 6px color-mix(in srgb, var(--color-ink) 24%, transparent);
  --shadow-dialog: 0 24px 60px color-mix(in srgb, var(--color-ink) 60%, transparent);
  /* Plus de couleur dans les barres, pour que l'encre claire reste lisible dessus. */
  --data-tint: 45%;
}

@layer base {
  body {
    @apply bg-paper text-ink font-ui antialiased;
  }
  /* Les titres en Fraunces, casse mixte, graisse 500 : jamais de capitales forcées (spec §3). */
  h1, h2, h3 { @apply font-display font-medium tracking-tight; }
}

@layer utilities {
  /* Focus visible au clavier seulement : anneau d'or, le seul sens de l'or est « actif ». */
  .focus-ring { @apply outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2; }
  /* Hachures de week-end sur un fond de structure (encre du thème, donc claires la nuit). */
  .hatch { background-image: repeating-linear-gradient(45deg, var(--color-ink) 0 4px, transparent 4px 8px); }
  /* Graduation d'un jour dans la grille : un pointillé vertical en couleur de filet. */
  .day-tick { background-image: repeating-linear-gradient(to bottom, var(--color-line) 0 3px, transparent 3px 8px); }
  /* Barre de tâche (spec §7) : teinte pâle de `--bar-color` dans la surface, filet de la couleur à
     40 %, liseré gauche plein. Le composant ne pose que `--bar-color` ; `--data-tint` vient du
     thème. */
  .data-bar {
    background-color: color-mix(in srgb, var(--bar-color) var(--data-tint), var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--bar-color) 40%, transparent);
    border-left: 4px solid var(--bar-color);
    border-radius: 4px var(--radius-bar) var(--radius-bar) 4px;
  }
  /* Retard mis en évidence : filet et liseré rouges. */
  .data-bar-late { border-color: var(--color-danger); border-left-color: var(--color-danger); }
  /* Avancement : un trait de couleur pleine le long du bord bas, de la longueur de l'avancement. */
  .data-bar-progress { height: 3px; background-color: var(--bar-color); }
}
```

- [ ] **Step 4: Changer les fontes dans `app/layout.tsx`**

Remplacer les lignes 2 et 7–9 :

```ts
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
```

```ts
// Fraunces est une fonte variable : pas de liste de graisses, l'axe optique suit la taille.
const fraunces = Fraunces({ subsets: ['latin'], axes: ['opsz'], variable: '--font-fraunces' })
// IBM Plex Sans est statique : les trois graisses employées (400 corps, 500 libellés, 600 initiales).
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })
```

Ligne 13, la description : `'Des Gantt partagés, simplement.'`.

Ligne 21, la classe de `<html>` : `` className={`${fraunces.variable} ${plex.variable} ${mono.variable}`} ``.

Si TypeScript refuse `axes: ['opsz']` (la liste des axes dépend de la version de `next/font`), retirer la clé `axes` : Fraunces reste variable en graisse.

- [ ] **Step 5: Changer la géométrie dans `lib/gantt/geometry.ts`**

Ligne 7 : `export const ROW_HEIGHT = 48`. Ligne 9 : `export const BAR_INSET = 10`. Ligne 52 : `export const BAR_BORDER_PX = 1`. Mettre à jour le commentaire au-dessus de la ligne 52 : la bordure fait désormais 1 px, les poignées la débordent toujours de cette épaisseur.

- [ ] **Step 6: Vérifier que le test des jetons passe, et mesurer ce qui casse ailleurs**

Run: `npx vitest run tests/unit/design/tokens.test.ts`
Attendu : PASS.

Run: `npm run typecheck`
Attendu : aucune erreur (les classes inconnues ne sont pas des erreurs TypeScript).

Run: `npm test`
Attendu : tout passe SAUF, au plus, des tests qui vérifient une classe brutaliste encore présente dans un composant (ils passent encore, puisque les composants n'ont pas changé) — en pratique : PASS complet. Si un test de `lib/gantt` échoue à cause de 48/10/1, c'est qu'il codait la valeur en dur : le corriger pour lire la constante.

Run: `npm run dev` en arrière-plan (port 3100), ouvrir `/login` : la page est en Fraunces / Plex sur papier chaud, laide (plus d'ombres, bordures de 3 px sans couleur), mais fonctionnelle.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css app/layout.tsx lib/gantt/geometry.ts tests/unit/design/tokens.test.ts
git commit -m "feat(design): jetons de l'identité éditoriale, fontes et géométrie" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

# Lot 2 — Primitives

### Task 2: Le bouton

**Files:**
- Modify: `components/ui/Button.tsx`
- Test: `tests/unit/components/ui/Button.test.tsx`

**Interfaces:**
- Consomme : `focus-ring`, `rounded-control`, jetons de Task 1.
- Produit : `Button` inchangé en API. Classes stables sur lesquelles les tests suivants s'appuient : `primary` → `bg-ink text-paper` ; `secondary` → `border-line` ; `quiet` → `border-transparent` ; `danger` → `bg-danger` ; `danger-quiet` → `text-danger bg-transparent`.

- [ ] **Step 1: Réécrire le test qui échoue**

Dans `tests/unit/components/ui/Button.test.tsx`, remplacer les deux derniers tests (« seul le niveau 1 porte l'ombre brutale » et « le destructif discret… ») par :

```ts
  it('seul le niveau 1 est en encre pleine, et rien ne porte d’ombre', () => {
    render(
      <>
        <Button>Principal</Button>
        <Button variant="secondary">Secondaire</Button>
        <Button variant="quiet">Discret</Button>
      </>,
    )
    const primary = screen.getByRole('button', { name: 'Principal' })
    expect(primary).toHaveClass('bg-ink', 'text-paper', 'rounded-control', 'focus-ring')
    const secondary = screen.getByRole('button', { name: 'Secondaire' })
    expect(secondary).not.toHaveClass('bg-ink')
    expect(secondary).toHaveClass('border-line')
    const quiet = screen.getByRole('button', { name: 'Discret' })
    expect(quiet).not.toHaveClass('bg-ink')
    expect(quiet).toHaveClass('border-transparent')
    for (const b of [primary, secondary, quiet]) {
      expect(Array.from(b.classList).some((c) => c.startsWith('shadow'))).toBe(false)
    }
  })

  it('le destructif discret est rouge sans fond au repos', () => {
    render(<Button variant="danger-quiet">Supprimer</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-danger', 'bg-transparent')
    expect(screen.getByRole('button')).not.toHaveClass('bg-danger')
  })

  it('deux hauteurs fixes : 40 px et 32 px', () => {
    render(<><Button>Grand</Button><Button size="sm">Petit</Button></>)
    expect(screen.getByRole('button', { name: 'Grand' })).toHaveClass('h-10')
    expect(screen.getByRole('button', { name: 'Petit' })).toHaveClass('h-8')
  })
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/ui/Button.test.tsx`
Attendu : FAIL (« text-paper » absent, `h-10` absent).

- [ ] **Step 3: Implémenter**

Dans `components/ui/Button.tsx`, remplacer `variants`, `sizes` et la chaîne de base :

```ts
const variants: Record<Variant, string> = {
  /* Niveau 1 : l'action principale, une seule par écran. Le seul aplat d'encre parmi les boutons. */
  primary: 'bg-ink text-paper hover:bg-ink/88',
  /* Niveau 2 : un filet, pas de fond. Il se voit, il ne réclame pas. */
  secondary: 'bg-transparent text-ink border border-line hover:bg-surface hover:border-ink-soft',
  /* Niveau 3 : du texte. La bordure transparente garde la hauteur des deux autres niveaux, pour
     qu'une barre qui les mélange ne sautille pas d'un bouton à l'autre. */
  quiet: 'bg-transparent text-ink border border-transparent hover:bg-surface',
  /* Réservé au bouton de CONFIRMATION d'une suppression : l'accent va à la décision, pas à la
     tentation. Texte blanc fixe : le rouge ne suit pas le thème. */
  danger: 'bg-danger text-white hover:bg-danger/90',
  /* Destructif au repos : rouge, mais sans aplat. */
  'danger-quiet': 'bg-transparent text-danger border border-transparent hover:bg-danger/8',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
}
```

```ts
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-ui font-medium focus-ring disabled:opacity-50 disabled:pointer-events-none',
```

Mettre à jour le commentaire au-dessus : « Casse mixte et graisse 500 : les capitales n'existent plus nulle part (spec §3). »

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/ui`
Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Button.tsx tests/unit/components/ui/Button.test.tsx
git commit -m "feat(ui): bouton à filet, encre pleine réservée au niveau 1, anneau de focus or" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Le badge, et `accent` à la place de `yellow`

**Files:**
- Modify: `components/ui/Badge.tsx`
- Test: `tests/unit/components/ui/Badge.test.tsx`

**Interfaces:**
- Produit : `BadgeColor = 'violet' | 'blue' | 'cyan' | 'rose' | 'emerald' | 'accent' | 'ink' | 'paper'`. Classes stables : couleur de données → `bg-<couleur>/30` ; `ink` → `bg-ink text-paper` ; `paper` → `bg-surface text-ink` ; `accent` → `bg-accent-soft`.

- [ ] **Step 1: Réécrire le test qui échoue**

Remplacer `tests/unit/components/ui/Badge.test.tsx` :

```ts
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('porte une couleur de données en teinte pâle, texte en encre', () => {
    render(<Badge color="cyan">Lecteur</Badge>)
    expect(screen.getByText('Lecteur')).toHaveClass('bg-cyan/30', 'text-ink', 'rounded-full')
  })
  it('est encre par défaut', () => {
    render(<Badge>Propriétaire</Badge>)
    expect(screen.getByText('Propriétaire')).toHaveClass('bg-ink', 'text-paper')
  })
  it('est en casse mixte, hors police mono, en 13 px', () => {
    render(<Badge>Éditeur</Badge>)
    expect(screen.getByText('Éditeur')).not.toHaveClass('uppercase')
    expect(screen.getByText('Éditeur')).not.toHaveClass('font-mono')
    expect(screen.getByText('Éditeur')).toHaveClass('text-xs')
  })
  it('a une couleur de surface, celle du statut « À faire »', () => {
    render(<Badge color="paper">À faire</Badge>)
    expect(screen.getByText('À faire')).toHaveClass('bg-surface', 'text-ink')
  })
  it('a une couleur « actif », l’or voilé', () => {
    render(<Badge color="accent">Moi</Badge>)
    expect(screen.getByText('Moi')).toHaveClass('bg-accent-soft')
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/ui/Badge.test.tsx`
Attendu : FAIL (TypeScript : `"accent"` n'est pas un `BadgeColor` ; classes absentes).

- [ ] **Step 3: Implémenter**

Remplacer `components/ui/Badge.tsx` :

```tsx
import { cn } from '@/lib/utils'

export type BadgeColor = 'violet' | 'blue' | 'cyan' | 'rose' | 'emerald' | 'accent' | 'ink' | 'paper'

// Une couleur de DONNÉES se porte en teinte pâle, texte en encre du thème — comme une barre du
// Gantt (spec §3). La nuit, la teinte monte pour que l'encre claire reste lisible. `ink` est le
// seul aplat ; `paper` est la couleur de STRUCTURE du statut « À faire ».
const colors: Record<BadgeColor, string> = {
  violet: 'bg-violet/30 border-violet/40 text-ink dark:bg-violet/45',
  blue: 'bg-blue/30 border-blue/40 text-ink dark:bg-blue/45',
  cyan: 'bg-cyan/30 border-cyan/40 text-ink dark:bg-cyan/45',
  rose: 'bg-rose/30 border-rose/40 text-ink dark:bg-rose/45',
  emerald: 'bg-emerald/30 border-emerald/40 text-ink dark:bg-emerald/45',
  accent: 'bg-accent-soft border-accent/40 text-ink',
  ink: 'bg-ink border-ink text-paper',
  paper: 'bg-surface border-line text-ink',
}

export function Badge({ color = 'ink', className, children }: { color?: BadgeColor; className?: string; children: React.ReactNode }) {
  // Casse mixte et police d'interface : un badge de rôle ou de statut est un mot, pas un chiffre.
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', colors[color], className)}>
      {children}
    </span>
  )
}
```

- [ ] **Step 4: Chercher les appelants de `yellow`**

Run: `grep -rn '"yellow"' app components lib`
Attendu : aucune ligne (l'inventaire du 2026-10-08 n'en trouve pas). S'il y en a, remplacer par `"accent"`.

- [ ] **Step 5: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/ui && npm run typecheck`
Attendu : PASS, aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add components/ui/Badge.tsx tests/unit/components/ui/Badge.test.tsx
git commit -m "feat(ui): badge en pastille, teinte pâle pour les couleurs, accent à la place de yellow" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Les champs

**Files:**
- Modify: `components/ui/Input.tsx`, `components/ui/Select.tsx`, `components/ui/Textarea.tsx`, `components/ui/Checkbox.tsx`
- Test: `tests/unit/components/ui/FormControls.test.tsx`

**Interfaces:**
- Produit : classes stables `rounded-control border-line bg-surface focus-ring` sur `input`, `select`, `textarea` ; `accent-ink` sur la case à cocher.

- [ ] **Step 1: Ajouter le test qui échoue**

À la fin de `tests/unit/components/ui/FormControls.test.tsx`, ajouter :

```ts
describe('champs à filet (spec §4)', () => {
  it('Input, Select et Textarea partagent le même gabarit', () => {
    render(
      <>
        <Input label="Titre" />
        <Select label="Statut" options={[{ value: 'a', label: 'A' }]} />
        <Textarea label="Description" />
      </>,
    )
    for (const el of [screen.getByLabelText('Titre'), screen.getByLabelText('Statut'), screen.getByLabelText('Description')]) {
      expect(el).toHaveClass('rounded-control', 'border', 'border-line', 'bg-surface', 'focus-ring')
      expect(el).not.toHaveClass('border-[3px]')
    }
    expect(screen.getByLabelText('Titre')).toHaveClass('h-10')
    expect(screen.getByText('Titre')).toHaveClass('font-medium', 'text-sm')
  })

  it('une erreur passe le filet en rouge', () => {
    render(<Input label="Courriel" error="Adresse invalide" />)
    expect(screen.getByLabelText('Courriel')).toHaveClass('border-danger')
    expect(screen.getByRole('alert')).toHaveClass('text-danger')
  })

  it('la case à cocher est native, en encre', () => {
    render(<Checkbox label="Lier" />)
    expect(screen.getByLabelText('Lier')).toHaveClass('accent-ink', 'focus-ring')
    expect(screen.getByLabelText('Lier')).not.toHaveClass('appearance-none')
  })
})
```

Vérifier en tête du fichier que `Input`, `Select`, `Textarea`, `Checkbox` sont importés ; ajouter ce qui manque :

```ts
import { Checkbox } from '@/components/ui/Checkbox'
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/ui/FormControls.test.tsx`
Attendu : FAIL.

- [ ] **Step 3: Implémenter**

`Input.tsx`, le `<label>` : `className="font-medium text-sm"`. L'`<input>` :

```tsx
        className={cn('h-10 rounded-control border border-line bg-surface px-3 font-ui text-base focus-ring focus:border-ink placeholder:text-ink-soft/70', error && 'border-danger', className)}
```

Le `<p>` d'erreur : `className="text-danger text-sm"`.

`Select.tsx`, le `<label>` : `className="font-medium text-sm"`. Le `<select>` :

```tsx
          className={cn('h-10 w-full rounded-control border border-line bg-surface pl-3 pr-9 font-ui text-base focus-ring focus:border-ink appearance-none', className)}
```

Le chevron : `className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-soft"`.

`Textarea.tsx`, le `<label>` : `className="font-medium text-sm"`. Le `<textarea>` :

```tsx
        className={cn('rounded-control border border-line bg-surface px-3 py-2 font-ui text-base focus-ring focus:border-ink placeholder:text-ink-soft/70', error && 'border-danger', className)}
```

Le `<p>` d'erreur : `className="text-danger text-sm"`.

`Checkbox.tsx`, l'`<input>` :

```tsx
      <input ref={ref} id={inputId}
        className={cn('size-[18px] shrink-0 rounded-[4px] accent-ink focus-ring', className)} {...props} type="checkbox" />
      <span className="text-sm font-medium">{label}</span>
```

Remplacer le commentaire de la case : « Case native : `accent-color` la peint en encre, et le navigateur garantit une coche lisible dans les deux thèmes — ce qu'un `appearance-none` redessiné ne faisait pas la nuit. »

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/ui`
Attendu : PASS (`Casing.test.tsx` passe toujours : les libellés n'ont pas `uppercase`).

- [ ] **Step 5: Commit**

```bash
git add components/ui/Input.tsx components/ui/Select.tsx components/ui/Textarea.tsx components/ui/Checkbox.tsx tests/unit/components/ui/FormControls.test.tsx
git commit -m "feat(ui): champs à filet sur surface, 40 px, case à cocher native en encre" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Avatar et toast

**Files:**
- Modify: `components/ui/Avatar.tsx`, `components/ui/Toast.tsx`
- Test: `tests/unit/components/ui/Avatar.test.tsx`

- [ ] **Step 1: Ajouter le test qui échoue**

À la fin de `tests/unit/components/ui/Avatar.test.tsx`, dans le `describe` existant :

```ts
  it('est rond, en Plex semi-gras, texte sombre fixe sur la couleur', () => {
    render(<Avatar name="Alice Test" color="#FF6B9D" />)
    const el = screen.getByTitle('Alice Test')
    expect(el).toHaveClass('rounded-full', 'font-ui', 'font-semibold', 'text-black/80')
    expect(el).not.toHaveClass('border-[3px]')
    expect(el).not.toHaveClass('font-display')
  })
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/ui/Avatar.test.tsx`
Attendu : FAIL.

- [ ] **Step 3: Implémenter**

`Avatar.tsx` : l'image → `className={cn('rounded-full object-cover', dim, className)}` ; le `<span>` :

```tsx
      className={cn('inline-flex items-center justify-center rounded-full font-ui font-semibold text-black/80', dim, className)}>
```

`Toast.tsx`, le bouton :

```tsx
          className={cn('min-w-64 rounded-card px-4 py-3 text-left font-medium shadow-float', t.kind === 'error' ? 'bg-danger text-white' : 'bg-ink text-paper')}>
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/ui`
Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Avatar.tsx components/ui/Toast.tsx tests/unit/components/ui/Avatar.test.tsx
git commit -m "feat(ui): avatar rond, toast en encre pleine" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Fenêtre et menu — les couches flottantes

**Files:**
- Modify: `components/ui/Dialog.tsx`, `components/ui/Menu.tsx`, `components/project/ProjectMenu.tsx`, `components/layout/UserMenu.tsx:30`, `components/layout/ProjectHeader.tsx:52`
- Test: `tests/unit/components/ui/Dialog.test.tsx`, `tests/unit/components/ui/Menu.test.tsx`

**Interfaces:**
- Produit : `Menu` sans `tone` ; `ProjectMenu` sans `tone`. `Dialog` : le panneau porte `rounded-dialog bg-surface shadow-dialog`, le voile `items-end sm:items-center`, le pied `flex-wrap` ; l'accent de statut reste sous `data-testid="dialog-accent"` et porte la classe passée.

- [ ] **Step 1: Ajouter les tests qui échouent**

Dans `tests/unit/components/ui/Dialog.test.tsx`, ajouter un `describe` :

```ts
describe('Dialog : couche flottante (spec §4)', () => {
  it('surface arrondie et ombrée, voile qui vient du bas sur téléphone, pied qui passe à la ligne', () => {
    render(<Dialog open onClose={() => {}} title="Renommer" footer={<button>Ok</button>}>corps</Dialog>)
    const dialog = screen.getByRole('dialog', { name: 'Renommer' })
    expect(dialog).toHaveClass('rounded-t-dialog', 'sm:rounded-dialog', 'bg-surface', 'shadow-dialog')
    expect(dialog).not.toHaveClass('border-[3px]')
    expect(dialog.parentElement).toHaveClass('items-end', 'sm:items-center')
    expect(screen.getByText('Ok').closest('footer')).toHaveClass('flex-wrap')
    expect(screen.getByRole('heading', { name: 'Renommer' })).toHaveClass('font-display')
  })

  it('l’accent de statut est un liseré à gauche du titre', () => {
    render(<Dialog open onClose={() => {}} title="Ticket #3" accentClassName="bg-blue">corps</Dialog>)
    expect(screen.getByTestId('dialog-accent')).toHaveClass('bg-blue', 'rounded-full', 'w-1')
  })
})
```

Dans `tests/unit/components/ui/Menu.test.tsx`, ajouter :

```ts
  it('le déclencheur porte l’anneau de focus, la liste est une surface ombrée', async () => {
    render(<Menu label="Actions" entries={[{ id: 'a', label: 'Renommer', onSelect: () => {} }]} />)
    const trigger = screen.getByRole('button', { name: 'Actions' })
    expect(trigger).toHaveClass('focus-ring')
    await userEvent.click(trigger)
    expect(screen.getByRole('menu', { name: 'Actions' })).toHaveClass('rounded-card', 'bg-surface', 'shadow-float')
    expect(screen.getByRole('menuitem', { name: 'Renommer' })).toHaveClass('rounded-control')
  })
```

(Vérifier que `userEvent` est importé dans ce fichier ; sinon `import userEvent from '@testing-library/user-event'`.)

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/ui/Dialog.test.tsx tests/unit/components/ui/Menu.test.tsx`
Attendu : FAIL.

- [ ] **Step 3: Implémenter `Dialog.tsx`**

Remplacer le JSX retourné par `createPortal` (de `<div className="fixed inset-0 …` à `document.body,`) :

```tsx
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-0 dark:bg-black/55 sm:items-center sm:p-4"
      onPointerDown={stop}
      onDoubleClick={stop}
      onClick={(e) => { e.stopPropagation(); onClose() }}
    >
      {/* `max-h-full` + colonne flex : une modale plus haute que la fenêtre débordait des deux
          côtés à la fois — l'overlay est en `fixed`, la page ne défile donc pas, et NI le titre
          NI les boutons du pied n'étaient atteignables. Header et pied restent ancrés, seul le
          contenu défile. Sur un téléphone, elle vient du bas, pleine largeur, coins hauts
          arrondis (spec §4). */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="flex max-h-full w-full flex-col rounded-t-dialog border border-line/60 bg-surface text-ink shadow-dialog focus-ring dark:border-line sm:max-w-lg sm:rounded-dialog"
        onClick={(e) => e.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-3 px-6 pb-3 pt-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Liseré de statut : la fenêtre d'un ticket reprend la couleur de sa carte. */}
            {accentClassName && (
              <span aria-hidden data-testid="dialog-accent" className={cn('w-1 shrink-0 self-stretch rounded-full', accentClassName)} />
            )}
            <h2 id={titleId} className="font-display text-[22px] font-medium leading-tight">{title}</h2>
          </div>
          <Button variant="quiet" size="sm" className="-mr-2 -mt-1" onClick={onClose} aria-label="Fermer">✕</Button>
        </header>
        {/* `min-h-0` : sans lui, un enfant flex refuse de rétrécir sous sa hauteur de contenu et
            `overflow-y-auto` n'a jamais rien à faire défiler. */}
        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>
        {/* `flex-wrap` : sur un téléphone, « Supprimer », « Annuler » et « Enregistrer » ne tiennent
            pas sur une rangée ; sans retour à la ligne, `justify-end` poussait « Supprimer » hors
            du panneau, par la gauche. */}
        {footer && <footer className="flex shrink-0 flex-wrap justify-end gap-2 px-6 pb-6 pt-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
```

Mettre à jour la doc de `accentClassName` dans `DialogProps` : « Classe de couleur d'un liseré de 4 px à gauche du titre. »

`text-[22px]` : taille arbitraire AU-DESSUS de 13 px, autorisée (le garde-fou de Task 16 n'interdit que 10–12 px).

- [ ] **Step 4: Implémenter `Menu.tsx` et retirer `tone`**

Dans `MenuProps`, supprimer la propriété `tone` et sa doc. Dans la signature de `Menu`, retirer `tone = 'default'`. Le déclencheur :

```tsx
        className={cn(
          'inline-flex items-center justify-center rounded-control focus-ring',
          // Une seule taille pour tous les « ⋯ » : un `size-*` ajouté par l'appelant entrerait en
          // conflit avec celui-ci, et l'ordre des classes générées déciderait au hasard.
          dots && 'size-7 text-base leading-none text-ink-soft hover:bg-surface hover:text-ink',
          triggerClassName,
        )}
```

La liste :

```tsx
          // Surface flottante (spec §4) : arrondie, ombrée, un filet pour se détacher la nuit.
          className="fixed z-50 min-w-52 rounded-card border border-line/60 bg-surface p-1.5 text-ink shadow-float dark:border-line"
```

L'intitulé : `className="px-3 pb-1 pt-2 text-xs text-ink-soft"`. L'entrée :

```tsx
                className={cn(
                  'block w-full rounded-control px-3 py-2 text-left text-base font-medium outline-none',
                  entry.danger
                    // Destructif sobre au repos, rouge voilé seulement sous le pointeur ou le focus.
                    ? 'text-danger hover:bg-danger/8 focus:bg-danger/8'
                    : 'hover:bg-paper focus:bg-paper',
                )}
```

Dans `components/project/ProjectMenu.tsx` : supprimer `tone?: 'default' | 'header'` de `ProjectMenuProps`, retirer `tone` de la déstructuration et `tone={tone}` de l'appel à `<Menu>`.

Dans `components/layout/UserMenu.tsx`, supprimer la ligne 30 (`tone="header"`). Dans `components/layout/ProjectHeader.tsx`, supprimer la ligne 52 (`tone="header"`).

- [ ] **Step 5: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/ui && npm run typecheck`
Attendu : PASS, aucune erreur (si `tone` subsiste ailleurs, `typecheck` le dira : le retirer).

- [ ] **Step 6: Commit**

```bash
git add components/ui/Dialog.tsx components/ui/Menu.tsx components/project/ProjectMenu.tsx components/layout/UserMenu.tsx components/layout/ProjectHeader.tsx tests/unit/components/ui/Dialog.test.tsx tests/unit/components/ui/Menu.test.tsx
git commit -m "feat(ui): fenêtre et menu en surfaces arrondies et ombrées, fin du ton d'en-tête" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

# Lot 3 — En-têtes, compte, connexion, marque

### Task 7: Les en-têtes et le menu du compte

**Files:**
- Modify: `components/layout/AppHeader.tsx:11-13`, `components/layout/ProjectHeader.tsx:32-53`, `components/layout/ProjectTabs.tsx:48-49`, `components/layout/UserMenu.tsx:31`, `components/layout/ThemeToggle.tsx:84`
- Test: `tests/unit/components/layout/ProjectTabs.test.tsx` (créer si absent)

- [ ] **Step 1: Écrire le test qui échoue**

`tests/unit/components/layout/ProjectTabs.test.tsx` existe déjà et simule `usePathname` (`ProjectTabs` calcule l'onglet courant avec `currentTab(usePathname(), projectId)`). Y ajouter, en réutilisant son mock et son appel à `render` (props : `projectId`, `ticketsEnabled`, `isOwner`) :

```tsx
  it('l’onglet courant est en encre, souligné d’or ; les autres en encre douce (spec §5)', () => {
    // Même mécanique que les tests ci-dessus : le chemin simulé pointe sur /projects/p1/tickets.
    render(<ProjectTabs projectId="p1" ticketsEnabled isOwner />)
    const current = screen.getByRole('link', { name: 'Tickets' })
    expect(current).toHaveClass('border-accent', 'text-ink', 'font-medium')
    const other = screen.getByRole('link', { name: 'Gantt' })
    expect(other).toHaveClass('border-transparent', 'text-ink-soft')
    expect(other).not.toHaveClass('text-on-header/70')
  })
```

Si le fichier simule un autre chemin, choisir l'onglet correspondant comme `current`.

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/layout/ProjectTabs.test.tsx`
Attendu : FAIL (`border-accent` absent).

- [ ] **Step 3: Implémenter**

`AppHeader.tsx` ligne 11 :

```tsx
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-paper px-4 sm:px-6">
```

Ligne 13 : `className="rounded-control focus-ring"`.

`ProjectHeader.tsx` ligne 32 :

```tsx
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 border-b border-line bg-paper px-4 sm:h-14 sm:flex-nowrap sm:gap-x-6 sm:px-6">
```

Ligne 34 : `brutal-focus-header` → `rounded-control focus-ring`. Ligne 38 :

```tsx
        <Link href="/projects" className="hidden shrink-0 text-sm text-ink-soft hover:text-ink focus-ring sm:inline">
```

Ligne 41 : `text-on-header/50` → `text-ink-soft/60`. Ligne 43, le `h1` :

```tsx
        <h1 className="min-w-0 truncate font-display text-base font-medium sm:text-lg" title={projectName}>{projectName}</h1>
```

Ligne 53 : `triggerClassName="shrink-0 text-on-header"` → `triggerClassName="shrink-0"`.

`ProjectTabs.tsx` lignes 48–49 :

```tsx
            'flex shrink-0 items-center border-b-2 text-base focus-ring',
            current === t.id ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-soft hover:text-ink',
```

`UserMenu.tsx` ligne 31 : l'avatar de l'utilisateur est en or (spec §4) : `color="var(--color-accent)"` à la place de `color={profile.color}`. Ligne 38 : `font-bold` → `font-medium`.

`ThemeToggle.tsx` ligne 84 :

```tsx
        'inline-flex h-8 items-center gap-2 rounded-control border border-line px-2 text-sm font-medium focus-ring hover:bg-surface',
```

- [ ] **Step 4: Vérifier**

Run: `npx vitest run tests/unit/components/layout && npm run typecheck`
Attendu : PASS.

Run: `grep -n "on-header\|bg-header\|brutal" components/layout/AppHeader.tsx components/layout/ProjectHeader.tsx components/layout/ProjectTabs.tsx components/layout/UserMenu.tsx components/layout/ThemeToggle.tsx`
Attendu : aucune ligne.

Ouvrir `/projects` puis un projet sur le serveur de dev : bandeau papier, onglet courant souligné d'or, avatar or.

- [ ] **Step 5: Commit**

```bash
git add components/layout/AppHeader.tsx components/layout/ProjectHeader.tsx components/layout/ProjectTabs.tsx components/layout/UserMenu.tsx components/layout/ThemeToggle.tsx tests/unit/components/layout/ProjectTabs.test.tsx
git commit -m "feat(layout): bandeau papier, onglets soulignés d'or, avatar du compte en or" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: La marque — signe, icônes, image OpenGraph

**Files:**
- Modify: `components/layout/Logo.tsx`, `app/icon.svg`, `app/opengraph-image.tsx`
- Regenerate: `app/favicon.ico`, `app/apple-icon.png` (via `node scripts/make-icons.mjs`)
- Test: `tests/unit/components/layout/Logo.test.tsx`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/unit/components/layout/Logo.test.tsx` :

```tsx
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { Mark, Wordmark } from '@/components/layout/Logo'

describe('le signe (spec §11)', () => {
  it('est un carré d’encre nu, sans cadre, avec trois barres en aplat', () => {
    const { container } = render(<Mark />)
    const rects = Array.from(container.querySelectorAll('rect'))
    expect(rects).toHaveLength(4)
    expect(rects[0]).toHaveAttribute('fill', '#2A2622')
    expect(rects.some((r) => r.getAttribute('stroke'))).toBe(false)
    expect(rects.slice(1).map((r) => r.getAttribute('fill'))).toEqual(['#5B9DFF', '#FF8A3D', '#FF6FA3'])
  })

  it('le favicon est le même dessin', () => {
    const svg = readFileSync('app/icon.svg', 'utf8')
    expect(svg).toContain('fill="#2A2622"')
    expect(svg).not.toContain('stroke=')
    expect(svg).not.toContain('#111111')
  })

  it('le nom est en Fraunces, casse mixte', () => {
    const { getByText } = render(<Wordmark />)
    expect(getByText('BradGantt')).toHaveClass('font-display', 'font-medium')
    expect(getByText('BradGantt')).not.toHaveClass('normal-case')
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/layout/Logo.test.tsx`
Attendu : FAIL (5 `rect`, `stroke` présent).

- [ ] **Step 3: Implémenter**

`Logo.tsx`, `Mark` : supprimer le `<rect … stroke="#FDF6E3" …>` et passer le premier à `fill="#2A2622"`. Remplacer le paragraphe de doc sur le cadre crème par : « Carré d'encre nu : le cadre clair qui le détachait du bandeau sombre n'a plus de bandeau d'où se détacher. Sur un onglet de navigateur sombre, le carré se suffit. »

`Wordmark` : `<span className={cn('font-display font-medium tracking-tight', text)}>BradGantt</span>` et la doc : « Le nom en Fraunces, casse mixte, sans soulignement. »

`app/icon.svg` :

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <!-- Même dessin que components/layout/Logo.tsx : trois barres en escalier sur un carré d'encre. -->
  <rect width="64" height="64" fill="#2A2622"/>
  <rect x="12" y="14" width="26" height="9" fill="#5B9DFF"/>
  <rect x="22" y="28" width="26" height="9" fill="#FF8A3D"/>
  <rect x="32" y="42" width="20" height="9" fill="#FF6FA3"/>
</svg>
```

Run: `node scripts/make-icons.mjs` — régénère `app/favicon.ico` et `app/apple-icon.png`.

`app/opengraph-image.tsx` : remplacer entièrement :

```tsx
import { ImageResponse } from 'next/og'

export const alt = 'BradGantt — des Gantt partagés, simplement'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Fonte de titre pour l'image d'aperçu. `next/font` ne sert que le HTML : ici il faut le fichier
 * TTF lui-même. On le demande à Google Fonts au moment de générer l'image ; sans réseau, on
 * retombe sur la police système — l'aperçu reste correct, seulement moins typé.
 */
async function fraunces(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Fraunces:wght@500&display=swap')).text()
    const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1]
    if (!url) return null
    return await (await fetch(url)).arrayBuffer()
  } catch {
    return null
  }
}

const PAPER = '#F6F3EC'
const SURFACE = '#FBF9F4'
const INK = '#2A2622'
const LINE = '#DED7C8'

/** Une frise de quatre barres teinte + liseré, comme dans le produit (spec §11). */
const BARS = [
  { color: '#FF8A3D', left: 0, width: 300, label: 'Maquettes' },
  { color: '#5B9DFF', left: 150, width: 320, label: 'Intégration' },
  { color: '#3ECF8E', left: 360, width: 200, label: 'Recette' },
  { color: '#A78BFA', left: 470, width: 150, label: 'Mise en ligne' },
]

function tint(hex: string, paper = SURFACE, part = 0.32): string {
  const c = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16)
  const mix = (a: number, b: number) => Math.round(a * part + b * (1 - part))
  const r = mix(c(hex, 1), c(paper, 1)), g = mix(c(hex, 3), c(paper, 3)), b = mix(c(hex, 5), c(paper, 5))
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Aperçu de lien (Slack, Teams, LinkedIn…) : le signe, le nom en Fraunces, la promesse, et une
 * frise. Même vocabulaire que le site — papier chaud, filets, barres à liseré — sans image externe.
 * `next/og` n'évalue pas `color-mix` : la teinte est calculée ici.
 */
export default async function OpenGraphImage() {
  const font = await fraunces()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 48, padding: '64px 80px', background: PAPER, color: INK,
          fontFamily: font ? 'Fraunces' : 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9, width: 96, height: 96, padding: 14, background: INK }}>
            <div style={{ display: 'flex', width: 40, height: 13, background: '#5B9DFF' }} />
            <div style={{ display: 'flex', marginLeft: 15, width: 40, height: 13, background: '#FF8A3D' }} />
            <div style={{ display: 'flex', marginLeft: 30, width: 30, height: 13, background: '#FF6FA3' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 88, lineHeight: 1, letterSpacing: -2 }}>BradGantt</div>
            <div style={{ fontSize: 34, lineHeight: 1.2, color: '#746D62' }}>Des Gantt partagés, simplement.</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', background: SURFACE, border: `2px solid ${LINE}`, borderRadius: 20, padding: 24, gap: 14, position: 'relative' }}>
          {BARS.map((b) => (
            <div key={b.label} style={{ display: 'flex', height: 48 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', marginLeft: b.left, width: b.width, height: 48,
                  background: tint(b.color), border: `2px solid ${tint(b.color, SURFACE, 0.4)}`,
                  borderLeftWidth: 8, borderLeftColor: b.color, borderRadius: '8px 12px 12px 8px', paddingLeft: 18, fontSize: 26,
                }}
              >
                {b.label}
              </div>
            </div>
          ))}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 420, width: 4, background: '#E5342A' }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'Fraunces', data: font, style: 'normal', weight: 500 }] : [],
    },
  )
}
```

- [ ] **Step 4: Vérifier**

Run: `npx vitest run tests/unit/components/layout && npm run typecheck`
Attendu : PASS.

Avec le serveur de dev, ouvrir `http://localhost:3100/opengraph-image` : papier chaud, nom en Fraunces, frise de quatre barres à liseré, trait rouge. Puis `http://localhost:3100/icon.svg` : carré d'encre sans cadre.

- [ ] **Step 5: Commit**

```bash
git add components/layout/Logo.tsx app/icon.svg app/favicon.ico app/apple-icon.png app/opengraph-image.tsx tests/unit/components/layout/Logo.test.tsx
git commit -m "feat(marque): signe sans cadre, icônes régénérées, image d'aperçu sur papier" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Connexion, invitation, courriels

**Files:**
- Modify: `app/(auth)/login/page.tsx:21-52`, `app/(auth)/login/LoginForm.tsx:34-39`, `app/invite/[token]/InviteError.tsx:8-24`, `lib/invitations/emails.ts:14-16`
- Test: `tests/unit/lib/invitations/emails.test.ts` (créer si absent)

- [ ] **Step 1: Écrire le test qui échoue**

`lib/invitations/emails.ts` exporte `invitationEmail({ projectName, inviterName, inviteUrl, role })` et `addedEmail({ projectName, inviterName, projectUrl, role })`, qui renvoient un `Omit<MailMessage, 'to'>` dont le champ `html` est le gabarit. Créer `tests/unit/lib/invitations/emails.test.ts` :

```ts
import { invitationEmail, addedEmail } from '@/lib/invitations/emails'

describe('courriels (spec §9)', () => {
  it('bouton en encre pleine arrondi, titre en casse mixte, plus de brutalisme', () => {
    for (const html of [
      invitationEmail({ projectName: 'Refonte', inviterName: 'Alice', inviteUrl: 'https://x/i', role: 'editor' }).html,
      addedEmail({ projectName: 'Refonte', inviterName: 'Alice', projectUrl: 'https://x/p', role: 'viewer' }).html,
    ]) {
      expect(html).toContain('background:#2A2622')
      expect(html).toContain('border-radius:7px')
      expect(html).not.toContain('text-transform:uppercase')
      expect(html).not.toContain('box-shadow')
      expect(html).not.toContain('#FFD500')
      expect(html).not.toContain('#111')
    }
  })
})
```

(Si `role` attend une autre valeur que `'editor' | 'viewer'`, lire `InviteRole` dans le même fichier.)

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/lib/invitations/emails.test.ts`
Attendu : FAIL.

- [ ] **Step 3: Implémenter**

`emails.ts` ligne 14 : retirer `;text-transform:uppercase` du style du `<h1>` (garder `margin:0 0 16px;font-size:24px`). Ligne 16, remplacer l'attribut `style` du `<a>` par :

```
style="display:inline-block;background:#2A2622;color:#F6F3EC;border-radius:7px;padding:12px 20px;font-weight:600;text-decoration:none"
```

(Retirer aussi un éventuel `text-transform` à la suite.) Si le gabarit pose une couleur de fond de page (`#FDF6E3`) ou d'encre (`#111`), les passer à `#F6F3EC` et `#2A2622`.

`app/(auth)/login/page.tsx` : ligne 21 → `className="w-full space-y-6 rounded-dialog border border-line bg-surface p-8"` ; ligne 26 → `className="rounded-control border border-danger/40 bg-danger/8 p-3 text-sm font-medium text-danger"` ; ligne 37 : remplacer le `<span class="decoration-yellow …">brutalement</span> simples.` par `simplement.` (la phrase devient « Des Gantt partagés, simplement. ») ; ligne 42 → `className="space-y-2 rounded-card border border-line bg-surface p-4"` ; ligne 44 → `className="font-display text-lg font-medium"` ; lignes 43 et 52 : `font-mono text-xs text-ink-soft` → `text-xs text-ink-soft` (c'est de la prose).

`LoginForm.tsx` ligne 34 → `className="rounded-control border border-emerald/40 bg-emerald/20 p-4 text-sm font-medium"` ; ligne 39 : les deux `h-[3px] flex-1 bg-ink` → `h-px flex-1 bg-line`, le `font-mono text-sm` → `text-xs text-ink-soft`.

`InviteError.tsx` ligne 8 → `className="w-full max-w-md space-y-6 rounded-dialog border border-line bg-surface p-8"` ; ligne 24 → `className="inline-flex h-10 items-center rounded-control bg-ink px-4 font-medium text-paper focus-ring"`.

- [ ] **Step 4: Vérifier**

Run: `npx vitest run tests/unit/lib/invitations && npm run typecheck`
Attendu : PASS.

Run: `grep -nE "brutal|on-data|border-\[3px\]|yellow|cream" "app/(auth)/login/page.tsx" "app/(auth)/login/LoginForm.tsx" "app/invite/[token]/InviteError.tsx" lib/invitations/emails.ts`
Attendu : aucune ligne.

Run: `npx playwright test tests/e2e/auth.spec.ts tests/e2e/invite.spec.ts --reporter=line` (adapter au nom réel du parcours de connexion, `ls tests/e2e`).
Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/login/page.tsx" "app/(auth)/login/LoginForm.tsx" "app/invite/[token]/InviteError.tsx" lib/invitations/emails.ts tests/unit/lib/invitations/emails.test.ts
git commit -m "feat(auth): connexion, invitation et courriels sur papier, slogan sans brutalisme" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

# Lot 4 — Mes projets

### Task 10: La liste, la carte et les vignettes

**Files:**
- Modify: `components/project/ProjectCard.tsx:63-146`, `components/project/ProjectsSummaryLine.tsx:35-58`, `components/project/NoProjects.tsx:12-30`, `components/project/InviteForm.tsx:38-47`, `components/project/MiniGantt.tsx:28-59`, `components/layout/GanttPreview.tsx:27-87`
- Test: `tests/unit/components/project/ProjectCard.test.tsx` (ajouter un cas), `tests/unit/components/project/MiniGantt.test.tsx` (créer)

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `tests/unit/components/project/ProjectCard.test.tsx` (fabrique `item(patch)` → `ProjectListItem`, constante `TODAY`), ajouter, en reprenant l'appel `render(<ProjectCard … />)` du premier test du fichier :

```ts
  it('est une surface à filet, sans ombre, titre en Fraunces (spec §6)', () => {
    render(<ProjectCard item={item()} today={TODAY} />) // mêmes props que le premier test
    const card = screen.getByRole('article')
    expect(card).toHaveClass('rounded-card', 'border-line', 'bg-surface')
    expect(Array.from(card.classList).some((c) => c.includes('shadow'))).toBe(false)
    expect(screen.getByRole('heading')).toHaveClass('font-display', 'font-medium')
    expect(screen.getByRole('heading')).not.toHaveClass('uppercase')
  })
```

Créer `tests/unit/components/project/MiniGantt.test.tsx` (`MiniGantt({ tasks: MiniTask[]; range: Range; today: string })`, `MiniTask` vient de `lib/gantt/mini`) :

```tsx
import { render } from '@testing-library/react'
import { MiniGantt, MiniGanttPlaceholder } from '@/components/project/MiniGantt'
import type { MiniTask } from '@/lib/gantt/mini'

const task = { id: 't', type: 'task', startDate: '2026-10-01', endDate: '2026-10-05', color: '#5B9DFF' } as unknown as MiniTask

describe('MiniGantt (spec §6)', () => {
  it('les barres sont des `data-bar` qui posent leur couleur en variable', () => {
    const { container } = render(
      <MiniGantt tasks={[task]} range={{ start: '2026-10-01', end: '2026-10-10' }} today="2026-10-03" />,
    )
    const bar = container.querySelector('.data-bar') as HTMLElement
    expect(bar).not.toBeNull()
    expect(bar.style.getPropertyValue('--bar-color')).toBe('#5B9DFF')
    expect(bar).not.toHaveClass('border-2')
  })
  it('le gabarit vide est un filet pointillé', () => {
    const { container } = render(<MiniGanttPlaceholder />)
    expect(container.firstChild).toHaveClass('border-dashed', 'border-line')
  })
})
```

Si `MiniTask` exige d'autres champs (lire `lib/gantt/mini.ts`), les ajouter à `task` : le cast ne protège que TypeScript, pas `miniTimeline`.

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/project`
Attendu : FAIL.

- [ ] **Step 3: Implémenter**

`ProjectCard.tsx` lignes 63–66, la classe de l'article :

```tsx
        'group/card relative flex h-full cursor-pointer flex-col gap-3 rounded-card border border-line bg-surface p-5 transition-colors ' +
        'hover:border-ink-soft ' +
        'has-[[data-card-link]:focus-visible]:outline-2 has-[[data-card-link]:focus-visible]:outline-accent has-[[data-card-link]:focus-visible]:outline-offset-2'
```

Ligne 73, le titre : `font-display text-xl uppercase leading-tight` → `font-display text-[19px] font-medium leading-tight`. Lignes 99, 101, 133, 141 : garder `font-mono text-xs text-ink-soft` (chiffres et dates). Ligne 96 : `text-xs text-ink-soft` inchangé. Ligne 113, la barre d'avancement : `className="relative h-1 flex-1 overflow-hidden rounded-full bg-line"` ; ligne 115 : `className="absolute inset-y-0 left-0 bg-ink"` (sans `hatch`, sans `opacity-40`). Ligne 127 : `border-t-[3px] border-ink pt-3` → `border-t border-line pt-3`. Ligne 146 : `brutal-focus` → `focus-ring`.

`ProjectsSummaryLine.tsx` ligne 47 : `'font-bold text-danger underline-offset-4 hover:underline brutal-focus'` → `'rounded-control px-1.5 font-medium text-danger focus-ring hover:bg-danger/8'` ; ligne 49 : `lateOnly && 'bg-yellow px-1 text-on-data'` → `lateOnly && 'bg-accent-soft text-ink hover:bg-accent-soft'` ; ligne 58 : `brutal-focus` → `focus-ring`.

`NoProjects.tsx` ligne 12 : `className="mx-auto max-w-2xl space-y-5 rounded-card border border-line bg-surface p-8"` ; ligne 19 : `border-t-[3px] border-ink` → `border-t border-line` ; lignes 21, 25, 29 : `font-display text-sm uppercase` → `font-display text-lg font-medium` ; lignes 22, 26, 30 : `font-mono text-xs text-ink-soft` → `text-sm text-ink-soft`.

`InviteForm.tsx` ligne 38 : `border-t-[3px] border-ink` → `border-t border-line` ; ligne 47 : `className="break-all rounded-control border border-line bg-paper p-2 font-mono text-xs"`.

`MiniGantt.tsx` ligne 28 : `className="relative w-full overflow-hidden rounded-[6px] border border-line bg-paper"` ; ligne 31 : `bg-band` → `bg-surface` ; le jalon (ligne 38) : `className="absolute rotate-45 border border-ink-soft"` ; la barre (lignes 43–46) :

```tsx
          <span
            key={i}
            className="absolute data-bar"
            style={{ left: `${b.left}%`, width: `${b.width}%`, top: 6 + b.lane * (LANE_H + GAP), height: LANE_H, '--bar-color': b.color } as React.CSSProperties}
          />
```

Ligne 59 : `className="flex w-full items-center justify-center rounded-[6px] border border-dashed border-line text-xs text-ink-soft"`.

`GanttPreview.tsx` ligne 27 : `className="select-none overflow-hidden rounded-card border border-line bg-surface"` ; ligne 28 : `className="flex items-center justify-between border-b border-line px-3 py-1.5"` ; ligne 29 : `className="font-display text-xs font-medium"` ; ligne 30 (`text-[10px]`) : `className="font-mono text-xs text-ink-soft"` ; ligne 40 : `bg-band` → `bg-paper` ; lignes 54 et 58 : `bg-ink` → `bg-ink-soft`, `w-[3px]` → `w-[2px]`, `h-[3px]` → `h-[2px]` ; la barre (lignes 66–76) :

```tsx
          <div
            key={bar.label}
            className="absolute flex items-center data-bar"
            style={{ top: i * ROW_H + 6, left: `${bar.left}%`, width: `${bar.width}%`, height: BAR_H, '--bar-color': bar.color } as React.CSSProperties}
          >
            <span className="absolute bottom-0 left-0 data-bar-progress" style={{ width: `${bar.progress}%` }} />
            <span className="relative truncate px-1.5 text-xs font-medium text-ink">{bar.label}</span>
          </div>
```

Ligne 87, le jalon : `className="absolute size-3 rotate-45 border border-ink-soft bg-violet/40"`.

- [ ] **Step 4: Vérifier**

Run: `npx vitest run tests/unit/components/project tests/unit/components/layout && npm run typecheck`
Attendu : PASS.

Run: `grep -nE "brutal|on-data|border-\[3px\]|yellow|cream|bg-band|hatch|uppercase" components/project/*.tsx components/layout/GanttPreview.tsx`
Attendu : aucune ligne.

Run: `npx playwright test tests/e2e/projects.spec.ts --reporter=line`
Attendu : PASS hors « chaque carte porte sa vignette » (échec environnemental connu).

- [ ] **Step 5: Commit**

```bash
git add components/project/ProjectCard.tsx components/project/ProjectsSummaryLine.tsx components/project/NoProjects.tsx components/project/InviteForm.tsx components/project/MiniGantt.tsx components/layout/GanttPreview.tsx tests/unit/components/project
git commit -m "feat(projects): cartes à filet, vignettes en barres à liseré, filtre du retard en or voilé" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

# Lot 5 — Gantt

### Task 11: La barre de tâche

**Files:**
- Modify: `components/gantt/TaskBar.tsx`
- Test: `tests/unit/components/gantt/TaskBar.test.tsx` (créer), `tests/unit/components/gantt/GanttView.test.tsx:193, 216`

**Interfaces:**
- Produit : la barre porte `data-bar`, `--bar-color`, `data-bar-late` en retard mis en évidence, `outline-accent` sélectionnée ; l'avancement est un enfant `.data-bar-progress` de largeur `progress%`.

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `tests/unit/components/gantt/TaskBar.test.tsx`. Pour rendre une barre il faut le contexte de `GanttView` ; on passe donc par `GanttView`, avec les mêmes cales jsdom que `GanttView.test.tsx` (ne pas importer ce fichier : ses tests se relanceraient) :

```tsx
import { act, render } from '@testing-library/react'
import { GanttView } from '@/components/gantt/GanttView'
import { useGanttStore } from '@/lib/gantt/store'
import { makeTask } from '../../lib/gantt/fixtures'

// jsdom ne fait pas de mise en page : `clientWidth` vaut 0 et `scrollLeft` est en lecture seule.
// Mêmes cales que GanttView.test.tsx, le temps du fichier.
const scrollLefts = new WeakMap<Element, number>()
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
    configurable: true,
    get(this: Element) { return scrollLefts.get(this) ?? 0 },
    set(this: Element, v: number) { scrollLefts.set(this, v) },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1280 })
})
afterAll(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollLeft
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
})

const TODAY = '2026-09-15'
// « a » est dans les temps ; « late » est finie hier sans être achevée : en retard.
function hydrateWithLate() {
  act(() => {
    useGanttStore.getState().hydrate({
      projectId: 'p1', projectName: 'Projet', myRole: 'owner', members: [],
      tasks: [
        makeTask({ id: 'a', projectId: 'p1', startDate: '2026-09-14', endDate: '2026-09-18', progress: 40, color: '#5B9DFF' }),
        makeTask({ id: 'late', projectId: 'p1', startDate: '2026-09-01', endDate: '2026-09-10', progress: 50, color: '#FF8A3D' }),
      ],
      dependencies: [],
      today: TODAY,
    })
  })
}

describe('TaskBar (spec §7)', () => {
  beforeEach(() => hydrateWithLate())

  it('teinte pâle et liseré : la barre pose sa couleur en variable et la classe data-bar', () => {
    const { container } = render(<GanttView />)
    const bar = container.querySelector('[data-task-id="a"]') as HTMLElement
    expect(bar).toHaveClass('data-bar')
    expect(bar.style.getPropertyValue('--bar-color')).not.toBe('')
    expect(bar.style.backgroundColor).toBe('')
    expect(bar).not.toHaveClass('shadow-brutal')
    expect(bar).not.toHaveClass('border-[3px]')
  })

  it('l’avancement est un trait du bord bas, de la longueur de l’avancement', () => {
    const { container } = render(<GanttView />)
    const task = useGanttStore.getState().tasks.find((t) => t.id === 'a')!
    const progress = container.querySelector('[data-task-id="a"] .data-bar-progress') as HTMLElement
    expect(progress).not.toBeNull()
    expect(progress.style.width).toBe(`${task.progress}%`)
    expect(progress).toHaveClass('absolute', 'bottom-0', 'left-0')
    expect(container.querySelector('[data-task-id="a"] .hatch-data')).toBeNull()
  })

  it('le texte est en encre du thème, et la sélection un anneau d’or', () => {
    const { container } = render(<GanttView />)
    act(() => useGanttStore.getState().select({ kind: 'task', id: 'a' }))
    const bar = container.querySelector('[data-task-id="a"]') as HTMLElement
    expect(bar).toHaveClass('outline-2', 'outline-accent')
    expect(bar.querySelector('span.truncate')).toHaveClass('text-ink')
  })

  it('le retard mis en évidence : liseré rouge sur la barre en retard, pas sur les autres', () => {
    const { container } = render(<GanttView />)
    act(() => useGanttStore.getState().toggleHighlightLate())
    expect(container.querySelector('[data-task-id="late"]')).toHaveClass('data-bar-late')
    expect(container.querySelector('[data-task-id="a"]')).not.toHaveClass('data-bar-late')
  })
})
```

Dans `GanttView.test.tsx`, ligne 193 : `expect(other).toHaveClass('border-ink')` → `expect(other).not.toHaveClass('data-bar-late')` ; ligne 216 : `.toHaveClass('border-ink')` → `.not.toHaveClass('data-bar-late')` ; ligne 190 : `toHaveClass('border-danger')` → `toHaveClass('data-bar-late')`.

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/gantt/TaskBar.test.tsx tests/unit/components/gantt/GanttView.test.tsx`
Attendu : FAIL.

- [ ] **Step 3: Implémenter**

Dans `TaskBar.tsx`, remplacer la classe et le style de la barre, et le bloc d'avancement :

```tsx
      className={cn(
        // Plus d'`overflow-hidden` ici : la poignée de liaison de la tâche 12 déborde de la
        // barre. Le rognage du titre est assuré par le `truncate` du <span>, à qui `min-w-0`
        // donne le droit de rétrécir sous sa largeur de contenu.
        // `data-bar` : teinte pâle, filet à 40 %, liseré gauche (globals.css). La barre ne pose
        // que sa couleur, en variable ; la part de teinte vient du thème.
        'group/bar absolute flex items-center data-bar select-none touch-none',
        // Mise en évidence : le retard prend un liseré rouge, tout le reste recule de moitié.
        highlightLate && late && 'data-bar-late',
        highlightLate && !late && 'opacity-50',
        canEdit && 'cursor-grab active:cursor-grabbing',
        selected && 'outline-2 outline-accent outline-offset-1',
      )}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, '--bar-color': task.color } as React.CSSProperties}
```

Le bloc d'avancement :

```tsx
      {/* Avancement : un trait de couleur pleine le long du bord bas (spec §7). Plus de hachures
          sous le titre, qui se lisait mal par-dessus. */}
      <div
        className="absolute bottom-0 left-0 data-bar-progress"
        style={{ width: `${task.progress}%` }}
        aria-hidden
      />
```

La poignée de liaison (le `<button>`), ses classes :

```tsx
              'absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-ink-soft bg-surface cursor-crosshair hover:bg-accent-soft',
```

Le titre : `<span className="relative min-w-0 truncate px-2 text-sm font-medium text-ink">{task.title}</span>`.

`BAR_BORDER_PX` reste importé et utilisé pour les poignées (il vaut 1 depuis Task 1).

- [ ] **Step 4: Vérifier que les tests passent**

Run: `npx vitest run tests/unit/components/gantt`
Attendu : PASS (hors `GanttToolbar.test.tsx` et `GanttSummary.test.tsx`, qui attendent encore `bg-yellow` : Task 13).

- [ ] **Step 5: Commit**

```bash
git add components/gantt/TaskBar.tsx tests/unit/components/gantt/TaskBar.test.tsx tests/unit/components/gantt/GanttView.test.tsx
git commit -m "feat(gantt): barre en teinte pâle et liseré, avancement en trait, sélection en or" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Grille, en-tête de frise, barre latérale, groupes, jalons, flèches

**Files:**
- Modify: `components/gantt/TimelineGrid.tsx:38-86`, `components/gantt/TimelineHeader.tsx:16-33`, `components/gantt/Sidebar.tsx:17-32`, `components/gantt/SidebarRow.tsx:43-155`, `components/gantt/GroupBar.tsx:22-30`, `components/gantt/MilestoneMark.tsx:30-41`, `components/gantt/DependencyArrows.tsx:44`, `components/gantt/GanttView.tsx:132, 149`
- Test: `tests/unit/components/gantt/TimelineGrid.test.tsx` (ajouter un cas ou créer), `tests/e2e/context-menu.spec.ts:38`

- [ ] **Step 1: Écrire le test qui échoue**

Il n'y a pas de test dédié à `TimelineGrid` ; ajouter ce cas dans `tests/unit/components/gantt/GanttView.test.tsx`, qui a déjà les cales jsdom et la fabrique `hydrate()` :

```tsx
  it('la colonne du jour est en or voilé, le trait du jour reste rouge (spec §7)', () => {
    hydrate()
    const { container } = render(<GanttView />)
    expect(container.querySelector('[data-testid="today-line"]')).toHaveClass('bg-today')
    expect(container.querySelector('[data-testid="today-column"]')).toHaveClass('bg-accent-soft')
  })
```

(`data-testid="today-column"` est ajouté à l'implémentation ci-dessous.)

Dans `tests/e2e/context-menu.spec.ts` ligne 38 : `toHaveClass(/bg-yellow/)` → `toHaveClass(/bg-accent-soft/)`.

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/gantt/GanttView.test.tsx`
Attendu : FAIL (`today-column` absent).

- [ ] **Step 3: Implémenter**

`TimelineGrid.tsx` : ligne 38 `bg-band` → `bg-surface` ; ligne 48 : `'absolute top-0 bottom-0 bg-ink/[0.03]', zoom === 'day' && 'hatch opacity-[0.06]'` ; la colonne du jour (lignes 54–56) :

```tsx
      {inRange && (
        <div data-testid="today-column" className="absolute top-0 bottom-0 bg-accent-soft" style={{ left: todayX, width: PX_PER_DAY[zoom] }} />
      )}
```

Ligne 64 (lundi) : `bg-ink/35` → `bg-ink-soft/50` ; ligne 76 : `border-ink/20` → `border-line` ; ligne 86 : `bg-cream/55` → `bg-paper/55`. Mettre à jour le commentaire des week-ends : « à 6 % d'encre » reste vrai ; celui de la colonne du jour : « une teinte d'or voilé : le jour courant est l'état actif de l'axe du temps ».

`TimelineHeader.tsx` ligne 16 : `className="relative border-b border-line bg-surface"` ; ligne 22 : `'absolute top-0 h-7 border-r border-line px-2 font-display text-xs font-medium leading-7 truncate'` ; ligne 23 : `bg-band` → `bg-paper` ; ligne 33 : `className="absolute top-7 h-7 border-r border-line border-t border-t-line text-center font-mono text-xs leading-7 truncate text-ink-soft"`.

`Sidebar.tsx` ligne 17 : `className="sticky left-0 z-20 touch-none border-r border-line bg-surface"` ; ligne 32 : `'flex w-full items-center gap-2 border-b border-dashed border-line pr-2 text-left text-sm font-medium text-ink-soft hover:bg-paper hover:text-ink focus-ring'`.

`SidebarRow.tsx` : ligne 43 `border-ink/20` → `border-line` ; ligne 48 `bg-band` → `bg-paper` ; ligne 49 `'bg-yellow text-on-data'` → `'bg-accent-soft'` ; ligne 66 : `text-ink/40` → `text-ink-soft`, `brutal-focus` → `focus-ring` ; ligne 82 : `brutal-focus` → `focus-ring` ; ligne 95 : `'flex-1 truncate text-base', task.type === 'group' && 'font-display font-medium'` ; ligne 106 : `className="rounded-full border border-line px-1.5 font-mono text-xs text-ink-soft"` ; lignes 121 et 139 : remplacer `border-[3px] border-ink bg-paper` par `rounded-control text-ink-soft`, `hover:bg-yellow hover:text-on-data` par `hover:bg-paper hover:text-ink`, `brutal-focus` par `focus-ring`, `font-bold` par `font-medium` ; ligne 155 : `'size-6 shrink-0 rounded-control leading-none hover:bg-paper focus-ring'`.

`GroupBar.tsx` ligne 22 : `selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2'` → `selected && 'outline-2 outline-accent outline-offset-2'` ; lignes 29–30 : `w-[3px]` → `w-[2px]`.

`MilestoneMark.tsx` ligne 30 : `'rotate-45 border border-ink-soft', selected && 'outline-2 outline-accent outline-offset-2'` ; ligne 41 : `'absolute top-1/2 z-20 -translate-y-1/2 rounded-full border border-ink-soft bg-surface cursor-crosshair hover:bg-accent-soft'`.

`DependencyArrows.tsx` ligne 44 : `className="stroke-cream"` → `className="stroke-paper/70"` (si Tailwind ne génère pas l'opacité sur `stroke-*`, utiliser `className="stroke-paper" strokeOpacity={0.7}`). Mettre à jour le commentaire : « Halo papier sous le trait ».

`GanttView.tsx` ligne 132 : `bg-cream` → `bg-paper` ; ligne 149 : `'sticky left-0 z-40 flex items-center border-b border-r border-line bg-surface px-3 font-display font-medium'`.

- [ ] **Step 4: Vérifier**

Run: `npx vitest run tests/unit/components/gantt && npm run typecheck`
Attendu : PASS hors `GanttToolbar.test.tsx` et `GanttSummary.test.tsx` (Task 13).

Run: `grep -nE "brutal|on-data|border-\[3px\]|yellow|cream|bg-band|hatch-data|uppercase|outline-dashed" components/gantt/TimelineGrid.tsx components/gantt/TimelineHeader.tsx components/gantt/Sidebar.tsx components/gantt/SidebarRow.tsx components/gantt/GroupBar.tsx components/gantt/MilestoneMark.tsx components/gantt/DependencyArrows.tsx components/gantt/GanttView.tsx`
Attendu : aucune ligne.

Run: `npx playwright test tests/e2e/context-menu.spec.ts tests/e2e/gantt-deps.spec.ts --reporter=line`
Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add components/gantt/TimelineGrid.tsx components/gantt/TimelineHeader.tsx components/gantt/Sidebar.tsx components/gantt/SidebarRow.tsx components/gantt/GroupBar.tsx components/gantt/MilestoneMark.tsx components/gantt/DependencyArrows.tsx components/gantt/GanttView.tsx tests/unit/components/gantt/GanttView.test.tsx tests/e2e/context-menu.spec.ts
git commit -m "feat(gantt): grille à filets, colonne du jour en or voilé, barre latérale et jalons apaisés" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Barre d'outils, zoom, pied, menu contextuel, éditeur, états

**Files:**
- Modify: `components/gantt/GanttToolbar.tsx:22, 46`, `components/gantt/ZoomControls.tsx:20-32`, `components/gantt/GanttSummary.tsx:57-105`, `components/gantt/ContextMenu.tsx:178-194`, `components/gantt/TaskEditor.tsx:254-360`, `components/gantt/EmptyProject.tsx:45-97`, `components/gantt/ProjectLoadError.tsx:14-25`, `components/gantt/RotateHint.tsx:34-44`
- Test: `tests/unit/components/gantt/GanttToolbar.test.tsx:28-30, 60-61`, `tests/unit/components/gantt/GanttSummary.test.tsx:33`, `tests/e2e/gantt-chaining.spec.ts:107-109`

- [ ] **Step 1: Réécrire les assertions qui échouent**

`GanttToolbar.test.tsx` lignes 28–30 :

```ts
    expect(screen.getByRole('button', { name: '+ Tâche' })).toHaveClass('bg-ink')
    expect(screen.getByRole('button', { name: '+ Jalon' })).toHaveClass('border-line')
    expect(screen.getByRole('button', { name: '+ Groupe' })).toHaveClass('border-line')
```

Lignes 60–61 :

```ts
    expect(screen.getByRole('button', { name: 'Jour' })).toHaveClass('bg-accent-soft')
    expect(screen.getByRole('group', { name: 'Zoom' })).toHaveClass('rounded-control', 'border-line')
```

`GanttSummary.test.tsx` ligne 33 : `toHaveClass('bg-yellow')` → `toHaveClass('bg-accent-soft')`.

`gantt-chaining.spec.ts` lignes 107–109 : les groupes ne sont plus en capitales ; remplacer le commentaire et l'assertion par :

```ts
  expect(await rowTitles(page)).toEqual(['Phase 1', 'Phase 2'])
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/gantt/GanttToolbar.test.tsx tests/unit/components/gantt/GanttSummary.test.tsx`
Attendu : FAIL.

- [ ] **Step 3: Implémenter**

`GanttToolbar.tsx` ligne 22 : `className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-2 sm:gap-3 sm:px-6 short:py-1"` ; ligne 46 : `triggerClassName="size-8 rounded-control bg-ink text-paper font-medium hover:bg-ink/88"` (c'est le « + » replié du téléphone, qui tient lieu d'action principale).

`ZoomControls.tsx` ligne 20 : `className="inline-flex overflow-hidden rounded-control border border-line bg-surface"` ; lignes 31–32 :

```tsx
            'px-2 py-1 text-sm font-medium border-r border-line last:border-r-0 focus-ring sm:px-3',
            zoom === l.value ? 'bg-accent-soft text-ink' : 'hover:bg-paper',
```

`GanttSummary.tsx` ligne 57 : `border-t-[3px] border-ink bg-paper px-6` → `border-t border-line bg-surface px-6 text-sm text-ink-soft` ; ligne 78 : `className="relative block h-1.5 w-24 overflow-hidden rounded-full bg-line"` ; ligne 80 : `className="absolute inset-y-0 left-0 bg-ink"` ; ligne 88 : garder ; lignes 104–105 :

```tsx
            'ml-auto shrink-0 rounded-control border px-2 py-0.5 text-sm font-medium focus-ring',
            highlightLate ? 'border-transparent bg-accent-soft text-ink' : 'border-transparent text-danger hover:bg-danger/8',
```

Ligne 42 du test (`Tâches` sans `uppercase`) reste vraie : vérifier que l'intitulé n'a pas `uppercase` dans le composant.

`ContextMenu.tsx` ligne 178 : `className="fixed z-50 min-w-56 rounded-card border border-line/60 bg-surface p-1.5 shadow-float dark:border-line"` ; ligne 191 : `'block w-full rounded-control px-3 py-2 text-left text-base font-medium outline-none hover:bg-paper focus-visible:bg-paper'` ; ligne 193 : `item.danger && 'text-danger hover:bg-danger/8 focus-visible:bg-danger/8'` ; ligne 194 : `item.danger && i > 0 && 'mt-1 border-t border-line pt-2'`.

`TaskEditor.tsx` ligne 254 : `className="rounded-control bg-accent-soft px-3 py-2 text-sm font-medium"` ; ligne 273 : `className="space-y-2 rounded-card border border-line bg-paper px-3 py-2"` ; lignes 299–300 : `'inline-flex size-8 items-center justify-center rounded-full border border-line focus-ring', color === c && 'border-ink'` ; ligne 310 : `className="text-base leading-none text-black/80"` ; lignes 304–309, le commentaire : remplacer par « Coche plutôt qu'un anneau : `focus-ring` pose `outline-none`, qui effacerait un `outline` de sélection ; le filet encre et la coche disent la pastille choisie. » ; ligne 338 : `className="space-y-2 rounded-card border border-line bg-paper px-3 py-2"` ; ligne 339 : `className="text-sm font-medium"` ; ligne 360 : `brutal-focus` → `focus-ring`.

`EmptyProject.tsx` ligne 45 : `className="pointer-events-auto sticky w-fit max-w-3xl space-y-5 rounded-card border border-line bg-surface p-4 sm:p-6"` ; ligne 64 : `border-t-[3px] border-ink` → `border-t border-line` ; ligne 65 : `font-display text-sm uppercase` → `font-display text-lg font-medium` ; ligne 73 : `border-t-[3px] border-ink pt-3 font-mono text-xs text-ink-soft` → `border-t border-line pt-3 text-sm text-ink-soft` ; ligne 97 : `border-[3px] border-ink p-3` → `rounded-card border border-line p-3`.

`ProjectLoadError.tsx` ligne 14 : `className="max-w-xl space-y-4 rounded-card border border-line bg-surface p-6"` ; ligne 15 : `font-display text-2xl uppercase` → `font-display text-[22px] font-medium` ; lignes 24–25 : `font-mono text-sm underline brutal-focus` → `text-sm underline underline-offset-4 focus-ring`.

`RotateHint.tsx` ligne 34 : `border-b-[3px] border-ink bg-yellow px-3 py-2 text-on-data` → `border-b border-line bg-accent-soft px-4 py-2 text-sm` ; ligne 44 : `className="shrink-0 rounded-control border border-line bg-surface px-2 py-0.5 text-xs font-medium focus-ring"`.

- [ ] **Step 4: Vérifier**

Run: `npx vitest run tests/unit/components/gantt && npm run typecheck`
Attendu : PASS.

Run: `grep -nE "brutal|on-data|border-\[3px\]|yellow|cream|bg-band|hatch|uppercase" components/gantt/*.tsx`
Attendu : aucune ligne (hormis `hatch` dans `TimelineGrid.tsx`, qui est l'utilitaire conservé).

Run: `npx playwright test tests/e2e/gantt-chaining.spec.ts tests/e2e/gantt-view.spec.ts tests/e2e/gantt-drag.spec.ts --reporter=line`
Attendu : PASS hors les deux échecs environnementaux connus.

- [ ] **Step 5: Commit**

```bash
git add components/gantt/GanttToolbar.tsx components/gantt/ZoomControls.tsx components/gantt/GanttSummary.tsx components/gantt/ContextMenu.tsx components/gantt/TaskEditor.tsx components/gantt/EmptyProject.tsx components/gantt/ProjectLoadError.tsx components/gantt/RotateHint.tsx tests/unit/components/gantt/GanttToolbar.test.tsx tests/unit/components/gantt/GanttSummary.test.tsx tests/e2e/gantt-chaining.spec.ts
git commit -m "feat(gantt): barre d'outils, zoom, pied, menu contextuel et éditeur dans l'identité éditoriale" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

# Lot 6 — Tickets et Membres

### Task 14: Les tickets

**Files:**
- Modify: `components/tickets/status.ts:8-11`, `components/tickets/TicketCard.tsx:12-106`, `components/tickets/TicketColumn.tsx:29-43`, `components/tickets/TicketList.tsx:31-58`, `components/tickets/TicketsToolbar.tsx:38-48`, `components/tickets/TicketsDisabled.tsx:26`
- Test: `tests/unit/components/tickets/TicketColumn.test.tsx:18, 35-37`, `tests/unit/components/tickets/TicketList.test.tsx:79`, `tests/unit/components/tickets/TicketsToolbar.test.tsx:33`, `tests/unit/components/tickets/TicketEditorAccent.test.tsx`, `tests/unit/components/tickets/TicketCard.test.tsx` (ajouter un cas)

**Interfaces:**
- Produit : `STATUS_SWATCH = { todo: 'bg-line', doing: 'bg-blue', done: 'bg-emerald' }` — la classe de couleur d'un liseré (carte, colonne, titre de fenêtre).

- [ ] **Step 1: Réécrire et ajouter les tests qui échouent**

`TicketColumn.test.tsx` ligne 18 : garder `not.toHaveClass('border-[3px]')` ; lignes 35 et 37 : `bg-yellow` → `bg-accent-soft`. Dans le premier test, remplacer `expect(screen.getByTestId('status-swatch')).toHaveClass('bg-emerald')` par `expect(screen.getByTestId('status-swatch')).toHaveClass('bg-emerald', 'rounded-full')`.

`TicketList.test.tsx` ligne 79 : `toHaveClass('bg-paper')` → `toHaveClass('bg-surface')`.

`TicketsToolbar.test.tsx` ligne 33 : `toHaveClass('bg-yellow')` → `toHaveClass('bg-accent-soft')`.

`TicketEditorAccent.test.tsx` : le titre du `describe` → « TicketEditor : liseré de statut » ; le test garde ses assertions (`dialog-accent` porte `bg-blue` puis `bg-emerald`, « Enregistrer » est `bg-ink`, « Supprimer » `text-danger`).

Dans `tests/unit/components/tickets/TicketCard.test.tsx` (fabrique `makeTicket` de `tests/unit/lib/tickets/fixtures`, constantes `todo` et `done` ; la carte est un `<article>`), ajouter, en reprenant l'appel `render(<TicketCard … />)` du premier test du fichier :

```ts
  it('est une surface à filet et liseré de statut, sans ombre (spec §8)', () => {
    const doing = makeTicket({ id: 'c', number: 3, title: 'Gamma', status: 'doing', taskId: null })
    render(<TicketCard ticket={doing} onPointerDown={() => {}} />) // mêmes props que le premier test
    const card = screen.getByRole('article')
    expect(card).toHaveClass('rounded-card', 'border-line', 'bg-surface')
    expect(Array.from(card.classList).some((c) => c.includes('shadow'))).toBe(false)
    expect(screen.getByTestId('status-accent')).toHaveClass('bg-blue', 'w-1', 'rounded-full')
  })
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `npx vitest run tests/unit/components/tickets`
Attendu : FAIL.

- [ ] **Step 3: Implémenter**

`status.ts` ligne 9 : `todo: 'bg-paper'` → `todo: 'bg-line'`.

`TicketCard.tsx` ligne 12 : `const ARROW = 'size-6 rounded-control text-xs leading-none text-ink-soft hover:bg-paper hover:text-ink focus-ring'` (sans `font-mono`) ; ligne 56 : `'group/card flex gap-3 rounded-card border border-line bg-surface p-3 select-none'` ; ligne 53, le commentaire : « Surface à filet, liseré de statut (spec §8). » ; ligne 65 : `className={cn('w-1 shrink-0 self-stretch rounded-full', STATUS_SWATCH[ticket.status])}` ; ligne 106 : `className="min-w-0 truncate rounded-full border border-line px-1.5 font-mono text-xs text-ink-soft"`.

`TicketColumn.tsx` ligne 29 : `className="flex items-center gap-2 pb-2"` (plus de filet sous l'en-tête : la colonne est sans cadre) ; ligne 30 : `className={cn('size-2.5 shrink-0 rounded-full', STATUS_SWATCH[status])}` ; ligne 31 : `className="font-display text-lg font-medium"` ; lignes 42–43 :

```tsx
              'flex h-16 items-center justify-center rounded-card border border-dashed text-sm',
              hovered ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-soft',
```

`TicketList.tsx` ligne 31 : `className="overflow-x-auto rounded-card border border-line"` ; ligne 32 : `className="w-full border-collapse bg-surface text-base"` ; ligne 34 : `className="border-b border-line text-left"` ; lignes 35–39 : `font-display uppercase text-xs` → `text-xs font-medium text-ink-soft` ; ligne 47 : `border-ink/20` → `border-line`, et ajouter `h-12` ; ligne 58 : `font-bold underline-offset-4 hover:underline brutal-focus` → `font-medium underline-offset-4 hover:underline focus-ring`.

`TicketsToolbar.tsx` lignes 38–39 :

```tsx
        'px-3 py-1 text-sm font-medium border-r border-line last:border-r-0 focus-ring',
        view === target ? 'bg-accent-soft text-ink' : 'hover:bg-paper',
```

Ligne 47 : `border-b-[3px] border-ink bg-paper px-3` → `border-b border-line bg-surface px-4` ; ligne 48 : `className="inline-flex overflow-hidden rounded-control border border-line bg-surface"`.

`TicketsDisabled.tsx` ligne 26 : `className="space-y-3 rounded-card border border-line bg-surface p-6"`.

- [ ] **Step 4: Vérifier**

Run: `npx vitest run tests/unit/components/tickets && npm run typecheck`
Attendu : PASS.

Run: `grep -nE "brutal|on-data|border-\[3px\]|yellow|cream|bg-band|hatch|uppercase|shadow-\[" components/tickets/*.ts*`
Attendu : aucune ligne.

Run: `npx playwright test tests/e2e/tickets.spec.ts --reporter=line`
Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add components/tickets/status.ts components/tickets/TicketCard.tsx components/tickets/TicketColumn.tsx components/tickets/TicketList.tsx components/tickets/TicketsToolbar.tsx components/tickets/TicketsDisabled.tsx tests/unit/components/tickets
git commit -m "feat(tickets): cartes à liseré de statut, colonnes sans cadre, tableau à filets" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Les membres

**Files:**
- Modify: `components/members/MembersPage.tsx:46` (et les lignes de tableau qu'on y trouve)
- Test: `tests/unit/components/members/MembersPage.test.tsx` (ajouter un cas, ou créer)

- [ ] **Step 1: Écrire le test qui échoue**

Dans `tests/unit/components/members/MembersPage.test.tsx` (props de `MembersPage` : `projectId`, `members`, `invitations`, `isOwner`), ajouter, en reprenant l'appel `render(<MembersPage … />)` du premier test du fichier :

```ts
  it('le tableau est une surface à filets, sans ombre (spec §9)', () => {
    render(<MembersPage projectId="p1" members={members} invitations={[]} isOwner />) // mêmes props que le premier test
    const table = screen.getByRole('table')
    const frame = table.parentElement!
    expect(frame).toHaveClass('rounded-card', 'border-line', 'bg-surface')
    expect(Array.from(frame.classList).some((c) => c.includes('shadow'))).toBe(false)
  })
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/members`
Attendu : FAIL.

- [ ] **Step 3: Implémenter**

Ligne 46 : `className="rounded-card border border-line bg-surface px-4"`. Lire le reste du fichier (70 lignes) : toute ligne de tableau en `border-b border-ink/20` passe en `border-line` ; tout `font-bold` de libellé passe en `font-medium` ; le bouton de retrait est un `Button variant="danger-quiet" size="sm"` ; « Inviter » est le seul `primary`.

- [ ] **Step 4: Vérifier**

Run: `npx vitest run tests/unit/components/members && npm run typecheck`
Attendu : PASS.

Run: `npx playwright test tests/e2e/members.spec.ts --reporter=line` (nom réel : `ls tests/e2e | grep -i membre`).
Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add components/members/MembersPage.tsx tests/unit/components/members
git commit -m "feat(members): tableau à filets sur surface" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

# Lot 7 — Passe finale

### Task 16: Garde-fou typographique, README, vérifications, contrôle visuel

**Files:**
- Create: `tests/unit/design/typography.test.ts`
- Delete: `tests/unit/components/ui/Casing.test.tsx` (absorbé)
- Modify: `README.md` (sections « Marque et icônes », « Thème sombre », et une nouvelle section « Design »)

- [ ] **Step 1: Écrire le test de typographie**

Créer `tests/unit/design/typography.test.ts` :

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

// Garde-fou de la spec §3 : aucune capitale forcée, rien sous 13 px, plus aucun utilitaire ni
// jeton du brutalisme. Lu dans les sources de `app/` et `components/` (TSX, TS, CSS).
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(p)) out.push(p)
  }
  return out
}
const files = [...walk('app'), ...walk('components')]
const offenders = (re: RegExp) => files.filter((f) => re.test(readFileSync(f, 'utf8')))

describe('typographie et identité (spec §3)', () => {
  it('aucune capitale forcée', () => {
    expect(offenders(/\buppercase\b/)).toEqual([])
  })
  it('aucune taille arbitraire sous 13 px', () => {
    expect(offenders(/text-\[(?:[0-9]|1[0-2])px\]/)).toEqual([])
  })
  it('plus aucun utilitaire ni jeton brutaliste', () => {
    expect(offenders(/shadow-brutal|brutal-focus|brutal-press|\bbrutal\b|hatch-data|on-data|bg-cream|text-cream|stroke-cream|bg-header|on-header|bg-band|border-\[3px\]|border-[trbl]-\[3px\]|bg-yellow|text-yellow|border-yellow|outline-dashed/)).toEqual([])
  })
  it('les libellés de champ sont en casse mixte', () => {
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

Renommer le fichier en `.tsx` si Vitest refuse le JSX dans un `.ts` (`tests/unit/design/typography.test.tsx`). Supprimer `tests/unit/components/ui/Casing.test.tsx` (`git rm`).

- [ ] **Step 2: Lancer le test et nettoyer ce qu'il trouve**

Run: `npx vitest run tests/unit/design/typography.test.tsx`

Chaque fichier listé est à corriger : soit une classe oubliée (la remplacer selon la règle de la tâche concernée), soit un **commentaire** qui cite l'ancien mot (`uppercase`, `brutal-focus`…) — reformuler le commentaire. Fichiers connus à vérifier : `components/layout/Logo.tsx` (commentaire sur `normal-case`), `components/gantt/TaskEditor.tsx` (commentaire sur `brutal-focus`, réécrit en Task 13), `components/gantt/SidebarRow.tsx`.

Relancer jusqu'à PASS.

- [ ] **Step 3: Mettre le README à jour**

Section « Marque et icônes » : remplacer « va chercher Archivo Black chez Google Fonts » par « va chercher Fraunces chez Google Fonts », et « Le nom s'écrit « BradGantt », en casse mixte et sans soulignement : le jaune ne signifie plus que « actif », partout. » par « Le nom s'écrit « BradGantt », en Fraunces et en casse mixte. Le signe est un carré d'encre nu : plus de cadre clair, il n'a plus de bandeau sombre d'où se détacher. »

Section « Thème sombre », dernier paragraphe : remplacer « Seule la STRUCTURE s'inverse (crème, papier, encre, bandes). Les couleurs de tâches et le jaune ne changent pas, et le texte posé sur elles utilise le jeton `on-data` (encre noire fixe) — `text-ink` deviendrait crème sur tangerine la nuit. L'en-tête a ses propres jetons (`header`, `on-header`) pour rester sombre dans les deux thèmes. » par « Seule la STRUCTURE s'inverse (`paper`, `surface`, `ink`, `ink-soft`, `line`). L'or, les rouges et les huit couleurs de tâches ne changent pas ; une barre les porte en teinte pâle (`--data-tint`, 32 % le jour, 45 % la nuit) sous un texte en encre du thème, et le CSS de `.data-bar` fait seul la conversion. La variante Tailwind `dark:` cible `[data-theme="dark"]`. »

Ajouter, juste avant « Marque et icônes », une section :

```markdown
## Design

BradGantt a une identité **éditoriale** (spec `docs/superpowers/specs/2026-10-08-bradgantt-identite-editoriale-design.md`) :
papier chaud et encre graphite, Fraunces pour les titres, IBM Plex Sans pour l'interface,
JetBrains Mono pour les chiffres et les dates. Les jetons vivent dans `app/globals.css` et
s'organisent par registre : structure (`paper`, `surface`, `ink`, `ink-soft`, `line`), état
(`accent`, l'or, qui ne signifie que « actif », et `accent-soft`), repères (`today`, `danger`),
données (huit couleurs de tâches, portées en teinte pâle et liseré par l'utilitaire `data-bar`).

Trois règles gouvernent les écrans : une seule action principale (encre pleine) par écran, une
fenêtre ouverte comptant comme un écran ; les commandes d'objet (« ⋯ », poignées, flèches) sont
révélées au survol par l'opacité, jamais par rendu conditionnel ; une action destructive est sobre
au repos (texte rouge) et ne devient rouge pleine qu'à la confirmation. Les ombres n'appartiennent
qu'à ce qui flotte (`shadow-float` pour un menu, `shadow-dialog` pour une fenêtre).

L'échelle de texte remplace celle de Tailwind : `text-xs` vaut 13 px, `text-sm` 14, `text-base`
15 — rien ne descend sous 13 px, aucune capitale n'est forcée, et `tests/unit/design/` le vérifie
en lisant les sources.
```

- [ ] **Step 4: Lancer toutes les vérifications**

Run: `npm test`
Attendu : PASS.

Run: `npm run typecheck && npm run lint`
Attendu : aucune erreur.

Run: `npm run test:db`
Attendu : PASS (aucune migration : contrôle de non-régression).

Run: `npm run build` puis relancer le serveur de dev en arrière-plan.
Attendu : build sans erreur ; noter la taille « First Load JS » de `/projects/[id]` (205 kB avant ce lot : elle ne doit pas monter de plus de quelques kilo-octets, les fontes étant servies à part).

Run: `npm run test:e2e` (en arrière-plan, ~15 min)
Attendu : PASS, à l'exception des trois échecs environnementaux connus. Tout autre échec est un défaut du lot : le corriger dans la tâche responsable (nouveau commit), jamais en affaiblissant un test.

- [ ] **Step 5: Contrôle visuel**

Avec le serveur de dev sur 3100, ouvrir dans un navigateur, en clair puis en sombre (menu du compte), puis à 390 px de large : `/login`, `/projects`, le Gantt du projet démo, `/projects/<id>/tickets` de « Projet tickets » (kanban et `?vue=liste`), `/projects/<id>/membres`, une fenêtre (« Nouvelle tâche ») et un menu « ⋯ ». Vérifier sur chaque écran :

- un seul bouton d'encre pleine visible ;
- l'onglet courant souligné d'or, la colonne du jour en or voilé, aucun autre or ;
- les barres lisibles dans les deux thèmes (titre en encre sur teinte pâle), le trait d'avancement visible ;
- aucun aplat de couleur de tâche hors du signe ;
- rien ne déborde à 390 px, la fenêtre vient du bas et son pied passe à la ligne.

Ne RIEN écrire dans le projet démo pendant ce contrôle. Toute anomalie se corrige dans le jeton ou le composant responsable, en nouveau commit.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/design/typography.test.tsx README.md
git rm tests/unit/components/ui/Casing.test.tsx
git commit -m "test(design): garde-fou typographique ; docs: l'identité éditoriale dans le README" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Intégration

Une fois les seize tâches passées, les cinq commandes de vérification au vert (hors échecs environnementaux connus), le contrôle visuel fait et l'accord de Léo :

```bash
git checkout master
git merge --ff-only feat/06-identite-editoriale
git push origin master
```

Le `--ff-only` est délibéré : ce dépôt intègre en avance rapide, sans demande de fusion. Si la fusion est refusée, c'est que `master` a bougé — rebaser `feat/06-identite-editoriale` dessus, relancer les vérifications, et recommencer. Vercel déploie `master` automatiquement ; vérifier ensuite `https://brad-gantt.vercel.app/login` et l'image `/opengraph-image`.
