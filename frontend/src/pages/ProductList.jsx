import { useEffect, useState } from "react";
import { api } from "../api.js";
import ProductCard from "../components/ProductCard.jsx";

const PAGE_SIZE = 60;

export default function ProductList({ onAddToCart }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    api.getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setProducts([]);
    setOffset(0);
    setHasMore(true);
  }, [category]);

  useEffect(() => {
    api
      .getProducts({ category: category || undefined, limit: PAGE_SIZE, offset })
      .then((page) => {
        setProducts((prev) => (offset === 0 ? page : [...prev, ...page]));
        setHasMore(page.length === PAGE_SIZE);
      });
  }, [category, offset]);

  return (
    <div>
      <div className="filters">
        <button className={category === "" ? "active" : ""} onClick={() => setCategory("")}>All</button>
        {categories.map((c) => (
          <button key={c} className={category === c ? "active" : ""} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>
      <div className="product-grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
        ))}
      </div>
      {hasMore && (
        <div className="load-more">
          <button onClick={() => setOffset((o) => o + PAGE_SIZE)}>Load more</button>
        </div>
      )}
    </div>
  );
}
