import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Orders({ userId }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (userId) api.getOrders(userId).then(setOrders);
  }, [userId]);

  if (!orders.length) return <p>No orders yet.</p>;

  return (
    <div className="orders">
      {orders.map((o) => (
        <div key={o.id} className="order-card">
          <div className="order-header">
            <span>Order #{o.id}</span>
            <span>{new Date(o.created_at).toLocaleDateString()}</span>
            <span>${Number(o.total).toFixed(2)}</span>
          </div>
          <ul>
            {o.items.map((it, idx) => (
              <li key={idx}>{it.title} × {it.quantity}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
