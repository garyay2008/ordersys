<template>
  <div id="staff-mgr">
    <el-row>
      <el-button type="primary" size="small" class="btn-shadow" @click="addStaff">添加用戶</el-button>
    </el-row>
    <el-row class="row-height">
      <el-col :span="24">
        <el-table :data="list" size="medium" :max-height="tableHeight" style="width: 100%">
          <el-table-column align="center" prop="no" width="100" label="用戶編號"></el-table-column>
          <el-table-column align="center" prop="name" label="用戶名稱" width="120"></el-table-column>
          <el-table-column align="center" width="100" label="用戶權限">
            <template slot-scope="scope">
              <el-tag size="mini" :type="roleType(scope.row.role)">{{ scope.row.role }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" width="80" label="等級">
            <template slot-scope="scope">
              <el-tag size="mini" :type="levelType(scope.row.permissionLevel)">{{ scope.row.permissionLevel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="left" label="額外權限">
            <template slot-scope="scope">
              <div v-if="(scope.row.permissions || []).length" class="perm-tags">
                <el-tag v-for="p in scope.row.permissions" :key="p" size="mini" type="info" class="perm-tag">{{ permLabel(p) }}</el-tag>
              </div>
              <span v-else style="color: #c0c4cc; font-size: 12px;">無額外權限</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="80" label="狀態">
            <template slot-scope="scope">
              <el-tag size="mini" :type="scope.row.enabled ? 'success' : 'info'">{{ scope.row.enabled ? '啟用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column fixed="right" align="center" width="180" label="操作">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="editStaff(scope.row)">編輯</el-button>
              <el-button type="text" size="small" @click="openPermDialog(scope.row)">設定權限</el-button>
              <el-button type="text" size="small" style="color: #f56c6c;" @click="delStaff(scope.row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>

    <!-- 添加 / 編輯用戶 -->
    <el-dialog :title="dialog.title" :visible.sync="dialog.show" width="420px">
      <el-form ref="staffForm" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="用戶名稱" prop="name">
          <el-input v-model="form.name" placeholder="如 張三 / 經理01"></el-input>
        </el-form-item>
        <el-form-item label="用戶編號" prop="no">
          <el-input v-model="form.no" placeholder="如 001 / A01"></el-input>
        </el-form-item>
        <el-form-item label="用戶權限">
          <el-select v-model="form.role" style="width: 100%;">
            <el-option label="管理員" value="管理員"></el-option>
            <el-option label="經理" value="經理"></el-option>
            <el-option label="收銀員" value="收銀員"></el-option>
            <el-option label="服務員" value="服務員"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="權限等級">
          <el-select v-model="form.permissionLevel" style="width: 100%;">
            <el-option label="4 - 管理員（全部權限）" :value="4"></el-option>
            <el-option label="3 - 經理" :value="3"></el-option>
            <el-option label="2 - 收銀員" :value="2"></el-option>
            <el-option label="1 - 服務員" :value="1"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="登入密碼">
          <el-input v-model="form.password" type="password" placeholder="POS 登入密碼（可留空）" show-password></el-input>
        </el-form-item>
        <el-form-item label="預設收銀機">
          <el-select v-model="form.defaultTerminal" placeholder="不指定" clearable style="width: 100%;">
            <el-option v-for="t in terminalOptions" :key="t._id" :label="t.code + ' — ' + t.name" :value="t.code"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="啟用">
          <el-switch v-model="form.enabled"></el-switch>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialog.show = false">取 消</el-button>
        <el-button type="primary" @click="submitStaff('staffForm')">確 定</el-button>
      </div>
    </el-dialog>

    <!-- 設定額外權限 -->
    <el-dialog :title="permDialog.staffName + ' 的權限設定'" :visible.sync="permDialog.show" width="520px" append-to-body>
      <div style="margin-bottom: 12px;">
        <el-button size="mini" @click="selectPermGroup('all')">全選</el-button>
        <el-button size="mini" @click="selectPermGroup('none')">清除全部</el-button>
        <el-button size="mini" @click="selectPermGroup('service')">套用服務員預設</el-button>
        <el-button size="mini" @click="selectPermGroup('cashier')">套用收銀員預設</el-button>
      </div>
      <div v-for="group in permGroups" :key="group.key" class="perm-group">
        <div class="perm-group-title">{{ group.label }}</div>
        <div class="perm-group-items">
          <el-checkbox v-for="item in group.items" :key="item.key" v-model="permDialog.selected" :label="item.key">{{ item.label }}</el-checkbox>
        </div>
      </div>
      <div slot="footer">
        <el-button @click="permDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="savePerm">儲 存</el-button>
      </div>
    </el-dialog>

    <el-card class="box-card" style="max-width: 960px; margin-top: 16px;">
      <div slot="header" class="clearfix">
        <span>權限等級說明</span>
      </div>
      <el-table :data="permExplain" size="mini" style="width: 100%;">
        <el-table-column prop="level" label="等級" width="60"></el-table-column>
        <el-table-column prop="role" label="角色" width="100"></el-table-column>
        <el-table-column prop="desc" label="預設權限"></el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script>
const ALL_PERMS = {
  order: [
    { key: 'order.create', label: '基本點餐' },
    { key: 'order.send', label: '送單' },
    { key: 'order.print', label: '印單' },
    { key: 'order.changeSentQty', label: '已送品項改數量' },
    { key: 'order.voidItem', label: '退菜' },
    { key: 'order.cancel', label: '取消訂單' },
    { key: 'order.hold', label: '掛單 / 叫回' }
  ],
  payment: [
    { key: 'payment.checkout', label: '結帳' },
    { key: 'payment.discount', label: '使用折扣' },
    { key: 'payment.changeMethod', label: '更改付款方式' },
    { key: 'payment.refund', label: '退款' }
  ],
  table: [
    { key: 'table.add', label: '加枱' },
    { key: 'table.merge', label: '合拼枱' },
    { key: 'table.split', label: '分單' },
    { key: 'table.transfer', label: '轉枱' },
    { key: 'table.layout', label: '編排枱位' }
  ],
  commodity: [
    { key: 'commodity.soldout', label: '沽清設定' },
    { key: 'commodity.stock', label: '修改庫存' }
  ],
  report: [
    { key: 'report.business', label: '營業報表' },
    { key: 'report.cashier', label: '收銀員報表' },
    { key: 'report.department', label: '分區營業報表' },
    { key: 'report.print', label: '列印報表' }
  ],
  system: [
    { key: 'system.staff', label: '員工管理' },
    { key: 'system.posSetting', label: 'POS 功能設定' },
    { key: 'system.printer', label: '打印機設定' }
  ]
}

const PERM_GROUPS = [
  { key: 'order', label: '訂單功能', items: ALL_PERMS.order },
  { key: 'payment', label: '收銀功能', items: ALL_PERMS.payment },
  { key: 'table', label: '枱位功能', items: ALL_PERMS.table },
  { key: 'commodity', label: '貨品功能', items: ALL_PERMS.commodity },
  { key: 'report', label: '報表功能', items: ALL_PERMS.report },
  { key: 'system', label: '系統設定', items: ALL_PERMS.system }
]

const SERVICE_DEFAULTS = ['order.create', 'order.send', 'order.print', 'order.hold', 'table.add']
const CASHIER_DEFAULTS = SERVICE_DEFAULTS.concat(['payment.checkout', 'payment.discount', 'commodity.soldout', 'commodity.stock'])

const ALL_PERM_LIST = []
ALL_PERMS.order.concat(ALL_PERMS.payment, ALL_PERMS.table, ALL_PERMS.commodity, ALL_PERMS.report, ALL_PERMS.system).forEach(p => ALL_PERM_LIST.push(p.key))

export default {
  name: 'staffMgr',
  data () {
    return {
      dialog: { show: false, title: '', option: 'add' },
      form: { name: '', no: '', role: '服務員', permissionLevel: 1, password: '', enabled: true, defaultTerminal: '' },
      terminalOptions: [],
      permDialog: { show: false, staffId: '', staffName: '', selected: [] },
      permGroups: PERM_GROUPS,
      list: [],
      permExplain: [
        { level: 1, role: '服務員', desc: '基本點餐、送單、印單（可額外開放已送品項改數量等）' },
        { level: 2, role: '收銀員', desc: '結帳、折扣、沽清設定（可額外開放其他權限）' },
        { level: 3, role: '經理', desc: '合拼枱、分單、轉枱、報表、加枱（可額外開放其他權限）' },
        { level: 4, role: '管理員', desc: '全部 POS 功能（不受額外權限限制）' }
      ],
      tableHeight: window.innerHeight - 150,
      rules: {
        name: [{ required: true, message: '用戶名稱不能為空', trigger: 'blur' }]
      }
    }
  },
  methods: {
    roleType (role) {
      if (role === '管理員') return 'danger'
      if (role === '經理') return 'warning'
      if (role === '收銀員') return ''
      return 'success'
    },
    levelType (level) {
      if (level >= 4) return 'danger'
      if (level === 3) return 'warning'
      if (level === 2) return ''
      return 'success'
    },
    permLabel (key) {
      for (const g of ALL_PERMS.order.concat(ALL_PERMS.payment, ALL_PERMS.table, ALL_PERMS.commodity, ALL_PERMS.report, ALL_PERMS.system)) {
        if (g.key === key) return g.label
      }
      return key
    },
    loadData () {
      this.$axios.get('/api/staff/all')
        .then(res => { this.list = res.data || [] })
        .catch(err => console.log(err))
      this.loadTerminals()
    },
    loadTerminals () {
      this.$axios.get('/api/posterminal/enabled')
        .then(res => { this.terminalOptions = (res.data || []).filter(t => t.enabled) })
        .catch(() => { this.terminalOptions = [] })
    },
    addStaff () {
      this.dialog = { show: true, title: '添加用戶', option: 'add' }
      this.form = { name: '', no: '', role: '服務員', permissionLevel: 1, password: '', enabled: true, defaultTerminal: '' }
    },
    editStaff (row) {
      this.dialog = { show: true, title: '編輯用戶', option: 'edit' }
      this.form = Object.assign({}, row, { password: '' })
    },
    delStaff (row) {
      this.$confirm(`確認刪除用戶「${row.name}」嗎？`)
        .then(_ => {
          this.$axios.post('/api/staff/del', { _id: row._id })
            .then(result => {
              this.$message({ type: 'success', message: result.data })
              this.loadData()
            })
            .catch(err => console.log(err))
        })
        .catch(_ => {})
    },
    openPermDialog (row) {
      this.permDialog = { show: true, staffId: row._id, staffName: row.name, selected: (row.permissions || []).slice() }
    },
    selectPermGroup (mode) {
      if (mode === 'all') this.permDialog.selected = ALL_PERM_LIST.slice()
      else if (mode === 'none') this.permDialog.selected = []
      else if (mode === 'service') this.permDialog.selected = SERVICE_DEFAULTS.slice()
      else if (mode === 'cashier') this.permDialog.selected = CASHIER_DEFAULTS.slice()
    },
    savePerm () {
      this.$axios.post('/api/staff/edit', { _id: this.permDialog.staffId, permissions: this.permDialog.selected })
        .then(() => {
          this.$message({ type: 'success', message: '權限已更新' })
          this.permDialog.show = false
          this.loadData()
        })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '更新失敗' }))
    },
    submitStaff (formName) {
      this.$refs[formName].validate(valid => {
        if (!valid) return
        const url = this.dialog.option === 'add' ? '/add' : '/edit'
        this.$axios.post('/api/staff' + url, this.form)
          .then(res => {
            this.$message({ type: 'success', message: res.data })
            this.dialog.show = false
            this.loadData()
          })
          .catch(err => {
            this.$message({ type: 'error', message: err.response ? err.response.data : '保存失敗' })
          })
      })
    }
  },
  created () {
    this.loadData()
    window.onresize = () => { this.tableHeight = window.innerHeight - 150 }
  }
}
</script>

<style scoped>
#staff-mgr{ height: 100%; }
.row-height{ margin-top: 10px; overflow: auto; }
.btn-shadow{ float: right; top: 0; box-shadow: 0px 0px 20px rgba(53,141,230,0.562); }
.perm-tags{ display: flex; flex-wrap: wrap; gap: 4px; }
.perm-tag{ margin: 0; }
.perm-group{ margin-bottom: 14px; }
.perm-group-title{ font-size: 13px; font-weight: bold; color: #303133; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #eee; }
.perm-group-items{ display: flex; flex-wrap: wrap; gap: 4px 16px; }
</style>
