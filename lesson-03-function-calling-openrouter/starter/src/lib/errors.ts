export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class DocumentAiError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DocumentAiError";
  }
}

export function createApiError(code: string, message: string, details?: unknown): ApiErrorResponse {
  return {
    error: details === undefined ? { code, message } : { code, message, details },
  };
}
