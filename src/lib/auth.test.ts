import {authorizationUrl, getAccessToken, NotConnectedError, redirectUri, type AuthConfig, type Tokens} from './auth';

jest.mock('@stripe/ui-extension-sdk/oauth', () => ({
  createOAuthState: jest.fn(async () => ({state: 'state123', challenge: 'challenge456'})),
}));

const secrets = new Map<string, string>();
jest.mock('./stripe', () => ({
  findSecret: jest.fn(async (user: string, name: string) => secrets.get(`${user}:${name}`) ?? null),
  saveSecret: jest.fn(async (user: string, name: string, payload: string) => {
    secrets.set(`${user}:${name}`, payload);
  }),
  deleteSecret: jest.fn(async (user: string, name: string) => {
    secrets.delete(`${user}:${name}`);
  }),
}));

const config: AuthConfig = {
  authBase: 'https://app.activemerge.com',
  clientId: 'client-1',
  appId: 'com.activemerge.app',
  mode: 'test',
};

const storeTokens = (tokens: Tokens) => secrets.set('usr_1:activemerge_oauth', JSON.stringify(tokens));
const storedTokens = () => JSON.parse(secrets.get('usr_1:activemerge_oauth') ?? 'null') as Tokens | null;

const mockFetch = (status: number, body: object) => {
  const fn = jest.fn(async () => ({ok: status < 400, status, json: async () => body}));
  global.fetch = fn as unknown as typeof fetch;
  return fn;
};

beforeEach(() => secrets.clear());

describe('redirectUri', () => {
  it('uses the sandbox path in test mode and the live path otherwise', () => {
    expect(redirectUri(config)).toBe('https://dashboard.stripe.com/test/apps-oauth/com.activemerge.app');
    expect(redirectUri({...config, mode: 'live'})).toBe('https://dashboard.stripe.com/apps-oauth/com.activemerge.app');
  });
});

describe('authorizationUrl', () => {
  it('builds a PKCE authorization request', async () => {
    const url = new URL(await authorizationUrl(config));
    expect(url.origin + url.pathname).toBe('https://app.activemerge.com/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-1',
      redirect_uri: 'https://dashboard.stripe.com/test/apps-oauth/com.activemerge.app',
      scope: 'templates:read documents:read documents:generate',
      state: 'state123',
      code_challenge: 'challenge456',
      code_challenge_method: 'S256',
    });
  });
});

describe('getAccessToken', () => {
  it('throws when the user has not connected', async () => {
    await expect(getAccessToken(config, 'usr_1')).rejects.toBeInstanceOf(NotConnectedError);
  });

  it('returns a token that is still valid without refreshing', async () => {
    storeTokens({access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() + 3_600_000});
    const fetch = mockFetch(200, {});
    await expect(getAccessToken(config, 'usr_1')).resolves.toBe('a1');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes an expiring token and stores the rotated tokens', async () => {
    storeTokens({access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() + 10_000});
    const fetch = mockFetch(200, {access_token: 'a2', refresh_token: 'r2', expires_in: 3600});

    await expect(getAccessToken(config, 'usr_1')).resolves.toBe('a2');
    expect(storedTokens()?.refresh_token).toBe('r2');
    const body = new URLSearchParams((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('r1');
    expect(body.get('client_id')).toBe('client-1');
  });

  it('signs the user out when the refresh token is no longer valid', async () => {
    storeTokens({access_token: 'a1', refresh_token: 'r1', expires_at: Date.now() - 1});
    mockFetch(400, {error: 'invalid_grant'});

    await expect(getAccessToken(config, 'usr_1')).rejects.toBeInstanceOf(NotConnectedError);
    expect(storedTokens()).toBeNull();
  });
});
