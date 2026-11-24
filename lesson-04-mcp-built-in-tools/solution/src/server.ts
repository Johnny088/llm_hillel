import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createLesson04Runtime } from "./runtime.js";
import { loadEnvironment } from "../../../lesson-03-function-calling/solution/src/config/env.js";

dotenv.config({ quiet: true });

async function startServer(): Promise<void> {
  const environment = loadEnvironment(process.env);
  const runtime = await createLesson04Runtime(environment);

  try {
    const app = createApp(runtime.dependencies);
    const server = app.listen(environment.PORT);
    server.once("listening", () => {
      console.log(`Document, Tool та MCP API працює на http://localhost:${environment.PORT}`);
    });
    let closing = false;

    const closeRuntime = async (): Promise<void> => {
      try {
        await runtime.close();
      } catch (closeError: unknown) {
        console.error("Не вдалося коректно закрити MCP runtime.", {
          errorName: closeError instanceof Error ? closeError.name : "UnknownError",
        });
        process.exitCode = 1;
      }
    };

    const close = (reason?: unknown): void => {
      if (closing) {
        return;
      }

      closing = true;
      if (reason instanceof Error) {
        console.error("Не вдалося запустити HTTP сервер.", {
          errorName: reason.name,
        });
        process.exitCode = 1;
      }

      const finish = (): void => {
        void closeRuntime();
      };

      if (!server.listening) {
        finish();
        return;
      }

      server.close(() => {
        finish();
      });
    };

    server.once("error", (error: unknown) => close(error));
    process.once("SIGINT", () => close());
    process.once("SIGTERM", () => close());
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Непередбачена помилка запуску.";
  console.error(`Не вдалося запустити сервер: ${message}`);
  process.exitCode = 1;
});
