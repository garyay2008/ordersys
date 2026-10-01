<template>
  <el-dialog title="項目折扣" :visible.sync="itemDiscountDialog.show" width="360px" top="0vh" custom-class="pos-dialog" append-to-body>
    <div class="top-cancel">
      <el-button type="danger" plain size="small" @click="$emit('clear')">取消折扣</el-button>
    </div>
    <el-form label-width="90px" size="small">
      <el-form-item label="折扣%">
        <el-input-number v-model="itemDiscountDialog.pct" :min="0" :max="100" @change="v => $emit('pct-change', v)" style="width: 140px;"></el-input-number> %
      </el-form-item>
      <el-form-item label="折扣金額">
        <el-input-number v-model="itemDiscountDialog.amount" :min="0" @change="v => $emit('amount-change', v)" style="width: 140px;"></el-input-number> 元
      </el-form-item>
      <el-form-item label="贈送"><el-switch v-model="itemDiscountDialog.free"></el-switch></el-form-item>
    </el-form>
    <div class="preset-row" v-if="percentOptions.length">
      <span class="preset-label">常用折扣：</span>
      <el-button v-for="d in percentOptions" :key="d.name" size="mini" @click="applyPreset(d)">{{ d.name }}</el-button>
    </div>
    <div slot="footer">
      <el-button @click="itemDiscountDialog.show = false">取 消</el-button>
      <el-button type="primary" @click="$emit('confirm')">確定（再選品項）</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'itemDiscountDialog',
  props: {
    itemDiscountDialog: { type: Object, required: true },
    discountOptions: { type: Array, default: () => [] }
  },
  computed: {
    percentOptions () {
      return (this.discountOptions || []).filter(d => d && d.type === 'percent')
    }
  },
  methods: {
    applyPreset (d) {
      if (d.type === 'percent') this.$emit('pct-change', d.value || 0)
      else this.$emit('amount-change', d.value || 0)
    }
  }
}
</script>

<style scoped>
.top-cancel{ text-align: right; margin-bottom: 8px; }
.preset-row{ margin: 8px 0 4px; text-align: center; }
.preset-label{ font-size: 12px; color: #909399; margin-right: 4px; }
.preset-row .el-button{ margin-left: 4px; margin-bottom: 4px; }
</style>
