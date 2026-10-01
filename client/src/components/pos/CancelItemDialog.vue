<template>
  <el-dialog title="退菜（取消已送品項）" :visible.sync="cancelItemDialog.show" width="520px" top="0vh" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <div class="cancel-item-list">
      <div v-for="(item, idx) in cancelItemDialog.list" :key="idx" class="cancel-item-row" :class="{ 'cancel-item-zero': !item.cancelQty }">
        <div class="ci-info">
          <div class="ci-name">
            {{ item.name }}
            <span v-if="item._modsText" class="ci-mods">（{{ item._modsText }}）</span>
          </div>
          <div class="ci-price">${{ item._unitPrice }} × {{ item.count }} = ${{ item._subtotal }}</div>
        </div>
        <div class="ci-stepper">
          <el-button size="mini" circle icon="el-icon-minus" class="qty-btn" @click="decrement(item)"></el-button>
          <span class="ci-qty">退 {{ item.cancelQty }}</span>
          <el-button size="mini" circle icon="el-icon-plus" class="qty-btn" @click="increment(item)"></el-button>
          <el-button size="mini" type="danger" plain class="qty-all" @click="cancelAllOf(item)">全退</el-button>
        </div>
      </div>
      <div v-if="!cancelItemDialog.list.length" class="empty">沒有已送廚房的品項</div>
    </div>

    <div class="cancel-reasons">
      <div class="reason-label">取消原因</div>
      <div class="reason-btns">
        <el-button
          v-for="r in cancelReasons" :key="r"
          size="small"
          :type="isReasonOn(r) ? 'danger' : 'default'"
          :plain="!isReasonOn(r)"
          @click="toggleReason(r)"
        >{{ r }}</el-button>
      </div>
    </div>

    <div v-if="cancelItemDialog.needsManager" class="manager-auth">
      <div class="reason-label">經理授權</div>
      <div class="manager-fields">
        <el-input v-model="cancelItemDialog.managerNo" placeholder="經理編號" size="small"></el-input>
        <el-input v-model="cancelItemDialog.managerPwd" type="password" placeholder="經理密碼" size="small" show-password @keyup.enter.native="$emit('confirm')"></el-input>
      </div>
    </div>

    <div slot="footer">
      <el-button @click="cancelItemDialog.show = false">取 消</el-button>
      <el-button type="danger" :loading="cancelItemDialog.loading" :disabled="!hasSelection" @click="$emit('confirm')">確認退菜</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'cancelItemDialog',
  props: {
    cancelItemDialog: { type: Object, required: true },
    cancelReasons: { type: Array, default: () => [] }
  },
  computed: {
    hasSelection () {
      return (this.cancelItemDialog.list || []).some(i => (i.cancelQty || 0) > 0)
    }
  },
  methods: {
    decrement (item) {
      item.cancelQty = Math.max(0, (item.cancelQty || 0) - 1)
    },
    increment (item) {
      item.cancelQty = Math.min(item.count || 1, (item.cancelQty || 0) + 1)
    },
    cancelAllOf (item) {
      item.cancelQty = item.count || 1
    },
    isReasonOn (r) {
      return (this.cancelItemDialog.reasons || []).indexOf(r) >= 0
    },
    toggleReason (r) {
      const reasons = this.cancelItemDialog.reasons || []
      const idx = reasons.indexOf(r)
      if (idx >= 0) reasons.splice(idx, 1)
      else reasons.push(r)
    }
  }
}
</script>

<style scoped>
.cancel-item-list{ max-height: 260px; overflow-y: auto; }
.cancel-item-row{ display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #ebeef5; }
.cancel-item-row:last-child{ border-bottom: none; }
.cancel-item-row.cancel-item-zero{ opacity: .45; }
.ci-info{ flex: 1; min-width: 0; }
.ci-name{ font-size: 14px; color: #303133; }
.ci-mods{ font-size: 12px; color: #909399; }
.ci-price{ font-size: 12px; color: #c0c4cc; margin-top: 2px; }
.ci-stepper{ display: flex; align-items: center; gap: 8px; margin-left: 12px; }
.ci-qty{ font-size: 18px; font-weight: 800; min-width: 26px; text-align: center; }
.qty-all{ padding: 6px 8px; }
.cancel-reasons{ margin-top: 12px; padding: 0 12px; }
.reason-label{ font-size: 13px; font-weight: 700; color: #606266; margin-bottom: 6px; }
.reason-btns{ display: flex; flex-wrap: wrap; gap: 8px; }
.manager-auth{ margin-top: 12px; padding: 0 12px; }
.manager-fields{ display: flex; gap: 8px; }
.manager-fields .el-input{ flex: 1; }
.empty{ color: #c0c4cc; text-align: center; padding: 40px 0; }
</style>
