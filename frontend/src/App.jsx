import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { api } from "./api.js";
import Navbar from "./components/Navbar.jsx";
import ProductList from "./pages/ProductList.jsx";
import Cart from "./pages/Cart.jsx";
import Orders from "./pages/Orders.jsx";
import Recommendation from "./pages/Recommendation.jsx";

export default function App() {
  const [users, setUsers] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    api.getUsers().then((u) => {
      setUsers(u);
      if (u.length) setCurrentUserId(u[0].id);
    });
  }, []);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, quantity) => {
    setCart((prev) => prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i)));
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const checkout = async () => {
    await api.createOrder(
      currentUserId,
      cart.map((i) => ({ product_id: i.product.id, quantity: i.quantity }))
    );
    setCart([]);
  };

  return (
    <div className="app">
      <Navbar
        users={users}
        currentUserId={currentUserId}
        onUserChange={setCurrentUserId}
        cartCount={cart.reduce((n, i) => n + i.quantity, 0)}
      />
      <main>
        <Routes>
          <Route path="/" element={<ProductList onAddToCart={addToCart} />} />
          <Route
            path="/cart"
            element={
              <Cart
                cart={cart}
                onUpdateQuantity={updateQuantity}
                onRemove={removeFromCart}
                onCheckout={checkout}
              />
            }
          />
          <Route path="/orders" element={<Orders userId={currentUserId} />} />
          <Route path="/recommendations" element={<Recommendation userId={currentUserId} />} />
        </Routes>
      </main>
    </div>
  );
}
