-- Nukkad Network schema + seed.
-- Run this file in the Supabase SQL editor (or via the Supabase CLI) before 002_logic.sql.

create extension if not exists pgcrypto;

create table categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique
);

create table rate_cards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  category_id uuid not null references categories (id),
  discount_pct numeric not null default 10,
  discount_cap numeric not null,
  referrer_mode text not null check (referrer_mode in ('pct', 'flat')),
  referrer_pct numeric,
  referrer_flat numeric,
  platform_mode text not null check (platform_mode in ('pct', 'flat')),
  platform_pct numeric,
  platform_flat numeric,
  min_bill numeric not null default 0
);

create table businesses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  slug text not null unique,
  phone text not null unique,
  category_id uuid not null references categories (id),
  status text not null default 'active' check (status in ('active', 'blocked', 'banned')),
  strikes int not null default 0,
  maps_url text,
  instagram_url text
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  phone text not null unique,
  name text,
  trust_score int not null default 100
);

create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false
);

create table referral_codes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null unique,
  customer_id uuid not null references customers (id),
  source_business_id uuid not null references businesses (id),
  status text not null check (status in ('active', 'redeemed', 'superseded', 'expired')),
  expires_at timestamptz not null,
  source_redemption_id uuid
);

create table redemptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code_id uuid not null references referral_codes (id),
  business_id uuid not null references businesses (id),
  customer_id uuid not null references customers (id),
  gross_bill numeric not null,
  discount numeric not null,
  net_payable numeric not null,
  is_new_customer boolean not null default true
);

alter table referral_codes
  add constraint referral_codes_source_redemption_id_fkey
  foreign key (source_redemption_id) references redemptions (id);

create table commission_ledger (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  redemption_id uuid not null references redemptions (id),
  earner_type text not null check (earner_type in ('business', 'platform')),
  earner_business_id uuid references businesses (id),
  amount numeric not null
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  redemption_id uuid not null references redemptions (id),
  customer_id uuid not null references customers (id),
  business_id uuid not null references businesses (id),
  reason text not null,
  proof_url text,
  status text not null default 'pending' check (status in ('pending', 'upheld', 'rejected')),
  reward_paid boolean not null default false
);

create table settlements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  business_id uuid not null references businesses (id),
  week_start date not null,
  week_end date not null,
  dues numeric not null,
  credits numeric not null,
  net_due numeric not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  upi_ref text,
  paid_at timestamptz,
  unique (business_id, week_start)
);

create table followup_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_id uuid not null references customers (id),
  code_id uuid not null references referral_codes (id),
  reply text not null
);

create index referral_codes_customer_id_status_idx on referral_codes (customer_id, status);
create index redemptions_customer_id_business_id_idx on redemptions (customer_id, business_id);
create index redemptions_business_id_created_at_idx on redemptions (business_id, created_at);

insert into categories (name)
values ('Cafe'), ('Salon'), ('Laundry'), ('Gym'), ('Xerox');

insert into rate_cards (
  category_id,
  discount_pct,
  discount_cap,
  referrer_mode,
  referrer_pct,
  referrer_flat,
  platform_mode,
  platform_pct,
  platform_flat,
  min_bill
)
select
  c.id,
  10,
  v.discount_cap,
  v.referrer_mode,
  v.referrer_pct,
  v.referrer_flat,
  v.platform_mode,
  v.platform_pct,
  v.platform_flat,
  v.min_bill
from (
  values
    ('Cafe'::text, 80::numeric, 'pct'::text, 5::numeric, null::numeric, 'pct'::text, 5::numeric, null::numeric, 0::numeric),
    ('Salon', 200, 'pct', 5, null, 'pct', 5, null, 0),
    ('Laundry', 60, 'pct', 5, null, 'pct', 5, null, 0),
    ('Gym', 150, 'pct', 5, null, 'pct', 5, null, 0),
    ('Xerox', 20, 'flat', null, 5, 'flat', null, 5, 50)
) as v (
  name,
  discount_cap,
  referrer_mode,
  referrer_pct,
  referrer_flat,
  platform_mode,
  platform_pct,
  platform_flat,
  min_bill
)
join categories c on c.name = v.name;

