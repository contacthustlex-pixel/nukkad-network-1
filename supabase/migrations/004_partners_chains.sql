-- Partner signup, admin approval, and chain merge.

create table partner_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  shop_name text not null,
  slug text not null unique,
  phone text not null unique,
  owner_name text not null,
  category_id uuid not null references categories (id),
  monthly_revenue numeric not null,
  avg_order_value numeric not null,
  daily_footfall int not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  business_id uuid references businesses (id)
);

create table referral_chains (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  merged_at timestamptz not null default now()
);

alter table businesses add column if not exists chain_id uuid references referral_chains (id);

create table chain_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  chain_id uuid not null references referral_chains (id),
  business_id uuid not null references businesses (id),
  message text not null,
  seen boolean not null default false
);

create or replace function public.submit_partner_application(
  shop_name text,
  slug text,
  phone text,
  owner_name text,
  category_id uuid,
  monthly_revenue numeric,
  avg_order_value numeric,
  daily_footfall int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  normalized text := public.normalize_phone(phone);
  clean_slug text := lower(regexp_replace(trim(slug), '[^a-z0-9]+', '-', 'g'));
  row partner_applications%rowtype;
begin
  if length(normalized) < 10 then
    raise exception 'invalid phone';
  end if;
  if clean_slug is null or clean_slug = '' then
    raise exception 'invalid slug';
  end if;
  if monthly_revenue is null or avg_order_value is null or daily_footfall is null or daily_footfall < 0 then
    raise exception 'invalid metrics';
  end if;

  insert into partner_applications (
    shop_name,
    slug,
    phone,
    owner_name,
    category_id,
    monthly_revenue,
    avg_order_value,
    daily_footfall,
    status
  )
  values (
    trim(shop_name),
    clean_slug,
    normalized,
    trim(owner_name),
    category_id,
    monthly_revenue,
    avg_order_value,
    daily_footfall,
    'pending'
  )
  returning * into row;

  return jsonb_build_object('id', row.id, 'status', row.status, 'slug', row.slug);
end;
$$;

create or replace function public.approve_partner_application(app_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  app partner_applications%rowtype;
  biz businesses%rowtype;
begin
  select * into app from partner_applications where id = app_id for update;
  if not found then
    raise exception 'application not found';
  end if;
  if app.status <> 'pending' then
    raise exception 'application already processed';
  end if;

  insert into businesses (name, slug, phone, category_id, status)
  values (app.shop_name, app.slug, app.phone, app.category_id, 'active')
  returning * into biz;

  update partner_applications
  set status = 'approved', business_id = biz.id
  where id = app.id;

  return jsonb_build_object('business_id', biz.id, 'slug', biz.slug, 'phone', biz.phone);
end;
$$;

create or replace function public.merge_businesses_into_chain(chain_name text, business_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_chain_id uuid;
  bid uuid;
  biz businesses%rowtype;
  merged jsonb := '[]'::jsonb;
begin
  if business_ids is null or array_length(business_ids, 1) < 2 then
    raise exception 'select at least two partners';
  end if;
  if nullif(trim(chain_name), '') is null then
    raise exception 'chain name required';
  end if;

  insert into referral_chains (name) values (trim(chain_name)) returning id into v_chain_id;

  foreach bid in array business_ids loop
    select * into biz from businesses where id = bid;
    if not found then
      raise exception 'business not found';
    end if;
    update businesses set chain_id = v_chain_id where id = bid;
    insert into chain_notifications (chain_id, business_id, message)
    values (
      v_chain_id,
      bid,
      format('Aap chain "%s" mein merge ho gaye. Ab QR download karke table par lagao.', trim(chain_name))
    );
    merged := merged || jsonb_build_array(jsonb_build_object('business_id', bid, 'phone', biz.phone, 'name', biz.name));
  end loop;

  return jsonb_build_object('chain_id', v_chain_id, 'name', trim(chain_name), 'partners', merged);
end;
$$;

create or replace function public.mark_chain_notification_seen(business_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update chain_notifications
  set seen = true
  where chain_notifications.business_id = mark_chain_notification_seen.business_id
    and seen = false;
  return true;
end;
$$;

alter table partner_applications enable row level security;
alter table referral_chains enable row level security;
alter table chain_notifications enable row level security;

revoke all on partner_applications, referral_chains, chain_notifications from public, anon, authenticated;
grant all on partner_applications, referral_chains, chain_notifications to service_role;

revoke all on function public.submit_partner_application from public, anon, authenticated;
revoke all on function public.approve_partner_application from public, anon, authenticated;
revoke all on function public.merge_businesses_into_chain from public, anon, authenticated;
revoke all on function public.mark_chain_notification_seen from public, anon, authenticated;
grant execute on function public.submit_partner_application to service_role;
grant execute on function public.approve_partner_application to service_role;
grant execute on function public.merge_businesses_into_chain to service_role;
grant execute on function public.mark_chain_notification_seen to service_role;
