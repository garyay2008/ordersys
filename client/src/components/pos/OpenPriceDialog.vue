<template>
  <el-dialog :title="title" :visible.sync="visibleProxy" width="360px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <div class="opd-body">
      <label class="opd-label">品名（手寫）</label>
      <div class="opd-name-row">
        <el-input v-model="name" size="medium" readonly placeholder="點此或按「手寫」開啟手寫板" @click.native="openPad"></el-input>
        <el-button size="medium" icon="el-icon-edit-outline" @click="openPad">手寫</el-button>
      </div>
      <label class="opd-label">金額（浮動價格）</label>
      <number-pad :value="price" :decimal="true" confirm-label="加 入" @input="price = $event" @confirm="submit"></number-pad>
    </div>
    <div slot="footer">
      <el-button @click="close">取 消</el-button>
    </div>
    <handwriting-pad :visible.sync="hwVisible" :initial-text="name" @confirm="onHwConfirm"></handwriting-pad>
  </el-dialog>
</template>

<script>
import NumberPad from './NumberPad.vue'
import HandwritingPad from './HandwritingPad.vue'

export default {
  name: 'openPriceDialog',
  components: { NumberPad, HandwritingPad },
  props: {
    visible: { type: Boolean, default: false },
    item: { type: Object, default: null }
  },
  data () {
    return {
      name: '',
      price: '',
      hwVisible: false
    }
  },
  computed: {
    title () {
      return '浮動價格 · ' + ((this.item && this.item.name) || '手寫單')
    },
    visibleProxy: {
      get () { return this.visible },
      set (v) { this.$emit('update:visible', v) }
    }
  },
  watch: {
    visible (v) {
      if (v) {
        this.name = (this.item && this.item.name) || ''
        this.price = (this.item && this.item.price) ? String(this.item.price) : ''
      }
    }
  },
  methods: {
    openPad () {
      this.hwVisible = true
    },
    onHwConfirm (text) {
      this.name = (text || '').trim()
    },
    close () {
      this.$emit('update:visible', false)
    },
    submit () {
      const price = Number(this.price)
      if (!price || price <= 0) {
        this.$message({ type: 'warning', message: '請輸入金額' })
        return
      }
      const name = (this.name || '').trim() || ((this.item && this.item.name) || '手寫單')
      this.$emit('confirm', { name, price: Math.round(price * 100) / 100 })
      this.close()
    }
  }
}
</script>

<style scoped>
.opd-label{ display: block; font-size: 13px; color: #606266; margin: 8px 0 6px; }
.opd-name-row{ display: flex; gap: 8px; }
.opd-name-row .el-input{ flex: 1; }
</style>