insert into businesses (name, slug, phone, category_id)
select 'Sharma Cafe', 'sharma-cafe', '9811111111', id from categories where name = 'Cafe';

insert into businesses (name, slug, phone, category_id)
select 'Glow Salon', 'glow-salon', '9822222222', id from categories where name = 'Salon';

-- Nukkad Network triggers, RPCs, and RLS.
-- Run this in the Supabase SQL editor after 001_schema.sql.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create or replace function public.normalize_phone(raw text)
returns text
language plpgsql
immutable
as $$
#variable_conflict use_variable
declare
  digits text := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
begin
  if length(digits) > 10 then
    digits := right(digits, 10);
  end if;
  return digits;
end;
$$;

create or replace function public.generate_nk_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := 'NK-';
    for i in 1..5 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from referral_codes where code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.trg_referral_codes_supersede()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
begin
  if new.status = 'active' then
    update referral_codes
    set status = 'superseded'
    where customer_id = new.customer_id
      and status = 'active';
  end if;
  return new;
end;
$$;

create trigger referral_codes_supersede
before insert on referral_codes
for each row
execute function public.trg_referral_codes_supersede();

create or replace function public.trg_redemptions_one_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
begin
  if exists (
    select 1
    from redemptions
    where customer_id = new.customer_id
      and business_id = new.business_id
  ) then
    raise exception 'lifetime one redemption per customer per business';
  end if;
  return new;
end;
$$;

create trigger redemptions_one_claim
before insert on redemptions
for each row
execute function public.trg_redemptions_one_claim();

create or replace function public.trg_redemptions_next_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  next_code text := public.generate_nk_code();
begin
  update referral_codes
  set status = 'redeemed'
  where id = new.code_id;

  insert into referral_codes (
    code,
    customer_id,
    source_business_id,
    status,
    expires_at,
    source_redemption_id
  )
  values (
    next_code,
    new.customer_id,
    new.business_id,
    'active',
    now() + interval '7 days',
    new.id
  );

  return new;
end;
$$;

create trigger redemptions_next_code
after insert on redemptions
for each row
execute function public.trg_redemptions_next_code();

alter table referral_codes
  add constraint referral_codes_code_format_chk
  check (code ~ '^NK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$');

