<template>
  <el-dialog :title="'打柯單（班地厘訊息）'" :visible.sync="pantryDialog.show" width="420px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <div class="pantry">
      <label class="pn-label">訊息內容</label>
      <el-input
        v-model="pantryDialog.message"
        type="textarea"
        :rows="4"
        size="medium"
        placeholder="輸入要送到班地厘（出品部）的訊息，例如：5 號枱加單一碗白飯"
      ></el-input>
      <div class="pn-tip">訊息將打印到班地厘（廚房/出品部）打印機。</div>
    </div>
    <div slot="footer">
      <el-button @click="pantryDialog.show = false">取 消</el-button>
      <el-button type="primary" :loading="pantryDialog.loading" @click="$emit('confirm')">送 出</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'pantryDialog',
  props: {
    pantryDialog: { type: Object, required: true }
  }
}
</script>

<style scoped>
.pn-label{ display: block; font-size: 13px; color: #606266; margin-bottom: 6px; }
.pn-tip{ margin-top: 8px; font-size: 12px; color: #909399; }
</style>
