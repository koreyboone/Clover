-- Proof of concept (task 1.5): one sample routine per household, a child action from the display,
-- and parent verification. This is deliberately not the routine engine: no schedules, children,
-- snapshots, points, or bonuses. Group 2 replaces it with the real model.
-- Writes happen only through functions that check the caller's role and the display's current
-- revocation status in the database, never by trusting the token alone.

create table public.sample_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  position int not null,
  title text not null check (length(btrim(title)) between 1 and 100),
  -- awaiting_verification and rejected-then-incomplete follow the household-routines spec:
  -- only complete and assisted count as done.
  status text not null default 'incomplete'
    check (status in ('incomplete', 'awaiting_verification', 'complete', 'assisted')),
  updated_at timestamptz not null default now(),
  unique (household_id, position)
);

alter table public.sample_tasks enable row level security;

create policy sample_tasks_select on public.sample_tasks for select to authenticated
  using (public.is_household_parent(household_id) or public.is_household_display(household_id));

revoke all on public.sample_tasks from anon, authenticated;
grant select on public.sample_tasks to authenticated;

-- Parent: create the sample routine once. Calling it again changes nothing.
create function public.poc_seed_sample(hid uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_household_parent(hid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.sample_tasks (household_id, position, title)
  values (hid, 1, 'Make your bed'), (hid, 2, 'Brush your teeth'), (hid, 3, 'Pack your bag')
  on conflict (household_id, position) do nothing;
end;
$$;

-- Parent: edit a task title.
create function public.poc_rename_task(task_id uuid, new_title text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  hid uuid;
begin
  select household_id into hid from public.sample_tasks where id = task_id;
  if hid is null or not public.is_household_parent(hid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(new_title, ''))) not between 1 and 100 then
    raise exception 'invalid title' using errcode = '22023';
  end if;
  update public.sample_tasks set title = btrim(new_title), updated_at = now() where id = task_id;
end;
$$;

-- Display: the child marks a task done. It waits for a parent; it does not count as complete.
-- Tapping again while it waits (or after it is resolved) changes nothing.
create function public.poc_mark_task_done(task_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  hid uuid;
  result text;
begin
  select household_id into hid from public.sample_tasks where id = task_id;
  if hid is null or not public.is_household_display(hid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.sample_tasks set status = 'awaiting_verification', updated_at = now()
   where id = task_id and status = 'incomplete';
  select status into result from public.sample_tasks where id = task_id;
  return result;
end;
$$;

-- Parent: approve or reject a task awaiting verification, or record assistance.
-- Rejection returns the task to incomplete. Assistance counts as completion once recorded.
create function public.poc_review_task(task_id uuid, decision text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  hid uuid;
  result text;
begin
  select household_id into hid from public.sample_tasks where id = task_id;
  if hid is null or not public.is_household_parent(hid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if decision = 'approve' then
    update public.sample_tasks set status = 'complete', updated_at = now()
     where id = task_id and status = 'awaiting_verification' returning status into result;
  elsif decision = 'reject' then
    update public.sample_tasks set status = 'incomplete', updated_at = now()
     where id = task_id and status = 'awaiting_verification' returning status into result;
  elsif decision = 'assist' then
    update public.sample_tasks set status = 'assisted', updated_at = now()
     where id = task_id and status in ('incomplete', 'awaiting_verification') returning status into result;
  else
    raise exception 'unknown decision' using errcode = '22023';
  end if;

  if result is null then
    raise exception 'task is not in a state that allows this' using errcode = '55000';
  end if;
  return result;
end;
$$;

revoke all on function public.poc_seed_sample(uuid), public.poc_rename_task(uuid, text),
  public.poc_mark_task_done(uuid), public.poc_review_task(uuid, text) from public, anon;
grant execute on function public.poc_seed_sample(uuid), public.poc_rename_task(uuid, text),
  public.poc_mark_task_done(uuid), public.poc_review_task(uuid, text) to authenticated;
