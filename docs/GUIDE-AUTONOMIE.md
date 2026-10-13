# Guide d'autonomie — BradGantt

Ce guide sert à faire vivre BradGantt tout seul : savoir où sont les clés, comment
déployer, sauvegarder la base et réparer les pannes courantes. Lis-le dans l'ordre
la première fois, ensuite sers-t'en comme d'un pense-bête.

> Les menus des sites (Supabase, Vercel, Google) bougent de temps en temps. Si un
> intitulé a changé, cherche le mot-clé indiqué (« API », « Environment Variables »…),
> l'emplacement reste à peu près le même.

---

## 0. Les comptes utilisés

| Service | Rôle dans le projet | Compte | Lien direct |
| ------- | ------------------- | ------ | ----------- |
| **GitHub** | Le code | `brad-bitt` (repo `brad-bitt/bradGantt`) | https://github.com/brad-bitt/bradGantt |
| **Vercel** | Héberge le site | compte `brad-bitt`, équipe `leo951s-projects`, projet `brad-gantt` | https://vercel.com/leo951s-projects/brad-gantt |
| **Supabase** | Base de données + connexion des utilisateurs | `leo.peyre95@gmail.com`, projet ref `vnwpgehxwcomhsgctqsl` (région Francfort / eu-central-1) | https://supabase.com/dashboard/project/vnwpgehxwcomhsgctqsl |
| **Google Cloud** | Bouton « Se connecter avec Google » | `leo.peyre95@gmail.com` | https://console.cloud.google.com/apis/credentials |
| **Resend** (facultatif) | Envoi des emails d'invitation | à compléter si un compte existe | https://resend.com/api-keys |

Le site en ligne : https://brad-gantt.vercel.app

Tout est sur des offres **gratuites**. Conséquences : voir « Pièges connus » (§ 7).

---

## 1. Les variables d'environnement

Ce sont des réglages (adresses, clés) que l'app lit au démarrage. Elles ne sont
**jamais** dans le code ni sur GitHub : en local elles sont dans le fichier
`.env.local`, en ligne elles sont dans Vercel.

