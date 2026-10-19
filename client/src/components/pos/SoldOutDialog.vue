<template>
  <div>
    <!-- 沽清設定（售罄清單） -->
    <el-dialog title="沽清設定（售罄清單）" :visible.sync="soldOutDialog.show" width="680px" custom-class="pos-dialog" append-to-body>
      <div class="soldout-header">
        <el-button type="primary" size="small" @click="soldOutDialog.showItemPicker = true">＋ 新增項目</el-button>
        <el-input v-model="soldOutDialog.keyword" placeholder="PLU / item code / 品項名 搜尋" size="small" style="width: 220px; margin-left: 12px;" clearable></el-input>
      </div>
      <div class="soldout-tip">
        <el-alert type="info" :closable="false" show-icon>
          <template slot="title">
            點選「刪除」按鈕，即可從售罄清單中移除商品。
          </template>
        </el-alert>
      </div>
      <el-table :data="soldOutFiltered" size="mini" :max-height="380" :row-class-name="soldOutRowClass">
        <el-table-column prop="plu" label="PLU" width="90"></el-table-column>
        <el-table-column prop="name" label="品項" min-width="150"></el-table-column>
        <el-table-column label="狀態" width="80">
          <template slot-scope="scope">
            <el-tag :type="scope.row.soldOut ? 'info' : 'success'" size="mini">{{ scope.row.soldOut ? '沽清' : '在售' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="限量庫存" width="170">
          <template slot-scope="scope">
            <template v-if="!scope.row._isCombo && !scope.row._isModCode">
              <el-input-number v-model="scope.row.stock" :min="-1" :max="9999" size="mini" style="width: 120px;" @change="setStock(scope.row)"></el-input-number>
              <span class="tip">-1=不限</span>
            </template>
            <span v-else class="tip">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template slot-scope="scope">
            <el-button type="text" size="mini" style="color: #f56c6c;" @click="removeFromSoldOut(scope.row)">刪除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!soldOutFiltered.length" class="empty" style="padding: 20px;">售罄清單暫無商品</div>
      <div slot="footer">
        <el-button @click="soldOutDialog.show = false">關 閉</el-button>
      </div>
    </el-dialog>

    <!-- 新增售罄項目選擇器 -->
    <el-dialog title="將商品加入售罄清單" :visible.sync="soldOutDialog.showItemPicker" width="600px" custom-class="pos-dialog" append-to-body>
      <div class="soldout-tip">
        <el-alert type="info" :closable="false" show-icon>
          <template slot="title">
            瀏覽在售商品／改碼，點擊將其加入售罄列表（可依 PLU / item code / 品項名搜尋）。
          </template>
        </el-alert>
      </div>
      <div class="plu-bar" style="margin-bottom: 8px;">
        <el-input v-model="soldOutDialog.pickerKeyword" placeholder="搜尋品項" size="small" style="width: 220px;" clearable></el-input>
      </div>
      <div class="soldout-picker-grid">
        <div v-for="food in soldOutPickerList" :key="food._id" class="soldout-picker-item" :class="{ 'is-soldout': food.soldOut }" @click="toggleSoldOutFromPicker(food)">
          <div class="spp-name">{{ food.name }}</div>
          <div class="spp-tag" v-if="food.soldOut">已售罄</div>
          <div class="spp-tag spp-tag-ok" v-else>在售</div>
        </div>
        <div v-if="!soldOutPickerList.length" class="empty" style="padding: 20px; grid-column: 1/-1;">暫無品項</div>
      </div>
      <div slot="footer">
        <el-button @click="soldOutDialog.showItemPicker = false">完 成</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'soldOutDialog',
  props: {
    soldOutDialog: { type: Object, required: true },
    goods: { type: Array, default: () => [] },
    modCodes: { type: Array, default: () => [] }
  },
  computed: {
    soldOutFiltered () {
      const kw = (this.soldOutDialog.keyword || '').trim().toLowerCase()
      const soldOut = this.soldOutDialog.list.filter(x => x.soldOut)
      if (!kw) return soldOut
      return soldOut.filter(x =>
        String(x.plu || '').toLowerCase().indexOf(kw) >= 0 ||
        String(x.code || '').toLowerCase().indexOf(kw) >= 0 ||
        String(x.name || '').toLowerCase().indexOf(kw) >= 0
      )
    },
    soldOutPickerList () {
      const kw = (this.soldOutDialog.pickerKeyword || '').trim().toLowerCase()
      const all = []
      const seen = new Set()
      this.goods.forEach(g => {
        (g.foods || []).forEach(f => {
          if (f.soldOut) return
          const key = String(f._id)
          if (seen.has(key)) return
          seen.add(key)
          all.push({ _id: f._id, name: f.name, plu: f.plu || f.code || '', code: f.code || '', soldOut: false, stock: f.stock === undefined || f.stock === null ? -1 : f.stock, _isCombo: !!f._isCombo, _isModCode: !!f._isModCode })
        })
      })
      ;(this.modCodes || []).forEach(m => {
        if (m.soldOut) return
        const key = String(m._id)
        if (seen.has(key)) return
        seen.add(key)
        all.push({ _id: m._id, name: m.name, plu: m.code || '', code: m.code || '', soldOut: false, stock: -1, _isCombo: false, _isModCode: true })
      })
      if (!kw) return all
      return all.filter(x => String(x.name || '').toLowerCase().indexOf(kw) >= 0 || String(x.plu || '').toLowerCase().indexOf(kw) >= 0 || String(x.code || '').toLowerCase().indexOf(kw) >= 0)
    }
  },
  methods: {
    soldOutRowClass ({ row }) {
      return row.soldOut ? 'soldout-highlight' : ''
    },
    soldOutEndpoint (row) {
      if (row._isCombo) return '/api/combo/soldout'
      if (row._isModCode) return '/api/modcode/soldout'
      return '/api/commodity/soldout'
    },
    toggleSoldOutFromPicker (food) {
      this.$axios.post(this.soldOutEndpoint(food), { _id: food._id, soldOut: !food.soldOut })
        .then(() => {
          food.soldOut = !food.soldOut
          this.$message({ type: 'success', message: food.soldOut ? `「${food.name}」已加入售罄清單` : `「${food.name}」已從售罄清單移除` })
          this.syncSoldOutToFood(food)
          // 同步更新左側清單
          const row = this.soldOutDialog.list.find(x => String(x._id) === String(food._id))
          if (row) {
            this.$set(row, 'soldOut', food.soldOut)
          } else if (food.soldOut) {
            this.soldOutDialog.list.push({ _id: food._id, plu: food.plu || food.code || '', code: food.code || '', name: food.name, soldOut: true, stock: food.stock === undefined || food.stock === null ? -1 : food.stock, _isCombo: !!food._isCombo, _isModCode: !!food._isModCode })
          }
          this.$emit('change', food)
        })
        .catch(() => this.$message({ type: 'error', message: '更新失敗' }))
    },
    removeFromSoldOut (row) {
      this.$axios.post(this.soldOutEndpoint(row), { _id: row._id, soldOut: false })
        .then(() => {
          row.soldOut = false
          this.$message({ type: 'success', message: `「${row.name}」已從售罄清單移除` })
          this.syncSoldOutToFood(row)
        })
        .catch(() => this.$message({ type: 'error', message: '更新失敗' }))
    },
    setStock (row) {
      this.$axios.post(this.soldOutEndpoint(row), { _id: row._id, stock: row.stock })
        .then(() => {
          // 前端同步：庫存 ≤ 0 自動沽清，> 0 自動重售（與後端邏輯一致）
          if (row.stock <= 0) {
            row.soldOut = true
            this.$message({ type: 'success', message: '限量庫存已歸零，已自動沽清' })
          } else if (row.soldOut) {
            row.soldOut = false
            this.$message({ type: 'success', message: '限量庫存已更新，已自動重售' })
          } else {
            this.$message({ type: 'success', message: '限量庫存已更新' })
          }
          this.syncSoldOutToFood(row)
        })
        .catch(() => this.$message({ type: 'error', message: '更新失敗' }))
    },
    syncSoldOutToFood (row) {
      this.goods.forEach(g => {
        const f = (g.foods || []).find(x => x._id === row._id)
        if (f) {
          this.$set(f, 'soldOut', row.soldOut)
          this.$set(f, 'stock', row.stock)
        }
      })
    }
  }
}
</script>

<style scoped>
.plu-bar{ display: flex; gap: 8px; margin-bottom: 10px; }
.plu-bar .el-input__inner{ border-radius: 8px; }
.spp-name{ font-size: 13px; font-weight: bold; margin-bottom: 4px; }
.spp-tag{ font-size: 11px; color: #67c23a; }
.spp-tag-ok{ color: #67c23a; }
.soldout-header{ display: flex; align-items: center; margin-bottom: 8px; }
.soldout-tip{ margin-bottom: 10px; }
.soldout-highlight{ background: #f5f5f5 !important; opacity: 0.65; }
.soldout-picker-grid{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; max-height: 400px; overflow: auto; }
.soldout-picker-item{ height: 72px; border: 1px solid #dcdfe6; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; }
.soldout-picker-item:hover{ border-color: #409eff; box-shadow: 0 2px 8px rgba(64,158,255,.2); }
.soldout-picker-item.is-soldout{ background: #f5f7fa; opacity: 0.55; }
</style>
