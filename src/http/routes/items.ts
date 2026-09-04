import { Router } from "express";
import type Database from "better-sqlite3";
import {
  createItem,
  getItem,
  listItems,
  removeItem,
  updateItem,
} from "../../items/repo.js";
import { listTagsForUser, normalizeTags } from "../../items/tags.js";
import { hasFieldErrors, validateItemFields } from "../../items/validate.js";
import { requireUser } from "../middleware/authenticate.js";
import { getSession } from "../middleware/session.js";

function dbOf(req: { app: { locals: Record<string, unknown> } }): Database.Database {
  const db = req.app.locals.db as Database.Database | undefined;
  if (!db) throw new Error("items routes: app.locals.db is missing");
  return db;
}

function userIdOf(res: { locals: { user?: { id: number } } }): number {
  const user = res.locals.user;
  if (!user) throw new Error("items routes: user missing after requireUser");
  return user.id;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function pushFlash(req: Parameters<typeof getSession>[0], msg: string): void {
  const session = getSession(req);
  const list = session.data.flash ? session.data.flash.slice() : [];
  list.push(msg);
  session.data.flash = list;
}

function takeFlash(req: Parameters<typeof getSession>[0]): string[] {
  const session = getSession(req);
  const list = session.data.flash ? session.data.flash.slice() : [];
  session.data.flash = [];
  return list;
}

function parseId(raw: string): number | null {
  if (!/^[0-9]+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

/**
 * HTML CRUD for saved items, including ?tag= and ?q= filters.
 */
export function itemsRouter(): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", (req, res) => {
    const db = dbOf(req);
    const uid = userIdOf(res);
    const tag = str(req.query.tag).trim();
    const q = str(req.query.q).trim();
    const items = listItems(db, uid, {
      tag: tag || undefined,
      q: q || undefined,
    });
    const tags = listTagsForUser(db, uid);
    res.render("items/index", {
      title: "Items",
      items,
      tags,
      filterTag: tag,
      filterQ: q,
      flash: takeFlash(req),
    });
  });

  router.get("/new", (_req, res) => {
    res.render("items/form", {
      title: "New item",
      mode: "new",
      action: "/items",
      item: { url: "", title: "", note: "", tags: [] as string[] },
      errors: {},
      tagInput: "",
    });
  });

  router.post("/", (req, res) => {
    const db = dbOf(req);
    const uid = userIdOf(res);
    const fields = validateItemFields({
      url: req.body?.url,
      title: req.body?.title,
      note: req.body?.note,
    });
    const tagResult = normalizeTags(str(req.body?.tags));
    const errors = { ...fields.errors };
    if (tagResult.error) errors.tags = tagResult.error;
    if (hasFieldErrors(errors)) {
      res.status(400).render("items/form", {
        title: "New item",
        mode: "new",
        action: "/items",
        item: {
          url: fields.values.url,
          title: fields.values.title,
          note: fields.values.note,
          tags: tagResult.tags,
        },
        errors,
        tagInput: str(req.body?.tags),
      });
      return;
    }
    createItem(db, uid, {
      url: fields.values.url,
      title: fields.values.title,
      note: fields.values.note,
      tags: tagResult.tags,
    });
    pushFlash(req, "Item saved.");
    res.redirect(302, "/items");
  });

  router.get("/:id/edit", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id == null) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That item is not here.",
      });
      return;
    }
    const item = getItem(dbOf(req), userIdOf(res), id);
    if (!item) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That item is not here.",
      });
      return;
    }
    res.render("items/form", {
      title: "Edit item",
      mode: "edit",
      action: `/items/${item.id}`,
      item,
      errors: {},
      tagInput: item.tags.join(", "),
    });
  });

  router.post("/:id", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id == null) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That item is not here.",
      });
      return;
    }
    const db = dbOf(req);
    const uid = userIdOf(res);
    const existing = getItem(db, uid, id);
    if (!existing) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That item is not here.",
      });
      return;
    }
    const fields = validateItemFields({
      url: req.body?.url,
      title: req.body?.title,
      note: req.body?.note,
    });
    const tagResult = normalizeTags(str(req.body?.tags));
    const errors = { ...fields.errors };
    if (tagResult.error) errors.tags = tagResult.error;
    if (hasFieldErrors(errors)) {
      res.status(400).render("items/form", {
        title: "Edit item",
        mode: "edit",
        action: `/items/${id}`,
        item: {
          id,
          url: fields.values.url,
          title: fields.values.title,
          note: fields.values.note,
          tags: tagResult.tags,
        },
        errors,
        tagInput: str(req.body?.tags),
      });
      return;
    }
    updateItem(db, uid, id, {
      url: fields.values.url,
      title: fields.values.title,
      note: fields.values.note,
      tags: tagResult.tags,
    });
    pushFlash(req, "Item updated.");
    res.redirect(302, "/items");
  });

  router.post("/:id/delete", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id == null) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That item is not here.",
      });
      return;
    }
    const ok = removeItem(dbOf(req), userIdOf(res), id);
    if (!ok) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That item is not here.",
      });
      return;
    }
    pushFlash(req, "Item removed.");
    res.redirect(302, "/items");
  });

  return router;
}
