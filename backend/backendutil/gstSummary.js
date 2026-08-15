// Modes that charge no GST at all — they differ only in the terms line they print.
const NO_TAX_MODES = ["Exempt", "Tax Extra", "Without GST"];

// Single source of truth for the summary box (backend PDF + email).
// Exclusive: enters 1000 -> subtotal 1000, GST 180, grand 1180
// Inclusive: enters 1000 -> subtotal  820, GST 180, grand 1000
// Exempt:    enters 1000 -> subtotal 1000, GST   0, grand 1000
// ponytail: mirror of frontend/src/utils/invoicecal.js gstSummary — keep both in sync.
function gstSummary(h = {}, rows = []) {
  const num = (v) => Number(v) || 0;
  const qtyOf = (r) => num(r.quantity !== undefined ? r.quantity : r.qty);
  const items = rows || [];

  const base = items.reduce((s, r) => s + qtyOf(r) * num(r.price), 0) || num(h.subtotal);
  const discount = num(h.total_discount) || items.reduce((s, r) => s + num(r.discount), 0);
  const storedGst = num(h.total_cgst) + num(h.total_sgst) + num(h.total_igst);
  const rowGst = items.reduce(
    (s, r) => s + ((qtyOf(r) * num(r.price) - num(r.discount)) * num(r.tax)) / 100,
    0
  );

  const mode =
    h.gst_mode ||
    (storedGst > 0 && Math.abs(num(h.grand_total) - num(h.subtotal)) < 1 ? "Inclusive" : "Exclusive");

  const exempt = NO_TAX_MODES.includes(mode);
  const gstAmount = exempt ? 0 : (storedGst > 0 ? storedGst : rowGst);
  const net = base - discount;

  const subtotal = mode === "Inclusive" ? Math.max(net - gstAmount, 0) : net;
  const grandTotal = mode === "Exclusive" ? net + gstAmount : net;

  return {
    mode,
    subtotal: +subtotal.toFixed(2),
    discount: +discount.toFixed(2),
    gstAmount: +gstAmount.toFixed(2),
    grandTotal: +grandTotal.toFixed(2),
  };
}

module.exports = { gstSummary, NO_TAX_MODES };
