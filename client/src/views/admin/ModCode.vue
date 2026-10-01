<template>
  <div id="modcode">
    <div class="split-layout">
      <!-- Left: 改碼類別 -->
      <div class="left-panel">
        <div class="left-toolbar">
          <el-input v-model="search" placeholder="搜尋改碼類別" prefix-icon="el-icon-search" size="small" clearable style="width: 100%;"></el-input>
          <el-autocomplete v-model="locateSearch" :fetch-suggestions="queryModCodes" placeholder="搜尋改碼分類（輸入改碼編號）" size="small" clearable style="width: 100%; margin-top: 8px;" @select="onModCodeSelect" @keyup.enter.native="locateModCategory"></el-autocomplete>
          <div class="add-cat-row">
            <el-input v-model="newCategoryName" placeholder="類別名稱，如 甜度與冰量" size="small" @keyup.enter.native="addCategory"></el-input>
            <el-input v-model="newCategoryCode" placeholder="編號，如 MC01" size="small" style="width: 84px;" @keyup.enter.native="addCategory"></el-input>
            <el-button type="primary" size="small" icon="el-icon-plus" title="添加類別" @click="addCategory"></el-button>
          </div>
          <el-button type="warning" size="small" plain style="width: 100%; margin-top: 8px;" @click="initDefaults">
            <i class="el-icon-refresh"></i> 載入預設改碼
          </el-button>
          <el-button size="small" plain style="width: 100%; margin-top: 8px;" @click="loadData">
            <i class="el-icon-refresh"></i> 重新整理
          </el-button>
        </div>
        <div class="cat-scroll">
          <div class="cat-node all" :class="{ active: selectedId === null }" @click="selectCategory(null)">
            <i class="el-icon-menu" style="margin-right: 6px; color: #E6A23C;"></i>
            <span class="cat-name">全部改碼</span>
            <span class="cat-count">{{ list.length }}</span>
          </div>
          <div v-for="c in filteredCategories" :key="c._id" class="cat-node" :class="{ active: selectedId === c._id }" @click="selectCategory(c)">
            <span class="cat-name"><span v-if="c.code" class="cat-code">{{ c.code }}</span>{{ c.name }}</span>
            <span v-if="c.mandatory" class="cat-mandatory">自動彈出</span>
            <span class="cat-count">{{ modCountByCategory(c.name) }}</span>
            <span class="cat-actions" @click.stop>
              <el-button type="text" size="mini" icon="el-icon-edit" @click="openCatEdit(c)"></el-button>
              <el-button type="text" size="mini" icon="el-icon-delete" class="remove-btn" @click="delCategory(c)"></el-button>
            </span>
          </div>
          <div v-if="!categories.length" class="empty-tip">暫無改碼類別</div>
        </div>
      </div>

      <!-- Right: 改碼主檔 -->
      <div class="right-panel">
        <div class="content-header">
          <div class="breadcrumb">
            <span class="crumb-link" @click="selectCategory(null)">全部改碼</span>
            <template v-if="selectedCategory">
              <span class="crumb-sep"> / </span>
              <span class="crumb-link current">{{ selectedCategory.code ? selectedCategory.code + ' ' : '' }}{{ selectedCategory.name }}</span>
            </template>
          </div>
          <div class="content-actions">
            <el-button size="small" type="success" plain @click="openAddCategory">+ 添加改碼類別</el-button>
            <el-button size="small" type="primary" plain @click="openAddMod">+ 添加改碼</el-button>
          </div>
        </div>

        <div v-if="selectedCategory" class="mod-info">
          <el-tag size="mini" type="info">類別編號: {{ selectedCategory.code || '—' }}</el-tag>
          <span class="info-text">共 {{ filteredList.length }} 個改碼</span>
        </div>

        <div class="mod-search-row">
          <el-input v-model="modSearch" placeholder="搜尋改碼（名稱／編號）" prefix-icon="el-icon-search" size="small" clearable style="width: 280px;"></el-input>
        </div>

        <el-table :data="filteredList" size="medium" style="width: 100%;" :max-height="tableHeight">
          <el-table-column align="center" prop="name" label="改碼名稱" min-width="120"></el-table-column>
          <el-table-column align="center" width="90" label="改碼編號">
            <template slot-scope="scope">
              <span v-if="scope.row.code">{{ scope.row.code }}</span>
              <span v-else style="color:#c0c4cc;">—</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="180" label="改碼類別">
            <template slot-scope="scope">
              <el-tag size="mini" type="info"><span v-if="catCode(scope.row.category)" style="font-weight:700; margin-right:3px;">{{ catCode(scope.row.category) }}</span>{{ scope.row.category }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" width="80" label="加價">
            <template slot-scope="scope">
              <span v-if="(scope.row.price || 0) > 0" class="price-cell">+${{ scope.row.price }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="120" label="渠道">
            <template slot-scope="scope">
              <el-tag v-if="(scope.row.channels || []).indexOf('pos') >= 0" size="mini" type="success" style="margin-right: 2px;">POS</el-tag>
              <el-tag v-if="(scope.row.channels || []).indexOf('qr') >= 0" size="mini" type="warning">QR</el-tag>
              <span v-if="!(scope.row.channels || []).length">全部</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="80" label="必選">
            <template slot-scope="scope">
              <el-tag v-if="scope.row.mandatory" size="mini" type="danger">QR必選</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="100" label="站別">
            <template slot-scope="scope">{{ scope.row.station || '-' }}</template>
          </el-table-column>
          <el-table-column align="center" width="80" label="快捷鍵">
            <template slot-scope="scope">{{ scope.row.quickKey || '-' }}</template>
          </el-table-column>
          <el-table-column align="center" prop="sort" width="60" label="編號"></el-table-column>
          <el-table-column align="center" width="70" label="拖曳排序">
            <template slot-scope="scope">
              <i class="el-icon-rank drag-handle" draggable="true" @dragstart="dragStart($event, scope.row)" @dragover="dragOver" @drop="dropMod($event, scope.row)"></i>
            </template>
          </el-table-column>
          <el-table-column align="center" width="110" label="操作">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="openEditMod(scope.row)">編輯</el-button>
              <el-button type="text" size="small" @click="del(scope.row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 添加/編輯改碼 -->
    <el-dialog :title="editDialog.mode === 'add' ? '添加改碼' : '編輯改碼'" :visible.sync="editDialog.show" width="480px" append-to-body>
      <el-form label-width="90px" size="small">
        <el-form-item label="名稱">
          <el-input v-model="editDialog.form.name"></el-input>
        </el-form-item>
        <el-form-item label="改碼編號">
          <el-input v-model="editDialog.form.code" placeholder="如 M001" style="width: 160px;"></el-input>
        </el-form-item>
        <el-form-item label="改碼類別">
          <el-select v-model="editDialog.form.category" style="width: 100%;">
            <el-option v-for="c in categories" :key="c._id" :label="(c.code ? c.code + ' ' : '') + c.name" :value="c.name"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="價格1">
          <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
            <el-input-number v-model="editDialog.form.price" :min="0" :precision="1" :step="0.5" controls-position="right" style="flex: 0 0 auto;"></el-input-number>
            <el-button size="mini" type="success" plain @click="fillAllMod">填滿</el-button>
          </div>
        </el-form-item>
        <el-form-item v-for="n in 9" :key="n" :label="'價格' + (n + 1)">
          <el-input type="number" v-model.number="editDialog.form.specs[n].price" autocomplete="off" placeholder="留空則按價格1"></el-input>
        </el-form-item>
        <el-form-item label="渠道開關">
          <el-checkbox-group v-model="editDialog.form.channels">
            <el-checkbox label="pos">POS 收銀</el-checkbox>
            <el-checkbox label="qr">QR 手機</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="QR 必選">
          <el-switch v-model="editDialog.form.mandatory"></el-switch>
          <span class="tip">（如 公仔麵/米粉 二選一）</span>
        </el-form-item>
        <el-form-item label="最多可選">
          <el-input-number v-model="editDialog.form.maxSelect" :min="1" controls-position="right" style="width: 140px;"></el-input-number>
          <span class="tip">1=單選，2+=可複選</span>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="editDialog.form.sort" :min="0" controls-position="right" style="width: 140px;"></el-input-number>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button size="small" @click="editDialog.show = false">取 消</el-button>
        <el-button size="small" type="primary" @click="saveMod">儲 存</el-button>
      </div>
    </el-dialog>

    <!-- 添加改碼類別 -->
    <el-dialog title="添加改碼類別" :visible.sync="catAddDialog.show" width="380px" append-to-body>
      <el-form label-width="80px" size="small">
        <el-form-item label="類別名稱">
          <el-input v-model="catAddDialog.name" placeholder="如 甜度與冰量"></el-input>
        </el-form-item>
        <el-form-item label="類別編號">
          <el-input v-model="catAddDialog.code" placeholder="如 MC01" style="width: 160px;"></el-input>
        </el-form-item>
        <el-form-item label="自動彈出">
          <el-switch v-model="catAddDialog.mandatory"></el-switch>
          <span class="tip">點選貨品時自動彈出此類別改碼選擇</span>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button size="small" @click="catAddDialog.show = false">取 消</el-button>
        <el-button size="small" type="primary" @click="saveCatAdd">儲 存</el-button>
      </div>
    </el-dialog>

    <!-- 編輯改碼類別 -->
    <el-dialog title="編輯改碼類別" :visible.sync="catEditDialog.show" width="380px" append-to-body>
      <el-form label-width="80px" size="small">
        <el-form-item label="類別名稱">
          <el-input v-model="catEditDialog.name"></el-input>
        </el-form-item>
        <el-form-item label="類別編號">
          <el-input v-model="catEditDialog.code" placeholder="如 MC01" style="width: 160px;"></el-input>
        </el-form-item>
        <el-form-item label="自動彈出">
          <el-switch v-model="catEditDialog.mandatory"></el-switch>
          <span class="tip">點選貨品時自動彈出此類別改碼選擇</span>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button size="small" @click="catEditDialog.show = false">取 消</el-button>
        <el-button size="small" type="primary" @click="saveCatEdit">儲 存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
function makeSpecs (existing) {
  const arr = []
  for (let i = 0; i < 10; i++) {
    const prev = (Array.isArray(existing) && existing[i]) ? existing[i] : {}
    const raw = prev.price
    arr.push({
      name: '價格' + (i + 1),
      price: (raw === '' || raw == null) ? '' : raw
    })
  }
  return arr
}

export default {
  name: 'modcode',
  data () {
    return {
      search: '',
      modSearch: '',
      locateSearch: '',
      newCategoryName: '',
      newCategoryCode: '',
      list: [],
      categories: [],
      selectedId: null,
      selectedCategory: null,
      tableHeight: window.innerHeight - 260,
      editDialog: {
        show: false,
        mode: 'add',
        form: {
          specs: makeSpecs()
        }
      },
      catEditDialog: {
        show: false,
        _id: '',
        name: '',
        code: '',
        mandatory: false
      },
      catAddDialog: {
        show: false,
        name: '',
        code: '',
        mandatory: false
      }
    }
  },
  computed: {
    filteredCategories: function () {
      var kw = this.search.trim().toLowerCase()
      if (!kw) return this.categories
      return this.categories.filter(function (c) {
        return c.name.toLowerCase().indexOf(kw) >= 0 || (c.code && c.code.toLowerCase().indexOf(kw) >= 0)
      })
    },
    filteredList: function () {
      var base = this.list
      if (this.selectedCategory) {
        var name = this.selectedCategory.name
        base = this.list.filter(function (m) { return m.category === name })
      }
      var kw = (this.modSearch || '').trim().toLowerCase()
      if (!kw) return base
      return base.filter(function (m) {
        return (m.name || '').toLowerCase().indexOf(kw) >= 0 ||
               (m.code || '').toLowerCase().indexOf(kw) >= 0
      })
    }
  },
  methods: {
    catCode (categoryName) {
      const found = this.categories.find(c => c.name === categoryName)
      return found && found.code ? found.code : ''
    },
    loadData () {
      this.$axios.get('/api/modcode/all')
        .then(res => { this.list = res.data || [] })
        .catch(err => console.log(err))
      this.loadCategories()
    },
    loadCategories () {
      this.$axios.get('/api/modcode/categories')
        .then(res => {
          this.categories = res.data || []
          // 保持選中狀態（類別重新載入後按 _id 同步）
          if (this.selectedCategory) {
            const found = this.categories.find(c => c._id === this.selectedCategory._id)
            this.selectedCategory = found || this.selectedCategory
            if (found) this.selectedId = found._id
          }
        })
        .catch(err => console.log(err))
    },
    selectCategory (c) {
      this.selectedCategory = c
      this.selectedId = c ? c._id : null
    },
    modCountByCategory (catName) {
      return this.list.filter(function (m) { return m.category === catName }).length
    },
    queryModCodes (queryString, cb) {
      var q = (queryString || '').trim().toLowerCase()
      var matches = this.list.filter(function (m) {
        return !q ||
          (m.code && String(m.code).toLowerCase().indexOf(q) >= 0) ||
          (m.name && m.name.toLowerCase().indexOf(q) >= 0)
      }).slice(0, 20)
      cb(matches.map(function (m) {
        return { value: (m.code ? m.code + ' · ' : '') + m.name + '（' + m.category + '）', mod: m }
      }))
    },
    onModCodeSelect (item) {
      if (item && item.mod) this.locateModCategory(item.mod)
    },
    locateModCategory (mod) {
      var target = mod
      if (!target) {
        var q = (this.locateSearch || '').trim().toLowerCase()
        if (!q) return
        target = this.list.find(function (m) {
          return (m.code && String(m.code).toLowerCase() === q) ||
                 (m.name && m.name.toLowerCase() === q)
        })
        if (!target) {
          target = this.list.find(function (m) {
            return (m.code && String(m.code).toLowerCase().indexOf(q) >= 0) ||
                   (m.name && m.name.toLowerCase().indexOf(q) >= 0)
          })
        }
      }
      if (!target) {
        this.$message({ type: 'warning', message: '找不到此改碼' })
        return
      }
      var cat = this.categories.find(function (c) { return c.name === target.category })
      if (!cat) {
        this.$message({ type: 'warning', message: '找不到此改碼的所屬分類' })
        return
      }
      this.search = ''
      this.selectCategory(cat)
    },
    addCategory () {
      const name = this.newCategoryName.trim()
      if (!name) return
      this.$axios.post('/api/modcode/category/add', { name, code: this.newCategoryCode.trim() })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.newCategoryName = ''
          this.newCategoryCode = ''
          this.loadCategories()
        })
        .catch(err => this.$message.error((err.response && err.response.data) || '添加失敗'))
    },
    openCatEdit (c) {
      this.catEditDialog = { show: true, _id: c._id, name: c.name, code: c.code || '', mandatory: !!c.mandatory }
    },
    openAddCategory () {
      this.catAddDialog = { show: true, name: '', code: '', mandatory: false }
    },
    saveCatAdd () {
      const name = this.catAddDialog.name.trim()
      if (!name) {
        this.$message({ type: 'warning', message: '類別名稱不能為空' })
        return
      }
      this.$axios.post('/api/modcode/category/add', { name, code: this.catAddDialog.code.trim(), mandatory: this.catAddDialog.mandatory })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.catAddDialog.show = false
          this.loadCategories()
        })
        .catch(err => this.$message.error((err.response && err.response.data) || '添加失敗'))
    },
    saveCatEdit () {
      this.$axios.post('/api/modcode/category/update', { _id: this.catEditDialog._id, name: this.catEditDialog.name, code: this.catEditDialog.code, mandatory: this.catEditDialog.mandatory })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.catEditDialog.show = false
          this.loadCategories()
        })
        .catch(err => this.$message.error((err.response && err.response.data) || '更新失敗'))
    },
    delCategory (c) {
      const count = this.modCountByCategory(c.name)
      if (count > 0) {
        this.$message({ type: 'warning', message: '此類別下仍有 ' + count + ' 個改碼，請先移除或改類別' })
        return
      }
      this.$confirm(`確認刪除類別「${c.name}」？`)
        .then(_ => {
          this.$axios.post('/api/modcode/category/del', { _id: c._id })
            .then(res => {
              this.$message({ type: 'success', message: res.data })
              if (this.selectedCategory && this.selectedCategory._id === c._id) {
                this.selectedCategory = null
                this.selectedId = null
              }
              this.loadCategories()
            })
            .catch(err => this.$message.error((err.response && err.response.data) || '刪除失敗'))
        })
        .catch(_ => {})
    },
    emptyForm () {
      return {
        name: '',
        code: '',
        category: this.selectedCategory ? this.selectedCategory.name : '',
        price: 0,
        specs: makeSpecs(),
        channels: ['pos', 'qr'],
        mandatory: false,
        maxSelect: 1,
        station: '',
        quickKey: '',
        sort: this.list.length
      }
    },
    openAddMod () {
      this.editDialog.mode = 'add'
      this.editDialog.form = this.emptyForm()
      this.editDialog.show = true
    },
    openEditMod (row) {
      this.editDialog.mode = 'edit'
      this.editDialog.form = {
        _id: row._id,
        name: row.name,
        code: row.code || '',
        category: row.category,
        price: row.price || 0,
        specs: makeSpecs(row.specs),
        channels: (row.channels && row.channels.length) ? row.channels.slice() : ['pos', 'qr'],
        mandatory: !!row.mandatory,
        maxSelect: row.maxSelect || 1,
        station: row.station || '',
        quickKey: row.quickKey || '',
        sort: row.sort || 0
      }
      this.editDialog.show = true
    },
    fillAllMod () {
      const p1 = this.editDialog.form.price
      if (p1 === '' || p1 == null) {
        this.$message({ type: 'warning', message: '請先填寫價格1' })
        return
      }
      const specs = Array.isArray(this.editDialog.form.specs) ? this.editDialog.form.specs.slice(0, 10) : []
      while (specs.length < 10) specs.push({ name: '價格' + (specs.length + 1), price: '' })
      for (let i = 1; i < 10; i++) {
        specs[i] = { name: '價格' + (i + 1), price: Number(p1) }
      }
      this.editDialog.form.specs = specs
      this.$message({ type: 'success', message: '已填滿價格2～10' })
    },
    saveMod () {
      const form = this.editDialog.form
      if (!form.name) {
        this.$message({ type: 'warning', message: '改碼名稱不能為空' })
        return
      }
      if (!form.category) {
        this.$message({ type: 'warning', message: '請先選擇改碼類別' })
        return
      }
      // 固定 10 筆價格（價格1～價格10），價格1＝主價格，空值存 ''
      const p1 = (form.price === '' || form.price == null) ? 0 : Number(form.price)
      form.price = isNaN(p1) ? 0 : p1
      const specs = []
      for (let i = 0; i < 10; i++) {
        const prev = (form.specs && form.specs[i]) ? form.specs[i] : {}
        const raw = i === 0 ? form.price : prev.price
        specs.push({ name: '價格' + (i + 1), price: (raw === '' || raw == null) ? '' : Number(raw) })
      }
      form.specs = specs
      const url = this.editDialog.mode === 'add' ? '/api/modcode/add' : '/api/modcode/update'
      this.$axios.post(url, form)
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.editDialog.show = false
          this.loadData()
        })
        .catch(err => this.$message.error((err.response && err.response.data) || '儲存失敗'))
    },
    del (row) {
      this.$confirm(`確認刪除改碼「${row.name}」？`)
        .then(_ => {
          this.$axios.post('/api/modcode/del', { _id: row._id })
            .then(res => {
              this.$message({ type: 'success', message: res.data })
              this.loadData()
            })
            .catch(err => this.$message.error((err.response && err.response.data) || '刪除失敗'))
        })
        .catch(_ => {})
    },
    // 拖曳排序（操作全量 list，按 _id 匹配）
    dragStart (event, row) { event.dataTransfer.setData('modcodeId', row._id) },
    dragOver (event) { event.preventDefault() },
    dropMod (event, target) {
      const sourceId = event.dataTransfer.getData('modcodeId')
      const reordered = this.list.slice()
      const sourceIndex = reordered.findIndex(item => item._id === sourceId)
      const targetIndex = reordered.findIndex(item => item._id === target._id)
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return
      const source = reordered.splice(sourceIndex, 1)[0]
      reordered.splice(targetIndex, 0, source)
      this.list = reordered
      this.$axios.post('/api/modcode/reorder', { ids: reordered.map(item => item._id) })
        .catch(() => { this.$message({ type: 'error', message: '排序更新失敗' }); this.loadData() })
    },
    initDefaults () {
      const groups = [
        { category: '甜度與冰量（水吧專用）', items: ['走冰', '少冰', '去冰', '微糖', '半糖', '少糖', '走糖'] },
        { category: '辣度選擇（川湘菜/熱炒）', items: ['不辣', '微辣', '小辣', '中辣', '大辣', '麻辣'] },
        { category: '油鹽與配料（鑊氣熱炒）', items: ['少油', '走油', '少鹽', '走鹽', '走味精（不放味精）'] }
      ]
      // 確保類別存在
      const catNames = this.categories.map(c => c.name)
      const chain = groups.reduce((p, g) => {
        return p.then(() => {
          if (catNames.indexOf(g.category) < 0) {
            return this.$axios.post('/api/modcode/category/add', { name: g.category })
          }
        })
      }, Promise.resolve())
      chain.then(() => this.loadCategories())
        .then(() => {
          const exists = this.list.map(x => `${x.category}|${x.name}`)
          const todo = []
          groups.forEach(g => {
            g.items.forEach(name => {
              if (exists.indexOf(`${g.category}|${name}`) < 0) todo.push({ name, category: g.category })
            })
          })
          const chain2 = todo.reduce((p, item, i) => {
            return p.then(() => this.$axios.post('/api/modcode/add', { name: item.name, category: item.category, price: 0, channels: ['pos', 'qr'], sort: this.list.length + i }))
          }, Promise.resolve())
          return chain2
        })
        .then(() => {
          this.$message({ type: 'success', message: '預設改碼已載入' })
          this.loadData()
        })
    }
  },
  created () {
    this.loadData()
    window.onresize = () => { this.tableHeight = window.innerHeight - 260 }
  }
}
</script>

