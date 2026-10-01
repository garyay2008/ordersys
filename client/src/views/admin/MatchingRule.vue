<template>
  <div id="matchingrule">
    <el-row>
      <el-button type="primary" size="small" class="btn-shadow" @click="addRule">添加撞餐規則</el-button>
    </el-row>
    <el-row class="row-height">
      <el-col :span="24">
        <el-table :data="tableData" size="medium" :max-height="tableHeight" style="width: 100%">
          <el-table-column align="center" prop="name" label="規則名稱" min-width="160"></el-table-column>
          <el-table-column align="center" width="80" label="啟用">
            <template slot-scope="scope">
              <el-tag size="mini" :type="scope.row.enabled !== false ? 'success' : 'info'">{{ scope.row.enabled !== false ? '開' : '關' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" label="主食分類">
            <template slot-scope="scope">
              <template v-if="(scope.row.triggerCategoryIds || []).length">
                <el-tag size="mini" v-for="(id, ii) in scope.row.triggerCategoryIds" :key="ii" style="margin: 1px;">{{ categoryName(id) }}</el-tag>
              </template>
              <span v-else style="color:#c0c4cc;">任意主食</span>
            </template>
          </el-table-column>
          <el-table-column align="center" label="跟餐分類">
            <template slot-scope="scope">
              <template v-if="(scope.row.addonCategoryIds || []).length">
                <el-tag size="mini" v-for="(id, ii) in scope.row.addonCategoryIds" :key="ii" style="margin: 1px;">{{ categoryName(id) }}</el-tag>
              </template>
              <span v-else style="color:#c0c4cc;">任意跟餐</span>
            </template>
          </el-table-column>
          <el-table-column align="center" label="跟餐組別">
            <template slot-scope="scope">
              <template v-if="(scope.row.bundleGroupIds || []).length">
                <el-tag size="mini" type="warning" v-for="(id, ii) in scope.row.bundleGroupIds" :key="ii" style="margin: 1px;">{{ bundleGroupName(id) }}</el-tag>
              </template>
              <span v-else style="color:#c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="100" label="跟餐價">
            <template slot-scope="scope">${{ rowAddonPrice(scope.row) }}</template>
          </el-table-column>
          <el-table-column align="center" width="80" label="優先級">
            <template slot-scope="scope">{{ scope.row.priority || 0 }}</template>
          </el-table-column>
          <el-table-column align="center" width="100" label="撞餐時段">
            <template slot-scope="scope">{{ etLabel(scope.row.effectiveTime) }}</template>
          </el-table-column>
          <el-table-column fixed="right" align="center" width="140" label="操作">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="editRule(scope.row)">編輯</el-button>
              <el-button type="text" size="small" @click="delRule(scope.row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>

    <el-dialog :title="dialog.title" :visible.sync="dialog.show" width="640px">
      <el-form ref="ruleForm" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="規則名稱" prop="name">
          <el-input v-model="form.name" placeholder="如：飯類 + 凍飲"></el-input>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="啟用">
              <el-switch v-model="form.enabled"></el-switch>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="優先級">
              <el-input-number v-model="form.priority" :min="0" :step="1" controls-position="right"></el-input-number>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">配對規則</el-divider>
        <el-form-item label="主食分類">
          <el-select v-model="form.triggerCategoryIds" multiple filterable placeholder="選擇主食分類（留空 = 任意主食）" style="width: 100%;">
            <el-option v-for="c in categoryOptions" :key="c._id" :label="catLabel(c)" :value="c._id"></el-option>
          </el-select>
          <div class="hint">從這些分類揀選一個主食，搭配下方跟餐分類的一個跟餐，即自動撞餐。</div>
        </el-form-item>
        <el-form-item label="跟餐分類">
          <el-select v-model="form.addonCategoryIds" multiple filterable placeholder="選擇跟餐分類（留空 = 任意跟餐）" style="width: 100%;">
            <el-option v-for="c in categoryOptions" :key="c._id" :label="catLabel(c)" :value="c._id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="跟餐組別">
          <el-select v-model="form.bundleGroupIds" multiple filterable clearable placeholder="選擇跟餐組別（選了即以組別跟餐價為準）" style="width: 100%;">
            <el-option v-for="g in bundleGroups" :key="g._id" :label="g.name + ' ($' + (Number(g.price) || 0) + ')'" :value="g._id"></el-option>
          </el-select>
          <div class="hint">選了跟餐組別後，撞餐改撞「組別」而非分類，跟餐價以組別設定為準，忽略下方「跟餐價」。</div>
        </el-form-item>
        <el-form-item label="跟餐價" prop="addonPrice">
          <el-input-number v-model="form.addonPrice" :min="0" :precision="2" :step="1" controls-position="right"></el-input-number>
          <div class="hint">撞餐時跟餐的特別售價（如 +$5）；主食保留原價。</div>
        </el-form-item>

        <el-divider content-position="left">撞餐生效時段</el-divider>
        <el-form-item label="撞餐時段">
          <el-select v-model="form.effectiveTime.type" size="small" style="width: 130px;">
            <el-option label="永久" value="permanent"></el-option>
            <el-option label="生效日期" value="dateRange"></el-option>
            <el-option label="星期" value="weekly"></el-option>
            <el-option label="不生效" value="disabled"></el-option>
          </el-select>
        </el-form-item>
        <div v-if="form.effectiveTime.type === 'dateRange'" class="adv-row">
          <el-date-picker v-model="form.effectiveTime.startDate" type="date" placeholder="開始日期" value-format="yyyy-MM-dd" size="small" style="width: 45%;"></el-date-picker>
          <span class="lbl">~</span>
          <el-date-picker v-model="form.effectiveTime.endDate" type="date" placeholder="結束日期" value-format="yyyy-MM-dd" size="small" style="width: 45%;"></el-date-picker>
        </div>
        <div v-if="form.effectiveTime.type === 'weekly'" class="adv-row">
          <el-checkbox-group v-model="form.effectiveTime.weekdays">
            <el-checkbox v-for="dw in weekdayOptions" :key="'w' + dw.value" :label="dw.value">{{ dw.label }}</el-checkbox>
          </el-checkbox-group>
        </div>
        <div v-if="form.effectiveTime.type === 'dateRange' || form.effectiveTime.type === 'weekly'" class="adv-row">
          <span class="lbl">時間段</span>
          <el-input v-model="form.effectiveTime.startTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
          <span class="lbl">~</span>
          <el-input v-model="form.effectiveTime.endTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
        </div>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialog.show = false">取 消</el-button>
        <el-button type="primary" @click="submitRule('ruleForm')">確 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'matchingrule',
  data () {
    return {
      dialog: { show: false, title: '', option: 'add' },
      form: this.emptyForm(),
      tableData: [],
      tableHeight: window.innerHeight - 160,
      categoryOptions: [],
      bundleGroups: [],
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
        name: [{ required: true, message: '規則名稱不能為空', trigger: 'blur' }],
        addonPrice: [{ required: true, message: '跟餐價不能為空', trigger: 'blur' }]
      }
    }
  },
  methods: {
    emptyForm () {
      return {
        name: '',
        enabled: true,
        priority: 0,
        triggerCategoryIds: [],
        addonCategoryIds: [],
        bundleGroupIds: [],
        addonPrice: 0,
        effectiveTime: { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] }
      }
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
      this.$axios.get('/api/matchingrule/all')
        .then(res => { this.tableData = res.data || [] })
        .catch(err => console.log(err))
    },
    loadCategories () {
      this.$axios.get('/api/category/all')
        .then(res => { this.categoryOptions = res.data || [] })
        .catch(err => console.log(err))
    },
    loadBundleGroups () {
      this.$axios.get('/api/bundlegroup/list')
        .then(res => { this.bundleGroups = res.data || [] })
        .catch(err => console.log(err))
    },
    catLabel (c) {
      if (!c) return ''
      const code = c.code ? String(c.code).trim() : ''
      const name = c.cName || ''
      if (code && name) return code + ' ' + name
      return code || name || String(c._id || '')
    },
    categoryName (id) {
      const c = this.categoryOptions.find(x => String(x._id) === String(id))
      return c ? this.catLabel(c) : id
    },
    bundleGroupName (id) {
      const g = this.bundleGroups.find(x => String(x._id) === String(id))
      return g ? g.name : id
    },
    rowAddonPrice (row) {
      const v = (row && row.addonPrice !== undefined) ? row.addonPrice : (row && row.combinedPrice)
      return Number(v) || 0
    },
    etLabel (et) {
      if (!et || et.type === 'permanent') return '永久'
      if (et.type === 'disabled') return '不生效'
      if (et.type === 'dateRange') return '指定日期'
      if (et.type === 'weekly') return '每星期'
      return ''
    },
    addRule () {
      this.dialog = { show: true, title: '添加撞餐規則', option: 'add' }
      this.form = this.emptyForm()
    },
    mapRowToForm (row) {
      return {
        name: row.name || '',
        enabled: row.enabled !== false,
        priority: row.priority || 0,
        triggerCategoryIds: (row.triggerCategoryIds || []).slice(),
        addonCategoryIds: (row.addonCategoryIds || []).slice(),
        bundleGroupIds: (row.bundleGroupIds || []).slice(),
        addonPrice: this.rowAddonPrice(row),
        effectiveTime: this.cloneEt(row.effectiveTime)
      }
    },
    editRule (row) {
      this.dialog = { show: true, title: '編輯撞餐規則', option: 'edit' }
      this.form = Object.assign({ _id: row._id }, this.mapRowToForm(row))
    },
    delRule (row) {
      this.$confirm(`確認刪除撞餐規則 “${row.name}” 嗎？`)
        .then(_ => {
          this.$axios.post('/api/matchingrule/del', { _id: row._id })
            .then(result => {
              this.$message({ type: 'success', message: result.data })
              this.loadData()
            })
            .catch(err => console.log(err))
        })
        .catch(_ => {})
    },
    submitRule (formName) {
      this.$refs[formName].validate(valid => {
        if (!valid) return
        const payload = {
          name: this.form.name,
          enabled: this.form.enabled !== false,
          priority: Number(this.form.priority) || 0,
          triggerCategoryIds: (this.form.triggerCategoryIds || []).filter(id => !!id),
          addonCategoryIds: (this.form.addonCategoryIds || []).filter(id => !!id),
          bundleGroupIds: (this.form.bundleGroupIds || []).filter(id => !!id),
          addonPrice: Number(this.form.addonPrice) || 0,
          effectiveTime: this.cloneEt(this.form.effectiveTime)
        }
        if (this.form._id) payload._id = this.form._id
        const url = this.dialog.option === 'add' ? '/add' : '/edit'
        this.$axios.post('/api/matchingrule' + url, payload)
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
    this.loadCategories()
    this.loadBundleGroups()
    window.onresize = () => { this.tableHeight = window.innerHeight - 160 }
  }
}
</script>

<style scoped>
#matchingrule{ height: 100%; }
.row-height{ margin-top: 10px; overflow: auto; }
.btn-shadow{ float: right; top: 0; box-shadow: 0px 0px 20px rgba(53,141,230,0.562); }
.hint{ font-size: 12px; color: #c0c4cc; }
.lbl{ font-size: 12px; color: #909399; margin: 0 4px; }
.adv-row{
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px 110px;
}
</style>
