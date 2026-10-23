# ActiveMerge for Stripe

A [Stripe App](https://docs.stripe.com/stripe-apps) for the Stripe App Marketplace. It adds an
ActiveMerge panel to the Stripe Dashboard's **customer** and **invoice** pages: pick an ActiveMerge
template, review the fields (prefilled from Stripe), and generate a PDF/DOCX/PPTX/XLSX.

## How it works

| Piece | File |
| --- | --- |
| Manifest (permissions, viewports, CSP, `API_BASE`) | `stripe-app.json` |
| ActiveMerge API client | `src/lib/activemerge.ts` |
| API key storage (Stripe Secret Store, account scope) | `src/lib/stripe.ts` |
| Stripe → template field mapping | `src/lib/prefill.ts` |
| Settings page (paste API key) | `src/views/AppSettings.tsx` |
| Customer / invoice panels | `src/views/CustomerDetail.tsx`, `src/views/InvoiceDetail.tsx` |

ActiveMerge endpoints used (all with the `API-KEY` header):

- `GET /api/templates` returns templates; `unique_id` is the id to generate with.
- `GET /api/templates/{unique_id}/placeholders` returns placeholder names; `item.*` names are line-item table columns.
- `POST /api/document-generation/generate` with `{template_id, data, items, format, wait: true}`, which returns the finished job (`download_url`) or `202 {job_id}`.
- `GET /api/document-generation/status/{job_id}`: polled every 3s if the job is still running.

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

Preview the settings page at https://dashboard.stripe.com/apps/settings-preview and paste an ActiveMerge API key.
To point at a local ActiveMerge, create `stripe-app.dev.json` with `"extends": "stripe-app.json"`, override
`constants.API_BASE` and `ui_extension.content_security_policy.connect-src`, and run
`stripe apps start --manifest stripe-app.dev.json`.

## Before submitting to the Marketplace

- [ ] Add `icon.png` (300×300 PNG) at the project root. The manifest already points to it.
- [ ] Support URL and privacy policy URL for the listing.
- [ ] `stripe apps upload`, install the uploaded version in a sandbox, test, then submit for review in the Dashboard.
