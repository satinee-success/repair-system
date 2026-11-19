const router = require('express').Router()
const { body } = require('express-validator')
const db = require('../db')
const validate = require('../middleware/validate')
const { auth } = require('../middleware/auth')
const { ok, fail, paging, like } = require('../utils/helpers')

const rules = [body('name').trim().notEmpty().withMessage('กรุณากรอกชื่อหมวดหมู่').isLength({ max: 100 }).withMessage('ชื่อยาวเกิน 100 ตัวอักษร')]

router.get('/', auth(), async (req, res) => {
  const { limit, offset } = paging(req.query)
  const where = req.query.search ? 'WHERE name LIKE ?' : ''
  const params = req.query.search ? [like(req.query.search)] : []
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM categories ${where}`, params)
  const [items] = await db.query(`SELECT id, name FROM categories ${where} ORDER BY name LIMIT ? OFFSET ?`, [...params, limit, offset])
  ok(res, { items, total })
})

router.post('/', auth(['admin']), ...rules, validate, async (req, res) => {
  const [r] = await db.query('INSERT INTO categories (name) VALUES (?)', [req.body.name])
  ok(res, { id: r.insertId }, 'เพิ่มหมวดหมู่สำเร็จ', 201)
})

router.put('/:id', auth(['admin']), ...rules, validate, async (req, res) => {
  const [r] = await db.query('UPDATE categories SET name = ? WHERE id = ?', [req.body.name, req.params.id])
  if (!r.affectedRows) return fail(res, 404, 'ไม่พบหมวดหมู่')
  ok(res, null, 'แก้ไขหมวดหมู่สำเร็จ')
})

router.delete('/:id', auth(['admin']), async (req, res) => {
  const [r] = await db.query('DELETE FROM categories WHERE id = ?', [req.params.id])
  if (!r.affectedRows) return fail(res, 404, 'ไม่พบหมวดหมู่')
  ok(res, null, 'ลบหมวดหมู่สำเร็จ')
})

module.exports = router
