import { pool } from "./db.js";

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

const FIRST_NAMES = ["Ava", "Noah", "Maya", "Liam", "Sofia", "Ethan", "Olivia", "Mason", "Isabella", "Lucas", "Mia", "Elijah", "Amelia", "James", "Charlotte", "Benjamin", "Harper", "Henry", "Evelyn", "Alexander", "Abigail", "Sebastian", "Emily", "Jack", "Ella", "Owen", "Scarlett", "Wyatt", "Grace", "Julian"];
const LAST_NAMES = ["Thompson", "Patel", "Chen", "Rodriguez", "Kim", "Brooks", "Nguyen", "Garcia", "Muller", "Johansson", "Rossi", "Dubois", "Silva", "Andersen", "Kowalski", "Yamada", "Osei", "Haddad", "Ivanov", "Costa", "Larsen", "Novak", "Duarte", "Fischer", "Reyes", "Hansen", "Moreau", "Sato", "Khan", "Torres"];

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

async function bulkInsertUsers(users) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email)
     SELECT * FROM UNNEST($1::text[], $2::text[])
     RETURNING id`,
    [users.map((u) => u.name), users.map((u) => u.email)]
  );
  return rows.map((r) => r.id);
}

// No preferred-category bias here -- each item in each order is drawn from a
// uniformly random category, so a user's order history naturally spans
// several categories instead of clustering around one.
async function generateMixedOrders(userIds, productsByCategory, categoryNames) {
  let orderCount = 0;
  let itemCount = 0;

  for (const userId of userIds) {
    const numOrders = randInt(3, 15);

    for (let o = 0; o < numOrders; o++) {
      const numItems = randInt(1, 4);
      const chosenIds = new Set();
      const items = [];

      for (let i = 0; i < numItems; i++) {
        const candidatePool = productsByCategory[choice(categoryNames)];
        const candidate = choice(candidatePool);
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

async function reseedOrders() {
  // users + orders + order_items only -- products (and their embeddings) stay untouched
  await pool.query("TRUNCATE order_items, orders, users RESTART IDENTITY CASCADE");

  const users = generateUsers();
  const userIds = await bulkInsertUsers(users);

  const { rows: products } = await pool.query("SELECT id, category, price FROM products");
  const productsByCategory = {};
  for (const p of products) {
    (productsByCategory[p.category] ??= []).push({ id: p.id, price: Number(p.price) });
  }
  const categoryNames = Object.keys(productsByCategory);

  const { orderCount, itemCount } = await generateMixedOrders(userIds, productsByCategory, categoryNames);

  console.log(
    `Reseeded ${userIds.length} users, ${orderCount} orders (${itemCount} line items) across ${categoryNames.length} mixed categories. ${products.length} existing products (with embeddings) left untouched.`
  );
  await pool.end();
}

reseedOrders().catch((err) => {
  console.error(err);
  process.exit(1);
});
