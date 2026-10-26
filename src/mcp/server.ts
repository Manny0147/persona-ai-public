import express, { Request, Response } from "express";
import { callTool, listToolDefinitions } from "./tools.js";
import { logger } from "../utils/logger.js";

/**
 * Lightweight MCP-style HTTP server.
 * Exposes tool discovery + tool invocation with strict approval semantics.
 */
export function createMcpRouter() {
  const router = express.Router();

  router.get("/tools", (_req: Request, res: Response) => {
    res.json({ tools: listToolDefinitions() });
  });

  router.post("/call", async (req: Request, res: Response) => {
    try {
      const { name, arguments: args } = req.body || {};
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Missing tool name" });
      }
      const result = await callTool(name, args ?? {});
      res.json({ ok: true, result });
    } catch (err: any) {
      logger.error("MCP call failed", err);
      res.status(400).json({ ok: false, error: err.message || String(err) });
    }
  });

  // Convenience aliases matching common agent patterns
  router.post("/tools/:name", async (req: Request, res: Response) => {
    try {
      const name = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
      const result = await callTool(name, req.body ?? {});
      res.json({ ok: true, result });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message || String(err) });
    }
  });

  return router;
}
