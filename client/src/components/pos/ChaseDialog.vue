<template>
  <el-dialog title="追單" :visible.sync="chaseDialog.show" width="560px" top="0vh" custom-class="table-op-dialog pos-dialog" append-to-body :close-on-click-modal="false">
    <div v-if="chaseDialog.items.length === 0" style="padding:20px; text-align:center; color:#909399; font-size:20px;">沒有可追單的品項</div>
    <div v-else style="max-height:500px; overflow:auto;">
      <el-checkbox-group v-model="chaseDialog.checked" class="chase-item-group">
        <div v-for="(item, idx) in chaseDialog.items" :key="idx" style="padding:10px 0; border-bottom:1px solid #f0f0f0;">
          <el-checkbox :label="idx">{{ item.name || '品項' }} × {{ item.count || 1 }}</el-checkbox>
        </div>
      </el-checkbox-group>
    </div>
    <div slot="footer">
      <el-button size="medium" @click="chaseDialog.show = false">取消</el-button>
      <el-button type="primary" size="medium" :loading="chaseDialog.loading" :disabled="!chaseDialog.checked.length" @click="$emit('confirm')">追單出單</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'chaseDialog',
  props: {
    chaseDialog: { type: Object, required: true }
  }
}
</script>

<style scoped>
.chase-item-group .el-checkbox{ display: flex; align-items: center; margin-right: 0; }
.chase-item-group .el-checkbox .el-checkbox__label{ font-size: 52px; }
.chase-item-group .el-checkbox .el-checkbox__inner{ width: 50px; height: 50px; }
.chase-item-group .el-checkbox .el-checkbox__inner::after{ height: 25px; width: 10px; left: 16px; top: 5px; }
</style>
