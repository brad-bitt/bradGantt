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

## Tickets

Chaque projet peut ouvrir un backlog de tickets numérotés (`#1`, `#2`, …), rattachables aux
tâches de la frise. Un ticket porte un titre, une description, un statut (À faire / En cours /
Terminé) et un assigné.

La fonctionnalité est **désactivée par défaut**. Le propriétaire l'active depuis le menu « ⋯ »
du projet — sur sa carte dans `/projects`, ou à côté de son nom dans l'en-tête. La désactiver
masque les tickets sans en supprimer aucun : les réactiver les rend tels quels.

Une fois activés, l'en-tête du projet porte un onglet « Tickets » vers `/projects/<id>/tickets`,
qui s'ouvre sur un kanban à trois colonnes (`?vue=liste` pour la vue tableau). Les filtres de la
barre d'outils (statut, assigné, tâche) valent pour les deux vues. Les lignes du Gantt affichent
un badge « ⌗ terminés/total », et l'éditeur d'une tâche liste ses tickets.

Côté seed, « Projet tickets » est le seul projet avec un backlog, et il sert de terrain aux
tests de bout en bout. « Projet démo » en est volontairement dépourvu : des specs comptent ses
lignes et inspectent sa barre latérale, où un compteur fausserait les décomptes.

## Commandes de test

| Commande              | Ce qu'elle fait                                              |
| ---------------------- | ------------------------------------------------------------- |
| `npm test`             | Tests unitaires (Vitest + Testing Library)                    |
| `npm run test:db`      | Tests pgTAP : schéma, policies RLS, `accept_invitation` (base locale) |
| `npm run test:e2e`     | Tests end-to-end (Playwright, pilote `npm run dev` sur :3100) |
| `npm run typecheck`    | Vérification TypeScript (`tsc --noEmit`)                      |
| `npm run lint`         | ESLint                                                         |
| `npm run db:types`     | Régénère `lib/supabase/types.ts` depuis le schéma local        |

`npm run test:db` et `npm run db:types` nécessitent la stack Supabase locale démarrée
(`npx supabase start`).

## Construire un diagramme

Un projet neuf s'ouvre sur une carte d'accueil qui propose une première tâche, un premier jalon
ou un premier groupe. Une fois la première ligne posée, trois gestes suffisent :

- **enchaîner** — le bouton `↳` d'une ligne crée l'élément suivant. Sur une tâche ou un jalon, il
  prépare une **tâche** rangée juste après elle dans la liste, dont le début est pré-rempli au
  lendemain de la fin de l'ancre, et propose de tracer la dépendance (case cochée par défaut).
  Sur un groupe, il prépare le **groupe suivant** — le bouton `+` voisin, lui, ajoute une tâche
  *dans* le groupe. Les deux boutons n'apparaissent qu'au survol de la ligne, par l'opacité ;
- **déplacer** — glisser une barre la décale, glisser ses bords l'allonge ;
- **lier** — tirer la pastille du bord droit d'une barre vers une autre crée la flèche.

Le **clic droit** ouvre un menu sur tout objet du diagramme (`components/gantt/ContextMenu.tsx`) :
sur une tâche ou un jalon — modifier, ajouter après, dupliquer, supprimer ; sur un groupe —
modifier, ajouter une tâche dedans, groupe suivant, replier ou déplier, supprimer ; sur une
flèche — supprimer le lien ; sur le fond de la frise — nouvelle tâche, nouveau jalon ou nouveau
groupe, datés du jour sous le pointeur. Le clic droit sélectionne sa cible, le menu se parcourt
aux flèches et se ferme à Échap ; un lecteur n'a pas de menu, le navigateur garde le sien.
`buildMenuItems` est une fonction pure de l'état, testée sans DOM.

