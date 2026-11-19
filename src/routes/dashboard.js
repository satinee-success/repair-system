const router = require('express').Router()
const db = require('../db')
const { auth } = require('../middleware/auth')
const { ok } = require('../utils/helpers')
const { requestScope } = require('../utils/scope')

// GET /api/dashboard/summary  สถิติตามสิทธิ์ของผู้ใช้
router.get('/summary', auth(), async (req, res) => {
  const sc = requestScope(req.user)
  const w = sc.sql ? `WHERE ${sc.sql}` : ''
  const [rows] = await db.query(`SELECT r.status, COUNT(*) AS n FROM repair_requests r ${w} GROUP BY r.status`, sc.params)
  const statuses = { pending: 0, assigned: 0, in_progress: 0, done: 0, cancelled: 0 }
  rows.forEach((r) => { statuses[r.status] = r.n })
  const total = Object.values(statuses).reduce((a, b) => a + b, 0)

  let cards
  if (req.user.role === 'admin') {
    const [[u]] = await db.query('SELECT COUNT(*) AS n FROM users')
    cards = [
      { label: 'ผู้ใช้ทั้งหมด', value: u.n },
      { label: 'งานทั้งหมด', value: total },
      { label: 'รอจัดสรรช่าง', value: statuses.pending },
      { label: 'ซ่อมเสร็จ', value: statuses.done }
    ]
  } else if (req.user.role === 'technician') {
    cards = [
      { label: 'งานที่ได้รับมอบหมาย', value: total },
      { label: 'รอรับงาน', value: statuses.assigned },
      { label: 'กำลังซ่อม', value: statuses.in_progress },
      { label: 'ซ่อมเสร็จ', value: statuses.done }
    ]
  } else {
    cards = [
      { label: 'งานที่แจ้งทั้งหมด', value: total },
      { label: 'รอดำเนินการ', value: statuses.pending + statuses.assigned },
      { label: 'กำลังซ่อม', value: statuses.in_progress },
      { label: 'ซ่อมเสร็จ', value: statuses.done }
    ]
  }
  ok(res, { cards, statuses })
})

module.exports = router