<style scoped>
#modcode { height: 100%; }
.split-layout { display: flex; height: 100%; gap: 12px; }
.left-panel { width: 260px; min-width: 220px; flex-shrink: 0; display: flex; flex-direction: column; border: 1px solid #EBEEF5; border-radius: 6px; background: #fff; }
.left-toolbar { padding: 12px; border-bottom: 1px solid #EBEEF5; }
.add-cat-row { display: flex; gap: 6px; margin-top: 8px; align-items: center; }
.add-cat-row .el-button { flex-shrink: 0; }
.cat-scroll { flex: 1; overflow-y: auto; padding: 8px 0; }
.cat-node { display: flex; align-items: center; padding: 9px 12px; cursor: pointer; font-size: 13px; color: #303133; }
.cat-node:hover { background: #F5F7FA; }
.cat-node.active { background: #ECF5FF; color: #409EFF; }
.cat-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat-code { font-weight: 700; color: #409EFF; margin-right: 4px; }
.cat-mandatory { flex-shrink: 0; font-size: 10px; color: #fff; background: #E6A23C; border-radius: 3px; padding: 1px 4px; margin-left: 6px; }
.cat-count { flex-shrink: 0; font-size: 12px; color: #909399; margin-left: 6px; }
.cat-actions { display: none; flex-shrink: 0; margin-left: 4px; }
.cat-node:hover .cat-actions { display: inline-flex; }
.cat-actions .el-button { padding: 2px; margin-left: 1px; }
.right-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; border: 1px solid #EBEEF5; border-radius: 6px; background: #fff; padding: 16px; overflow: hidden; }
.content-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.breadcrumb { display: flex; align-items: center; font-size: 14px; }
.crumb-link { color: #409EFF; cursor: pointer; }
.crumb-link.current { color: #303133; font-weight: 600; cursor: default; }
.crumb-link:hover { text-decoration: underline; }
.crumb-sep { color: #c0c4cc; margin: 0 2px; }
.content-actions { display: flex; gap: 6px; }
.mod-info { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding: 8px 12px; background: #F5F7FA; border-radius: 4px; }
.mod-search-row { display: flex; align-items: center; margin-bottom: 10px; }
.info-text { font-size: 12px; color: #606266; }
.price-cell { color: #e6a23c; font-weight: bold; }
.tip { margin-left: 8px; color: #909399; font-size: 12px; }
.drag-handle { cursor: move; font-size: 16px; color: #909399; }
.drag-handle:hover { color: #409eff; }
.empty-tip { text-align: center; color: #c0c4cc; padding: 20px 0; font-size: 13px; }
.remove-btn { color: #F56C6C !important; }
</style>
