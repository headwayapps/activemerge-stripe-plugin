import {useEffect, useState} from 'react';
import {ContextView} from '@stripe/ui-extension-sdk/ui';
import type {ExtensionContextValue} from '@stripe/ui-extension-sdk/context';

import GenerateDocument from '../components/GenerateDocument';
import {stripe} from '../lib/stripe';
import {customerValues, type Values} from '../lib/prefill';

const CustomerDetail = (context: ExtensionContextValue) => {
  const customerId = context.environment.objectContext?.id;
  const [values, setValues] = useState<Values | null>(null);

  useEffect(() => {
    if (!customerId) return;
    stripe.customers
      .retrieve(customerId)
      .then((c) => setValues(c.deleted ? {} : customerValues(c)))
      .catch(() => setValues({}));
  }, [customerId]);

  return (
    <ContextView
      title="Generate a document"
      description="Fill an ActiveMerge template with this customer's details."
      externalLink={{label: 'Open ActiveMerge', href: 'https://app.activemerge.com'}}
    >
      <GenerateDocument context={context} values={values} />
    </ContextView>
  );
};

export default CustomerDetail;
