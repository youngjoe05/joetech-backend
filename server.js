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

// ---------- SAFE JSON HELPERS ----------
function readJSON(file) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([], null, 2));
      return [];
    }

    const data = fs.readFileSync(file, "utf8");
    if (!data.trim()) return [];

    return JSON.parse(data);
  } catch (err) {
    console.error("JSON READ ERROR:", file, err);
    return [];
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("JSON WRITE ERROR:", file, err);
  }
}

// ---------- AUTH MIDDLEWARE ----------
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

// ---------- AUTH ROUTES ----------
app.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "Missing username or password" });

    const users = readJSON("users.json");

    if (users.find(u => u.username === username))
      return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    users.push({ username, password: hashed, balance: 0 });

    writeJSON("users.json", users);
    res.json({ message: "Signup successful" });

  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = readJSON("users.json");
    const user = users.find(u => u.username === username);

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: "Invalid login" });

    const token = jwt.sign({ username }, SECRET, { expiresIn: "7d" });
    res.json({ token });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ---------- WALLET ----------
app.get("/balance", auth, (req, res) => {
  const users = readJSON("users.json");
  const user = users.find(u => u.username === req.user.username);
  res.json({ balance: user ? user.balance : 0 });
});

// ---------- FUND REQUEST ----------
app.post("/fund-request", auth, (req, res) => {
  const { amount, method, reference } = req.body;
  if (!amount || !method || !reference)
    return res.status(400).json({ error: "Missing fields" });

  const requests = readJSON("requests.json");

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

// ---------- HEALTH ----------
app.get("/", (req, res) => {
  res.send("Joetech backend running");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
