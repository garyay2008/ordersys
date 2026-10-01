// 權限分級 middleware：管理員帳號（users）視為最高權限（level 4），
// POS 員工（staff）依 permissionLevel 判斷（1=服務員, 2=收銀員, 3=經理, 4=管理員）。
// 舊資料若缺 permissionLevel，則依 role 文字回退。
const isAdminUser = (req) => {
  const u = req.user
  return !!(u && u.constructor && u.constructor.modelName === 'users')
}

const roleLevel = { 管理員: 4, 經理: 3, 收銀員: 2, 服務員: 1 }

const staffLevel = (req) => {
  if (isAdminUser(req)) return 4
  const u = req.user
  if (!u) return 1
  if (u.permissionLevel !== undefined && u.permissionLevel !== null) {
    return Number(u.permissionLevel) || 1
  }
  return roleLevel[u.role] || 1
}

// 僅管理員帳號（users）可操作：資料庫備份/還原、管理員帳號維護等
const requireAdmin = (req, res, next) => {
  if (isAdminUser(req)) return next()
  return res.status(403).json({ msg: '權限不足：僅管理員可操作' })
}

// 需要最低權限等級（管理員帳號視為 level 4）
const requireLevel = (level) => (req, res, next) => {
  if (staffLevel(req) >= level) return next()
  return res.status(403).json({ msg: '權限不足' })
}

module.exports = { requireAdmin, requireLevel, isAdminUser, staffLevel }
