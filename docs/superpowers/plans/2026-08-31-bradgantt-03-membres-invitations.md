# BradGantt — Plan 3/3 : Membres et invitations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'owner d'un projet d'inviter des membres par email (ajout direct si le compte existe, lien d'invitation sinon), de changer leur rôle et de les retirer ; permettre à l'invité d'accepter via `/invite/[token]` avec vérification de l'adresse.

**Architecture:** La logique d'invitation est un module pur `createInvitation(deps, input)` testé avec une base et un mailer factices ; la route `POST /api/invitations` ne fait que brancher Supabase (client de l'utilisateur, donc RLS) et Resend. L'acceptation est une fonction SQL `security definer` `accept_invitation(token)` testée en pgTAP. La gestion des membres passe par des server actions ; le `MembersDialog` lit les membres depuis le store Gantt (déjà hydraté) et rafraîchit la page après chaque changement.

**Tech Stack:** Next.js 15 (route handlers + server actions), Supabase (RLS + RPC), Resend (`resend` npm), Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-28-bradgantt-design.md` — sections 2 (membres), 4 (`accept_invitation`, RLS invitations/memberships), 8 (auth & invitations), 10 (erreurs d'invitation), 11 (tests).

## Global Constraints

- Prérequis : plans 1 et 2 terminés. Branche `feat/03-membres` créée depuis `feat/02-gantt` (ou `master` si mergé).
- Rôles invitables : `editor` | `viewer` uniquement. La ligne `owner` est intouchable (RLS déjà en place) ; pas de transfert d'ownership.
- Token d'invitation : 32 octets aléatoires encodés en `base64url` (43 caractères).
- Comparaison d'emails **insensible à la casse**, adresses normalisées en minuscules + trim avant stockage.
- La table `profiles` n'est **plus** lisible par tout compte connecté (durcie en fin de plan 1) : on ne voit que soi-même et les membres d'un projet partagé. La recherche d'un invité par email passe donc par la RPC `security definer` `find_invitee_profile(p_project_id, p_email)`, qui exige que l'appelant soit owner du projet — sinon ce serait un oracle d'énumération d'emails.
- Messages d'erreur (exacts, affichés inline dans le formulaire) : `Adresse email invalide`, `Rôle invalide`, `Seul le propriétaire peut inviter`, `Projet introuvable`, `Cette personne est déjà membre`, `Une invitation est déjà en attente pour cette adresse`.
- Pages d'erreur d'acceptation : `email_mismatch` → « Cette invitation est destinée à une autre adresse » + bouton « Changer de compte » ; `invitation_not_found` → « Lien invalide ou déjà utilisé ».
- Variables d'environnement : `RESEND_API_KEY` (absent → mailer console), `EMAIL_FROM` (défaut `BradGantt <onboarding@resend.dev>`), `NEXT_PUBLIC_SITE_URL`. En mode `E2E_ENABLED=1` seulement (variable **serveur**, jamais `NEXT_PUBLIC_*` qui serait inlinée au build), la route renvoie `inviteUrl` dans sa réponse et le formulaire l'affiche.
- Style néo-brutaliste et textes français comme aux plans précédents. `git add` explicite, jamais `--no-verify`, trailers de commit fournis par l'environnement.

---

## Carte des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/20260831000003_accept_invitation.sql` | Fonction `accept_invitation(p_token text) returns uuid` |
| `supabase/tests/0003_accept_invitation.test.sql` | pgTAP |
| `lib/invitations/types.ts` | `InviteRole`, `InvitationDb`, `Mailer`, `PendingInvitation`, `CreateInvitationResult` |
| `lib/invitations/emails.ts` | `invitationEmail()`, `addedEmail()` — sujet, html, texte |
| `lib/invitations/create.ts` | `createInvitation(deps, input)` — logique pure, `isValidEmail`, `normalizeEmail` |
| `lib/invitations/supabase-db.ts` | `createSupabaseInvitationDb(client, userId)` |
| `lib/invitations/mailer.ts` | `createMailer()` — Resend ou console |
| `lib/invitations/token.ts` | `newInviteToken()` |
| `app/api/invitations/route.ts` | `POST` — auth, appel de `createInvitation`, réponse JSON |
| `app/(app)/projects/[id]/members-actions.ts` | Server actions `changeMemberRole`, `removeMember`, `revokeInvitation` |
| `components/project/MembersDialog.tsx`, `InviteForm.tsx`, `MemberRow.tsx` | UI de gestion des membres |
| `components/gantt/GanttToolbar.tsx` | + bouton « Membres » |
| `lib/gantt/store.ts`, `app/(app)/projects/[id]/page.tsx` | + `invitations: PendingInvitation[]` dans le payload/store |
| `app/invite/[token]/page.tsx`, `app/invite/[token]/InviteError.tsx`, `app/invite/actions.ts` | Acceptation et pages d'erreur |
| `app/e2e-login/E2ELoginForm.tsx` | + bouton « Créer le compte » (tests) |
| `tests/unit/lib/invitations/*.test.ts` | Vitest |
| `tests/e2e/members.spec.ts`, `tests/e2e/invite.spec.ts` | Playwright |

---

### Task 1 : Fonction SQL `accept_invitation` + pgTAP

**Files:**
- Create : `supabase/migrations/20260831000003_accept_invitation.sql`, `supabase/tests/0003_accept_invitation.test.sql`

**Interfaces:**
- Produces : `public.accept_invitation(p_token text) returns uuid` (project_id) ; erreurs `not_authenticated`, `invitation_not_found`, `email_mismatch` (SQLSTATE `P0001`).

- [ ] **Step 1 : Branche**

```bash
git checkout -b feat/03-membres
```

- [ ] **Step 2 : Test pgTAP (échoue : fonction absente)**

`supabase/tests/0003_accept_invitation.test.sql` :

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'carol@test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'dave@test.local');

select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select public.create_project('Projet invit');
select tests.logout();
create table tests.ctx as select id as project_id from public.projects where name = 'Projet invit';
grant select on tests.ctx to authenticated;

select has_function('public', 'accept_invitation', array['text'], 'accept_invitation existe');

-- Invitation pour Dave (casse différente volontaire)
insert into public.invitations (project_id, email, role, token, invited_by)
select project_id, 'Dave@Test.local', 'viewer', 'tok-dave', 'a0000000-0000-0000-0000-000000000001' from tests.ctx;

