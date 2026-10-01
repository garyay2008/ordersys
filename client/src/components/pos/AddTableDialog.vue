<template>
  <el-dialog title="加枱" :visible.sync="addTableDialog.show" width="360px" custom-class="pos-dialog" append-to-body>
    <el-form label-width="80px" size="small">
      <el-form-item label="枱號">
        <span class="trans-src">{{ addTableDialog.no || '—' }}</span>
      </el-form-item>
      <el-form-item label="座位數">
        <el-input-number v-model="addTableDialog.seats" :min="1" :max="50"></el-input-number>
      </el-form-item>
      <el-form-item label="區域">
        <el-select v-model="addTableDialog.zone" style="width: 100%;">
          <el-option label="堂食" value="堂食"></el-option>
          <el-option label="外賣" value="外賣"></el-option>
        </el-select>
      </el-form-item>
    </el-form>
    <div class="pad-wrap">
      <number-pad :value="addTableDialog.padValue" @input="$emit('input', $event)" @confirm="$emit('confirm')" letters></number-pad>
    </div>
    <div slot="footer">
      <el-button @click="addTableDialog.show = false">取 消</el-button>
      <el-button type="primary" @click="$emit('confirm')">確 定</el-button>
    </div>
  </el-dialog>
</template>

<script>
import NumberPad from './NumberPad'

export default {
  name: 'addTableDialog',
  components: { NumberPad },
  props: {
    addTableDialog: { type: Object, required: true }
  }
}
</script>

<style scoped>
.trans-src{ font-size: 20px; font-weight: bold; color: #409eff; }
.pad-wrap{ display: flex; justify-content: center; margin: 6px 0; }
</style>
