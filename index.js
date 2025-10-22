/**
 * Minimal Express backend with SQLite for LM ACCESSORIES
 * - Public: GET /api/products  => returns products with inStock boolean only (quantity hidden)
 * - Admin: POST /api/admin/login  => returns a simple token for demo
 * - Admin: POST /api/admin/products => add product (protected by token)
 * - Admin: POST /api/admin/update-stock => update stock amount
 * - Stripe payment endpoint: POST /api/create-payment-intent (requires STRIPE_SECRET in .env)
 *
 * Defaults (set in .env):
 * ADMIN_USER=LMACCESSORIES
 * ADMIN_PASS=Lney563901
 * VAT=18
 *
 * Run:
 * cd backend
 * npm install
 * node index.js
 */
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Env / config
const ADMIN_USER = process.env.ADMIN_USER || 'LMACCESSORIES';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Lney563901';
const VAT = Number(process.env.VAT || '18');
const STRIPE_SECRET = process.env.STRIPE_SECRET || '';

const PORT = process.env.PORT || 4000;

// Simple DB (file: lm_db.sqlite in project root)
const dbFile = path.join(__dirname, 'lm_db.sqlite');
const db = new Database(dbFile);
db.prepare(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  title TEXT,
  category TEXT,
  priceExcl REAL,
  stock INTEGER,
  image TEXT,
  updatedAt TEXT
)`).run();

// Helper: hide exact stock from public
function productPublicRow(row){
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    priceExcl: row.priceExcl,
    image: row.image,
    inStock: row.stock > 0,
    updatedAt: row.updatedAt
  }
}

// Public: list products
app.get('/api/products', (req,res)=>{
  const rows = db.prepare('SELECT * FROM products ORDER BY updatedAt DESC').all();
  res.json(rows.map(productPublicRow));
});

// Admin login (demo): returns a simple token
app.post('/api/admin/login', (req,res)=>{
  const { user, pass } = req.body;
  if(user === ADMIN_USER && pass === ADMIN_PASS){
    // simple token (not secure, demo only)
    const token = crypto.randomBytes(16).toString('hex');
    // store token in-memory (simple)
    app.locals.adminToken = token;
    return res.json({ token, vat: VAT });
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

// Admin middleware
function requireAdmin(req,res,next){
  const auth = req.headers.authorization || '';
  if(auth.startsWith('Bearer ')){
    const token = auth.replace('Bearer ','');
    if(app.locals.adminToken && app.locals.adminToken === token) return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

// Admin: add product
app.post('/api/admin/products', requireAdmin, (req,res)=>{
  const { title, category, priceExcl, stock, image } = req.body;
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO products (title, category, priceExcl, stock, image, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
  const info = stmt.run(title, category, priceExcl, stock||0, image||'', now);
  res.json({ id: info.lastInsertRowid });
});

// Admin: update stock
app.post('/api/admin/update-stock', requireAdmin, (req,res)=>{
  const { id, stock } = req.body;
  const stmt = db.prepare('UPDATE products SET stock = ?, updatedAt = ? WHERE id = ?');
  stmt.run(Number(stock), new Date().toISOString(), id);
  res.json({ ok: true });
});

// Stripe: create payment intent (demo - requires STRIPE_SECRET env var)
app.post('/api/create-payment-intent', async (req,res)=>{
  try{
    if(!STRIPE_SECRET) return res.status(500).json({ error: 'Stripe not configured. Set STRIPE_SECRET in .env to enable test payments.' });
    const stripe = require('stripe')(STRIPE_SECRET);
    const { items } = req.body; // items: [{id, qty}]
    // fetch products from DB to calculate total
    const ids = items.map(it=>Number(it.id));
    const rows = db.prepare(`SELECT id, priceExcl FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`).all(...ids);
    let amount = 0;
    items.forEach(it=>{
      const row = rows.find(r=>r.id === Number(it.id));
      if(row) amount += row.priceExcl * (it.qty||1);
    });
    // amount in kuruş (TRY minor units)
    const amountKurus = Math.round(amount * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountKurus,
      currency: 'try',
      payment_method_types: ['card'],
      metadata: {integration_check: 'accept_a_payment'}
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend if built (optional)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.listen(PORT, ()=> console.log('LM ACCESSORIES backend listening on', PORT));