-- Carol n'est pas la destinataire
select tests.login_as('a0000000-0000-0000-0000-000000000003', 'carol@test.local');
select throws_ok($$ select public.accept_invitation('tok-dave') $$, 'P0001', 'email_mismatch', 'mauvais email refusé');
select tests.logout();
select is((select count(*) from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000003'), 0::bigint, 'carol non ajoutée');

-- Dave accepte (comparaison insensible à la casse)
select tests.login_as('a0000000-0000-0000-0000-000000000004', 'dave@test.local');
select is((select public.accept_invitation('tok-dave')), (select project_id from tests.ctx), 'retourne le project_id');
select tests.logout();
select is((select role::text from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000004'), 'viewer', 'dave est viewer');
select isnt((select accepted_at from public.invitations where token = 'tok-dave'), null, 'accepted_at renseigné');

-- Deuxième usage refusé
select tests.login_as('a0000000-0000-0000-0000-000000000004', 'dave@test.local');
select throws_ok($$ select public.accept_invitation('tok-dave') $$, 'P0001', 'invitation_not_found', 'token déjà utilisé');
select throws_ok($$ select public.accept_invitation('inconnu') $$, 'P0001', 'invitation_not_found', 'token inconnu');
select tests.logout();

-- Une invitation adressée à l'owner ne le rétrograde pas
insert into public.invitations (project_id, email, role, token, invited_by)
select project_id, 'alice@test.local', 'viewer', 'tok-alice', 'a0000000-0000-0000-0000-000000000001' from tests.ctx;
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select public.accept_invitation('tok-alice');
select tests.logout();
select is((select role::text from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001'), 'owner', 'owner conservé');

select * from finish();
rollback;
```

Run : `npm run test:db` — Expected : FAIL sur `has_function`.

- [ ] **Step 3 : Migration**

`supabase/migrations/20260831000003_accept_invitation.sql` :

```sql
create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into inv from public.invitations where token = p_token and accepted_at is null;
  if inv.id is null then raise exception 'invitation_not_found'; end if;

  if lower(coalesce(auth.email(), '')) <> lower(inv.email) then raise exception 'email_mismatch'; end if;

  insert into public.memberships (project_id, user_id, role)
  values (inv.project_id, uid, inv.role)
  on conflict (project_id, user_id) do update
    set role = excluded.role
    where memberships.role <> 'owner';

  update public.invitations set accepted_at = now() where id = inv.id;
  return inv.project_id;
end $$;

revoke execute on function public.accept_invitation(text) from anon, public;
grant execute on function public.accept_invitation(text) to authenticated;

-- Recherche d'un invité par email. Passe par une RPC `security definer` parce que
-- la policy de `profiles` ne laisse plus voir que soi-même et les membres d'un
-- projet partagé (plan 1, migration 20260831000004) : un invité n'est par
-- définition pas encore membre. L'exigence « appelant owner du projet » évite
-- d'en faire un oracle d'énumération d'emails ouvert à tout compte.
create or replace function public.find_invitee_profile(p_project_id uuid, p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_member(p_project_id, 'owner') then raise exception 'not_project_owner'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  return uid;
end $$;

revoke execute on function public.find_invitee_profile(uuid, text) from anon, public;
grant execute on function public.find_invitee_profile(uuid, text) to authenticated;
```

- [ ] **Step 4 : Appliquer, tester, régénérer les types**

```bash
npx supabase db reset
npm run test:db
npm run db:types
```

Expected : `All tests successful` (0001 + 0002 + 0003) ; `lib/supabase/types.ts` contient `accept_invitation` dans `Functions`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260831000003_accept_invitation.sql supabase/tests/0003_accept_invitation.test.sql lib/supabase/types.ts
git commit -m "feat(db): fonction accept_invitation avec vérification d'email"
```

---

### Task 2 : Types, contenu des emails, mailer

**Files:**
- Create : `lib/invitations/types.ts`, `lib/invitations/emails.ts`, `lib/invitations/mailer.ts`, `lib/invitations/token.ts`
- Test : `tests/unit/lib/invitations/emails.test.ts`, `tests/unit/lib/invitations/token.test.ts`

**Interfaces:**
- Produces :

```ts
type InviteRole = 'editor' | 'viewer'
interface PendingInvitation { id: string; email: string; role: InviteRole; createdAt: string }
interface MailMessage { to: string; subject: string; html: string; text: string }
interface Mailer { send(message: MailMessage): Promise<void> }
interface InvitationDb {
  getMyRole(projectId: string): Promise<'owner' | 'editor' | 'viewer' | null>
  getProjectName(projectId: string): Promise<string | null>
  findProfileIdByEmail(email: string): Promise<string | null>
  isMember(projectId: string, userId: string): Promise<boolean>
  addMember(projectId: string, userId: string, role: InviteRole): Promise<void>
  hasPendingInvitation(projectId: string, email: string): Promise<boolean>
  insertInvitation(inv: { projectId: string; email: string; role: InviteRole; token: string }): Promise<void>
}
type CreateInvitationResult =
  | { ok: true; kind: 'added'; projectUrl: string }
  | { ok: true; kind: 'invited'; inviteUrl: string }
  | { ok: false; status: 400 | 403 | 404; error: string }
function invitationEmail(p: { projectName: string; inviterName: string; inviteUrl: string; role: InviteRole }): Omit<MailMessage, 'to'>
function addedEmail(p: { projectName: string; inviterName: string; projectUrl: string; role: InviteRole }): Omit<MailMessage, 'to'>
function createMailer(): Mailer
function newInviteToken(): string
```

- [ ] **Step 1 : Tests**

`tests/unit/lib/invitations/emails.test.ts` :

```ts
import { invitationEmail, addedEmail } from '@/lib/invitations/emails'

describe('emails', () => {
  it('invitationEmail contient le projet, l\'inviteur, le rôle et le lien', () => {
    const m = invitationEmail({ projectName: 'Refonte', inviterName: 'Alice Test', inviteUrl: 'https://x/invite/abc', role: 'editor' })
    expect(m.subject).toBe('Alice Test t\'invite sur le projet « Refonte »')
    expect(m.html).toContain('https://x/invite/abc')
    expect(m.html).toContain('éditeur')
    expect(m.text).toContain('https://x/invite/abc')
  })
  it('addedEmail pointe vers le projet', () => {
    const m = addedEmail({ projectName: 'Refonte', inviterName: 'Alice Test', projectUrl: 'https://x/projects/1', role: 'viewer' })
    expect(m.subject).toBe('Tu as été ajouté au projet « Refonte »')
    expect(m.text).toContain('https://x/projects/1')
    expect(m.html).toContain('lecteur')
  })
  it('échappe le HTML dans les noms', () => {
    const m = addedEmail({ projectName: '<b>x</b>', inviterName: 'A', projectUrl: 'https://x', role: 'viewer' })
    expect(m.html).not.toContain('<b>x</b>')
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
```

`tests/unit/lib/invitations/token.test.ts` :

```ts
import { newInviteToken } from '@/lib/invitations/token'

describe('newInviteToken', () => {
  it('produit 43 caractères base64url, uniques', () => {
    const a = newInviteToken(), b = newInviteToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 2 : Implémenter**

`lib/invitations/types.ts` :

```ts
export type InviteRole = 'editor' | 'viewer'
export const INVITE_ROLES: InviteRole[] = ['editor', 'viewer']
export const ROLE_LABEL: Record<InviteRole, string> = { editor: 'éditeur', viewer: 'lecteur' }

export interface PendingInvitation { id: string; email: string; role: InviteRole; createdAt: string }

export interface MailMessage { to: string; subject: string; html: string; text: string }
export interface Mailer { send(message: MailMessage): Promise<void> }

export interface InvitationDb {
  getMyRole(projectId: string): Promise<'owner' | 'editor' | 'viewer' | null>
  getProjectName(projectId: string): Promise<string | null>
  findProfileIdByEmail(email: string): Promise<string | null>
  isMember(projectId: string, userId: string): Promise<boolean>
  addMember(projectId: string, userId: string, role: InviteRole): Promise<void>
  hasPendingInvitation(projectId: string, email: string): Promise<boolean>
  insertInvitation(inv: { projectId: string; email: string; role: InviteRole; token: string }): Promise<void>
}

export type CreateInvitationResult =
  | { ok: true; kind: 'added'; projectUrl: string }
  | { ok: true; kind: 'invited'; inviteUrl: string }
  | { ok: false; status: 400 | 403 | 404; error: string }
```

`lib/invitations/emails.ts` :

```ts
import { ROLE_LABEL, type InviteRole, type MailMessage } from './types'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function layout(title: string, body: string, cta: { label: string; url: string }): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:32px;background:#FDF6E3;font-family:Arial,sans-serif;color:#111">
<div style="max-width:520px;margin:0 auto;background:#fff;border:3px solid #111;box-shadow:8px 8px 0 #111;padding:32px">
<h1 style="margin:0 0 16px;font-size:24px;text-transform:uppercase">${esc(title)}</h1>
<p style="font-size:16px;line-height:1.5">${body}</p>
<p style="margin-top:24px"><a href="${esc(cta.url)}" style="display:inline-block;background:#FFD500;color:#111;border:3px solid #111;box-shadow:4px 4px 0 #111;padding:12px 20px;font-weight:bold;text-decoration:none;text-transform:uppercase">${esc(cta.label)}</a></p>
<p style="font-size:12px;color:#555;word-break:break-all">Ou copie ce lien : ${esc(cta.url)}</p>
</div></body></html>`
}

export function invitationEmail(p: { projectName: string; inviterName: string; inviteUrl: string; role: InviteRole }): Omit<MailMessage, 'to'> {
  const role = ROLE_LABEL[p.role]
  return {
    subject: `${p.inviterName} t'invite sur le projet « ${p.projectName} »`,
    html: layout('Invitation', `<strong>${esc(p.inviterName)}</strong> t'invite à rejoindre le projet <strong>${esc(p.projectName)}</strong> sur BradGantt en tant que <strong>${role}</strong>.`, { label: "Accepter l'invitation", url: p.inviteUrl }),
    text: `${p.inviterName} t'invite à rejoindre le projet « ${p.projectName} » sur BradGantt en tant que ${role}.\n\nAccepter : ${p.inviteUrl}`,
  }
}

export function addedEmail(p: { projectName: string; inviterName: string; projectUrl: string; role: InviteRole }): Omit<MailMessage, 'to'> {
  const role = ROLE_LABEL[p.role]
  return {
    subject: `Tu as été ajouté au projet « ${p.projectName} »`,
    html: layout('Bienvenue', `<strong>${esc(p.inviterName)}</strong> t'a ajouté au projet <strong>${esc(p.projectName)}</strong> en tant que <strong>${role}</strong>.`, { label: 'Ouvrir le projet', url: p.projectUrl }),
    text: `${p.inviterName} t'a ajouté au projet « ${p.projectName} » en tant que ${role}.\n\nOuvrir : ${p.projectUrl}`,
  }
}
```

`lib/invitations/token.ts` :

```ts
import { randomBytes } from 'node:crypto'

export function newInviteToken(): string {
  return randomBytes(32).toString('base64url')
}
```

`lib/invitations/mailer.ts` :

```ts
import { Resend } from 'resend'
import type { Mailer } from './types'

const FROM = process.env.EMAIL_FROM ?? 'BradGantt <onboarding@resend.dev>'

export function createMailer(): Mailer {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return {
      async send(m) {
        console.info(`[mailer:console] → ${m.to} | ${m.subject}\n${m.text}`)
      },
    }
  }
  const resend = new Resend(key)
  return {
    async send(m) {
      const { error } = await resend.emails.send({ from: FROM, to: m.to, subject: m.subject, html: m.html, text: m.text })
      if (error) throw new Error(error.message)
    },
  }
}
```

```bash
npm install resend
```

Ajouter à `.env.local.example` : `RESEND_API_KEY=` et `EMAIL_FROM=BradGantt <onboarding@resend.dev>`.

Run : `npm test && npm run typecheck` — Expected : PASS

- [ ] **Step 3 : Commit**

```bash
git add lib/invitations/types.ts lib/invitations/emails.ts lib/invitations/mailer.ts lib/invitations/token.ts tests/unit/lib/invitations/emails.test.ts tests/unit/lib/invitations/token.test.ts package.json package-lock.json .env.local.example
git commit -m "feat(invitations): types, contenu des emails, mailer Resend/console"
```

---

### Task 3 : Logique pure `createInvitation`

**Files:**
- Create : `lib/invitations/create.ts`
- Test : `tests/unit/lib/invitations/create.test.ts`

**Interfaces:**
- Produces :

```ts
function isValidEmail(s: string): boolean
function normalizeEmail(s: string): string
interface CreateInvitationDeps { db: InvitationDb; mailer: Mailer; baseUrl: string; inviterName: string; newToken: () => string }
interface CreateInvitationInput { projectId: unknown; email: unknown; role: unknown }
function createInvitation(deps: CreateInvitationDeps, input: CreateInvitationInput): Promise<CreateInvitationResult>
```

- [ ] **Step 1 : Tests**

`tests/unit/lib/invitations/create.test.ts` :

```ts
import { createInvitation, isValidEmail, normalizeEmail } from '@/lib/invitations/create'
import type { InvitationDb, Mailer } from '@/lib/invitations/types'

function fakeDb(overrides: Partial<InvitationDb> = {}): InvitationDb {
  return {
    getMyRole: vi.fn().mockResolvedValue('owner'),
    getProjectName: vi.fn().mockResolvedValue('Refonte'),
    findProfileIdByEmail: vi.fn().mockResolvedValue(null),
    isMember: vi.fn().mockResolvedValue(false),
    addMember: vi.fn().mockResolvedValue(undefined),
    hasPendingInvitation: vi.fn().mockResolvedValue(false),
    insertInvitation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}
const mailer = (): Mailer => ({ send: vi.fn().mockResolvedValue(undefined) })
const deps = (db = fakeDb(), m = mailer()) => ({ db, mailer: m, baseUrl: 'https://brad.test', inviterName: 'Alice Test', newToken: () => 'TOKEN' })
const input = { projectId: 'p1', email: ' Dave@Test.local ', role: 'viewer' }

describe('helpers', () => {
  it('isValidEmail', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
  })
  it('normalizeEmail', () => expect(normalizeEmail(' Dave@Test.local ')).toBe('dave@test.local'))
})

describe('createInvitation — validation et droits', () => {
  it('400 email invalide', async () => {
    expect(await createInvitation(deps(), { ...input, email: 'x' })).toEqual({ ok: false, status: 400, error: 'Adresse email invalide' })
  })
  it('400 rôle invalide (owner interdit)', async () => {
    expect(await createInvitation(deps(), { ...input, role: 'owner' })).toEqual({ ok: false, status: 400, error: 'Rôle invalide' })
  })
  it('404 projet introuvable / non membre', async () => {
    expect(await createInvitation(deps(fakeDb({ getMyRole: vi.fn().mockResolvedValue(null) })), input)).toEqual({ ok: false, status: 404, error: 'Projet introuvable' })
  })
  it('403 si pas owner', async () => {
    expect(await createInvitation(deps(fakeDb({ getMyRole: vi.fn().mockResolvedValue('editor') })), input)).toEqual({ ok: false, status: 403, error: 'Seul le propriétaire peut inviter' })
  })
})

describe('createInvitation — compte existant', () => {
  it('ajoute directement la membership et envoie « ajouté »', async () => {
    const db = fakeDb({ findProfileIdByEmail: vi.fn().mockResolvedValue('u-dave') })
    const m = mailer()
    const res = await createInvitation(deps(db, m), input)
    expect(res).toEqual({ ok: true, kind: 'added', projectUrl: 'https://brad.test/projects/p1' })
    expect(db.findProfileIdByEmail).toHaveBeenCalledWith('dave@test.local')
    expect(db.addMember).toHaveBeenCalledWith('p1', 'u-dave', 'viewer')
    expect(db.insertInvitation).not.toHaveBeenCalled()
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'dave@test.local', subject: 'Tu as été ajouté au projet « Refonte »' }))
  })
  it('400 si déjà membre', async () => {
    const db = fakeDb({ findProfileIdByEmail: vi.fn().mockResolvedValue('u-dave'), isMember: vi.fn().mockResolvedValue(true) })
    expect(await createInvitation(deps(db), input)).toEqual({ ok: false, status: 400, error: 'Cette personne est déjà membre' })
  })
})

describe('createInvitation — compte inconnu', () => {
  it('insère une invitation et envoie le lien', async () => {
    const db = fakeDb()
    const m = mailer()
    const res = await createInvitation(deps(db, m), input)
    expect(res).toEqual({ ok: true, kind: 'invited', inviteUrl: 'https://brad.test/invite/TOKEN' })
    expect(db.insertInvitation).toHaveBeenCalledWith({ projectId: 'p1', email: 'dave@test.local', role: 'viewer', token: 'TOKEN' })
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'dave@test.local', subject: 'Alice Test t\'invite sur le projet « Refonte »' }))
  })
  it('400 si une invitation est déjà en attente', async () => {
    const db = fakeDb({ hasPendingInvitation: vi.fn().mockResolvedValue(true) })
    expect(await createInvitation(deps(db), input)).toEqual({ ok: false, status: 400, error: 'Une invitation est déjà en attente pour cette adresse' })
  })
  it('une erreur d\'envoi d\'email ne fait pas échouer l\'invitation', async () => {
    const m: Mailer = { send: vi.fn().mockRejectedValue(new Error('smtp')) }
    const res = await createInvitation(deps(fakeDb(), m), input)
    expect(res.ok).toBe(true)
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 2 : Implémenter**

`lib/invitations/create.ts` :

```ts
import { addedEmail, invitationEmail } from './emails'
import { INVITE_ROLES, type CreateInvitationResult, type InvitationDb, type InviteRole, type Mailer } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(s: string): boolean { return EMAIL_RE.test(s) }
export function normalizeEmail(s: string): string { return s.trim().toLowerCase() }

export interface CreateInvitationDeps {
  db: InvitationDb
  mailer: Mailer
  baseUrl: string
  inviterName: string
  newToken: () => string
}

export interface CreateInvitationInput { projectId: unknown; email: unknown; role: unknown }

export async function createInvitation(deps: CreateInvitationDeps, input: CreateInvitationInput): Promise<CreateInvitationResult> {
  const { db, mailer, baseUrl, inviterName, newToken } = deps

  if (typeof input.email !== 'string' || !isValidEmail(input.email.trim())) return { ok: false, status: 400, error: 'Adresse email invalide' }
  if (typeof input.role !== 'string' || !INVITE_ROLES.includes(input.role as InviteRole)) return { ok: false, status: 400, error: 'Rôle invalide' }
  if (typeof input.projectId !== 'string' || input.projectId.length === 0) return { ok: false, status: 404, error: 'Projet introuvable' }

  const projectId = input.projectId
  const email = normalizeEmail(input.email)
  const role = input.role as InviteRole

  const myRole = await db.getMyRole(projectId)
  if (myRole === null) return { ok: false, status: 404, error: 'Projet introuvable' }
  if (myRole !== 'owner') return { ok: false, status: 403, error: 'Seul le propriétaire peut inviter' }
  const projectName = (await db.getProjectName(projectId)) ?? 'BradGantt'

  const sendQuietly = async (to: string, m: { subject: string; html: string; text: string }) => {
    try { await mailer.send({ to, ...m }) } catch (e) { console.error('[invitations] envoi email échoué', e) }
  }

  const existingUserId = await db.findProfileIdByEmail(email)
  if (existingUserId) {
    if (await db.isMember(projectId, existingUserId)) return { ok: false, status: 400, error: 'Cette personne est déjà membre' }
    await db.addMember(projectId, existingUserId, role)
    const projectUrl = `${baseUrl}/projects/${projectId}`
    await sendQuietly(email, addedEmail({ projectName, inviterName, projectUrl, role }))
    return { ok: true, kind: 'added', projectUrl }
  }

  if (await db.hasPendingInvitation(projectId, email)) return { ok: false, status: 400, error: 'Une invitation est déjà en attente pour cette adresse' }
  const token = newToken()
  await db.insertInvitation({ projectId, email, role, token })
  const inviteUrl = `${baseUrl}/invite/${token}`
  await sendQuietly(email, invitationEmail({ projectName, inviterName, inviteUrl, role }))
  return { ok: true, kind: 'invited', inviteUrl }
}
```

Run : `npm test` — Expected : PASS

- [ ] **Step 3 : Commit**

```bash
git add lib/invitations/create.ts tests/unit/lib/invitations/create.test.ts
git commit -m "feat(invitations): logique de création d'invitation (ajout direct ou lien)"
```

---

### Task 4 : Adaptateur Supabase et route `POST /api/invitations`

**Files:**
- Create : `lib/invitations/supabase-db.ts`, `app/api/invitations/route.ts`

**Interfaces:**
- Consumes : `createClient` serveur, `createInvitation`, `createMailer`, `newInviteToken`.
- Produces : `createSupabaseInvitationDb(client, userId, projectId): InvitationDb` ; `POST /api/invitations` body `{ projectId, email, role }` → `200 { kind: 'added'|'invited', inviteUrl? }` (`inviteUrl` seulement si `E2E_ENABLED=1`) | `400/401/403/404 { error }`.

- [ ] **Step 1 : Adaptateur**

`lib/invitations/supabase-db.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { InvitationDb } from './types'

export function createSupabaseInvitationDb(client: SupabaseClient<Database>, userId: string, projectId: string): InvitationDb {
  const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
  return {
    async getMyRole(projectId) {
      const { data, error } = await client.from('memberships').select('role').eq('project_id', projectId).eq('user_id', userId).maybeSingle()
      fail(error)
      return data?.role ?? null
    },
    async getProjectName(projectId) {
      const { data, error } = await client.from('projects').select('name').eq('id', projectId).maybeSingle()
      fail(error)
      return data?.name ?? null
    },
    async findProfileIdByEmail(email) {
      // RPC security definer : la policy de `profiles` ne laisse plus voir que soi-même
      // et les membres d'un projet partagé, or un invité n'est pas encore membre.
      const { data, error } = await client.rpc('find_invitee_profile', { p_project_id: projectId, p_email: email })
      fail(error)
      return data ?? null
    },
    async isMember(projectId, memberId) {
      const { data, error } = await client.from('memberships').select('user_id').eq('project_id', projectId).eq('user_id', memberId).maybeSingle()
      fail(error)
      return !!data
    },
    async addMember(projectId, memberId, role) {
      const { error } = await client.from('memberships').insert({ project_id: projectId, user_id: memberId, role })
      fail(error)
    },
    async hasPendingInvitation(projectId, email) {
      const { data, error } = await client.from('invitations').select('id').eq('project_id', projectId).ilike('email', email).is('accepted_at', null).maybeSingle()
      fail(error)
      return !!data
    },
    async insertInvitation(inv) {
      const { error } = await client.from('invitations').insert({ project_id: inv.projectId, email: inv.email, role: inv.role, token: inv.token, invited_by: userId })
      fail(error)
    },
  }
}
```

- [ ] **Step 2 : Route**

`app/api/invitations/route.ts` :

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createInvitation } from '@/lib/invitations/create'
import { createSupabaseInvitationDb } from '@/lib/invitations/supabase-db'
import { createMailer } from '@/lib/invitations/mailer'
import { newInviteToken } from '@/lib/invitations/token'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { projectId?: unknown; email?: unknown; role?: unknown } | null
  if (!body) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin

  try {
    const result = await createInvitation(
      { db: createSupabaseInvitationDb(supabase, user.id, String(body.projectId ?? '')), mailer: createMailer(), baseUrl, inviterName: profile?.display_name ?? user.email ?? 'Un membre', newToken: newInviteToken },
      { projectId: body.projectId, email: body.email, role: body.role },
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    const exposeUrl = process.env.E2E_ENABLED === '1' && result.kind === 'invited'
    return NextResponse.json({ kind: result.kind, ...(exposeUrl ? { inviteUrl: result.inviteUrl } : {}) })
  } catch (e) {
    console.error('[api/invitations]', e)
    return NextResponse.json({ error: 'Invitation impossible, réessaie.' }, { status: 500 })
  }
}
```

- [ ] **Step 3 : Vérifier**

Run : `npm run typecheck && npm run build`
Expected : OK. Test manuel rapide (dev, connecté en alice via `/e2e-login`) depuis la console du navigateur :

```js
await fetch('/api/invitations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId: 'c0000000-0000-0000-0000-000000000001', email: 'dave@test.local', role: 'viewer' }) }).then(r => r.json())
```
Expected : `{ kind: 'added' }` et une ligne `[mailer:console]` dans le terminal `npm run dev`. Relancer → `{ error: 'Cette personne est déjà membre' }`. Puis `npx supabase db reset` pour remettre le seed à plat.

- [ ] **Step 4 : Commit**

```bash
git add lib/invitations/supabase-db.ts app/api/invitations/route.ts
git commit -m "feat(invitations): adaptateur Supabase et route POST /api/invitations"
```

---

### Task 5 : Dialog membres — liste, invitation, rôles, retrait, invitations en attente

**Files:**
- Create : `app/(app)/projects/[id]/members-actions.ts`, `components/project/MembersDialog.tsx`, `components/project/InviteForm.tsx`, `components/project/MemberRow.tsx`
- Modify : `lib/gantt/store.ts` (+ `invitations`), `app/(app)/projects/[id]/page.tsx` (charger les invitations), `components/gantt/GanttToolbar.tsx` (bouton « Membres »), `components/gantt/GanttPage.tsx` (monter le dialog)
- Test : `tests/unit/lib/gantt/store.test.ts` (ajout d'un cas), `tests/e2e/members.spec.ts`

**Interfaces:**
- Produces :
  - Store : `invitations: PendingInvitation[]` ; `HydratePayload.invitations?: PendingInvitation[]` (défaut `[]`) ; `membersDialogOpen: boolean`, `setMembersDialogOpen(open: boolean)`.
  - Server actions (toutes retournent `{ error?: string }`) : `changeMemberRole(projectId, userId, role: InviteRole)`, `removeMember(projectId, userId)`, `revokeInvitation(projectId, invitationId)`.
  - `MembersDialog()` — lit le store ; `InviteForm({ projectId })` ; `MemberRow({ member, projectId, isOwner, isSelf })`.

- [ ] **Step 1 : Store — test puis implémentation**

Ajouter à `tests/unit/lib/gantt/store.test.ts` :

```ts
  it('hydrate charge les invitations en attente (vide par défaut)', () => {
    expect(useGanttStore.getState().invitations).toEqual([])
    useGanttStore.getState().hydrate({ ...payload, invitations: [{ id: 'i1', email: 'x@y.z', role: 'viewer', createdAt: '2026-08-31' }] })
    expect(useGanttStore.getState().invitations).toHaveLength(1)
    useGanttStore.getState().setMembersDialogOpen(true)
    expect(useGanttStore.getState().membersDialogOpen).toBe(true)
  })
```

Run : `npm test` — Expected : FAIL. Puis dans `lib/gantt/store.ts` :
- importer `type PendingInvitation` depuis `@/lib/invitations/types` ;
- `HydratePayload` : `invitations?: PendingInvitation[]` ;
- `GanttState` : `invitations: PendingInvitation[]`, `membersDialogOpen: boolean`, `setMembersDialogOpen: (open: boolean) => void` ;
- état initial : `invitations: []`, `membersDialogOpen: false` ;
- `hydrate` : `invitations: p.invitations ?? []` (ne pas toucher à `membersDialogOpen`, pour que le dialog reste ouvert après un `router.refresh()`) ;
- `setMembersDialogOpen: (membersDialogOpen) => set({ membersDialogOpen })`.

Run : `npm test` — Expected : PASS

- [ ] **Step 2 : Page — charger les invitations**

Dans `app/(app)/projects/[id]/page.tsx`, ajouter au `Promise.all` :

```ts
supabase.from('invitations').select('id, email, role, created_at').eq('project_id', id).is('accepted_at', null).order('created_at'),
```

et dans le payload : `invitations: (invitations ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role as InviteRole, createdAt: i.created_at }))` (import `type InviteRole`). La RLS renvoie une liste vide aux non-owners.

- [ ] **Step 3 : Test e2e (échoue : pas de dialog)**

`tests/e2e/members.spec.ts` :

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

test('owner : ajouter un membre existant, changer son rôle, le retirer', async ({ page, browser }) => {
  await loginAs(page, 'alice')
  const url = await newProject(page, `Membres ${Date.now()}`)

  await page.getByRole('button', { name: 'Membres' }).click()
  const dialog = page.getByRole('dialog', { name: 'Membres' })
  await expect(dialog.getByRole('listitem')).toHaveCount(1)

  await dialog.getByLabel('Email').fill('dave@test.local')
  await dialog.getByLabel('Rôle', { exact: true }).selectOption('viewer')
  await dialog.getByRole('button', { name: 'Inviter' }).click()
  await expect(dialog.getByRole('listitem')).toHaveCount(2)
  const dave = dialog.getByRole('listitem').filter({ hasText: 'Dave Test' })
  await expect(dave.getByText('viewer')).toBeVisible()

  await dialog.getByLabel('Email').fill('dave@test.local')
  await dialog.getByRole('button', { name: 'Inviter' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('Cette personne est déjà membre')

  await dave.getByLabel('Rôle de Dave Test').selectOption('editor')
  await expect(dave.getByText('editor')).toBeVisible()

  const daveCtx = await browser.newContext()
  const davePage = await daveCtx.newPage()
  await loginAs(davePage, 'dave')
  await davePage.goto(url)
  await expect(davePage.getByRole('button', { name: '+ Tâche' })).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await dave.getByRole('button', { name: 'Retirer' }).click()
  await expect(dialog.getByRole('listitem')).toHaveCount(1)

  const res = await davePage.goto(url)
  expect(res?.status()).toBe(404)
  await daveCtx.close()
})

test('editor : voit les membres mais aucune commande', async ({ page }) => {
  await loginAs(page, 'bob')
  await page.goto('/projects/c0000000-0000-0000-0000-000000000001')
  await page.getByRole('button', { name: 'Membres' }).click()
  const dialog = page.getByRole('dialog', { name: 'Membres' })
  await expect(dialog.getByRole('listitem')).toHaveCount(3)
  await expect(dialog.getByRole('button', { name: 'Inviter' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Retirer' })).toHaveCount(0)
})
```

