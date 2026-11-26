import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import dotenv from "dotenv";
import { loadEnvironment } from "../src/config/env.js";
import { JsonUserFactStore } from "../src/memory/user-facts.js";
import { createLesson05Runtime } from "../src/runtime.js";
import type { Lesson05OpenRouterRuntime } from "../src/runtime.js";
import type { ConversationTurnOptions } from "../src/services/conversation-manager.js";

dotenv.config({ quiet: true });

const environment = loadEnvironment(process.env);
const temporaryDirectory = await mkdtemp(join(tmpdir(), "lesson-05-openrouter-live-"));
const userFactsPath = join(temporaryDirectory, "user-memory.json");
const turnOptions: ConversationTurnOptions = {
  instructions: [
    "Роль: детермінований smoke-асистент для перевірки client-managed Conversation State.",
    "На кожен запит потрібно відповісти лише словом READY.",
  ].join("\n"),
  enableUserFactTool: false,
  includeUserFacts: false,
};
let runtime: Lesson05OpenRouterRuntime | undefined;

try {
  runtime = await createLesson05Runtime(environment, {
    userFactsPath,
    conversationHistoryPath: join(temporaryDirectory, "conversation-history.json"),
  });

  const firstSession = await runtime.conversationManager.send(
    { mode: "session", sessionId: "lesson-05-live", message: "Перший хід." },
    turnOptions,
  );
  const secondSession = await runtime.conversationManager.send(
    { mode: "session", sessionId: "lesson-05-live", message: "Другий хід." },
    turnOptions,
  );

  if (
    firstSession.mode !== "session" ||
    secondSession.mode !== "session" ||
    firstSession.retainedTurns !== 1 ||
    secondSession.retainedTurns !== 2
  ) {
    throw new Error("Client-managed session history повернула неочікуваний стан.");
  }

  if (
    !firstSession.text.toUpperCase().includes("READY") ||
    !secondSession.text.toUpperCase().includes("READY")
  ) {
    throw new Error("Live session response не містить очікуваний маркер READY.");
  }

  if (!runtime.conversationManager.resetSession("lesson-05-live")) {
    throw new Error("Live reset не очистив локальну session history.");
  }

  const firstConversation = await runtime.conversationManager.send(
    { mode: "conversation", message: "Перший durable хід." },
    turnOptions,
  );

  if (firstConversation.mode !== "conversation") {
    throw new Error("Durable conversation повернула неочікуваний mode.");
  }

  const secondConversation = await runtime.conversationManager.send(
    {
      mode: "conversation",
      conversationId: firstConversation.conversationId,
      message: "Другий durable хід.",
    },
    turnOptions,
  );

  if (
    secondConversation.mode !== "conversation" ||
    secondConversation.conversationId !== firstConversation.conversationId ||
    secondConversation.retainedTurns !== 2 ||
    !secondConversation.text.toUpperCase().includes("READY")
  ) {
    throw new Error("Durable JSON conversation не відновила очікуваний стан.");
  }

  const memoryTurn = await runtime.conversationManager.send(
    {
      mode: "session",
      sessionId: "lesson-05-live-memory",
      message: "Збережи синтетичний preferredStack зі значенням TypeScript.",
    },
    {
      instructions: [
        "Для цього запиту обов’язково викликається save_user_fact рівно один раз.",
        "Після успішного tool output відповідь має містити слово READY.",
      ].join("\n"),
      enableUserFactTool: true,
      includeUserFacts: false,
      toolChoice: "required",
    },
  );
  const storedFacts = await new JsonUserFactStore(userFactsPath).list();

  if (
    memoryTurn.metrics.toolCallCount !== 1 ||
    !memoryTurn.text.toUpperCase().includes("READY") ||
    !storedFacts.some((fact) => fact.category === "preferredStack" && fact.value === "TypeScript")
  ) {
    throw new Error("Live save_user_fact не пройшов tool loop або JSON persistence.");
  }

  console.log(
    `PASS OpenRouter live client-managed session: model=${secondSession.model}, retainedTurns=${secondSession.retainedTurns}`,
  );
  console.log(
    `PASS OpenRouter live durable JSON conversation: model=${secondConversation.model}, retainedTurns=${secondConversation.retainedTurns}`,
  );
  console.log(
    `PASS OpenRouter live save_user_fact: model=${memoryTurn.model}, toolCalls=${memoryTurn.metrics.toolCallCount}`,
  );
} finally {
  await runtime?.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
