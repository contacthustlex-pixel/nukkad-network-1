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

create or replace function public.resolve_dispute(id uuid, verdict text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  row disputes%rowtype;
  next_strikes int;
begin
  select * into row from disputes where disputes.id = resolve_dispute.id for update;
  if not found then
    raise exception 'dispute not found';
  end if;
  if row.status <> 'pending' then
    raise exception 'dispute already resolved';
  end if;

  if verdict = 'upheld' then
    update disputes
    set status = 'upheld', reward_paid = true
    where disputes.id = row.id;

    update businesses
    set strikes = strikes + 1
    where businesses.id = row.business_id
    returning strikes into next_strikes;

    if next_strikes >= 2 then
      update businesses set status = 'banned' where businesses.id = row.business_id;
    end if;

    return jsonb_build_object(
      'id', row.id,
      'status', 'upheld',
      'reward_paid', true,
      'strikes', next_strikes
    );
  elsif verdict = 'rejected' then
    update disputes set status = 'rejected' where disputes.id = row.id;
    update customers
    set trust_score = trust_score - 10
    where customers.id = row.customer_id;

    return jsonb_build_object(
      'id', row.id,
      'status', 'rejected',
      'reward_paid', false
    );
  else
    raise exception 'invalid verdict';
  end if;
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
