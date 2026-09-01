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

-- Projet démo (alice owner, bob editor, carol viewer). Sert de fixture aux tests e2e du Gantt :
-- les identifiants sont figés pour que les sélecteurs des specs restent stables, et les dates
-- sont relatives à `current_date` pour que la ligne « aujourd'hui » tombe toujours dans la plage.
insert into public.projects (id, name, owner_id)
values ('c0000000-0000-0000-0000-000000000001', 'Projet démo', 'a0000000-0000-0000-0000-000000000001');
insert into public.memberships (project_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'editor'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'viewer');

insert into public.tasks (id, project_id, title, type, start_date, end_date, color, sort_order)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Cadrage', 'group', current_date, current_date, '#E9B44C', 0);
insert into public.tasks (id, project_id, parent_id, title, type, start_date, end_date, color, sort_order, progress, assignee_id) values
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Ateliers', 'task', current_date - 3, current_date + 2, '#5B9DFF', 0, 60, 'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Spécifications', 'task', current_date + 3, current_date + 9, '#FF6FA3', 1, 0, null);
insert into public.tasks (id, project_id, title, type, start_date, end_date, color, sort_order)
values ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Kick-off dev', 'milestone', current_date + 10, current_date + 10, '#3ECF8E', 1);
insert into public.dependencies (project_id, from_task_id, to_task_id) values
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004');

-- Second projet d'alice. Il n'existe QUE pour verrouiller l'isolation inter-projets : sans lui,
-- retirer les `.eq('project_id', id)` de la page projet laisse toute la suite e2e au vert (le seed
-- ne contenait qu'un projet). Ses titres sont volontairement criards et ses identifiants finissent
-- par `f1`/`f2` pour qu'une fuite saute aux yeux, y compris dans le payload RSC.
-- Sert aussi de fixture « autre projet » aux tâches suivantes.
insert into public.projects (id, name, owner_id)
values ('c0000000-0000-0000-0000-000000000002', 'Projet voisin', 'a0000000-0000-0000-0000-000000000001');
insert into public.memberships (project_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'owner');
insert into public.tasks (id, project_id, title, type, start_date, end_date, color, sort_order) values
  ('d0000000-0000-0000-0000-0000000000f1', 'c0000000-0000-0000-0000-000000000002', 'FUITE INTER-PROJETS', 'task', current_date - 1, current_date + 5, '#A78BFA', 0),
  ('d0000000-0000-0000-0000-0000000000f2', 'c0000000-0000-0000-0000-000000000002', 'FUITE INTER-PROJETS BIS', 'task', current_date + 6, current_date + 8, '#A78BFA', 1);
insert into public.dependencies (id, project_id, from_task_id, to_task_id) values
  ('e0000000-0000-0000-0000-0000000000f1', 'c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000f1', 'd0000000-0000-0000-0000-0000000000f2');
