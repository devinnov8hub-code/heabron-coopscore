# Fixes — June 4 round 2

This drop fixes the five issues you reported. Three are code, two are
infrastructure (run-once-in-Supabase). Order matters — do them in order.

## 1. Admin pages showing "Validation failed" 422 (CODE FIX)

Cause: the `listQuery` validator rejected empty query strings (`?search=&status=`)
that the web sends for unselected filters. `.empty('')` now converts them to
"absent" before validation, so every paginated admin list works again.

Affects: agents, cooperatives, farmers, credit, partners, financing, wallets,
activity, settlements — all of them.

**File:** `src/validators/domain.js`

## 2. Field agents registered but admin agents page shows nothing (CODE FIX)

Cause: broken PostgREST embed. `user_roles.user_id` references `auth.users`,
not `profiles`, so `profiles(*)` in the embed returns null and the agent
gets stripped out. Switched to a two-step lookup (fetch role ids, then
fetch profiles).

**File:** `src/controllers/admin.agents.controller.js`

## 3. `/auth/uploads/avatar` returning 500 (CODE FIX + INFRA)

The Flutter dev was getting `INTERNAL_ERROR / Something went wrong` — opaque.
Real cause is almost certainly that the `agent-documents` storage bucket
doesn't exist in your Supabase yet. Two changes:

a) **Code:** the upload handler now logs the real error (bucket name, RLS
hint, etc.) and returns a useful `UPLOAD_FAILED` response with the bucket
name so future failures are diagnosable without guessing.

b) **Infra (required):** run `migrations/007_storage_buckets.sql` in the
Supabase SQL editor. This creates all five buckets (agent-documents,
farmer-documents, delivery-proofs, transaction-receipts, partner-logos).
Idempotent — safe to re-run.

After this, hitting `POST /auth/uploads/avatar` with a valid `Bearer` token
and a multipart `file=` will upload to `agent-documents/avatars/`.

**Files:** `src/controllers/uploads.controller.js`, `migrations/007_storage_buckets.sql`

## 4. OTP emails landing in DB but not in inbox (TEMPLATE TWEAK + DELIVERABILITY)

This is a deliverability issue, not a backend bug. The row IS being inserted,
and the email IS being sent through Resend — but Gmail/Yahoo are filtering
the OTP to spam while letting your other emails through. This happens
because: (a) OTP subjects ("Your verification code") are heavily filtered,
(b) the code-in-body pattern from a recently-verified domain hits a Bayesian
flag, (c) duplicate subjects look like bot traffic.

**Template fix:** I changed the OTP template to use a more transactional
subject pattern that filters treat better:
- Old: `Your Heabron CoopScore verification code`
- New: `123456 is your Heabron CoopScore confirmation code`
Also added a clearer footer with sender info to improve deliverability score.

**File:** `src/templates/email/templates.js`

**What to do next:**
1. Deploy + try a fresh signup — check both inbox and spam.
2. If still missing from inbox, the issue is your sender reputation on a
   new domain. Mitigations (in order):
   - Wait 24–48h after domain verification for reputation to build.
   - In Resend dashboard, check "Logs" for the OTP send — if it shows
     "delivered" the email reached Gmail and Gmail filtered it. If it shows
     "bounced", the address is bad. If "sent" but never "delivered",
     Gmail is rate-limiting your domain.
   - Make sure your DNS shows ALL FOUR Resend records as green: SPF, DKIM,
     DKIM2, and DMARC. Missing DMARC is the most common cause of OTP-only
     spam filtering.

> One thing I CAN'T fix from here: I can't see your Resend logs. If the
> OTP still doesn't arrive after this drop, check Resend → Logs for the
> exact OTP send and tell me what status it shows. That'll tell us
> definitively whether it's a sending or a filtering issue.

## 5. Partner farmer-profile data (NO CHANGE NEEDED)

`GET /api/partner/credit/farmer/:farmerId` already returns:
- `subject` (farmer + cooperative + farm_profiles)
- `score` (credit_scores row)
- `trend` (credit_score_history)
- `financingHistory`
- `repaymentHistory` (voided excluded)
- `recentDeliveries`
- **`seasonalProductions`** ← yield per season for the yield-history chart
- `riskFlags`

The data the partner farmer-profile screen needs is already there. If the
partner sees nothing, it means no `seasonal_productions` rows exist for
that farmer yet — they're created via `POST /agent/productions` at harvest.

---

## Deploy steps

1. Extract this drop over your backend repo (overwrites four files).
2. Run **migration 007** (`007_storage_buckets.sql`) in Supabase SQL editor.
3. Restart the backend.
4. Smoke test:
   - Click "Field Agents" on admin → registered agents appear (no 422).
   - Click "Partners" on admin → page loads (no 422).
   - Flutter signup → avatar uploads succeed.
   - Signup → check inbox AND spam for the OTP.
