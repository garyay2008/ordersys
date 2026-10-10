<template>
  <el-dialog :title="cancelDialog.index === -1 ? '整單取消授權' : '取消已落單品項授權'" :visible.sync="cancelDialog.show" width="460px" top="0vh" custom-class="pos-dialog cancel-dialog" append-to-body :close-on-click-modal="false">
    <div class="cancel-banner" v-if="cancelDialog.index === -1">
      <i class="el-icon-warning-outline"></i>
      <span>整單取消將退回整張訂單，請確認授權身份及取消原因</span>
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

    <div class="manager-auth">
      <div class="reason-label">經理授權</div>
      <div class="manager-fields">
        <el-input v-model="cancelDialog.managerNo" placeholder="經理編號" size="small" clearable></el-input>
        <el-input v-model="cancelDialog.managerPwd" type="password" placeholder="經理密碼" size="small" show-password @keyup.enter.native="$emit('confirm')"></el-input>
      </div>
    </div>

    <div slot="footer">
      <el-button @click="cancelDialog.show = false">取 消</el-button>
      <el-button type="danger" :loading="cancelDialog.loading" @click="$emit('confirm')">確認取消</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'cancelDialog',
  props: {
    cancelDialog: { type: Object, required: true },
    cancelReasons: { type: Array, default: () => [] }
  },
  methods: {
    isReasonOn (r) {
      return (this.cancelDialog.reasons || []).indexOf(r) >= 0
    },
    toggleReason (r) {
      const reasons = this.cancelDialog.reasons || []
      const idx = reasons.indexOf(r)
      if (idx >= 0) reasons.splice(idx, 1)
      else reasons.push(r)
    }
  }
}
</script>

<style scoped>
.cancel-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  color: #f56c6c;
  font-size: 13px;
  line-height: 1.5;
}
.cancel-banner i {
  font-size: 20px;
  flex-shrink: 0;
}

.cancel-reasons{ padding: 0 12px; }
.reason-label{ font-size: 13px; font-weight: 700; color: #606266; margin-bottom: 6px; }
.reason-btns{ display: flex; flex-wrap: wrap; gap: 8px; }

.manager-auth{ margin-top: 14px; padding: 0 12px; }
.manager-fields{ display: flex; gap: 8px; }
.manager-fields .el-input{ flex: 1; }
</style>
