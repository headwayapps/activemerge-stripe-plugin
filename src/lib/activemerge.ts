import {findApiKey} from './stripe';

// Shapes returned by the ActiveMerge API (see app/Http/Controllers/Api in activemergev2).
export type Template = {
  unique_id: string;
  name: string;
  path: string;
};

export type Format = 'pdf' | 'docx' | 'pptx' | 'xlsx';

export type GenerationJob = {
  job_id: string;
  status: 'in_progress' | 'completed' | 'failed' | 'expired';
  error_message?: string | null;
  download_url?: string | null;
};

export class ActiveMergeError extends Error {}

export class ActiveMergeClient {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<{status: number; body: T}> {
    const apiKey = await findApiKey();
    if (!apiKey) {
      throw new ActiveMergeError('Add your ActiveMerge API key in the app settings first.');
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'API-KEY': apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    const body = await res.json().catch(() => ({}));

    if (res.status === 401) {
      throw new ActiveMergeError('ActiveMerge rejected the API key. Check it in the app settings.');
    }
    if (!res.ok) {
      throw new ActiveMergeError(body.message ?? body.error ?? `ActiveMerge returned HTTP ${res.status}.`);
    }

    return {status: res.status, body};
  }

  async templates(): Promise<Template[]> {
    return (await this.request<Template[]>('/templates')).body;
  }

  async placeholders(templateId: string): Promise<string[]> {
    // The endpoint returns `false` when the template file can't be read.
    const {body} = await this.request<string[] | false>(`/templates/${encodeURIComponent(templateId)}/placeholders`);
    if (!Array.isArray(body)) {
      throw new ActiveMergeError('ActiveMerge could not read this template.');
    }
    return body;
  }

  async status(jobId: string): Promise<GenerationJob> {
    return (await this.request<GenerationJob>(`/document-generation/status/${encodeURIComponent(jobId)}`)).body;
  }

  /**
   * Generate a document and wait for it to finish. `wait: true` makes the API hold the
   * request for up to 25s; if the job is still running we poll the status endpoint.
   */
  async generate(
    templateId: string,
    data: Record<string, string>,
    items: Record<string, string>[],
    format: Format,
  ): Promise<GenerationJob> {
    let {body: job} = await this.request<GenerationJob>('/document-generation/generate', {
      method: 'POST',
      body: JSON.stringify({template_id: templateId, data, items, format, wait: true}),
    });

    for (let attempt = 0; job.status === 'in_progress' && attempt < 40; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      job = await this.status(job.job_id);
    }

    return job;
  }
}

/** Output formats a template can be generated in: PDF, or its own file type. */
export function formatsFor(template: Template): Format[] {
  const ext = template.path.split('.').pop()?.toLowerCase();
  return ext === 'docx' || ext === 'pptx' || ext === 'xlsx' ? ['pdf', ext] : ['pdf'];
}
