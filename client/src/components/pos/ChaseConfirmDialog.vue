<template>
  <el-dialog title="追單確認" :visible.sync="chaseConfirmDialog.show" width="420px" top="0vh" custom-class="table-op-dialog pos-dialog" append-to-body :close-on-click-modal="false">
    <div class="chase-confirm-body">
      <p>此單已於 <strong>{{ chaseConfirmDialog.lastChaseTime }}</strong> 追單</p>
      <p class="chase-confirm-q">現在需要追單？</p>
    </div>
    <div slot="footer">
      <el-button @click="chaseConfirmDialog.show = false">取消</el-button>
      <el-button type="danger" :loading="chaseConfirmDialog.loading" @click="$emit('confirm')">確認追單</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'chaseConfirmDialog',
  props: {
    chaseConfirmDialog: { type: Object, required: true }
  }
}
</script>

<style scoped>
.chase-confirm-body{ padding: 10px 4px; font-size: 16px; color: #303133; }
.chase-confirm-body strong{ color: #f56c6c; font-size: 18px; }
.chase-confirm-q{ margin-top: 8px; font-size: 16px; }
</style>
