// node backend/backendutil/gstSummary.test.js
const assert = require("assert");
const { gstSummary } = require("./gstSummary");

const rows = [{ quantity: 1, price: 1000, tax: 18 }];
const eq = (mode, want) => {
  const s = gstSummary({ gst_mode: mode }, rows);
  assert.deepStrictEqual(
    { subtotal: s.subtotal, gstAmount: s.gstAmount, grandTotal: s.grandTotal },
    want,
    `${mode}: ${JSON.stringify(s)}`
  );
  assert.ok(s.gstAmount === 0 || s.subtotal !== s.grandTotal, `${mode}: subtotal === grand total`);
};

eq("Exclusive", { subtotal: 1000, gstAmount: 180, grandTotal: 1180 });
eq("Inclusive", { subtotal: 820, gstAmount: 180, grandTotal: 1000 });
eq("Exempt", { subtotal: 1000, gstAmount: 0, grandTotal: 1000 });
eq("Tax Extra", { subtotal: 1000, gstAmount: 0, grandTotal: 1000 });

// legacy row with no gst_mode but stored totals -> inclusive heuristic
const legacy = gstSummary({ subtotal: 1000, grand_total: 1000, total_cgst: 90, total_sgst: 90 }, rows);
assert.strictEqual(legacy.mode, "Inclusive");
assert.strictEqual(legacy.subtotal, 820);

// discount applies before GST
const d = gstSummary({ gst_mode: "Exclusive", total_discount: 100 }, rows);
assert.strictEqual(d.grandTotal, 1080);

console.log("gstSummary ok");
