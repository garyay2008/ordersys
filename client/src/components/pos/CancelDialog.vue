<template>
  <el-dialog :title="cancelDialog.index === -1 ? '整單取消授權' : '取消已落單品項授權'" :visible.sync="cancelDialog.show" width="400px" top="0vh" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <el-form label-width="90px" size="small">
      <el-form-item label="經理編號">
        <el-input v-model="cancelDialog.managerNo" placeholder="經理員工編號"></el-input>
      </el-form-item>
      <el-form-item label="經理密碼">
        <el-input v-model="cancelDialog.managerPwd" type="password" placeholder="密碼" show-password @keyup.enter.native="$emit('confirm')"></el-input>
      </el-form-item>
      <el-form-item label="取消原因">
        <el-checkbox-group v-model="cancelDialog.reasons" class="cancel-reason-group">
          <el-checkbox v-for="r in cancelReasons" :key="r" :label="r">{{ r }}</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </el-form>
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
  }
}
</script>

<style scoped>
.cancel-reason-group .el-checkbox{ display: flex; align-items: center; margin-right: 0; margin-bottom: 6px; }
.cancel-reason-group .el-checkbox .el-checkbox__label{ font-size: 30px; }
.cancel-reason-group .el-checkbox .el-checkbox__inner{ width: 35px; height: 35px; }
.cancel-reason-group .el-checkbox .el-checkbox__inner::after{ height: 17px; width: 8px; left: 12px; top: 4px; }
</style>