Run : `npm run test:e2e tests/e2e/members.spec.ts` — Expected : FAIL

- [ ] **Step 4 : Server actions**

`app/(app)/projects/[id]/members-actions.ts` :

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { INVITE_ROLES, type InviteRole } from '@/lib/invitations/types'

const FAIL = 'Modification non enregistrée'

export async function changeMemberRole(projectId: string, userId: string, role: InviteRole): Promise<{ error?: string }> {
  if (!INVITE_ROLES.includes(role)) return { error: 'Rôle invalide' }
  const supabase = await createClient()
  const { error, count } = await supabase.from('memberships').update({ role }, { count: 'exact' }).eq('project_id', projectId).eq('user_id', userId)
  if (error || count === 0) return { error: FAIL }
  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function removeMember(projectId: string, userId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error, count } = await supabase.from('memberships').delete({ count: 'exact' }).eq('project_id', projectId).eq('user_id', userId)
  if (error || count === 0) return { error: FAIL }
  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function revokeInvitation(projectId: string, invitationId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error, count } = await supabase.from('invitations').delete({ count: 'exact' }).eq('id', invitationId).eq('project_id', projectId)
  if (error || count === 0) return { error: FAIL }
  revalidatePath(`/projects/${projectId}`)
  return {}
}
```

- [ ] **Step 5 : Composants**

`components/project/InviteForm.tsx` :

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast/store'
import type { InviteRole } from '@/lib/invitations/types'

export function InviteForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('editor')
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setInviteUrl(null)
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectId, email, role }),
    })
    const json = (await res.json().catch(() => ({}))) as { kind?: 'added' | 'invited'; inviteUrl?: string; error?: string }
    setBusy(false)
    if (!res.ok) { setError(json.error ?? 'Invitation impossible'); return }
    toast.success(json.kind === 'added' ? 'Membre ajouté' : `Invitation envoyée à ${email}`)
    if (json.inviteUrl) setInviteUrl(json.inviteUrl)
    setEmail('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t-[3px] border-ink pt-4">
      <h3 className="text-lg">Inviter</h3>
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} required placeholder="collegue@exemple.fr" />
        <Select label="Rôle" value={role} onChange={(e) => setRole(e.target.value as InviteRole)} options={[{ value: 'editor', label: 'Éditeur' }, { value: 'viewer', label: 'Lecteur' }]} />
      </div>
      <Button type="submit" disabled={busy}>Inviter</Button>
      {inviteUrl && (
        <p className="bg-yellow border-[3px] border-ink p-2 font-mono text-xs break-all" data-testid="invite-url">
          Lien d'invitation (mode test) : {inviteUrl}
        </p>
      )}
    </form>
  )
}
```

