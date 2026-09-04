'use strict';

/**
 * Legacy SQL compiler.
 *
 * Builds parameterized statements from a tiny template language:
 *   :name     → "?"  (value is pushed onto params; never spliced)
 *   {{ident}} → identifier, only if it matches /^[a-z_][a-z0-9_]*$/
 *
 * Missing :name throws QueryError. Values containing quotes or comment
 * markers stay in the params array. This file is wrapped, not rewritten.
 */

function QueryError(message, token) {
  var err = Error.call(this, message);
  this.name = 'QueryError';
  this.message = message || 'query error';
  this.token = token;
  if (err && err.stack) this.stack = err.stack;
  if (typeof Error.captureStackTrace === 'function') {
    Error.captureStackTrace(this, QueryError);
  }
}

QueryError.prototype = Object.create(Error.prototype);
QueryError.prototype.constructor = QueryError;

var IDENT_RE = /^[a-z_][a-z0-9_]*$/;
var NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
var TOKEN_RE = /\{\{([^}]*)\}\}|:([a-zA-Z_][a-zA-Z0-9_]*)/g;

function assertIdent(name, kind) {
  if (typeof name !== 'string' || !IDENT_RE.test(name)) {
    throw new QueryError('invalid ' + (kind || 'identifier'), name);
  }
  return name;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function compile(template, params) {
  if (typeof template !== 'string') {
    throw new QueryError('compile: template must be a string', undefined);
  }
  var bag = params && typeof params === 'object' ? params : {};
  var outParams = [];
  var sql = template.replace(TOKEN_RE, function onToken(match, ident, name) {
    if (ident !== undefined && match.charAt(0) === '{') {
      if (!IDENT_RE.test(ident)) {
        throw new QueryError('invalid identifier', ident);
      }
      return ident;
    }
    if (!name || !NAME_RE.test(name)) {
      throw new QueryError('invalid parameter name', name);
    }
    if (!hasOwn(bag, name)) {
      throw new QueryError('missing parameter :' + name, name);
    }
    outParams.push(bag[name]);
    return '?';
  });
  return { sql: sql, params: outParams };
}

function keysOf(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new QueryError('row must be a plain object', undefined);
  }
  var keys = Object.keys(row);
  if (keys.length === 0) {
    throw new QueryError('row must have at least one column', undefined);
  }
  return keys;
}

function insert(table, row) {
  assertIdent(table, 'table');
  var keys = keysOf(row);
  var cols = [];
  var placeholders = [];
  var params = [];
  var i;
  for (i = 0; i < keys.length; i++) {
    var col = keys[i];
    assertIdent(col, 'column');
    cols.push(col);
    placeholders.push('?');
    params.push(row[col]);
  }
  var sql =
    'INSERT INTO ' +
    table +
    ' (' +
    cols.join(', ') +
    ') VALUES (' +
    placeholders.join(', ') +
    ')';
  return { sql: sql, params: params };
}

function update(table, row, whereTemplate, whereParams) {
  assertIdent(table, 'table');
  var keys = keysOf(row);
  var sets = [];
  var params = [];
  var i;
  for (i = 0; i < keys.length; i++) {
    var col = keys[i];
    assertIdent(col, 'column');
    sets.push(col + ' = ?');
    params.push(row[col]);
  }
  if (typeof whereTemplate !== 'string' || whereTemplate.length === 0) {
    throw new QueryError('update: where template required', undefined);
  }
  var where = compile(whereTemplate, whereParams || {});
  var sql = 'UPDATE ' + table + ' SET ' + sets.join(', ') + ' WHERE ' + where.sql;
  return { sql: sql, params: params.concat(where.params) };
}

function whereIn(column, values) {
  assertIdent(column, 'column');
  if (!Array.isArray(values) || values.length === 0) {
    return { sql: '0=1', params: [] };
  }
  var placeholders = [];
  var params = [];
  var i;
  for (i = 0; i < values.length; i++) {
    placeholders.push('?');
    params.push(values[i]);
  }
  return {
    sql: column + ' IN (' + placeholders.join(',') + ')',
    params: params
  };
}

module.exports = {
  compile: compile,
  insert: insert,
  update: update,
  whereIn: whereIn,
  QueryError: QueryError
};
