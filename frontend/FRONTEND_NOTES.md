# Heabron CoopScore — Admin & Partner Web

React 18 + Vite + Tailwind. Two portals behind one auth: **Admin** and **Partner**.

## Run

```bash
npm install
cp .env.example .env        # set VITE_API_URL to your API base
npm run dev                 # http://localhost:5173 (proxies /api -> :4000 in dev)
npm run build               # production build -> dist/
```

For production set `VITE_API_URL=https://heabron-coopscore.vercel.app/api`.

## Auth & routing

- `/login` — split-screen login (green "CoopScore Partners" hero). "Reset Password" opens a modal that emails a 6-digit code.
- `/forgot-password` — request code (step 1) + 6-box OTP verify & new password (step 2).
- `/change-password` — forced first-login password change (when `mustChangePassword`).
- Role gates: admins -> `/admin/*`, partners -> `/partner/*`. A partner hitting an admin route is redirected and vice-versa.

## Admin portal (`/admin`)
Dashboard, Field Agents, Applications, Cooperatives, Farmers, Credit Scoring, Financing,
**Partners**, Benchmarks, Wallets & Settlements, Activity Log, Settings.

### Partner onboarding (admin-controlled)
`Partners → Add partner` collects org name, email, contact, **logo upload**, address, etc.
On submit the backend auto-generates a password and emails the partner their credentials.
Admin can also **reset a partner's password** (re-emails a new one) and suspend/reactivate.

## Partner portal (`/partner`)
Dashboard (stat cards + risk donut), Borrower Search, Financing Requests (+ detail/decision),
Portfolio, Risk Watchlist, and **Profile settings**.

### Partner profile (self-service)
`/partner/settings` (PartnerProfilePage) — matches the partner_screens spec:
- Editable **Organization Information** (name, Tax ID, phone, website, address) wired to
  `GET/PATCH /api/partner/organization`. Email & Partner ID are read-only.
- **Logo upload** -> `POST /api/partner/uploads/partner_logo` then auto-saves.
- **Change password** (recommended after first login).
- **Logout** modal and **Danger Zone → Delete My Account** (confirm by typing Partner ID).

## Backend endpoints this app expects (added in the matching backend drop)
- `GET  /api/partner/organization`
- `PATCH /api/partner/organization`        (partner self-edit; email not editable)
- `POST /api/partner/uploads/:kind`        (kind = partner_logo)
- `DELETE /api/partner/profile`            (self-delete)
- plus existing: `/api/partner/dashboard|search|portfolio|watchlist|financing-requests|credit/*`
- admin: `/api/admin/partners` (create with website/taxId/contactName), `/reset-password`, etc.

Run migration `004_partner_profile_fields.sql` so `partners.website / tax_id / contact_name` exist.

## Notes
- The partner object from `/auth/login` is camelCase but `/auth/me` returns the raw row;
  `src/lib/auth.js` normalises both so branding/profile never breaks on refresh.
- Design tokens in `tailwind.config.js`: forest (#2C6B47) primary, harvest (#E0A82E) accent,
  Fraunces display + DM Sans body.
