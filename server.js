const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());

// Path to orders "database"
const ordersFile = './orders.json';

// Helper to read orders
function readOrders() {
    if (!fs.existsSync(ordersFile)) return [];
    const data = fs.readFileSync(ordersFile, 'utf8');
    return data ? JSON.parse(data) : [];
}

// Helper to save orders
function saveOrders(orders) {
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
}

// Routes
app.get('/', (req, res) => {
    res.send('Joetech Backend is running!');
});

// Get all orders
app.get('/orders', (req, res) => {
    const orders = readOrders();
    res.json(orders);
});

// Create a new order
app.post('/orders', (req, res) => {
    const { name, service, amount } = req.body;
    if (!name || !service || !amount) {
        return res.status(400).json({ message: 'Please provide name, service, and amount.' });
    }

    const orders = readOrders();
    const newOrder = {
        id: orders.length + 1,
        name,
        service,
        amount,
        date: new Date().toISOString()
    };

    orders.push(newOrder);
    saveOrders(orders);
    res.json({ message: 'Order received!', order: newOrder });
});

// Start server
app.listen(PORT, () => {
    console.log(`Joetech backend running at http://localhost:${PORT}`);
});
