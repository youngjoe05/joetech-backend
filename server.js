const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const usersFile = path.join(__dirname, 'users.json');
const ordersFile = path.join(__dirname, 'orders.json');

/* =======================
   HELPERS
======================= */
function readJSON(file) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* =======================
   AUTH ROUTES
======================= */

// SIGN UP
app.post('/signup', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  const users = readJSON(usersFile);

  const exists = users.find(u => u.username === username);
  if (exists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  users.push({
    username,
    password,
    nairaBalance: 0,
    usdBalance: 0
  });

  writeJSON(usersFile, users);
  res.json({ message: 'Signup successful' });
});

// LOGIN
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const users = readJSON(usersFile);
  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid login details' });
  }

  res.json({
    message: 'Login successful',
    username,
    nairaBalance: user.nairaBalance,
    usdBalance: user.usdBalance
  });
});

/* =======================
   USER BALANCE
======================= */

// GET USER BALANCE
app.get('/balance/:username', (req, res) => {
  const users = readJSON(usersFile);
  const user = users.find(u => u.username === req.params.username);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json({
    nairaBalance: user.nairaBalance,
    usdBalance: user.usdBalance
  });
});

/* =======================
   ORDERS
======================= */

// GET ALL ORDERS
app.get('/orders', (req, res) => {
  const orders = readJSON(ordersFile);
  res.json(orders);
});

// CREATE ORDER
app.post('/orders', (req, res) => {
  const orders = readJSON(ordersFile);

  const newOrder = {
    ...req.body,
    id: Date.now(),
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  orders.push(newOrder);
  writeJSON(ordersFile, orders);

  res.json({ message: 'Order created successfully' });
});

/* =======================
   SERVER
======================= */

app.get('/', (req, res) => {
  res.send('Joetech Backend is running 🚀');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
