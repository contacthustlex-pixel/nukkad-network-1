-- Partner signup inserts pending rows on businesses (no self-reported revenue).

alter table businesses drop constraint if exists businesses_status_check;
alter table businesses add constraint businesses_status_check
  check (status in ('active', 'blocked', 'banned', 'pending', 'rejected'));

alter table businesses add column if not exists owner_name text;
alter table businesses add column if not exists daily_footfall int;
alter table businesses add column if not exists peak_hours text;
alter table businesses add column if not exists customer_type text;

alter table businesses drop column if exists monthly_revenue;
alter table businesses drop column if exists avg_order_value;

drop function if exists public.submit_partner_application(text, text, text, text, uuid, numeric, numeric, int);

create or replace function public.submit_partner_application(
  p_shop_name text,
  p_slug text,
  p_phone text,
  p_owner_name text,
  p_category_id uuid,
  p_daily_footfall int,
  p_peak_hours text,
  p_customer_type text
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

  insert into businesses (
    name,
    slug,
    phone,
    category_id,
    status,
    owner_name,
    daily_footfall,
    peak_hours,
    customer_type
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
    clean_type
  )
  returning * into biz;

  return jsonb_build_object('id', biz.id, 'status', biz.status, 'slug', biz.slug);
end;
$$;

create or replace function public.approve_pending_business(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  biz businesses%rowtype;
begin
  select * into biz from businesses where id = p_business_id for update;
  if not found then
    raise exception 'business not found';
  end if;
  if biz.status <> 'pending' then
    raise exception 'business not pending';
  end if;

  update businesses set status = 'active' where id = biz.id returning * into biz;
  return jsonb_build_object('business_id', biz.id, 'slug', biz.slug, 'phone', biz.phone, 'status', biz.status);
end;
$$;

create or replace function public.reject_pending_business(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  biz businesses%rowtype;
begin
  select * into biz from businesses where id = p_business_id for update;
  if not found then
    raise exception 'business not found';
  end if;
  if biz.status <> 'pending' then
    raise exception 'business not pending';
  end if;

  update businesses set status = 'rejected' where id = biz.id returning * into biz;
  return jsonb_build_object('business_id', biz.id, 'status', biz.status);
end;
$$;

revoke all on function public.submit_partner_application from public, anon, authenticated;
revoke all on function public.approve_pending_business from public, anon, authenticated;
revoke all on function public.reject_pending_business from public, anon, authenticated;
grant execute on function public.submit_partner_application to service_role;
grant execute on function public.approve_pending_business to service_role;
grant execute on function public.reject_pending_business to service_role;
