import {Banner, Box, Button, Spinner} from '@stripe/ui-extension-sdk/ui';
import type {ExtensionContextValue} from '@stripe/ui-extension-sdk/context';

import {useActiveMerge} from '../lib/useActiveMerge';
import ConnectPrompt from './ConnectPrompt';

/** Connect / disconnect controls shared by the drawer home view and the settings page. */
export default function ConnectionStatus({context}: {context: ExtensionContextValue}) {
  const {status, connectUrl, error, signOut} = useActiveMerge(context);

  if (status === 'loading') return <Spinner />;
  if (status === 'disconnected') return <ConnectPrompt connectUrl={connectUrl} error={error} />;

  return (
    <Box css={{stack: 'y', gap: 'medium'}}>
      <Banner
        type="default"
        title="ActiveMerge is connected"
        description="Open a customer or invoice to generate a document from it."
      />
      <Button onPress={signOut}>Disconnect</Button>
    </Box>
  );
}
