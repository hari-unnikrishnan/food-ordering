// POSDashboard.jsx
import "./POSDashboard.css";
import "./POSDashboard_statusbar.css";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import { buildUpiPayUrl } from "./upiString";
import { useLocation, useNavigate } from "react-router-dom";


import RestaurantLogin from "./RestaurantLogin";
import logoutIcon from "./assets/logout.png";


const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";




export default function POSDashboard() {
  const navigate = useNavigate();
  const location = useLocation();



  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);

  const [activeCategory, setActiveCategory] = useState("All Menu");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // qty per menu item (keyed by item id)
  const [cartQtyById, setCartQtyById] = useState({});

  // Customer/order UI state
  const CUSTOMER_NAME = "Ariel Hikmat";
  const [lastPlacedOrder, setLastPlacedOrder] = useState(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const [orderType, setOrderType] = useState("DINE_IN"); // DINE_IN | DELIVERY
  const [tableNumber, setTableNumber] = useState("1");
  const [deliveryAddress, setDeliveryAddress] = useState("Home");

  // Payment UI state
  const [paymentMethod, setPaymentMethod] = useState("UPI"); // UPI | GPay | Card | Cash
  const [upiId, setUpiId] = useState("hariunnikrishnan16-1@oksbi");
  const [cardNumber, setCardNumber] = useState("");

  // Payment loading/success simulation
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);


  // Matched-from-image preview (category, item, price)
  const [matchedFromImage, setMatchedFromImage] = useState(null);
  const [matchedFromImageQuery, setMatchedFromImageQuery] = useState("");
  const [isMatchingFromImage, setIsMatchingFromImage] = useState(false);

  // Keep the amount used for QR/Barcode stable after placing the order.
  // Otherwise, we clear `cartQtyById` and the computed paymentTotal becomes $0.00.
  const [lastOrderAmount, setLastOrderAmount] = useState(null);

  // Show payment scan section on demand (after user clicks "Continue to Pay")
  const [showPaymentScan, setShowPaymentScan] = useState(false);


  // Order history state
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // After redirect from TransactionDetails (payment completed), auto set last placed order
  useEffect(() => {
    // When returning from AddMenuItemPage after adding an item,
    // refresh items/categories so the POS dashboard shows the new menu.
    if (location.state?.addedItem) {
      (async () => {
        try {
          setIsLoading(true);

          const params = new URLSearchParams();
          // Include all availability types (available + unavailable + special)
          // by not filtering with `available=true`.
          if (activeCategory !== "All Menu") params.set("category", activeCategory);
          if (search.trim()) params.set("search", search.trim());

          const [catRes, itemRes] = await Promise.all([
            fetch(`${API_BASE}/categories/`),
            fetch(`${API_BASE}/items/?${params.toString()}`),
          ]);

          if (catRes.ok) {
            const catData = await catRes.json();
            const normalizedCats = Array.isArray(catData)
              ? catData
              : Array.isArray(catData?.results)
                ? catData.results
                : Array.isArray(catData?.data)
                  ? catData.data
                  : [];
            setCategories(normalizedCats);
          }

          if (itemRes.ok) {
            const itemData = await itemRes.json();
            const normalizedItems = Array.isArray(itemData)
              ? itemData
              : Array.isArray(itemData?.results)
                ? itemData.results
                : Array.isArray(itemData?.data)
                  ? itemData.data
                  : [];
            setItems(normalizedItems);
          }
        } catch (e) {
          console.error("Failed to refresh menu after adding item", e);
        } finally {
          setIsLoading(false);
        }
      })();
    }


    // After redirect from TransactionDetails (payment completed), auto set last placed order
    if (location.state?.paid && location.state?.order) {
      setLastPlacedOrder(location.state.order);
    }
  }, [location.state]);



  const subtotal = Object.entries(cartQtyById)

    .filter(([, qty]) => qty > 0)
    .reduce((sum, [itemId, qty]) => {
      const item = items.find((it) => String(it.id) === String(itemId));

      if (!item) return sum;

      return sum + Number(item.price) * qty;
    }, 0);

  const tax = subtotal * 0.05;
  const amountToPay = subtotal + tax;

  const displayPaymentTotal = lastOrderAmount !== null && lastOrderAmount !== undefined ? lastOrderAmount : amountToPay;

  const upiPayUrl = useMemo(() => {
    return buildUpiPayUrl({ amount: displayPaymentTotal, upiId: upiId || "hariunnikrishnan16-1@oksbi" });
  }, [displayPaymentTotal, upiId]);


  useEffect(() => {
    let cancelled = false;

    async function renderQr() {
      try {
        const canvas = document.getElementById("upi-qr");
        if (!canvas) return;

        // Only render for UPI (Card still uses the text payload)
        if (paymentMethod === "Card") {
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
          return;
        }

        // Ensure the canvas has a size before drawing
        const size = 160;
        canvas.width = size;
        canvas.height = size;

        // Always build for UPI URL with your required format.
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
    return () => {
      cancelled = true;
    };
  }, [upiPayUrl, paymentMethod]);


  function changeQty(itemId, delta) {
    setCartQtyById((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [itemId]: next };
    });

    // If cart changes, clear the previously placed order amount so the scan/QR updates again.
    setLastOrderAmount(null);
  }



  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/categories/`);
        if (!res.ok) {
          const text = await res.text();
          console.error("Categories API error response:", { status: res.status, text });
          throw new Error(`Failed to load categories: ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;

        // Backend may return either an array or an object (e.g. { results: [...] }).
        const normalized = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.data)
              ? data.data
              : [];

        setCategories(normalized);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("available", "true");
        if (activeCategory !== "All Menu") params.set("category", activeCategory); // URLSearchParams will encode safely
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`${API_BASE}/items/?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          console.error("Items API error response:", { status: res.status, text });
          throw new Error(`Failed to load items: ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        // Backend may return either an array or an object (e.g. { results: [...] }).
        const normalized = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.data)
              ? data.data
              : [];
        setItems(normalized);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadItems();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, search]);

  async function fetchMatchedItemByName(matchedName) {
    const name = (matchedName || "").trim();
    if (!name) {
      setMatchedFromImage(null);
      return;
    }

    setIsMatchingFromImage(true);
    try {
      const params = new URLSearchParams();
      params.set("available", "true");
      params.set("search", name);

      // Do not force category here; we want the best match globally.
      const res = await fetch(`${API_BASE}/items/?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        console.error("Matched item lookup failed:", { status: res.status, text });
        setMatchedFromImage(null);
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

      // Best match: first item returned by backend search.
      const best = normalized[0];
      if (!best) {
        setMatchedFromImage(null);
        return;
      }

      setMatchedFromImage({
        category: best.category || "Unknown",
        item: best.name,
        price: best.price,
      });
    } catch (e) {
      console.error(e);
      setMatchedFromImage(null);
    } finally {
      setIsMatchingFromImage(false);
    }
  }


  const categoryCards = useMemo(() => {
    const countsByCategory = new Map();
    for (const it of items) {
      const key = it.category || "Unknown";
      countsByCategory.set(key, (countsByCategory.get(key) || 0) + 1);
    }

    const allCount = items.length;

    // Enforce the sidebar order you requested.
    const desiredOrder = ["Breakfast", "Fastfood", "Soups", "Pasta", "Snack"];
    const categoryByName = new Map((categories || []).map((c) => [c.name, c]));

    const orderedCategories = [
      ...desiredOrder
        .map((name) => categoryByName.get(name))
        .filter(Boolean),
      ...(categories || []).filter((c) => !desiredOrder.includes(c.name)),
    ];

    return [
      { name: "All Menu", items: allCount, active: activeCategory === "All Menu" },
      ...orderedCategories.map((c) => ({
        name: c.name,
        items: countsByCategory.get(c.name) || 0,
        active: activeCategory === c.name,
      })),
    ];
  }, [activeCategory, categories, items]);

  function getPaymentMethodForOrder(order) {
    // Backend currently doesn't persist payment method.
    // Keep UI consistent by allowing optional fields, otherwise fallback to current checkout selection or UPI.
    return (
      order?.payment_method ||
      order?.paymentMethod ||
      paymentMethod ||
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

      // Ensure latest first (backend ordering is already -created_at, but keep stable)
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

  // Refresh order history whenever an order is placed / updated
  useEffect(() => {
    if (!lastPlacedOrder?.id) return;
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPlacedOrder?.id]);

  useEffect(() => {
    if (!lastPlacedOrder?.id) return;

    let cancelled = false;
    let timer = null;

    async function tick() {
      try {
        const res = await fetch(`${API_BASE}/orders/${lastPlacedOrder.id}/`);
        if (!res.ok) {
          const text = await res.text();
          console.error("Order status poll API error response:", { status: res.status, text });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setLastPlacedOrder(data);

        if (data.status === "DELIVERED" || data.status === "out of delivery") {
          // Stop polling when it reaches a terminal-ish state for dine-in (out of delivery) or delivery (DELIVERED)
          return;
        }
      } catch (e) {
        // ignore
      }
      timer = setTimeout(tick, 1000);
    }

    timer = setTimeout(tick, 0);


    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [lastPlacedOrder?.id]);


  return (
    <div className="dashboard-container">
      


      <div className="dashboard-box">
        {/* LEFT SIDEBAR */}
        <div className="sidebar">
          <div className="menu-title">
            <span className="back-btn">←</span>
            <h2>Choose Menu</h2>
          </div>

          <button
            className="add-category-btn"
            type="button"
            onClick={() => navigate("/add-menu-item")}
          >
            Add Item (Category, Item & Price)
          </button>


          {categoryCards.map((cat) => (
            <div
              key={cat.name}
              className={`category-card ${cat.active ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.name)}
              role="button"
              tabIndex={0}
              style={{ cursor: "pointer" }}
            >
              <h3>{cat.name}</h3>
              <p>{cat.items} Items</p>
            </div>
          ))}

        </div>

        {/* CENTER CONTENT */}
        <div className="main-content">
          <div className="top-header">
            <div>
              <h1>{activeCategory === "All Menu" ? "All Menu" : `${activeCategory} Menu`}</h1>
              <p>{isLoading ? "Loading..." : "Fresh meals and delicious options"}</p>
            </div>

            <div className="search-box">
              <input
                type="text"
                placeholder="Search dishes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span>🔍</span>
              {search && (
                <div className="search-suggestions">
                  {items
                    .filter((food) =>
                      food.name?.toLowerCase().includes(search.toLowerCase())
                    )
                    .slice(0, 5)
                    .map((food) => (
                      <div
                        key={food.id}
                        className="search-item"
                        onClick={() => setSearch(food.name)}
                      >
                        {food.name}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div className="food-grid">
            {items.map((food) => (
              <div className="food-card" key={food.id}>
                <div className="food-image-box">
                  <img
                    src={
                      food.image_url
                        ? food.image_url.startsWith("http")
                          ? food.image_url
                          : `${import.meta.env.VITE_MEDIA_BASE || "http://localhost:8000"}${food.image_url}`
                        : "/placeholder-food.png"
                    }
                    alt={food.name}
                  />
                  <span
                    className={`food-tag ${
                      (food.availability || "").toString().trim().toLowerCase() === "special"
                        ? "special"
                        : (food.availability || "").toString().trim().toLowerCase() === "available"
                        ? "available"
                        : "unavailable"
                    }`}
                    title={food.availability ?? ""}
                  >
                    {(food.availability || "").toString().trim() || "Unavailable"}
                  </span>

                </div>

                <div className="food-content">
                  <h2>{food.name}</h2>
                  <p>{food.description || ""}</p>

                  <div className="food-footer">
                    <h3>${Number(food.price).toFixed(2)}</h3>

                    <div className="qty-box">
                      <button onClick={() => changeQty(food.id, -1)}>-</button>
                      <span>{cartQtyById[food.id] || 0}</span>
                      <button className="plus-btn" onClick={() => changeQty(food.id, +1)}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="order-panel">
          <div className="profile-box">
            <div>
              <h2>{CUSTOMER_NAME}</h2>
              <p>
                Order #{lastPlacedOrder?.id || 925} | {orderType === "DELIVERY" ? "Delivery" : "Dine In"}
                {orderType === "DINE_IN" ? (lastPlacedOrder?.table_number ? ` (Table ${lastPlacedOrder.table_number})` : "") : ""}
                {orderType === "DELIVERY" ? (lastPlacedOrder?.delivery_address ? ` (${lastPlacedOrder.delivery_address})` : "") : ""}
              </p>
            </div>


            <div className="profile-actions">

              <button
                className="logout-btn"
                onClick={() => {
                localStorage.clear();
                    navigate("/restaurant-login");
                }}
              >
                <img
                src={logoutIcon}
                alt="Logout"
                className="logout-icon-img"
              />
              </button>

              <div className="profile-logo">
                AH
              </div>

            </div>
          </div>

          


          {/* TRACKING STATUS */}
          {lastPlacedOrder && (
            <div className="tracking-box">
              <h3 className="tracking-title">Tracking Status</h3>

              <p className="tracking-text">
                <strong>Status:</strong>
                <span
                  className={`tracking-status ${
                    (lastPlacedOrder.status ?? lastPlacedOrder.order_status) === "DELIVERED"
                      ? "status-delivered"
                      : (lastPlacedOrder.status ?? lastPlacedOrder.order_status) === "PREPARING"
                      ? "status-preparing"
                      : "status-pending"
                  }`}
                >
                  {lastPlacedOrder.status ?? lastPlacedOrder.order_status ?? "out of delivery"}
                </span>
              </p>

              <p className="tracking-text">
                <strong>Tracking Code:</strong>
                {lastPlacedOrder.tracking_code || "N/A"}
              </p>

              <p className="tracking-text">
                <strong>Order Type:</strong>
                {lastPlacedOrder.order_type}
              </p>
            </div>
          )}

            <div className="order-list">
              <h3>Order Detail</h3>


            {(
              (lastPlacedOrder?.lines?.length ? lastPlacedOrder.lines : null) ||
              (lastPlacedOrder?.details_json?.lines?.length ? lastPlacedOrder.details_json.lines : null)
            ) ? (
              ((lastPlacedOrder?.lines?.length ? lastPlacedOrder.lines : lastPlacedOrder?.details_json?.lines) || []).map((line, idx) => (
                <div className="order-item" key={`${line.item_id || line.id || idx}-${idx}`}>
                  <div>
                    <h4>
                      {CUSTOMER_NAME} | {line.category_name || "Unknown"} | {line.item || line.item_name || line.item_id}
                    </h4>
                    <p>{line.item_description ? `Extra: ${line.item_description}` : ""}</p>
                  </div>

                  <div className="order-price">
                    <span>x{line.quantity}</span>
                    <h5>${Number(line.line_total || 0).toFixed(2)}</h5>
                  </div>
                </div>
              ))
            ) : (
              <>
                {Object.entries(cartQtyById)
                  .filter(([, qty]) => qty > 0)
                  .map(([itemId, qty]) => {
                    const item = items.find((it) => String(it.id) === String(itemId));
                    if (!item) return null;

                    return (
                      <div className="order-item" key={itemId}>
                        <div>
                          <h4>
                            {CUSTOMER_NAME} | {item.category || "Unknown"} | {item.name}
                          </h4>
                          <p>{item.description ? `Extra: ${item.description}` : ""}</p>
                        </div>

                        <div className="order-price">
                          <span>x{qty}</span>
                          <h5>${(Number(item.price) * qty).toFixed(2)}</h5>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </div>



          <div className="checkout-box">
            {/* ORDER HISTORY */}
            <div className="order-history-container">
              <div className="order-history-header">

                <div
                  className="order-history-title-box"
                  onClick={() => navigate("/order-history")}
                >
                  <h2>Order History</h2>
                  <span className="history-view-all">
                    View All
                  </span>
                </div>

                

              </div>

              {/* Removed order history cards from POSDashboard. */}
            </div>

            {/* PAYMENT UI */}
             <div className="checkout-row">
              <span>Order Type</span>
              <span>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  style={{ padding: 8, borderRadius: 8 }}
                >
                  <option value="DINE_IN">Dine In</option>
                  <option value="DELIVERY">Delivery Home</option>
                </select>
              </span>
            </div>

            {orderType === "DINE_IN" ? (
              <div className="checkout-row">
                <span>Restaurant Table</span>
                <span>
                  <input
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Table #"
                    style={{ padding: 8, borderRadius: 8, width: 140 }}
                  />
                </span>
              </div>
            ) : (
              <div className="checkout-row">
                <span>Delivery Address</span>
                <span>
                  <input
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Address"
                    style={{ padding: 8, borderRadius: 8, width: 200 }}
                  />
                </span>
              </div>
            )}

            <div className="checkout-row">
              <span>Items (
                {Object.values(cartQtyById).reduce((a, b) => a + (b || 0), 0) || 0}
                )
              </span>
              <span>${amountToPay.toFixed(2)}</span>
            </div>


            <div className="checkout-row">
              <span>Tax (5%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            
             

           

           

             <div className="checkout-row payment-method-row">
              <span>Pay by</span>
              <span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ padding: 8, borderRadius: 8 }}
                >
                  <option value="UPI">UPI</option>
                  <option value="GPay">GPay</option>
                  <option value="Card">Card</option>
                  <option value="Cash">Cash</option>
                </select>
              </span>
            </div>

            {paymentMethod !== "Card" ? (
              <div className="checkout-row">
                <span></span>
                <span>
                  
                </span>
              </div>
            ) : (
              <div className="checkout-row">
                <span>Card Number</span>
                <span>
                  <input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="**** **** **12 3456"
                    style={{ padding: 8, borderRadius: 8, width: 220 }}
                  />
                </span>
              </div>
            )}

            

            
            <button
              className="checkout-btn"
              disabled={isPlacingOrder}
              onClick={async () => {
                const lines = Object.entries(cartQtyById)
                  .filter(([, qty]) => qty > 0)
                  .map(([itemId, qty]) => ({ item_id: Number(itemId), quantity: qty }));

                if (!lines.length) return;

                const subtotal = Object.entries(cartQtyById)
                  .filter(([, qty]) => qty > 0)
                  .reduce((sum, [itemId, qty]) => {
                    const item = items.find((it) => String(it.id) === String(itemId));
                    if (!item) return sum;
                    return sum + Number(item.price) * qty;
                  }, 0);

                const tax = subtotal * 0.05;
                const total = subtotal + tax;

                // Store amount so QR/Barcode doesn't become $0.00 after we clear cart.
                setLastOrderAmount(total);

                const payload = {
                  tax_rate: 5,
                  lines,
                  order_type: orderType,
                  table_number: orderType === "DINE_IN" ? tableNumber : null,
                  delivery_address: orderType === "DELIVERY" ? deliveryAddress : null,
                };

                try {
                  setIsPlacingOrder(true);
                  const res = await fetch(`${API_BASE}/orders/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });

                  if (!res.ok) {
                    const text = await res.text();
                    console.error("Place order API error response:", { status: res.status, text });
                    throw new Error(text || "Failed to place order");
                  }

                  const data = await res.json();
                  setLastPlacedOrder(data);

                  let backendTotal = total;
                  if (data?.total !== undefined && data?.total !== null) {
                    backendTotal = Number(data.total);
                    if (!Number.isNaN(backendTotal)) {
                      setLastOrderAmount(backendTotal);
                    }
                  }

                  setCartQtyById({});

                  if (orderType === "DELIVERY") {
                    navigate("/delivery-tracking", {
                      state: {
                        amount: backendTotal,
                        order: data,
                        address: deliveryAddress,
                      },
                    });
                  } else {
                    navigate("/transaction-details", {
                      state: {
                        amount: backendTotal,
                        order: data,
                      },
                    });
                  }
                } catch (e) {
                  console.error(e);
                  alert(e?.message || "Failed to place order");
                } finally {
                  setIsPlacingOrder(false);
                }
              }}
            >
              {isPlacingOrder
                ? "$... Placing"
                : `$${(lastOrderAmount ?? amountToPay).toFixed(2)} Proceed Order →`}
            </button>
           


            {showPaymentScan && (
              <div id="payment-scan" className="checkout-row scan-row">

                <div className="scan-box">
                  <div className="scan-placeholder">Barcode / QR</div>

                  <div className="qr-wrapper">
                    <canvas id="upi-qr" className="qr-canvas" />
                  </div>

                  <div className="qr-actions">
                    <button
                      type="button"
                      className="qr-action-btn"
                      onClick={async () => {
                        try {
                          const canvas = document.getElementById("upi-qr");
                          if (!canvas) return;

                          // Prefer native share with image
                          if (navigator.share && canvas.toBlob) {
                            canvas.toBlob(async (blob) => {
                              if (!blob) {
                                navigator.clipboard?.writeText?.(upiPayUrl);
                                return;
                              }
                              const file = new File([blob], "upi-qr.png", { type: "image/png" });
                              try {
                                await navigator.share({
                                  title: "UPI QR",
                                  text: `Pay ${displayPaymentTotal.toFixed(2)} via UPI`,
                                  files: [file],
                                });
                              } catch (e) {
                                await navigator.clipboard?.writeText?.(upiPayUrl);
                              }
                            }, "image/png");
                            return;
                          }

                          await navigator.clipboard?.writeText?.(upiPayUrl);
                          alert("UPI payload copied. Paste to share/pay.");
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      Share QR
                    </button>

                    <button
                      type="button"
                      className="qr-action-btn"
                      onClick={() => {
                        const canvas = document.getElementById("upi-qr");
                        if (!canvas || !canvas.toBlob) return;

                        canvas.toBlob((blob) => {
                          if (!blob) return;
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "upi-qr.png";
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          URL.revokeObjectURL(url);
                        }, "image/png");
                      }}
                    >
                      Download
                    </button>
                  </div>

                  <div className="scan-code">
                    {paymentMethod === "Card"
                      ? `PAYMENT|CARD|AMOUNT=${displayPaymentTotal.toFixed(2)}`
                      : `Amount: ${displayPaymentTotal.toFixed(2)}`}
                  </div>
                </div>
              </div>
             )
            }



            <div className="checkout-row payment-confirm-row">
              <span>Payment Status</span>
              <span
                className={"payment-status-text " + (
                  (lastPlacedOrder?.status ?? lastPlacedOrder?.order_status) === "DELIVERED"
                    ? "payment-status-complete"
                    : (lastPlacedOrder?.status ?? lastPlacedOrder?.order_status) === "PAID"
                      ? "payment-status-complete"
                      : "payment-status-pending"
                )}
                role="button"
                tabIndex={0}
                onClick={() => {
                  const isPaid =
                    (lastPlacedOrder?.status ?? lastPlacedOrder?.order_status) !== "DELIVERED" &&
                    (lastPlacedOrder?.status ?? lastPlacedOrder?.order_status) !== "PAID";

                  if (!isPaid) {
                    // If already paid/delivered, still go to transaction details.
                    navigate("/transaction-details", { state: { orderId: lastPlacedOrder?.id } });
                    return;
                  }

                  // Go to Transaction Details page to show payment method details/QR/card.
                  navigate("/transaction-details", { state: { orderId: lastPlacedOrder?.id, order: lastPlacedOrder } });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const isPaid =
                      (lastPlacedOrder?.status ?? lastPlacedOrder?.order_status) !== "DELIVERED" &&
                      (lastPlacedOrder?.status ?? lastPlacedOrder?.order_status) !== "PAID";

                    if (!isPaid) return;

                    setShowPaymentScan(true);

                    setTimeout(() => {
                      const el = document.getElementById("payment-scan");
                      el?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                    }, 500);
                  }
                }}
              >
                {(lastPlacedOrder?.status ?? lastPlacedOrder?.order_status) === "DELIVERED"
                  ? "Payment Complete"
                  : (lastPlacedOrder?.status ?? lastPlacedOrder?.order_status) === "PAID"
                    ? "Payment Complete"
                    : "Continue to Pay"}
              </span>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}




