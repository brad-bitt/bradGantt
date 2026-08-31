# BradGantt — Plan 1/3 : Fondations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser le socle de BradGantt — projet Next.js 15 néo-brutaliste, schéma Supabase avec RLS testée, authentification, et gestion des projets — pour que le plan 2 (moteur Gantt) ne parle plus qu'au Gantt.

**Architecture:** Next.js 15 App Router (TypeScript strict, Tailwind v4 avec tokens `@theme`) en front ; Supabase (Postgres + Auth + RLS) en back, développé en local via le CLI Supabase (Docker). Les composants `ui/` encapsulent tout le style néo-brutaliste. L'accès aux données passe par des clients Supabase typés (navigateur / serveur / middleware) et des server actions.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, Zustand (plan 2), @supabase/ssr + @supabase/supabase-js, date-fns, Vitest + Testing Library, Playwright, pgTAP (via `supabase test db`).

**Spec:** `docs/superpowers/specs/2026-08-28-bradgantt-design.md` — sections 3 (stack), 4 (modèle de données, triggers, RLS), 5 (structure), 8 (auth), 9 (design system), 10 (erreurs), 11 (tests).

## Global Constraints

- Next.js **15** (App Router), TypeScript `strict: true`, alias `@/*` vers la racine du projet.
- Tailwind **v4** : les tokens du spec §9 vivent dans `app/globals.css` sous `@theme` (le spec cite `tailwind.config.ts`, obsolète en v4 — c'est le seul écart assumé).
- Couleurs exactes : fond `#FDF6E3`, encre `#111111`, blanc `#FFFFFF`, jaune `#FFD500`, rose `#FF6B9D`, bleu `#3B82F6`, vert `#22C55E`, orange `#FF8A00`, violet `#A855F7`, danger `#EF4444`.
- Style : bordure `3px solid #111` partout, `border-radius: 0`, ombre `4px 4px 0 #111`, hover `6px 6px 0 #111`, actif `0 0 0` + `translate(4px,4px)`, sélection/focus `3px dashed #111`.
- Polices : **Archivo Black** (titres), **Space Grotesk** (UI), **JetBrains Mono** (dates, nombres) via `next/font/google`.
- Textes d'interface en **français**.
- Aucune librairie Gantt, aucune librairie de composants UI (pas de shadcn, pas de Radix) : les composants `ui/` sont écrits à la main.
- Rôles : `owner` | `editor` | `viewer`. Types de tâche : `task` | `milestone` | `group`.
- Convention Davidson : travailler sur une branche (`feat/01-fondations`), `git add <fichiers>` explicites, jamais `git add .`, jamais `--no-verify`. Chaque commit se termine par les trailers `Co-Authored-By` / `Claude-Session` fournis par l'environnement.
- Supabase local : `supabase start` doit tourner (Docker) pour les tâches 5 à 9. Les tests SQL se lancent avec `supabase test db`.

---

## Carte des fichiers

| Fichier | Responsabilité |
|---|---|
| `app/globals.css` | Import Tailwind, tokens `@theme`, styles de base (fond crème, encre) |
| `app/layout.tsx` | Polices, `<html lang="fr">`, `<Toaster/>` |
| `app/page.tsx` | Redirige selon session (géré par le middleware) |
| `app/(auth)/login/page.tsx` | Page de connexion (Google + magic-link) |
| `app/auth/callback/route.ts` | Échange du code OAuth/OTP contre une session |
| `app/(app)/layout.tsx` | Garde de session + `<AppHeader/>` |
| `app/(app)/projects/page.tsx` | Liste « mes projets » |
| `app/(app)/projects/actions.ts` | Server actions : créer / renommer / supprimer un projet, se déconnecter |
| `app/e2e-login/page.tsx` | Page de login par mot de passe, **uniquement** si `NEXT_PUBLIC_E2E=1` (tests Playwright) |
| `components/ui/*.tsx` | Button, Badge, Input, Select, Checkbox, Dialog, Avatar, Toast |
| `components/layout/AppHeader.tsx` | En-tête : logo, avatar utilisateur, bouton déconnexion |
| `components/project/ProjectCard.tsx`, `NewProjectDialog.tsx`, `RenameProjectDialog.tsx` | UI de la liste de projets |
| `lib/utils.ts` | `cn()` (concaténation de classes) |
| `lib/auth/redirect.ts` | `resolveAuthRedirect()` et `safeNext()` — logique pure du middleware |
| `lib/projects/validate.ts` | `validateProjectName()` |
| `lib/supabase/client.ts`, `server.ts`, `middleware.ts`, `types.ts` | Clients Supabase (navigateur, serveur, middleware) + types générés |
| `lib/toast/store.ts` | Store Zustand des toasts (`toast.error(...)`, `toast.success(...)`) |
| `middleware.ts` | Rafraîchit la session, redirige vers `/login?next=` |
| `supabase/migrations/20260831000001_schema.sql` | Tables, enums, triggers, fonctions |
| `supabase/migrations/20260831000002_rls.sql` | Policies RLS |
| `supabase/tests/0001_schema.test.sql`, `0002_rls.test.sql` | Tests pgTAP |
| `supabase/seed.sql` | Utilisateurs de test (alice / bob / carol / dave) |
| `tests/unit/**/*.test.ts(x)` | Vitest |
| `tests/e2e/**/*.spec.ts`, `tests/e2e/helpers.ts`, `playwright.config.ts` | Playwright |

---

### Task 1 : Scaffold Next.js 15 + Vitest

**Files:**
- Create : projet Next.js à la racine du dépôt (`app/`, `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`)
- Create : `vitest.config.ts`, `tests/setup.ts`, `lib/utils.ts`, `tests/unit/lib/utils.test.ts`
- Modify : `.gitignore` (ajouter `.env.local`, `test-results/`, `playwright-report/`)

**Interfaces:**
- Produces : `cn(...classes: (string | false | null | undefined)[]): string` dans `lib/utils.ts` ; scripts npm `dev`, `build`, `test`, `test:watch`.

- [ ] **Step 1 : Créer la branche de travail**

```bash
git checkout -b feat/01-fondations
```

- [ ] **Step 2 : Scaffolder Next.js 15 dans le dépôt (le dossier `docs/` est toléré par create-next-app)**

```bash
npx create-next-app@15 . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Répondre « yes » si l'outil demande confirmation pour le dossier courant. Vérifier ensuite : `cat package.json | grep '"next"'` → version `15.x` ; `cat app/globals.css | head -3` → doit contenir `@import "tailwindcss";` (Tailwind v4).

- [ ] **Step 3 : Installer les dépendances de test et les dépendances applicatives du plan**

```bash
npm install @supabase/ssr @supabase/supabase-js date-fns zustand
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test supabase
```

- [ ] **Step 4 : Configurer Vitest**

`vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

`tests/setup.ts` :

```ts
import '@testing-library/jest-dom/vitest'
```

Dans `package.json`, section `scripts`, ajouter :

```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test",
"test:db": "supabase test db",
"typecheck": "tsc --noEmit"
```

Dans `tsconfig.json`, ajouter `"types": ["vitest/globals", "@testing-library/jest-dom"]` dans `compilerOptions` et vérifier que `"strict": true`.

- [ ] **Step 5 : Écrire le test de `cn()` (échoue : module absent)**

`tests/unit/lib/utils.test.ts` :

```ts
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('concatène les classes et ignore les valeurs fausses', () => {
    expect(cn('a', false, 'b', null, undefined, 'c')).toBe('a b c')
  })
  it('retourne une chaîne vide sans argument', () => {
    expect(cn()).toBe('')
  })
})
```

- [ ] **Step 6 : Lancer le test, vérifier l'échec**

Run : `npm test`
Expected : FAIL — `Cannot find module '@/lib/utils'`

- [ ] **Step 7 : Implémenter `cn()`**

`lib/utils.ts` :

```ts
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
```

- [ ] **Step 8 : Relancer les tests**

Run : `npm test`
Expected : PASS (2 tests)

- [ ] **Step 9 : Compléter `.gitignore` et committer**

Ajouter à `.gitignore` :

```
.env.local
test-results/
playwright-report/
supabase/.temp/
```

```bash
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs .gitignore app/ public/ vitest.config.ts tests/setup.ts lib/utils.ts tests/unit/lib/utils.test.ts next-env.d.ts
git commit -m "chore: scaffold Next.js 15 + Vitest"
```

---

### Task 2 : Tokens néo-brutalistes, polices, Button et Badge

**Files:**
- Modify : `app/globals.css`, `app/layout.tsx`
- Create : `components/ui/Button.tsx`, `components/ui/Badge.tsx`
- Test : `tests/unit/components/ui/Button.test.tsx`, `tests/unit/components/ui/Badge.test.tsx`

**Interfaces:**
- Produces :
  - Classes Tailwind : couleurs `bg-cream`, `text-ink`, `bg-yellow`, `bg-pink`, `bg-blue`, `bg-green`, `bg-orange`, `bg-purple`, `bg-danger` ; ombres `shadow-brutal`, `shadow-brutal-lg`, `shadow-brutal-xl` ; polices `font-display`, `font-ui`, `font-mono`.
  - Classe utilitaire globale `.brutal` (bordure 3 px + ombre 4 px + radius 0) et `.brutal-focus`.
  - `Button` : `({ variant?: 'primary'|'secondary'|'danger'|'ghost', size?: 'sm'|'md', ...ButtonHTMLAttributes })`.
  - `Badge` : `({ color?: 'yellow'|'pink'|'blue'|'green'|'orange'|'purple'|'ink', children })`.

- [ ] **Step 1 : Écrire les tokens dans `app/globals.css`** (remplacer tout le contenu)

```css
@import "tailwindcss";

@theme inline {
  --color-cream: #FDF6E3;
  --color-ink: #111111;
  --color-paper: #FFFFFF;
  --color-yellow: #FFD500;
  --color-pink: #FF6B9D;
  --color-blue: #3B82F6;
  --color-green: #22C55E;
  --color-orange: #FF8A00;
  --color-purple: #A855F7;
  --color-danger: #EF4444;

  --shadow-brutal: 4px 4px 0 #111111;
  --shadow-brutal-lg: 6px 6px 0 #111111;
  --shadow-brutal-xl: 8px 8px 0 #111111;

  --font-display: var(--font-archivo-black), Impact, sans-serif;
  --font-ui: var(--font-space-grotesk), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), ui-monospace, monospace;

  --radius: 0;
}

@layer base {
  * { border-radius: 0 !important; }
  body { @apply bg-cream text-ink font-ui antialiased; }
  h1, h2, h3 { @apply font-display uppercase tracking-tight; }
}

@layer utilities {
  .brutal { @apply border-[3px] border-ink shadow-brutal; }
  .brutal-focus { @apply outline-none focus-visible:outline-[3px] focus-visible:outline-dashed focus-visible:outline-ink focus-visible:outline-offset-2; }
  .brutal-press { @apply transition-[box-shadow,transform] duration-75 hover:shadow-brutal-lg active:shadow-none active:translate-x-1 active:translate-y-1; }
}
```

- [ ] **Step 2 : Charger les polices dans `app/layout.tsx`** (remplacer tout le contenu)

```tsx
import type { Metadata } from 'next'
import { Archivo_Black, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-archivo-black' })
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'BradGantt',
  description: 'Diagrammes de Gantt collaboratifs, brutalement simples.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${archivo.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3 : Écrire les tests Button et Badge (échouent : modules absents)**

`tests/unit/components/ui/Button.test.tsx` :

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
})
```

`tests/unit/components/ui/Badge.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('rend le contenu avec la couleur demandée', () => {
    render(<Badge color="pink">viewer</Badge>)
    expect(screen.getByText('viewer')).toHaveClass('bg-pink')
  })
  it('est jaune par défaut', () => {
    render(<Badge>owner</Badge>)
    expect(screen.getByText('owner')).toHaveClass('bg-yellow')
  })
})
```

- [ ] **Step 4 : Lancer, vérifier l'échec**

Run : `npm test`
Expected : FAIL — `Cannot find module '@/components/ui/Button'` (et Badge)

- [ ] **Step 5 : Implémenter Button et Badge**

`components/ui/Button.tsx` :

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary: 'bg-yellow text-ink brutal brutal-press',
  secondary: 'bg-paper text-ink brutal brutal-press',
  danger: 'bg-danger text-paper brutal brutal-press',
  ghost: 'bg-transparent text-ink border-[3px] border-transparent hover:border-ink',
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
        'inline-flex items-center justify-center gap-2 font-ui font-bold uppercase tracking-wide brutal-focus disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
```

`components/ui/Badge.tsx` :

```tsx
import { cn } from '@/lib/utils'

export type BadgeColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'purple' | 'ink'

const colors: Record<BadgeColor, string> = {
  yellow: 'bg-yellow text-ink',
  pink: 'bg-pink text-ink',
  blue: 'bg-blue text-paper',
  green: 'bg-green text-ink',
  orange: 'bg-orange text-ink',
  purple: 'bg-purple text-paper',
  ink: 'bg-ink text-paper',
}

export function Badge({ color = 'yellow', className, children }: { color?: BadgeColor; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-block border-[3px] border-ink px-2 py-0.5 font-mono text-xs font-bold uppercase', colors[color], className)}>
      {children}
    </span>
  )
}
```

- [ ] **Step 6 : Relancer les tests**

Run : `npm test`
Expected : PASS (8 tests)

- [ ] **Step 7 : Vérifier visuellement** — remplacer `app/page.tsx` par une page de démonstration temporaire :

```tsx
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function Home() {
  return (
    <main className="p-10 space-y-6">
      <h1 className="text-5xl">BradGantt</h1>
      <div className="flex gap-4">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
      <div className="flex gap-2"><Badge>owner</Badge><Badge color="blue">editor</Badge><Badge color="pink">viewer</Badge></div>
    </main>
  )
}
```

Run : `npm run dev` puis ouvrir http://localhost:3000. Expected : fond crème, titre en Archivo Black, boutons à bordure 3 px et ombre dure qui « s'enfonce » au clic. Arrêter le serveur.

- [ ] **Step 8 : Commit**

```bash
git add app/globals.css app/layout.tsx app/page.tsx components/ui/Button.tsx components/ui/Badge.tsx tests/unit/components/ui/Button.test.tsx tests/unit/components/ui/Badge.test.tsx
git commit -m "feat(ui): tokens néo-brutalistes, polices, Button et Badge"
```

---

### Task 3 : Input, Select, Checkbox

**Files:**
- Create : `components/ui/Input.tsx`, `components/ui/Select.tsx`, `components/ui/Checkbox.tsx`
- Test : `tests/unit/components/ui/FormControls.test.tsx`

**Interfaces:**
- Produces :
  - `Input` : `({ label?: string; error?: string; ...InputHTMLAttributes })` — rend `<label>` + `<input>` + message d'erreur (`role="alert"`).
  - `Select` : `({ label?: string; options: { value: string; label: string }[]; ...SelectHTMLAttributes })`.
  - `Checkbox` : `({ label: string; ...InputHTMLAttributes })`.

- [ ] **Step 1 : Écrire les tests**

`tests/unit/components/ui/FormControls.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'

describe('Input', () => {
  it('associe le label au champ', () => {
    render(<Input label="Email" name="email" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('name', 'email')
  })
  it("affiche l'erreur et marque le champ invalide", () => {
    render(<Input label="Nom" error="Le nom est requis" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Le nom est requis')
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('Select', () => {
  it('rend les options et remonte le changement', async () => {
    const onChange = vi.fn()
    render(
      <Select label="Rôle" onChange={onChange} defaultValue="viewer"
        options={[{ value: 'editor', label: 'Éditeur' }, { value: 'viewer', label: 'Lecteur' }]} />,
    )
    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'editor')
    expect(onChange).toHaveBeenCalled()
    expect(screen.getByLabelText('Rôle')).toHaveValue('editor')
  })
})

describe('Checkbox', () => {
  it('bascule au clic sur le label', async () => {
    render(<Checkbox label="Replié" />)
    const box = screen.getByLabelText('Replié')
    expect(box).not.toBeChecked()
    await userEvent.click(screen.getByText('Replié'))
    expect(box).toBeChecked()
  })
})
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm test`
Expected : FAIL — modules introuvables

- [ ] **Step 3 : Implémenter**

`components/ui/Input.tsx` :

```tsx
import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="font-bold uppercase text-sm">{label}</label>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn('bg-paper border-[3px] border-ink px-3 py-2 font-ui brutal-focus placeholder:text-ink/40', error && 'border-danger', className)}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-danger text-sm font-bold">{error}</p>}
    </div>
  )
})
```

`components/ui/Select.tsx` :

```tsx
import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SelectOption { value: string; label: string }
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={selectId} className="font-bold uppercase text-sm">{label}</label>}
      <select
        ref={ref}
        id={selectId}
        className={cn('bg-paper border-[3px] border-ink px-3 py-2 font-ui brutal-focus appearance-none', className)}
        {...props}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
})
```

`components/ui/Checkbox.tsx` :

```tsx
import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> { label: string }

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <label htmlFor={inputId} className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input ref={ref} id={inputId} type="checkbox"
        className={cn('appearance-none size-5 border-[3px] border-ink bg-paper checked:bg-ink brutal-focus', className)} {...props} />
      <span className="font-bold text-sm">{label}</span>
    </label>
  )
})
```

- [ ] **Step 4 : Relancer les tests**

Run : `npm test`
Expected : PASS (12 tests)

- [ ] **Step 5 : Commit**

```bash
git add components/ui/Input.tsx components/ui/Select.tsx components/ui/Checkbox.tsx tests/unit/components/ui/FormControls.test.tsx
git commit -m "feat(ui): Input, Select, Checkbox"
```

---

### Task 4 : Dialog, Avatar, Toast

**Files:**
- Create : `components/ui/Dialog.tsx`, `components/ui/Avatar.tsx`, `components/ui/Toast.tsx`, `lib/toast/store.ts`
- Modify : `app/layout.tsx` (monter `<Toaster/>`)
- Test : `tests/unit/components/ui/Dialog.test.tsx`, `tests/unit/components/ui/Avatar.test.tsx`, `tests/unit/lib/toast.test.ts`

**Interfaces:**
- Produces :
  - `Dialog` : `({ open: boolean; onClose: () => void; title: string; children; footer?: ReactNode })` — `role="dialog"`, fermé par `Échap` et par le bouton « Fermer ».
  - `Avatar` : `({ name: string; color: string; src?: string | null; size?: 'sm'|'md' })` — carré, initiales (2 lettres max), `title={name}`.
  - `toast` (objet) : `toast.success(message: string)`, `toast.error(message: string)` ; `useToastStore` ; `<Toaster/>`.
  - `initials(name: string): string` exportée depuis `Avatar.tsx`.

- [ ] **Step 1 : Écrire les tests**

`tests/unit/components/ui/Dialog.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from '@/components/ui/Dialog'

