export default function ProductCard({ product, onAddToCart }) {
  return (
    <div className="product-card">
      <div className="product-category">{product.category}</div>
      <h3>{product.title}</h3>
      <p>{product.description}</p>
      <div className="product-footer">
        <span className="price">${Number(product.price).toFixed(2)}</span>
        <button onClick={() => onAddToCart(product)}>Add to cart</button>
      </div>
    </div>
  );
}
