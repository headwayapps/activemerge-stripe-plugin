import {useEffect, useState} from 'react';
import {Banner, Box, Button, SettingsView, Spinner, TextField} from '@stripe/ui-extension-sdk/ui';
import type {ExtensionContextValue} from '@stripe/ui-extension-sdk/context';

import {ActiveMergeClient} from '../lib/activemerge';
import {deleteApiKey, findApiKey, saveApiKey} from '../lib/stripe';

const AppSettings = ({environment}: ExtensionContextValue) => {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    findApiKey().then((key) => setHasKey(key !== null));
  }, []);

  const save = async () => {
    setError(null);
    setStatus(undefined);
    if (!apiKey.trim()) {
      setError('Enter your ActiveMerge API key.');
      return;
    }
    try {
      await saveApiKey(apiKey.trim());
      // Confirm the key works before telling the user it's saved.
      await new ActiveMergeClient(environment.constants?.API_BASE as string).templates();
      setHasKey(true);
      setApiKey('');
      setStatus('Saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the API key.');
    }
  };

  const disconnect = async () => {
    await deleteApiKey();
    setHasKey(false);
    setStatus('Disconnected');
  };

  if (hasKey === null) {
    return (
      <SettingsView>
        <Spinner />
      </SettingsView>
    );
  }

  return (
    <SettingsView onSave={save} statusMessage={status}>
      <Box css={{stack: 'y', gap: 'medium'}}>
        {error && <Banner type="critical" title={error} />}
        {hasKey && (
          <Banner
            title="Connected to ActiveMerge"
            description="Enter a new key below to replace the current one."
            actions={<Button onPress={disconnect}>Disconnect</Button>}
          />
        )}
        <TextField
          label="ActiveMerge API key"
          description="Shared by everyone on this Stripe account."
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </Box>
    </SettingsView>
  );
};

export default AppSettings;
