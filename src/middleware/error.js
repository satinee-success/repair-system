const multer = require('multer')

exports.notFound = (req, res) =>
  res.status(404).json({ status: 'error', message: 'ไม่พบ API ที่เรียกใช้' })

exports.errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError)
    return res.status(400).json({
      status: 'error',
      message: err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ต้องมีขนาดไม่เกิน 2MB' : 'อัปโหลดไฟล์ไม่สำเร็จ'
    })
  if (err.message === 'INVALID_FILE_TYPE')
    return res.status(400).json({ status: 'error', message: 'รองรับเฉพาะไฟล์ jpg, png, pdf' })
  if (err.code === 'ER_DUP_ENTRY')
    return res.status(409).json({ status: 'error', message: 'ข้อมูลนี้มีอยู่ในระบบแล้ว' })
  if (err.code === 'ER_NO_REFERENCED_ROW_2')
    return res.status(400).json({ status: 'error', message: 'ข้อมูลอ้างอิงไม่ถูกต้อง (หมวดหมู่หรือผู้ใช้ไม่มีในระบบ)' })
  console.error(err)
  res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' })
}
