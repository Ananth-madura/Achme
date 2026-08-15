"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");

// ponytail: a transaction needs one dedicated connection for its whole begin..commit
// window, but the call sites in routes/ say `db.beginTransaction(...)` / `db.query(...)` /
// `db.commit(...)` with no connection handle. So the connection is carried in
// AsyncLocalStorage: every query issued inside a request's transaction lands on that
// request's own connection, and every other request keeps using the pool in parallel.
//
// Do NOT go back to a module-level `let conn`. That funnels unrelated requests' queries
// onto whichever transaction happens to be open, then releases that connection back to
// the pool while those queries are still in flight — two requests end up sharing one
// mysql2 command queue, callbacks get lost, the handler never sends a response, and
// nginx turns it into a 504.
//
// Ceiling: only covers call sites that stay inside the beginTransaction callback (async
// context does not survive `await` on a promise resolved elsewhere). Routes that need a
// promise-style transaction should hold their own pool.getConnection() — see the
// /import route in routes/newclient.js.
// Upgrade path: pass an explicit connection at the remaining call sites, delete this file.

// Under nginx's 120s proxy_read_timeout, so a stuck transaction surfaces as a clean
// error instead of a gateway timeout.
const TXN_TIMEOUT_MS = 60000;

function attachTxnShim(pool, { timeoutMs = TXN_TIMEOUT_MS } = {}) {
  const poolQuery = pool.query.bind(pool);
  const storage = new AsyncLocalStorage();

  const abandoned = () =>
    Object.assign(new Error("Transaction was rolled back after exceeding the time limit"), {
      code: "TXN_ABANDONED",
    });

  // pool.promise() dispatches through pool.query at call time, so overriding it here
  // also covers every `db.promise().query(...)` caller.
  pool.query = (...args) => {
    const txn = storage.getStore();
    if (txn && txn.abandoned) {
      // Silently falling through to the pool would run the rest of a rolled-back
      // transaction as unrelated autocommitted writes. Fail loudly instead.
      const cb = args[args.length - 1];
      if (typeof cb === "function") return cb(abandoned());
      throw abandoned();
    }
    if (txn && !txn.done) {
      const lastIdx = args.length - 1;
      if (typeof args[lastIdx] === "function") {
        const fn = args[lastIdx];
        args[lastIdx] = (...cbArgs) => storage.run(txn, () => fn(...cbArgs));
      }
      return txn.conn.query(...args);
    }
    return poolQuery(...args);
  };

  // Releasing a connection twice hands the same socket to two requests, so every exit
  // path routes through here and only the first one wins.
  const finish = (method, cb) => {
    const txn = storage.getStore();
    if (!txn || txn.done) {
      // Reporting success for a transaction that was rolled back out from under the
      // route would silently lose the write.
      return cb && cb(txn && txn.abandoned ? abandoned() : null);
    }
    txn.done = true;
    clearTimeout(txn.timer);
    txn.conn[method]((err) => {
      txn.conn.release();
      if (cb) cb(err);
    });
  };

  pool.beginTransaction = (cb) => {
    pool.getConnection((err, conn) => {
      if (err) return cb(err);
      conn.beginTransaction((txnErr) => {
        if (txnErr) {
          conn.release();
          return cb(txnErr);
        }
        const txn = { conn, done: false, abandoned: false, timer: null };
        // A route that throws before commit/rollback would otherwise hold this
        // connection out of the pool forever; 15 of those exhaust it for everyone.
        txn.timer = setTimeout(() => {
          if (txn.done) return;
          console.error("⚠️ Transaction abandoned — rolling back to free the connection.");
          txn.done = true;
          txn.abandoned = true;
          conn.rollback(() => conn.release());
        }, timeoutMs);
        if (txn.timer.unref) txn.timer.unref();
        storage.run(txn, () => cb(null));
      });
    });
  };

  pool.commit = (cb) => finish("commit", cb);
  pool.rollback = (cb) => finish("rollback", cb);

  return pool;
}

module.exports = { attachTxnShim };
