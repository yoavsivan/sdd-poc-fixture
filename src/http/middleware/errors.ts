import type { ErrorRequestHandler, RequestHandler } from "express";

function isApi(req: { path: string; originalUrl?: string }): boolean {
  const p = req.originalUrl || req.path;
  return p === "/api" || p.startsWith("/api/") || req.path === "/api" || req.path.startsWith("/api/");
}

/**
 * Terminal 404: JSON under /api, HTML everywhere else.
 */
export const notFound: RequestHandler = (req, res) => {
  if (isApi(req)) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.status(404);
  res.render("error", {
    title: "Not found",
    status: 404,
    message: "That page is not here.",
  });
};

/**
 * Last-stop error handler. Production responses do not include a stack.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const statusRaw = (err as { status?: unknown; statusCode?: unknown }).status;
  const statusCode = (err as { statusCode?: unknown }).statusCode;
  let status = 500;
  if (typeof statusRaw === "number" && statusRaw >= 400 && statusRaw <= 599) status = statusRaw;
  else if (typeof statusCode === "number" && statusCode >= 400 && statusCode <= 599) {
    status = statusCode;
  }
  const expose = Boolean((err as { expose?: boolean }).expose);
  const prod = req.app.get("env") === "production" || process.env.NODE_ENV === "production";
  const message =
    expose && err instanceof Error && err.message
      ? err.message
      : status === 500
        ? "Something went wrong."
        : err instanceof Error
          ? err.message
          : "Request failed";
  if (!prod) {
    console.error(err);
  }
  if (isApi(req) || req.path.startsWith("/api")) {
    // Frozen ApiError union (api-sketch.md §1) has no 5xx member; `invalid` requires `fields`.
    if (status >= 500) {
      res.status(500).json({ error: "invalid", fields: { _: "Something went wrong." } });
      return;
    }
    const body: { error: string; fields?: Record<string, string> } =
      status === 404
        ? { error: "not_found" }
        : status === 401
          ? { error: "unauthorized" }
          : status === 415
            ? { error: "unsupported_media_type" }
            : { error: "invalid", fields: { _: "Request failed" } };
    res.status(status).json(body);
    return;
  }
  res.status(status);
  res.render("error", {
    title: status === 500 ? "Server error" : "Error",
    status,
    message: prod && status === 500 ? "Something went wrong." : message,
  });
};
