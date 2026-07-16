import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

export default function Recommendation({ userId }) {
  const [status, setStatus] = useState("idle"); // idle | loading | ready | empty | error
  const [message, setMessage] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setStatus("loading");
    setError(null);
    try {
      const result = await api.getRecommendation(userId);
      if (!result.message) {
        setMessage(null);
        setProducts([]);
        setStatus("empty");
        return;
      }
      setMessage(result.message);
      setProducts(result.products);
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="recommendation-page">
      <div className="recommendation-header">
        <h2>Recommended for you</h2>
        <button onClick={load} disabled={status === "loading"}>
          {status === "loading" ? "Generating..." : "Refresh"}
        </button>
      </div>

      {status === "loading" && (
        <p className="recommendation-status">
          Generating your recommendation with a local LLM — this runs live, no cache, so it can take a few seconds.
        </p>
      )}

      {status === "error" && (
        <p className="recommendation-status recommendation-error">
          Couldn't generate a recommendation: {error}
        </p>
      )}

      {status === "empty" && (
        <p className="recommendation-status">
          No recommendation yet for this user — they may have no order history and no trending fallback data.
        </p>
      )}

      {status === "ready" && (
        <>
          <p className="recommendation-message">{message}</p>
          <div className="product-grid">
            {products.map((p) => (
              <div key={p.id} className="product-card">
                <div className="product-category">{p.category}</div>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <div className="product-footer">
                  <span className="price">${Number(p.price).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
