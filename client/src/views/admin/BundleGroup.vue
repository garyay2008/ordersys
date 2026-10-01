<template>
  <div id="bundlegroup-mgr">
    <el-row>
      <el-col :span="24">
        <el-button type="primary" size="small" icon="el-icon-plus" @click="openAdd">新增跟餐組別</el-button>
        <el-button size="small" plain icon="el-icon-refresh" @click="loadData">重新整理</el-button>
        <span class="hint">跟餐組別是撞餐規則的飲品側記認（如 平飲／加$4／加$8），與 Menu 分類無關</span>
      </el-col>
    </el-row>
    <el-row class="row-height">
      <el-col :span="24">
        <el-table :data="list" size="medium" style="width: 100%;" :max-height="tableHeight">
          <el-table-column align="center" width="70" label="排序">
            <template slot-scope="scope">
              <el-button-group>
                <el-button type="text" size="mini" icon="el-icon-top" :disabled="scope.$index === 0" @click="move(scope.row, -1)"></el-button>
                <el-button type="text" size="mini" icon="el-icon-bottom" :disabled="scope.$index === list.length - 1" @click="move(scope.row, 1)"></el-button>
              </el-button-group>
            </template>
          </el-table-column>
          <el-table-column align="center" prop="name" label="組別名"></el-table-column>
          <el-table-column align="center" width="140" label="跟餐價">
            <template slot-scope="scope">${{ Number(scope.row.price) || 0 }}</template>
          </el-table-column>
          <el-table-column align="center" width="80" label="貨品數">
            <template slot-scope="scope">{{ countItems(scope.row) }}</template>
          </el-table-column>
          <el-table-column align="center" width="110" label="啟用">
            <template slot-scope="scope">
              <el-switch v-model="scope.row.active" @change="toggleActive(scope.row)"></el-switch>
            </template>
          </el-table-column>
          <el-table-column align="center" width="150" label="操作">
            <template slot-scope="scope">
              <el-button type="text" size="small" icon="el-icon-edit" @click="openEdit(scope.row)">編輯</el-button>
              <el-button type="text" size="small" icon="el-icon-delete" class="remove-btn" @click="del(scope.row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>

    <el-dialog :title="dialog.mode === 'add' ? '新增跟餐組別' : '編輯跟餐組別'" :visible.sync="dialog.show" width="720px" append-to-body custom-class="bg-dialog-big">
      <el-form label-width="130px">
        <el-form-item label="組別名">
          <el-input v-model="dialog.form.name" placeholder="如 平飲 / 加$4 / 加$8"></el-input>
        </el-form-item>
        <el-form-item label="跟餐價">
          <el-input-number v-model="dialog.form.price" :min="0" :precision="2" :step="1" controls-position="right"></el-input-number>
        </el-form-item>
        <el-form-item label="貨品">
          <el-select v-model="dialog.form.commodityIds" multiple filterable clearable placeholder="選擇此組別的貨品（可多選）" popper-class="bg-popper-big" style="width: 100%;">
            <el-option v-for="c in allCommodities" :key="c._id" :label="commodityLabel(c)" :value="c._id"></el-option>
          </el-select>
          <div class="hint-dialog">選中的貨品會在此組別的撞餐規則中，以「跟餐價」作跟餐價格。</div>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button size="small" @click="dialog.show = false">取消</el-button>
        <el-button type="primary" size="small" @click="save">儲存</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'bundleGroupMgr',
  data () {
    return {
      list: [],
      allCommodities: [],
      tableHeight: window.innerHeight - 160,
      dialog: { show: false, mode: 'add', form: { _id: '', name: '', price: 0, commodityIds: [] } }
    }
  },
  methods: {
    loadData () {
      this.$axios.get('/api/bundlegroup/all')
        .then(res => { this.list = res.data || [] })
        .catch(err => console.log(err))
    },
    loadCommodities () {
      this.$axios.get('/api/commodity/list')
        .then(res => { this.allCommodities = res.data || [] })
        .catch(err => console.log(err))
    },
    commodityLabel (c) {
      if (!c) return ''
      const parts = []
      if (c.plu) parts.push(c.plu)
      if (c.name) parts.push(c.name)
      parts.push('$' + (Number(c.price) || 0))
      return parts.join(' · ')
    },
    countItems (row) {
      return this.allCommodities.filter(c => c.bundleGroupId && String(c.bundleGroupId) === String(row._id)).length
    },
    openAdd () {
      this.dialog = { show: true, mode: 'add', form: { _id: '', name: '', price: 0, commodityIds: [] } }
    },
    openEdit (row) {
      const commodityIds = this.allCommodities
        .filter(c => c.bundleGroupId && String(c.bundleGroupId) === String(row._id))
        .map(c => c._id)
      this.dialog = { show: true, mode: 'edit', form: { _id: row._id, name: row.name, price: Number(row.price) || 0, commodityIds } }
    },
    save () {
      const name = (this.dialog.form.name || '').trim()
      if (!name) {
        this.$message({ type: 'warning', message: '組別名不能為空！' })
        return
      }
      const payload = { name, price: Number(this.dialog.form.price) || 0 }
      const commodityIds = (this.dialog.form.commodityIds || []).slice()
      const assignItems = (groupId) => {
        if (!groupId) return Promise.resolve()
        return this.$axios.post('/api/bundlegroup/setItems', { _id: groupId, commodityIds })
      }
      const afterSave = (groupId) => assignItems(groupId).then(() => {
        this.$message({ type: 'success', message: '儲存成功' })
        this.dialog.show = false
        this.loadData()
        this.loadCommodities()
      })
      const req = this.dialog.mode === 'add'
        ? this.$axios.post('/api/bundlegroup/add', { ...payload, sort: this.list.length })
          .then(res => afterSave(res.data && res.data._id))
        : this.$axios.post('/api/bundlegroup/edit', { _id: this.dialog.form._id, ...payload })
          .then(() => afterSave(this.dialog.form._id))
      req.catch(err => {
        this.$message({ type: 'error', message: (err.response && err.response.data) || '操作失敗' })
      })
    },
    toggleActive (row) {
      this.$axios.post('/api/bundlegroup/edit', { _id: row._id, active: row.active })
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => {
          row.active = !row.active
          this.$message({ type: 'error', message: (err.response && err.response.data) || '更新失敗' })
        })
    },
    move (row, dir) {
      const index = this.list.indexOf(row)
      const target = this.list[index + dir]
      if (!target) return
      const a = index
      const b = index + dir
      const items = this.list.slice()
      const tmp = items[a]
      items[a] = items[b]
      items[b] = tmp
      this.$axios.post('/api/bundlegroup/reorder', { ids: items.map(g => g._id) })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.loadData()
        })
        .catch(err => this.$message({ type: 'error', message: (err.response && err.response.data) || '排序失敗' }))
    },
    del (row) {
      this.$confirm(`確認刪除跟餐組別「${row.name}」嗎？`)
        .then(_ => {
          this.$axios.post('/api/bundlegroup/del', { _id: row._id })
            .then(res => {
              this.$message({ type: 'success', message: res.data })
              this.loadData()
            })
            .catch(err => this.$message({ type: 'error', message: (err.response && err.response.data) || '刪除失敗' }))
        })
        .catch(_ => {})
    }
  },
  created () {
    this.loadData()
    this.loadCommodities()
    window.onresize = () => { this.tableHeight = window.innerHeight - 160 }
  }
}
</script>

