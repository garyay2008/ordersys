<template>
  <div id="addongroup">
    <el-row>
      <el-button type="primary" size="small" class="btn-shadow" @click="addGroup">添加跟餐組</el-button>
    </el-row>
    <el-row class="row-height">
      <el-col :span="24">
        <el-table :data="tableData" size="medium" :max-height="tableHeight" style="width: 100%">
          <el-table-column align="center" prop="name" label="跟餐組名稱"></el-table-column>
          <el-table-column align="center" width="120" label="跟餐加購價">
            <template slot-scope="scope">${{ scope.row.groupPrice }}</template>
          </el-table-column>
          <el-table-column align="center" width="100" label="可選數量">
            <template slot-scope="scope">{{ scope.row.min }} ~ {{ scope.row.max }}</template>
          </el-table-column>
          <el-table-column align="center" width="100" label="品項數">
            <template slot-scope="scope">{{ (scope.row.items || []).length }}</template>
          </el-table-column>
          <el-table-column align="center" label="品項">
            <template slot-scope="scope">
              <el-tag size="mini" v-for="(it, ii) in (scope.row.items || [])" :key="ii" style="margin: 1px;">{{ it.name }}<template v-if="it.upgradePrice"> +${{ it.upgradePrice }}</template></el-tag>
              <span v-if="!(scope.row.items || []).length" style="color:#c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column fixed="right" align="center" width="140" label="操作">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="editGroup(scope.row)">編輯</el-button>
              <el-button type="text" size="small" @click="delGroup(scope.row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>

    <el-dialog :title="dialog.title" :visible.sync="dialog.show" width="720px">
      <el-form ref="groupForm" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="跟餐組名稱" prop="name">
          <el-input v-model="form.name" placeholder="如：跟餐飲品"></el-input>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="跟餐加購價">
              <el-input-number v-model="form.groupPrice" :min="0" :precision="2" :step="1" controls-position="right"></el-input-number>
              <div class="hint">此組有揀選就加一次（如：跟餐飲 +$8）</div>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="檔口">
              <el-input v-model="form.station" placeholder="如：水吧（可留空）"></el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="最少選">
              <el-input-number v-model="form.min" :min="0" :max="99" controls-position="right"></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="最多選">
              <el-input-number v-model="form.max" :min="1" :max="99" controls-position="right"></el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="可重複選">
              <el-switch v-model="form.allowRepeat"></el-switch>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="整組同價">
          <el-switch v-model="form.uniformUpgradeEnabled"></el-switch>
          <template v-if="form.uniformUpgradeEnabled">
            <span class="lbl">加價</span>
            <el-input-number v-model="form.uniformUpgrade" :min="0" :precision="2" :step="1" size="small" controls-position="right" style="width: 110px;"></el-input-number>
            <el-button size="mini" type="primary" plain @click="applyUniformUpgrade">套用到所有品項</el-button>
          </template>
        </el-form-item>

        <el-divider content-position="left">跟餐品項（差價 Delta）</el-divider>
        <div class="win-box">
          <div class="win-header">
            <span class="win-title">可選品項</span>
            <el-button size="mini" type="primary" plain @click="addItem">+ 添加貨品</el-button>
          </div>
          <div v-if="!form.items.length" class="win-empty">暫無貨品，按「+ 添加貨品」加入</div>
          <div v-for="(item, ii) in form.items" :key="ii" class="win-item">
            <el-select v-model="item.commodityId" placeholder="輸入編碼 / 選擇貨品" filterable default-first-option style="flex: 1;" @change="(val) => onPickItem(item, val)">
              <el-option v-for="c in commodityOptions" :key="c._id" :label="itemLabel(c)" :value="c._id"></el-option>
            </el-select>
            <span class="lbl">加價</span>
            <el-input-number v-model="item.upgradePrice" :min="0" :precision="2" :step="1" size="small" controls-position="right" style="width: 110px;" :disabled="form.uniformUpgradeEnabled"></el-input-number>
            <el-button type="danger" size="mini" icon="el-icon-delete" @click="form.items.splice(ii, 1)"></el-button>
          </div>
        </div>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialog.show = false">取 消</el-button>
        <el-button type="primary" @click="submitGroup('groupForm')">確 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'addongroup',
  data () {
    return {
      dialog: { show: false, title: '', option: 'add' },
      form: this.emptyForm(),
      tableData: [],
      tableHeight: window.innerHeight - 160,
      commodityOptions: [],
      rules: {
        name: [{ required: true, message: '跟餐組名稱不能為空', trigger: 'blur' }]
      }
    }
  },
  methods: {
    emptyForm () {
      return {
        name: '',
        groupPrice: 0,
        min: 1,
        max: 1,
        allowRepeat: false,
        station: '',
        uniformUpgradeEnabled: false,
        uniformUpgrade: 0,
        items: []
      }
    },
    emptyItem () {
      return { commodityId: '', name: '', price: 0, upgradePrice: 0 }
    },
    normalizeItem (i) {
      return { commodityId: i.commodityId || '', name: i.name || '', price: i.price || 0, upgradePrice: i.upgradePrice || 0 }
    },
    loadData () {
      this.$axios.get('/api/addongroup/all')
        .then(res => { this.tableData = res.data || [] })
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
    addGroup () {
      this.dialog = { show: true, title: '添加跟餐組', option: 'add' }
      this.form = this.emptyForm()
    },
    mapRowToForm (row) {
      return {
        name: row.name || '',
        groupPrice: row.groupPrice || 0,
        min: row.min != null ? row.min : 1,
        max: row.max != null ? row.max : 1,
        allowRepeat: !!row.allowRepeat,
        station: row.station || '',
        uniformUpgradeEnabled: !!row.uniformUpgradeEnabled,
        uniformUpgrade: row.uniformUpgrade || 0,
        items: (row.items || []).map(i => this.normalizeItem(i))
      }
    },
    editGroup (row) {
      this.dialog = { show: true, title: '編輯跟餐組', option: 'edit' }
      this.form = Object.assign({ _id: row._id }, this.mapRowToForm(row))
    },
    delGroup (row) {
      this.$confirm(`確認刪除跟餐組 “${row.name}” 嗎？`)
        .then(_ => {
          this.$axios.post('/api/addongroup/del', { _id: row._id })
            .then(result => {
              this.$message({ type: 'success', message: result.data })
              this.loadData()
            })
            .catch(err => console.log(err))
        })
        .catch(_ => {})
    },
    addItem () {
      this.form.items.push(this.emptyItem())
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
    applyUniformUpgrade () {
      const up = Number(this.form.uniformUpgrade) || 0
      ;(this.form.items || []).forEach(i => { i.upgradePrice = up })
      this.$message({ type: 'success', message: `已套用加價 $${up} 到 ${(this.form.items || []).length} 個品項` })
    },
    cleanItems () {
      return (this.form.items || [])
        .filter(i => i.name && String(i.name).trim() !== '')
        .map(i => ({
          commodityId: i.commodityId || '',
          name: i.name,
          price: i.price || 0,
          upgradePrice: i.upgradePrice || 0
        }))
    },
    submitGroup (formName) {
      this.$refs[formName].validate(valid => {
        if (!valid) return
        const items = this.cleanItems()
        if (!items.length) {
          this.$message({ type: 'warning', message: '請至少添加一個跟餐品項' })
          return
        }
        const payload = {
          name: this.form.name,
          groupPrice: Number(this.form.groupPrice) || 0,
          min: Math.max(0, Number(this.form.min) || 0),
          max: Math.max(1, Number(this.form.max) || 1),
          allowRepeat: !!this.form.allowRepeat,
          station: this.form.station || '',
          uniformUpgradeEnabled: !!this.form.uniformUpgradeEnabled,
          uniformUpgrade: Number(this.form.uniformUpgrade) || 0,
          items
        }
        if (this.form._id) payload._id = this.form._id
        const url = this.dialog.option === 'add' ? '/add' : '/edit'
        this.$axios.post('/api/addongroup' + url, payload)
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
    window.onresize = () => { this.tableHeight = window.innerHeight - 160 }
  }
}
</script>

<style scoped>
#addongroup{ height: 100%; }
.row-height{ margin-top: 10px; overflow: auto; }
.btn-shadow{ float: right; top: 0; box-shadow: 0px 0px 20px rgba(53,141,230,0.562); }
.lbl{ font-size: 12px; color: #909399; margin: 0 4px; }
.hint{ font-size: 12px; color: #c0c4cc; }
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
</style>
