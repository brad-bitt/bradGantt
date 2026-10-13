# BradGantt

Application de **diagrammes de Gantt collaboratifs**. Plusieurs personnes partagent un
projet (rôles propriétaire / éditeur / lecteur), y organisent tâches, groupes et jalons
avec des dépendances, et suivent un backlog de tickets.

- En ligne : https://brad-gantt.vercel.app
- Code : https://github.com/brad-bitt/bradGantt
- **Guide pour être autonome** (variables d'env, comptes, déploiement, sauvegardes,
  dépannage) : [`docs/GUIDE-AUTONOMIE.md`](docs/GUIDE-AUTONOMIE.md)

## Stack

| Brique            | Outil                                                        |
| ----------------- | ------------------------------------------------------------ |
| Front + serveur   | Next.js 15 (App Router), React 19, TypeScript                 |
| Style             | Tailwind CSS v4 (identité « éditoriale » : papier, encre, Fraunces) |
| Base, auth, temps réel | Supabase (Postgres + RLS, Auth Google / lien magique) |
| État côté client  | Zustand (commandes optimistes avec retour arrière)            |
| Emails d'invitation | Resend (facultatif : sans clé, les emails s'affichent dans la console) |
| Tests             | Vitest + Testing Library, pgTAP (base), Playwright (bout en bout) |
| Hébergement       | Vercel (app) + Supabase cloud (base)                          |

## Démarrage rapide (en local)

Prérequis : **Node.js 20+** et **Docker** (la base Supabase locale tourne dans Docker).

```bash
npm install
npx supabase start                    # démarre la base locale (Postgres, Auth, Studio…)
cp .env.local.example .env.local      # puis colle les clés affichées par la commande précédente
npx supabase db reset                 # crée les tables + les données de test
npm run dev                           # http://localhost:3100
```

