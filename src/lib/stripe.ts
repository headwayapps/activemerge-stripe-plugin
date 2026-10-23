import Stripe from 'stripe';
import {createHttpClient, STRIPE_API_KEY} from '@stripe/ui-extension-sdk/http_client';

// Requests are authenticated with the Dashboard user's session, so no key is needed here.
export const stripe = new Stripe(STRIPE_API_KEY, {
  httpClient: createHttpClient() as Stripe.HttpClient,
  apiVersion: '2025-02-24.acacia',
});

// Each Dashboard user connects their own ActiveMerge account.
const userScope = (userId: string) => ({type: 'user' as const, user: userId});

export async function saveSecret(userId: string, name: string, payload: string): Promise<void> {
  await stripe.apps.secrets.create({scope: userScope(userId), name, payload});
}

export async function deleteSecret(userId: string, name: string): Promise<void> {
  await stripe.apps.secrets.deleteWhere({scope: userScope(userId), name});
}

export async function findSecret(userId: string, name: string): Promise<string | null> {
  try {
    const secret = await stripe.apps.secrets.find({scope: userScope(userId), name, expand: ['payload']});
    return secret.payload ?? null;
  } catch {
    // The Secret Store returns 404 when nothing has been saved yet.
    return null;
  }
}