L'insertion « après » renumérote la fratrie de 0 à n plutôt que d'incrémenter les rangs suivants :
des `sort_order` troués (une suppression en laisse) donneraient sinon deux frères au même rang, et
l'ordre d'affichage deviendrait arbitraire. Voir `planInsertAfter` dans `lib/gantt/scheduling.ts`.

Un projet vide propose aussi trois **modèles** (`lib/gantt/templates.ts`) : lancement produit,
sprint de deux semaines, événement. Un modèle est daté depuis le jour où on l'applique et créé
ligne par ligne avec les commandes ordinaires (`lib/gantt/apply-template.ts`) : moins de dix
lignes, et chaque commande porte déjà l'optimisme, le retour arrière et le toast d'erreur.

Sous le diagramme, une **barre de synthèse** (`lib/gantt/summary.ts`) donne le nombre de tâches, de
groupes et de jalons, la période couverte, l'avancement global, le prochain jalon et le nombre de
tâches en retard. L'avancement y est pondéré par la **durée** et non par le nombre de tâches, et
les groupes sont exclus de tous les calculs : leurs colonnes `start_date` / `end_date` ne sont
jamais réécrites quand leurs enfants bougent, c'est `computeLayout` qui recalcule leur empan à
l'affichage. La liste des projets réutilise la même fonction pour la vignette de chaque carte.

## Marque et icônes

Le signe (trois barres en escalier sur un carré d'encre) vit en deux exemplaires qui doivent
rester identiques : `components/layout/Logo.tsx` pour l'interface et `app/icon.svg` pour le
favicon. `node scripts/make-icons.mjs` en dérive `app/favicon.ico` (16/32/48) et
`app/apple-icon.png` (180) avec `sharp`, qui vient des dépendances de Next ; les fichiers
produits sont versionnés. L'aperçu de lien (`app/opengraph-image.tsx`) est généré par `next/og`
et va chercher Archivo Black chez Google Fonts au moment du rendu, avec repli sur la police
système sans réseau.

Le nom s'écrit « BradGantt », en casse mixte et sans soulignement : le jaune ne signifie plus
que « actif », partout.

## Téléphone

Sous 640 px de large, la vue est dite **compacte** (`COMPACT_BREAKPOINT` dans `lib/gantt/geometry.ts`) :
la sidebar prend un peu moins de la moitié de l'écran au lieu de 300 px fixes (`sidebarWidthFor`),
les retraits se resserrent, l'avatar d'assigné et la barre de synthèse s'effacent, le zoom
n'affiche que ses initiales. Sur un appareil sans survol (variante Tailwind `touch:`, soit
`@media (hover: none)`), les commandes révélées au survol — poignées de liaison et de
réordonnancement, boutons `↳` et `+` — sont visibles en permanence : par l'opacité, comme au
bureau, jamais par un rendu conditionnel.

