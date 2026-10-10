<template>
  <div id="bundle">
    <el-card shadow="never" class="global-card">
      <div slot="header" class="card-header">撞餐功能設定</div>
      <el-form label-width="120px" class="global-form">
        <el-form-item label="撞餐功能">
          <el-switch v-model="global.bundleEnabled" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="hint">開啟後，POS 可將多項單點自動組合成套餐價（撞餐）。</div>
        </el-form-item>
        <el-form-item v-if="global.bundleEnabled" label="觸發方式">
          <el-radio-group v-model="global.bundleMode">
            <el-radio label="auto">自動偵測（加單時）</el-radio>
            <el-radio label="manual">手動撞餐鍵</el-radio>
            <el-radio label="both">兩者</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="global.bundleEnabled" label="計價規則">
          <el-radio-group v-model="global.bundleRule">
            <el-radio label="bestPrice">省最多錢（顧客最優）</el-radio>
            <el-radio label="priority">套餐優先級</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="small" @click="saveGlobal">保存設定</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-row>
      <el-button type="primary" size="small" class="btn-shadow" @click="addCombo">添加跟餐 / 撞餐</el-button>
    </el-row>
    <el-row class="row-height">
      <el-col :span="24">
        <el-table :data="tableData" size="medium" :max-height="tableHeight" style="width: 100%">
          <el-table-column align="center" prop="code" width="100" label="編號"></el-table-column>
          <el-table-column align="center" prop="name" width="180" label="跟餐名稱"></el-table-column>
          <el-table-column align="center" width="100" label="主食價">
            <template slot-scope="scope">${{ scope.row.price }}</template>
          </el-table-column>
          <el-table-column align="center" label="主食綁定">
            <template slot-scope="scope">
              <span v-if="(scope.row.mainDishes || []).length">
                <el-tag size="mini" v-for="(d, di) in scope.row.mainDishes" :key="di" style="margin: 1px;">{{ d.name }}</el-tag>
              </span>
              <span v-else style="color:#c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="90" label="跟餐組">
            <template slot-scope="scope">{{ (scope.row.groups || []).length }}</template>
          </el-table-column>
          <el-table-column align="center" width="100" label="撞餐時段">
            <template slot-scope="scope">{{ etLabel(scope.row.effectiveTime) }}</template>
          </el-table-column>
          <el-table-column align="center" width="90" label="自動彈出">
            <template slot-scope="scope">
              <el-tag size="mini" :type="scope.row.autoPopup !== false ? 'success' : 'info'">{{ scope.row.autoPopup !== false ? '開' : '關' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" width="100" label="自動撞餐">
            <template slot-scope="scope">
              <el-tag size="mini" :type="bundleTagType(scope.row)">{{ bundleLabel(scope.row) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" width="80" label="優先級">
            <template slot-scope="scope">{{ scope.row.bundlePriority || 0 }}</template>
          </el-table-column>
          <el-table-column fixed="right" align="center" width="140" label="操作">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="editCombo(scope.row)">編輯</el-button>
              <el-button type="text" size="small" @click="delCombo(scope.row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>

    <el-dialog :title="dialog.title" :visible.sync="dialog.show" fullscreen>
      <el-form ref="comboForm" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="跟餐名稱" prop="name">
              <el-input v-model="form.name" placeholder="如：乾炒牛河跟餐"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="編號">
              <el-input v-model="form.code" placeholder="編號"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="主食價" prop="price">
              <el-input type="number" v-model.number="form.price"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="所屬部門">
              <el-select v-model="form.department" placeholder="選擇部門" style="width: 100%">
                <el-option v-for="d in departmentList" :key="d._id" :label="d.name" :value="d.name"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="主食自動彈出">
              <el-switch v-model="form.autoPopup" active-text="開" inactive-text="關"></el-switch>
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="自動撞餐">
              <el-select v-model="form.autoBundle" style="width: 100%">
                <el-option label="自動（依套餐類型）" value="auto"></el-option>
                <el-option label="強制參與" value="on"></el-option>
                <el-option label="不參與" value="off"></el-option>
              </el-select>
              <div class="hint">未設定時，選單式（select）自動撞餐，固定式（fixed）不自動。</div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="撞餐優先級">
              <el-input-number v-model="form.bundlePriority" :min="0" :step="1" controls-position="right"></el-input-number>
              <div class="hint">計價規則選「套餐優先級」時，數字越大越優先。</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="24">
            <el-divider content-position="left">主食綁定（點擊主食貨品即自動帶出本跟餐）</el-divider>
            <div class="split-box">
              <div class="split-total">
                <span>主食碼綁定：</span>
                <span style="color:#909399; font-size:12px;">在 POS 點擊已綁定的主食，會自動彈出本跟餐供選擇</span>
                <el-button size="mini" type="primary" plain @click="addMainDish">+ 添加主食</el-button>
              </div>
              <div v-if="!form.mainDishes.length" class="win-empty">暫無主食綁定，按「+ 添加主食」加入</div>
              <div v-for="(d, di) in form.mainDishes" :key="di" class="win-item">
                <el-select v-model="d.commodityId" placeholder="輸入編碼 / 選擇主食" filterable default-first-option style="flex: 1;" @change="(val) => onPickMainDish(d, val)">
                  <el-option v-for="c in commodityOptions" :key="c._id" :label="itemLabel(c)" :value="c._id"></el-option>
                </el-select>
                <el-button type="danger" size="mini" icon="el-icon-delete" @click="form.mainDishes.splice(di, 1)"></el-button>
              </div>
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="24">
            <el-divider content-position="left">撞餐生效時段（限制本跟餐只在指定時段參與撞餐）</el-divider>
            <div class="split-box">
              <div class="split-total">
                <span>撞餐時段：</span>
                <el-select v-model="form.effectiveTime.type" size="small" style="width: 130px;">
                  <el-option label="永久" value="permanent"></el-option>
                  <el-option label="生效日期" value="dateRange"></el-option>
                  <el-option label="星期" value="weekly"></el-option>
                  <el-option label="不生效" value="disabled"></el-option>
                </el-select>
              </div>
              <div v-if="form.effectiveTime.type === 'dateRange'" class="adv-row">
                <el-date-picker v-model="form.effectiveTime.startDate" type="date" placeholder="開始日期" value-format="yyyy-MM-dd" size="small" style="width: 45%;"></el-date-picker>
                <span class="lbl">~</span>
                <el-date-picker v-model="form.effectiveTime.endDate" type="date" placeholder="結束日期" value-format="yyyy-MM-dd" size="small" style="width: 45%;"></el-date-picker>
              </div>
              <div v-if="form.effectiveTime.type === 'weekly'" class="adv-row">
                <el-checkbox-group v-model="form.effectiveTime.weekdays">
                  <el-checkbox v-for="dw in weekdayOptions" :key="'bw' + dw.value" :label="dw.value">{{ dw.label }}</el-checkbox>
                </el-checkbox-group>
              </div>
              <div v-if="form.effectiveTime.type === 'dateRange' || form.effectiveTime.type === 'weekly'" class="adv-row">
                <span class="lbl">時間段</span>
                <el-input v-model="form.effectiveTime.startTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
                <span class="lbl">~</span>
                <el-input v-model="form.effectiveTime.endTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
              </div>
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="24">
            <el-divider content-position="left">跟餐組（跟餐可選品項，如飲品 / 湯）</el-divider>
            <div v-for="(g, gi) in form.groups" :key="'g' + gi" class="win-box">
              <div class="win-header">
                <span class="win-title">跟餐組 {{ gi + 1 }}</span>
                <span class="lbl">組名</span>
                <el-input v-model="g.name" placeholder="如：跟餐飲品" size="small" style="width: 160px;"></el-input>
                <span class="lbl">選</span>
                <el-input-number v-model="g.min" :min="1" :max="99" size="small" controls-position="right"></el-input-number>
                <span class="lbl">~</span>
                <el-input-number v-model="g.max" :min="1" :max="99" size="small" controls-position="right"></el-input-number>
                <span class="lbl">項</span>
                <span class="lbl">跟餐加購價</span>
                <el-input-number v-model="g.groupPrice" :min="0" :precision="2" :step="1" size="small" controls-position="right" style="width: 110px;"></el-input-number>
                <el-button size="mini" type="primary" plain @click="addItem(g.items)">+ 添加貨品</el-button>
                <el-button size="mini" type="danger" plain @click="form.groups.splice(gi, 1)">刪除組</el-button>
              </div>
              <div v-if="!g.items.length" class="win-empty">暫無貨品，按「+ 添加貨品」加入</div>
              <div v-for="(item, ii) in g.items" :key="ii" class="win-item">
                <el-select v-model="item.commodityId" placeholder="輸入編碼 / 選擇貨品" filterable default-first-option style="flex: 1;" @change="(val) => onPickItem(item, val)">
                  <el-option v-for="c in commodityOptions" :key="c._id" :label="itemLabel(c)" :value="c._id"></el-option>
                </el-select>
                <span class="lbl">加價</span>
                <el-input-number v-model="item.upgradePrice" :min="0" :precision="2" :step="1" size="small" controls-position="right" style="width: 110px;"></el-input-number>
                <el-button type="danger" size="mini" icon="el-icon-delete" @click="g.items.splice(ii, 1)"></el-button>
              </div>
            </div>
            <el-button size="mini" type="primary" plain @click="addGroup">+ 添加跟餐組</el-button>
          </el-col>
        </el-row>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialog.show = false">取 消</el-button>
        <el-button type="primary" @click="submitCombo('comboForm')">確 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'bundle',
  data () {
    return {
      dialog: { show: false, title: '', option: 'add' },
      form: this.emptyForm(),
      tableData: [],
      tableHeight: window.innerHeight - 160,
      departmentList: [],
      commodityOptions: [],
      global: { bundleEnabled: false, bundleMode: 'auto', bundleRule: 'bestPrice' },
      weekdayOptions: [
        { value: 1, label: '一' },
        { value: 2, label: '二' },
        { value: 3, label: '三' },
        { value: 4, label: '四' },
        { value: 5, label: '五' },
        { value: 6, label: '六' },
        { value: 7, label: '日' }
      ],
      rules: {
        name: [{ required: true, message: '跟餐名稱不能為空', trigger: 'blur' }],
        price: [{ required: true, message: '主食價不能為空', trigger: 'blur' }]
      }
    }
  },
  methods: {
    emptyForm () {
      return {
        name: '',
        code: '',
        price: 0,
        department: '',
        autoPopup: true,
        autoBundle: 'auto',
        bundlePriority: 0,
        mainDishes: [],
        effectiveTime: { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] },
        groups: []
      }
    },
    emptyGroup () {
      return { name: '', min: 1, max: 1, groupPrice: 0, items: [] }
    },
    emptyItem () {
      return { commodityId: '', name: '', price: 0, upgradePrice: 0 }
    },
    normalizeItem (i) {
      return { commodityId: i.commodityId || '', name: i.name || '', price: i.price || 0, upgradePrice: i.upgradePrice || 0 }
    },
    cloneEt (src) {
      const base = { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] }
      if (!src) return base
      return {
        type: src.type || 'permanent',
        startDate: src.startDate || '',
        endDate: src.endDate || '',
        startTime: src.startTime || '',
        endTime: src.endTime || '',
        weekdays: (src.weekdays || [1, 2, 3, 4, 5]).slice(),
        holidays: (src.holidays || []).slice()
      }
    },
    loadData () {
      this.$axios.get('/api/combo/all')
        .then(res => {
          const all = res.data || []
          this.tableData = all.filter(c => (c.groups || []).length || (c.mainDishes || []).length)
        })
        .catch(err => console.log(err))
    },
    loadCommodities () {
      this.$axios.get('/api/commodity/menu')
        .then(res => {
          const opts = []
          const menu = res.data || []
          menu.forEach(cat => {
            (cat.foods || []).forEach(f => {
              if (f._isCombo) return
              opts.push({ _id: f._id, name: f.name, price: f.price, plu: f.plu || '', code: f.code || '' })
            })
          })
          this.commodityOptions = opts
        })
        .catch(err => console.log(err))
    },
    loadGlobal () {
      this.$axios.get('/api/possetting/get')
        .then(res => {
          const d = res.data || {}
          this.global.bundleEnabled = !!d.bundleEnabled
          this.global.bundleMode = d.bundleMode || 'auto'
          this.global.bundleRule = d.bundleRule || 'bestPrice'
        })
        .catch(err => console.log(err))
    },
    saveGlobal () {
      this.$axios.post('/api/possetting/save', {
        bundleEnabled: !!this.global.bundleEnabled,
        bundleMode: this.global.bundleMode,
        bundleRule: this.global.bundleRule
      })
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '保存失敗' }))
    },
    addCombo () {
      this.dialog = { show: true, title: '添加跟餐 / 撞餐', option: 'add' }
      this.form = this.emptyForm()
    },
    mapRowToForm (row) {
      const groups = (row.groups || []).map(g => ({
        name: g.name || '',
        min: g.min !== undefined && g.min !== null ? g.min : 1,
        max: g.max !== undefined && g.max !== null ? g.max : 1,
        groupPrice: g.groupPrice || 0,
        items: (g.items || []).map(i => this.normalizeItem(i))
      }))
      return {
        name: row.name || '',
        code: row.code || '',
        price: row.price || 0,
        department: row.department || '',
        autoPopup: row.autoPopup !== false,
        autoBundle: row.autoBundle === true ? 'on' : (row.autoBundle === false ? 'off' : 'auto'),
        bundlePriority: row.bundlePriority || 0,
        mainDishes: (row.mainDishes || []).map(d => ({ commodityId: d.commodityId || '', name: d.name || '' })),
        effectiveTime: this.cloneEt(row.effectiveTime),
        groups
      }
    },
    editCombo (row) {
      this.dialog = { show: true, title: '編輯跟餐 / 撞餐', option: 'edit' }
      this.form = Object.assign({ _id: row._id }, this.mapRowToForm(row))
    },
    delCombo (row) {
      this.$confirm(`確認刪除跟餐 “${row.name}” 嗎？`)
        .then(_ => {
          this.$axios.post('/api/combo/del', { _id: row._id })
            .then(result => {
              this.$message({ type: 'success', message: result.data })
              this.loadData()
            })
            .catch(err => console.log(err))
        })
        .catch(_ => {})
    },
    addGroup () {
      this.form.groups.push(this.emptyGroup())
    },
    addItem (list) {
      list.push(this.emptyItem())
    },
    addMainDish () {
      this.form.mainDishes.push({ commodityId: '', name: '' })
    },
    onPickMainDish (d, val) {
      const c = this.commodityOptions.find(x => x._id === val)
      if (c) {
        d.commodityId = c._id
        d.name = c.name
      }
    },
    onPickItem (item, val) {
      const c = this.commodityOptions.find(x => x._id === val)
      if (c) {
        item.commodityId = c._id
        item.name = c.name
        item.price = c.price
      }
    },
    itemLabel (c) {
      const no = c.code || c.plu || ''
      return (no ? no + ' ' : '') + c.name + ' ($' + c.price + ')'
    },
    etLabel (et) {
      if (!et || et.type === 'permanent') return '永久'
      if (et.type === 'disabled') return '不生效'
      if (et.type === 'dateRange') return '指定日期'
      if (et.type === 'weekly') return '每星期'
      return ''
    },
    bundleLabel (row) {
      if (row.autoBundle === true) return '強制參與'
      if (row.autoBundle === false) return '不參與'
      return '自動'
    },
    bundleTagType (row) {
      if (row.autoBundle === true) return 'success'
      if (row.autoBundle === false) return 'info'
      return 'warning'
    },
    cleanItems (items) {
      return (items || [])
        .filter(i => i.name && String(i.name).trim() !== '')
        .map(i => ({
          commodityId: i.commodityId || '',
          name: i.name,
          price: i.price || 0,
          upgradePrice: i.upgradePrice || 0
        }))
    },
    submitCombo (formName) {
      this.$refs[formName].validate(valid => {
        if (!valid) return
        const groups = []
        this.form.groups.forEach((g, gi) => {
          const items = this.cleanItems(g.items)
          if (!items.length) return
          const min = Math.max(1, Number(g.min) || 1)
          const max = Math.max(min, Number(g.max) || min)
          groups.push({
            name: (g.name || '').trim() || ('跟餐組' + (gi + 1)),
            min,
            max,
            allowRepeat: false,
            fixed: false,
            groupPrice: Number(g.groupPrice) || 0,
            items
          })
        })
        if (!groups.length) {
          this.$message({ type: 'warning', message: '請至少添加一個跟餐組' })
          return
        }
        const payload = {
          name: this.form.name,
          code: this.form.code,
          price: this.form.price,
          department: this.form.department,
          showItems: true,
          showOnPos: true,
          showOnQr: true,
          autoPopup: this.form.autoPopup !== false,
          mainDishes: (this.form.mainDishes || []).filter(d => d.commodityId && d.name).map(d => ({ commodityId: d.commodityId, name: d.name })),
          effectiveTime: this.cloneEt(this.form.effectiveTime),
          bundlePriority: Number(this.form.bundlePriority) || 0,
          groups
        }
        if (this.form.autoBundle === 'on') payload.autoBundle = true
        else if (this.form.autoBundle === 'off') payload.autoBundle = false
        if (this.form._id) payload._id = this.form._id
        const url = this.dialog.option === 'add' ? '/add' : '/edit'
        this.$axios.post('/api/combo' + url, payload)
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
    this.loadCommodities()
    this.loadGlobal()
    this.$axios.get('/api/department/list')
      .then(res => {
        this.departmentList = (res.data || []).filter(d => d.active !== false)
      })
      .catch(err => console.log(err))
    window.onresize = () => { this.tableHeight = window.innerHeight - 160 }
  }
}
</script>

<style scoped>
#bundle{ height: 100%; }
.global-card{ margin-bottom: 12px; }
.card-header{ font-weight: bold; color: #409eff; }
.global-form{ padding: 0 10px; }
.hint{ font-size: 12px; color: #c0c4cc; margin-left: 8px; }
.row-height{ margin-top: 10px; overflow: auto; }
.btn-shadow{ float: right; top: 0; box-shadow: 0px 0px 20px rgba(53,141,230,0.562); }
.lbl{ font-size: 12px; color: #909399; margin: 0 4px; }
.split-box{
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: #fafafa;
}
.split-total{
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #303133;
  flex-wrap: wrap;
}
.win-box{
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: #fafafa;
}
.win-header{
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.win-title{ font-weight: bold; color: #409eff; }
.win-empty{ font-size: 12px; color: #c0c4cc; margin-bottom: 8px; }
.win-item{
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.adv-row{
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
</style>
