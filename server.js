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

// ---------- Helpers ----------
function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ---------- AUTH ----------
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const users = readJSON("users.json");

  if (users.find(u => u.username === username))
    return res.status(400).json({ error: "User exists" });

  const hashed = await bcrypt.hash(password, 10);
  users.push({ username, password: hashed, balance: 0 });
  writeJSON("users.json", users);

  res.json({ message: "Signup successful" });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const users = readJSON("users.json");
  const user = users.find(u => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).json({ error: "Invalid login" });

  const token = jwt.sign({ username }, SECRET, { expiresIn: "7d" });
  res.json({ token });
});

// ---------- WALLET ----------
app.get("/balance", auth, (req, res) => {
  const users = readJSON("users.json");
  const user = users.find(u => u.username === req.user.username);
  res.json({ balance: user.balance });
});

// ---------- FUND REQUEST SYSTEM ----------
app.post("/fund-request", auth, (req, res) => {
  const { amount, method, reference } = req.body;
  const requests = readJSON("requests.json");

  requests.push({
    id: "req_" + Date.now(),
    username: req.user.username,
    amount,
    method,
    reference,
    status: "pending",
    date: new Date().toISOString()
  });

  writeJSON("requests.json", requests);
  res.json({ message: "Funding request submitted" });
});

app.get("/my-requests", auth, (req, res) => {
  const requests = readJSON("requests.json");
  res.json(requests.filter(r => r.username === req.user.username));
});

// ---------- ADMIN ----------
app.get("/admin/requests", auth, (req, res) => {
  if (req.user.username !== "youngjoe05")
    return res.status(403).json({ error: "Forbidden" });

  res.json(readJSON("requests.json"));
});

app.post("/admin/approve", auth, (req, res) => {
  if (req.user.username !== "youngjoe05")
    return res.status(403).json({ error: "Forbidden" });

  const { requestId } = req.body;
  const requests = readJSON("requests.json");
  const users = readJSON("users.json");

  const reqItem = requests.find(r => r.id === requestId);
  if (!reqItem || reqItem.status !== "pending")
    return res.status(400).json({ error: "Invalid request" });

  const user = users.find(u => u.username === reqItem.username);
  user.balance += Number(reqItem.amount);
  reqItem.status = "approved";

  writeJSON("users.json", users);
  writeJSON("requests.json", requests);

  res.json({ message: "Approved and wallet funded" });
});

// ---------- HEALTH ----------
app.get("/", (req, res) => res.send("Joetech backend running"));

app.listen(PORT, () => console.log("Server running on " + PORT));
