import { ToolError } from "./tool-errors.js";
import type { ToolErrorCode } from "./tool-errors.js";

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

export interface RetryEvent {
  operationName: string;
  attempt: number;
  delayMs: number;
  code: ToolErrorCode;
}

export interface RetryDependencies {
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  onRetry?: (event: RetryEvent) => void;
}

export function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number,
): number {
  const exponentialDelay = baseDelayMs * 2 ** (attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  const jitter = random() * cappedDelay * 0.2;

  return cappedDelay + jitter;
}

export function normalizeRetryError(
  error: unknown,
  operationName: string,
  timeoutMs: number,
): ToolError {
  if (error instanceof ToolError) {
    return error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new ToolError(
      "UPSTREAM_TIMEOUT",
      `Операцію "${operationName}" перервано через таймаут (${timeoutMs} ms).`,
      true,
    );
  }

  throw error;
}

export async function executeWithRetry<T>(
  operationName: string,
  operation: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions,
  dependencies: RetryDependencies = {},
): Promise<T> {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new RangeError("maxAttempts має бути додатним цілим числом.");
  }

  const sleep =
    dependencies.sleep ??
    ((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const random = dependencies.random ?? Math.random;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    let caughtError: unknown;

    try {
      return await operation(controller.signal);
    } catch (error: unknown) {
      caughtError = error;
    } finally {
      clearTimeout(timeoutId);
    }

    const retryError = normalizeRetryError(caughtError, operationName, options.timeoutMs);

    if (!retryError.retryable || attempt === options.maxAttempts) {
      throw retryError;
    }

    const delayMs =
      retryError.retryAfterMs ??
      calculateBackoff(attempt, options.baseDelayMs, options.maxDelayMs, random);

    dependencies.onRetry?.({
      operationName,
      attempt,
      delayMs,
      code: retryError.code,
    });

    await sleep(delayMs);
  }

  throw new ToolError(
    "UPSTREAM_UNAVAILABLE",
    `Операція "${operationName}" перевищила ліміт спроб.`,
    true,
  );
}
