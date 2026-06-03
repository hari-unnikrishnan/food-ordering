export function buildUpiPayUrl({ amount, upiId }) {
  const amt = Number(amount || 0).toFixed(2);
  const pa = encodeURIComponent(upiId || "merchant@upi");
  // Your required format
  return `upi://pay?am=${amt}&pa=${pa}`;
}

