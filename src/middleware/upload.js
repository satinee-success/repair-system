const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`)
  }
})

const ALLOWED = ['.jpg', '.jpeg', '.png', '.pdf']

module.exports = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    ALLOWED.includes(ext) ? cb(null, true) : cb(new Error('INVALID_FILE_TYPE'))
  }
})
