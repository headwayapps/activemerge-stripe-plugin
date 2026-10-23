import type Stripe from 'stripe';

/**
 * Stripe values keyed by a normalised field name. A template placeholder is prefilled
 * when its normalised name matches one of these keys, so `{Customer Name}`,
 * `{customer_name}` and `{CustomerName}` all receive the customer's name.
 */
export type Values = Record<string, string>;

export const normalise = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const money = (amount: number | null | undefined, currency: string) =>
  amount == null
    ? ''
    : new Intl.NumberFormat('en-US', {style: 'currency', currency: currency.toUpperCase()}).format(amount / 100);

const date = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toISOString().slice(0, 10) : '';

const address = (a: Stripe.Address | null | undefined) =>
  a ? [a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(', ') : '';

function withKeys(entries: Record<string, string | null | undefined>): Values {
  const values: Values = {};
  for (const [key, value] of Object.entries(entries)) {
    values[normalise(key)] = value ?? '';
  }
  return values;
}

export function customerValues(c: Stripe.Customer): Values {
  return withKeys({
    customer_id: c.id,
    customer_name: c.name,
    customer_email: c.email,
    customer_phone: c.phone,
    customer_description: c.description,
    customer_address: address(c.address),
    customer_address_line1: c.address?.line1,
    customer_address_line2: c.address?.line2,
    customer_city: c.address?.city,
    customer_state: c.address?.state,
    customer_postal_code: c.address?.postal_code,
    customer_country: c.address?.country,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: address(c.address),
  });
}

export function invoiceValues(inv: Stripe.Invoice): Values {
  return withKeys({
    invoice_id: inv.id,
    invoice_number: inv.number,
    invoice_status: inv.status,
    invoice_date: date(inv.created),
    invoice_due_date: date(inv.due_date),
    invoice_currency: inv.currency.toUpperCase(),
    invoice_subtotal: money(inv.subtotal, inv.currency),
    invoice_tax: money(inv.tax, inv.currency),
    invoice_total: money(inv.total, inv.currency),
    invoice_amount_due: money(inv.amount_due, inv.currency),
    invoice_amount_paid: money(inv.amount_paid, inv.currency),
    invoice_url: inv.hosted_invoice_url,
    invoice_pdf: inv.invoice_pdf,
    customer_name: inv.customer_name,
    customer_email: inv.customer_email,
    customer_phone: inv.customer_phone,
    customer_address: address(inv.customer_address),
    name: inv.customer_name,
    email: inv.customer_email,
    phone: inv.customer_phone,
    address: address(inv.customer_address),
  });
}

export function lineItemValues(line: Stripe.InvoiceLineItem, currency: string): Values {
  const quantity = line.quantity ?? 1;
  return withKeys({
    description: line.description,
    quantity: String(quantity),
    unit_price: money(quantity ? Math.round(line.amount / quantity) : line.amount, currency),
    amount: money(line.amount, currency),
    total: money(line.amount, currency),
    currency: currency.toUpperCase(),
    period_start: date(line.period?.start),
    period_end: date(line.period?.end),
  });
}

/** Splits template placeholders into document fields and `{{item.X}}` line-item columns. */
export function splitPlaceholders(placeholders: string[]) {
  const fields: string[] = [];
  const itemColumns: string[] = [];
  for (const p of new Set(placeholders)) {
    if (p.startsWith('item.')) {
      itemColumns.push(p.slice('item.'.length));
    } else {
      fields.push(p);
    }
  }
  return {fields, itemColumns};
}

/** Initial value for each template field, empty when Stripe has nothing that matches. */
export function prefillFields(fields: string[], values: Values): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f, values[normalise(f)] ?? '']));
}

/**
 * One row per Stripe line item, keyed the way ActiveMerge's template processor reads
 * `{{item.Column Name}}` (spaces become underscores).
 */
export function buildItems(itemColumns: string[], rows: Values[]): Record<string, string>[] {
  return rows.map((row) =>
    Object.fromEntries(itemColumns.map((col) => [col.trim().replace(/[\s-]+/g, '_'), row[normalise(col)] ?? ''])),
  );
}
