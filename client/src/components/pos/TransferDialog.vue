<template>
  <el-dialog title="轉枱" :visible.sync="transferDialog.show" width="420px" top="0vh" custom-class="table-op-dialog pos-dialog" append-to-body>
    <el-form label-width="90px" size="small">
      <el-form-item label="來源枱號">
        <span class="trans-src">{{ transferDialog.from }}</span>
      </el-form-item>
      <el-form-item label="移至枱號">
        <span class="trans-src">{{ transferDialog.toTable || '—' }}</span>
      </el-form-item>
    </el-form>
    <div class="pad-wrap">
      <number-pad :value="transferDialog.padValue" @input="$emit('input', $event)" @confirm="$emit('confirm')" letters></number-pad>
    </div>
    <div class="pad-hint">可用枱號：{{ tableHint }}</div>
  </el-dialog>
</template>

<script>
import NumberPad from './NumberPad'

export default {
  name: 'transferDialog',
  components: { NumberPad },
  props: {
    transferDialog: { type: Object, required: true },
    tableHint: { type: String, default: '' }
  }
}
</script>

<style scoped>
.trans-src{ font-size: 20px; font-weight: bold; color: #409eff; }
.pad-wrap{ display: flex; justify-content: center; margin: 6px 0; }
.pad-hint{ text-align: center; font-size: 12px; color: #909399; margin-top: 6px; }
</style>
