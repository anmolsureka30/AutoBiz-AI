export interface HttpAgentConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    backoffFactor: number;
    statusCodesToRetry: number[];
  };
  validateStatus?: (status: number) => boolean;
}

export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  timing: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export interface HttpError extends Error {
  response?: HttpResponse;
  request?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  code?: string;
} 