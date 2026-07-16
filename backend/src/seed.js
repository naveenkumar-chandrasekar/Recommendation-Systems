import { pool } from "./db.js";

const PRODUCTS_PER_CATEGORY = 200; // 5 categories -> 1000 products
const NUM_USERS = 150;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function price(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

const CATEGORIES = [
  {
    name: "Electronics",
    adjectives: ["Wireless", "Bluetooth", "USB-C", "4K", "Smart", "Portable", "Noise-Cancelling", "Fast-Charging", "Compact", "HD", "Rechargeable", "Ergonomic", "Waterproof", "Ultra-Thin", "RGB", "Dual-Band", "High-Fidelity", "Touchscreen", "Foldable", "Magnetic", "Solar-Powered", "Voice-Controlled", "Long-Range", "Lightweight", "Premium"],
    nouns: ["Headphones", "Keyboard", "Mouse", "Speaker", "Webcam", "Monitor", "Charger", "Power Bank", "SSD Drive", "Router", "Earbuds", "Smartwatch", "Tablet Stand", "Laptop Sleeve", "Docking Station", "Microphone", "Projector", "Game Controller", "Fitness Tracker", "Desk Lamp"],
    price: [19.99, 249.99],
    title: (adj, noun) => `${adj} ${noun}`,
    desc: (adj, noun) => `${adj} ${noun.toLowerCase()}, built for everyday reliability.`,
  },
  {
    name: "Books",
    adjectives: ["Silent", "Hidden", "Last", "Forgotten", "Midnight", "Broken", "Quiet", "Distant", "Golden", "Shattered", "Lost", "Secret", "Eternal", "Restless", "Whispering", "Frozen", "Wandering", "Sacred", "Crimson", "Endless", "Fading", "Radiant", "Solitary", "Untold", "Velvet"],
    nouns: ["Garden", "City", "River", "Kingdom", "Library", "Orchard", "Harbor", "Mountain", "Forest", "Star", "Shadow", "Letter", "Bridge", "Island", "Clock", "Storm", "Door", "Map", "Song", "Tide"],
    price: [9.99, 24.99],
    title: (adj, noun) => `The ${adj} ${noun}`,
    desc: (adj, noun) =>
      `A novel about the ${adj.toLowerCase()} ${noun.toLowerCase()} and the choices that define a life.`,
  },
  {
    name: "Clothing",
    adjectives: ["Classic", "Slim-Fit", "Relaxed", "Merino Wool", "Organic Cotton", "Water-Resistant", "Breathable", "Quilted", "Reversible", "Cropped", "Oversized", "Lightweight", "Insulated", "Stretch", "Flannel", "Linen", "Fleece-Lined", "Windproof", "Tailored", "Vintage", "Performance", "Everyday", "Heavyweight", "Packable", "Recycled"],
    nouns: ["Sweater", "Jacket", "Jeans", "Socks", "Sneakers", "T-Shirt", "Hoodie", "Shorts", "Cap", "Scarf", "Gloves", "Vest", "Dress", "Skirt", "Blazer", "Leggings", "Raincoat", "Boots", "Sandals", "Beanie"],
    price: [12.99, 129.99],
    title: (adj, noun) => `${adj} ${noun}`,
    desc: (adj, noun) => `${adj} ${noun.toLowerCase()} designed for everyday comfort.`,
  },
  {
    name: "Home & Kitchen",
    adjectives: ["Stainless Steel", "Cast Iron", "Ceramic", "Non-Stick", "Insulated", "Programmable", "Compact", "Bamboo", "Glass", "Electric", "Portable", "Rechargeable", "Adjustable", "Silicone", "Copper-Bottom", "Dishwasher-Safe", "Airtight", "Foldable", "Heavy-Duty", "Countertop", "Cordless", "Multi-Purpose", "Space-Saving", "Aromatic", "Ergonomic"],
    nouns: ["Coffee Maker", "Skillet", "Blanket", "Knife Set", "Diffuser", "Kettle", "Cutting Board", "Mixing Bowl Set", "Toaster", "Blender", "Storage Containers", "Bakeware Set", "Vacuum", "Air Purifier", "Throw Pillow", "Curtains", "Rug", "Candle", "Wall Clock", "Utensil Set"],
    price: [14.99, 99.99],
    title: (adj, noun) => `${adj} ${noun}`,
    desc: (adj, noun) => `${adj} ${noun.toLowerCase()} for a more organized home.`,
  },
  {
    name: "Sports & Outdoors",
    adjectives: ["Adjustable", "Lightweight", "Non-Slip", "Insulated", "Waterproof", "Portable", "Foldable", "Heavy-Duty", "Breathable", "Quick-Dry", "Reinforced", "Compact", "All-Terrain", "Shock-Absorbing", "Rechargeable", "Reflective", "Anti-Slip", "Packable", "High-Performance", "Durable", "Windproof", "Ergonomic", "Weatherproof", "Trail-Ready", "Ultralight"],
    nouns: ["Yoga Mat", "Water Bottle", "Dumbbell Set", "Camping Tent", "Running Shoes", "Hiking Backpack", "Resistance Bands", "Bike Helmet", "Sleeping Bag", "Fishing Rod", "Jump Rope", "Foam Roller", "Cooler", "Trekking Poles", "Kayak Paddle", "Golf Bag", "Skateboard", "Climbing Harness", "Binoculars", "Camp Stove"],
    price: [14.99, 179.99],
    title: (adj, noun) => `${adj} ${noun}`,
    desc: (adj, noun) => `${adj} ${noun.toLowerCase()} built for the trail and beyond.`,
  },
];

const FIRST_NAMES = ["Ava", "Noah", "Maya", "Liam", "Sofia", "Ethan", "Olivia", "Mason", "Isabella", "Lucas", "Mia", "Elijah", "Amelia", "James", "Charlotte", "Benjamin", "Harper", "Henry", "Evelyn", "Alexander", "Abigail", "Sebastian", "Emily", "Jack", "Ella", "Owen", "Scarlett", "Wyatt", "Grace", "Julian"];
const LAST_NAMES = ["Thompson", "Patel", "Chen", "Rodriguez", "Kim", "Brooks", "Nguyen", "Garcia", "Muller", "Johansson", "Rossi", "Dubois", "Silva", "Andersen", "Kowalski", "Yamada", "Osei", "Haddad", "Ivanov", "Costa", "Larsen", "Novak", "Duarte", "Fischer", "Reyes", "Hansen", "Moreau", "Sato", "Khan", "Torres"];

function generateProducts() {
  const products = [];
  for (const cat of CATEGORIES) {
    const combos = [];
    for (const adj of cat.adjectives) {
      for (const noun of cat.nouns) combos.push({ adj, noun });
    }
    const picked = shuffle(combos).slice(0, PRODUCTS_PER_CATEGORY);
    for (const { adj, noun } of picked) {
      products.push({
        title: cat.title(adj, noun),
        description: cat.desc(adj, noun),
        category: cat.name,
        price: price(cat.price[0], cat.price[1]),
      });
    }
  }
  return products;
}

function generateUsers() {
  const combos = [];
  for (const first of FIRST_NAMES) {
    for (const last of LAST_NAMES) combos.push({ first, last });
  }
  const picked = shuffle(combos).slice(0, NUM_USERS);
  return picked.map(({ first, last }, i) => ({
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
  }));
}

async function bulkInsertProducts(products) {
  const { rows } = await pool.query(
    `INSERT INTO products (title, description, category, price)
     SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::numeric[])
     RETURNING id`,
    [
      products.map((p) => p.title),
      products.map((p) => p.description),
      products.map((p) => p.category),
      products.map((p) => p.price),
    ]
  );
  return rows.map((r) => r.id);
}

async function bulkInsertUsers(users) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email)
     SELECT * FROM UNNEST($1::text[], $2::text[])
     RETURNING id`,
    [users.map((u) => u.name), users.map((u) => u.email)]
  );
  return rows.map((r) => r.id);
}

async function generateOrders(userIds, products, productIds) {
  const productsByCategory = {};
  products.forEach((p, i) => {
    (productsByCategory[p.category] ??= []).push({ id: productIds[i], price: p.price });
  });
  const categoryNames = CATEGORIES.map((c) => c.name);

  let orderCount = 0;
  let itemCount = 0;

  for (const userId of userIds) {
    const preferredCategory = choice(categoryNames);
    const numOrders = randInt(3, 15);

    for (let o = 0; o < numOrders; o++) {
      const numItems = randInt(1, 4);
      const chosenIds = new Set();
      const items = [];

      for (let i = 0; i < numItems; i++) {
        const pool_ = Math.random() < 0.7 ? productsByCategory[preferredCategory] : productsByCategory[choice(categoryNames)];
        const candidate = choice(pool_);
        if (chosenIds.has(candidate.id)) continue;
        chosenIds.add(candidate.id);
        items.push({ productId: candidate.id, price: candidate.price, quantity: randInt(1, 3) });
      }
      if (!items.length) continue;

      const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const { rows } = await pool.query(
        "INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id",
        [userId, total]
      );
      const orderId = rows[0].id;

      await pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         SELECT * FROM UNNEST($1::int[], $2::int[], $3::int[], $4::numeric[])`,
        [
          items.map(() => orderId),
          items.map((i) => i.productId),
          items.map((i) => i.quantity),
          items.map((i) => i.price),
        ]
      );

      orderCount += 1;
      itemCount += items.length;
    }
  }

  return { orderCount, itemCount };
}

async function seed() {
  await pool.query("TRUNCATE order_items, orders, products, users RESTART IDENTITY CASCADE");

  const users = generateUsers();
  const userIds = await bulkInsertUsers(users);

  const products = generateProducts();
  const productIds = await bulkInsertProducts(products);

  const { orderCount, itemCount } = await generateOrders(userIds, products, productIds);

  console.log(
    `Seeded ${userIds.length} users, ${productIds.length} products, ${orderCount} orders (${itemCount} line items).`
  );
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
