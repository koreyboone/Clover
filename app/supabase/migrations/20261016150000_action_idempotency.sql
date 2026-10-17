create table public.action_idempotency (
  actor_id uuid not null,
  idempotency_key uuid not null,
  household_id uuid not null references public.households (id) on delete cascade,
  action text not null,
  payload jsonb not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, idempotency_key)
);

alter table public.action_idempotency enable row level security;
revoke all on public.action_idempotency from public, anon, authenticated;

create function public.poc_claim_action(
  p_household_id uuid,
  p_idempotency_key uuid,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  inserted_rows int;
  prior_action text;
  prior_household_id uuid;
  prior_payload jsonb;
  prior_result jsonb;
begin
  if auth.uid() is null or p_idempotency_key is null then
    raise exception 'authenticated actor and idempotency key required' using errcode = '22023';
  end if;

  insert into public.action_idempotency
    (actor_id, idempotency_key, household_id, action, payload)
  values
    (auth.uid(), p_idempotency_key, p_household_id, p_action, p_payload)
  on conflict (actor_id, idempotency_key) do nothing;
  get diagnostics inserted_rows = row_count;

  if inserted_rows = 1 then
    return null;
  end if;

  select action, household_id, payload, result
    into prior_action, prior_household_id, prior_payload, prior_result
    from public.action_idempotency
   where actor_id = auth.uid() and idempotency_key = p_idempotency_key
   for update;

  if prior_action is distinct from p_action
     or prior_household_id is distinct from p_household_id
     or prior_payload is distinct from p_payload then
    raise exception 'idempotency key already used for a different action' using errcode = '22023';
  end if;
  if prior_result is null then
    raise exception 'idempotent action has no stored result' using errcode = '55000';
  end if;
  return prior_result;
end;
$$;

create function public.poc_finish_action(p_idempotency_key uuid, p_result jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.action_idempotency
     set result = p_result
   where actor_id = auth.uid() and idempotency_key = p_idempotency_key;
  if not found then
    raise exception 'idempotent action record not found' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.poc_claim_action(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.poc_finish_action(uuid, jsonb) from public, anon, authenticated;

drop function public.poc_seed_sample(uuid);
drop function public.poc_rename_task(uuid, text);
drop function public.poc_mark_task_done(uuid);
drop function public.poc_review_task(uuid, text);

create function public.poc_seed_sample(hid uuid, idempotency_key uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  replay jsonb;
begin
  if not public.is_household_parent(hid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  replay := public.poc_claim_action(hid, idempotency_key, 'seed_sample', jsonb_build_object('household_id', hid));
  if replay is not null then
    return;
  end if;

  insert into public.sample_tasks (household_id, position, title)
  values (hid, 1, 'Make your bed'), (hid, 2, 'Brush your teeth'), (hid, 3, 'Pack your bag')
  on conflict (household_id, position) do nothing;

  perform public.poc_finish_action(idempotency_key, jsonb_build_object('ok', true));
end;
$$;

create function public.poc_rename_task(task_id uuid, new_title text, idempotency_key uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  hid uuid;
  normalized_title text := btrim(coalesce(new_title, ''));
  replay jsonb;
begin
  select household_id into hid from public.sample_tasks where id = task_id;
  if hid is null or not public.is_household_parent(hid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if length(normalized_title) not between 1 and 100 then
    raise exception 'invalid title' using errcode = '22023';
  end if;

  replay := public.poc_claim_action(
    hid, idempotency_key, 'rename_task',
    jsonb_build_object('task_id', task_id, 'title', normalized_title)
  );
  if replay is not null then
    return;
  end if;

  update public.sample_tasks set title = normalized_title, updated_at = now() where id = task_id;
  perform public.poc_finish_action(idempotency_key, jsonb_build_object('ok', true));
end;
$$;

create function public.poc_mark_task_done(task_id uuid, idempotency_key uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  hid uuid;
  task_status text;
  replay jsonb;
begin
  select household_id into hid from public.sample_tasks where id = task_id;
  if hid is null or not public.is_household_display(hid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  replay := public.poc_claim_action(
    hid, idempotency_key, 'mark_task_done', jsonb_build_object('task_id', task_id)
  );
  if replay is not null then
    return replay #>> '{}';
  end if;

  update public.sample_tasks set status = 'awaiting_verification', updated_at = now()
   where id = task_id and status = 'incomplete';
  select status into task_status from public.sample_tasks where id = task_id;

  perform public.poc_finish_action(idempotency_key, to_jsonb(task_status));
  return task_status;
end;
$$;

create function public.poc_review_task(task_id uuid, decision text, idempotency_key uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  hid uuid;
  task_status text;
  replay jsonb;
begin
  select household_id into hid from public.sample_tasks where id = task_id;
  if hid is null or not public.is_household_parent(hid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if decision not in ('approve', 'reject', 'assist') then
    raise exception 'unknown decision' using errcode = '22023';
  end if;

  replay := public.poc_claim_action(
    hid, idempotency_key, 'review_task',
    jsonb_build_object('task_id', task_id, 'decision', decision)
  );
  if replay is not null then
    return replay #>> '{}';
  end if;

  if decision = 'approve' then
    update public.sample_tasks set status = 'complete', updated_at = now()
     where id = task_id and status = 'awaiting_verification' returning status into task_status;
  elsif decision = 'reject' then
    update public.sample_tasks set status = 'incomplete', updated_at = now()
     where id = task_id and status = 'awaiting_verification' returning status into task_status;
  else
    update public.sample_tasks set status = 'assisted', updated_at = now()
     where id = task_id and status in ('incomplete', 'awaiting_verification') returning status into task_status;
  end if;

  if task_status is null then
    raise exception 'task is not in a state that allows this' using errcode = '55000';
  end if;

  perform public.poc_finish_action(idempotency_key, to_jsonb(task_status));
  return task_status;
end;
$$;

grant execute on function public.poc_seed_sample(uuid, uuid),
  public.poc_rename_task(uuid, text, uuid),
  public.poc_mark_task_done(uuid, uuid),
  public.poc_review_task(uuid, text, uuid) to authenticated;
