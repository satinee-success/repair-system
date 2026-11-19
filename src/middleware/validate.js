const fs = require('fs')
const path = require('path')
const { validationResult } = require('express-validator')

module.exports = (req, res, next) => {
  const r = validationResult(req)
  if (r.isEmpty()) return next()
  // ลบไฟล์ที่อัปโหลดมาแล้ว ถ้าข้อมูลไม่ผ่านการตรวจสอบ
  if (req.file) fs.unlink(path.join(__dirname, '../../uploads', req.file.filename), () => {})
  const errors = r.array().map((e) => ({ field: e.path, message: e.msg }))
  res.status(400).json({ status: 'error', message: errors[0].message, errors })
}
