import type { RequestHandler } from "express";

function isWrite(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH";
}

/**
 * Reject API writes whose Content-Type is not application/json.
 */
export const jsonOnly: RequestHandler = (req, res, next) => {
  if (!isWrite(req.method)) {
    next();
    return;
  }
  const raw = req.headers["content-type"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const ct = (value || "").toLowerCase();
  if (!ct.includes("application/json")) {
    res.status(415).json({ error: "unsupported_media_type" });
    return;
  }
  next();
};
