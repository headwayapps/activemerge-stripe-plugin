import {SettingsView} from '@stripe/ui-extension-sdk/ui';
import type {ExtensionContextValue} from '@stripe/ui-extension-sdk/context';

import ConnectionStatus from '../components/ConnectionStatus';

const AppSettings = (context: ExtensionContextValue) => (
  <SettingsView>
    <ConnectionStatus context={context} />
  </SettingsView>
);

export default AppSettings;
