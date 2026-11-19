require('dotenv').config()
require('express-async-errors') // ให้ async handler ส่ง error เข้า errorHandler
const express = require('express')
const cors = require('cors')
const path = require('path')
const db = require('./db')
const { notFound, errorHandler } = require('./middleware/error')

const app = express()
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',') }))
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.get('/api/health', (req, res) => res.json({ status: 'success', message: 'ok', data: { uptime: process.uptime() } }))
app.use('/api/auth', require('./routes/auth'))
app.use('/api/users', require('./routes/users'))
app.use('/api/categories', require('./routes/categories'))
app.use('/api/requests', require('./routes/requests'))
app.use('/api/dashboard', require('./routes/dashboard'))

app.use(notFound)
app.use(errorHandler)

// รอให้ DB พร้อมก่อน (จำเป็นเมื่อรันด้วย docker compose)
async function waitForDb(retries = 30) {
  for (let i = 1; i <= retries; i++) {
    try { await db.query('SELECT 1'); return } catch {
      console.log(`Waiting for database... (${i}/${retries})`)
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw new Error('Cannot connect to database')
}

waitForDb()
  .then(() => require('./seed')())
  .then(() => app.listen(process.env.PORT || 4000, () => console.log(`API on port ${process.env.PORT || 4000}`)))
  .catch((e) => { console.error(e); process.exit(1) })
