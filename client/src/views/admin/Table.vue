<template>
  <div id="table-mgr">
    <el-row class="top-bar">
      <el-button-group>
        <el-button size="small" :type="mode === 'list' ? 'primary' : 'default'" icon="el-icon-tickets" @click="mode = 'list'">列表管理</el-button>
        <el-button size="small" :type="mode === 'layout' ? 'primary' : 'default'" icon="el-icon-s-grid" @click="enterLayout">版面編輯</el-button>
      </el-button-group>
      <template v-if="mode === 'list'">
        <el-button type="primary" size="small" class="btn-shadow" style="margin-left: auto;" @click="addTable">添加枱號</el-button>
      </template>
      <template v-else>
        <el-radio-group v-model="layoutZone" size="small" style="margin-left: 16px;">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button v-for="z in layoutZones" :key="z" :label="z">{{ z }}</el-radio-button>
        </el-radio-group>
        <span style="margin-left: 16px; font-size: 13px; color: #606266;">列數：</span>
        <el-input-number v-model="gridCols" :min="1" :max="20" size="small" style="width: 100px;"></el-input-number>
        <span style="margin-left: 16px; font-size: 13px; color: #606266;">行數：</span>
        <el-input-number v-model="gridRows" :min="1" :max="20" size="small" style="width: 100px;"></el-input-number>
        <span style="margin-left: 16px; font-size: 13px; color: #606266;">卡片高度：</span>
        <el-input-number v-model="cardHeight" :min="80" :max="200" size="small" style="width: 100px;"></el-input-number>
        <span style="font-size: 13px; color: #909399;">px</span>
        <span style="margin-left: 16px; font-size: 13px; color: #606266;">卡片寬度：</span>
        <el-input-number v-model="cardWidth" :min="0" :max="300" size="small" style="width: 100px;"></el-input-number>
        <span style="font-size: 13px; color: #909399;">px（0=自動）</span>
        <span style="margin-left: 16px; font-size: 13px; color: #606266;">間距：</span>
        <el-input-number v-model="gap" :min="0" :max="60" size="small" style="width: 100px;"></el-input-number>
        <span style="font-size: 13px; color: #909399;">px</span>
        <el-button type="success" size="small" style="margin-left: auto;" icon="el-icon-check" @click="saveLayout" :loading="saving">儲存版面</el-button>
        <el-button size="small" style="margin-left: 8px;" @click="autoAlign">自動對齊</el-button>
      </template>
    </el-row>

    <template v-if="mode === 'list'">
      <el-row class="row-height">
        <el-col :span="24">
          <el-table :data="tableData" size="medium" :max-height="tableHeight" style="width: 100%">
            <el-table-column align="center" prop="no" width="100" label="枱號" sortable></el-table-column>
            <el-table-column align="center" prop="name" label="枱名"></el-table-column>
            <el-table-column align="center" prop="seats" width="110" label="座位數"></el-table-column>
            <el-table-column align="center" prop="zone" width="140" label="區域"></el-table-column>
            <el-table-column align="center" width="100" label="狀態">
              <template slot-scope="scope">
                <el-tag size="mini" :type="scope.row.enabled ? 'success' : 'info'">{{ scope.row.enabled ? '啟用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column fixed="right" align="center" width="130" label="操作">
              <template slot-scope="scope">
                <el-button type="text" size="small" @click="editTable(scope.row)">編輯</el-button>
                <el-button type="text" size="small" @click="delTable(scope.row)">刪除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-col>
      </el-row>
    </template>

    <template v-else>
      <div class="layout-hint">拖動枱位卡片調整位置，完成後按「儲存版面」</div>
      <div class="layout-canvas" ref="canvas" @mousedown.self="clearSelection" :style="{ minHeight: canvasMinHeight + 'px' }">
        <div v-for="(t, i) in layoutTables" :key="t._id"
             class="layout-card" :class="{ 'layout-card-disabled': !t.enabled, 'layout-card-selected': selectedId === t._id }"
             :style="cardStyle(t, i)"
             @mousedown.stop="onCardDown(t, $event)">
          <div class="lc-topline">
            <span class="lc-seats"><i class="el-icon-user"></i> {{ t.seats }}位</span>
            <span class="lc-dot" :class="t.enabled ? 'on' : 'off'"></span>
          </div>
          <div class="lc-no">{{ t.no }}</div>
          <div class="lc-zone">{{ t.zone || '未分區' }}</div>
        </div>
      </div>
    </template>

    <el-dialog :title="dialog.title" :visible.sync="dialog.show" width="420px">
      <el-form ref="tableForm" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="枱號" prop="no">
          <el-input-number v-model="form.no" :min="1" :max="999"></el-input-number>
        </el-form-item>
        <el-form-item label="枱名">
          <el-input v-model="form.name" placeholder="如 VIP 包廂 / 靠窗"></el-input>
        </el-form-item>
        <el-form-item label="座位數">
          <el-input-number v-model="form.seats" :min="1" :max="50"></el-input-number>
        </el-form-item>
        <el-form-item label="區域">
          <el-select v-model="form.zone" placeholder="選擇區域" style="width: 100%;">
            <el-option label="堂食" value="堂食"></el-option>
            <el-option label="外賣枱" value="外賣枱"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="啟用">
          <el-switch v-model="form.enabled"></el-switch>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialog.show = false">取 消</el-button>
        <el-button type="primary" @click="submitTable('tableForm')">確 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'tableMgr',
  data () {
    return {
      mode: 'list',
      dialog: { show: false, title: '', option: 'add' },
      form: { no: 1, name: '', seats: 4, zone: '堂食', enabled: true },
      tableData: [],
      tableHeight: window.innerHeight - 150,
      rules: {
        no: [{ required: true, message: '枱號不能為空', trigger: 'blur' }]
      },
      layoutZone: 'all',
      saving: false,
      drag: null,
      selectedId: null,
      gridSize: 8,
      gridCols: 5,
      gridRows: 5,
      cardHeight: 110,
      cardWidth: 200,
      gap: 10
    }
  },
  computed: {
    canvasMinHeight () {
      const ch = this.cardHeight || 110
      const gap = this.gap || 0
      let maxY = 0
      this.layoutTables.forEach((t, i) => {
        const p = this.pos(t, i)
        if (p.y + ch > maxY) maxY = p.y + ch
      })
      return maxY + gap + 40
    },
    layoutZones () {
      var set = {}
      this.tableData.forEach(t => { if (t.zone) set[t.zone] = 1 })
      return Object.keys(set).sort()
    },
    layoutTables () {
      var zone = this.layoutZone
      return this.tableData.filter(t => t.enabled && (zone === 'all' || (t.zone || '未分區') === zone))
    }
  },
  methods: {
    loadData () {
      this.$axios.get('/api/table/all')
        .then(res => { this.tableData = res.data || [] })
        .catch(err => console.log(err))
    },
    addTable () {
      this.dialog = { show: true, title: '添加枱號', option: 'add' }
      this.form = { no: (this.tableData.length ? Math.max(...this.tableData.map(t => t.no)) + 1 : 1), name: '', seats: 4, zone: '堂食', enabled: true }
    },
    editTable (row) {
      this.dialog = { show: true, title: '編輯枱號', option: 'edit' }
      this.form = Object.assign({}, row)
    },
    delTable (row) {
      this.$confirm(`確認刪除枱號「${row.no}」嗎？`)
        .then(_ => {
          this.$axios.post('/api/table/del', { _id: row._id })
            .then(result => {
              this.$message({ type: 'success', message: result.data })
              this.loadData()
            })
            .catch(err => console.log(err))
        })
        .catch(_ => {})
    },
    submitTable (formName) {
      this.$refs[formName].validate(valid => {
        if (!valid) return
        var url = this.dialog.option === 'add' ? '/add' : '/edit'
        this.$axios.post('/api/table' + url, this.form)
          .then(res => {
            this.$message({ type: 'success', message: res.data })
            this.dialog.show = false
            this.loadData()
          })
          .catch(err => {
            this.$message({ type: 'error', message: err.response ? err.response.data : '保存失敗' })
          })
      })
    },
    enterLayout () {
      this.mode = 'layout'
      this.selectedId = null
    },
    pos (t, i) {
      if (t.x !== null && t.x !== undefined && t.y !== null && t.y !== undefined) return { x: t.x, y: t.y }
      var cw = this.cardWidth || 200
      var ch = this.cardHeight || 110
      var gap = this.gap || 0
      var cols = this.gridCols || 5
      return { x: (i % cols) * (cw + gap), y: Math.floor(i / cols) * (ch + gap) }
    },
    cardStyle (t, i) {
      var p = this.pos(t, i)
      return { left: p.x + 'px', top: p.y + 'px', width: (this.cardWidth || 200) + 'px', height: (this.cardHeight || 110) + 'px' }
    },
    onCardDown (t, e) {
      this.selectedId = t._id
      var p = this.pos(t, this.layoutTables.indexOf(t))
      this.drag = { table: t, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }
      var self = this
      var move = function (ev) {
        if (!self.drag) return
        var gs = self.gridSize
        var nx = Math.max(0, Math.round((self.drag.ox + (ev.clientX - self.drag.sx)) / gs) * gs)
        var ny = Math.max(0, Math.round((self.drag.oy + (ev.clientY - self.drag.sy)) / gs) * gs)
        self.$set(self.drag.table, 'x', nx)
        self.$set(self.drag.table, 'y', ny)
      }
      var up = function () {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        self.drag = null
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    clearSelection () {
      this.selectedId = null
    },
    autoAlign () {
      var gs = this.gridSize || 8
      this.layoutTables.forEach((t) => {
        var x = t.x != null ? t.x : 0
        var y = t.y != null ? t.y : 0
        this.$set(t, 'x', Math.round(x / gs) * gs)
        this.$set(t, 'y', Math.round(y / gs) * gs)
      })
      this.$message({ type: 'success', message: '已自動對齊到網格（' + gs + 'px）' })
    },
    saveLayout () {
      var self = this
      self.saving = true
      var tables = []
      self.layoutTables.forEach(function (t) {
        var p = self.pos(t, 0)
        tables.push({ _id: t._id, x: p.x, y: p.y })
      })
      this.$axios.post('/api/table/layout', { tables })
        .then(function (res) {
          self.$message({ type: 'success', message: res.data })
          self.saving = false
          self.saveBoardLayout()
          self.loadData()
        })
        .catch(function (err) {
          self.$message({ type: 'error', message: err.response ? err.response.data : '儲存失敗' })
          self.saving = false
        })
    },
    saveBoardLayout () {
      var self = this
      this.$axios.get('/api/possetting/get').then(function (res) {
        var data = res.data || {}
        data.boardLayout = { cardHeight: self.cardHeight, cardWidth: self.cardWidth, gridCols: self.gridCols, gridRows: self.gridRows, gap: self.gap }
        delete data._id
        self.$axios.post('/api/possetting/save', data).catch(function () {})
      }).catch(function () {})
    },
    loadBoardLayout () {
      var self = this
      this.$axios.get('/api/possetting/get').then(function (res) {
        var bl = (res.data && res.data.boardLayout) || {}
        if (bl.cardHeight) self.cardHeight = bl.cardHeight
        if (bl.cardWidth) self.cardWidth = bl.cardWidth
        if (bl.gridCols) self.gridCols = bl.gridCols
        if (bl.gridRows) self.gridRows = bl.gridRows
        if (bl.gap !== undefined) self.gap = bl.gap
      }).catch(function () {})
    }
  },
  created () {
    this.loadData()
    this.loadBoardLayout()
    window.onresize = () => { this.tableHeight = window.innerHeight - 150 }
  }
}
</script>

<style scoped>
#table-mgr{ height: 100%; }
.top-bar{ display: flex; align-items: center; }
.row-height{ margin-top: 10px; overflow: auto; }
.btn-shadow{ box-shadow: 0px 0px 20px rgba(53,141,230,0.562); }

.layout-hint{ font-size: 13px; color: #909399; margin: 10px 0 4px; }
.layout-canvas{ position: relative; background: radial-gradient(circle at 20% 10%,#fff 0,#f3f6fb 52%); border: 1px solid #e4e7ed; border-radius: 8px; overflow: auto; padding: 20px; }
.layout-card{ position: absolute; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: grab; border: 1.5px solid rgba(148,163,184,.25); background: #fff; box-shadow: 0 2px 8px rgba(36,61,91,.06); transition: all .2s ease; overflow: hidden; min-width: 0; user-select: none; }
.layout-card:hover{ transform: translateY(-3px); box-shadow: 0 6px 16px rgba(36,61,91,.15); border-color: rgba(64,158,255,.4); }
.layout-card:active{ cursor: grabbing; transform: translateY(-1px); }
.layout-card-disabled{ opacity: .45; border-style: dashed; }
.layout-card-selected{ border-color: #409eff; box-shadow: 0 0 0 3px rgba(64,158,255,.25); }
.lc-topline{ position: absolute; top: 13px; left: 15px; right: 15px; display: flex; justify-content: space-between; align-items: center; z-index: 1; }
.lc-seats{ font-size: 12px; color: #64748b; }
.lc-dot{ width: 8px; height: 8px; border-radius: 50%; }
.lc-dot.on{ background: #67c23a; }
.lc-dot.off{ background: #c0c4cc; }
.lc-no{ font-size: 42px; font-weight: 800; color: #1e293b; line-height: 1; }
.lc-zone{ font-size: 11px; color: #909399; margin-top: 4px; }
</style>