create or replace function public.issue_code(phone text, name text, business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  normalized text := public.normalize_phone(phone);
  biz businesses%rowtype;
  cust customers%rowtype;
  issued referral_codes%rowtype;
begin
  if normalized is null or length(normalized) < 10 then
    raise exception 'invalid phone';
  end if;

  select * into biz from businesses where id = business_id;
  if not found then
    raise exception 'business not found';
  end if;
  if biz.status <> 'active' then
    raise exception 'business not active';
  end if;

  insert into customers (phone, name)
  values (normalized, nullif(btrim(coalesce(name, '')), ''))
  on conflict on constraint customers_phone_key do update
    set name = coalesce(excluded.name, customers.name)
  returning * into cust;

  insert into referral_codes (code, customer_id, source_business_id, status, expires_at)
  values (public.generate_nk_code(), cust.id, business_id, 'active', now() + interval '7 days')
  returning * into issued;

  return jsonb_build_object(
    'code', issued.code,
    'expires_at', issued.expires_at,
    'customer_id', cust.id,
    'customer_name', cust.name,
    'source_business_id', business_id
  );
end;
$$;

create or replace function public.preview_redeem(code text, business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  issued referral_codes%rowtype;
  cust customers%rowtype;
  biz businesses%rowtype;
  card rate_cards%rowtype;
  category_name text;
begin
  select * into issued from referral_codes where referral_codes.code = upper(btrim(code));
  if not found then
    raise exception 'code not found';
  end if;
  if issued.status <> 'active' then
    raise exception 'code not active';
  end if;
  if issued.expires_at <= now() then
    raise exception 'code expired';
  end if;
  if issued.source_business_id = business_id then
    raise exception 'code invalid at source business';
  end if;

  select * into cust from customers where id = issued.customer_id;
  select * into biz from businesses where id = business_id;
  if not found then
    raise exception 'business not found';
  end if;
  if biz.status <> 'active' then
    raise exception 'business not active';
  end if;

  select * into card from rate_cards where category_id = biz.category_id;
  select name into category_name from categories where id = biz.category_id;

  return jsonb_build_object(
    'customer_name', cust.name,
    'category', category_name,
    'discount_pct', card.discount_pct,
    'discount_cap', card.discount_cap,
    'min_bill', card.min_bill,
    'referrer_mode', card.referrer_mode,
    'referrer_pct', card.referrer_pct,
    'referrer_flat', card.referrer_flat,
    'platform_mode', card.platform_mode,
    'platform_pct', card.platform_pct,
    'platform_flat', card.platform_flat
  );
end;
$$;

create or replace function public.redeem_code(code text, business_id uuid, gross numeric, is_new boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  issued referral_codes%rowtype;
  cust customers%rowtype;
  biz businesses%rowtype;
  card rate_cards%rowtype;
  discount_amt numeric;
  net_amt numeric;
  referrer_amt numeric;
  platform_amt numeric;
  redemption redemptions%rowtype;
  next_code text;
begin
  if gross is null or gross <= 0 then
    raise exception 'invalid bill';
  end if;

  select * into issued from referral_codes where referral_codes.code = upper(btrim(code));
  if not found then
    raise exception 'code not found';
  end if;
  if issued.status <> 'active' then
    raise exception 'code not active';
  end if;
  if issued.expires_at <= now() then
    update referral_codes set status = 'expired' where id = issued.id and status = 'active';
    raise exception 'code expired';
  end if;
  if issued.source_business_id = business_id then
    raise exception 'code invalid at source business';
  end if;

  select * into biz from businesses where id = business_id;
  if not found then
    raise exception 'business not found';
  end if;
  if biz.status <> 'active' then
    raise exception 'business not active';
  end if;

  select * into card from rate_cards where category_id = biz.category_id;
  if gross < card.min_bill then
    raise exception 'bill below minimum';
  end if;

  discount_amt := least(round(gross * card.discount_pct / 100, 2), card.discount_cap);
  net_amt := gross - discount_amt;

  if card.referrer_mode = 'pct' then
    referrer_amt := round(gross * card.referrer_pct / 100, 2);
  else
    referrer_amt := card.referrer_flat;
  end if;

  if card.platform_mode = 'pct' then
    platform_amt := round(gross * card.platform_pct / 100, 2);
  else
    platform_amt := card.platform_flat;
  end if;

  select * into cust from customers where id = issued.customer_id;

  insert into redemptions (
    code_id,
    business_id,
    customer_id,
    gross_bill,
    discount,
    net_payable,
    is_new_customer
  )
  values (
    issued.id,
    business_id,
    issued.customer_id,
    gross,
    discount_amt,
    net_amt,
    coalesce(is_new, true)
  )
  returning * into redemption;

  insert into commission_ledger (redemption_id, earner_type, earner_business_id, amount)
  values
    (redemption.id, 'business', issued.source_business_id, referrer_amt),
    (redemption.id, 'platform', null, platform_amt);

  select referral_codes.code into next_code
  from referral_codes
  where source_redemption_id = redemption.id;

  return jsonb_build_object(
    'customer_name', cust.name,
    'discount', discount_amt,
    'net_payable', net_amt,
    'referrer_amt', referrer_amt,
    'platform_amt', platform_amt,
    'next_code', next_code,
    'redemption_id', redemption.id
  );
end;
$$;

create or replace function public.get_active_code(phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  normalized text := public.normalize_phone(phone);
  result jsonb;
begin
  select jsonb_build_object(
    'code', rc.code,
    'expires_at', rc.expires_at,
    'customer_id', c.id,
    'customer_name', c.name,
    'source_business_id', rc.source_business_id
  )
  into result
  from customers c
  join referral_codes rc on rc.customer_id = c.id
  where c.phone = normalized
    and rc.status = 'active'
    and rc.expires_at > now()
  order by rc.created_at desc
  limit 1;

  return result;
end;
$$;

create or replace function public.settle_week()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  today_ist date := (now() at time zone 'Asia/Kolkata')::date;
  week_end_d date := today_ist - extract(dow from today_ist)::int;
  week_start_d date := week_end_d - 6;
  range_start timestamptz := week_start_d::timestamp at time zone 'Asia/Kolkata';
  range_end timestamptz := (week_end_d + 1)::timestamp at time zone 'Asia/Kolkata';
  biz businesses%rowtype;
  due_amt numeric;
  credit_amt numeric;
  created jsonb := '[]'::jsonb;
  row settlements%rowtype;
begin
  -- Sunday 00:00 IST through the following Sunday is the closed week.
  -- If this runs on Sunday, week_end is that Sunday. Otherwise it is the latest Sunday.
  if extract(dow from today_ist)::int <> 0 then
    week_end_d := today_ist - extract(dow from today_ist)::int;
  else
    week_end_d := today_ist;
  end if;
  week_start_d := week_end_d - 6;
  range_start := week_start_d::timestamp at time zone 'Asia/Kolkata';
  range_end := (week_end_d + 1)::timestamp at time zone 'Asia/Kolkata';

  for biz in select * from businesses where status <> 'banned' loop
    row := null;
    select coalesce(sum(cl.amount), 0)
    into due_amt
    from commission_ledger cl
    join redemptions r on r.id = cl.redemption_id
    where r.business_id = biz.id
      and r.created_at >= range_start
      and r.created_at < range_end;

    select coalesce(sum(cl.amount), 0)
    into credit_amt
    from commission_ledger cl
    join redemptions r on r.id = cl.redemption_id
    where cl.earner_type = 'business'
      and cl.earner_business_id = biz.id
      and r.created_at >= range_start
      and r.created_at < range_end;

    insert into settlements (business_id, week_start, week_end, dues, credits, net_due, status)
    values (biz.id, week_start_d, week_end_d, due_amt, credit_amt, due_amt - credit_amt, 'unpaid')
    on conflict (business_id, week_start) do nothing
    returning * into row;

    if row.id is not null then
      created := created || jsonb_build_array(jsonb_build_object(
        'id', row.id,
        'business_id', biz.id,
        'business_name', biz.name,
        'phone', biz.phone,
        'week_start', week_start_d,
        'week_end', week_end_d,
        'dues', due_amt,
        'credits', credit_amt,
        'net_due', due_amt - credit_amt
      ));
    end if;
  end loop;

  return created;
end;
$$;

create or replace function public.mark_settlement_paid(id uuid, upi_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  row settlements%rowtype;
begin
  update settlements
  set status = 'paid',
      upi_ref = nullif(btrim(coalesce(mark_settlement_paid.upi_ref, '')), ''),
      paid_at = now()
  where settlements.id = mark_settlement_paid.id
  returning * into row;

  if not found then
    raise exception 'settlement not found';
  end if;

  update businesses
  set status = 'active'
  where businesses.id = row.business_id
    and status = 'blocked';

  return jsonb_build_object(
    'id', row.id,
    'business_id', row.business_id,
    'status', 'paid',
    'upi_ref', row.upi_ref
  );
end;
$$;

create or replace function public.block_unpaid()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  blocked_rows jsonb;
begin
  with updated as (
    update businesses b
    set status = 'blocked'
    where b.status = 'active'
      and exists (
        select 1
        from settlements s
        where s.business_id = b.id
          and s.status = 'unpaid'
          and s.net_due > 0
      )
    returning b.id, b.name, b.slug
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'slug', slug)), '[]'::jsonb)
  into blocked_rows
  from updated;

  return blocked_rows;
end;
$$;

create or replace function public.update_business_profile(business_id uuid, maps_url text, instagram_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  row businesses%rowtype;
begin
  update businesses
  set maps_url = nullif(btrim(coalesce(update_business_profile.maps_url, '')), ''),
      instagram_url = nullif(btrim(coalesce(update_business_profile.instagram_url, '')), '')
  where id = update_business_profile.business_id
  returning * into row;

  if not found then
    raise exception 'business not found';
  end if;

  return jsonb_build_object(
    'id', row.id,
    'maps_url', row.maps_url,
    'instagram_url', row.instagram_url
  );
end;
$$;

create or replace function public.set_business_status(business_id uuid, status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  row businesses%rowtype;
begin
  if status not in ('active', 'blocked', 'banned') then
    raise exception 'invalid status';
  end if;

  update businesses
  set status = set_business_status.status
  where id = business_id
  returning * into row;

  if not found then
    raise exception 'business not found';
  end if;

  return jsonb_build_object('id', row.id, 'status', row.status);
end;
$$;

create or replace function public.insights_payload(target_business uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  payload jsonb;
begin
  with reds as (
    select
      r.*,
      rc.source_business_id,
      (r.created_at at time zone 'Asia/Kolkata') as local_ts
    from redemptions r
    join referral_codes rc on rc.id = r.code_id
    where target_business is null or r.business_id = target_business
  ),
  dows as (
    select
      d.dow,
      count(reds.id)::int as count,
      coalesce(sum(reds.gross_bill), 0) as gross
    from generate_series(0, 6) as d(dow)
    left join reds on extract(dow from reds.local_ts)::int = d.dow
    group by d.dow
  ),
  hours as (
    select
      h.hour,
      count(reds.id)::int as count
    from generate_series(0, 23) as h(hour)
    left join reds on extract(hour from reds.local_ts)::int = h.hour
    group by h.hour
  ),
  top_ref as (
    select b.name, count(*)::int as count
    from reds
    join businesses b on b.id = reds.source_business_id
    group by b.name
    order by count(*) desc, b.name
    limit 1
  ),
  conv as (
    select
      count(*)::int as codes,
      count(*) filter (where status = 'redeemed')::int as redemptions
    from referral_codes
    where target_business is null or source_business_id = target_business
  )
  select jsonb_build_object(
    'by_dow', (select jsonb_agg(jsonb_build_object('dow', dow, 'count', count, 'gross', gross) order by dow) from dows),
    'by_hour', (select jsonb_agg(jsonb_build_object('hour', hour, 'count', count) order by hour) from hours),
    'avg_gross', coalesce((select round(avg(gross_bill), 2) from reds), 0),
    'new_count', coalesce((select count(*)::int from reds where is_new_customer), 0),
    'returning_count', coalesce((select count(*)::int from reds where not is_new_customer), 0),
    'top_referrer', (select jsonb_build_object('name', name, 'count', count) from top_ref),
    'conversion', (
      select jsonb_build_object(
        'codes', codes,
        'redemptions', redemptions,
        'rate', case when codes = 0 then 0 else round(redemptions::numeric / codes, 4) end
      )
      from conv
    )
  )
  into payload;

  return payload;
end;
$$;

create or replace function public.get_insights(business_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.insights_payload(business_id);
$$;

create or replace function public.get_network_insights()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.insights_payload(null);
$$;

create or replace function public.save_otp(phone text, code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  normalized text := public.normalize_phone(phone);
  row otp_codes%rowtype;
begin
  if length(normalized) < 10 then
    raise exception 'invalid phone';
  end if;
  if code is null or btrim(code) = '' then
    raise exception 'invalid code';
  end if;

  insert into otp_codes (phone, code, expires_at, used)
  values (normalized, btrim(code), now() + interval '5 minutes', false)
  returning * into row;

  return jsonb_build_object('phone', row.phone, 'expires_at', row.expires_at);
end;
$$;

create or replace function public.consume_otp(phone text, code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  normalized text := public.normalize_phone(phone);
  otp_id uuid;
begin
  select id into otp_id
  from otp_codes
  where otp_codes.phone = normalized
    and otp_codes.code = btrim(code)
    and used = false
    and expires_at > now()
  order by created_at desc
  limit 1;

  if otp_id is null then
    return false;
  end if;

  update otp_codes set used = true where id = otp_id;
  return true;
end;
$$;

create or replace function public.record_followup(phone text, reply text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  normalized text := public.normalize_phone(phone);
  cust customers%rowtype;
  issued referral_codes%rowtype;
  row followup_responses%rowtype;
begin
  if reply not in ('visited', 'busy', 'expensive', 'forgot', 'behaviour') then
    raise exception 'invalid followup reply';
  end if;

  select * into cust from customers where customers.phone = normalized;
  if not found then
    raise exception 'customer not found';
  end if;

  select * into issued
  from referral_codes
  where customer_id = cust.id
    and status = 'active'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'no active code';
  end if;

  insert into followup_responses (customer_id, code_id, reply)
  values (cust.id, issued.id, reply)
  returning * into row;

  return jsonb_build_object('id', row.id, 'reply', row.reply, 'code_id', row.code_id);
end;
$$;

create or replace function public.file_dispute(redemption_id uuid, reason text, proof_url text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  redemption redemptions%rowtype;
  row disputes%rowtype;
begin
  if nullif(btrim(coalesce(reason, '')), '') is null then
    raise exception 'reason required';
  end if;

  select * into redemption from redemptions where id = redemption_id;
  if not found then
    raise exception 'redemption not found';
  end if;

  if exists (
    select 1 from disputes
    where disputes.redemption_id = file_dispute.redemption_id
      and status = 'pending'
  ) then
    raise exception 'dispute already open';
  end if;

  insert into disputes (redemption_id, customer_id, business_id, reason, proof_url, status)
  values (
    redemption.id,
    redemption.customer_id,
    redemption.business_id,
    btrim(reason),
    nullif(btrim(coalesce(proof_url, '')), ''),
    'pending'
  )
  returning * into row;

  return jsonb_build_object(
    'id', row.id,
    'status', row.status,
    'redemption_id', row.redemption_id
  );
end;
$$;

revoke all on all tables in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on categories, businesses, rate_cards to anon, authenticated;
grant all on all tables in schema public to service_role;

alter table categories enable row level security;
alter table rate_cards enable row level security;
alter table businesses enable row level security;
alter table customers enable row level security;
alter table otp_codes enable row level security;
alter table referral_codes enable row level security;
alter table redemptions enable row level security;
alter table commission_ledger enable row level security;
alter table disputes enable row level security;
alter table settlements enable row level security;
alter table followup_responses enable row level security;

create policy categories_anon_select on categories for select to anon, authenticated using (true);
create policy rate_cards_anon_select on rate_cards for select to anon, authenticated using (true);
create policy businesses_anon_select on businesses for select to anon, authenticated using (true);

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Extra Mukherjee Nagar network shops (run after 001 + 002).

insert into businesses (name, slug, phone, category_id, maps_url, instagram_url)
select 'FitZone Gym', 'fitzone-gym', '9844444444', id, 'https://maps.google.com/?q=FitZone+Gym+Mukherjee+Nagar', 'https://instagram.com/'
from categories where name = 'Gym'
on conflict (slug) do nothing;

insert into businesses (name, slug, phone, category_id, maps_url, instagram_url)
select 'Rhythm Dance Class', 'rhythm-dance', '9855555555', id, 'https://maps.google.com/?q=Rhythm+Dance+Mukherjee+Nagar', 'https://instagram.com/'
from categories where name = 'Gym'
on conflict (slug) do nothing;

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

revoke all on function public.merge_businesses_into_chain from public, anon, authenticated;
revoke all on function public.mark_chain_notification_seen from public, anon, authenticated;
grant execute on function public.merge_businesses_into_chain to service_role;
grant execute on function public.mark_chain_notification_seen to service_role;

drop function if exists public.resolve_dispute(uuid, text);

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
