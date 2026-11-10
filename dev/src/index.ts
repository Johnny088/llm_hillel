import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import OpenAI from "openai";
import {
  OPENROUTER_BASE_URL,
  formatError,
  loadEnvironment,
  readUserInput,
  requestAnswer,
  type ChatClient,
} from "./cli.js";

const localEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");

dotenv.config({ quiet: true, path: localEnvPath });
dotenv.config({ quiet: true });

async function main(): Promise<void> {
  const environment = loadEnvironment(process.env);
  const input = readUserInput(process.argv.slice(2));

  console.log("\n📤 Надіслано:");
  console.log(input);
  console.log(`🎯 Модель: ${environment.OPENROUTER_MODEL}`);
  console.log("⏳ Очікування відповіді OpenRouter...");

  const openai = new OpenAI({
    apiKey: environment.OPENROUTER_API_KEY,
    baseURL: OPENROUTER_BASE_URL,
    timeout: 30_000,
    maxRetries: 0,
  });

  const client: ChatClient = {
    create: async (request) => {
      const response = await openai.chat.completions.create(request);
      return {
        text: response.choices[0]?.message?.content ?? "",
        model: response.model,
      };
    },
  };

  const answer = await requestAnswer(client, environment, input);

  console.log("\n📝 Відповідь:");
  console.log(answer.text);
  console.log(`\n🤖 Фактична модель: ${answer.model}`);
}

void main().catch((error: unknown) => {
  console.error(`❌ Не вдалося виконати запит: ${formatError(error)}`);
  process.exitCode = 1;
});
