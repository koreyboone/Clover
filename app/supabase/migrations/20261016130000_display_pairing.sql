-- Display pairing: a parent issues a short-lived, single-use code; the display redeems it
-- through trusted server code. Only the code's hash is stored, and clients cannot read this table.

create table public.display_pairings (
  device_id uuid primary key references public.display_devices (id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz
);

alter table public.display_pairings enable row level security;
revoke all on public.display_pairings from anon, authenticated;

-- Consumes a valid code exactly once. Callable only by the service role.
create function public.redeem_display_pairing(p_code_hash text)
returns table (device_id uuid, user_id uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with claimed as (
    update public.display_pairings p
       set redeemed_at = now()
     where p.code_hash = p_code_hash
       and p.redeemed_at is null
       and p.expires_at > now()
       and exists (
         select 1 from public.display_devices d
         where d.id = p.device_id and d.revoked_at is null
       )
    returning p.device_id
  )
  select c.device_id, d.user_id
    from claimed c
    join public.display_devices d on d.id = c.device_id;
end;
$$;

revoke all on function public.redeem_display_pairing(text) from public, anon, authenticated;
grant execute on function public.redeem_display_pairing(text) to service_role;

-- Revoking also invalidates any pairing code that was never redeemed.
create or replace function public.revoke_display_device(device_id uuid)
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
  delete from public.display_pairings where display_pairings.device_id = revoke_display_device.device_id
    and redeemed_at is null;
end;
$$;