| Variable | À quoi elle sert | Où la récupérer | Obligatoire ? | Local | Vercel |
| -------- | ---------------- | --------------- | ------------- | :---: | :----: |
| `NEXT_PUBLIC_SUPABASE_URL` | Adresse de la base Supabase | **Local** : `npx supabase status` → ligne `API URL` (`http://127.0.0.1:54421`). **En ligne** : Supabase → projet BradGantt → bouton **Connect** en haut (ou Project Settings → **Data API**) → **Project URL** (`https://vnwpgehxwcomhsgctqsl.supabase.co`) | Oui | ✔ | ✔ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique pour parler à la base (la sécurité repose sur les règles RLS, pas sur le secret de cette clé) | **Local** : `npx supabase status` → `anon key`. **En ligne** : Supabase → Project Settings → **API Keys** → onglet **Legacy API keys** → `anon` `public` | Oui | ✔ | ✔ |
| `NEXT_PUBLIC_SITE_URL` | Adresse publique du site, utilisée pour fabriquer les liens dans les emails d'invitation | **Local** : `http://localhost:3100`. **En ligne** : `https://brad-gantt.vercel.app` (à écrire soi-même, rien à récupérer) | Conseillée (sinon le lien prend l'adresse de la page en cours) | ✔ | ✔ |
| `RESEND_API_KEY` | Clé pour envoyer les emails d'invitation | Resend → **API Keys** → Create API Key (affichée une seule fois, copie-la tout de suite) | Non : sans elle, l'email est juste écrit dans les logs (console en local, onglet **Logs** sur Vercel) | facultatif | si tu veux de vrais emails |
| `EMAIL_FROM` | Expéditeur des invitations, ex. `BradGantt <invitations@ton-domaine.fr>` | À écrire soi-même. L'adresse doit être sur un domaine vérifié dans Resend → **Domains**. Par défaut `BradGantt <onboarding@resend.dev>`, qui n'envoie qu'à l'adresse du compte Resend | Non | facultatif | avec `RESEND_API_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé « admin » qui ignore toutes les règles de sécurité. Sert **uniquement** aux tests Playwright | `npx supabase status` → `service_role key` (la clé **locale**) | Pour `npm run test:e2e` seulement | ✔ | **✘ jamais** |
| `E2E_ENABLED` | Ouvre la page `/e2e-login` (connexion par mot de passe pour les tests) | Mettre `1` à la main si besoin | Non | facultatif | **✘ jamais** |

À retenir :

- Ce qui commence par `NEXT_PUBLIC_` est **visible dans le navigateur** : n'y mets jamais
  de secret.
- `SUPABASE_SERVICE_ROLE_KEY` et `E2E_ENABLED` ne vont **jamais** sur Vercel.
- Les valeurs locales (`npx supabase status`) et en ligne (dashboard Supabase) sont
  **différentes** : ne les mélange pas.

### Remplir le `.env.local` (sur ton ordinateur)

```bash
cp .env.local.example .env.local     # crée le fichier à partir du modèle
npx supabase start                   # (Docker doit tourner) affiche les clés locales
```

Ouvre `.env.local`, colle `API URL` dans `NEXT_PUBLIC_SUPABASE_URL`, `anon key` dans
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `service_role key` dans `SUPABASE_SERVICE_ROLE_KEY`.
Laisse le reste tel quel. Relance `npm run dev` après chaque modification du fichier.

Tu as perdu les clés locales ? `npx supabase status` les réaffiche.

### Mettre ou changer une variable sur Vercel

1. https://vercel.com → projet **brad-gantt** → **Settings** → **Environment Variables**.
2. **Add New** (ou les `⋯` d'une variable existante → **Edit**). Coche au minimum
   **Production** (et **Preview** si tu veux que les versions de test marchent aussi).
3. **Important** : une variable modifiée n'est prise en compte qu'au prochain
   déploiement. Va dans **Deployments** → le dernier → `⋯` → **Redeploy**.

Sur Vercel, il doit y avoir : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SITE_URL`, et en option `RESEND_API_KEY` + `EMAIL_FROM`.

---

## 2. Déployer

### Le cas normal : push sur GitHub

```bash
git checkout master
git merge ma-branche          # ou fusionne une Pull Request sur GitHub
git push                     # Vercel déploie tout seul en ~1-2 min
```

- Push sur **`master`** → le site en ligne est mis à jour.
- Push sur une autre branche → une **Preview** (URL à part, visible dans Vercel →
  Deployments). Pratique pour tester avant.
- Suivre le déploiement : Vercel → brad-gantt → **Deployments**. Si c'est rouge, clique
  dessus → **Build Logs** pour lire l'erreur.

Avant de pousser, vérifie que ça construit chez toi :

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

### En secours : depuis ton ordinateur (CLI Vercel)

```bash
npx vercel login                    # avec le compte brad-bitt
npx vercel link                     # choisir leo951s-projects / brad-gantt
npx vercel --prod                   # déploie le dossier actuel en production
```

### Le piège de l'email Git (à vérifier une fois par poste)

Sur le plan gratuit, Vercel **bloque sans prévenir** un commit dont l'auteur a un email
qu'il ne connaît pas. Sur le PC du travail, l'email Git global est l'adresse pro : il
faut donc forcer l'adresse perso **dans ce projet** :

```bash
git config user.email            # doit afficher leo.peyre95@gmail.com
git config user.email leo.peyre95@gmail.com   # si ce n'est pas le cas
```

