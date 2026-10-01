<template>
  <el-dialog title="更改付款" :visible.sync="changePayDialog.show" width="360px" custom-class="pos-dialog" append-to-body>
    <div class="pay-total">訂單 {{ changePayDialog.orderNo }}<br/>金額：<span class="pay-num">${{ changePayDialog.totalPrice }}</span></div>
    <el-form label-width="90px" size="small" style="margin-top: 12px;">
      <el-form-item label="付款方式">
        <el-radio-group v-model="changePayDialog.payMethod">
          <el-radio v-for="m in payMethods" :key="m._id" :label="m.value">{{ m.value }}</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <div slot="footer">
      <el-button @click="changePayDialog.show = false">取 消</el-button>
      <el-button type="primary" @click="$emit('confirm')">確定並重印</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'changePayDialog',
  props: {
    changePayDialog: { type: Object, required: true },
    payMethods: { type: Array, default: () => [] }
  }
}
</script>

<style scoped>
.pay-total{ text-align: center; font-size: 16px; }
.pay-num{ color: #f01414; font-weight: bold; font-size: 28px; }
</style>
