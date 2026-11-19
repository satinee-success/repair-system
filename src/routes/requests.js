const router = require('express').Router()
const fs = require('fs')
const path = require('path')
const { body } = require('express-validator')
const db = require('../db')
const upload = require('../middleware/upload')
const validate = require('../middleware/validate')
const { auth } = require('../middleware/auth')
const { ok, fail, paging, like } = require('../utils/helpers')
const { requestScope } = require('../utils/scope')
const { canDo } = require('../utils/workflow')

const BASE = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`
const withUrl = (r) => ({ ...r, file_url: r.file_path ? `${BASE}/uploads/${r.file_path}` : null })
const removeFile = (name) => name && fs.unlink(path.join(__dirname, '../../uploads', name), () => {})
const writeLog = (requestId, actorId, action, note = null) =>
  db.query('INSERT INTO repair_logs (request_id, actor_id, action, note) VALUES (?,?,?,?)', [requestId, actorId, action, note])

const FROM = `FROM repair_requests r
  LEFT JOIN categories c ON c.id = r.category_id
  JOIN users rq ON rq.id = r.requester_id
  LEFT JOIN users t ON t.id = r.technician_id`
const SELECT = `SELECT r.id, r.title, r.description, r.location, r.priority, r.status, r.file_path, r.tech_note,
  r.category_id, r.requester_id, r.technician_id, r.created_at, r.updated_at,
  c.name AS category_name, rq.full_name AS requester_name, t.full_name AS technician_name ${FROM}`

// หางานซ่อมตามสิทธิ์ (admin ทั้งหมด / ช่างเฉพาะงานตน / user เฉพาะที่ตนแจ้ง)
async function findScoped(req, id) {
  const sc = requestScope(req.user)
  const where = ['r.id = ?', ...(sc.sql ? [sc.sql] : [])].join(' AND ')
  const [rows] = await db.query(`${SELECT} WHERE ${where}`, [id, ...sc.params])
  return rows[0]
}

const rules = [
  body('title').trim().notEmpty().withMessage('กรุณากรอกหัวข้อแจ้งซ่อม').isLength({ max: 150 }).withMessage('หัวข้อยาวเกิน 150 ตัวอักษร'),
  body('description').optional({ values: 'falsy' }).isLength({ max: 1000 }).withMessage('รายละเอียดยาวเกิน 1000 ตัวอักษร'),
  body('location').optional({ values: 'falsy' }).isLength({ max: 150 }).withMessage('สถานที่ยาวเกิน 150 ตัวอักษร'),
  body('category_id').optional({ values: 'falsy' }).isInt().withMessage('หมวดหมู่ไม่ถูกต้อง'),
  body('priority').optional({ values: 'falsy' }).isIn(['low', 'normal', 'high']).withMessage('ระดับความสำคัญไม่ถูกต้อง')
]

// GET /api/requests?page=&limit=&search=&status=&category_id=
router.get('/', auth(), async (req, res) => {
  const { limit, offset } = paging(req.query)
  const sc = requestScope(req.user)
  const where = sc.sql ? [sc.sql] : []
  const params = [...sc.params]
  if (req.query.search) {
    where.push('(r.title LIKE ? OR r.location LIKE ? OR rq.full_name LIKE ?)')
    params.push(like(req.query.search), like(req.query.search), like(req.query.search))
  }
  if (req.query.status) { where.push('r.status = ?'); params.push(req.query.status) }
  if (req.query.category_id) { where.push('r.category_id = ?'); params.push(req.query.category_id) }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${FROM} ${w}`, params)
  const [rows] = await db.query(`${SELECT} ${w} ORDER BY r.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset])
  ok(res, { items: rows.map(withUrl), total })
})

// GET /api/requests/:id  (พร้อมประวัติการดำเนินการ)
router.get('/:id', auth(), async (req, res) => {
  const row = await findScoped(req, req.params.id)
  if (!row) return fail(res, 404, 'ไม่พบงานแจ้งซ่อม')
  const [logs] = await db.query(
    `SELECT l.id, l.action, l.note, l.created_at, u.full_name AS actor_name
       FROM repair_logs l LEFT JOIN users u ON u.id = l.actor_id WHERE l.request_id = ? ORDER BY l.id`,
    [row.id]
  )
  ok(res, { ...withUrl(row), logs })
})

// POST /api/requests  (user แจ้งซ่อม / admin เพิ่มข้อมูล)  multipart/form-data: title, description, location, category_id, priority, file
router.post('/', auth(['admin', 'user']), upload.single('file'), ...rules, validate, async (req, res) => {
  const { title, description, location, category_id, priority } = req.body
  const fileName = req.file ? req.file.filename : null
  try {
    const [r] = await db.query(
      'INSERT INTO repair_requests (title, description, location, category_id, requester_id, priority, file_path) VALUES (?,?,?,?,?,?,?)',
      [title, description || null, location || null, category_id || null, req.user.id, priority || 'normal', fileName]
    )
    await writeLog(r.insertId, req.user.id, 'created')
    ok(res, { id: r.insertId }, 'แจ้งซ่อมสำเร็จ', 201)
  } catch (e) {
    removeFile(fileName)
    throw e
  }
})

// PUT /api/requests/:id  admin แก้ไขได้ทุกงานที่ยังไม่ปิด / user แก้ไขได้เฉพาะงานของตนที่ยัง pending
router.put('/:id', auth(['admin', 'user']), upload.single('file'), ...rules, validate, async (req, res) => {
  const old = await findScoped(req, req.params.id)
  const bail = (code, msg) => { if (req.file) removeFile(req.file.filename); return fail(res, code, msg) }
  if (!old) return bail(404, 'ไม่พบงานแจ้งซ่อม')
  if (req.user.role === 'user' && old.status !== 'pending') return bail(403, 'แก้ไขได้เฉพาะงานที่ยังรอดำเนินการ')
  if (['done', 'cancelled'].includes(old.status)) return bail(409, 'งานนี้ปิดแล้ว ไม่สามารถแก้ไขได้')

  const { title, description, location, category_id, priority } = req.body
  const fileName = req.file ? req.file.filename : old.file_path
  await db.query(
    'UPDATE repair_requests SET title=?, description=?, location=?, category_id=?, priority=?, file_path=? WHERE id=?',
    [title, description || null, location || null, category_id || null, priority || old.priority, fileName, old.id]
  )
  if (req.file) removeFile(old.file_path)
  await writeLog(old.id, req.user.id, 'edited')
  ok(res, null, 'แก้ไขงานแจ้งซ่อมสำเร็จ')
})

// DELETE /api/requests/:id  admin ลบได้ทุกงาน / user ลบได้เฉพาะงานของตนที่ยัง pending
router.delete('/:id', auth(['admin', 'user']), async (req, res) => {
  const old = await findScoped(req, req.params.id)
  if (!old) return fail(res, 404, 'ไม่พบงานแจ้งซ่อม')
  if (req.user.role === 'user' && old.status !== 'pending') return fail(res, 403, 'ลบได้เฉพาะงานที่ยังรอดำเนินการ')
  await db.query('DELETE FROM repair_requests WHERE id = ?', [old.id])
  removeFile(old.file_path)
  ok(res, null, 'ลบงานแจ้งซ่อมสำเร็จ')
})

// PUT /api/requests/:id/assign  (admin) body: technician_id, priority?, note?
router.put(
  '/:id/assign',
  auth(['admin']),
  body('technician_id').isInt().withMessage('กรุณาเลือกช่าง'),
  body('priority').optional({ values: 'falsy' }).isIn(['low', 'normal', 'high']).withMessage('ระดับความสำคัญไม่ถูกต้อง'),
  body('note').optional({ values: 'falsy' }).isLength({ max: 255 }).withMessage('หมายเหตุยาวเกิน 255 ตัวอักษร'),
  validate,
  async (req, res) => {
    const old = await findScoped(req, req.params.id)
    if (!old) return fail(res, 404, 'ไม่พบงานแจ้งซ่อม')
    if (!canDo('assign', old.status)) return fail(res, 409, 'งานนี้ไม่อยู่ในสถานะที่มอบหมายช่างได้')
    const [tech] = await db.query("SELECT id, full_name FROM users WHERE id = ? AND role = 'technician'", [req.body.technician_id])
    if (!tech[0]) return fail(res, 400, 'ไม่พบช่างที่เลือก')
    await db.query("UPDATE repair_requests SET technician_id=?, status='assigned', priority=? WHERE id=?", [
      tech[0].id, req.body.priority || old.priority, old.id
    ])
    await writeLog(old.id, req.user.id, 'assigned', req.body.note || `มอบหมายให้ ${tech[0].full_name}`)
    ok(res, null, 'มอบหมายช่างสำเร็จ')
  }
)

// เปลี่ยนสถานะงาน: accept / reject / complete (ช่าง) และ cancel (admin)
function transition({ action, roles, to, log, noteRequired = false, clearTech = false, saveNote = false, message }) {
  router.put(
    `/:id/${action}`,
    auth(roles),
    noteRequired
      ? body('note').trim().notEmpty().withMessage('กรุณาระบุเหตุผล').isLength({ max: 255 }).withMessage('ยาวเกิน 255 ตัวอักษร')
      : body('note').optional({ values: 'falsy' }).isLength({ max: 255 }).withMessage('หมายเหตุยาวเกิน 255 ตัวอักษร'),
    validate,
    async (req, res) => {
      const r = await findScoped(req, req.params.id) // ช่างเห็นเฉพาะงานที่ถูกมอบหมายให้ตน
      if (!r) return fail(res, 404, 'ไม่พบงานแจ้งซ่อม')
      if (!canDo(action, r.status)) return fail(res, 409, 'สถานะงานปัจจุบันไม่สามารถทำรายการนี้ได้')
      const sets = ['status = ?']
      const params = [to]
      if (clearTech) sets.push('technician_id = NULL')
      if (saveNote && req.body.note) { sets.push('tech_note = ?'); params.push(req.body.note) }
      await db.query(`UPDATE repair_requests SET ${sets.join(', ')} WHERE id = ?`, [...params, r.id])
      await writeLog(r.id, req.user.id, log, req.body.note || null)
      ok(res, null, message)
    }
  )
}

transition({ action: 'accept',   roles: ['technician'], to: 'in_progress', log: 'accepted',  message: 'รับงานสำเร็จ' })
transition({ action: 'reject',   roles: ['technician'], to: 'pending',     log: 'rejected',  message: 'ปฏิเสธงานแล้ว (งานกลับไปรอจัดสรรช่าง)', noteRequired: true, clearTech: true })
transition({ action: 'complete', roles: ['technician'], to: 'done',        log: 'completed', message: 'บันทึกซ่อมเสร็จสำเร็จ', saveNote: true })
transition({ action: 'cancel',   roles: ['admin'],      to: 'cancelled',   log: 'cancelled', message: 'ยกเลิกงานสำเร็จ' })

module.exports = router