(Aujourd'hui c'est bien réglé dans ce dossier. Sur un nouveau clone ou un nouveau PC,
refais-le.) Si un commit est déjà parti avec la mauvaise adresse :
`git commit --amend --reset-author --no-edit` puis `git push --force-with-lease`
(seulement si personne d'autre ne travaille sur la branche).

---

## 3. La base de données

### Voir / modifier les données à la main

Supabase → projet BradGantt → **Table Editor** (comme un tableur) ou **SQL Editor**
(pour taper du SQL). En local, même chose sur http://localhost:54423 (Studio).

### Changer le schéma (nouvelle table, nouvelle colonne…)

Le schéma est décrit par les fichiers de `supabase/migrations/`, appliqués dans
l'ordre de leur nom (qui commence par une date).

```bash
npx supabase migration new ajout_truc     # crée supabase/migrations/<date>_ajout_truc.sql
# écris le SQL dans ce fichier
npx supabase db reset                     # teste en local (recrée la base locale)
npm run test:db                           # vérifie les tests de la base
npm run db:types                          # met à jour lib/supabase/types.ts
```

Puis, pour l'appliquer **en ligne** :

```bash
npx supabase login                                    # une fois par poste
npx supabase link --project-ref vnwpgehxwcomhsgctqsl  # une fois par clone (demande le mot de passe de la base)
npx supabase db push                                  # applique les migrations manquantes
```

Règles : ne modifie jamais une migration déjà appliquée en ligne (crée-en une nouvelle),
et ne crée jamais une migration avec une date plus ancienne que la dernière.

`npx supabase db reset` ne touche **que** la base locale. Ne lance jamais
`db reset --linked` : ça effacerait la base en ligne.

### Le mot de passe de la base

Il est demandé par `supabase link` et pour les sauvegardes. Il n'est affiché nulle part :
si tu l'as oublié, Supabase → Project Settings → **Database** → **Reset database
password**. (Ça ne casse pas l'app : elle n'utilise pas ce mot de passe.)

### Faire une sauvegarde

Le plus simple (utilise Docker, donc la bonne version de Postgres) :

```bash
mkdir -p ~/Bureau/Projets/.backups-supabase
npx supabase db dump --linked -f ~/Bureau/Projets/.backups-supabase/bradgantt-schema-$(date +%Y%m%d).sql
npx supabase db dump --linked --data-only -f ~/Bureau/Projets/.backups-supabase/bradgantt-data-$(date +%Y%m%d).sql
```

Alternative avec `pg_dump` : récupère la chaîne de connexion dans Supabase → bouton
**Connect** → **Session pooler** (remplace `[YOUR-PASSWORD]` par le mot de passe de la
base). Attention, le `pg_dump` installé sur ce poste est en version 14 alors que la base
est en Postgres 17 : il refusera. Passe par Docker :

```bash
docker run --rm -v ~/Bureau/Projets/.backups-supabase:/out postgres:17 \
  pg_dump "<chaîne de connexion Session pooler>" -Fc -f /out/bradgantt-$(date +%Y%m%d).dump
```

Ne commite jamais une sauvegarde ni une chaîne de connexion. Des sauvegardes du
2026-09-02 (avant la migration de compte) existent déjà dans
`~/Bureau/Projets/.backups-supabase/`.

---

## 4. Connexion Google (OAuth)

Les utilisateurs se connectent avec Google ou par lien magique envoyé par email. Trois
endroits doivent être d'accord :

**a. Google Cloud Console** (https://console.cloud.google.com, compte
leo.peyre95@gmail.com) → **APIs & Services** → **Credentials** → le client OAuth
« Web application » utilisé par BradGantt :

- **Authorized redirect URIs** doit contenir :
  `https://vnwpgehxwcomhsgctqsl.supabase.co/auth/v1/callback`
- Le **Client ID** et le **Client secret** de ce client sont ceux collés dans Supabase
  (étape b). Si tu régénères le secret ici, recolle-le là-bas.

**b. Supabase** → projet → **Authentication** → **Sign In / Providers** → **Google** :
activé, avec le Client ID et le Client secret de l'étape a.

**c. Supabase** → **Authentication** → **URL Configuration** :

- **Site URL** : `https://brad-gantt.vercel.app`
- **Redirect URLs** : `https://brad-gantt.vercel.app/auth/callback` (ajoute
  `https://brad-gantt-*-leo951s-projects.vercel.app/auth/callback` si tu veux pouvoir te
  connecter sur les Previews).

Si l'adresse du site change un jour (nom de domaine perso…), mets à jour **c** et la
variable Vercel `NEXT_PUBLIC_SITE_URL`. Google (étape a) n'a pas besoin de changer : il ne
connaît que l'adresse Supabase.

En local, Google n'est pas branché : connecte-toi via `/e2e-login` (voir le README).

---

## 5. Les emails

- **Emails de connexion (lien magique)** : envoyés par Supabase lui-même. Le service
  gratuit est limité à quelques emails par heure. Pour plus : Supabase → Authentication →
  **Emails** → SMTP Settings (on peut y mettre les identifiants SMTP de Resend).
- **Emails d'invitation à un projet** : envoyés par l'app via Resend
  (`RESEND_API_KEY` + `EMAIL_FROM`, voir § 1). Sans clé, rien ne part : le lien
  d'invitation est écrit dans Vercel → brad-gantt → **Logs**, tu peux l'y copier et
  l'envoyer toi-même.

---

## 6. Repartir de zéro sur un nouveau PC

```bash
git clone git@github.com:brad-bitt/bradGantt.git && cd bradGantt
git config user.email leo.peyre95@gmail.com
npm install
npx supabase start
cp .env.local.example .env.local     # puis remplis-le (§ 1)
npx supabase db reset
npm run dev                          # http://localhost:3100
```

Il faut Node.js 20+ et Docker installés.

---

## 7. Pièges connus

- **Déploiement Vercel qui ne démarre pas, sans erreur** → email Git inconnu de Vercel
  (§ 2). Vérifie `git log -1 --format=%ae`.
- **Le site affiche des erreurs / « Failed to fetch » après une période sans usage** →
  Supabase gratuit **met en pause** un projet inactif depuis ~1 semaine. Supabase →
  projet BradGantt → bouton **Restore project** (quelques minutes). Les données ne sont
  pas perdues. Au-delà de ~90 jours en pause, il peut ne plus être restaurable depuis le
  dashboard : passe le voir de temps en temps.
- **Variable modifiée sur Vercel mais rien ne change** → il faut **Redeploy** (§ 1).
- **Connexion Google qui renvoie sur `/login?error=auth` ou sur localhost** → vérifie
  Site URL / Redirect URLs dans Supabase (§ 4 c).
- **`npx supabase start` échoue** → Docker n'est pas lancé, ou un autre projet Supabase
  local occupe les mêmes ports (`npx supabase stop --project-id <autre>`).
- **`pg_dump` : « server version mismatch »** → utilise `npx supabase db dump` ou la
  commande Docker (§ 3).
- **`supabase db push` vise le mauvais projet** → `cat supabase/.temp/project-ref` doit
  afficher `vnwpgehxwcomhsgctqsl` ; sinon refais `npx supabase link`.
- **Invitations qui n'arrivent pas** → pas de `RESEND_API_KEY` sur Vercel, ou
  `EMAIL_FROM` en `onboarding@resend.dev` (n'envoie qu'au propriétaire du compte Resend).

---

## 8. Si ça casse : checklist

1. Le site répond-il ? Ouvre https://brad-gantt.vercel.app.
2. **Supabase en pause ?** Dashboard Supabase → si « Paused », clique **Restore**.
3. **Dernier déploiement rouge ?** Vercel → Deployments → Build Logs. Pour revenir en
   arrière tout de suite : sur un ancien déploiement vert → `⋯` → **Promote to Production**
   (ou **Instant Rollback**).
4. **Erreur à l'exécution ?** Vercel → brad-gantt → **Logs** (erreurs côté serveur) et la
   console du navigateur (F12).
5. **Problème de connexion ?** § 4 (Google, Site URL, Redirect URLs).
6. **Variables d'env** : sont-elles toutes là dans Vercel (§ 1) ? Ont-elles été
   modifiées sans Redeploy ?
7. Reproduire en local : `npx supabase start`, `npm run dev`, puis `npm run build` pour
   voir les erreurs de construction.
