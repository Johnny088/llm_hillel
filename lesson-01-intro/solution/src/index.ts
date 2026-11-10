import dotenv from "dotenv";
import OpenAI from "openai";
import {
  formatError,
  loadEnvironment,
  readUserInput,
  requestAnswer,
  type ResponsesClient,
} from "./cli.js";

dotenv.config({ quiet: true });

async function main(): Promise<void> {
  const environment = loadEnvironment(process.env);
  const input = readUserInput(process.argv.slice(2));

  console.log("\n📤 Надіслано:");
  console.log(input);
  console.log(`🎯 Налаштована модель: ${environment.OPENAI_MODEL_FAST}`);
  console.log("⏳ Очікування відповіді OpenAI...");

  const openai = new OpenAI({
    apiKey: environment.OPENAI_API_KEY,
    timeout: 30_000,
    maxRetries: 0,
  });
  let actualModel = environment.OPENAI_MODEL_FAST;

  const client: ResponsesClient = {
    create: async (request) => {
      const response = await openai.responses.create(request);
      actualModel = response.model || request.model;
      return { output_text: response.output_text };
    },
  };

  const answer = await requestAnswer(client, environment, input);

  console.log("\n📝 Відповідь:");
  console.log(answer);
  console.log(`\n🤖 Фактична модель: ${actualModel}`);
}

void main().catch((error: unknown) => {
  console.error(`❌ Не вдалося виконати запит: ${formatError(error)}`);
  process.exitCode = 1;
});
