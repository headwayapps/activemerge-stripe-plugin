import {useEffect, useMemo, useState} from 'react';
import {Banner, Box, Button, Divider, Link, Select, Spinner, TextField} from '@stripe/ui-extension-sdk/ui';
import type {ExtensionContextValue} from '@stripe/ui-extension-sdk/context';

import {ActiveMergeClient, formatsFor, type Format, type GenerationJob, type Template} from '../lib/activemerge';
import {buildItems, prefillFields, splitPlaceholders, type Values} from '../lib/prefill';

type Props = {
  context: ExtensionContextValue;
  /** Stripe values for the object on this page, or null while they load. */
  values: Values | null;
  /** Line items for `{{item.X}}` tables (invoices only). */
  lineItems?: Values[];
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

export default function GenerateDocument({context, values, lineItems = []}: Props) {
  const client = useMemo(
    () => new ActiveMergeClient(context.environment.constants?.API_BASE as string),
    [context.environment.constants],
  );

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [itemColumns, setItemColumns] = useState<string[]>([]);
  const [format, setFormat] = useState<Format>('pdf');
  const [loadingFields, setLoadingFields] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client.templates().then(setTemplates).catch((e) => setError(errorMessage(e)));
  }, [client]);

  const selectTemplate = async (id: string) => {
    const selected = templates?.find((t) => t.unique_id === id) ?? null;
    setTemplate(selected);
    setFormat('pdf');
    setJob(null);
    setError(null);
    setFields({});
    setItemColumns([]);
    if (!selected) return;

    setLoadingFields(true);
    try {
      const split = splitPlaceholders(await client.placeholders(selected.unique_id));
      setFields(prefillFields(split.fields, values ?? {}));
      setItemColumns(split.itemColumns);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingFields(false);
    }
  };

  const generate = async () => {
    if (!template) return;
    setGenerating(true);
    setJob(null);
    setError(null);
    try {
      const result = await client.generate(template.unique_id, fields, buildItems(itemColumns, lineItems), format);
      if (result.status === 'completed') {
        setJob(result);
      } else if (result.status === 'in_progress') {
        setError('ActiveMerge is still generating this document. Check your ActiveMerge history in a minute.');
      } else {
        setError(result.error_message ?? 'ActiveMerge could not generate the document.');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  if (!templates && !error) {
    return <Spinner />;
  }

  return (
    <Box css={{stack: 'y', gap: 'medium'}}>
      {error && <Banner type="critical" title={error} />}

      {templates && templates.length === 0 && (
        <Banner
          title="No templates yet"
          description="Upload a template in ActiveMerge, then come back here."
          actions={<Link href="https://app.activemerge.com" target="_blank" external>Open ActiveMerge</Link>}
        />
      )}

      {templates && templates.length > 0 && (
        <Select label="Template" value={template?.unique_id ?? ''} onChange={(e) => selectTemplate(e.target.value)}>
          <option value="">Choose a template</option>
          {templates.map((t) => (
            <option key={t.unique_id} value={t.unique_id}>{t.name}</option>
          ))}
        </Select>
      )}

      {loadingFields && <Spinner />}

      {template && !loadingFields && (
        <>
          {Object.keys(fields).map((name) => (
            <TextField
              key={`${template.unique_id}:${name}`}
              label={name}
              value={fields[name]}
              onChange={(e) => setFields((prev) => ({...prev, [name]: e.target.value}))}
            />
          ))}

          {itemColumns.length > 0 && (
            <Box css={{font: 'caption', color: 'secondary'}}>
              {lineItems.length > 0
                ? `${lineItems.length} line item(s) will fill the table columns: ${itemColumns.join(', ')}.`
                : `This template has a line-item table (${itemColumns.join(', ')}), which only fills from an invoice.`}
            </Box>
          )}

          <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
            {formatsFor(template).map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </Select>

          <Button type="primary" css={{width: 'fill'}} disabled={generating} onPress={generate}>
            {generating ? 'Generating…' : 'Generate document'}
          </Button>
        </>
      )}

      {job?.download_url && (
        <>
          <Divider />
          <Banner
            type="default"
            title="Your document is ready"
            description="The download link stays valid for 72 hours."
            actions={<Link href={job.download_url} target="_blank" external>Download</Link>}
          />
        </>
      )}
    </Box>
  );
}
