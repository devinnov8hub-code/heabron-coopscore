# Backend changes — App Dev impact notice

**TL;DR: Nothing your app currently calls changes shape or breaks. All changes are
either (a) brand-new endpoints, or (b) extra fields ADDED to existing responses
(old fields untouched). You do not need to change any existing code. Re-deploy
backend + run the SQL migrations.**

---

## 1. Will any of my existing calls break? — NO

Every endpoint you already use keeps its exact response shape. We only spread the
original row and ADD fields. Specifically:

| Endpoint | What you had | What's added (safe to ignore) |
|---|---|---|
| `GET /agent/farmers`, `/agent/farmers/:id` | all original farmer fields + `farm_profiles[]` | NEW: `farm` (single object, camelCase), `cooperative`, `creditScore`. `farm_profiles[]` is still there. |
| `GET /agent/cooperatives/:id/farmers` | farmer rows (previously had no farm join) | now each farmer also includes `farm_profiles[]` + `farm` |
| `GET /agent/cooperatives` + `/:id` | all original fields | `cooperative_tier` now never `null` (returns `"D"` if unscored) |
| everything else | unchanged | — |

**The only behavioural change you might NOTICE (not break):** cooperatives that used
to return `"cooperative_tier": null` now return `"cooperative_tier": "D"`. If your UI
had special handling for `null`, it now just shows `D`. That was the bug you reported.

## 2. Bug fixes (these FIX 422 / 500 errors you were already hitting)

- **List endpoints no longer 422 on empty filters.** Sending `?search=&status=&tier=`
  (empty strings) used to fail validation. Now empty params are ignored. Affects every
  paginated list (`farmers`, `cooperatives`, `agents`, `credit`, `partners`, etc.).
  → Your app can keep sending empty filter params exactly as before; they now succeed.
- **`GET /admin/agents`** previously returned `[]` even when agents existed (broken DB join). Fixed.
- **`GET /admin/activity-logs`** previously 500'd (broken DB join). Fixed.
- **Repayment 404s** now include the attempted ID in `error.details` for easier debugging.

## 3. Brand-new endpoints (only call these if/when you build the screens)

These are ADDITIVE. If you never call them, nothing changes for you.

**Farmer financing history (you asked for this):**
- `GET /agent/farmers/:farmerId/financing-history`
- also: `GET /agent/financing-requests?farmerId=...`

**Manual money flow (temporary, until live wallet):**
- `POST /agent/wallet/cash-purchases` — agent records a purchase made for a farmer + proof images. (Body: `farmerId`, `amount`, `paymentMethod`, `receiptImageUrl`, `proofImageUrls[]`, optional `financingRequestId`.)  Saved as **pending**.
- `GET /agent/wallet/cash-purchases` — agent's own purchase records.
- `POST /admin/disbursements` — admin records cash sent to an agent + proof. Credits the agent wallet; shows in agent transaction history.
- `GET /admin/transactions` — all wallet transactions (admin).
- `GET /admin/cash-purchases?status=pending` — purchase proofs awaiting admin confirmation.
- `POST /admin/cash-purchases/:transactionId/confirm` — admin confirms/rejects a purchase. (Body: `decision: "confirm"|"reject"`, optional `adminNotes`.)

**Settlement decision now accepts proof (existing endpoint, extra optional fields):**
- `POST /admin/settlements/:id/decision` — now also accepts optional `receiptImageUrl`, `referenceNumber`. Old calls with just `{decision, adminNotes}` still work.

**PDF export data:**
- `GET /agent/exports/agent`, `/agent/exports/farmer/:id`, `/agent/exports/cooperative/:id` (also under `/admin/exports/...`).

**Partner self-service (new — for partner web only):**
- `GET /partner/organization`, `PATCH /partner/organization`, `POST /partner/uploads/:kind`, `DELETE /partner/profile`.

## 4. Database migrations to run (Supabase SQL editor, in order)

- `003_backfill_cooperative_tiers.sql` — sets existing null cooperative tiers to `D`.
- `004_partner_profile_fields.sql` — adds `partners.website`, `tax_id`, `contact_name`.
- `005_manual_payment_notification_types.sql` — adds notification enum values for the manual flow.

All are idempotent (safe to re-run). If 005 isn't run, the new notifications are simply
skipped (wrapped in try/catch) — nothing breaks.

## 5. Cash-purchase status lifecycle (new) — for your awareness

`POST /agent/wallet/cash-purchases` creates a `wallet_transactions` row with
`status: "pending"`. Admin confirm → `completed`, reject → `failed`. If your agent UI
lists purchases, you may want to show this status. (If you don't, they just appear as
normal transactions.)

## 6. Update: financing disbursement details (additive — existing calls safe)

`POST /admin/financing-requests/:id/decision` with `decision: "disbursed"` now
ALSO accepts these optional fields (ignored if you don't send them):
- `disbursementAccountDetails` (string) — bank/account the money was sent to
- `disbursementReference` (string)
- `disbursementProofUrls` (string[]) — proof image/PDF URLs

They're stored on the financing request (new columns from migration 006) so the
**field agent app can read them** on the loan: `disbursement_account_details`,
`disbursement_reference`, `disbursement_proof_urls`. Run migration 006.

If your agent app shows a disbursed loan, you can now display "money was sent to
<account>" + proof. Optional — only if useful to the agent.