`components/project/MemberRow.tsx` :

```tsx
'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, type BadgeColor } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { toast } from '@/lib/toast/store'
import type { Member } from '@/lib/gantt/types'
import type { InviteRole } from '@/lib/invitations/types'
import { changeMemberRole, removeMember } from '@/app/(app)/projects/[id]/members-actions'

const roleColor: Record<Member['role'], BadgeColor> = { owner: 'yellow', editor: 'blue', viewer: 'pink' }

export function MemberRow({ member, projectId, isOwner }: { member: Member; projectId: string; isOwner: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
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
      <Badge color={roleColor[member.role]}>{member.role}</Badge>
      {editable && (
        <>
          <Select aria-label={`Rôle de ${member.displayName}`} value={member.role} disabled={pending} onChange={(e) => setRole(e.target.value as InviteRole)}
            options={[{ value: 'editor', label: 'Éditeur' }, { value: 'viewer', label: 'Lecteur' }]} className="py-1 text-sm" />
          <Button size="sm" variant="danger" onClick={remove} disabled={pending}>Retirer</Button>
        </>
      )}
    </li>
  )
}
```

`components/project/MembersDialog.tsx` :

```tsx
'use client'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useGanttStore } from '@/lib/gantt/store'
import { Dialog } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast/store'
import { MemberRow } from './MemberRow'
import { InviteForm } from './InviteForm'
import { revokeInvitation } from '@/app/(app)/projects/[id]/members-actions'

export function MembersDialog() {
  const router = useRouter()
  const open = useGanttStore((s) => s.membersDialogOpen)
  const setOpen = useGanttStore((s) => s.setMembersDialogOpen)
  const projectId = useGanttStore((s) => s.projectId)
  const members = useGanttStore((s) => s.members)
  const invitations = useGanttStore((s) => s.invitations)
  const isOwner = useGanttStore((s) => s.myRole === 'owner')
  const [, start] = useTransition()

  function revoke(id: string) {
    start(async () => {
      const res = await revokeInvitation(projectId, id)
      if (res.error) toast.error(res.error)
      else router.refresh()
    })
  }

  const sorted = [...members].sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.displayName.localeCompare(b.displayName)))

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Membres">
      <ul className="divide-y-[3px] divide-ink/10">
        {sorted.map((m) => <MemberRow key={m.userId} member={m} projectId={projectId} isOwner={isOwner} />)}
      </ul>
      {isOwner && invitations.length > 0 && (
        <section className="mt-4 border-t-[3px] border-ink pt-4">
          <h3 className="text-lg">Invitations en attente</h3>
          <ul className="mt-2 space-y-2">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-3">
                <span className="font-mono text-sm flex-1 truncate">{i.email}</span>
                <Badge color="ink">{i.role}</Badge>
                <Button size="sm" variant="secondary" onClick={() => revoke(i.id)}>Révoquer</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {isOwner && <div className="mt-4"><InviteForm projectId={projectId} /></div>}
    </Dialog>
  )
}
```

