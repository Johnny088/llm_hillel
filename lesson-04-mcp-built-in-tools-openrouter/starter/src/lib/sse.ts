import type { Response } from "express";

export type SseEventName = "delta" | "usage" | "done" | "error";

export function sendSseHeaders(response: Response): void {
  response.status(200);
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  response.flushHeaders();
}

export function writeSseEvent(response: Response, event: SseEventName, data: unknown): boolean {
  if (response.writableEnded || response.destroyed) {
    return false;
  }

  return response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
