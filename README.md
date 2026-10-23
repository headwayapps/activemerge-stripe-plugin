# ActiveMerge for Stripe

A [Stripe App](https://docs.stripe.com/stripe-apps) for the Stripe App Marketplace. It adds an
ActiveMerge panel to the Stripe Dashboard's **customer** and **invoice** pages: pick an ActiveMerge
template, review the fields (prefilled from Stripe), and generate a PDF/DOCX/PPTX/XLSX.

## How it works

| Piece | File |
| --- | --- |
| Manifest (permissions, viewports, CSP, constants) | `stripe-app.json` |
| OAuth sign-in (PKCE), token storage and refresh | `src/lib/auth.ts`, `src/lib/useActiveMerge.ts` |
| ActiveMerge API client | `src/lib/activemerge.ts` |
| Stripe Secret Store helpers | `src/lib/stripe.ts` |
| Stripe → template field mapping | `src/lib/prefill.ts` |
| Drawer home and settings page (connect / disconnect) | `src/views/Home.tsx`, `src/views/AppSettings.tsx` |
| Customer / invoice panels | `src/views/CustomerDetail.tsx`, `src/views/InvoiceDetail.tsx` |

### Sign-in

Users click **Connect ActiveMerge**, approve access on ActiveMerge's consent screen, and Stripe brings them
back to the app. This follows Stripe's [PKCE OAuth flow](https://docs.stripe.com/stripe-apps/pkce-oauth-flow):

- Authorize: `GET {AUTH_BASE}/oauth/authorize` with scopes `templates:read documents:read documents:generate`,
  redirecting to `https://dashboard.stripe.com[/test]/apps-oauth/{APP_ID}`.
- Token exchange and refresh: `POST {AUTH_BASE}/oauth/token` (public client, no secret).
- Tokens live in the Secret Store **per Dashboard user**. Access tokens last 1 hour and refresh automatically;
  a refresh token unused for 30 days means the user has to connect again.

### ActiveMerge endpoints

All are OAuth-only routes under `/api/stripe-app` that accept only tokens issued to the Stripe App's client:

- `GET /templates` returns templates; `unique_id` is the id to generate with.
- `GET /templates/{unique_id}/placeholders` returns placeholder names; `item.*` names are line-item table columns.
- `POST /document-generation/generate` with `{template_id, data, items, format, wait: true}`, which returns the finished job (`download_url`) or `202 {job_id}`.
- `GET /document-generation/status/{job_id}`: polled every 3s if the job is still running.

Only the template's own placeholders are sent in `data`, because ActiveMerge rejects extra keys.

### Prefilled placeholder names

Matching ignores case, spaces, `_` and `-` (`{Customer Name}` = `{customer_name}` = `{CustomerName}`).

- **Customer page:** `customer_id`, `customer_name`, `customer_email`, `customer_phone`, `customer_description`,
  `customer_address`, `customer_address_line1`, `customer_address_line2`, `customer_city`, `customer_state`,
  `customer_postal_code`, `customer_country`, plus `name`, `email`, `phone`, `address`.
- **Invoice page:** `invoice_id`, `invoice_number`, `invoice_status`, `invoice_date`, `invoice_due_date`,
  `invoice_currency`, `invoice_subtotal`, `invoice_tax`, `invoice_total`, `invoice_amount_due`,
  `invoice_amount_paid`, `invoice_url`, `invoice_pdf`, `customer_name`, `customer_email`, `customer_phone`,
  `customer_address`, plus `name`, `email`, `phone`, `address`.
- **Invoice line items** (`{{item.X}}` table rows): `description`, `quantity`, `unit_price`, `amount`, `total`,
  `currency`, `period_start`, `period_end`.

Anything else is shown as an empty field the user can fill in.

## Develop

```bash
npm install
npm run typecheck && npm run lint && npm test
stripe login
stripe apps start        # preview in your Stripe sandbox
```

Open the app drawer in the Dashboard and click **Connect ActiveMerge**.
To point at a local ActiveMerge, create `stripe-app.dev.json` with `"extends": "stripe-app.json"`, override
`constants.AUTH_BASE`, `constants.API_BASE`, `constants.OAUTH_CLIENT_ID` and
`ui_extension.content_security_policy.connect-src`, and run `stripe apps start --manifest stripe-app.dev.json`.

## One-time setup in ActiveMerge

1. Deploy the ActiveMerge backend changes that add `/api/stripe-app`, CORS on `/oauth/token`, and the
   `stripe-app:oauth-client` command.
2. On the server: `php artisan stripe-app:oauth-client`. It registers both Dashboard redirect URLs and prints
   `STRIPE_APP_OAUTH_CLIENT_ID=...`. Add that to the server `.env` and reload config.
3. Put the same ID in `stripe-app.json` → `constants.OAUTH_CLIENT_ID`.

## Before submitting to the Marketplace

- [ ] Add `icon.png` (300×300 PNG) at the project root. The manifest already points to it.
- [ ] Support URL and privacy policy URL for the listing.
- [ ] `stripe apps upload`, install the uploaded version in a sandbox, test, then submit for review in the Dashboard.