Dans `components/gantt/GanttToolbar.tsx` : `const setMembersDialogOpen = useGanttStore((s) => s.setMembersDialogOpen)` et, à la place du simple `div` d'avatars, un bouton :

```tsx
<button type="button" onClick={() => setMembersDialogOpen(true)} aria-label="Membres" className="flex items-center gap-2 brutal-focus">
  <span className="flex -space-x-2">
    {members.map((m) => <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />)}
  </span>
  <span className="font-bold uppercase text-sm underline">Membres</span>
</button>
```

Dans `components/gantt/GanttPage.tsx` : importer `MembersDialog` et rendre `<MembersDialog />` à côté de `<TaskEditor />`.

- [ ] **Step 6 : Lancer**

Run : `npm run typecheck && npm test && npm run test:e2e tests/e2e/members.spec.ts`
Expected : PASS. Si le compteur de `listitem` inclut les invitations en attente, restreindre le sélecteur du test à `dialog.locator('ul').first().getByRole('listitem')`.

- [ ] **Step 7 : Commit**

```bash
git add "app/(app)/projects/[id]/members-actions.ts" "app/(app)/projects/[id]/page.tsx" components/project/MembersDialog.tsx components/project/InviteForm.tsx components/project/MemberRow.tsx components/gantt/GanttToolbar.tsx components/gantt/GanttPage.tsx lib/gantt/store.ts tests/unit/lib/gantt/store.test.ts tests/e2e/members.spec.ts
git commit -m "feat(members): dialog membres — invitation, rôles, retrait, invitations en attente"
```

