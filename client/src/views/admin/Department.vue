<template>
  <div id="department-mgr">
    <el-row>
      <el-col :span="24">
        <el-button type="primary" size="small" icon="el-icon-plus" @click="openAdd">新增部門</el-button>
        <el-button size="small" plain icon="el-icon-refresh" @click="loadData">重新整理</el-button>
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
          <el-table-column align="center" prop="name" label="部門名"></el-table-column>
          <el-table-column align="center" prop="code" label="部門編號"></el-table-column>
          <el-table-column align="center" width="110" label="狀態">
            <template slot-scope="scope">
              <el-switch v-model="scope.row.active" @change="toggleActive(scope.row)"></el-switch>
            </template>
          </el-table-column>
          <el-table-column align="center" width="130" label="大單分帳顯示">
            <template slot-scope="scope">
              <el-switch v-model="scope.row.showInSplit" @change="toggleShowInSplit(scope.row)"></el-switch>
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

    <el-dialog :title="dialog.mode === 'add' ? '新增部門' : '編輯部門'" :visible.sync="dialog.show" width="420px" append-to-body>
      <el-form label-width="90px" size="small">
        <el-form-item label="部門名">
          <el-input v-model="dialog.form.name" placeholder="如 廚房 / 水吧 / 燒味"></el-input>
        </el-form-item>
        <el-form-item label="部門編號">
          <el-input v-model="dialog.form.code" placeholder="選填"></el-input>
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
  name: 'departmentMgr',
  data () {
    return {
      list: [],
      tableHeight: window.innerHeight - 160,
      dialog: { show: false, mode: 'add', form: { _id: '', name: '', code: '' } }
    }
  },
  methods: {
    loadData () {
      this.$axios.get('/api/department/all')
        .then(res => { this.list = (res.data || []).map(d => Object.assign({}, d, { showInSplit: d.showInSplit !== false })) })
        .catch(err => console.log(err))
    },
    openAdd () {
      this.dialog = { show: true, mode: 'add', form: { _id: '', name: '', code: '' } }
    },
    openEdit (row) {
      this.dialog = { show: true, mode: 'edit', form: { _id: row._id, name: row.name, code: row.code || '' } }
    },
    save () {
      const name = (this.dialog.form.name || '').trim()
      if (!name) {
        this.$message({ type: 'warning', message: '部門名不能為空！' })
        return
      }
      const payload = { name, code: (this.dialog.form.code || '').trim() }
      const req = this.dialog.mode === 'add'
        ? this.$axios.post('/api/department/add', { ...payload, sort: this.list.length })
        : this.$axios.post('/api/department/update', { _id: this.dialog.form._id, ...payload })
      req.then(res => {
        this.$message({ type: 'success', message: res.data })
        this.dialog.show = false
        this.loadData()
      }).catch(err => {
        this.$message({ type: 'error', message: (err.response && err.response.data) || '操作失敗' })
      })
    },
    toggleActive (row) {
      this.$axios.post('/api/department/update', { _id: row._id, active: row.active })
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => {
          row.active = !row.active
          this.$message({ type: 'error', message: (err.response && err.response.data) || '更新失敗' })
        })
    },
    toggleShowInSplit (row) {
      this.$axios.post('/api/department/update', { _id: row._id, showInSplit: row.showInSplit })
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => {
          row.showInSplit = !row.showInSplit
          this.$message({ type: 'error', message: (err.response && err.response.data) || '更新失敗' })
        })
    },
    move (row, dir) {
      const index = this.list.indexOf(row)
      const target = this.list[index + dir]
      if (!target) return
      this.$axios.post('/api/department/reorder', { ids: this.swapped(index, index + dir) })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.loadData()
        })
        .catch(err => this.$message({ type: 'error', message: (err.response && err.response.data) || '排序失敗' }))
    },
    swapped (a, b) {
      const ids = this.list.map(d => d._id)
      const tmp = ids[a]
      ids[a] = ids[b]
      ids[b] = tmp
      return ids
    },
    del (row) {
      this.$confirm(`確認刪除部門「${row.name}」嗎？`)
        .then(_ => {
          this.$axios.post('/api/department/del', { _id: row._id })
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
    window.onresize = () => { this.tableHeight = window.innerHeight - 160 }
  }
}
</script>

<style scoped>
#department-mgr{ height: 100%; }
.row-height{ margin-top: 10px; overflow: auto; }
.remove-btn{ color: #f56c6c; }
</style>
