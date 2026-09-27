-- Admin settings, partner reject, dispute resolution.

alter table disputes add column if not exists resolved_at timestamptz;

create table if not exists settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now()
);

insert into settings (key, value)
values ('followup_auto', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_setting(setting_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row settings%rowtype;
begin
  select * into row from settings where key = setting_key;
  if not found then
    return 'null'::jsonb;
  end if;
  return row.value;
end;
$$;

create or replace function public.set_setting(setting_key text, setting_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into settings (key, value, updated_at)
  values (setting_key, setting_value, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();
  return setting_value;
end;
$$;

create or replace function public.reject_partner_application(app_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  app partner_applications%rowtype;
begin
  select * into app from partner_applications where id = app_id for update;
  if not found then
    raise exception 'application not found';
  end if;
  if app.status <> 'pending' then
    raise exception 'application already processed';
  end if;

  update partner_applications set status = 'rejected' where id = app.id;
  return jsonb_build_object('id', app.id, 'status', 'rejected');
end;
$$;

drop function if exists public.resolve_dispute(uuid, text);

create or replace function public.resolve_dispute(dispute_id uuid, outcome text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row disputes%rowtype;
  clean text := lower(btrim(coalesce(outcome, '')));
begin
  if clean not in ('upheld', 'rejected') then
    raise exception 'invalid outcome';
  end if;

  select * into row from disputes where id = dispute_id for update;
  if not found then
    raise exception 'dispute not found';
  end if;
  if row.status <> 'pending' then
    raise exception 'dispute already resolved';
  end if;

  update disputes
  set status = clean,
      resolved_at = now()
  where id = row.id
  returning * into row;

  return jsonb_build_object('id', row.id, 'status', row.status, 'redemption_id', row.redemption_id);
end;
$$;

revoke all on function public.get_setting from public, anon, authenticated;
revoke all on function public.set_setting from public, anon, authenticated;
revoke all on function public.reject_partner_application from public, anon, authenticated;
revoke all on function public.resolve_dispute from public, anon, authenticated;
grant execute on function public.get_setting to service_role;
grant execute on function public.set_setting to service_role;
grant execute on function public.reject_partner_application to service_role;
grant execute on function public.resolve_dispute to service_role;

grant all on settings to service_role;
alter table settings enable row level security;