---

### Task 6 : Page d'acceptation `/invite/[token]`

**Files:**
- Create : `app/invite/[token]/page.tsx`, `app/invite/[token]/InviteError.tsx`, `app/invite/actions.ts`
- Modify : `app/e2e-login/E2ELoginForm.tsx` (+ bouton « Créer le compte »)
- Test : `tests/e2e/invite.spec.ts`

**Interfaces:**
- Consumes : RPC `accept_invitation`, `safeNext`, `signOut`.
- Produces : `switchAccount(next: string)` server action (déconnecte puis redirige vers `/login?next=`) ; `InviteError({ kind: 'mismatch' | 'not_found'; token: string })`.

- [ ] **Step 1 : Bouton d'inscription dans la page e2e**

Dans `app/e2e-login/E2ELoginForm.tsx`, ajouter un second bouton sous « Se connecter » :

```tsx
<Button type="button" variant="secondary" onClick={async () => {
  const { error } = await createClient().auth.signUp({ email, password, options: { data: { full_name: email.split('@')[0] } } })
  if (error) { setError(error.message); return }
  router.push('/projects'); router.refresh()
}}>Créer le compte</Button>
```

(`enable_confirmations = false` dans `supabase/config.toml` : le compte est confirmé et connecté immédiatement.)

- [ ] **Step 2 : Test e2e (échoue : page absente)**

