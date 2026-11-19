exports.ok = (res, data = null, message = 'ok', code = 200) =>
  res.status(code).json({ status: 'success', message, data })

exports.fail = (res, code, message) =>
  res.status(code).json({ status: 'error', message })

exports.paging = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 10))
  return { page, limit, offset: (page - 1) * limit }
}

exports.like = (s) => `%${String(s || '').trim()}%`
