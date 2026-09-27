-- Paying-capacity tiers for chain matching.

alter table businesses add column if not exists price_min numeric;
alter table businesses add column if not exists price_max numeric;
alter table businesses add column if not exists tier text check (tier is null or tier in ('economy', 'mid', 'premium'));
alter table businesses add column if not exists price_list_url text;

create index if not exists businesses_tier_idx on businesses (tier);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'price-lists',
  'price-lists',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update businesses
set tier = 'mid', price_min = 50, price_max = 300
where slug = 'sharma-cafe' and tier is null;

update businesses
set tier = 'mid', price_min = 200, price_max = 800
where slug = 'glow-salon' and tier is null;

drop function if exists public.submit_partner_application(
  text, text, text, text, uuid, int, text, text, text, text, text, numeric, numeric
);

create or replace function public.submit_partner_application(
  p_shop_name text,
  p_slug text,
  p_phone text,
  p_owner_name text,
  p_category_id uuid,
  p_daily_footfall int,
  p_peak_hours text,
  p_customer_type text,
  p_pincode text,
  p_area text,
  p_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_price_min numeric,
  p_price_max numeric,
  p_price_list_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  normalized text := public.normalize_phone(p_phone);
  clean_slug text := lower(regexp_replace(trim(p_slug), '[^a-z0-9]+', '-', 'g'));
  clean_type text := lower(btrim(coalesce(p_customer_type, '')));
  clean_pincode text := regexp_replace(coalesce(p_pincode, ''), '\D', '', 'g');
  biz businesses%rowtype;
begin
  if length(normalized) < 10 then
    raise exception 'invalid phone';
  end if;
  if clean_slug is null or clean_slug = '' then
    raise exception 'invalid slug';
  end if;
  if nullif(btrim(coalesce(p_owner_name, '')), '') is null then
    raise exception 'owner name required';
  end if;
  if p_daily_footfall is null or p_daily_footfall < 0 then
    raise exception 'invalid footfall';
  end if;
  if nullif(btrim(coalesce(p_peak_hours, '')), '') is null then
    raise exception 'peak hours required';
  end if;
  if clean_type not in ('students', 'families', 'mixed') then
    raise exception 'invalid customer type';
  end if;
  if length(clean_pincode) <> 6 then
    raise exception 'invalid pincode';
  end if;
  if nullif(btrim(coalesce(p_area, '')), '') is null then
    raise exception 'area required';
  end if;
  if nullif(btrim(coalesce(p_address, '')), '') is null then
    raise exception 'address required';
  end if;
  if p_price_min is null or p_price_max is null or p_price_min < 0 or p_price_max < p_price_min then
    raise exception 'invalid price band';
  end if;

  insert into businesses (
    name,
    slug,
    phone,
    category_id,
    status,
    owner_name,
    daily_footfall,
    peak_hours,
    customer_type,
    pincode,
    area,
    address,
    latitude,
    longitude,
    price_min,
    price_max,
    price_list_url
  )
  values (
    trim(p_shop_name),
    clean_slug,
    normalized,
    p_category_id,
    'pending',
    trim(p_owner_name),
    p_daily_footfall,
    btrim(p_peak_hours),
    clean_type,
    clean_pincode,
    btrim(p_area),
    btrim(p_address),
    p_latitude,
    p_longitude,
    p_price_min,
    p_price_max,
    nullif(btrim(coalesce(p_price_list_url, '')), '')
  )
  returning * into biz;

  return jsonb_build_object('id', biz.id, 'status', biz.status, 'slug', biz.slug);
end;
$$;

drop function if exists public.approve_pending_business(uuid);

create or replace function public.approve_pending_business(p_business_id uuid, p_tier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  biz businesses%rowtype;
  clean_tier text := lower(btrim(coalesce(p_tier, '')));
begin
  if clean_tier not in ('economy', 'mid', 'premium') then
    raise exception 'tier required';
  end if;

  select * into biz from businesses where id = p_business_id for update;
  if not found then
    raise exception 'business not found';
  end if;
  if biz.status <> 'pending' then
    raise exception 'business not pending';
  end if;

  update businesses
  set status = 'active', tier = clean_tier
  where id = biz.id
  returning * into biz;

  return jsonb_build_object(
    'business_id', biz.id,
    'slug', biz.slug,
    'phone', biz.phone,
    'status', biz.status,
    'tier', biz.tier
  );
end;
$$;

create or replace function public.tier_rank(tier text)
returns int
language sql
immutable
as $$
  select case lower(coalesce(tier, ''))
    when 'economy' then 0
    when 'mid' then 1
    when 'premium' then 2
    else -1
  end;
$$;

create or replace function public.tiers_compatible(a text, b text)
returns boolean
language sql
immutable
as $$
  select
    public.tier_rank(a) >= 0
    and public.tier_rank(b) >= 0
    and abs(public.tier_rank(a) - public.tier_rank(b)) <= 1;
$$;

create or replace function public.suggest_tier(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  biz businesses%rowtype;
  avg_bill numeric;
  suggested text;
  src text := 'redemptions';
begin
  select * into biz from businesses where id = p_business_id;
  if not found then
    raise exception 'business not found';
  end if;

  select avg(gross_bill) into avg_bill
  from (
    select gross_bill
    from redemptions
    where business_id = p_business_id
    order by created_at desc
    limit 20
  ) recent;

  if avg_bill is null then
    avg_bill := (coalesce(biz.price_min, 0) + coalesce(biz.price_max, 0)) / 2;
    src := 'price_band';
  end if;

  if avg_bill < 200 then
    suggested := 'economy';
  elsif avg_bill <= 1500 then
    suggested := 'mid';
  else
    suggested := 'premium';
  end if;

  return jsonb_build_object(
    'suggested_tier', suggested,
    'avg_bill', round(avg_bill, 2),
    'source', src
  );
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
  min_rank int;
  max_rank int;
  r int;
begin
  if business_ids is null or array_length(business_ids, 1) < 2 then
    raise exception 'select at least two partners';
  end if;
  if nullif(trim(chain_name), '') is null then
    raise exception 'chain name required';
  end if;

  min_rank := 99;
  max_rank := -1;

  foreach bid in array business_ids loop
    select * into biz from businesses where id = bid;
    if not found then
      raise exception 'business not found';
    end if;
    if biz.tier is null then
      raise exception 'business missing tier';
    end if;
    r := public.tier_rank(biz.tier);
    min_rank := least(min_rank, r);
    max_rank := greatest(max_rank, r);
  end loop;

  if max_rank - min_rank > 1 then
    raise exception 'tier mismatch: only same or adjacent tiers can merge';
  end if;

  insert into referral_chains (name) values (trim(chain_name)) returning id into v_chain_id;

  foreach bid in array business_ids loop
    select * into biz from businesses where id = bid;
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

revoke all on function public.submit_partner_application from public, anon, authenticated;
revoke all on function public.approve_pending_business from public, anon, authenticated;
revoke all on function public.suggest_tier from public, anon, authenticated;
grant execute on function public.submit_partner_application to service_role;
grant execute on function public.approve_pending_business to service_role;
grant execute on function public.suggest_tier to service_role;
