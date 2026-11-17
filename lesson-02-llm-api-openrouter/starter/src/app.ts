import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { createApiError, type ApiErrorResponse } from "./lib/errors.js";
import { DocumentRequestSchema } from "./schemas/document-request.js";
import type { DocumentAi } from "./services/document-ai.js";

export interface AppDependencies {
  ai: DocumentAi;
}

type HttpErrorLike = {
  status?: number;
  type?: string;
};

function isHttpErrorLike(error: unknown): error is HttpErrorLike {
  return typeof error === "object" && error !== null;
}

export function createApp(_dependencies: AppDependencies): Express {
  const app = express();

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

      // TODO: викличте dependencies.ai.extract(), додайте usage і latency.
      // Необов'язкове поглиблення: додайте cost metrics.
      response
        .status(501)
        .json(
          createApiError(
            "NOT_IMPLEMENTED",
            "Маршрут структурованого JSON через OpenRouter ще не реалізовано.",
          ),
        );
    },
  );

  app.post(
    "/api/documents/summary/stream",
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

      // TODO: відкрийте SSE та обробіть typed stream events.
      // Необов'язкове поглиблення: скасуйте upstream stream через AbortController.
      response
        .status(501)
        .json(createApiError("NOT_IMPLEMENTED", "Маршрут Streaming ще не реалізовано."));
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
