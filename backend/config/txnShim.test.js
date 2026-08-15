// node backend/config/txnShim.test.js
const assert = require("assert");
const { attachTxnShim } = require("./txnShim");

// Minimal fake mysql2 pool: records which connection each query landed on.
function fakePool() {
  const log = [];
  let made = 0;
  let released = 0;
  const pool = {
    query: (sql, cb) => { log.push(["pool", sql]); cb && cb(null, []); },
    getConnection: (cb) => {
      const name = `conn${++made}`;
      cb(null, {
        name,
        query: (sql, qcb) => { log.push([name, sql]); qcb && qcb(null, []); },
        beginTransaction: (bcb) => bcb(null),
        commit: (ccb) => ccb(null),
        rollback: (rcb) => rcb(null),
        release: () => { released++; },
      });
    },
    log,
    get released() { return released; },
  };
  return attachTxnShim(pool, { timeoutMs: 50 });
}

// 1. Outside a transaction, queries go to the pool (i.e. run in parallel).
let db = fakePool();
db.query("a");
assert.deepStrictEqual(db.log, [["pool", "a"]], "query outside txn must hit the pool");

// 2. Inside a transaction, queries are pinned to that transaction's connection, and
//    committing releases it and unpins everything after it.
db.beginTransaction((err) => {
  assert.ifError(err);
  db.query("b");
  assert.deepStrictEqual(db.log[1], ["conn1", "b"], "query inside txn must hit the txn connection");
  db.commit((commitErr) => {
    assert.ifError(commitErr);
    assert.strictEqual(db.released, 1, "commit must release the connection back to the pool");
    db.query("c");
    assert.deepStrictEqual(db.log[2], ["pool", "c"], "query after commit must hit the pool again");
  });
});

// 3. THE 504 REGRESSION: two overlapping transactions must get their own connections,
//    and one request's query must never land inside the other's transaction.
db = fakePool();
db.beginTransaction(() => {
  db.query("first-write");           // must stay on conn1
  db.beginTransaction(() => {
    db.query("second-write");        // must go to conn2, NOT conn1
    assert.deepStrictEqual(db.log[1], ["conn2", "second-write"],
      "a concurrent transaction must not borrow the open transaction's connection");
    db.commit(() => {
      assert.strictEqual(db.released, 1, "committing the second txn must not release the first");
      db.query("second-after");
      assert.deepStrictEqual(db.log[2], ["pool", "second-after"], "second txn is unpinned");
    });
  });
  // Back in the first transaction's context: still pinned, still open.
  db.query("first-still-open");
  assert.deepStrictEqual(db.log[3], ["conn1", "first-still-open"],
    "the first transaction must survive the second one committing");
});

// 4. Committing twice must not release the same connection twice — a double release
//    hands one socket to two requests and desynchronises their callbacks.
db = fakePool();
db.beginTransaction(() => {
  db.commit(() => {});
  db.commit(() => {});
  db.rollback(() => {});
  assert.strictEqual(db.released, 1, "connection must be released exactly once");
});

// 5. An abandoned transaction is rolled back so it cannot leak a pool connection, and
//    the route is told, rather than silently continuing outside the transaction.
db = fakePool();
let queryErr = null;
let commitErr = null;
db.beginTransaction(() => {
  db.query("stuck");
  assert.deepStrictEqual(db.log[0], ["conn1", "stuck"], "txn holds its own connection");
  setTimeout(() => {
    assert.strictEqual(db.released, 1, "abandoned txn must be rolled back and released");
    db.query("after", (e) => { queryErr = e; });
    db.commit((e) => { commitErr = e; });

    assert.strictEqual(queryErr && queryErr.code, "TXN_ABANDONED",
      "queries after an abandoned txn must error, not silently autocommit");
    assert.strictEqual(commitErr && commitErr.code, "TXN_ABANDONED",
      "committing an abandoned txn must report failure, not fake success");
    assert.strictEqual(db.log.length, 1, "no query may run on the released connection");

    console.log("txnShim: all checks passed");
  }, 120);
});
