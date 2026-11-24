import type { Express, Request, Response } from "express";
import {
  createApp as createLesson03App,
  type AppDependencies,
} from "../../../lesson-03-function-calling/solution/src/app.js";
import {
  createApiError,
  type ApiErrorResponse,
} from "../../../lesson-03-function-calling/solution/src/lib/errors.js";
import { AgentRequestSchema } from "../../../lesson-03-function-calling/solution/src/schemas/agent-request.js";
import type {
  AgentRunResult,
  ToolCallingAgent,
} from "../../../lesson-03-function-calling/solution/src/services/tool-calling-agent.js";

export interface Lesson04AppDependencies extends AppDependencies {
  mcpAgent?: ToolCallingAgent;
}

export function createApp(dependencies: Lesson04AppDependencies): Express {
  const app = createLesson03App(dependencies);

  app.post(
    "/api/agent/research",
    async (
      request: Request,
      response: Response<AgentRunResult | ApiErrorResponse>,
    ): Promise<void> => {
      const parsedRequest = AgentRequestSchema.safeParse(request.body);

      if (!parsedRequest.success) {
        response
          .status(400)
          .json(
            createApiError("INVALID_INPUT", "Невалідний запит.", parsedRequest.error.flatten()),
          );
        return;
      }

      if (!dependencies.mcpAgent) {
        response
          .status(503)
          .json(createApiError("SERVICE_UNAVAILABLE", "MCP runtime не налаштовано."));
        return;
      }

      try {
        response.json(await dependencies.mcpAgent.run(parsedRequest.data.message));
      } catch (error: unknown) {
        console.error("[MCP Agent Error]", {
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        response
          .status(502)
          .json(createApiError("MCP_AGENT_ERROR", "Не вдалося виконати MCP-запит."));
      }
    },
  );

  return app;
}
