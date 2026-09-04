import path from "node:path";
import { fileURLToPath } from "node:url";
import ejs from "ejs";
import type { Express } from "express";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "..", "..");
export const viewsDir = path.join(repoRoot, "src", "views");
export const publicDir = path.join(repoRoot, "src", "public");

function isLayout(filePath: string): boolean {
  return path.resolve(filePath) === path.join(viewsDir, "layout.ejs");
}

/**
 * Point Express at the EJS templates under src/views and wrap pages in layout.ejs.
 */
export function configureViews(app: Express): void {
  const layoutFile = path.join(viewsDir, "layout.ejs");
  app.engine("ejs", (filePath: string, options: object, callback: (e: Error | null, html?: string) => void) => {
    const opts = options as Record<string, unknown> & { layout?: boolean };
    ejs.renderFile(filePath, opts, { filename: filePath }, (err, html) => {
      if (err) {
        callback(err);
        return;
      }
      if (opts.layout === false || isLayout(filePath)) {
        callback(null, html);
        return;
      }
      ejs.renderFile(
        layoutFile,
        { ...opts, body: html },
        { filename: layoutFile },
        callback,
      );
    });
  });
  app.set("views", viewsDir);
  app.set("view engine", "ejs");
}
