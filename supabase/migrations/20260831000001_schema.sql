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
