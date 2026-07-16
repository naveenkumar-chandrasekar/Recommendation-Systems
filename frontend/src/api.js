const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${options.method || "GET"} ${path} failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getUsers: () => request("/users"),
  getProducts: ({ category, limit, offset } = {}) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (limit) params.set("limit", limit);
    if (offset) params.set("offset", offset);
    const qs = params.toString();
    return request(`/products${qs ? `?${qs}` : ""}`);
  },
  getCategories: () => request("/products/categories"),
  getProduct: (id) => request(`/products/${id}`),
  getOrders: (userId) => request(`/orders?user_id=${userId}`),
  createOrder: (userId, items) =>
    request("/orders", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, items }),
    }),
  getRecommendation: (userId) => request(`/recommendations/${userId}`),
};
