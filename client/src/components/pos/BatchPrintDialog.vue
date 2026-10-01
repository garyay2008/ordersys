<template>
  <el-dialog title="批量列印" :visible.sync="batchPrintDialog.show" width="420px" custom-class="pos-dialog" append-to-body>
    <div class="bp-hint">勾選要列印嘅枱（只有未印單嘅枱可以揀）：</div>
    <div class="bp-list">
      <div v-for="row in rows" :key="row.no" class="bp-row">
        <el-checkbox v-model="batchChecked[row.no]" :disabled="row.disabled">
          {{ row.label }} · {{ row.status }}<template v-if="row.amount > 0"> · ${{ row.amount }}</template>
        </el-checkbox>
      </div>
    </div>
    <div slot="footer">
      <el-button size="small" @click="batchPrintDialog.show = false">取消</el-button>
      <el-button size="small" type="primary" @click="$emit('confirm')">確認列印</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'batchPrintDialog',
  props: {
    batchPrintDialog: { type: Object, required: true },
    batchChecked: { type: Object, required: true },
    rows: { type: Array, default: () => [] }
  }
}
</script>
