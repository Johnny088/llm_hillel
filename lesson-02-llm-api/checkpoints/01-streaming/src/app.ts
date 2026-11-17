import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { calculateCost, MODEL_PRICES, type ModelPricing } from "./config/pricing.js";
import { createApiError, DocumentAiError, type ApiErrorResponse } from "./lib/errors.js";
import { calculateCacheHitRate, extractUsageMetrics } from "./lib/metrics.js";
import { sendSseHeaders, writeSseEvent } from "./lib/sse.js";
import { DocumentRequestSchema } from "./schemas/document-request.js";
import type { Extraction } from "./schemas/extraction.js";
import type { DocumentAi } from "./services/document-ai.js";

export interface AppDependencies {
  ai: DocumentAi;
  now?: () => number;
  prices?: Readonly<Record<string, ModelPricing>>;
}

export interface ExtractionApiResponse {
  data: Extraction;
  usage: ReturnType<typeof extractUsageMetrics>;
  metrics: {
    model: string;
    totalLatencyMs: number;
    cacheHitRate: number;
  } & ReturnType<typeof calculateCost>;
}

type StreamTerminalState = "pending" | "completed" | "incomplete" | "failed" | "refused";

type HttpErrorLike = {
  status?: number;
  type?: string;
};

function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return typeof error === "object" && error !== null;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  const now = dependencies.now ?? (() => performance.now());
  const prices = dependencies.prices ?? MODEL_PRICES;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post(
    "/api/documents/extract",
    (request: Request, response: Response<ApiErrorResponse>): void => {
      const parsedRequest = DocumentRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response
          .status(400)
          .json(
            createApiError("INVALID_INPUT", "Невалідний запит.", parsedRequest.error.flatten()),
          );
        return;
      }

      response
        .status(501)
        .json(
          createApiError(
            "NOT_IMPLEMENTED",
            "Маршрут Structured Output буде реалізовано на наступному кроці.",
          ),
        );
    },
  );
  app.post(
    "/api/documents/summary/stream",
    async (request: Request, response: Response<ApiErrorResponse | void>): Promise<void> => {
      const parsedRequest = DocumentRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response
          .status(400)
          .json(
            createApiError("INVALID_INPUT", "Невалідний запит.", parsedRequest.error.flatten()),
          );
        return;
      }

      const controller = new AbortController();
      const abortIfOpen = (): void => {
        if (!response.writableEnded) {
          controller.abort();
        }
      };

      request.once("aborted", abortIfOpen);
      response.once("close", abortIfOpen);

      const startedAt = now();
      let firstDeltaAt: number | null = null;
      let terminalState: StreamTerminalState = "pending";

      sendSseHeaders(response);

      try {
        for await (const event of dependencies.ai.streamSummary(
          parsedRequest.data.content,
          controller.signal,
        )) {
          if (controller.signal.aborted || response.writableEnded) {
            return;
          }

          switch (event.type) {
            case "delta":
              firstDeltaAt ??= now();
              writeSseEvent(response, "delta", { delta: event.delta });
              break;

            case "refused":
              terminalState = "refused";
              break;

            case "incomplete":
              terminalState = "incomplete";
              writeSseEvent(response, "error", {
                code: "INCOMPLETE_RESPONSE",
                message: "Генерацію не було завершено.",
                reason: event.reason,
              });
              break;

            case "failed":
              terminalState = "failed";
              writeSseEvent(response, "error", {
                code: "RESPONSE_FAILED",
                message: "Не вдалося виконати генерацію.",
                reason: event.reason,
              });
              break;

            case "completed": {
              terminalState = terminalState === "refused" ? "refused" : "completed";
              const usage = extractUsageMetrics(event.usage);
              const totalLatencyMs = Math.max(0, Math.round(now() - startedAt));
              const ttftMs =
                firstDeltaAt === null ? null : Math.max(0, Math.round(firstDeltaAt - startedAt));

              writeSseEvent(response, "usage", {
                usage,
                metrics: {
                  model: event.model,
                  ttftMs,
                  totalLatencyMs,
                  cacheHitRate: calculateCacheHitRate(usage.inputTokens, usage.cachedTokens),
                  ...calculateCost(event.model, usage, prices),
                },
              });
              break;
            }
          }

          if (terminalState === "incomplete" || terminalState === "failed") {
            break;
          }
        }

        if (controller.signal.aborted || response.writableEnded) {
          return;
        }

        if (terminalState === "completed") {
          writeSseEvent(response, "done", { status: "completed" });
        } else if (terminalState === "refused") {
          writeSseEvent(response, "error", {
            code: "REQUEST_REFUSED",
            message: "Модель відхилила запит.",
          });
        } else if (terminalState === "pending") {
          writeSseEvent(response, "error", {
            code: "STREAM_ENDED_UNEXPECTEDLY",
            message: "Потік завершився без термінальної події.",
          });
        }

        response.end();
      } catch (error) {
        if (controller.signal.aborted || response.writableEnded) {
          return;
        }

        const mapped =
          error instanceof DocumentAiError
            ? error
            : new DocumentAiError("STREAM_ERROR", "Помилка потокової передачі.", 502);

        writeSseEvent(response, "error", {
          code: mapped.code,
          message: mapped.message,
          ...(mapped.details === undefined ? {} : { details: mapped.details }),
        });
        response.end();
      } finally {
        request.off("aborted", abortIfOpen);
        response.off("close", abortIfOpen);
      }
    },
  );

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response<ApiErrorResponse>,
      next: NextFunction,
    ): void => {
      if (response.headersSent) {
        next(error);
        return;
      }

      if (error instanceof DocumentAiError) {
        response
          .status(error.statusCode)
          .json(createApiError(error.code, error.message, error.details));
        return;
      }

      if (isHttpErrorLike(error) && error.status === 413) {
        response
          .status(413)
          .json(createApiError("PAYLOAD_TOO_LARGE", "Тіло запиту перевищує дозволений розмір."));
        return;
      }

      if (
        error instanceof SyntaxError &&
        isHttpErrorLike(error) &&
        error.status === 400 &&
        error.type === "entity.parse.failed"
      ) {
        response
          .status(400)
          .json(createApiError("MALFORMED_JSON", "Тіло запиту містить невалідний JSON."));
        return;
      }

      response
        .status(500)
        .json(createApiError("INTERNAL_SERVER_ERROR", "Внутрішня помилка сервера."));
    },
  );

  return app;
}
