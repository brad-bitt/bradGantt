# BradGantt

BradGantt est une application de diagrammes de Gantt collaboratifs : plusieurs
utilisateurs partagent un projet (owner/editor/viewer), y organisent des tâches,
groupes et jalons avec dépendances, et voient les changements des autres en temps réel.
Stack : Next.js 15 (App Router) + TypeScript + Tailwind v4 + Supabase (Postgres, Auth,
RLS), dans un style néo-brutaliste.

## Prérequis

- Node.js 20+
- Docker (pour la stack Supabase locale, lancée via la CLI `supabase`)

## Démarrage

```bash
npm install
npx supabase start        # démarre Postgres, Auth, Studio... en local (Docker)
```

`supabase start` affiche les clés locales (`anon key`, `service_role key`, etc.) :
reporte-les dans `.env.local` (copie `.env.local.example`, voir le détail de chaque
variable dedans).

```bash
npx supabase db reset      # applique les migrations + le seed de données de test
npm run dev                # démarre l'app sur http://localhost:3100
```

`npx supabase db reset` est sans danger à rejouer à tout moment sur ce projet : il
recrée entièrement la base Postgres locale de ce projet (`bradgantt` est le
`project_id` qui distingue sa stack Docker des autres projets Supabase locaux du
poste, pas le nom de la base — la base elle-même s'appelle `postgres`) à partir des
migrations et du seed.

### Ports

Ce projet fixe des ports non standards car le poste de développement a déjà d'autres
projets Supabase locaux actifs (port 54321/3000 déjà pris). Les valeurs viennent de
`supabase/config.toml` (`project_id = "bradgantt"`) et de `package.json` (`npm run dev`).

| Service                        | Port  |
| ------------------------------- | ----- |
| Application (`npm run dev`)     | 3100  |
| Supabase API (PostgREST/Auth)   | 54421 |
| Base Postgres                   | 54422 |
| Supabase Studio                 | 54423 |
| Boîte mail locale (Inbucket)    | 54424 |

Si tu lances une autre stack Supabase en parallèle sur ce poste, assure-toi qu'elle
utilise un `project_id` et des ports différents (`supabase/config.toml`) — les
conteneurs Docker sont nommés `supabase_<service>_<project_id>` et ne se marchent pas
dessus tant que les ports ne collisionnent pas.

## Utilisateurs de test

Le seed (`supabase/seed.sql`, chargé par `supabase db reset`) crée quatre comptes :

| Email               | Mot de passe   |
| -------------------- | -------------- |
| `alice@test.local`   | `password123`  |
| `bob@test.local`     | `password123`  |
| `carol@test.local`   | `password123`  |
| `dave@test.local`    | `password123`  |

La page `/e2e-login` permet de se connecter directement avec ces comptes (email +
mot de passe, sans passer par le flux Google OAuth). Elle n'est servie que si la
variable d'environnement serveur `E2E_ENABLED=1` est positionnée (voir
`lib/e2e.ts` et `app/e2e-login/page.tsx`) — utilisée par les tests e2e Playwright
(`playwright.config.ts` la positionne pour le serveur de dev qu'il pilote).

**`E2E_ENABLED` ne doit jamais être positionnée en production** : elle ouvre une porte
de connexion par mot de passe qui contourne le flux d'auth normal. C'est une variable
serveur uniquement (jamais `NEXT_PUBLIC_*`), lue au runtime — mais un build produit
avec la variable positionnée ne peut plus la refermer sans reconstruire (voir le
commentaire dans `lib/e2e.ts`).

## Commandes de test

| Commande              | Ce qu'elle fait                                              |
| ---------------------- | ------------------------------------------------------------- |
| `npm test`             | Tests unitaires (Vitest + Testing Library)                    |
| `npm run test:db`      | Tests pgTAP sur le schéma et les policies RLS (base locale)   |
| `npm run test:e2e`     | Tests end-to-end (Playwright, pilote `npm run dev` sur :3100) |
| `npm run typecheck`    | Vérification TypeScript (`tsc --noEmit`)                      |
| `npm run lint`         | ESLint                                                         |
| `npm run db:types`     | Régénère `lib/supabase/types.ts` depuis le schéma local        |

`npm run test:db` et `npm run db:types` nécessitent la stack Supabase locale démarrée
(`npx supabase start`).

## Architecture

Le détail des choix de conception vit dans `docs/superpowers/` :

- `docs/superpowers/specs/2026-08-28-bradgantt-design.md` — spec de conception
- `docs/superpowers/plans/` — plans d'implémentation par lot de fonctionnalités

Deux idiomes d'écriture de données coexistent **volontairement** dans le code, chacun
adapté à son cas d'usage plutôt qu'imposé partout par cohérence de façade :

- **Server Actions + `revalidatePath`** pour le CRUD des projets (créer/renommer/
  supprimer un projet) : la latence d'un aller-retour serveur est acceptable pour des
  actions peu fréquentes, et ce chemin reste le plus simple à auditer pour des écritures
  protégées par RLS.
- **Un store avec commandes optimistes et rollback** (plan suivant, moteur Gantt) pour
  les tâches : le glisser-déposer d'une barre de Gantt a besoin d'un retour visuel
  immédiat, incompatible avec un aller-retour serveur à chaque pixel de déplacement — la
  mise à jour est appliquée localement tout de suite, puis confirmée ou annulée une fois
  la réponse serveur connue.
