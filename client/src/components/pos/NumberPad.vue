<template>
  <div class="number-pad">
    <div v-if="showScreen" class="np-screen"><span class="np-value">{{ masked ? maskText : value }}</span></div>
    <div class="np-keys">
      <div v-for="k in gridKeys" :key="k.id" class="np-key" :class="k.cls" @click="press(k.val)">{{ k.val }}</div>
    </div>
    <div class="np-bottom">
      <div class="np-key np-wide np-ok" @click="$emit('confirm')">{{ confirmLabel }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'numberPad',
  props: {
    value: { type: String, default: '' },
    decimal: { type: Boolean, default: false },
    letters: { type: Boolean, default: false },
    confirmLabel: { type: String, default: '確定' },
    masked: { type: Boolean, default: false },
    showScreen: { type: Boolean, default: true }
  },
  computed: {
    maskText () {
      return this.value ? new Array(this.value.length + 1).join('•') : ''
    },
    gridKeys () {
      const base10 = [
        { val: '1', id: 'k1', cls: '' },
        { val: '2', id: 'k2', cls: '' },
        { val: '3', id: 'k3', cls: '' },
        { val: '4', id: 'k4', cls: '' },
        { val: '5', id: 'k5', cls: '' },
        { val: '6', id: 'k6', cls: '' },
        { val: '7', id: 'k7', cls: '' },
        { val: '8', id: 'k8', cls: '' },
        { val: '9', id: 'k9', cls: '' },
        { val: '⌫', id: 'kbk', cls: 'np-fn' },
        { val: '0', id: 'k0', cls: '' }
      ]
      if (this.decimal) {
        return base10.concat([{ val: '.', id: 'kdot', cls: 'np-fn' }])
      }
      if (this.letters) {
        return base10.concat([
          { val: 'A', id: 'kA', cls: 'np-fn' },
          { val: 'B', id: 'kB', cls: 'np-fn' },
          { val: 'C', id: 'kC', cls: 'np-fn' },
          { val: 'D', id: 'kD', cls: 'np-fn' },
          { val: 'V', id: 'kV', cls: 'np-fn' },
          { val: 'Z', id: 'kZ', cls: 'np-fn' }
        ])
      }
      return base10.concat([{ val: 'CE', id: 'kC', cls: 'np-fn' }])
    }
  },
  methods: {
    press (k) {
      let v = this.value || ''
      if (k === '⌫') {
        v = v.slice(0, -1)
      } else if (k === 'CE') {
        v = ''
      } else if (this.decimal && k === '.') {
        if (!v.includes('.')) {
          v = v + k
        }
      } else {
        v = v + k
      }
      this.$emit('input', v)
    }
  }
}
</script>

<style scoped>
.number-pad{ width: 100%; max-width: 280px; user-select: none; margin: 0 auto; }
.np-screen{ height: 52px; margin-bottom: 10px; border: 1px solid #e2e8f0; border-radius: 12px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); display: flex; align-items: center; justify-content: flex-end; padding: 0 14px; box-shadow: inset 0 2px 6px rgba(0,0,0,.04); }
.np-value{ font-size: 24px; font-weight: 800; color: #1e293b; letter-spacing: 1px; }
.np-keys{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.np-key{ height: 54px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #1e293b; cursor: pointer; transition: all .12s; box-shadow: 0 2px 4px rgba(0,0,0,.04); }
.np-key:hover{ background: #f8fafc; box-shadow: 0 3px 8px rgba(0,0,0,.08); }
.np-key:active{ background: #e0ecff; border-color: #409eff; transform: scale(.95); box-shadow: 0 1px 2px rgba(0,0,0,.06); }
.np-fn{ background: #f1f5f9; color: #e6a23c; font-weight: 800; }
.np-fn:hover{ background: #e8ecf1; }
.np-ok{ background: linear-gradient(135deg, #409eff, #337ecc); border-color: transparent; color: #fff; font-size: 18px; font-weight: 800; box-shadow: 0 3px 10px rgba(64,158,255,.35); }
.np-ok:hover{ box-shadow: 0 5px 16px rgba(64,158,255,.5); }
.np-ok:active{ background: linear-gradient(135deg, #337ecc, #2c6fb5); transform: scale(.97); }
</style>
