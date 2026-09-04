/**
 * Hand-written types for the CommonJS legacy SQL compiler.
 * Runtime lives in query.cjs and is not compiled.
 *
 * Missing :name throws QueryError. {{ident}} must match /^[a-z_][a-z0-9_]*$/
 * or QueryError is thrown. Values are never spliced into the SQL string.
 */

export interface Compiled {
  sql: string;
  params: unknown[];
}

export declare class QueryError extends Error {
  token?: string;
  constructor(message: string, token?: string);
}

/**
 * Replace :name with "?" in appearance order (repeats allowed) and splice
 * {{ident}} after a whitelist check.
 */
export function compile(template: string, params?: Record<string, unknown>): Compiled;

export function insert(table: string, row: Record<string, unknown>): Compiled;

export function update(
  table: string,
  row: Record<string, unknown>,
  whereTemplate: string,
  whereParams: Record<string, unknown>,
): Compiled;

/** Empty values yield `{ sql: "0=1", params: [] }`. */
export function whereIn(column: string, values: unknown[]): Compiled;

declare const legacyQuery: {
  compile: typeof compile;
  insert: typeof insert;
  update: typeof update;
  whereIn: typeof whereIn;
  QueryError: typeof QueryError;
};

export default legacyQuery;
