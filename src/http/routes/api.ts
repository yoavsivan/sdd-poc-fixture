import { Router } from "express";
import type Database from "better-sqlite3";
import { createItem, getItem, listItems, removeItem } from "../../items/repo.js";
import { normalizeTags } from "../../items/tags.js";
import { toItemResponse } from "../../items/types.js";
import { hasFieldErrors, validateItemFields } from "../../items/validate.js";
import { requireApiUser } from "../middleware/authenticate.js";
import { jsonOnly } from "../middleware/json-only.js";

function dbOf(req: { app: { locals: Record<string, unknown> } }): Database.Database {
  const db = req.app.locals.db as Database.Database | undefined;
  if (!db) throw new Error("api routes: app.locals.db is missing");
  return db;
}

function userIdOf(res: { locals: { user?: { id: number } } }): number {
  const user = res.locals.user;
  if (!user) throw new Error("api routes: user missing after requireApiUser");
  return user.id;
}

function parseId(raw: string): number | null {
  if (!/^[0-9]+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * JSON API for items. Auth is inherited by every route via router.use.
 */
export function apiRouter(): Router {
  const router = Router();
  router.use(jsonOnly, requireApiUser);

  router.get("/items", (req, res) => {
    const tag = str(req.query.tag).trim();
    const q = str(req.query.q).trim();
    const items = listItems(dbOf(req), userIdOf(res), {
      tag: tag || undefined,
      q: q || undefined,
    });
    res.status(200).json({
      items: items.map(toItemResponse),
      count: items.length,
    });
  });

  router.post("/items", (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const fields = validateItemFields({
      url: (body as { url?: unknown }).url,
      title: (body as { title?: unknown }).title,
      note: (body as { note?: unknown }).note,
    });
    const rawTags = (body as { tags?: unknown }).tags;
    const tagInput =
      typeof rawTags === "string" || Array.isArray(rawTags) ? rawTags : undefined;
    const tagResult = normalizeTags(tagInput);
    const errors = { ...fields.errors };
    if (tagResult.error) errors.tags = tagResult.error;
    if (hasFieldErrors(errors)) {
      res.status(400).json({ error: "invalid", fields: errors });
      return;
    }
    const item = createItem(dbOf(req), userIdOf(res), {
      url: fields.values.url,
      title: fields.values.title,
      note: fields.values.note,
      tags: tagResult.tags,
    });
    res.status(201).json(toItemResponse(item));
  });

  router.get("/items/:id", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id == null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const item = getItem(dbOf(req), userIdOf(res), id);
    if (!item) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(200).json(toItemResponse(item));
  });

  router.delete("/items/:id", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id == null) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const ok = removeItem(dbOf(req), userIdOf(res), id);
    if (!ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
