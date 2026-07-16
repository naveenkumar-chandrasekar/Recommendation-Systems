import { useNavigate } from "react-router-dom";

export default function Cart({ cart, onUpdateQuantity, onRemove, onCheckout }) {
  const navigate = useNavigate();
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleCheckout = async () => {
    await onCheckout();
    navigate("/orders");
  };

  if (!cart.length) return <p>Your cart is empty.</p>;

  return (
    <div className="cart">
      {cart.map((item) => (
        <div key={item.product.id} className="cart-row">
          <span>{item.product.title}</span>
          <input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => onUpdateQuantity(item.product.id, Number(e.target.value))}
          />
          <span>${(item.product.price * item.quantity).toFixed(2)}</span>
          <button onClick={() => onRemove(item.product.id)}>Remove</button>
        </div>
      ))}
      <div className="cart-total">Total: ${total.toFixed(2)}</div>
      <button onClick={handleCheckout}>Checkout</button>
    </div>
  );
}
