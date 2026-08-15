// utils/invoicecal.js

// Modes that charge no GST at all — they differ only in the terms line they print.
export const NO_TAX_MODES = ["Exempt", "Tax Extra", "Without GST"];

// Single source of truth for the summary box (preview, download, backend PDF/email).
// Exclusive: enters 1000 -> subtotal 1000, GST 180, grand 1180
// Inclusive: enters 1000 -> subtotal  820, GST 180, grand 1000
// Exempt:    enters 1000 -> subtotal 1000, GST   0, grand 1000
// ponytail: duplicated in backend/backendutil/gstSummary.js (CJS) — keep both in sync.
export const gstSummary = (h = {}, rows = []) => {
  const num = (v) => Number(v) || 0;
  const qtyOf = (r) => num(r.quantity !== undefined ? r.quantity : r.qty);

  const base = rows.reduce((s, r) => s + qtyOf(r) * num(r.price), 0) || num(h.subtotal);
  const discount = num(h.total_discount) || rows.reduce((s, r) => s + num(r.discount), 0);
  const storedGst = num(h.total_cgst) + num(h.total_sgst) + num(h.total_igst);
  const rowGst = rows.reduce(
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
};

export const calculateTotals = (items = [], gstMode = "Exclusive") => {
  let subtotal = 0;
  let total_discount = 0;
  let total_cgst = 0;
  let total_sgst = 0;
  let total_igst = 0;

  items.forEach(item => {
    const price = Number(item.price) || 0;
    const qty = Number(item.qty) || 0;
    const discount = Number(item.discount) || 0;
    const gstPercent = Number(item.tax) || 0;

    const base = price * qty;
    const afterDiscount = base - discount;

    if (NO_TAX_MODES.includes(gstMode)) {
      subtotal += base;
      total_discount += discount;
      return;
    }

    if (gstMode === "Inclusive") {
      const gstAmount = (afterDiscount * gstPercent) / 100;
      subtotal += base;
      total_discount += discount;
      total_cgst += gstAmount / 2;
      total_sgst += gstAmount / 2;
    } else {
      const gstAmount = (afterDiscount * gstPercent) / 100;
      subtotal += base;
      total_discount += discount;
      total_cgst += gstAmount / 2;
      total_sgst += gstAmount / 2;
    }
  });

  const gstAmount = total_cgst + total_sgst;

  const grand_total =
    NO_TAX_MODES.includes(gstMode) || gstMode === "Inclusive"
      ? subtotal - total_discount
      : subtotal - total_discount + gstAmount;

  return {
    subtotal: +subtotal.toFixed(2),
    total_discount: +total_discount.toFixed(2),
    total_cgst: +total_cgst.toFixed(2),
    total_sgst: +total_sgst.toFixed(2),
    total_igst: +total_igst.toFixed(2),
    grand_total: +grand_total.toFixed(2),
  };
};

export const calculateItemTotal = (item, gstMode = "Exclusive") => {
  const price = Number(item.price || item.unit_price) || 0;
  const qty = Number(item.qty || item.quantity) || 0;
  const discount = Number(item.discount) || 0;
  const gstPercent = Number(item.tax) || 0;

  const base = price * qty;
  const afterDiscount = base - discount;

  if (NO_TAX_MODES.includes(gstMode)) return +afterDiscount.toFixed(2);

  if (gstMode === "Inclusive") {
    return +(afterDiscount).toFixed(2);
  }

  const gstAmount = (afterDiscount * gstPercent) / 100;
  return +(afterDiscount + gstAmount).toFixed(2);
};