En portrait, un bandeau invite à tourner le téléphone : en paysage, la largeur repasse au-dessus
du seuil et la vue retrouve sa mise en page de bureau (la variante `short:`, `max-height: 500px`,
efface alors ce qui n'est pas le diagramme). Le bandeau se ferme pour la session.

Les tests `tests/e2e/mobile.spec.ts` tournent en émulation Pixel 7 (portrait puis paysage).

## Thème sombre

La bascule est dans le menu du compte (l'avatar, à droite de l'en-tête de la liste comme de
celui d'un projet) et en haut à droite de la page de connexion. Un choix explicite est enregistré
dans `localStorage` ; sans choix, l'application suit le réglage du système, y compris quand il
change en cours de session : c'est le menu du compte, présent dans les deux en-têtes, qui écoute
ce changement (et la bascule, sur la page de connexion). Un script placé en premier enfant du
`<body>` par le layout racine pose `data-theme` sur `<html>` avant le premier rendu, pour éviter
l'éclair clair d'une page sombre (`components/layout/ThemeToggle.tsx`).

Les couleurs sont des jetons Tailwind dans un `@theme` non inline (`app/globals.css`) : les
utilitaires référencent `var(--color-…)`, et le bloc `:root[data-theme="dark"]` les redéfinit.
Seule la STRUCTURE s'inverse (crème, papier, encre, bandes). Les couleurs de tâches et le jaune ne
changent pas, et le texte posé sur elles utilise le jeton `on-data` (encre noire fixe) — `text-ink`
deviendrait crème sur tangerine la nuit. L'en-tête a ses propres jetons (`header`, `on-header`)
pour rester sombre dans les deux thèmes.

## Membres et invitations

L'onglet **Membres** de l'en-tête du projet (`/projects/<id>/membres`) liste l'équipe. Le
propriétaire y invite, change un rôle (Éditeur / Lecteur) ou retire quelqu'un. La ligne du
propriétaire est intouchable : pas de transfert de propriété dans cette version.

Inviter une adresse suit deux chemins :

- **le compte existe** → la personne devient membre immédiatement et reçoit un email
  « tu as été ajouté » ;
- **le compte n'existe pas** → une invitation à token est enregistrée, la personne reçoit un
  lien `/invite/<token>`. L'invitation reste visible et révocable tant qu'elle n'est pas
  acceptée.

Ouvrir le lien vaut acceptation : la fonction SQL `accept_invitation` vérifie que l'adresse du
compte connecté est bien celle de l'invitation (sans tenir compte de la casse), ajoute la
membership et consomme le token. Sous un autre compte, la page propose « Changer de compte ».

**Emails.** Sans `RESEND_API_KEY`, ils sont écrits dans la console du serveur — le lien
d'invitation y reste lisible, le flux complet se joue donc en local sans compte Resend. Avec une
clé, `EMAIL_FROM` doit utiliser un domaine vérifié chez Resend : le domaine de bac à sable
`onboarding@resend.dev` n'écrit qu'à l'adresse du compte Resend lui-même.

**En mode test seulement** (`E2E_ENABLED=1`), la route d'invitation renvoie le lien dans sa
réponse et le formulaire l'affiche. Ce lien est un jeton d'accès au projet : il ne sort jamais
de la boîte mail en production.

## Production

- **Hébergement** : Vercel, projet `brad-gantt` → https://brad-gantt.vercel.app
  (déploiement auto à chaque push ; sur le plan Hobby, le commit HEAD doit être
  signé `leo.peyre95@gmail.com`, sinon Vercel bloque silencieusement le build).
- **Supabase cloud** : projet `vnwpgehxwcomhsgctqsl` (compte principal, région
  eu-central-1) — migré le 2026-09-03 depuis l'ancien compte secondaire
  (schéma + données + comptes `auth.users`, sauvegardes dans
  `~/Bureau/Projets/.backups-supabase/`).
- **Variables Vercel** : `NEXT_PUBLIC_SUPABASE_URL` et
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (clé anon « legacy ») du projet cloud,
  `NEXT_PUBLIC_SITE_URL` (l'URL publique, sans quoi les liens d'invitation
  pointeraient sur l'origine de la requête), et pour les emails d'invitation
  `RESEND_API_KEY` + `EMAIL_FROM` sur un domaine vérifié. Sans clé Resend,
  l'application fonctionne mais les invitations partent dans les journaux
  Vercel au lieu d'une boîte mail.
- **Migrations** : `npx supabase db push` applique à la base cloud les migrations
  absentes de son historique. Une migration ne doit donc jamais être antidatée
  par rapport à la dernière déjà appliquée.
- **Lier le CLI au projet cloud** (après un clone ou si `supabase/.temp` pointe
  encore sur l'ancien projet) :
  ```bash
  npx supabase login
  npx supabase link --project-ref vnwpgehxwcomhsgctqsl
  ```
- **Auth Google** : provider activé dans le dashboard Supabase ; l'URI de
  redirection `https://vnwpgehxwcomhsgctqsl.supabase.co/auth/v1/callback` est
  déclarée dans le client OAuth de la console Google Cloud.

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
