<template>
  <el-dialog title="經理功能" :visible.sync="managerDialog.show" width="360px" custom-class="pos-dialog manager-dialog" append-to-body>
    <template v-if="!isManager">
      <div class="manager-login">
        <div class="login-head">
          <i class="el-icon-user-solid"></i>
          <span>經理身份驗證</span>
        </div>
        <el-input v-model="managerDialog.no" placeholder="經理編號" size="medium" class="login-field" clearable></el-input>
        <el-input v-model="managerDialog.password" type="password" placeholder="密碼" size="medium" class="login-field" show-password @keyup.enter.native="$emit('login')"></el-input>
      </div>
    </template>
    <template v-else>
      <div class="manager-menu">
        <button
          v-for="item in resolvedManagerMenu"
          :key="item.id"
          class="menu-btn"
          :class="menuClass(item)"
          type="button"
          @click="$emit('action', item.id)">
          <i :class="iconFor(item.id)"></i>
          <span>{{ item.label }}</span>
        </button>
        <button class="menu-btn menu-btn--info" type="button" @click="$emit('action', 'logout')">
          <i class="el-icon-switch-button"></i>
          <span>退出經理</span>
        </button>
      </div>
    </template>
    <div slot="footer" v-if="!isManager">
      <el-button @click="managerDialog.show = false">取 消</el-button>
      <el-button type="primary" @click="$emit('login')">登 入</el-button>
    </div>
  </el-dialog>
</template>

<script>
const ICON_MAP = {
  report: 'el-icon-data-analysis',
  dayReport: 'el-icon-data-analysis',
  refund: 'el-icon-refresh-left',
  copyOrder: 'el-icon-copy-document',
  leaveApp: 'el-icon-switch-button',
  clear: 'el-icon-delete',
  soldout: 'el-icon-close',
  manager: 'el-icon-setting',
  changePwd: 'el-icon-lock',
  changePay: 'el-icon-coin',
  merge: 'el-icon-connection',
  split: 'el-icon-scissors',
  transfer: 'el-icon-sort',
  reprint: 'el-icon-printer',
  refreshPos: 'el-icon-refresh',
  bundle: 'el-icon-price-tag'
}

export default {
  name: 'managerDialog',
  props: {
    managerDialog: { type: Object, required: true },
    isManager: { type: Boolean, default: false },
    resolvedManagerMenu: { type: Array, default: () => [] }
  },
  methods: {
    iconFor (id) {
      return ICON_MAP[id] || 'el-icon-more'
    },
    menuClass (item) {
      const t = item.type || ''
      if (t === 'danger') return 'menu-btn--danger'
      if (t === 'warning') return 'menu-btn--warning'
      if (t === 'success') return 'menu-btn--success'
      return 'menu-btn--default'
    }
  }
}
</script>

<style scoped>
.manager-login .login-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}
.manager-login .login-head i {
  font-size: 20px;
  color: #409eff;
}
.manager-login .login-field {
  margin-bottom: 12px;
}

.manager-menu {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.menu-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px 8px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #fff;
  color: #303133;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all .15s ease;
  outline: none;
  line-height: 1.2;
}
.menu-btn i {
  font-size: 24px;
}
.menu-btn:active {
  transform: scale(.96);
}
.menu-btn:hover {
  border-color: #c6e2ff;
  background: #ecf5ff;
  color: #409eff;
}
.menu-btn--default { color: #409eff; border-color: #d9ecff; background: #f4f9ff; }
.menu-btn--default:hover { background: #ecf5ff; }
.menu-btn--danger { color: #f56c6c; border-color: #fde2e2; background: #fef0f0; }
.menu-btn--danger:hover { border-color: #fab6b6; background: #fde2e2; color: #f56c6c; }
.menu-btn--warning { color: #e6a23c; border-color: #faecd8; background: #fdf6ec; }
.menu-btn--warning:hover { border-color: #f3d19e; background: #faecd8; color: #e6a23c; }
.menu-btn--success { color: #67c23a; border-color: #e1f3d8; background: #f0f9eb; }
.menu-btn--success:hover { border-color: #b3e19d; background: #e1f3d8; color: #67c23a; }
.menu-btn--primary { color: #409eff; border-color: #d9ecff; background: #f4f9ff; }
.menu-btn--primary:hover { background: #ecf5ff; }
.menu-btn--info { color: #909399; border-color: #e9e9eb; background: #f4f4f5; }
.menu-btn--info:hover { border-color: #c8c9cc; background: #e9e9eb; color: #909399; }
</style>
