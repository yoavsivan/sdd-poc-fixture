import { Router } from "express";

/**
 * Liveness endpoint used by the compose healthcheck.
 */
export function healthRouter(): Router {
  const router = Router();
  router.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return router;
}
