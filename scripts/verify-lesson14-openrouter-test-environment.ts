/** Build an offline gate environment for a local, disposable course database. */
export function createLesson14TestEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const portText = environment.COURSE_TEST_DATABASE_PORT ?? "5434";
  if (!/^\d+$/u.test(portText) || Number(portText) < 1 || Number(portText) > 65535)
    throw new Error("COURSE_TEST_DATABASE_PORT must be an integer between 1 and 65535.");
  const port = Number(portText);
  const safe = { ...environment };
  for (const key of Object.keys(safe))
    if (
      /(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|OPENROUTER|OPENAI|DATABASE_URL|DB_URL|^PG(?:HOST|PORT|USER|PASSWORD|DATABASE)$)/iu.test(
        key,
      )
    )
      delete safe[key];
  const databaseUrl = (role: string): string =>
    `postgresql://${role}:${role}_password@127.0.0.1:${port}/ai_agents_openrouter`;
  safe.COURSE_TEST_DATABASE_PORT = String(port);
  safe.LESSON13_OPENROUTER_ADMIN_DATABASE_URL = databaseUrl("course_admin");
  safe.LESSON13_OPENROUTER_READ_DATABASE_URL = databaseUrl("catalog_reader");
  safe.LESSON13_OPENROUTER_WRITE_DATABASE_URL = databaseUrl("catalog_writer");
  safe.LESSON13_OPENROUTER_AGENT_DATABASE_URL = databaseUrl("catalog_agent_runtime");
  safe.LESSON14_OPENROUTER_DATABASE_URL = databaseUrl("chat_app");
  safe.LESSON14_OPENROUTER_AUTH_SECRET = "lesson14-completion-harness-secret-value-32chars";
  safe.NODE_ENV = "test";
  return safe;
}
