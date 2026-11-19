const router = require('express').Router()
const bcrypt = require('bcryptjs')
const { body } = require('express-validator')
const db = require('../db')
const validate = require('../middleware/validate')
const { auth } = require('../middleware/auth')
const { ok, fail, paging, like } = require('../utils/helpers')

const ROLES = ['admin', 'technician', 'user']

// รายชื่อช่าง สำหรับ dropdown มอบหมายงาน (admin)
router.get('/technicians', auth(['admin']), async (req, res) => {
  const [rows] = await db.query("SELECT id, full_name, phone FROM users WHERE role = 'technician' ORDER BY full_name")
  ok(res, rows)
})

router.get('/', auth(['admin']), async (req, res) => {
  const { limit, offset } = paging(req.query)
  const where = []
  const params = []
  if (req.query.search) {
    where.push('(username LIKE ? OR full_name LIKE ?)')
    params.push(like(req.query.search), like(req.query.search))
  }
  if (ROLES.includes(req.query.role)) {
    where.push('role = ?')
    params.push(req.query.role)
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users ${w}`, params)
  const [items] = await db.query(
    `SELECT id, username, full_name, phone, role, created_at FROM users ${w} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
  ok(res, { items, total })
})

router.get('/:id', auth(['admin']), async (req, res) => {
  const [rows] = await db.query('SELECT id, username, full_name, phone, role FROM users WHERE id = ?', [req.params.id])
  if (!rows[0]) return fail(res, 404, 'ไม่พบผู้ใช้')
  ok(res, rows[0])
})

const baseRules = [
  body('full_name').trim().notEmpty().withMessage('กรุณากรอกชื่อ-นามสกุล').isLength({ max: 100 }),
  body('phone').optional({ values: 'falsy' }).matches(/^[0-9\-]{9,20}$/).withMessage('เบอร์โทรไม่ถูกต้อง'),
  body('role').isIn(ROLES).withMessage('สิทธิ์ผู้ใช้ไม่ถูกต้อง')
]

router.post(
  '/',
  auth(['admin']),
  body('username').trim().matches(/^[a-zA-Z0-9_]{3,50}$/).withMessage('ชื่อผู้ใช้ต้องเป็น a-z, 0-9, _ ยาว 3-50 ตัว'),
  body('password').isLength({ min: 4 }).withMessage('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร'),
  ...baseRules,
  validate,
  async (req, res) => {
    const { username, password, full_name, phone, role } = req.body
    const hash = await bcrypt.hash(password, 10)
    const [r] = await db.query('INSERT INTO users (username, password, full_name, phone, role) VALUES (?,?,?,?,?)', [
      username, hash, full_name, phone || null, role
    ])
    ok(res, { id: r.insertId }, 'เพิ่มผู้ใช้สำเร็จ', 201)
  }
)

router.put(
  '/:id',
  auth(['admin']),
  body('password').optional({ values: 'falsy' }).isLength({ min: 4 }).withMessage('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร'),
  ...baseRules,
  validate,
  async (req, res) => {
    const { password, full_name, phone, role } = req.body
    const [rows] = await db.query('SELECT id FROM users WHERE id = ?', [req.params.id])
    if (!rows[0]) return fail(res, 404, 'ไม่พบผู้ใช้')
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await db.query('UPDATE users SET full_name=?, phone=?, role=?, password=? WHERE id=?', [full_name, phone || null, role, hash, req.params.id])
    } else {
      await db.query('UPDATE users SET full_name=?, phone=?, role=? WHERE id=?', [full_name, phone || null, role, req.params.id])
    }
    ok(res, null, 'แก้ไขผู้ใช้สำเร็จ')
  }
)

router.delete('/:id', auth(['admin']), async (req, res) => {
  if (Number(req.params.id) === req.user.id) return fail(res, 400, 'ไม่สามารถลบบัญชีของตนเองได้')
  const [r] = await db.query('DELETE FROM users WHERE id = ?', [req.params.id])
  if (!r.affectedRows) return fail(res, 404, 'ไม่พบผู้ใช้')
  ok(res, null, 'ลบผู้ใช้สำเร็จ')
})

module.exports = router
