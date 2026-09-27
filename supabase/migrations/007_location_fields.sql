-- Location fields for area-wise grouping and shop discovery.

alter table businesses add column if not exists pincode text;
alter table businesses add column if not exists area text;
alter table businesses add column if not exists address text;
alter table businesses add column if not exists latitude numeric;
alter table businesses add column if not exists longitude numeric;

create index if not exists businesses_pincode_area_idx on businesses (pincode, area);

drop function if exists public.submit_partner_application(text, text, text, text, uuid, int, text, text);

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
  p_longitude numeric
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
    longitude
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
    p_longitude
  )
  returning * into biz;

  return jsonb_build_object('id', biz.id, 'status', biz.status, 'slug', biz.slug);
end;
$$;

revoke all on function public.submit_partner_application from public, anon, authenticated;
grant execute on function public.submit_partner_application to service_role;
