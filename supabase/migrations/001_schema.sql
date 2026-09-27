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
