import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./DeliveryTracking.css";

export default function DeliveryTracking() {
  const navigate = useNavigate();
  const location = useLocation();

  const { order, amount, address, deliveryAddress } = location.state || {};


  const orderId = order?.id || order?.order_id || "N/A";
  const amountNum = amount !== undefined && amount !== null ? Number(amount) : NaN;

  const [geoStatus, setGeoStatus] = useState(
    /** @type {"idle" | "watching" | "error" | "unavailable"} */ ("idle")
  );
  const [geoError, setGeoError] = useState("");
  const [coords, setCoords] = useState({ lat: null, lng: null });
  const watcherIdRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }

    setGeoStatus("watching");

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setGeoStatus("error");
        setGeoError(err?.message || "Unable to fetch location");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000,
      }
    );

    watcherIdRef.current = watchId;

    return () => {
      if (watcherIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watcherIdRef.current);
      }
    };
  }, []);



  const [etaMinutes, setEtaMinutes] = useState(18);

  // Simulated moving map (Google embed cannot animate internally; we refresh URL)
  const [mapStep, setMapStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMapStep((prev) => prev + 1);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const deliveryAddressText = deliveryAddress || address || "Home";

  const routePositions = [
    "Karunagappally,Kerala",
    "Oachira,Kerala",
    "Kayamkulam,Kerala",
    deliveryAddressText,
  ];

  const currentLocation =
    routePositions[Math.min(mapStep, routePositions.length - 1)];

  // Keep ETA decreasing to feel “alive”
  useEffect(() => {
    const interval = setInterval(() => {
      setEtaMinutes((prev) => {
        if (prev <= 1) return 1;
        return prev - 1;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);



  return (
    <div className="tracking-page">
      <div className="tracking-topbar">
        <span
          className="back-btn"
          onClick={() => navigate("/")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate("/");
          }}
        >
          ←
        </span>
        <h2>Delivery Tracking</h2>
      </div>

      <div className="tracking-card">
        <h3 className="tracking-title">Order Confirmed ✅</h3>

        <div className="tracking-row">
          <span className="tracking-label">Order #</span>
          <span className="tracking-value">{orderId}</span>
        </div>

        <div className="tracking-row">
          <span className="tracking-label">Delivery Address</span>
          <span className="tracking-value">
            <strong>{address || order?.delivery_address || "N/A"}</strong>
          </span>
        </div>

        <div className="tracking-row">
          <span className="tracking-label">Amount</span>
          <span className="tracking-value">
            <strong>${Number.isFinite(amountNum) ? amountNum.toFixed(2) : "0.00"}</strong>
          </span>
        </div>

        <div className="delivery-status">Delivery Home is on the way 🚴</div>



        <div className="map-box">
          <iframe
            title="Delivery Route"
            width="100%"
            height="350"
            color="red"
            style={{ border: 0, borderRadius: 20 }}
            loading="lazy"
            allowFullScreen
            src={`https://maps.google.com/maps?saddr=Karunagappally,Kerala&daddr=${currentLocation}&dirflg=d&output=embed`}
          />
        </div>



        <div className="tracking-footer">
          <p>
            Tracking status:{" "}
            <strong>{order?.status || order?.order_status || "out of delivery"}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

