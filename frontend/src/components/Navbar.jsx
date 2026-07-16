import { Link } from "react-router-dom";

export default function Navbar({ users, currentUserId, onUserChange, cartCount }) {
  return (
    <nav className="navbar">
      <Link to="/" className="brand">Shop</Link>
      <div className="nav-right">
        <select value={currentUserId ?? ""} onChange={(e) => onUserChange(Number(e.target.value))}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <Link to="/cart">Cart ({cartCount})</Link>
        <Link to="/orders">Orders</Link>
        <Link to="/recommendations">For You</Link>
      </div>
    </nav>
  );
}
