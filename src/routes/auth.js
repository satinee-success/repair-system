const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { body } = require('express-validator')
const db = require('../db')
const validate = require('../middleware/validate')
const { auth } = require('../middleware/auth')
const { ok, fail } = require('../utils/helpers')

router.post(
  '/login',
  body('username').trim().notEmpty().withMessage('กรุณากรอกชื่อผู้ใช้'),
  body('password').notEmpty().withMessage('กรุณากรอกรหัสผ่าน'),
  validate,
  async (req, res) => {
    const { username, password } = req.body
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username])
    const u = rows[0]
    if (!u || !(await bcrypt.compare(password, u.password)))
      return fail(res, 401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')

    const token = jwt.sign(
      { id: u.id, username: u.username, role: u.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )
    ok(res, { token }, 'เข้าสู่ระบบสำเร็จ')
  }
)

router.get('/me', auth(), async (req, res) => {
  const [rows] = await db.query('SELECT id, username, full_name, role FROM users WHERE id = ?', [req.user.id])
  if (!rows[0]) return fail(res, 404, 'ไม่พบผู้ใช้')
  ok(res, rows[0])
})

module.exports = router
