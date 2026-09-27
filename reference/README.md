# Nukkad Network — reference

Hyperlocal cross-business referral app for Mukherjee Nagar, Delhi.

## Stack

Next.js App Router + TypeScript + Tailwind, Supabase (Postgres source of truth), EasySocial WhatsApp BSP, MSG91 OTP, Vercel cron, Recharts.

## Decisions

- App directory is `C:\Users\dell\nukkad-network`. `C:\Users\del1` does not exist on this machine.
- Xerox referrer and platform amounts are a flat ₹5 each. Every other category uses 5% of gross. Discount is always 10% of gross, limited by the category cap.
- Seed shop phones: Sharma Cafe `9811111111`, Glow Salon `9822222222`.
- Customer page `/my/[token]` uses the customer's phone digits as the token.
- A settlement week is the Monday–Sunday window ending on the settle date (Asia/Kolkata). `dues` are commissions owed by the redeeming shop (referrer + platform). `credits` are referrer commissions that shop earned. `net_due = dues - credits`. Only `net_due > 0` unpaid rows are blocked on Monday.
- `FOLLOWUP_AUTO` starts from the env var. Phase 10 persists the admin toggle in `settings` so it can change without a deploy.
- The anon key can select `categories`, `businesses`, and `rate_cards` only. Every RPC is `SECURITY DEFINER` and executable by `service_role`. The Next.js server calls those RPCs. Extra write RPCs, because the client never writes tables directly: `save_otp`, `consume_otp`, `record_followup`, `file_dispute`.
- Local verification uses Postgres + PostgREST when a hosted Supabase project is not configured. Production uses the Supabase URL and keys in `.env.local`.

## Rate cards

| Category | Cap | Referrer | Platform | Min bill |
| --- | --- | --- | --- | --- |
| Cafe | 80 | 5% gross | 5% gross | 0 |
| Salon | 200 | 5% gross | 5% gross | 0 |
| Laundry | 60 | 5% gross | 5% gross | 0 |
| Gym | 150 | 5% gross | 5% gross | 0 |
| Xerox | 20 | flat 5 | flat 5 | 50 |

## Core rules

One active code per customer (a new scan supersedes). Codes look like `NK-XXXXX`, excluding `0`, `O`, `1`, `I`, and expire in 7 days. One lifetime redemption per customer per business. A code cannot be redeemed at its source shop. Next code is issued automatically and linked with `source_redemption_id`. Sunday settle, Monday block, paid settlement unblocks. Shopkeepers never generate codes. All writes go through `SECURITY DEFINER` RPCs. WhatsApp only delivers messages.
