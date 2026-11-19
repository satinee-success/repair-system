// จำกัดข้อมูลงานซ่อมตามสิทธิ์
//  admin = ทั้งหมด | technician = งานที่ถูกมอบหมายให้ตน | user = งานที่ตนแจ้ง
exports.requestScope = (user) => {
  if (user.role === 'technician') return { sql: 'r.technician_id = ?', params: [user.id] }
  if (user.role === 'user') return { sql: 'r.requester_id = ?', params: [user.id] }
  return { sql: '', params: [] }
}
