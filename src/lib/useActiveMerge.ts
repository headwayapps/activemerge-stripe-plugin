import {useCallback, useEffect, useMemo, useState} from 'react';
import type {ExtensionContextValue} from '@stripe/ui-extension-sdk/context';

import {ActiveMergeClient} from './activemerge';
import {authConfig, authorizationUrl, completeAuthorization, disconnect, loadTokens} from './auth';

export type ConnectionStatus = 'loading' | 'connected' | 'disconnected';

/**
 * Connection state for the current Dashboard user. Any view may be the one
 * Stripe opens after the user approves access in ActiveMerge, so every view
 * uses this hook and finishes the sign-in when `oauthContext` carries a code.
 */
export function useActiveMerge({environment, userContext, oauthContext}: ExtensionContextValue) {
  const config = useMemo(() => authConfig(environment), [environment]);
  // Typed optional by the SDK, but always set inside the Dashboard.
  const userId = userContext.id ?? '';
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const code = oauthContext?.code;
  const verifier = oauthContext?.verifier;
  const oauthError = oauthContext?.error;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (oauthError) {
        setError(oauthError === 'access_denied' ? 'ActiveMerge access was not approved.' : `ActiveMerge sign-in failed (${oauthError}).`);
      } else if (code && verifier) {
        try {
          await completeAuthorization(config, userId, code, verifier);
        } catch (e) {
          // Another open view may have used this code first; only report it if we're still signed out.
          if (!(await loadTokens(userId))) {
            setError(e instanceof Error ? e.message : 'ActiveMerge sign-in failed.');
          }
        }
      }
      const connected = (await loadTokens(userId)) !== null;
      if (!cancelled) setStatus(connected ? 'connected' : 'disconnected');
    })();
    return () => {
      cancelled = true;
    };
  }, [config, userId, code, verifier, oauthError]);

  useEffect(() => {
    if (status === 'disconnected') {
      authorizationUrl(config).then(setConnectUrl);
    }
  }, [config, status]);

  const client = useMemo(
    () => new ActiveMergeClient((environment.constants as Record<string, string>).API_BASE, config, userId),
    [environment.constants, config, userId],
  );

  const signOut = useCallback(async () => {
    await disconnect(userId);
    setStatus('disconnected');
  }, [userId]);

  const markDisconnected = useCallback(() => setStatus('disconnected'), []);

  return {status, connectUrl, error, client, signOut, markDisconnected};
}
