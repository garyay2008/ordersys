<template>
  <el-dialog :title="title" :visible.sync="visibleProxy" :width="width" custom-class="pos-dialog" append-to-body :close-on-click-modal="closeOnClickModal">
    <number-pad :value="value" :letters="letters" :decimal="decimal" @input="$emit('input', $event)" @confirm="$emit('confirm')"></number-pad>
    <div v-if="hint" class="pad-hint">{{ hint }}</div>
  </el-dialog>
</template>

<script>
import NumberPad from './NumberPad.vue'

export default {
  name: 'keypadDialog',
  components: { NumberPad },
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '' },
    value: { type: String, default: '' },
    letters: { type: Boolean, default: false },
    decimal: { type: Boolean, default: false },
    hint: { type: String, default: '' },
    width: { type: String, default: '300px' },
    closeOnClickModal: { type: Boolean, default: false }
  },
  computed: {
    visibleProxy: {
      get () { return this.visible },
      set (v) { this.$emit('update:visible', v) }
    }
  }
}
</script>

<style scoped>
.pad-hint{ text-align: center; font-size: 12px; color: #909399; margin-top: 6px; }
</style>
