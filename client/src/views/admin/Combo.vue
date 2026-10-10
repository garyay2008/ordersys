<template>
  <div id="combo">
    <el-row>
      <el-button type="primary" size="small" class="btn-shadow" @click="addCombo">添加套餐</el-button>
    </el-row>
    <el-row class="row-height">
      <el-col :span="24">
        <el-table :data="tableData" size="medium" :max-height="tableHeight" style="width: 100%">
          <el-table-column align="center" width="90" label="圖片">
            <template slot-scope="scope">
              <img v-if="scope.row.img" :src="scope.row.img" width="70px" height="70px" alt="">
              <span v-else class="no-img">無圖</span>
            </template>
          </el-table-column>
          <el-table-column align="center" prop="code" width="110" label="套餐編號"></el-table-column>
          <el-table-column align="center" prop="name" width="180" label="套餐名稱"></el-table-column>
          <el-table-column align="center" width="100" label="所屬部門">
            <template slot-scope="scope">
              <span v-if="scope.row.department">{{ scope.row.department }}</span>
              <span v-else style="color:#c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="90" label="收入分帳">
            <template slot-scope="scope">
              <span v-if="(scope.row.departmentSplit || []).length">{{ (scope.row.departmentSplit || []).length }} 部門</span>
              <span v-else style="color:#c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column align="center" prop="describe" label="描述"></el-table-column>
          <el-table-column align="center" width="100" label="價格">
            <template slot-scope="scope">${{ scope.row.price }}</template>
          </el-table-column>
          <el-table-column align="center" width="90" label="階段數">
            <template slot-scope="scope">{{ (scope.row.groups || []).length }}</template>
          </el-table-column>
          <el-table-column align="center" width="100" label="主食綁定">
            <template slot-scope="scope">
              <span v-if="(scope.row.mainDishes || []).length">{{ (scope.row.mainDishes || []).length }} 主食</span>
              <span v-else style="color:#c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="80" label="售罄">
            <template slot-scope="scope">{{ scope.row.soldOut ? '是' : '否' }}</template>
          </el-table-column>
          <el-table-column align="center" width="90" label="渠道">
            <template slot-scope="scope">
              <el-tag size="mini" :type="scope.row.showOnPos !== false ? 'primary' : 'info'">POS</el-tag>
              <el-tag size="mini" :type="scope.row.showOnQr !== false ? 'success' : 'info'">QR</el-tag>
            </template>
          </el-table-column>
          <el-table-column fixed="right" align="center" width="160" label="操作">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="editCombo(scope.row)">編輯</el-button>
              <el-button type="text" size="small" @click="copyCombo(scope.row)">複印</el-button>
              <el-button type="text" size="small" @click="delCombo(scope.row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>

    <el-dialog :title="dialog.title" :visible.sync="dialog.show" fullscreen>
      <el-form ref="comboForm" :model="comboForm" :rules="rules" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="POS 套餐名稱" prop="name">
              <el-input v-model="comboForm.name" placeholder="如：吉祥如意四人合菜"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="QR CODE 套餐名稱">
              <el-input v-model="comboForm.qrName" placeholder="客人手機顯示名稱，留空同 POS 名"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="套餐編號" prop="code">
              <el-input v-model="comboForm.code" placeholder="套餐編號"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="套餐價格" prop="price">
              <el-input type="number" v-model.number="comboForm.price"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="所屬部門">
              <el-select v-model="comboForm.department" placeholder="選擇部門" style="width: 100%">
                <el-option v-for="d in departmentList" :key="d._id" :label="d.name" :value="d.name"></el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="6">
            <el-form-item label="顯示套餐貨品">
              <el-switch v-model="comboForm.showItems" active-text="開" inactive-text="關"></el-switch>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="POS 顯示">
              <el-switch v-model="comboForm.showOnPos" active-text="開" inactive-text="關"></el-switch>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="QR 顯示">
              <el-switch v-model="comboForm.showOnQr" active-text="開" inactive-text="關"></el-switch>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="主食自動彈出">
              <el-switch v-model="comboForm.autoPopup" active-text="開" inactive-text="關"></el-switch>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="QR 顯示自動品項名">
              <el-switch v-model="comboForm.showFixedNames" active-text="開" inactive-text="關"></el-switch>
              <div class="lbl hint">開啟後，QR 套餐選擇頁會顯示自動選取（固定）品項的名稱；POS 永遠顯示，不受影響。</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="不列印套餐名">
              <el-switch v-model="comboForm.noPrintComboName" active-text="開" inactive-text="關"></el-switch>
              <div class="lbl hint">開啟後，後廚單/追單/上菜紙/全單明細不印套餐名標題，直接列印套餐內各貨品（收據仍保留套餐名以作結算）。</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="24">
            <el-divider content-position="left">主食綁定（點擊主食貨品即自動帶出本套餐）</el-divider>
            <div class="split-box">
              <div class="split-total">
                <span>主食碼綁定：</span>
                <span style="color:#909399; font-size:12px;">在 POS 點擊已綁定的主食，會自動彈出本套餐供選擇跟餐</span>
                <el-button size="mini" type="primary" plain @click="addMainDish">+ 添加主食</el-button>
              </div>
              <div v-if="!comboForm.mainDishes.length" class="win-empty">暫無主食綁定，按「+ 添加主食」加入</div>
              <div v-for="(d, di) in comboForm.mainDishes" :key="di" class="win-item">
                <el-select v-model="d.commodityId" placeholder="輸入編碼 / 選擇主食" filterable default-first-option style="flex: 1;" @change="(val) => onPickMainDish(d, val)">
                  <el-option v-for="c in commodityOptions" :key="c._id" :label="itemLabel(c)" :value="c._id"></el-option>
                </el-select>
                <el-button type="danger" size="mini" icon="el-icon-delete" @click="comboForm.mainDishes.splice(di, 1)"></el-button>
                <span v-if="isDanglingId(d.commodityId)" class="dangling-warn">⚠ 貨品已不存在，請重新選擇</span>
              </div>
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="24">
            <el-divider content-position="left">撞餐生效時段（限制本套餐只在指定時段參與撞餐）</el-divider>
            <div class="split-box">
              <div class="split-total">
                <span>撞餐時段：</span>
                <el-select v-model="comboForm.effectiveTime.type" size="small" style="width: 130px;">
                  <el-option label="永久" value="permanent"></el-option>
                  <el-option label="生效日期" value="dateRange"></el-option>
                  <el-option label="星期" value="weekly"></el-option>
                  <el-option label="不生效" value="disabled"></el-option>
                </el-select>
              </div>
              <div v-if="comboForm.effectiveTime.type === 'dateRange'" class="adv-row">
                <el-date-picker v-model="comboForm.effectiveTime.startDate" type="date" placeholder="開始日期" value-format="yyyy-MM-dd" size="small" style="width: 45%;"></el-date-picker>
                <span class="lbl">~</span>
                <el-date-picker v-model="comboForm.effectiveTime.endDate" type="date" placeholder="結束日期" value-format="yyyy-MM-dd" size="small" style="width: 45%;"></el-date-picker>
              </div>
              <div v-if="comboForm.effectiveTime.type === 'weekly'" class="adv-row">
                <el-checkbox-group v-model="comboForm.effectiveTime.weekdays">
                  <el-checkbox v-for="dw in weekdayOptions" :key="'bw' + dw.value" :label="dw.value">{{ dw.label }}</el-checkbox>
                </el-checkbox-group>
              </div>
              <div v-if="comboForm.effectiveTime.type === 'dateRange' || comboForm.effectiveTime.type === 'weekly'" class="adv-row">
                <span class="lbl">時間段</span>
                <el-input v-model="comboForm.effectiveTime.startTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
                <span class="lbl">~</span>
                <el-input v-model="comboForm.effectiveTime.endTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
              </div>
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-divider content-position="left">窗口 1 · 收入分帳（分拆至各部門）</el-divider>
            <div class="split-box">
              <div class="split-total">
                <span>已分帳：</span>
                <span class="split-sum">${{ splitTotal }}</span>
                <span class="split-remain" :class="splitRemainder !== 0 ? 'warn' : 'ok'">
                  {{ splitRemainder === 0 ? '✓ 已對數' : (splitRemainder > 0 ? '剩餘 $' + splitRemainder : '超出 $' + Math.abs(splitRemainder)) }}
                </span>
                <el-button size="mini" type="text" @click="splitAverage">平均分</el-button>
                <el-button size="mini" type="text" @click="splitClear">清零</el-button>
              </div>
              <el-alert
                v-if="splitRemainder !== 0"
                :title="splitRemainder > 0 ? `尚有剩餘 $${splitRemainder} 未分帳，無法保存套餐` : `分帳超出 $${Math.abs(splitRemainder)}，無法保存套餐`"
                type="warning"
                :closable="false"
                show-icon
                style="margin-bottom: 8px;"
              ></el-alert>
              <div v-for="(row, si) in comboForm.departmentSplit" :key="si" class="split-row">
                <el-select v-model="row.department" placeholder="選擇部門" filterable allow-create style="width: 160px;">
                  <el-option v-for="d in splitDepartmentList" :key="d._id" :label="d.name" :value="d.name"></el-option>
                </el-select>
                <el-input-number v-model="row.amount" :min="0" :precision="2" :step="10" size="small" controls-position="right" style="width: 120px;"></el-input-number>
                <span class="lbl">收入</span>
                <el-button type="danger" size="mini" icon="el-icon-delete" @click="comboForm.departmentSplit.splice(si, 1)"></el-button>
              </div>
              <el-button size="mini" type="primary" plain @click="addSplitRow">+ 添加部門分帳</el-button>
            </div>
          </el-col>
          <el-col :span="8" v-for="(win, wi) in comboForm.windows" :key="'win' + wi">
            <el-divider content-position="left">窗口 {{ wi + 2 }} · {{ win.mode === 'auto' ? '自動選取（客人唔使揀）' : '選 N 項' }}</el-divider>
            <div class="win-box">
              <div class="win-header">
                <el-select v-model="win.mode" size="small" style="width: 110px;" @change="onWinModeChange(win)">
                  <el-option label="選 N 項" value="select"></el-option>
                  <el-option label="自動選取" value="auto"></el-option>
                </el-select>
                <template v-if="win.mode === 'select'">
                  <span class="lbl">選</span>
                  <el-input-number v-model="win.count" :min="1" :max="99" size="small"></el-input-number>
                  <span class="lbl">項</span>
                </template>
                <el-button size="mini" type="primary" plain @click="addItem(win.items)">+ 添加貨品</el-button>
              </div>
              <div v-if="!win.items.length" class="win-empty">暫無貨品，按「+ 添加貨品」加入</div>
              <div v-for="(item, ii) in win.items" :key="ii" class="win-item">
                <div class="win-item-row">
                  <el-select v-model="item.commodityId" placeholder="輸入編碼 / 選擇貨品" filterable default-first-option style="flex: 1;" @change="(val) => onPickItem(item, val)">
                    <el-option v-for="c in commodityOptions" :key="c._id" :label="itemLabel(c)" :value="c._id"></el-option>
                  </el-select>
                  <span class="lbl">加價</span>
                  <el-input-number v-model="item.upgradePrice" :min="0" :precision="2" :step="1" size="small" controls-position="right" style="width: 110px;" :disabled="win.uniformUpgradeEnabled"></el-input-number>
                  <el-button type="danger" size="mini" icon="el-icon-delete" @click="win.items.splice(ii, 1)"></el-button>
                </div>
                <div v-if="isDanglingId(item.commodityId)" class="dangling-warn">⚠ 貨品已不存在，請重新選擇</div>
                <div class="win-item-mods">
                  <span class="lbl">改碼</span>
                  <div class="win-item-mods-body">
                    <el-select v-model="item.modCategories" placeholder="選擇改碼類別(可多選)" multiple clearable size="small" style="flex: 1;">
                      <el-option v-for="c in modCategoryObjs" :key="c.name" :label="modCatLabel(c)" :value="c.name"></el-option>
                    </el-select>
                    <div v-if="item.modCategories && item.modCategories.length" class="mod-cat-hint">{{ modCatHint(item.modCategories) }}</div>
                  </div>
                </div>
              </div>
              <el-collapse class="win-adv">
                <el-collapse-item title="進階設定">
                  <div class="adv-row">
                    <span class="lbl">階段名</span>
                    <el-input v-model="win.name" placeholder="如：精選冷盤" size="small" style="width: 160px;"></el-input>
                  </div>
                  <div v-if="win.mode === 'select'" class="adv-row">
                    <el-checkbox v-model="win.allowRepeat">可重複選</el-checkbox>
                  </div>
                  <div class="adv-row">
                    <el-checkbox v-model="win.uniformUpgradeEnabled">整組同價（所有品項統一加價）</el-checkbox>
                  </div>
                  <div v-if="win.uniformUpgradeEnabled" class="adv-row">
                    <span class="lbl">加價</span>
                    <el-input-number v-model="win.uniformUpgrade" :min="0" :precision="2" :step="1" size="small" controls-position="right" style="width: 110px;"></el-input-number>
                    <el-button size="mini" type="primary" plain @click="applyUniformUpgrade(win)">套用到所有品項</el-button>
                  </div>
                  <div class="adv-row">
                    <span class="lbl">跟餐加購價</span>
                    <el-input-number v-model="win.groupPrice" :min="0" :precision="2" :step="1" size="small" controls-position="right" style="width: 110px;"></el-input-number>
                    <span class="lbl hint">此窗口有揀選就加一次（如：跟餐飲 +$8）</span>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
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
  name: 'combo',
  data () {
    return {
      dialog: { show: false, title: '', option: 'add' },
      comboForm: this.emptyForm(),
      tableData: [],
      tableHeight: window.innerHeight - 160,
      departmentList: [],
      splitDepartmentList: [],
      commodityOptions: [],
      commodityIdSet: null,
      modCategoryObjs: [],
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
        name: [{ required: true, message: '套餐名稱不能為空', trigger: 'blur' }],
        price: [{ required: true, message: '套餐價格不能為空', trigger: 'blur' }]
      }
    }
  },
  computed: {
    splitTotal () {
      return Math.round((this.comboForm.departmentSplit || []).reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100
    },
    splitRemainder () {
      return Math.round(((Number(this.comboForm.price) || 0) - this.splitTotal) * 100) / 100
    }
  },
  methods: {
    emptyForm () {
      return {
        name: '',
        qrName: '',
        code: '',
        price: 0,
        department: '',
        showItems: true,
        showFixedNames: true,
        showOnPos: true,
        showOnQr: true,
        autoPopup: true,
        noPrintComboName: false,
        mainDishes: [],
        effectiveTime: { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] },
        departmentSplit: [],
        windows: [
          { mode: 'auto', name: '自動選取', count: 1, allowRepeat: false, uniformUpgradeEnabled: false, uniformUpgrade: 0, groupPrice: 0, items: [] },
          { mode: 'select', name: '', count: 1, allowRepeat: false, uniformUpgradeEnabled: false, uniformUpgrade: 0, groupPrice: 0, items: [] },
          { mode: 'select', name: '', count: 1, allowRepeat: false, uniformUpgradeEnabled: false, uniformUpgrade: 0, groupPrice: 0, items: [] },
          { mode: 'select', name: '', count: 1, allowRepeat: false, uniformUpgradeEnabled: false, uniformUpgrade: 0, groupPrice: 0, items: [] },
          { mode: 'select', name: '', count: 1, allowRepeat: false, uniformUpgradeEnabled: false, uniformUpgrade: 0, groupPrice: 0, items: [] }
        ]
      }
    },
    emptyItem () {
      return { commodityId: '', name: '', price: 0, upgradePrice: 0, modCategories: [], modifiers: [], substitutes: [] }
    },
    normalizeItem (i) {
      return {
        commodityId: i.commodityId || '',
        name: i.name || '',
        price: i.price || 0,
        upgradePrice: i.upgradePrice || 0,
        modCategories: i.modCategories || [],
        modifiers: Array.isArray(i.modifiers) ? i.modifiers.map(m => ({ modCodeId: m.modCodeId || '', name: m.name || '', price: m.price || 0, station: m.station || '' })) : [],
        substitutes: Array.isArray(i.substitutes) ? i.substitutes.map(s => ({ name: s.name || '', price: s.price || 0, priceDelta: s.priceDelta || 0 })) : []
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
      this.$axios.get('/api/combo/all')
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
      this.$axios.get('/api/commodity/list')
        .then(res => {
          const set = {}
          ;(res.data || []).forEach(c => { set[String(c._id)] = true })
          this.commodityIdSet = set
        })
        .catch(err => console.log(err))
    },
    isDanglingId (id) {
      if (!id || !this.commodityIdSet) return false
      return !this.commodityIdSet[String(id)]
    },
    addCombo () {
      this.dialog = { show: true, title: '添加套餐', option: 'add' }
      this.comboForm = this.emptyForm()
    },
    mapRowToForm (row) {
      const windows = this.emptyForm().windows
      const groups = row.groups || []
      // 依原始順序還原：fixed → 自動選取、非 fixed → 選 N 項（窗口 2~6 對應 groups[0..4]）
      groups.forEach((g, gi) => {
        if (gi >= windows.length) return
        const win = windows[gi]
        win.mode = g.fixed ? 'auto' : 'select'
        win.name = g.name || ''
        win.count = g.max || g.min || 1
        win.allowRepeat = !!g.allowRepeat
        win.uniformUpgradeEnabled = !!g.uniformUpgradeEnabled
        win.uniformUpgrade = g.uniformUpgrade || 0
        win.groupPrice = g.groupPrice || 0
        win.items = (g.items || []).map(i => this.normalizeItem(i))
      })
      return {
        name: row.name || '',
        qrName: row.qrName || '',
        code: row.code || '',
        price: row.price || 0,
        department: row.department || '',
        showItems: row.showItems !== false,
        showFixedNames: row.showFixedNames !== false,
        showOnPos: row.showOnPos !== false,
        showOnQr: row.showOnQr !== false,
        autoPopup: row.autoPopup !== false,
        noPrintComboName: !!row.noPrintComboName,
        mainDishes: (row.mainDishes || []).map(d => ({ commodityId: d.commodityId || '', name: d.name || '' })),
        effectiveTime: this.cloneEt(row.effectiveTime),
        departmentSplit: (row.departmentSplit || []).map(d => ({ department: d.department, amount: d.amount })),
        windows
      }
    },
    editCombo (row) {
      this.dialog = { show: true, title: '編輯套餐', option: 'edit' }
      this.comboForm = Object.assign({ _id: row._id }, this.mapRowToForm(row))
    },
    copyCombo (row) {
      this.dialog = { show: true, title: '複印套餐', option: 'add' }
      const form = this.mapRowToForm(row)
      form.name = (row.name || '') + ' 複印'
      form.code = ''
      this.comboForm = form
    },
    delCombo (row) {
      this.$confirm(`確認刪除套餐 “${row.name}” 嗎？`)
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
    addItem (list) {
      list.push(this.emptyItem())
    },
    onWinModeChange (win) {
      if (win.mode === 'select') {
        if (!win.count) this.$set(win, 'count', 1)
        if (win.allowRepeat === undefined) this.$set(win, 'allowRepeat', false)
      }
    },
    applyUniformUpgrade (win) {
      const up = Number(win.uniformUpgrade) || 0
      ;(win.items || []).forEach(i => { i.upgradePrice = up })
      this.$message({ type: 'success', message: `已套用加價 $${up} 到 ${(win.items || []).length} 個品項` })
    },
    addMainDish () {
      this.comboForm.mainDishes.push({ commodityId: '', name: '' })
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
    modCatRangeText (min, max) {
      if (min > 0 && max > 0) return `（${min}~${max} 項）`
      if (min > 0) return `（最少 ${min} 項）`
      if (max > 0) return `（最多 ${max} 項）`
      return ''
    },
    modCatLabel (c) {
      const min = Number(c.minSelect) || 0
      const max = Number(c.maxSelect) || 0
      return (c.code ? c.code + ' ' : '') + c.name + this.modCatRangeText(min, max)
    },
    modCatHint (names) {
      const rows = (names || []).map(n => this.modCategoryObjs.find(c => c.name === n)).filter(Boolean)
      return rows.map(c => {
        const min = Number(c.minSelect) || 0
        const max = Number(c.maxSelect) || 0
        return (c.code ? c.code + ' ' : '') + c.name + this.modCatRangeText(min, max)
      }).join('　')
    },
    addSplitRow () {
      this.comboForm.departmentSplit.push({ department: '', amount: 0 })
    },
    splitAverage () {
      const rows = (this.comboForm.departmentSplit || []).filter(r => r.department && String(r.department).trim() !== '')
      if (!rows.length) return
      const price = Number(this.comboForm.price) || 0
      const avg = Math.round(price / rows.length * 100) / 100
      rows.forEach(r => { r.amount = avg })
    },
    splitClear () {
      (this.comboForm.departmentSplit || []).forEach(r => { r.amount = 0 })
    },
    cleanItems (items) {
      return (items || [])
        .filter(i => i.name && String(i.name).trim() !== '')
        .map(i => ({
          commodityId: i.commodityId || '',
          name: i.name,
          price: i.price || 0,
          upgradePrice: i.upgradePrice || 0,
          modCategories: i.modCategories || [],
          modifiers: Array.isArray(i.modifiers) ? i.modifiers.map(m => ({ modCodeId: m.modCodeId || '', name: m.name || '', price: m.price || 0, station: m.station || '' })) : [],
          substitutes: Array.isArray(i.substitutes) ? i.substitutes.map(s => ({ name: s.name || '', price: s.price || 0, priceDelta: s.priceDelta || 0 })) : []
        }))
    },
    submitCombo (formName) {
      this.$refs[formName].validate(valid => {
        if (!valid) return
        const groups = []
        let invalid = false
        this.comboForm.windows.forEach((win, wi) => {
          const items = this.cleanItems(win.items)
          if (!items.length) return
          if (win.mode === 'auto') {
            groups.push({
              name: (win.name || '自動選取').trim(),
              min: items.length,
              max: items.length,
              allowRepeat: false,
              fixed: true,
              uniformUpgradeEnabled: !!win.uniformUpgradeEnabled,
              uniformUpgrade: Number(win.uniformUpgrade) || 0,
              groupPrice: Number(win.groupPrice) || 0,
              items
            })
          } else {
            const count = Math.max(1, Number(win.count) || 1)
            if (count > items.length) {
              this.$message({ type: 'warning', message: `窗口 ${wi + 2}「選 ${count} 項」但只有 ${items.length} 個貨品，請減少數量或添加貨品` })
              invalid = true
              return
            }
            groups.push({
              name: (win.name || '').trim() || ('窗口' + (wi + 2)),
              min: count,
              max: count,
              allowRepeat: !!win.allowRepeat,
              fixed: false,
              uniformUpgradeEnabled: !!win.uniformUpgradeEnabled,
              uniformUpgrade: Number(win.uniformUpgrade) || 0,
              groupPrice: Number(win.groupPrice) || 0,
              items
            })
          }
        })
        if (invalid) return
        if (!groups.length) {
          this.$message({ type: 'warning', message: '請至少添加一個貨品（窗口 2 或窗口 3–6）' })
          return
        }
        const splitRows = (this.comboForm.departmentSplit || []).filter(r => r.department && String(r.department).trim() !== '')
        const splitTotal = Math.round(splitRows.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100
        const price = Number(this.comboForm.price) || 0
        const diff = Math.round((price - splitTotal) * 100) / 100
        if (splitRows.length && Math.abs(diff) > 0.005) {
          const dir = diff > 0 ? '未分完' : '超出'
          this.$message({ type: 'error', message: `收入分帳總和（$${splitTotal}）與套餐價格（$${price}）不符，差額 $${Math.abs(diff)}（${dir}），請修正後再存入` })
          return
        }
        const payload = {
          name: this.comboForm.name,
          qrName: this.comboForm.qrName || '',
          code: this.comboForm.code,
          price: this.comboForm.price,
          department: this.comboForm.department,
          showItems: !!this.comboForm.showItems,
          showFixedNames: this.comboForm.showFixedNames !== false,
          showOnPos: this.comboForm.showOnPos !== false,
          showOnQr: this.comboForm.showOnQr !== false,
          autoPopup: this.comboForm.autoPopup !== false,
          noPrintComboName: !!this.comboForm.noPrintComboName,
          mainDishes: (this.comboForm.mainDishes || []).filter(d => d.commodityId && d.name).map(d => ({ commodityId: d.commodityId, name: d.name })),
          effectiveTime: this.cloneEt(this.comboForm.effectiveTime),
          departmentSplit: splitRows.map(r => ({ department: r.department.trim(), amount: Number(r.amount) || 0 })),
          groups
        }
        if (this.comboForm._id) payload._id = this.comboForm._id
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
    this.$axios.get('/api/department/list')
      .then(res => {
        const all = (res.data || []).filter(d => d.active !== false)
        this.departmentList = all
        this.splitDepartmentList = all.filter(d => d.showInSplit !== false)
      })
      .catch(err => console.log(err))
    this.$axios.get('/api/modcode/categories')
      .then(res => { this.modCategoryObjs = res.data || [] })
      .catch(() => { this.modCategoryObjs = [] })
    window.onresize = () => { this.tableHeight = window.innerHeight - 160 }
  }
}
</script>

<style scoped>
#combo{ height: 100%; }
.row-height{ margin-top: 10px; overflow: auto; }
.btn-shadow{ float: right; top: 0; box-shadow: 0px 0px 20px rgba(53,141,230,0.562); }
.no-img{ color: #c0c4cc; font-size: 12px; }
.lbl{ font-size: 12px; color: #909399; margin: 0 4px; }
.lbl.hint{ color: #c0c4cc; }
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
.split-sum{ font-weight: 700; color: #409eff; }
.split-remain{ font-weight: 600; }
.split-remain.ok{ color: #67c23a; }
.split-remain.warn{ color: #f56c6c; }
.split-row{
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
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
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}
.win-item-row{
  display: flex;
  align-items: center;
  gap: 8px;
}
.win-item-mods{
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.win-item-mods-body{
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mod-cat-hint{
  font-size: 11px;
  color: #e6a23c;
  line-height: 1.4;
}
.dangling-warn{
  font-size: 12px;
  color: #f56c6c;
  line-height: 1.4;
}
.win-adv{ margin-top: 6px; }
.adv-row{
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
</style>
