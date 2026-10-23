import {Banner, Box, Button} from '@stripe/ui-extension-sdk/ui';

type Props = {connectUrl: string | null; error?: string | null};

export default function ConnectPrompt({connectUrl, error}: Props) {
  return (
    <Box css={{stack: 'y', gap: 'medium'}}>
      {error && <Banner type="critical" title={error} />}
      <Box css={{stack: 'y', gap: 'small'}}>
        <Box css={{font: 'heading'}}>Connect ActiveMerge</Box>
        <Box css={{font: 'body', color: 'secondary'}}>
          Sign in to ActiveMerge to fill your document templates with Stripe customers and invoices.
        </Box>
      </Box>
      <Button type="primary" css={{width: 'fill'}} href={connectUrl ?? undefined} target="_blank" disabled={!connectUrl}>
        Connect ActiveMerge
      </Button>
      <Box css={{font: 'caption', color: 'secondary'}}>
        No account yet? You can create one on the sign-in page.
      </Box>
    </Box>
  );
}