`tests/e2e/invite.spec.ts` :

```ts
import { test, expect, type Browser, type Page } from '@playwright/test'
import { loginAs } from './helpers'

async function inviteUnknown(page: Page, email: string, role: 'editor' | 'viewer') {
  await page.getByRole('button', { name: 'Membres' }).click()
  const dialog = page.getByRole('dialog', { name: 'Membres' })
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByLabel('Rôle', { exact: true }).selectOption(role)
  await dialog.getByRole('button', { name: 'Inviter' }).click()
  const text = await dialog.getByTestId('invite-url').textContent()
  const url = text!.match(/https?:\/\/\S+/)![0]
  await page.keyboard.press('Escape')
  return url
}

async function signUp(browser: Browser, email: string) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/e2e-login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill('password123')
  await page.getByRole('button', { name: 'Créer le compte' }).click()
  await page.waitForURL('**/projects')
  return { ctx, page }
}

test('invitation par lien : acceptation, réutilisation refusée, mauvais compte', async ({ page, browser }) => {
  await loginAs(page, 'alice')
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Invit ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  const projectUrl = page.url()

  const stamp = Date.now()
  const frankEmail = `frank-${stamp}@test.local`
  const frankUrl = await inviteUnknown(page, frankEmail, 'viewer')
  const graceUrl = await inviteUnknown(page, `grace-${stamp}@test.local`, 'editor')

  await page.getByRole('button', { name: 'Membres' }).click()
  await expect(page.getByRole('dialog').getByText(frankEmail)).toBeVisible()
  await page.keyboard.press('Escape')

  // Anonyme → login avec next
  const anon = await browser.newContext()
  const anonPage = await anon.newPage()
  await anonPage.goto(frankUrl)
  await expect(anonPage).toHaveURL(/\/login\?next=%2Finvite%2F/)
  await anon.close()

  // Frank s'inscrit puis accepte
  const frank = await signUp(browser, frankEmail)
  await frank.page.goto(frankUrl)
  await expect(frank.page).toHaveURL(projectUrl)
  await expect(frank.page.getByText('Lecture seule')).toBeVisible()

  // Réutilisation
  await frank.page.goto(frankUrl)
  await expect(frank.page.getByText('Lien invalide ou déjà utilisé')).toBeVisible()

  // Bob ouvre l'invitation de Grace
  await frank.ctx.close()
  const bobCtx = await browser.newContext()
  const bobPage = await bobCtx.newPage()
  await loginAs(bobPage, 'bob')
  await bobPage.goto(graceUrl)
  await expect(bobPage.getByText('Cette invitation est destinée à une autre adresse')).toBeVisible()
  await bobPage.getByRole('button', { name: 'Changer de compte' }).click()
  await expect(bobPage).toHaveURL(/\/login\?next=%2Finvite%2F/)
  await bobCtx.close()

  // L'invitation de Frank a disparu des invitations en attente
  await page.reload()
  await page.getByRole('button', { name: 'Membres' }).click()
  const pending = page.getByRole('dialog').locator('section') // « Invitations en attente » (contient encore grace)
  await expect(pending.getByText(frankEmail)).toHaveCount(0)
  await expect(page.getByRole('dialog').locator('ul').first().getByText(frankEmail)).toBeVisible() // désormais membre
})
```

