import {createOAuthState} from '@stripe/ui-extension-sdk/oauth';
import type {ExtensionContextValue} from '@stripe/ui-extension-sdk/context';

import {deleteSecret, findSecret, saveSecret} from './stripe';

/**
 * Sign-in with ActiveMerge using OAuth 2 authorization code + PKCE, run entirely
 * in the Dashboard as described in https://docs.stripe.com/stripe-apps/pkce-oauth-flow.
 * Tokens are stored per Dashboard user in Stripe's Secret Store.
 */

export const SCOPES = ['templates:read', 'documents:read', 'documents:generate'];

const SECRET_NAME = 'activemerge_oauth';
// Refresh a little before expiry so a request never goes out with a dying token.
const EXPIRY_MARGIN_MS = 60_000;

type Environment = ExtensionContextValue['environment'];

export type Tokens = {
  access_token: string;
  refresh_token: string;
  /** Epoch milliseconds. */
  expires_at: number;
};

export class NotConnectedError extends Error {
  constructor() {
    super('Connect your ActiveMerge account to continue.');
  }
}

export type AuthConfig = {
  authBase: string;
  clientId: string;
  appId: string;
  mode: 'live' | 'test';
};

export function authConfig(environment: Environment): AuthConfig {
  const constants = (environment.constants ?? {}) as Record<string, string>;
  return {
    authBase: constants.AUTH_BASE,
    clientId: constants.OAUTH_CLIENT_ID,
    appId: constants.APP_ID,
    mode: environment.mode,
  };
}

/** The fixed Dashboard URL Stripe sends the user back to after they approve access. */
export function redirectUri({appId, mode}: AuthConfig): string {
  return `https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}apps-oauth/${appId}`;
}

export async function authorizationUrl(config: AuthConfig): Promise<string> {
  const {state, challenge} = await createOAuthState();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri(config),
    scope: SCOPES.join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return `${config.authBase}/oauth/authorize?${params}`;
}

async function requestTokens(config: AuthConfig, params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${config.authBase}/oauth/token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json'},
    body: new URLSearchParams({client_id: config.clientId, ...params}).toString(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.message ?? 'ActiveMerge sign-in failed.');
  }
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    expires_at: Date.now() + Number(body.expires_in) * 1000,
  };
}

export async function loadTokens(userId: string): Promise<Tokens | null> {
  const payload = await findSecret(userId, SECRET_NAME);
  if (!payload) return null;
  try {
    return JSON.parse(payload) as Tokens;
  } catch {
    return null;
  }
}

const saveTokens = (userId: string, tokens: Tokens) => saveSecret(userId, SECRET_NAME, JSON.stringify(tokens));

export const disconnect = (userId: string) => deleteSecret(userId, SECRET_NAME);

/** Exchanges the code Stripe hands back in `oauthContext` for tokens and stores them. */
export async function completeAuthorization(
  config: AuthConfig,
  userId: string,
  code: string,
  verifier: string,
): Promise<void> {
  const tokens = await requestTokens(config, {
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: redirectUri(config),
  });
  await saveTokens(userId, tokens);
}

/**
 * Returns a usable access token, refreshing it when it's about to expire.
 * ActiveMerge rotates refresh tokens, so if another open view refreshed first
 * our refresh fails; in that case use the tokens it saved.
 */
export async function getAccessToken(config: AuthConfig, userId: string): Promise<string> {
  const tokens = await loadTokens(userId);
  if (!tokens) throw new NotConnectedError();
  if (tokens.expires_at - EXPIRY_MARGIN_MS > Date.now()) return tokens.access_token;

  try {
    const fresh = await requestTokens(config, {
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      scope: SCOPES.join(' '),
    });
    await saveTokens(userId, fresh);
    return fresh.access_token;
  } catch {
    const latest = await loadTokens(userId);
    if (latest && latest.refresh_token !== tokens.refresh_token && latest.expires_at - EXPIRY_MARGIN_MS > Date.now()) {
      return latest.access_token;
    }
    // The refresh token expired (30 days unused) or was revoked: sign in again.
    await disconnect(userId);
    throw new NotConnectedError();
  }
}
