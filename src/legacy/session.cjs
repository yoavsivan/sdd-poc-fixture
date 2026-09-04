'use strict';

/**
 * Legacy session middleware.
 *
 * CommonJS, callbacks, a hand-rolled HMAC-signed cookie, and an in-memory
 * store with an unref'd sweep timer. Modern TypeScript wraps this file; it
 * is not rewritten. Cookie name defaults to shelfmark.sid.
 *
 * Tampered or malformed signed values return null from unsignCookie.
 */

var crypto = require('crypto');

var DEFAULT_COOKIE_NAME = 'shelfmark.sid';
var DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
var DEFAULT_SWEEP_MS = 60 * 1000;
var SID_BYTES = 16;
var HMAC_ALGO = 'sha256';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

function safeDecode(value) {
  if (typeof value !== 'string') return '';
  try {
    return decodeURIComponent(value);
  } catch (err) {
    return value;
  }
}

function parseCookies(header) {
  var out = Object.create(null);
  if (header == null) return out;
  if (typeof header !== 'string') return out;
  if (header.length === 0) return out;
  var chunks = header.split(';');
  var i;
  for (i = 0; i < chunks.length; i++) {
    var piece = chunks[i];
    if (!piece) continue;
    var trimmed = piece.trim();
    if (!trimmed) continue;
    var eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    var key = trimmed.slice(0, eq).trim();
    var raw = trimmed.slice(eq + 1).trim();
    if (raw.charAt(0) === '"' && raw.charAt(raw.length - 1) === '"' && raw.length >= 2) {
      raw = raw.slice(1, -1);
    }
    if (!key) continue;
    out[key] = safeDecode(raw);
  }
  return out;
}

function signCookie(value, secret) {
  if (!isNonEmptyString(value)) {
    throw new TypeError('signCookie: value must be a non-empty string');
  }
  if (!isNonEmptyString(secret)) {
    throw new TypeError('signCookie: secret must be a non-empty string');
  }
  var hmac = crypto.createHmac(HMAC_ALGO, secret);
  hmac.update(value, 'utf8');
  var digest = hmac.digest('base64url');
  return value + '.' + digest;
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  var bufA = Buffer.from(a);
  var bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function unsignCookie(signed, secret) {
  if (typeof signed !== 'string' || signed.length === 0) return null;
  if (typeof secret !== 'string' || secret.length === 0) return null;
  var lastDot = signed.lastIndexOf('.');
  if (lastDot <= 0) return null;
  if (lastDot === signed.length - 1) return null;
  var value = signed.slice(0, lastDot);
  var sig = signed.slice(lastDot + 1);
  if (!value || !sig) return null;
  if (value.indexOf('.') !== -1) {
    // sid is hex; a stray extra dot is malformed
    if (!/^[a-f0-9]+$/i.test(value)) {
      // still allow the value if hmac matches, but reject empty segments
      if (value.charAt(0) === '.' || value.charAt(value.length - 1) === '.') return null;
    }
  }
  var expected;
  try {
    var hmac = crypto.createHmac(HMAC_ALGO, secret);
    hmac.update(value, 'utf8');
    expected = hmac.digest('base64url');
  } catch (err) {
    return null;
  }
  if (!timingSafeEqualStr(sig, expected)) return null;
  return value;
}

function MemoryStore(opts) {
  opts = opts || {};
  this._map = Object.create(null);
  this._sweepIntervalMs = opts.sweepIntervalMs == null ? DEFAULT_SWEEP_MS : Number(opts.sweepIntervalMs);
  this._timer = null;
  var self = this;
  if (this._sweepIntervalMs > 0 && typeof setInterval === 'function') {
    this._timer = setInterval(function onSweepTick() {
      self.sweep(Date.now());
    }, this._sweepIntervalMs);
    if (this._timer && typeof this._timer.unref === 'function') {
      this._timer.unref();
    }
  }
}

MemoryStore.prototype.size = function size() {
  var n = 0;
  var key;
  for (key in this._map) {
    if (Object.prototype.hasOwnProperty.call(this._map, key)) n += 1;
  }
  return n;
};

MemoryStore.prototype.get = function get(sid, cb) {
  if (typeof cb !== 'function') {
    throw new TypeError('MemoryStore.get requires a callback');
  }
  if (typeof sid !== 'string' || sid.length === 0) {
    cb(null, undefined, undefined);
    return;
  }
  var rec = this._map[sid];
  if (!rec) {
    cb(null, undefined, undefined);
    return;
  }
  var now = Date.now();
  if (typeof rec.expiresAt === 'number' && rec.expiresAt <= now) {
    delete this._map[sid];
    cb(null, undefined, undefined);
    return;
  }
  var data = rec.data;
  var copy;
  try {
    copy = JSON.parse(JSON.stringify(data));
  } catch (err) {
    copy = data;
  }
  cb(null, copy, rec.expiresAt);
};

MemoryStore.prototype.set = function set(sid, data, ttlMs, cb) {
  if (typeof cb !== 'function') {
    throw new TypeError('MemoryStore.set requires a callback');
  }
  if (typeof sid !== 'string' || sid.length === 0) {
    cb(new Error('MemoryStore.set: sid required'));
    return;
  }
  var ttl = Number(ttlMs);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    cb(new Error('MemoryStore.set: ttlMs must be a positive number'));
    return;
  }
  var stored;
  try {
    stored = JSON.parse(JSON.stringify(data || {}));
  } catch (err) {
    stored = data || {};
  }
  this._map[sid] = {
    data: stored,
    expiresAt: Date.now() + ttl,
    updatedAt: Date.now()
  };
  cb(null);
};