Run : `npm run test:e2e tests/e2e/invite.spec.ts` — Expected : FAIL

- [ ] **Step 3 : Implémenter**

`app/invite/actions.ts` :

```ts
'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/redirect'

export async function switchAccount(next: string) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/login?next=${encodeURIComponent(safeNext(next))}`)
}
```

`app/invite/[token]/InviteError.tsx` :

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { switchAccount } from '@/app/invite/actions'

export function InviteError({ kind, token }: { kind: 'mismatch' | 'not_found'; token: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-paper brutal shadow-brutal-xl p-8 space-y-6">
        <h1 className="text-3xl">Invitation</h1>
        {kind === 'mismatch' ? (
          <>
            <p className="font-bold">Cette invitation est destinée à une autre adresse.</p>
            <p>Connecte-toi avec l'adresse email qui a reçu l'invitation.</p>
            <form action={switchAccount.bind(null, `/invite/${token}`)}>
              <Button type="submit">Changer de compte</Button>
            </form>
          </>
        ) : (
          <>
            <p className="font-bold">Lien invalide ou déjà utilisé.</p>
            <Link href="/projects" className="inline-flex bg-paper brutal brutal-press px-5 py-2 font-bold uppercase brutal-focus">Aller à mes projets</Link>
          </>
        )}
      </div>
    </main>
  )
}
```

`app/invite/[token]/page.tsx` :

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InviteError } from './InviteError'

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: projectId, error } = await supabase.rpc('accept_invitation', { p_token: token })

  if (!error && projectId) redirect(`/projects/${projectId}`)

  const kind = error?.message.includes('email_mismatch') ? 'mismatch' : 'not_found'
  return <InviteError kind={kind} token={token} />
}
```

Note : le middleware (plan 1) redirige déjà un anonyme de `/invite/*` vers `/login?next=`. Pour le magic-link/Google, `LoginForm` transmet `next` au callback, qui revient sur `/invite/<token>` une fois connecté.

- [ ] **Step 4 : Lancer**

Run : `npm run typecheck && npm run test:e2e tests/e2e/invite.spec.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add app/invite/actions.ts "app/invite/[token]/page.tsx" "app/invite/[token]/InviteError.tsx" app/e2e-login/E2ELoginForm.tsx tests/e2e/invite.spec.ts
git commit -m "feat(invitations): page d'acceptation avec vérification d'email"
```

---

### Task 7 : Suite complète, documentation, clôture

**Files:**
- Create : `README.md`
- Modify : `.env.local.example` (vérifier la liste complète)

- [ ] **Step 1 : README**

`README.md` :

```markdown
# BradGantt

Diagrammes de Gantt collaboratifs, néo-brutalistes. Next.js 15 + Supabase.

## Démarrer en local

1. `npm install`
2. `npx supabase start` (Docker requis) puis copier les clés affichées dans `.env.local` (voir `.env.local.example`)
3. `npx supabase db reset` — applique les migrations et le seed (utilisateurs `alice|bob|carol|dave@test.local`, mot de passe `password123`, projet « Projet démo »)
4. `npm run dev` → http://localhost:3000

Connexion locale : magic-link (boîte mail locale sur http://127.0.0.1:54424) ou, avec `E2E_ENABLED=1`, la page `/e2e-login` (email + mot de passe).

## Tests

| Commande | Quoi |
|---|---|
| `npm test` | Vitest — modules purs, store, commandes, composants UI |
| `npm run test:db` | pgTAP — schéma, RLS, `accept_invitation` |
| `npm run test:e2e` | Playwright (lance `next dev` avec `E2E_ENABLED=1`) — faire `npx supabase db reset` avant |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |

## Variables d'environnement

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY` (optionnel en dev : sans clé, les emails sont écrits dans la console), `EMAIL_FROM`.

## Architecture

Voir `docs/superpowers/specs/2026-08-28-bradgantt-design.md` et les plans dans `docs/superpowers/plans/`.
Points clés : composants sans accès Supabase → store Zustand → commandes optimistes (`lib/gantt/commands.ts`) → `GanttRepository`. Réducteur unique `applyEvent` prêt pour le temps réel (v2).

## Déploiement

Vercel + Supabase cloud : `supabase link` puis `supabase db push` ; configurer Google OAuth dans le dashboard Supabase (redirect `https://<domaine>/auth/callback`) et les variables ci-dessus dans Vercel.
```

- [ ] **Step 2 : Suite complète**

```bash
npx supabase db reset
npm run typecheck && npm run lint && npm test && npm run test:db && npm run test:e2e
```

Expected : tout PASS.

- [ ] **Step 3 : Commit**

```bash
git add README.md .env.local.example
git commit -m "docs: README de démarrage, tests et déploiement"
```

- [ ] **Step 4 : Clôture** — invoquer `superpowers:finishing-a-development-branch` pour décider de l'intégration des trois branches (`feat/01-fondations` → `feat/02-gantt` → `feat/03-membres`) dans `master`.

---

## Critères de fin du plan 3 (et de la v1)

- Un owner invite par email : ajout direct + email « ajouté » si le compte existe, sinon invitation + lien ; erreurs inline conformes au spec.
- L'invité accepte via `/invite/[token]` ; mauvais compte → page « autre adresse » + « Changer de compte » ; lien consommé/inconnu → « invalide ou déjà utilisé ».
- L'owner change les rôles, retire des membres, révoque des invitations ; la ligne owner est intouchable (RLS + UI).
- `npm run typecheck`, `lint`, `test`, `test:db`, `test:e2e` passent.
- Périmètre v1 du spec §2 entièrement couvert ; v2 (temps réel, cascade, commentaires, export) reste hors périmètre.