`npx supabase start` affiche `API URL`, `anon key` et `service_role key` : ce sont les
valeurs à mettre dans `.env.local` (le détail de chaque variable est dans
[`docs/GUIDE-AUTONOMIE.md`](docs/GUIDE-AUTONOMIE.md#1-les-variables-denvironnement)).
Pour revoir ces clés plus tard : `npx supabase status`. Pour arrêter : `npx supabase stop`.

`npx supabase db reset` est sans danger à rejouer sur **la base locale** : il la recrée
entièrement à partir des migrations et du seed. (Il ne touche pas la base en ligne.)

### Comptes de test (local uniquement)

Le seed (`supabase/seed.sql`) crée quatre comptes, tous avec le mot de passe `password123` :
`alice@test.local`, `bob@test.local`, `carol@test.local`, `dave@test.local`.

En local, la connexion Google n'est pas configurée : utilise la page **`/e2e-login`**
(email + mot de passe). Elle n'existe que si la variable serveur `E2E_ENABLED=1` est
définie (les tests Playwright la définissent eux-mêmes). Pour l'utiliser à la main :
`E2E_ENABLED=1 npm run dev`. **Ne jamais la définir en production** : c'est une porte
de connexion qui contourne l'auth normale (voir `lib/e2e.ts`).

### Ports

Ports non standards, pour cohabiter avec d'autres projets Supabase sur le même poste
(valeurs dans `supabase/config.toml`, `project_id = "bradgantt"`, et dans `package.json`).

| Service                        | Port  |
| ------------------------------ | ----- |
| Application (`npm run dev`)    | 3100  |
| Supabase API (PostgREST/Auth)  | 54421 |
| Base Postgres                  | 54422 |
| Supabase Studio (interface web de la base) | 54423 |
| Boîte mail locale (Inbucket)   | 54424 |

## Commandes

| Commande              | Ce qu'elle fait                                              |
| --------------------- | ------------------------------------------------------------ |
| `npm run dev`         | Lance l'app en local sur :3100                                |
| `npm run build`       | Construit la version de production (ce que fait Vercel)       |
| `npm start`           | Lance la version construite                                   |
| `npm test`            | Tests unitaires (Vitest)                                      |
| `npm run test:db`     | Tests de la base (pgTAP : schéma, droits RLS, invitations)    |
| `npm run test:e2e`    | Tests de bout en bout (Playwright, lance lui-même `npm run dev`) |
| `npm run typecheck`   | Vérification TypeScript                                       |
| `npm run lint`        | ESLint                                                        |
| `npm run db:types`    | Régénère `lib/supabase/types.ts` depuis le schéma local       |

`test:db`, `test:e2e` et `db:types` ont besoin de la base locale démarrée
(`npx supabase start`). Première fois avec Playwright : `npx playwright install chromium`.

Avant de pousser, le minimum : `npm run typecheck && npm run lint && npm test && npm run build`.

## Structure du projet

```
app/                  Pages et routes Next.js
  (auth)/login/       Page de connexion (Google + lien magique par email)
  (app)/(accueil)/    Liste des projets (/projects)
  (app)/(projet)/     Un projet : Gantt, Tickets, Membres
  auth/callback/      Retour de connexion (Google / lien magique)
  api/invitations/    Envoi des invitations par email
  invite/[token]/     Acceptation d'une invitation
  e2e-login/          Connexion par mot de passe, tests uniquement
  globals.css         Couleurs, polices, thème sombre
components/           Composants React (gantt, tickets, members, layout, ui…)
lib/                  Logique : client Supabase, moteur Gantt, invitations, tickets…
  supabase/           Création des clients Supabase (navigateur, serveur, middleware) + types
middleware.ts         Rafraîchit la session et protège les pages connectées
supabase/
  config.toml         Config de la base locale (ports, auth)
  migrations/         Évolutions du schéma SQL, appliquées dans l'ordre
  seed.sql            Données de test locales
  tests/              Tests pgTAP de la base
tests/unit/           Tests Vitest
tests/e2e/            Tests Playwright
scripts/make-icons.mjs  Génère favicon et icône Apple depuis app/icon.svg
docs/                 Guide d'autonomie + specs et plans de conception (docs/superpowers/)
```

## Mise en production

- **App** : Vercel, projet `brad-gantt`. Chaque `git push` sur la branche `master`
  met à jour le site en ligne ; un push sur une autre branche crée seulement une
  version de prévisualisation (URL à part).
- **Base** : Supabase cloud, projet `vnwpgehxwcomhsgctqsl` (région eu-central-1).
- **Nouvelle migration** : créer le fichier dans `supabase/migrations/`, tester en local
  (`npx supabase db reset`), puis l'appliquer en ligne avec `npx supabase db push`.

Pas-à-pas complet (variables Vercel, Google OAuth, sauvegardes, pièges) :
[`docs/GUIDE-AUTONOMIE.md`](docs/GUIDE-AUTONOMIE.md).

> Piège n°1 : sur le plan Vercel gratuit, un commit signé avec une adresse email
> inconnue de Vercel est **bloqué sans message clair**. Ce repo doit commiter avec
> `leo.peyre95@gmail.com` (`git config user.email` dans le dossier du projet).

## Fonctionnalités en détail

### Navigation

L'en-tête change selon le contexte. Sur `/projects`, il porte la marque et le menu du
compte. Dans un projet, il porte le fil d'Ariane « Projets / Nom », les onglets **Gantt**,
**Tickets** et **Membres**, la pile d'avatars et le menu du compte ; le propriétaire a un menu
« ⋯ » à côté du nom (renommer, activer ou désactiver les tickets, supprimer). Côté code, les
deux en-têtes vivent dans deux groupes de routes : `app/(app)/(accueil)` et `app/(app)/(projet)`.

Chaque écran n'a qu'une action principale (encre pleine) ; les commandes secondaires ont un
filet, les commandes d'objet sont du texte révélé au survol. Sur `/projects`,
« N en retard » filtre la liste (`?filtre=retard`) ; dans le Gantt, le même chiffre en pied de
page met les barres en retard en évidence (Échap pour l'éteindre).

### Tickets

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

### Construire un diagramme

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

### Design

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

### Marque et icônes

Le signe (trois barres en escalier sur un carré d'encre) vit en deux exemplaires qui doivent
rester identiques : `components/layout/Logo.tsx` pour l'interface et `app/icon.svg` pour le
favicon. `node scripts/make-icons.mjs` en dérive `app/favicon.ico` (16/32/48) et
`app/apple-icon.png` (180) avec `sharp`, qui vient des dépendances de Next ; les fichiers
produits sont versionnés. L'aperçu de lien (`app/opengraph-image.tsx`) est généré par `next/og`
et va chercher Fraunces chez Google Fonts au moment du rendu, avec repli sur la police
système sans réseau.

Le nom s'écrit « BradGantt », en Fraunces et en casse mixte. Le signe est un carré d'encre nu :
plus de cadre clair, il n'a plus de bandeau sombre d'où se détacher.

### Téléphone

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

### Thème sombre

La bascule est dans le menu du compte (l'avatar, à droite de l'en-tête de la liste comme de
celui d'un projet) et en haut à droite de la page de connexion. Un choix explicite est enregistré
dans `localStorage` ; sans choix, l'application suit le réglage du système, y compris quand il
change en cours de session : c'est le menu du compte, présent dans les deux en-têtes, qui écoute
ce changement (et la bascule, sur la page de connexion). Un script placé en premier enfant du
`<body>` par le layout racine pose `data-theme` sur `<html>` avant le premier rendu, pour éviter
l'éclair clair d'une page sombre (`components/layout/ThemeToggle.tsx`).

Les couleurs sont des jetons Tailwind dans un `@theme` non inline (`app/globals.css`) : les
utilitaires référencent `var(--color-…)`, et le bloc `:root[data-theme="dark"]` les redéfinit.
Seule la STRUCTURE s'inverse (`paper`, `surface`, `ink`, `ink-soft`, `line`). L'or, les rouges et
les huit couleurs de tâches ne changent pas ; une barre les porte en teinte pâle (`--data-tint`,
32 % le jour, 45 % la nuit) sous un texte en encre du thème, et le CSS de `.data-bar` fait seul la
conversion. La variante Tailwind `dark:` cible `[data-theme="dark"]`.

### Membres et invitations

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

## Architecture

Le détail des choix de conception vit dans `docs/superpowers/` :

- `docs/superpowers/specs/` — specs de conception (base, tickets, navigation, identité éditoriale)
- `docs/superpowers/plans/` — plans d'implémentation par lot de fonctionnalités

Deux façons d'écrire en base coexistent **volontairement** :

- **Server Actions + `revalidatePath`** pour les projets (créer, renommer, supprimer) :
  actions rares, un aller-retour serveur est acceptable et simple à auditer sous RLS.
- **Un store à commandes optimistes avec retour arrière** (`lib/optimistic/`, moteur Gantt)
  pour les tâches : glisser une barre exige un retour visuel immédiat ; la modification
  est appliquée tout de suite à l'écran, puis confirmée ou annulée selon la réponse serveur.