MemoryStore.prototype.destroy = function destroy(sid, cb) {
  if (typeof cb !== 'function') {
    throw new TypeError('MemoryStore.destroy requires a callback');
  }
  if (typeof sid === 'string' && sid.length > 0) {
    delete this._map[sid];
  }
  cb(null);
};

MemoryStore.prototype.sweep = function sweep(now) {
  var ts = typeof now === 'number' ? now : Date.now();
  var removed = 0;
  var key;
  var rec;
  for (key in this._map) {
    if (!Object.prototype.hasOwnProperty.call(this._map, key)) continue;
    rec = this._map[key];
    if (!rec || typeof rec.expiresAt !== 'number' || rec.expiresAt <= ts) {
      delete this._map[key];
      removed += 1;
    }
  }
  return removed;
};

MemoryStore.prototype.stop = function stop() {
  if (this._timer) {
    clearInterval(this._timer);
    this._timer = null;
  }
};

function randomSid() {
  return crypto.randomBytes(SID_BYTES).toString('hex');
}

function cookiePair(name, value, maxAgeMs, secure, expired) {
  var parts = [];
  parts.push(name + '=' + (expired ? '' : encodeURIComponent(value)));
  parts.push('Path=/');
  parts.push('HttpOnly');
  parts.push('SameSite=Lax');
  if (expired) {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  } else {
    var seconds = Math.floor(Number(maxAgeMs) / 1000);
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    parts.push('Max-Age=' + seconds);
  }
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function replaceSetCookie(res, name, pair) {
  var prev = res.getHeader('Set-Cookie');
  var list;
  if (!prev) {
    list = [];
  } else if (Array.isArray(prev)) {
    list = prev.slice();
  } else {
    list = [String(prev)];
  }
  var prefix = name + '=';
  var kept = [];
  var i;
  for (i = 0; i < list.length; i++) {
    var item = String(list[i]);
    if (item.slice(0, prefix.length) === prefix) continue;
    kept.push(item);
  }
  kept.push(pair);
  res.setHeader('Set-Cookie', kept);
}

function createSession(id, data, isNew, opts) {
  var session = {
    id: id,
    data: data || {},
    isNew: !!isNew,
    destroyed: false,
    save: function save(cb) {
      var done = typeof cb === 'function' ? cb : function noop() {};
      if (session.destroyed) {
        done(null);
        return;
      }
      opts.store.set(session.id, session.data, opts.maxAgeMs, function afterSet(err) {
        if (err) {
          done(err);
          return;
        }
        var signed = signCookie(session.id, opts.secret);
        replaceSetCookie(
          opts.res,
          opts.cookieName,
          cookiePair(opts.cookieName, signed, opts.maxAgeMs, opts.secure, false)
        );
        done(null);
      });
    },
    regenerate: function regenerate(cb) {
      var done = typeof cb === 'function' ? cb : function noop() {};
      var kept = session.data;
      var oldId = session.id;
      opts.store.destroy(oldId, function afterDestroy(err) {
        if (err) {
          done(err);
          return;
        }
        session.id = randomSid();
        session.data = kept || {};
        session.isNew = true;
        session.destroyed = false;
        session.save(done);
      });
    },
    destroy: function destroy(cb) {
      var done = typeof cb === 'function' ? cb : function noop() {};
      session.destroyed = true;
      opts.store.destroy(session.id, function afterDestroy(err) {
        if (err) {
          done(err);
          return;
        }
        session.data = {};
        session.isNew = true;
        replaceSetCookie(
          opts.res,
          opts.cookieName,
          cookiePair(opts.cookieName, '', 0, opts.secure, true)
        );
        done(null);
      });
    }
  };
  return session;
}

function wrapEndToSave(req, res, session) {
  if (res._shelfmarkEndWrapped) return;
  res._shelfmarkEndWrapped = true;
  var originalEnd = res.end;
  res.end = function patchedEnd() {
    var args = arguments;
    var self = this;
    if (res._shelfmarkSessionFlushed) {
      return originalEnd.apply(self, args);
    }
    res._shelfmarkSessionFlushed = true;
    if (!req.session || req.session.destroyed) {
      return originalEnd.apply(self, args);
    }
    req.session.save(function afterSave() {
      originalEnd.apply(self, args);
    });
  };
}

function createSessionMiddleware(opts) {
  if (!opts || !isNonEmptyString(opts.secret)) {
    throw new Error('createSessionMiddleware: opts.secret is required');
  }
  var secret = opts.secret;
  var cookieName = isNonEmptyString(opts.cookieName) ? opts.cookieName : DEFAULT_COOKIE_NAME;
  var maxAgeMs = opts.maxAgeMs == null ? DEFAULT_MAX_AGE_MS : Number(opts.maxAgeMs);
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    maxAgeMs = DEFAULT_MAX_AGE_MS;
  }
  var secure = !!opts.secure;
  var store = opts.store || new MemoryStore();

  return function sessionMiddleware(req, res, next) {
    var cookies = parseCookies(req.headers && req.headers.cookie);
    var signed = cookies[cookieName];
    var sid = null;
    var hadCookie = typeof signed === 'string' && signed.length > 0;
    if (hadCookie) {
      sid = unsignCookie(signed, secret);
    }

    var shared = {
      secret: secret,
      cookieName: cookieName,
      maxAgeMs: maxAgeMs,
      secure: secure,
      store: store,
      res: res
    };

    function attach(id, data, isNew, replaceBad) {
      var session = createSession(id, data || {}, isNew, shared);
      req.session = session;
      wrapEndToSave(req, res, session);
      if (replaceBad) {
        session.save(function afterReplace(err) {
          if (err) {
            next(err);
            return;
          }
          next();
        });
        return;
      }
      next();
    }

    if (!hadCookie) {
      attach(randomSid(), {}, true, false);
      return;
    }

    if (!sid) {
      attach(randomSid(), {}, true, true);
      return;
    }

    store.get(sid, function afterGet(err, data) {
      if (err) {
        next(err);
        return;
      }
      if (data === undefined) {
        attach(randomSid(), {}, true, true);
        return;
      }
      attach(sid, data, false, false);
    });
  };
}

module.exports = {
  createSessionMiddleware: createSessionMiddleware,
  signCookie: signCookie,
  unsignCookie: unsignCookie,
  parseCookies: parseCookies,
  MemoryStore: MemoryStore
};
