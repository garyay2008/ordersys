<template>
  <div id="zone-mgr">
    <el-row>
      <el-input v-model="newName" placeholder="區域名，如 外送 / 自取 / 包廂" size="small" style="width: 280px;" @keyup.enter.native="add"></el-input>
      <el-button type="primary" size="small" style="margin-left: 8px;" @click="add">添加區域</el-button>
    </el-row>
    <el-row class="row-height">
      <el-col :span="24">
        <el-table :data="list" size="medium" style="width: 100%;" :max-height="tableHeight">
          <el-table-column align="center" prop="name" label="區域名"></el-table-column>
          <el-table-column align="center" prop="sort" width="120" label="排序"></el-table-column>
          <el-table-column align="center" width="150" label="操作">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="del(scope.row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>
  </div>
</template>

<script>
export default {
  name: 'zoneMgr',
  data () {
    return {
      newName: '',
      list: [],
      tableHeight: window.innerHeight - 160
    }
  },
  methods: {
    loadData () {
      this.$axios.get('/api/zone/all')
        .then(res => { this.list = res.data || [] })
        .catch(err => console.log(err))
    },
    add () {
      const name = this.newName.trim()
      if (!name) return
      this.$axios.post('/api/zone/add', { name, sort: this.list.length })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.newName = ''
          this.loadData()
        })
        .catch(err => console.log(err))
    },
    del (row) {
      this.$confirm(`確認刪除區域「${row.name}」嗎？`)
        .then(_ => {
          this.$axios.post('/api/zone/del', { _id: row._id })
            .then(res => {
              this.$message({ type: 'success', message: res.data })
              this.loadData()
            })
            .catch(err => console.log(err))
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
#zone-mgr{ height: 100%; }
.row-height{ margin-top: 10px; overflow: auto; }
</style>
