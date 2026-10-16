-- Households, parent membership, and restricted display devices.
-- Authorization is enforced here with row-level security, not in the UI.
-- Roles: a parent is a household member. A display is an auth user registered in
-- display_devices; it is never a member, so it holds no parent permissions.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'parent' check (role = 'parent'),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.display_devices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index display_devices_household_idx on public.display_devices (household_id);
create index household_members_user_idx on public.household_members (user_id);

-- Helpers run as the table owner so policies can call them without recursion.
create function public.is_household_parent(hid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

create function public.is_household_display(hid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.display_devices d
    where d.household_id = hid and d.user_id = auth.uid() and d.revoked_at is null
  );
$$;

-- Parents create a household and become its first member. Display sessions cannot.
create function public.create_household(household_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if exists (select 1 from public.display_devices d where d.user_id = auth.uid()) then
    raise exception 'display devices cannot create households' using errcode = '42501';
  end if;
  insert into public.households (name) values (household_name) returning id into new_id;
  insert into public.household_members (household_id, user_id) values (new_id, auth.uid());
  return new_id;
end;
$$;

-- Parents revoke a display session in their own household.
create function public.revoke_display_device(device_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  hid uuid;
begin
  select household_id into hid from public.display_devices where id = device_id;
  if hid is null or not public.is_household_parent(hid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.display_devices set revoked_at = coalesce(revoked_at, now()) where id = device_id;
end;
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.display_devices enable row level security;

-- households: parents and active displays read; only parents change.
create policy households_select on public.households for select to authenticated
  using (public.is_household_parent(id) or public.is_household_display(id));
create policy households_update on public.households for update to authenticated
  using (public.is_household_parent(id)) with check (public.is_household_parent(id));
create policy households_delete on public.households for delete to authenticated
  using (public.is_household_parent(id));

-- household_members: parents read. Membership changes go through future invite functions.
create policy household_members_select on public.household_members for select to authenticated
  using (public.is_household_parent(household_id));

-- display_devices: parents read all in their household; a display reads only its own row.
-- Rows are created by trusted server code (service role) and revoked via revoke_display_device.
create policy display_devices_select on public.display_devices for select to authenticated
  using (public.is_household_parent(household_id) or (user_id = auth.uid() and revoked_at is null));

revoke all on public.households, public.household_members, public.display_devices from anon, authenticated;
grant select, update, delete on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select on public.display_devices to authenticated;

revoke all on function public.is_household_parent(uuid), public.is_household_display(uuid),
  public.create_household(text), public.revoke_display_device(uuid) from public, anon;
grant execute on function public.is_household_parent(uuid), public.is_household_display(uuid),
  public.create_household(text), public.revoke_display_device(uuid) to authenticated;