<style scoped>
#bundlegroup-mgr{ height: 100%; }
.row-height{ margin-top: 10px; overflow: auto; }
.remove-btn{ color: #f56c6c; }
.hint{ font-size: 12px; color: #909399; margin-left: 12px; }
.hint-dialog{ font-size: 12px; color: #909399; margin-top: 4px; line-height: 1.4; }
</style>

<style>
.bg-dialog-big{ font-size: 28px; }
.bg-dialog-big .el-dialog__title{ font-size: 34px; line-height: 1.4; }
.bg-dialog-big .el-dialog__header{ padding: 24px 24px 12px; }
.bg-dialog-big .el-dialog__body{ padding: 20px 28px; }
.bg-dialog-big .el-form-item{ margin-bottom: 26px; }
.bg-dialog-big .el-form-item__label{ font-size: 28px; line-height: 52px; }
.bg-dialog-big .el-input__inner{ font-size: 28px; height: 52px; line-height: 52px; }
.bg-dialog-big .el-input-number{ width: 260px; }
.bg-dialog-big .el-input-number .el-input__inner{ text-align: center; }
.bg-dialog-big .el-select .el-input__inner{ height: 52px; line-height: 52px; }
.bg-dialog-big .el-tag{ font-size: 24px; height: 40px; line-height: 38px; }
.bg-dialog-big .el-button{ font-size: 28px; padding: 16px 24px; }
.bg-dialog-big .el-button + .el-button{ margin-left: 16px; }
.bg-dialog-big .hint-dialog{ font-size: 24px; }
.bg-popper-big .el-select-dropdown__item{ font-size: 28px; height: 52px; line-height: 52px; }
</style>
