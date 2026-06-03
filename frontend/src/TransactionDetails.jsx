// import "./POSDashboard.css";
// import "./POSDashboard_statusbar.css";
import "./TransactionDetails.css";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import QRCode from "qrcode";

import { buildUpiPayUrl } from "./upiString";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

function maskCardNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  const last4 = digits.slice(-4);
  return `**** ***78 8945 ${last4}`;
}

export default function TransactionDetails() {
  const [order, setOrder] = useState(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);

  // Customer/order UI state
  const CUSTOMER_NAME = "Ariel Hikmat";

  // Payment UI state
  const [paymentMethod, setPaymentMethod] = useState("UPI"); // UPI | GPay | Card | Cash
  const [upiId, setUpiId] = useState("hariunnikrishnan16-1@oksbi");
  const [cardNumber, setCardNumber] = useState("");

  // Payment loading/success simulation



  // Back to POS
  function goBack() {
    window.history.back();
  }

  const location = useLocation();
  const navigate = useNavigate();

  const {
    amount: navAmount,
    order: navOrder,
    orderType: navOrderType,
    deliveryAddress: navDeliveryAddress,
  } = location.state || {};

  // NOTE: avoid treating 0 as "missing"; amount can legitimately be 0 in some cases.
  const amount = navAmount !== undefined && navAmount !== null ? navAmount : 0;
  const orderFromState = navOrder;

  // Load order from location state if provided
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setIsLoadingOrder(true);

        // Prefer order passed from navigation state
        if (orderFromState) {
          if (mounted) setOrder(orderFromState);
          return;
        }

        // Fallback: load order by orderId (for direct navigation / refresh)
        const orderId = location.state?.orderId;
        if (!orderId) return;

        const res = await fetch(`${API_BASE}/orders/${orderId}/`);
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setOrder(data);
      } finally {
        if (mounted) setIsLoadingOrder(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [location.state, orderFromState]);

  // Derive amount from backend (fallback); otherwise prefer navigation-passed amount.
  const amountToPay = useMemo(() => {
    const navAmount = amount;
    if (navAmount !== undefined && navAmount !== null) {
      const n = Number(navAmount);
      return Number.isNaN(n) ? 0 : n;
    }

    const t = order?.total;
    const n = Number(t);
    return Number.isNaN(n) ? 0 : n;
  }, [amount, order]);

  const upiPayUrl = useMemo(() => {
    return buildUpiPayUrl({ amount: amountToPay, upiId: upiId || "hariunnikrishnan16-1@oksbi" });
  }, [amountToPay, upiId]);

  const cardPayload = useMemo(() => {
    return `PAYMENT|CARD|AMOUNT=${amountToPay.toFixed(2)}`;
  }, [amountToPay]);

  // Payment UI state machine
  const [paymentStatus, setPaymentStatus] = useState("pending"); // pending | success

  // Render QR whenever UPI/GPay selected
  useEffect(() => {
    async function renderQr() {
      if (paymentMethod === "Card") return;
      if (paymentStatus !== "pending") return; // hide QR after success

      const canvas = document.getElementById("upi-qr");
      if (!canvas) return;

      const size = 160;
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

      try {
        await QRCode.toCanvas(canvas, upiPayUrl, {
          width: size,
          margin: 1,
          errorCorrectionLevel: "M",
        });
      } catch (e) {
        console.error("QR render failed", e);
      }
    }

    renderQr();
  }, [upiPayUrl, paymentMethod, paymentStatus]);

  // Auto-check payment (simulated for now)
  useEffect(() => {
    if (paymentStatus === "success") return;

    if (!order) return;
    if (paymentMethod === "Card") return; // only for QR payments

    setPaymentStatus("pending");

    const timer = setTimeout(() => {
      setPaymentStatus("success");
    }, 3000);

    return () => clearTimeout(timer);
  }, [order, paymentMethod, paymentStatus]);


  // Delivery auto-redirect only after payment success
  useEffect(() => {
    if (paymentStatus !== "success") return;
    if (navOrderType !== "DELIVERY") return;

    const timer = setTimeout(() => {
      navigate("/delivery-tracking", {
        state: {
          amount,
          order: orderFromState || order,
          deliveryAddress: navDeliveryAddress,
        },
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [paymentStatus, navOrderType, navDeliveryAddress, amount, orderFromState, order, navigate]);

  const paymentScanText = useMemo(() => {
    if (paymentMethod === "Card") {
      return cardPayload;
    }
    return `Amount: ${amountToPay.toFixed(2)}`;
  }, [paymentMethod, cardPayload, amountToPay, upiId]);


  if (isLoadingOrder) {
        return (
          <div className="dashboard-container">
            <div
              className="dashboard-box"
              style={{ gridTemplateColumns: "1fr" }}
            >
              <div className="order-panel">
                <h2>Loading transaction details...</h2>
              </div>
            </div>
          </div>
        );
      }

  return (
   
  <div className="trans-page">

    <div className="trans-layout">

      <div className="trans-card">

        {/* HEADER */}
        <div className="trans-header">

          <span
            className="trans-back"
            onClick={goBack}
            role="button"
            tabIndex={0}
          >
            ←
          </span>

          <h2 className="trans-heading">
            Transaction Details
          </h2>

        </div>

        {/* ORDER SUMMARY */}
        <div className="trans-summary">

          <div className="trans-item">

            <h2>{CUSTOMER_NAME}</h2>

            <span>
              Order # : {order?.id ?? "N/A"}
            </span>

          </div>

          <div className="trans-item">

            <span>Tracking Code</span>

            <span>
              {order?.tracking_code ?? "N/A"}
            </span>

          </div>

          <div className="trans-item">

            <span>Total Amount</span>

            <span>
              ${Number(amountToPay).toFixed(2)}
            </span>

          </div>

        </div>

        {/* PAYMENT */}
        <div className="trans-paybox">

          <div className="trans-item">

            <span>Payment Method</span>

            <span>
              <select
                className="trans-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="UPI">UPI</option>
                <option value="GPay">GPay</option>
                <option value="Card">Card</option>
                <option value="Cash">Cash</option>
              </select>
            </span>

          </div>

          {/* CARD */}
          {paymentMethod === "Card" && (

            <div className="trans-item">

              <span>Card Number</span>

              <span>
                <input
                  className="trans-input"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="**** **** **12 3456"
                />
              </span>

            </div>

          )}

          {/* QR SECTION */}
          <div className="trans-qr-wrap">

            <div className="trans-qr-card">

              <div className="trans-qr-title">
                Barcode / QR
              </div>

              {paymentMethod !== "Card" ? (

                <>
                  {/* WAITING */}
                  {paymentStatus === "pending" && (

                    <>
                      <div className="trans-qr-box">

                        <canvas
                          id="upi-qr"
                          className="trans-qr-canvas"
                          width={160}
                          height={160}
                          style={{
                            width: 160,
                            height: 160,
                          }}
                        />

                      </div>

                      <div className="trans-loading">

                        <div className="trans-spinner"></div>

                        <div className="trans-wait">
                          Waiting for payment...
                        </div>

                      </div>
                    </>
                  )}

                  {/* SUCCESS */}
                  {paymentStatus === "success" && (

                    <div
                      style={{
                        marginTop: 18,
                        padding: 24,
                        borderRadius: 24,
                        background:
                          "linear-gradient(135deg,#22c55e,#16a34a)",
                        color: "white",
                        boxShadow:
                          "0 14px 30px rgba(34,197,94,0.22)",
                      }}
                    >
                      <div
                        style={{
                          width: 70,
                          height: 70,
                          margin: "0 auto 14px",
                          borderRadius: "50%",
                          background: "white",
                          color: "#16a34a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 34,
                          fontWeight: 900,
                        }}
                      >
                        ✓
                      </div>

                      <h2 style={{ margin: 0 }}>
                        Payment Successful ✅
                      </h2>

                    </div>

                  )}

                </>

              ) : (

                // <div className="trans-card-view">

                //   <div className="trans-card-text">{maskCardNumber(cardNumber)}</div>

                // </div>
                <div className="trans-card-view">

                  <span className="trans-card-label">
                    Card Number
                  </span>

                  <div className="trans-card-text">
                    {maskCardNumber(cardNumber)}
                  </div>

                </div>

              )}

              {/* PAYMENT TEXT */}
              <div
                style={{
                  marginTop: 14,
                  color: "#64748b",
                  fontWeight: 600,
                }}
              >
                {paymentMethod === "Card"
                  ? paymentScanText
                  : paymentStatus === "pending"
                  ? paymentScanText
                  : ""}
              </div>

              {/* ACTION BUTTONS */}
              {paymentMethod !== "Card" && (

                <div className="trans-actions">

                  {/* SHARE */}
                  <button
                    type="button"
                    className="trans-btn"
                    onClick={async () => {

                      try {

                        const canvas =
                          document.getElementById("upi-qr");

                        if (!canvas) return;

                        if (navigator.share && canvas.toBlob) {

                          canvas.toBlob(async (blob) => {

                            if (!blob) return;

                            const file = new File(
                              [blob],
                              "upi-qr.png",
                              {
                                type: "image/png",
                              }
                            );

                            await navigator.share({
                              title: "UPI QR",
                              files: [file],
                            });

                          });

                          return;
                        }

                      } catch (e) {
                        console.error(e);
                      }

                    }}
                  >
                    Share QR
                  </button>

                  {/* DOWNLOAD */}
                  <button
                    type="button"
                    className="trans-btn"
                    onClick={() => {

                      const canvas =
                        document.getElementById("upi-qr");

                      if (!canvas || !canvas.toBlob) return;

                      canvas.toBlob((blob) => {

                        if (!blob) return;

                        const url =
                          URL.createObjectURL(blob);

                        const a =
                          document.createElement("a");

                        a.href = url;
                        a.download = "upi-qr.png";

                        document.body.appendChild(a);

                        a.click();

                        a.remove();

                        URL.revokeObjectURL(url);

                      });

                    }}
                  >
                    Download
                  </button>

                </div>

              )}

            </div>

          </div>

          {/* FOOTER */}
          <div className="trans-footer">

            <div className="trans-item">

              <span>Ready</span>

              <span className="trans-status">

                {paymentMethod === "Card"
                  ? "Card details"
                  : "Scan to Pay"}

              </span>

            </div>

          </div>

        </div>

      </div>

    </div>

  </div>
);

}

