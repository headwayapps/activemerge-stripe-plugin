import {useEffect, useState} from 'react';
import {ContextView} from '@stripe/ui-extension-sdk/ui';
import type {ExtensionContextValue} from '@stripe/ui-extension-sdk/context';

import GenerateDocument from '../components/GenerateDocument';
import {stripe} from '../lib/stripe';
import {invoiceValues, lineItemValues, type Values} from '../lib/prefill';

const InvoiceDetail = (context: ExtensionContextValue) => {
  const invoiceId = context.environment.objectContext?.id;
  const [values, setValues] = useState<Values | null>(null);
  const [lineItems, setLineItems] = useState<Values[]>([]);

  useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      // `invoice.lines` holds only the first page, so page through all of them.
      const lines = await stripe.invoices.listLineItems(invoiceId, {limit: 100}).autoPagingToArray({limit: 1000});
      setValues(invoiceValues(invoice));
      setLineItems(lines.map((line) => lineItemValues(line, invoice.currency)));
    })().catch(() => setValues({}));
  }, [invoiceId]);

  return (
    <ContextView
      title="Generate a document"
      description="Fill an ActiveMerge template with this invoice and its line items."
      externalLink={{label: 'Open ActiveMerge', href: 'https://app.activemerge.com'}}
    >
      <GenerateDocument context={context} values={values} lineItems={lineItems} />
    </ContextView>
  );
};

export default InvoiceDetail;
