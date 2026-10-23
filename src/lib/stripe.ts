import Stripe from 'stripe';
import {createHttpClient, STRIPE_API_KEY} from '@stripe/ui-extension-sdk/http_client';

// Requests are authenticated with the Dashboard user's session, so no key is needed here.
export const stripe = new Stripe(STRIPE_API_KEY, {
  httpClient: createHttpClient() as Stripe.HttpClient,
  apiVersion: '2025-02-24.acacia',
});

// One ActiveMerge key per Stripe account, shared by every Dashboard user of that account.
const SECRET_NAME = 'activemerge_api_key';
const SCOPE = {type: 'account' as const};

export async function saveApiKey(apiKey: string): Promise<void> {
  await stripe.apps.secrets.create({scope: SCOPE, name: SECRET_NAME, payload: apiKey});
}

export async function deleteApiKey(): Promise<void> {
  await stripe.apps.secrets.deleteWhere({scope: SCOPE, name: SECRET_NAME});
}

export async function findApiKey(): Promise<string | null> {
  try {
    const secret = await stripe.apps.secrets.find({scope: SCOPE, name: SECRET_NAME, expand: ['payload']});
    return secret.payload ?? null;
  } catch {
    // The Secret Store returns 404 when no key has been saved yet.
    return null;
  }
}
