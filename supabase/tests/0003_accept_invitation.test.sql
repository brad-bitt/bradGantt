begin;
create extension if not exists pgtap with schema extensions;

-- Rend ce fichier indépendant des données de `supabase/seed.sql` (mêmes UUID de test) :
-- la transaction est annulée par le `rollback` final, donc rien n'est perdu pour le dev.
delete from auth.users;

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
