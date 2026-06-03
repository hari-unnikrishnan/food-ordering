import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./OrderHistoryPage.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

export default function OrderHistoryPage() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  function getPaymentMethodForOrder(order, fallbackMethod) {
    return (
      order?.payment_method ||
      order?.paymentMethod ||
      fallbackMethod ||
      "UPI"
    );
  }

  function getPaymentStatusForOrder(order) {
    const status = order?.status ?? order?.order_status;
    return status === "DELIVERED" || status === "PAID" ? "COMPLETE" : "PENDING";
  }

  async function fetchOrders() {
    setIsLoadingOrders(true);
    try {
      const res = await fetch(`${API_BASE}/orders/`);
      if (!res.ok) {
        const text = await res.text();
        console.error("Orders API error response:", { status: res.status, text });
        return;
      }
      const data = await res.json();

      const normalized = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.data)
            ? data.data
            : [];

      const sorted = [...normalized].sort((a, b) => {
        const at = new Date(a?.created_at || 0).getTime();
        const bt = new Date(b?.created_at || 0).getTime();
        return bt - at;
      });

      setOrders(sorted);
    } catch (e) {
      console.error("Failed to load orders", e);
    } finally {
      setIsLoadingOrders(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="order-history-page-container">
      <div className="order-history-page-header">
         <button
          type="button"
          className="order-history-back-btn"
          onClick={() => navigate("/")}
        >
          ← Back to Home
        </button>
        <div className="order-history-page-title">
          <h2>Order History</h2>
          <span className="order-history-page-count">Total Orders: {orders.length}</span>
        </div>

       
      </div>

      <div className="order-history-container">
        {isLoadingOrders ? (
          <div className="order-history-loading">Loading orders...</div>
        ) : orders.length ? (
          orders.map((order) => {
            const paymentStatus = getPaymentStatusForOrder(order);
            const statusText =
              paymentStatus === "COMPLETE" ? "Payment Complete" : "Pending Payment";
            const badgeClass =
              paymentStatus === "COMPLETE"
                ? "payment-status-complete"
                : "payment-status-pendings";

            const totalAmount = order?.total_amount ?? order?.total ?? 0;

            return (
              <div className="order-history-card" key={order.id}>
                <div className="history-row">
                  <span>Order ID</span>
                  <span>#{order.id}</span>
                </div>

                <div className="history-row">
                  <span>Total Amount</span>
                  <span>₹{Number(totalAmount).toFixed(2)}</span>
                </div>

                <div className="history-row">
                  <span>Payment Method</span>

                  <span>{getPaymentMethodForOrder(order) ?? "UPI / Card"}</span>
                </div>


                <div className="history-row">
                  <span>Payment Status</span>
                  <div className="payment-info">
                    <span className={badgeClass}>{statusText}</span>
                    <span className="payment-method">
                      {getPaymentMethodForOrder(order) || "UPI / Card / cash "}
                    </span>
                  </div>
                </div>

                <button
                  className="view-details-btn"
                  onClick={() =>
                    navigate("/transaction-details", {
                      state: { orderId: order.id, order: order },
                    })
                  }
                >
                  View Transaction
                </button>
              </div>
            );
          })
        ) : (
          <div className="order-history-empty">No orders yet.</div>
        )}
      </div>
    </div>
  );
}

