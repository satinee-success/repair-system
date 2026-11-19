const bcrypt = require('bcryptjs')
const db = require('./db')

// ข้อมูลตั้งต้น (ทำครั้งเดียวตอนตาราง users ว่าง)  รหัสผ่านทุกบัญชี = 1234
module.exports = async () => {
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM users')
  if (n > 0) return
  const hash = bcrypt.hashSync('1234', 10)
  const users = [
    ['admin', 'ผู้ดูแลระบบ', '081-000-0001', 'admin'],
    ['tech1', 'ช่างสมศักดิ์ มือทอง', '081-000-0002', 'technician'],
    ['tech2', 'ช่างสมหมาย ใจเย็น', '081-000-0003', 'technician'],
    ['user1', 'คุณก้อง ใช้งาน', '081-000-0004', 'user'],
    ['user2', 'คุณขวัญ แจ้งซ่อม', '081-000-0005', 'user']
  ]
  for (const [u, f, p, r] of users)
    await db.query('INSERT INTO users (username, password, full_name, phone, role) VALUES (?,?,?,?,?)', [u, hash, f, p, r])

  for (const c of ['คอมพิวเตอร์', 'เครือข่าย', 'เครื่องพิมพ์', 'ไฟฟ้า', 'เครื่องปรับอากาศ'])
    await db.query('INSERT INTO categories (name) VALUES (?)', [c])

  const id = async (u) => (await db.query('SELECT id FROM users WHERE username = ?', [u]))[0][0].id
  const [admin, t1, t2, u1, u2] = [await id('admin'), await id('tech1'), await id('tech2'), await id('user1'), await id('user2')]
  const reqs = [
    ['คอมพิวเตอร์เปิดไม่ติด', 'กดปุ่มเปิดแล้วไม่มีไฟ', 'ห้อง 301', 1, u1, null, 'high', 'pending'],
    ['อินเทอร์เน็ตช้ามาก', 'ใช้ Wi-Fi ไม่ได้ทั้งชั้น', 'อาคาร A ชั้น 2', 2, u1, t1, 'normal', 'assigned'],
    ['เครื่องพิมพ์กระดาษติด', 'ดึงกระดาษไม่ออก', 'ห้องธุรการ', 3, u2, t1, 'low', 'in_progress'],
    ['หลอดไฟขาด', 'หลอดไฟหน้าห้องเรียนไม่ติด', 'ห้อง 205', 4, u2, t2, 'normal', 'done']
  ]
  for (const [title, desc, loc, cat, rq, tech, pri, st] of reqs) {
    const [r] = await db.query(
      'INSERT INTO repair_requests (title, description, location, category_id, requester_id, technician_id, priority, status) VALUES (?,?,?,?,?,?,?,?)',
      [title, desc, loc, cat, rq, tech, pri, st]
    )
    await db.query("INSERT INTO repair_logs (request_id, actor_id, action) VALUES (?,?, 'created')", [r.insertId, rq])
    if (tech) await db.query("INSERT INTO repair_logs (request_id, actor_id, action, note) VALUES (?,?, 'assigned', 'มอบหมายงาน')", [r.insertId, admin])
    if (st === 'in_progress' || st === 'done') await db.query("INSERT INTO repair_logs (request_id, actor_id, action) VALUES (?,?, 'accepted')", [r.insertId, tech])
    if (st === 'done') await db.query("INSERT INTO repair_logs (request_id, actor_id, action, note) VALUES (?,?, 'completed', 'เปลี่ยนหลอดไฟใหม่แล้ว')", [r.insertId, tech])
  }
  console.log('Seed data created (password = 1234)')
}
