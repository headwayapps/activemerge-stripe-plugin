import {ContextView} from '@stripe/ui-extension-sdk/ui';
import type {ExtensionContextValue} from '@stripe/ui-extension-sdk/context';

import ConnectionStatus from '../components/ConnectionStatus';

const Home = (context: ExtensionContextValue) => (
  <ContextView title="ActiveMerge" externalLink={{label: 'Open ActiveMerge', href: 'https://app.activemerge.com'}}>
    <ConnectionStatus context={context} />
  </ContextView>
);

export default Home;
