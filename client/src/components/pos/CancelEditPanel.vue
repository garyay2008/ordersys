<template>
  <div class="cancel-edit-panel">
    <div class="ce-head">
      <span class="ce-title">退菜編輯（已送品項）</span>
      <el-button size="mini" icon="el-icon-close" circle @click="$emit('cancel')"></el-button>
    </div>

    <div class="ce-list">
      <div v-for="item in sentItems" :key="item.index" class="ce-row" :class="{ 'ce-row-sel': isSelected(item.index) }" @click="toggleSelect(item.index)">
        <div class="ce-check">
          <i v-if="isSelected(item.index)" class="el-icon-check"></i>
        </div>
        <div class="ce-info">
          <div class="ce-name">{{ item.index + 1 }}. {{ item.name }}<span v-if="item._modsText" class="ce-mods">（{{ item._modsText }}）</span></div>
          <div class="ce-price">${{ item._unitPrice }} × {{ item.count }} = ${{ item._subtotal }}</div>
        </div>
        <div v-if="isSelected(item.index)" class="ce-stepper" @click.stop>
          <el-button size="mini" circle icon="el-icon-minus" class="qty-btn" @click="decrement(item)"></el-button>
          <span class="ce-qty">退 {{ qtyOf(item.index) }}</span>
          <el-button size="mini" circle icon="el-icon-plus" class="qty-btn" @click="increment(item)"></el-button>
          <el-button size="mini" type="danger" plain class="qty-all" @click="cancelAllOf(item)">全退</el-button>
        </div>
      </div>
      <div v-if="!sentItems.length" class="empty">沒有已送廚房的品項</div>
    </div>

    <div class="ce-reasons">
      <div class="ce-label">取消原因</div>
      <div class="ce-reason-btns">
        <el-button
          v-for="r in cancelReasons" :key="r"
          size="small"
          :type="isReasonOn(r) ? 'danger' : 'default'"
          :plain="!isReasonOn(r)"
          @click="toggleReason(r)"
        >{{ r }}</el-button>
      </div>
    </div>

    <div v-if="cancelEditMode.needsManager" class="ce-manager">
      <div class="ce-label">經理授權</div>
      <div class="ce-manager-fields">
        <el-input v-model="cancelEditMode.managerNo" placeholder="經理編號" size="small"></el-input>
        <el-input v-model="cancelEditMode.managerPwd" type="password" placeholder="經理密碼" size="small" show-password @keyup.enter.native="$emit('confirm')"></el-input>
      </div>
    </div>

    <div class="ce-footer">
      <el-button @click="$emit('cancel')">取 消</el-button>
      <el-button type="danger" :loading="cancelEditMode.loading" :disabled="!hasSelection" @click="$emit('confirm')">確認刪除</el-button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'cancelEditPanel',
  props: {
    cancelEditMode: { type: Object, required: true },
    cancelReasons: { type: Array, default: () => [] },
    sentItems: { type: Array, default: () => [] }
  },
  computed: {
    hasSelection () {
      const sel = this.cancelEditMode.selected || {}
      return Object.keys(sel).some(k => (sel[k] || 0) > 0)
    }
  },
  methods: {
    isSelected (index) {
      return (this.cancelEditMode.selected || {})[index] > 0
    },
    qtyOf (index) {
      return (this.cancelEditMode.selected || {})[index] || 0
    },
    toggleSelect (index) {
      const sel = this.cancelEditMode.selected || {}
      if (sel[index] > 0) {
        this.$delete(sel, index)
      } else {
        this.$set(sel, index, 1)
      }
    },
    decrement (item) {
      const sel = this.cancelEditMode.selected || {}
      const v = Math.max(0, (sel[item.index] || 0) - 1)
      if (v <= 0) this.$delete(sel, item.index)
      else this.$set(sel, item.index, v)
    },
    increment (item) {
      const sel = this.cancelEditMode.selected || {}
      this.$set(sel, item.index, Math.min(item.count || 1, (sel[item.index] || 0) + 1))
    },
    cancelAllOf (item) {
      const sel = this.cancelEditMode.selected || {}
      this.$set(sel, item.index, item.count || 1)
    },
    isReasonOn (r) {
      return (this.cancelEditMode.reasons || []).indexOf(r) >= 0
    },
    toggleReason (r) {
      const reasons = this.cancelEditMode.reasons || []
      const idx = reasons.indexOf(r)
      if (idx >= 0) reasons.splice(idx, 1)
      else reasons.push(r)
    }
  }
}
</script>

<style scoped>
.cancel-edit-panel{ display: flex; flex-direction: column; height: 100%; }
.ce-head{ display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 2px solid #f56c6c; }
.ce-title{ font-size: 15px; font-weight: 800; color: #f56c6c; }
.ce-list{ flex: 1; overflow-y: auto; }
.ce-row{ display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid #ebeef5; cursor: pointer; }
.ce-row.ce-row-sel{ background: #fdf3f3; }
.ce-check{ width: 22px; height: 22px; border: 2px solid #dcdfe6; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; flex-shrink: 0; }
.ce-row-sel .ce-check{ background: #f56c6c; border-color: #f56c6c; }
.ce-info{ flex: 1; min-width: 0; margin-left: 10px; }
.ce-name{ font-size: 14px; color: #303133; }
.ce-mods{ font-size: 12px; color: #909399; }
.ce-price{ font-size: 12px; color: #c0c4cc; margin-top: 2px; }
.ce-stepper{ display: flex; align-items: center; gap: 6px; margin-left: 8px; }
.ce-qty{ font-size: 16px; font-weight: 800; min-width: 24px; text-align: center; }
.qty-all{ padding: 6px 8px; }
.ce-reasons{ padding: 10px 12px; border-top: 1px solid #ebeef5; }
.ce-label{ font-size: 13px; font-weight: 700; color: #606266; margin-bottom: 6px; }
.ce-reason-btns{ display: flex; flex-wrap: wrap; gap: 8px; }
.ce-manager{ padding: 0 12px 10px; }
.ce-manager-fields{ display: flex; gap: 8px; }
.ce-manager-fields .el-input{ flex: 1; }
.ce-footer{ display: flex; justify-content: flex-end; gap: 8px; padding: 10px 12px; border-top: 1px solid #ebeef5; }
.empty{ color: #c0c4cc; text-align: center; padding: 40px 0; }
</style>
