<template>
  <el-dialog :title="cashMoveDialog.type === 'paidOut' ? '代支（支出）' : '代收（收入）'" :visible.sync="cashMoveDialog.show" width="400px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <div class="cash-move">
      <label class="cm-label">金額</label>
      <number-pad :value="cashMoveDialog.amount" decimal @input="onAmount" @confirm="$emit('confirm')"></number-pad>
      <label class="cm-label" style="margin-top: 14px;">原因 / 備註</label>
      <el-input v-model="cashMoveDialog.reason" size="medium" placeholder="輸入原因（可留空）"></el-input>
    </div>
    <div slot="footer">
      <el-button @click="cashMoveDialog.show = false">取 消</el-button>
      <el-button :type="cashMoveDialog.type === 'paidOut' ? 'warning' : 'success'" :loading="cashMoveDialog.loading" @click="$emit('confirm')">確 定</el-button>
    </div>
  </el-dialog>
</template>

<script>
import NumberPad from './NumberPad.vue'

export default {
  name: 'cashMoveDialog',
  components: { NumberPad },
  props: {
    cashMoveDialog: { type: Object, required: true }
  },
  methods: {
    onAmount (v) {
      this.cashMoveDialog.amount = v
    }
  }
}
</script>

<style scoped>
.cm-label{ display: block; font-size: 13px; color: #606266; margin-bottom: 6px; }
</style>
