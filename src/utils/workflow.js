// สถานะงานซ่อม: pending -> assigned -> in_progress -> done  (หรือ cancelled)
// แต่ละ action ทำได้เฉพาะเมื่ออยู่ในสถานะที่กำหนด
const ALLOWED = {
  assign:   ['pending', 'assigned'],                  // admin มอบหมาย/เปลี่ยนช่าง
  accept:   ['assigned'],                             // ช่างรับงาน
  reject:   ['assigned'],                             // ช่างปฏิเสธงาน -> กลับไป pending
  complete: ['in_progress'],                          // ช่างแจ้งซ่อมเสร็จ
  cancel:   ['pending', 'assigned', 'in_progress']    // admin ยกเลิกงาน
}

exports.ALLOWED = ALLOWED
exports.canDo = (action, status) => (ALLOWED[action] || []).includes(status)
