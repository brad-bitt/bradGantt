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
  with check (role <> 'owner');
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
