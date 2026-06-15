
## 1. Seasonal yield — endpoint already exists

You can record yield per year/season here:

```
POST /api/agent/productions
Authorization: Bearer <token>
Content-Type: application/json

{
  "farmerId":              "<uuid>",       // required
  "season":                "wet_2026",     // required — your label, e.g. "wet_2026", "dry_2025"
  "crop":                  "Cassava",      // required
  "cycleNumber":           1,              // default 1
  "expectedPlantingDate":  "2026-03-01",   // optional
  "expectedHarvestDate":   "2026-10-15",   // optional
  "expectedYieldTonnes":   8.0,            // optional
  "actualYieldTonnes":     7.2,            // optional — set this at harvest
  "benchmarkYieldTonnes":  9.0,            // optional — set by extension officer/coop
  "notes":                 "Late rains, replanted twice"  // optional
}
```

**Why it didn't look like it existed:** the path is `/productions`, not
`/seasonal-yield`. The naming is a bit different but the table behind it is
exactly `seasonal_productions`, so production = seasonal yield record.

**Behaviour:**
- If you include `actualYieldTonnes`, the system computes `yieldRatio` and
  recalculates the farmer's credit score automatically (yield is the
  Production Score input from the credit spec).
- If you only have planting details at the start of the season, omit the
  actual/benchmark fields and PATCH them via a second POST when harvest data
  comes in (it'll create another row; we don't UPDATE — each cycle is its
  own record so the history shows growth over time).

Listed at `GET /api/agent/productions?farmerId=...` (you already saw this
endpoint — that's the GET part of the same resource).

Partner-side reading the data: `GET /api/partner/credit/farmer/:farmerId`
returns `seasonalProductions: [...]` so the farmer-profile screen can chart it.

---

## 2. Bank account — saved on profile (NEW)

Two endpoints so the agent doesn't have to retype bank details on every
settlement request. The settlement endpoint still accepts bank fields per
request (so they can override), but you can pre-fill from these.

**Get the saved default:**
```
GET /api/agent/bank-account
Authorization: Bearer <token>

→ 200
{ "success": true,
  "data": {
    "bankName":      "GTBank" | null,
    "accountNumber": "0123456789" | null,
    "accountName":   "Peters Damilare" | null
  }
}
```

Returns null fields if the agent hasn't saved one yet — show an empty form,
not an error.

**Save / update the default:**
```
PUT /api/agent/bank-account
Authorization: Bearer <token>
Content-Type: application/json

{
  "bankName":      "GTBank",            // required, 2-120 chars
  "accountNumber": "0123456789",        // required, exactly 10 digits
  "accountName":   "Peters Damilare"    // required, 2-120 chars
}
```

All three fields are required together (an account with any one missing is
meaningless). Same validation rules as the settlement form.

**Suggested settlement-form UX:**
1. Page open → `GET /agent/bank-account`
2. Pre-fill the bank fields if non-null
3. User can edit them before submitting
4. (Optional) Add a "save as default" checkbox that does a `PUT` first
5. Submit settlement via the unchanged `POST /agent/wallet/settlements`

---
