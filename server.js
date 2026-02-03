const express = require("express");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;
const SECRET = "joetech_secret_key";

/* ===================== FILE HELPERS (RENDER SAFE) ===================== */
function ensureFile(file, defaultData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
  }
}

function readJSON(file, defaultData = []) {
  ensureFile(file, defaultData);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* ===================== AUTH MIDDLEWARE ===================== */
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* ===================== SERVICES DATA ===================== */
const servicesList = [
  // Telegram
  { name: "Telegram channel/group members (30 days)", min: 10, price: 1209 },
  { name: "Telegram bot stats (worldwide)", min: 100, price: 639 },
  { name: "Telegram channel comments", min: 10, price: 2997 },
  { name: "Telegram post views", min: 100, price: 97 },
  { name: "Telegram story views (worldwide)", min: 10, price: 703 },
  { name: "Telegram poll votes", min: 10, price: 790 },

  // TikTok
  { name: "TikTok followers (non-drop)", min: 10, price: 1829 },
  { name: "TikTok likes (non-drop)", min: 100, price: 199 },
  { name: "TikTok video views", min: 100, price: 157 },
  { name: "TikTok shares", min: 100, price: 213 },
  { name: "TikTok USA followers", min: 10, price: 7348 },

  // Instagram
  { name: "Instagram non-drop followers", min: 10, price: 5406 },
  { name: "Instagram likes", min: 100, price: 672 },
  { name: "Instagram video/reels views", min: 100, price: 124 },

  // Facebook
  { name: "Facebook profile/page followers", min: 10, price: 690 },
  { name: "Facebook post likes", min: 10, price: 428 },

  // YouTube
  { name: "YouTube verified account comments", min: 10, price: 2940 }
];

/* ===================== AUTH ROUTES ===================== */
app.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readJSON("users.json", []);

    if (!username || !password)
      return res.status(400).json({ error: "Missing fields" });

    if (users.find(u => u.username === username))
      return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    users.push({ username, password: hashed, balance: 0 });

    writeJSON("users.json", users);
    res.json({ message: "Signup successful" });
  } catch (err) {
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readJSON("users.json", []);
    const user = users.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: "Invalid login" });

    const token = jwt.sign({ username }, SECRET, { expiresIn: "7d" });
    res.json({ token });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

/* ===================== WALLET ===================== */
app.get("/balance", auth, (req, res) => {
  const users = readJSON("users.json", []);
  const user = users.find(u => u.username === req.user.username);
  res.json({ balance: user.balance });
});

/* ===================== FUNDING REQUESTS ===================== */
app.post("/fund-request", auth, (req, res) => {
  const { amount, method, reference } = req.body;
  const requests = readJSON("requests.json", []);

  requests.push({
    id: "req_" + Date.now(),
    username: req.user.username,
    amount: Number(amount),
    method,
    reference,
    status: "pending",
    date: new Date().toISOString()
  });

  writeJSON("requests.json", requests);
  res.json({ message: "Funding request submitted" });
});

app.get("/my-requests", auth, (req, res) => {
  const requests = readJSON("requests.json", []);
  res.json(requests.filter(r => r.username === req.user.username));
});

/* ===================== ORDERS (SERVICES) ===================== */
app.post("/order", auth, (req, res) => {
  const { service, quantity, link, price } = req.body;
  const orders = readJSON("orders.json", []);
  const users = readJSON("users.json", []);

  const user = users.find(u => u.username === req.user.username);

  if (user.balance < price)
    return res.status(400).json({ error: "Insufficient balance" });

  user.balance -= Number(price);

  orders.push({
    id: "ord_" + Date.now(),
    username: user.username,
    service,
    quantity,
    link,
    price,
    status: "pending",
    date: new Date().toISOString()
  });

  writeJSON("orders.json", orders);
  writeJSON("users.json", users);

  res.json({ message: "Order placed successfully" });
});

app.get("/my-orders", auth, (req, res) => {
  const orders = readJSON("orders.json", []);
  res.json(orders.filter(o => o.username === req.user.username));
});

/* ===================== ADMIN ===================== */
app.get("/admin/orders", auth, (req, res) => {
  if (req.user.username !== "youngjoe05")
    return res.status(403).json({ error: "Forbidden" });

  res.json(readJSON("orders.json", []));
});

app.post("/admin/approve-funding", auth, (req, res) => {
  if (req.user.username !== "youngjoe05")
    return res.status(403).json({ error: "Forbidden" });

  const { requestId } = req.body;
  const requests = readJSON("requests.json", []);
  const users = readJSON("users.json", []);

  const request = requests.find(r => r.id === requestId);
  if (!request || request.status !== "pending")
    return res.status(400).json({ error: "Invalid request" });

  const user = users.find(u => u.username === request.username);
  user.balance += Number(request.amount);
  request.status = "approved";

  writeJSON("users.json", users);
  writeJSON("requests.json", requests);

  res.json({ message: "Funding approved" });
});

/* ===================== SERVICES ROUTE ===================== */
app.get("/services", (req, res) => {
  res.json(servicesList);
});

/* ===================== HEALTH ===================== */
app.get("/", (req, res) => {
  res.send("Joetech backend running");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