describe('Dialog', () => {
  it('ne rend rien si fermé', () => {
    render(<Dialog open={false} onClose={() => {}} title="Test">contenu</Dialog>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('rend le titre et le contenu si ouvert', () => {
    render(<Dialog open onClose={() => {}} title="Nouveau projet">contenu</Dialog>)
    expect(screen.getByRole('dialog', { name: 'Nouveau projet' })).toBeInTheDocument()
    expect(screen.getByText('contenu')).toBeInTheDocument()
  })
  it('appelle onClose sur Échap et sur le bouton Fermer', async () => {
    const onClose = vi.fn()
    render(<Dialog open onClose={onClose} title="T">x</Dialog>)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
```

`tests/unit/components/ui/Avatar.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { Avatar, initials } from '@/components/ui/Avatar'

describe('initials', () => {
  it('prend les initiales des deux premiers mots', () => expect(initials('Alice Test')).toBe('AT'))
  it('prend deux lettres si un seul mot', () => expect(initials('bob')).toBe('BO'))
  it('gère une chaîne vide', () => expect(initials('')).toBe('?'))
})

describe('Avatar', () => {
  it('affiche les initiales avec la couleur du membre', () => {
    render(<Avatar name="Alice Test" color="#FF6B9D" />)
    const el = screen.getByTitle('Alice Test')
    expect(el).toHaveTextContent('AT')
    expect(el).toHaveStyle({ backgroundColor: '#FF6B9D' })
  })
  it("affiche l'image si src fourni", () => {
    render(<Avatar name="Alice" color="#FFD500" src="https://x/y.png" />)
    expect(screen.getByRole('img', { name: 'Alice' })).toHaveAttribute('src', 'https://x/y.png')
  })
})
```

`tests/unit/lib/toast.test.ts` :

```ts
import { toast, useToastStore } from '@/lib/toast/store'

describe('toast store', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }))

  it('ajoute un toast d\'erreur', () => {
    toast.error('Modification non enregistrée')
    const [t] = useToastStore.getState().toasts
    expect(t).toMatchObject({ kind: 'error', message: 'Modification non enregistrée' })
  })

  it('retire un toast par id', () => {
    toast.success('Ok')
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm test`
Expected : FAIL — modules introuvables

- [ ] **Step 3 : Implémenter le store de toasts**

`lib/toast/store.ts` :

```ts
import { create } from 'zustand'

export type ToastKind = 'success' | 'error'
export interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastState {
  toasts: ToastItem[]
  push: (kind: ToastKind, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    if (typeof window !== 'undefined') {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  error: (message: string) => useToastStore.getState().push('error', message),
}
```

- [ ] **Step 4 : Implémenter Toast, Dialog, Avatar**

`components/ui/Toast.tsx` :

```tsx
'use client'
import { useToastStore } from '@/lib/toast/store'
import { cn } from '@/lib/utils'

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <button key={t.id} type="button" onClick={() => dismiss(t.id)}
          className={cn('brutal px-4 py-3 font-bold text-left min-w-64', t.kind === 'error' ? 'bg-danger text-paper' : 'bg-green text-ink')}>
          {t.message}
        </button>
      ))}
    </div>
  )
}
```

`components/ui/Dialog.tsx` :

```tsx
'use client'
import { useEffect, useId, type ReactNode } from 'react'
import { Button } from './Button'

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="bg-paper border-[3px] border-ink shadow-brutal-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b-[3px] border-ink px-5 py-3 bg-yellow">
          <h2 id={titleId} className="text-xl">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">✕</Button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-3 border-t-[3px] border-ink px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}
```

`components/ui/Avatar.tsx` :

```tsx
import { cn } from '@/lib/utils'

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export interface AvatarProps { name: string; color: string; src?: string | null; size?: 'sm' | 'md'; className?: string }

export function Avatar({ name, color, src, size = 'md', className }: AvatarProps) {
  const dim = size === 'sm' ? 'size-7 text-xs' : 'size-10 text-sm'
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} title={name} className={cn('border-[3px] border-ink object-cover', dim, className)} />
  }
  return (
    <span title={name} style={{ backgroundColor: color }}
      className={cn('inline-flex items-center justify-center border-[3px] border-ink font-display', dim, className)}>
      {initials(name)}
    </span>
  )
}
```

Dans `app/layout.tsx`, importer `Toaster` et rendre `<body>{children}<Toaster /></body>`.

- [ ] **Step 5 : Relancer les tests**

Run : `npm test`
Expected : PASS (22 tests)

- [ ] **Step 6 : Commit**

```bash
git add components/ui/Dialog.tsx components/ui/Avatar.tsx components/ui/Toast.tsx lib/toast/store.ts app/layout.tsx tests/unit/components/ui/Dialog.test.tsx tests/unit/components/ui/Avatar.test.tsx tests/unit/lib/toast.test.ts
git commit -m "feat(ui): Dialog, Avatar, Toast"
```

---

### Task 5 : Supabase local + migration du schéma + tests pgTAP

**Files:**
- Create : `supabase/config.toml` (généré), `supabase/migrations/20260831000001_schema.sql`, `supabase/tests/0001_schema.test.sql`, `.env.local.example`

**Interfaces:**
- Produces (SQL) : tables `profiles`, `projects`, `memberships`, `invitations`, `tasks`, `dependencies` ; enums `member_role`, `task_type` ; fonctions `handle_new_user()`, `set_updated_at()`, `check_task_parent()`, `check_dependency_project()`, `is_member(uuid, member_role) → boolean`, `create_project(text) → projects`.

- [ ] **Step 1 : Initialiser et démarrer Supabase local**

```bash
npx supabase init
npx supabase start
```

Noter la sortie : `API URL` (http://127.0.0.1:54321), `anon key`, `service_role key`, `DB URL`. Créer `.env.local` :

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key affichée>
SUPABASE_SERVICE_ROLE_KEY=<service_role key affichée>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Créer `.env.local.example` avec les mêmes clés et des valeurs vides (versionné).

Dans `supabase/config.toml`, vérifier/ajuster :
- `[auth] site_url = "http://localhost:3000"` et `additional_redirect_urls = ["http://localhost:3000/auth/callback"]`
- `[auth.email] enable_confirmations = false` (magic-link direct en dev)

- [ ] **Step 2 : Écrire le test pgTAP du schéma (échoue : tables absentes)**

`supabase/tests/0001_schema.test.sql` :

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Helpers de session dans un schéma "tests" : lisibles par le rôle authenticated, annulés par le rollback final
create schema tests;
grant usage on schema tests to authenticated;
create function tests.login_as(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Tables
select has_table('public', 'profiles', 'table profiles');
select has_table('public', 'projects', 'table projects');
select has_table('public', 'memberships', 'table memberships');
select has_table('public', 'invitations', 'table invitations');
select has_table('public', 'tasks', 'table tasks');
select has_table('public', 'dependencies', 'table dependencies');

-- handle_new_user : un profil est créé avec une couleur de la palette
insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-0000-0000-000000000001', 'alice@test.local', '{"full_name":"Alice Test","avatar_url":"https://x/a.png"}');
select results_eq(
  $$ select display_name, avatar_url from public.profiles where id = 'a0000000-0000-0000-0000-000000000001' $$,
  $$ values ('Alice Test', 'https://x/a.png') $$,
  'profil créé depuis les métadonnées');
select ok(
  (select color from public.profiles where id = 'a0000000-0000-0000-0000-000000000001')
    = any (array['#FFD500','#FF6B9D','#3B82F6','#22C55E','#FF8A00','#A855F7']),
  'couleur issue de la palette');

-- create_project : projet + membership owner
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select lives_ok($$ select public.create_project('Mon projet') $$, 'create_project fonctionne pour un utilisateur connecté');
select results_eq(
  $$ select m.role::text from public.memberships m join public.projects p on p.id = m.project_id where p.name = 'Mon projet' $$,
  $$ values ('owner') $$,
  'membership owner créée');
select tests.logout();

-- Contraintes sur tasks
select throws_ok(
  $$ insert into public.tasks (project_id, title, type, start_date, end_date)
     select id, 'Jalon', 'milestone', '2026-09-01', '2026-09-02' from public.projects where name = 'Mon projet' $$,
  '23514', null, 'un jalon doit avoir start_date = end_date');
select throws_ok(
  $$ insert into public.tasks (project_id, title, start_date, end_date, progress)
     select id, 'T', '2026-09-01', '2026-09-02', 120 from public.projects where name = 'Mon projet' $$,
  '23514', null, 'progress borné à 100');

-- Profondeur 1 : un groupe ne peut pas avoir de parent
insert into public.tasks (id, project_id, title, type, start_date, end_date)
select 'b0000000-0000-0000-0000-000000000001', id, 'Groupe', 'group', '2026-09-01', '2026-09-01' from public.projects where name = 'Mon projet';
select throws_ok(
  $$ insert into public.tasks (project_id, parent_id, title, type, start_date, end_date)
     select id, 'b0000000-0000-0000-0000-000000000001', 'Sous-groupe', 'group', '2026-09-01', '2026-09-01' from public.projects where name = 'Mon projet' $$,
  'P0001', 'group_cannot_have_parent', 'pas de groupe dans un groupe');

-- updated_at maintenu par trigger
select lives_ok($$
  update public.tasks set title = 'Groupe renommé' where id = 'b0000000-0000-0000-0000-000000000001'
$$, 'update ok');

select * from finish();
rollback;
```

- [ ] **Step 3 : Lancer, vérifier l'échec**

Run : `npm run test:db`
Expected : FAIL — `has_table` échoue (tables absentes)

- [ ] **Step 4 : Écrire la migration du schéma**

`supabase/migrations/20260831000001_schema.sql` :

```sql
-- ===== Enums =====
create type public.member_role as enum ('owner', 'editor', 'viewer');
create type public.task_type as enum ('task', 'milestone', 'group');

-- ===== Tables =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  color text not null,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 100),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.memberships (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  role public.member_role not null check (role <> 'owner'),
  token text not null unique,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index invitations_project_idx on public.invitations(project_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_id uuid references public.tasks(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  type public.task_type not null default 'task',
  start_date date not null,
  end_date date not null,
  progress int not null default 0 check (progress between 0 and 100),
  color text not null default '#FFD500',
  assignee_id uuid references public.profiles(id) on delete set null,
  sort_order int not null default 0,
  collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_dates_order check (end_date >= start_date),
  constraint tasks_milestone_single_day check (type <> 'milestone' or start_date = end_date)
);
create index tasks_project_idx on public.tasks(project_id);
create index tasks_parent_idx on public.tasks(parent_id);

create table public.dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_task_id uuid not null references public.tasks(id) on delete cascade,
  to_task_id uuid not null references public.tasks(id) on delete cascade,
  unique (from_task_id, to_task_id),
  check (from_task_id <> to_task_id)
);
create index dependencies_project_idx on public.dependencies(project_id);

-- ===== Triggers utilitaires =====
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.check_task_parent() returns trigger
language plpgsql as $$
declare parent public.tasks;
begin
  if new.parent_id is null then return new; end if;
  if new.type = 'group' then raise exception 'group_cannot_have_parent'; end if;
  select * into parent from public.tasks where id = new.parent_id;
  if parent.id is null or parent.project_id <> new.project_id then raise exception 'parent_not_in_project'; end if;
  if parent.type <> 'group' then raise exception 'parent_must_be_group'; end if;
  return new;
end $$;

create trigger tasks_check_parent
before insert or update of parent_id, type, project_id on public.tasks
for each row execute function public.check_task_parent();

create or replace function public.check_dependency_project() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.tasks where id in (new.from_task_id, new.to_task_id) and project_id = new.project_id) <> 2 then
    raise exception 'dependency_cross_project';
  end if;
  return new;
end $$;

create trigger dependencies_check_project
before insert or update on public.dependencies
for each row execute function public.check_dependency_project();

-- ===== Profil automatique =====
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  palette text[] := array['#FFD500', '#FF6B9D', '#3B82F6', '#22C55E', '#FF8A00', '#A855F7'];
  n int;
begin
  select count(*) into n from public.profiles;
  insert into public.profiles (id, email, display_name, avatar_url, color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    palette[1 + (n % 6)]
  );
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== Helpers d'autorisation =====
create or replace function public.is_member(p_project_id uuid, p_min_role public.member_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.project_id = p_project_id
      and m.user_id = auth.uid()
      and (case m.role when 'owner' then 3 when 'editor' then 2 else 1 end)
          >= (case p_min_role when 'owner' then 3 when 'editor' then 2 else 1 end)
  );
$$;

create or replace function public.create_project(p_name text) returns public.projects
language plpgsql security definer set search_path = public as $$
declare p public.projects;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.projects (name, owner_id) values (trim(p_name), auth.uid()) returning * into p;
  insert into public.memberships (project_id, user_id, role) values (p.id, auth.uid(), 'owner');
  return p;
end $$;

revoke execute on function public.create_project(text) from anon, public;
grant execute on function public.create_project(text) to authenticated;
```

- [ ] **Step 5 : Appliquer la migration et relancer les tests**

```bash
npx supabase db reset
npm run test:db
```

Expected : `All tests successful` — 14 tests.

- [ ] **Step 6 : Commit**

```bash
git add supabase/config.toml supabase/migrations/20260831000001_schema.sql supabase/tests/0001_schema.test.sql .env.local.example
git commit -m "feat(db): schéma BradGantt, triggers et fonctions"
```

---

### Task 6 : Policies RLS + tests pgTAP

**Files:**
- Create : `supabase/migrations/20260831000002_rls.sql`, `supabase/tests/0002_rls.test.sql`

**Interfaces:**
- Consumes : `is_member`, `create_project`, tables de la tâche 5.
- Produces : RLS activée sur les 6 tables, policies conformes au spec §4.

- [ ] **Step 1 : Écrire le test RLS (échoue : RLS non activée, tout est visible)**

`supabase/tests/0002_rls.test.sql` :

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Helpers de session dans un schéma "tests" : lisibles par le rôle authenticated, annulés par le rollback final
create schema tests;
grant usage on schema tests to authenticated;
create function tests.login_as(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Utilisateurs
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'bob@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'carol@test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'dave@test.local');

-- Alice crée un projet, devient owner ; bob editor, carol viewer, dave non-membre
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select public.create_project('Projet RLS');
select tests.logout();
create table tests.ctx as select id as project_id from public.projects where name = 'Projet RLS';
grant select on tests.ctx to authenticated;

insert into public.memberships (project_id, user_id, role)
select project_id, 'a0000000-0000-0000-0000-000000000002', 'editor' from tests.ctx;
insert into public.memberships (project_id, user_id, role)
select project_id, 'a0000000-0000-0000-0000-000000000003', 'viewer' from tests.ctx;
insert into public.tasks (id, project_id, title, start_date, end_date)
select 'b0000000-0000-0000-0000-000000000001', project_id, 'Tâche 1', '2026-09-01', '2026-09-03' from tests.ctx;

-- RLS activée partout
select ok((select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace
  and relname in ('profiles','projects','memberships','invitations','tasks','dependencies')), 'RLS activée sur les 6 tables');

-- Dave (non-membre) ne voit rien
select tests.login_as('a0000000-0000-0000-0000-000000000004', 'dave@test.local');
select is((select count(*) from public.projects), 0::bigint, 'non-membre : aucun projet');
select is((select count(*) from public.tasks), 0::bigint, 'non-membre : aucune tâche');
select is((select count(*) from public.memberships), 0::bigint, 'non-membre : aucune membership');
select is((select count(*) from public.profiles), 4::bigint, 'les profils sont lisibles par tout connecté');
select tests.logout();

-- Carol (viewer) lit mais n'écrit pas
select tests.login_as('a0000000-0000-0000-0000-000000000003', 'carol@test.local');
select is((select count(*) from public.tasks), 1::bigint, 'viewer : lit les tâches');
select throws_ok($$ insert into public.tasks (project_id, title, start_date, end_date)
  select project_id, 'X', '2026-09-01', '2026-09-01' from tests.ctx $$, '42501', null, 'viewer : insert tâche refusé');
update public.tasks set title = 'Piraté' where id = 'b0000000-0000-0000-0000-000000000001';
select tests.logout();
select is((select title from public.tasks where id = 'b0000000-0000-0000-0000-000000000001'), 'Tâche 1', 'viewer : update tâche sans effet');

-- Bob (editor) écrit les tâches mais pas les memberships ni le projet
select tests.login_as('a0000000-0000-0000-0000-000000000002', 'bob@test.local');
select lives_ok($$ insert into public.tasks (project_id, title, start_date, end_date)
  select project_id, 'Tâche de Bob', '2026-09-01', '2026-09-01' from tests.ctx $$, 'editor : insert tâche ok');
select throws_ok($$ insert into public.memberships (project_id, user_id, role)
  select project_id, 'a0000000-0000-0000-0000-000000000004', 'viewer' from tests.ctx $$, '42501', null, 'editor : insert membership refusé');
update public.projects set name = 'Renommé par Bob';
select throws_ok($$ insert into public.invitations (project_id, email, role, token, invited_by)
  select project_id, 'x@test.local', 'viewer', 'tok', 'a0000000-0000-0000-0000-000000000002' from tests.ctx $$, '42501', null, 'editor : insert invitation refusé');
select tests.logout();
select is((select name from public.projects limit 1), 'Projet RLS', 'editor : rename projet sans effet');

-- Alice (owner) gère les membres mais ne touche pas à sa propre ligne owner
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001';
update public.memberships set role = 'viewer' where user_id = 'a0000000-0000-0000-0000-000000000001';
delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000002';
select lives_ok($$ update public.projects set name = 'Renommé par Alice' $$, 'owner : rename ok');
select tests.logout();
select is((select role::text from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001'), 'owner', 'owner : ligne owner intouchable');
select is((select count(*) from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'owner : retrait de bob ok');
select is((select name from public.projects limit 1), 'Renommé par Alice', 'owner : projet renommé');

select * from finish();
rollback;
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run : `npm run test:db`
Expected : FAIL — « RLS activée sur les 6 tables » échoue, et « non-membre : aucun projet » aussi.

- [ ] **Step 3 : Écrire la migration RLS**

`supabase/migrations/20260831000002_rls.sql` :

```sql
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.tasks enable row level security;
alter table public.dependencies enable row level security;

-- profiles
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- `email` est figé : la source de vérité est auth.users. Sans ce verrou, un
-- utilisateur se donne l'email d'une cible et se fait ajouter à sa place lors
-- d'une invitation « ajout direct d'un compte existant » (plan 3).
create or replace function public.protect_profile_email() returns trigger
language plpgsql as $$
begin
  if new.email is distinct from old.email then raise exception 'email_is_read_only'; end if;
  return new;
end $$;

create trigger profiles_protect_email
before update on public.profiles
for each row execute function public.protect_profile_email();

revoke execute on function public.is_member(uuid, public.member_role) from anon, public;
grant execute on function public.is_member(uuid, public.member_role) to authenticated;

-- projects (INSERT uniquement via create_project, security definer)
create policy "projects_select_member" on public.projects
  for select to authenticated using (public.is_member(id, 'viewer'));
create policy "projects_update_owner" on public.projects
  for update to authenticated using (public.is_member(id, 'owner')) with check (public.is_member(id, 'owner'));
create policy "projects_delete_owner" on public.projects
  for delete to authenticated using (public.is_member(id, 'owner'));

-- memberships : la ligne owner est intouchable, personne ne devient owner par UPDATE/INSERT
create policy "memberships_select_member" on public.memberships
  for select to authenticated using (public.is_member(project_id, 'viewer'));
create policy "memberships_insert_owner" on public.memberships
  for insert to authenticated with check (public.is_member(project_id, 'owner') and role <> 'owner');
create policy "memberships_update_owner" on public.memberships
  for update to authenticated
  using (public.is_member(project_id, 'owner') and role <> 'owner')
  -- `is_member` est indispensable dans le WITH CHECK : sans lui, un owner de son
  -- propre projet peut déplacer une ligne membership vers un projet étranger
  -- (USING valide l'ancienne ligne, WITH CHECK la nouvelle) et s'y ajouter.
  with check (public.is_member(project_id, 'owner') and role <> 'owner');
create policy "memberships_delete_owner" on public.memberships
  for delete to authenticated using (public.is_member(project_id, 'owner') and role <> 'owner');

-- invitations
create policy "invitations_select_owner" on public.invitations
  for select to authenticated using (public.is_member(project_id, 'owner'));
create policy "invitations_insert_owner" on public.invitations
  for insert to authenticated with check (public.is_member(project_id, 'owner') and invited_by = auth.uid());
create policy "invitations_delete_owner" on public.invitations
  for delete to authenticated using (public.is_member(project_id, 'owner'));

-- tasks
create policy "tasks_select_member" on public.tasks
  for select to authenticated using (public.is_member(project_id, 'viewer'));
create policy "tasks_insert_editor" on public.tasks
  for insert to authenticated with check (public.is_member(project_id, 'editor'));
create policy "tasks_update_editor" on public.tasks
  for update to authenticated using (public.is_member(project_id, 'editor')) with check (public.is_member(project_id, 'editor'));
create policy "tasks_delete_editor" on public.tasks
  for delete to authenticated using (public.is_member(project_id, 'editor'));

-- dependencies
create policy "dependencies_select_member" on public.dependencies
  for select to authenticated using (public.is_member(project_id, 'viewer'));
create policy "dependencies_insert_editor" on public.dependencies
  for insert to authenticated with check (public.is_member(project_id, 'editor'));
create policy "dependencies_update_editor" on public.dependencies
  for update to authenticated using (public.is_member(project_id, 'editor')) with check (public.is_member(project_id, 'editor'));
create policy "dependencies_delete_editor" on public.dependencies
  for delete to authenticated using (public.is_member(project_id, 'editor'));
```

- [ ] **Step 4 : Appliquer et relancer**

```bash
npx supabase db reset
npm run test:db
```

Expected : `All tests successful` — 14 + 16 tests.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260831000002_rls.sql supabase/tests/0002_rls.test.sql
git commit -m "feat(db): policies RLS et tests pgTAP"
```

---

### Task 7 : Clients Supabase, types générés, middleware

**Files:**
- Create : `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/supabase/types.ts` (généré), `lib/auth/redirect.ts`, `middleware.ts`
- Test : `tests/unit/lib/auth/redirect.test.ts`

**Interfaces:**
- Produces :
  - `createClient()` (navigateur) → `SupabaseClient<Database>` ; `createClient()` (serveur, `async`) → `Promise<SupabaseClient<Database>>` ; `updateSession(request: NextRequest) → Promise<{ response: NextResponse; user: User | null }>`.
  - `resolveAuthRedirect(url: string, hasSession: boolean): string | null` ; `safeNext(next: string | null | undefined): string` (retourne `/projects` si `next` absent ou non relatif).
  - Type `Database` dans `lib/supabase/types.ts` ; alias `Tables<'tasks'>` etc.

- [ ] **Step 1 : Générer les types**

```bash
npx supabase gen types typescript --local > lib/supabase/types.ts
```

Ajouter le script npm `"db:types": "supabase gen types typescript --local > lib/supabase/types.ts"`.

- [ ] **Step 2 : Écrire les tests de la logique de redirection**

`tests/unit/lib/auth/redirect.test.ts` :

```ts
import { resolveAuthRedirect, safeNext } from '@/lib/auth/redirect'

describe('safeNext', () => {
  it('retourne /projects par défaut', () => expect(safeNext(null)).toBe('/projects'))
  it('accepte un chemin relatif', () => expect(safeNext('/projects/abc')).toBe('/projects/abc'))
  it('refuse une URL absolue ou protocol-relative', () => {
    expect(safeNext('https://evil.com')).toBe('/projects')
    expect(safeNext('//evil.com')).toBe('/projects')
  })
})

describe('resolveAuthRedirect', () => {
  it('redirige un anonyme vers /login avec next sur une route protégée', () => {
    expect(resolveAuthRedirect('/projects/42?zoom=week', false)).toBe('/login?next=%2Fprojects%2F42%3Fzoom%3Dweek')
    expect(resolveAuthRedirect('/invite/tok', false)).toBe('/login?next=%2Finvite%2Ftok')
  })
  it('laisse un anonyme sur /login', () => expect(resolveAuthRedirect('/login', false)).toBeNull())
  it('renvoie un connecté de /login vers next ou /projects', () => {
    expect(resolveAuthRedirect('/login', true)).toBe('/projects')
    expect(resolveAuthRedirect('/login?next=%2Finvite%2Ftok', true)).toBe('/invite/tok')
  })
  it('redirige la racine', () => {
    expect(resolveAuthRedirect('/', false)).toBe('/login')
    expect(resolveAuthRedirect('/', true)).toBe('/projects')
  })
  it('ne touche pas aux routes publiques', () => {
    expect(resolveAuthRedirect('/auth/callback?code=x', false)).toBeNull()
    expect(resolveAuthRedirect('/projects', true)).toBeNull()
  })
})
```

- [ ] **Step 3 : Lancer, vérifier l'échec**

Run : `npm test`
Expected : FAIL — module `@/lib/auth/redirect` introuvable

- [ ] **Step 4 : Implémenter la logique pure**

`lib/auth/redirect.ts` :

```ts
const PROTECTED = [/^\/projects(\/|$)/, /^\/invite(\/|$)/]

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/projects'
  return next
}

export function resolveAuthRedirect(url: string, hasSession: boolean): string | null {
  const [pathname, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  const isProtected = PROTECTED.some((r) => r.test(pathname))

  if (pathname === '/') return hasSession ? '/projects' : '/login'
  if (!hasSession && isProtected) return `/login?next=${encodeURIComponent(url)}`
  if (hasSession && pathname === '/login') return safeNext(params.get('next'))
  return null
}
```

- [ ] **Step 5 : Relancer les tests**

Run : `npm test`
Expected : PASS

- [ ] **Step 6 : Écrire les clients Supabase et le middleware**

`lib/supabase/client.ts` :

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

`lib/supabase/server.ts` :

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Appelé depuis un Server Component : le middleware rafraîchit la session, on ignore.
          }
        },
      },
    },
  )
}
```

`lib/supabase/middleware.ts` :

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  return { response, user }
}
```

`middleware.ts` (racine) :

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { resolveAuthRedirect } from '@/lib/auth/redirect'

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const target = resolveAuthRedirect(request.nextUrl.pathname + request.nextUrl.search, !!user)
  if (target) return NextResponse.redirect(new URL(target, request.url))
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
```

- [ ] **Step 7 : Vérifier la compilation**

Run : `npm run typecheck && npm run build`
Expected : aucune erreur TypeScript ; build OK.

- [ ] **Step 8 : Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts lib/supabase/middleware.ts lib/supabase/types.ts lib/auth/redirect.ts middleware.ts package.json tests/unit/lib/auth/redirect.test.ts
git commit -m "feat(auth): clients Supabase, types générés et middleware de session"
```

---

### Task 8 : Login, callback, layout applicatif, e2e de connexion

**Files:**
- Create : `app/(auth)/login/page.tsx`, `app/(auth)/login/LoginForm.tsx`, `app/auth/callback/route.ts`, `app/(app)/layout.tsx`, `app/(app)/projects/page.tsx` (placeholder), `app/(app)/projects/actions.ts` (`signOut` uniquement pour l'instant), `components/layout/AppHeader.tsx`, `app/e2e-login/page.tsx`, `app/e2e-login/E2ELoginForm.tsx`, `supabase/seed.sql`, `playwright.config.ts`, `tests/e2e/helpers.ts`, `tests/e2e/auth.spec.ts`
- Modify : `app/page.tsx` (vider la démo : le middleware redirige `/`)

**Interfaces:**
- Consumes : `createClient` (serveur / navigateur), `safeNext`, composants `ui/`.
- Produces :
  - Utilisateurs seedés (mot de passe `password123`) : `alice@test.local` (`a0000000-…-0001`, « Alice Test »), `bob@test.local` (…0002, « Bob Test »), `carol@test.local` (…0003, « Carol Test »), `dave@test.local` (…0004, « Dave Test »).
  - `loginAs(page, 'alice' | 'bob' | 'carol' | 'dave')` dans `tests/e2e/helpers.ts`.
  - `signOut()` server action.
  - `AppHeader({ displayName, color, avatarUrl })`.

- [ ] **Step 1 : Seed des utilisateurs de test**

`supabase/seed.sql` :

```sql
-- Utilisateurs de test (mot de passe : password123). Chargé par `supabase db reset`.
create or replace function pg_temp.seed_user(uid uuid, mail text, full_name text) returns void
language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', json_build_object('full_name', full_name)::jsonb, now(), now(),
    '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
    json_build_object('sub', uid::text, 'email', mail, 'email_verified', true)::jsonb, 'email', now(), now(), now());
end $$;

select pg_temp.seed_user('a0000000-0000-0000-0000-000000000001', 'alice@test.local', 'Alice Test');
select pg_temp.seed_user('a0000000-0000-0000-0000-000000000002', 'bob@test.local', 'Bob Test');
select pg_temp.seed_user('a0000000-0000-0000-0000-000000000003', 'carol@test.local', 'Carol Test');
select pg_temp.seed_user('a0000000-0000-0000-0000-000000000004', 'dave@test.local', 'Dave Test');
```

Run : `npx supabase db reset` — Expected : pas d'erreur, `select email, display_name from profiles` (via `npx supabase db query` ou Studio http://127.0.0.1:54323) montre 4 profils.

- [ ] **Step 2 : Configurer Playwright et écrire le test e2e (échoue : pages absentes)**

`playwright.config.ts` :

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_E2E: '1' },
  },
})
```

Run une fois : `npx playwright install chromium`.

`tests/e2e/helpers.ts` :

```ts
import type { Page } from '@playwright/test'

export const USERS = {
  alice: { email: 'alice@test.local', name: 'Alice Test' },
  bob: { email: 'bob@test.local', name: 'Bob Test' },
  carol: { email: 'carol@test.local', name: 'Carol Test' },
  dave: { email: 'dave@test.local', name: 'Dave Test' },
} as const

export async function loginAs(page: Page, who: keyof typeof USERS) {
  await page.goto('/e2e-login')
  await page.getByLabel('Email').fill(USERS[who].email)
  await page.getByLabel('Mot de passe').fill('password123')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL('**/projects')
}
```

`tests/e2e/auth.spec.ts` :

```ts
import { test, expect } from '@playwright/test'
import { loginAs, USERS } from './helpers'

test('un anonyme est redirigé vers /login avec next', async ({ page }) => {
  await page.goto('/projects')
  await expect(page).toHaveURL(/\/login\?next=%2Fprojects/)
  await expect(page.getByRole('heading', { name: 'BradGantt' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
})

test('connexion puis déconnexion', async ({ page }) => {
  await loginAs(page, 'alice')
  await expect(page.getByText(USERS.alice.name)).toBeVisible()
  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL(/\/login/)
})
```

Run : `npm run test:e2e` — Expected : FAIL (page `/e2e-login` renvoie 404).

- [ ] **Step 3 : Page de login**

`app/(auth)/login/page.tsx` :

```tsx
import { LoginForm } from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-paper brutal shadow-brutal-xl p-8 space-y-6">
        <h1 className="text-4xl">BradGantt</h1>
        <p className="font-bold">Des Gantt partagés, brutalement simples.</p>
        {error && <p role="alert" className="bg-danger text-paper border-[3px] border-ink p-3 font-bold">Connexion impossible, réessaie.</p>}
        <LoginForm next={next ?? null} />
      </div>
    </main>
  )
}
```

`app/(auth)/login/LoginForm.tsx` :

```tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function LoginForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const callback = () => {
    const url = new URL('/auth/callback', window.location.origin)
    if (next) url.searchParams.set('next', next)
    return url.toString()
  }

  async function withGoogle() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } })
  }

  async function withMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback() } })
    setLoading(false)
    if (error) setError("Impossible d'envoyer le lien. Vérifie l'adresse.")
    else setSent(true)
  }

  if (sent) return <p className="bg-green border-[3px] border-ink p-4 font-bold">Lien envoyé ! Ouvre ta boîte mail ({email}).</p>

  return (
    <div className="space-y-6">
      <Button variant="secondary" className="w-full" onClick={withGoogle}>Continuer avec Google</Button>
      <div className="flex items-center gap-3"><span className="h-[3px] flex-1 bg-ink" /><span className="font-mono text-sm">OU</span><span className="h-[3px] flex-1 bg-ink" /></div>
      <form onSubmit={withMagicLink} className="space-y-4">
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} placeholder="toi@exemple.fr" />
        <Button type="submit" className="w-full" disabled={loading}>Recevoir un lien magique</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4 : Route de callback**

`app/auth/callback/route.ts` :

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/redirect'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
```

- [ ] **Step 5 : Layout applicatif, header, déconnexion, page projets placeholder**

`app/(app)/projects/actions.ts` :

```ts
'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

`components/layout/AppHeader.tsx` :

```tsx
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { signOut } from '@/app/(app)/projects/actions'

export interface AppHeaderProps { displayName: string; color: string; avatarUrl: string | null }

export function AppHeader({ displayName, color, avatarUrl }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b-[3px] border-ink bg-yellow px-6 py-3">
      <Link href="/projects" className="font-display text-2xl uppercase brutal-focus">BradGantt</Link>
      <div className="flex items-center gap-4">
        <span className="font-bold hidden sm:inline">{displayName}</span>
        <Avatar name={displayName} color={color} src={avatarUrl} size="sm" />
        <form action={signOut}><Button variant="secondary" size="sm" type="submit">Déconnexion</Button></form>
      </div>
    </header>
  )
}
```

`app/(app)/layout.tsx` :

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/layout/AppHeader'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('display_name, color, avatar_url').eq('id', user.id).single()

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader displayName={profile?.display_name ?? user.email ?? ''} color={profile?.color ?? '#FFD500'} avatarUrl={profile?.avatar_url ?? null} />
      <div className="flex-1">{children}</div>
    </div>
  )
}
```

`app/(app)/projects/page.tsx` (placeholder, remplacé en tâche 9) :

```tsx
export default function ProjectsPage() {
  return <main className="p-8"><h1 className="text-4xl">Mes projets</h1></main>
}
```

`app/page.tsx` :

```tsx
export default function Home() {
  return null // le middleware redirige "/" vers /login ou /projects
}
```

- [ ] **Step 6 : Page de login e2e (mot de passe), activée uniquement par `NEXT_PUBLIC_E2E=1`**

`app/e2e-login/page.tsx` :

```tsx
import { notFound } from 'next/navigation'
import { E2ELoginForm } from './E2ELoginForm'

export default function E2ELoginPage() {
  if (process.env.NEXT_PUBLIC_E2E !== '1') notFound()
  return <main className="p-8 max-w-sm"><h1 className="text-2xl mb-4">Login E2E</h1><E2ELoginForm /></main>
}
```

`app/e2e-login/E2ELoginForm.tsx` :

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export function E2ELoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return }
    router.push('/projects')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={error ?? undefined} />
      <Button type="submit">Se connecter</Button>
    </form>
  )
}
```

- [ ] **Step 7 : Lancer les e2e**

Run : `npm run test:e2e`
Expected : 2 tests PASS. Si le premier échoue sur `next=%2Fprojects`, vérifier que `middleware.ts` est bien à la racine (pas dans `app/`).

- [ ] **Step 8 : Vérification manuelle du magic-link** — `npm run dev`, aller sur /login, saisir un email, puis ouvrir la boîte locale Supabase (Inbucket/Mailpit : http://127.0.0.1:54324), cliquer le lien → doit atterrir sur `/projects` avec le header. (Google OAuth nécessite un client OAuth réel dans `supabase/config.toml` `[auth.external.google]` — hors périmètre du test local, à configurer au déploiement.)

- [ ] **Step 9 : Commit**

```bash
git add "app/(auth)/login/page.tsx" "app/(auth)/login/LoginForm.tsx" app/auth/callback/route.ts "app/(app)/layout.tsx" "app/(app)/projects/page.tsx" "app/(app)/projects/actions.ts" components/layout/AppHeader.tsx app/e2e-login/page.tsx app/e2e-login/E2ELoginForm.tsx app/page.tsx supabase/seed.sql playwright.config.ts tests/e2e/helpers.ts tests/e2e/auth.spec.ts
git commit -m "feat(auth): login Google/magic-link, callback, layout applicatif et e2e de connexion"
```

---

### Task 9 : Liste des projets — créer, renommer, supprimer

**Files:**
- Create : `lib/projects/validate.ts`, `components/project/ProjectCard.tsx`, `components/project/NewProjectDialog.tsx`, `components/project/RenameProjectDialog.tsx`
- Modify : `app/(app)/projects/page.tsx`, `app/(app)/projects/actions.ts`
- Test : `tests/unit/lib/projects/validate.test.ts`, `tests/e2e/projects.spec.ts`

**Interfaces:**
- Consumes : `createClient` serveur, `ui/`, `toast`.
- Produces :
  - `validateProjectName(raw: string): { ok: true; value: string } | { ok: false; error: string }`.
  - Server actions : `createProject(name: string) → { error?: string; id?: string }`, `renameProject(projectId: string, name: string)`, `deleteProject(projectId: string)` — retournent `{ error?: string }`.
  - Type `ProjectListItem = { id: string; name: string; role: 'owner'|'editor'|'viewer'; createdAt: string }`.

- [ ] **Step 1 : Test unitaire de validation**

`tests/unit/lib/projects/validate.test.ts` :

```ts
import { validateProjectName } from '@/lib/projects/validate'

