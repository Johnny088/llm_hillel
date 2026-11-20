import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { calculateCost, MODEL_PRICES, type ModelPricing } from "./config/pricing.js";
import { createApiError, DocumentAiError, type ApiErrorResponse } from "./lib/errors.js";
import { calculateCacheHitRate, extractUsageMetrics } from "./lib/metrics.js";
import { sendSseHeaders, writeSseEvent } from "./lib/sse.js";
import { AgentRequestSchema } from "./schemas/agent-request.js";
import { DocumentRequestSchema } from "./schemas/document-request.js";
import type { Extraction } from "./schemas/extraction.js";
import type { DocumentAi } from "./services/document-ai.js";
import type { AgentRunResult, ToolCallingAgent } from "./services/tool-calling-agent.js";

export interface AppDependencies {
  ai: DocumentAi;
  toolAgent?: ToolCallingAgent;
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

function describeStreamFailure(reason: string): { code: string; message: string } {
  if (reason === "rate_limit_exceeded" || reason === "429") {
    return {
      code: "UPSTREAM_RATE_LIMITED",
      message: "OpenRouter тимчасово обмежив частоту запитів.",
    };
  }

  if (reason === "timeout") {
    return {
      code: "GATEWAY_TIMEOUT",
      message: "Перевищено час очікування відповіді OpenRouter API.",
    };
  }

  if (reason === "provider_overloaded") {
    return {
      code: "UPSTREAM_UNAVAILABLE",
      message: "OpenRouter або провайдер моделі тимчасово недоступний.",
    };
  }

  if (reason === "refusal" || reason === "content_policy_violation") {
    return { code: "REQUEST_REFUSED", message: "Модель відхилила запит." };
  }

  return { code: "RESPONSE_FAILED", message: "Не вдалося виконати генерацію." };
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
    "/api/agent",
    async (
      request: Request,
      response: Response<AgentRunResult | ApiErrorResponse>,
      next: NextFunction,
    ): Promise<void> => {
      const parsedRequest = AgentRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response
          .status(400)
          .json(
            createApiError(
              "INVALID_INPUT",
              "Невалідний запит.",
              z.flattenError(parsedRequest.error),
            ),
          );
        return;
      }

      if (!dependencies.toolAgent) {
        response
          .status(503)
          .json(createApiError("SERVICE_UNAVAILABLE", "Tool-calling runtime не налаштовано."));
        return;
      }

      try {
        response.json(await dependencies.toolAgent.run(parsedRequest.data.message));
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/documents/extract",
    async (
      request: Request,
      response: Response<ExtractionApiResponse | ApiErrorResponse>,
      next: NextFunction,
    ): Promise<void> => {
      const parsedRequest = DocumentRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response
          .status(400)
          .json(
            createApiError(
              "INVALID_INPUT",
              "Невалідний запит.",
              z.flattenError(parsedRequest.error),
            ),
          );
        return;
      }

      const startedAt = now();

      try {
        const result = await dependencies.ai.extract(parsedRequest.data.content);
        const usage = extractUsageMetrics(result.usage);
        const cacheHitRate = calculateCacheHitRate(usage.inputTokens, usage.cachedTokens);

        response.json({
          data: result.data,
          usage,
          metrics: {
            model: result.model,
            totalLatencyMs: Math.max(0, Math.round(now() - startedAt)),
            cacheHitRate,
            ...calculateCost(result.model, usage, prices, result.usage?.provider_cost_usd),
          },
        });
      } catch (error) {
        next(error);
      }
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
            createApiError(
              "INVALID_INPUT",
              "Невалідний запит.",
              z.flattenError(parsedRequest.error),
            ),
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

            case "failed": {
              terminalState = "failed";
              const failure = describeStreamFailure(event.reason);
              writeSseEvent(response, "error", {
                ...failure,
                reason: event.reason,
              });
              break;
            }

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
                  ...calculateCost(event.model, usage, prices, event.usage?.provider_cost_usd),
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
        response.status(error.statusCode).json(createApiError(error.code, error.message));
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

// import express, { type Express, type NextFunction, type Request, type Response } from "express";
// import { calculateCost, MODEL_PRICES, type ModelPricing } from "./config/pricing.js";
// import { createApiError, DocumentAiError, type ApiErrorResponse } from "./lib/errors.js";
// import { calculateCacheHitRate, extractUsageMetrics } from "./lib/metrics.js";
// import { sendSseHeaders, writeSseEvent } from "./lib/sse.js";
// import { DocumentRequestSchema } from "./schemas/document-request.js";
// import type { Extraction } from "./schemas/extraction.js";
// import type { DocumentAi } from "./services/document-ai.js";

// export interface AppDependencies {
//   ai: DocumentAi;
//   now?: () => number;
//   prices?: Readonly<Record<string, ModelPricing>>;
// }

// export interface ExtractionApiResponse {
//   data: Extraction;
//   usage: ReturnType<typeof extractUsageMetrics>;
//   metrics: {
//     model: string;
//     totalLatencyMs: number;
//     cacheHitRate: number;
//   } & ReturnType<typeof calculateCost>;
// }

// type StreamTerminalState = "pending" | "completed" | "incomplete" | "failed" | "refused";

// type HttpErrorLike = {
//   status?: number;
//   type?: string;
// };

// function isHttpErrorLike(error: unknown): error is HttpErrorLike {
//   return typeof error === "object" && error !== null;
// }

// function describeStreamFailure(reason: string): { code: string; message: string } {
//   if (reason === "rate_limit_exceeded" || reason === "429") {
//     return {
//       code: "UPSTREAM_RATE_LIMITED",
//       message: "OpenRouter тимчасово обмежив частоту запитів.",
//     };
//   }

//   if (reason === "timeout") {
//     return {
//       code: "GATEWAY_TIMEOUT",
//       message: "Перевищено час очікування відповіді OpenRouter API.",
//     };
//   }

//   if (reason === "provider_overloaded") {
//     return {
//       code: "UPSTREAM_UNAVAILABLE",
//       message: "OpenRouter або провайдер моделі тимчасово недоступний.",
//     };
//   }

//   if (reason === "refusal" || reason === "content_policy_violation") {
//     return { code: "REQUEST_REFUSED", message: "Модель відхилила запит." };
//   }

//   return { code: "RESPONSE_FAILED", message: "Не вдалося виконати генерацію." };
// }

// export function createApp(dependencies: AppDependencies): Express {
//   const app = express();
//   const now = dependencies.now ?? (() => performance.now());
//   const prices = dependencies.prices ?? MODEL_PRICES;

//   app.disable("x-powered-by");
//   app.use(express.json({ limit: "32kb" }));

//   app.get("/health", (_request, response) => {
//     response.json({ status: "ok" });
//   });

//   app.post(
//     "/api/documents/extract",
//     async (
//       request: Request,
//       response: Response<ExtractionApiResponse | ApiErrorResponse>,
//       next: NextFunction,
//     ): Promise<void> => {
//       const parsedRequest = DocumentRequestSchema.safeParse(request.body);

//       if (!parsedRequest.success) {
//         response
//           .status(400)
//           .json(
//             createApiError("INVALID_INPUT", "Невалідний запит.", parsedRequest.error.flatten()),
//           );
//         return;
//       }

//       const startedAt = now();

//       try {
//         const result = await dependencies.ai.extract(parsedRequest.data.content);
//         const usage = extractUsageMetrics(result.usage);
//         const cacheHitRate = calculateCacheHitRate(usage.inputTokens, usage.cachedTokens);

//         response.json({
//           data: result.data,
//           usage,
//           metrics: {
//             model: result.model,
//             totalLatencyMs: Math.max(0, Math.round(now() - startedAt)),
//             cacheHitRate,
//             ...calculateCost(result.model, usage, prices, result.usage?.provider_cost_usd),
//           },
//         });
//       } catch (error) {
//         next(error);
//       }
//     },
//   );

//   app.post(
//     "/api/documents/summary/stream",
//     async (request: Request, response: Response<ApiErrorResponse | void>): Promise<void> => {
//       const parsedRequest = DocumentRequestSchema.safeParse(request.body);

//       if (!parsedRequest.success) {
//         response
//           .status(400)
//           .json(
//             createApiError("INVALID_INPUT", "Невалідний запит.", parsedRequest.error.flatten()),
//           );
//         return;
//       }

//       const controller = new AbortController();
//       const abortIfOpen = (): void => {
//         if (!response.writableEnded) {
//           controller.abort();
//         }
//       };

//       request.once("aborted", abortIfOpen);
//       response.once("close", abortIfOpen);

//       const startedAt = now();
//       let firstDeltaAt: number | null = null;
//       let terminalState: StreamTerminalState = "pending";

//       sendSseHeaders(response);

//       try {
//         for await (const event of dependencies.ai.streamSummary(
//           parsedRequest.data.content,
//           controller.signal,
//         )) {
//           if (controller.signal.aborted || response.writableEnded) {
//             return;
//           }

//           switch (event.type) {
//             case "delta":
//               firstDeltaAt ??= now();
//               writeSseEvent(response, "delta", { delta: event.delta });
//               break;

//             case "refused":
//               terminalState = "refused";
//               break;

//             case "incomplete":
//               terminalState = "incomplete";
//               writeSseEvent(response, "error", {
//                 code: "INCOMPLETE_RESPONSE",
//                 message: "Генерацію не було завершено.",
//                 reason: event.reason,
//               });
//               break;

//             case "failed": {
//               terminalState = "failed";
//               const failure = describeStreamFailure(event.reason);
//               writeSseEvent(response, "error", {
//                 ...failure,
//                 reason: event.reason,
//               });
//               break;
//             }

//             case "completed": {
//               terminalState = terminalState === "refused" ? "refused" : "completed";
//               const usage = extractUsageMetrics(event.usage);
//               const totalLatencyMs = Math.max(0, Math.round(now() - startedAt));
//               const ttftMs =
//                 firstDeltaAt === null ? null : Math.max(0, Math.round(firstDeltaAt - startedAt));

//               writeSseEvent(response, "usage", {
//                 usage,
//                 metrics: {
//                   model: event.model,
//                   ttftMs,
//                   totalLatencyMs,
//                   cacheHitRate: calculateCacheHitRate(usage.inputTokens, usage.cachedTokens),
//                   ...calculateCost(event.model, usage, prices, event.usage?.provider_cost_usd),
//                 },
//               });
//               break;
//             }
//           }

//           if (terminalState === "incomplete" || terminalState === "failed") {
//             break;
//           }
//         }

//         if (controller.signal.aborted || response.writableEnded) {
//           return;
//         }

//         if (terminalState === "completed") {
//           writeSseEvent(response, "done", { status: "completed" });
//         } else if (terminalState === "refused") {
//           writeSseEvent(response, "error", {
//             code: "REQUEST_REFUSED",
//             message: "Модель відхилила запит.",
//           });
//         } else if (terminalState === "pending") {
//           writeSseEvent(response, "error", {
//             code: "STREAM_ENDED_UNEXPECTEDLY",
//             message: "Потік завершився без термінальної події.",
//           });
//         }

//         response.end();
//       } catch (error) {
//         if (controller.signal.aborted || response.writableEnded) {
//           return;
//         }

//         const mapped =
//           error instanceof DocumentAiError
//             ? error
//             : new DocumentAiError("STREAM_ERROR", "Помилка потокової передачі.", 502);

//         writeSseEvent(response, "error", {
//           code: mapped.code,
//           message: mapped.message,
//         });
//         response.end();
//       } finally {
//         request.off("aborted", abortIfOpen);
//         response.off("close", abortIfOpen);
//       }
//     },
//   );

//   app.use(
//     (
//       error: unknown,
//       _request: Request,
//       response: Response<ApiErrorResponse>,
//       next: NextFunction,
//     ): void => {
//       if (response.headersSent) {
//         next(error);
//         return;
//       }

//       if (error instanceof DocumentAiError) {
//         response.status(error.statusCode).json(createApiError(error.code, error.message));
//         return;
//       }

//       if (isHttpErrorLike(error) && error.status === 413) {
//         response
//           .status(413)
//           .json(createApiError("PAYLOAD_TOO_LARGE", "Тіло запиту перевищує дозволений розмір."));
//         return;
//       }

//       if (
//         error instanceof SyntaxError &&
//         isHttpErrorLike(error) &&
//         error.status === 400 &&
//         error.type === "entity.parse.failed"
//       ) {
//         response
//           .status(400)
//           .json(createApiError("MALFORMED_JSON", "Тіло запиту містить невалідний JSON."));
//         return;
//       }

//       response
//         .status(500)
//         .json(createApiError("INTERNAL_SERVER_ERROR", "Внутрішня помилка сервера."));
//     },
//   );

//   return app;
// }
