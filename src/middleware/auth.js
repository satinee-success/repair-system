const jwt = require('jsonwebtoken')

// auth()            = ต้อง Login
// auth(['admin'])   = ต้อง Login และมี role ที่กำหนด
exports.auth = (roles = []) => (req, res, next) => {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ status: 'error', message: 'กรุณาเข้าสู่ระบบ' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ status: 'error', message: 'Token ไม่ถูกต้องหรือหมดอายุ' })
  }
  if (roles.length && !roles.includes(req.user.role))
    return res.status(403).json({ status: 'error', message: 'ไม่มีสิทธิ์เข้าถึง' })
  next()
}
