const test = require('node:test')
const assert = require('node:assert')
const { canDo } = require('../src/utils/workflow')

test('ช่างรับงานได้เฉพาะงานที่ assigned', () => {
  assert.strictEqual(canDo('accept', 'assigned'), true)
  assert.strictEqual(canDo('accept', 'pending'), false)
})
test('ปิดงานได้เฉพาะงานที่กำลังซ่อม', () => {
  assert.strictEqual(canDo('complete', 'in_progress'), true)
  assert.strictEqual(canDo('complete', 'assigned'), false)
})
test('งานที่เสร็จแล้วยกเลิกไม่ได้', () => assert.strictEqual(canDo('cancel', 'done'), false))
test('มอบหมายช่างได้ตอน pending หรือ assigned เท่านั้น', () => {
  assert.strictEqual(canDo('assign', 'pending'), true)
  assert.strictEqual(canDo('assign', 'in_progress'), false)
})