describe('validateProjectName', () => {
  it('trim et accepte un nom valide', () => {
    expect(validateProjectName('  Refonte site  ')).toEqual({ ok: true, value: 'Refonte site' })
  })
  it('refuse un nom vide', () => {
    expect(validateProjectName('   ')).toEqual({ ok: false, error: 'Le nom est requis' })
  })
  it('refuse plus de 100 caractères', () => {
    expect(validateProjectName('x'.repeat(101))).toEqual({ ok: false, error: '100 caractères maximum' })
  })
})
```

Run : `npm test` — Expected : FAIL (module introuvable)

- [ ] **Step 2 : Implémenter**

`lib/projects/validate.ts` :

```ts
export type Validation = { ok: true; value: string } | { ok: false; error: string }

export function validateProjectName(raw: string): Validation {
  const value = raw.trim()
  if (value.length === 0) return { ok: false, error: 'Le nom est requis' }
  if (value.length > 100) return { ok: false, error: '100 caractères maximum' }
  return { ok: true, value }
}
```

Run : `npm test` — Expected : PASS

- [ ] **Step 3 : Test e2e (échoue : UI absente)**

`tests/e2e/projects.spec.ts` :

```ts
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test('créer, renommer puis supprimer un projet', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Projet ${Date.now()}`

  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  const card = page.getByRole('article', { name })
  await expect(card).toBeVisible()
  await expect(card.getByText('owner')).toBeVisible()

  await card.getByRole('button', { name: 'Renommer' }).click()
  await page.getByLabel('Nom du projet').fill(`${name} v2`)
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('article', { name: `${name} v2` })).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await page.getByRole('article', { name: `${name} v2` }).getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('article', { name: `${name} v2` })).toHaveCount(0)
})

test('un nom vide est refusé', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('alert')).toHaveText('Le nom est requis')
})
```

Run : `npm run test:e2e tests/e2e/projects.spec.ts` — Expected : FAIL

- [ ] **Step 4 : Server actions**

Compléter `app/(app)/projects/actions.ts` :

```ts
'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateProjectName } from '@/lib/projects/validate'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function createProject(name: string): Promise<{ error?: string; id?: string }> {
  const v = validateProjectName(name)
  if (!v.ok) return { error: v.error }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('create_project', { p_name: v.value })
  if (error) return { error: 'Création impossible, réessaie.' }
  revalidatePath('/projects')
  return { id: data.id }
}

export async function renameProject(projectId: string, name: string): Promise<{ error?: string }> {
  const v = validateProjectName(name)
  if (!v.ok) return { error: v.error }
  const supabase = await createClient()
  const { error, count } = await supabase.from('projects').update({ name: v.value }, { count: 'exact' }).eq('id', projectId)
  if (error || count === 0) return { error: 'Modification non enregistrée' }
  revalidatePath('/projects')
  return {}
}

export async function deleteProject(projectId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error, count } = await supabase.from('projects').delete({ count: 'exact' }).eq('id', projectId)
  if (error || count === 0) return { error: 'Suppression impossible' }
  revalidatePath('/projects')
  return {}
}
```

- [ ] **Step 5 : Page et composants**

`app/(app)/projects/page.tsx` :

```tsx
import { createClient } from '@/lib/supabase/server'
import { ProjectCard, type ProjectListItem } from '@/components/project/ProjectCard'
import { NewProjectDialog } from '@/components/project/NewProjectDialog'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('projects')
    .select('id, name, created_at, memberships!inner(role, user_id)')
    .eq('memberships.user_id', user!.id)
    .order('created_at', { ascending: false })

  const projects: ProjectListItem[] = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.created_at,
    role: p.memberships[0].role,
  }))

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl">Mes projets</h1>
        <NewProjectDialog />
      </div>
      {projects.length === 0 ? (
        <p className="bg-paper brutal p-6 font-bold">Aucun projet. Crée le premier !</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => <li key={p.id}><ProjectCard project={p} /></li>)}
        </ul>
      )}
    </main>
  )
}
```

`components/project/NewProjectDialog.tsx` :

```tsx
'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { createProject } from '@/app/(app)/projects/actions'

export function NewProjectDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await createProject(name)
      if (res.error) { setError(res.error); return }
      setOpen(false); setName(''); setError(null)
      router.push(`/projects/${res.id}`)
    })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Nouveau projet</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Nouveau projet">
        <form id="new-project" onSubmit={submit}>
          <Input label="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} autoFocus />
        </form>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
          <Button type="submit" form="new-project" disabled={pending}>Créer</Button>
        </div>
      </Dialog>
    </>
  )
}
```

`components/project/RenameProjectDialog.tsx` :

```tsx
'use client'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { renameProject } from '@/app/(app)/projects/actions'
import { toast } from '@/lib/toast/store'

export function RenameProjectDialog({ projectId, currentName, open, onClose }: { projectId: string; currentName: string; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    start(async () => {
      const res = await renameProject(projectId, name)
      if (res.error) { setError(res.error); toast.error(res.error); return }
      onClose()
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Renommer le projet">
      <form id="rename-project" onSubmit={submit}>
        <Input label="Nom du projet" value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} autoFocus />
      </form>
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose}>Annuler</Button>
        <Button type="submit" form="rename-project" disabled={pending}>Enregistrer</Button>
      </div>
    </Dialog>
  )
}
```

`components/project/ProjectCard.tsx` :

```tsx
'use client'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RenameProjectDialog } from './RenameProjectDialog'
import { deleteProject } from '@/app/(app)/projects/actions'
import { toast } from '@/lib/toast/store'

export interface ProjectListItem { id: string; name: string; role: 'owner' | 'editor' | 'viewer'; createdAt: string }

const roleColor: Record<ProjectListItem['role'], BadgeColor> = { owner: 'yellow', editor: 'blue', viewer: 'pink' }

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const [renaming, setRenaming] = useState(false)
  const [, start] = useTransition()

  function remove() {
    if (!window.confirm(`Supprimer « ${project.name} » et toutes ses tâches ?`)) return
    start(async () => {
      const res = await deleteProject(project.id)
      if (res.error) toast.error(res.error)
    })
  }

  return (
    <article aria-label={project.name} className="bg-paper brutal p-5 flex flex-col gap-4 hover:shadow-brutal-lg transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/projects/${project.id}`} className="font-display text-xl uppercase leading-tight brutal-focus">{project.name}</Link>
        <Badge color={roleColor[project.role]}>{project.role}</Badge>
      </div>
      <p className="font-mono text-xs">Créé le {format(new Date(project.createdAt), 'd MMM yyyy', { locale: fr })}</p>
      {project.role === 'owner' && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setRenaming(true)}>Renommer</Button>
          <Button size="sm" variant="danger" onClick={remove}>Supprimer</Button>
        </div>
      )}
      {renaming && <RenameProjectDialog projectId={project.id} currentName={project.name} open onClose={() => setRenaming(false)} />}
    </article>
  )
}
```

Note : `NewProjectDialog` redirige vers `/projects/<id>`, page qui n'existe qu'au plan 2. Pour ce plan, la redirection produit une 404 Next standard ; le test e2e reste sur `/projects` car il vérifie la carte **avant** la navigation — si la navigation est trop rapide, remplacer temporairement `router.push(...)` par `router.refresh()` et rétablir le `push` au plan 2 (tâche « page Gantt »).

- [ ] **Step 6 : Lancer typecheck + tous les tests**

Run : `npm run typecheck && npm test && npm run test:e2e`
Expected : tout PASS. Si le typage de `p.memberships[0].role` pose problème, vérifier que `lib/supabase/types.ts` a été régénéré après la migration RLS (`npm run db:types`).

- [ ] **Step 7 : Commit**

```bash
git add lib/projects/validate.ts components/project/ProjectCard.tsx components/project/NewProjectDialog.tsx components/project/RenameProjectDialog.tsx "app/(app)/projects/page.tsx" "app/(app)/projects/actions.ts" tests/unit/lib/projects/validate.test.ts tests/e2e/projects.spec.ts
git commit -m "feat(projects): liste, création, renommage et suppression de projets"
```

---

## Critères de fin du plan 1

- `npm run typecheck`, `npm test`, `npm run test:db`, `npm run test:e2e` passent.
- Un utilisateur peut se connecter (magic-link en local), créer / renommer / supprimer un projet, et la RLS empêche tout accès hors membership (prouvé par pgTAP).
- Le plan 2 (`2026-08-31-bradgantt-02-gantt.md`) démarre sur cette base : il crée `app/(app)/projects/[id]/page.tsx` et `lib/gantt/*`.
