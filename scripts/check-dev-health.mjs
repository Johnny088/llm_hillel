#!/usr/bin/env node

const healthUrl = process.argv[2] ?? "http://127.0.0.1:3000/health";

try {
  const response = await fetch(healthUrl);
  const body = await response.json();

  if (!response.ok || body?.status !== "ok") {
    throw new Error(`Unexpected response: HTTP ${response.status} ${JSON.stringify(body)}`);
  }

  console.log(`GET ${healthUrl} -> HTTP ${response.status}, status=${body.status}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Health check failed for ${healthUrl}: ${message}`);
  process.exitCode = 1;
}
