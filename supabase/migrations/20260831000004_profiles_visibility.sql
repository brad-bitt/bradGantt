-- ===== Visibilité des profils =====
-- L'inscription est ouverte (enable_signup = true) et aucun code de cette branche ne lit
-- le profil d'un autre utilisateur en dehors d'un contexte de projet partagé. La policy
-- "profiles_select_authenticated" (using (true)) exposait pourtant l'annuaire complet
-- (email, nom, avatar) de tous les comptes à n'importe quel utilisateur authentifié.
-- On restreint la lecture à : son propre profil, ou celui d'un utilisateur avec qui on
-- partage au moins un projet (memberships communes). La comparaison passe par une
-- fonction security definer à search_path figé (même modèle que public.is_member) pour
-- éviter toute récursion de policy : une policy sur profiles qui interrogerait
-- directement memberships avec RLS active re-déclencherait potentiellement des policies
-- dépendant elle-même de profiles.
create or replace function public.shares_project(p_other_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m1
    join public.memberships m2 on m1.project_id = m2.project_id
    where m1.user_id = auth.uid() and m2.user_id = p_other_id
  );
$$;

revoke execute on function public.shares_project(uuid) from anon, public;
grant execute on function public.shares_project(uuid) to authenticated;

drop policy "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_self_or_shared_project" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_project(id));

-- ===== owner_id figé sur projects =====
-- projects.owner_id est réinscriptible par l'owner (policy projects_update_owner) et
-- pourrait diverger de la ligne owner de memberships, qui est la véritable source
-- d'autorité pour les décisions d'autorisation (is_member, RLS). Même piège déjà fermé
-- sur profiles.email : on fige la colonne par trigger, quel que soit le rôle appelant.
create or replace function public.check_project_owner_id_immutable() returns trigger
language plpgsql as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id_is_read_only';
  end if;
  return new;
end $$;

create trigger projects_owner_id_immutable
before update of owner_id on public.projects
for each row execute function public.check_project_owner_id_immutable();

comment on column public.projects.owner_id is
  'Ne fait pas autorité pour les décisions d''autorisation : la source de vérité est '
  'memberships (role = owner), utilisée par is_member/RLS. Cette colonne est figée par '
  'un trigger (before update of owner_id) et ne sert qu''à l''attribution initiale / audit.';

-- ===== set search_path : uniformiser sur toutes les fonctions =====
-- Seules handle_new_user, is_member et create_project portaient `set search_path = public`
-- (nécessaire car security definer). Les quatre fonctions ci-dessous n'en ont pas besoin
-- aujourd'hui — aucune n'est security definer — mais la règle doit être "toutes", pour que
-- la prochaine fonction écrite dans ce projet hérite du bon exemple par copier-coller plutôt
-- que de l'exception.
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.check_task_parent() returns trigger
language plpgsql set search_path = public as $$
declare parent public.tasks;
begin
  if new.parent_id is null then return new; end if;
  if new.type = 'group' then raise exception 'group_cannot_have_parent'; end if;
  select * into parent from public.tasks where id = new.parent_id;
  if parent.id is null or parent.project_id <> new.project_id then raise exception 'parent_not_in_project'; end if;
  if parent.type <> 'group' then raise exception 'parent_must_be_group'; end if;
  return new;
end $$;

create or replace function public.check_dependency_project() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.tasks where id in (new.from_task_id, new.to_task_id) and project_id = new.project_id) <> 2 then
    raise exception 'dependency_cross_project';
  end if;
  return new;
end $$;

create or replace function public.check_profile_email_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.email is distinct from old.email then
    raise exception 'email_is_read_only';
  end if;
  return new;
end $$;
