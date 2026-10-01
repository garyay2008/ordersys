<template>
  <el-dialog :title="tableDialog.title" :visible.sync="tableDialog.show" :fullscreen="tableDialog.mode === 'split'" :width="tableDialog.mode === 'split' ? '66.6%' : '440px'" top="0vh" :custom-class="tableDialog.mode === 'split' ? 'split-table-dialog table-op-dialog pos-dialog' : 'table-op-dialog pos-dialog'" append-to-body>
    <template v-if="tableDialog.mode === 'merge'">
      <el-form label-width="90px" size="small">
        <div class="merge-hint">把目前枱（{{ selectedTable }}）併入以下枱號，此枱保留</div>
        <el-form-item label="併入枱號">
          <span class="trans-src">{{ tableDialog.fromTable || '—' }}</span>
        </el-form-item>
      </el-form>
      <div class="pad-wrap">
        <number-pad :value="tableDialog.padValue" @input="$emit('pad-input', $event)" @confirm="$emit('confirm')" letters></number-pad>
      </div>
      <div class="pad-hint">可用枱號：{{ tableHint }}</div>
    </template>
    <template v-else>
      <div v-if="!currentOrder" class="empty">該枱沒有未結訂單可分單</div>
      <div v-else class="split-layout">
        <div class="split-main">
          <div class="split-toolbar">
            <el-button size="mini" type="primary" icon="el-icon-d-arrow-right" @click="$emit('move-all-right')">全部搬移</el-button>
          </div>
          <div class="split-panels">
            <div class="split-panel">
              <div class="split-title">舊枱（枱 {{ selectedTable }}）<span class="split-subtotal">${{ splitLeftTotal }}</span></div>
              <div class="split-list">
                <div v-for="x in splitLeftItems" :key="x.i" class="split-item" :class="{ sel: splitLeftSel.indexOf(x.i) >= 0 }" @click="$emit('toggle-left', x.i)">
                  <div class="split-item-main">
                    <span class="split-item-name">{{ x.item.name }}</span>
                    <span class="split-item-qty">x{{ x.remain }}</span>
                  </div>
                  <div class="split-item-sub">
                    <span class="split-item-price">${{ unitPrice(x.item) }}</span>
                    <span class="split-item-total">${{ itemLineTotal(x.item, x.remain) }}</span>
                  </div>
                </div>
                <div v-if="!splitLeftItems.length" class="empty">舊枱無品項</div>
              </div>
            </div>
            <div class="split-arrows">
              <el-button size="mini" icon="el-icon-arrow-right" @click="$emit('move-right')"></el-button>
              <el-button size="mini" icon="el-icon-arrow-left" @click="$emit('move-left')"></el-button>
            </div>
            <div class="split-panel">
              <div class="split-title">新枱（移至枱 {{ tableDialog.toTable || '—' }}）<span class="split-subtotal">${{ splitRightTotal }}</span></div>
              <div class="split-list">
                <div v-for="x in splitRightItems" :key="x.i" class="split-item" :class="{ sel: splitRightSel.indexOf(x.i) >= 0 }" @click="$emit('toggle-right', x.i)">
                  <div class="split-item-main">
                    <span class="split-item-name">{{ x.item.name }}</span>
                    <span class="split-stepper">
                      <button type="button" class="split-step-btn" @click.stop="$emit('dec-qty', x.i)">−</button>
                      <span class="split-step-val">{{ x.count }}</span>
                      <button type="button" class="split-step-btn" @click.stop="$emit('inc-qty', x.i)">＋</button>
                    </span>
                  </div>
                  <div class="split-item-sub">
                    <span class="split-item-price">${{ unitPrice(x.item) }}</span>
                    <span class="split-item-total">${{ itemLineTotal(x.item, x.count) }}</span>
                  </div>
                </div>
                <div v-if="!splitRightItems.length" class="empty">新枱無品項</div>
              </div>
            </div>
          </div>
        </div>
        <div class="split-side">
          <div class="split-target">
            <span class="split-target-label">新枱號</span>
            <span class="split-target-no">{{ tableDialog.toTable || '—' }}</span>
          </div>
          <div class="pad-wrap">
            <number-pad :value="tableDialog.padValue" @input="$emit('pad-input', $event)" @confirm="$emit('confirm')" letters></number-pad>
          </div>
          <div class="pad-hint">可用枱號：{{ tableHint }}</div>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import NumberPad from './NumberPad'

export default {
  name: 'tableDialog',
  components: { NumberPad },
  props: {
    tableDialog: { type: Object, required: true },
    selectedTable: { default: null },
    tableHint: { type: String, default: '' },
    currentOrder: { type: Object, default: null },
    splitLeftItems: { type: Array, default: () => [] },
    splitRightItems: { type: Array, default: () => [] },
    splitLeftSel: { type: Array, default: () => [] },
    splitRightSel: { type: Array, default: () => [] },
    splitLeftTotal: { type: Number, default: 0 },
    splitRightTotal: { type: Number, default: 0 }
  },
  methods: {
    unitPrice (item) {
      if (item.free) return 0
      const base = item.customPrice > 0 ? item.customPrice : (item.price || 0)
      return Math.round(base * (item.discount || 1) * 100) / 100
    },
    itemLineTotal (item, count) {
      return Math.round(this.unitPrice(item) * (count || 0) * 100) / 100
    }
  }
}
</script>

<style scoped>
.trans-src{ font-size: 20px; font-weight: bold; color: #409eff; }
.pad-wrap{ display: flex; justify-content: center; margin: 6px 0; }
.pad-hint{ text-align: center; font-size: 12px; color: #909399; margin-top: 6px; }
.merge-hint{ font-size: 12px; color: #909399; margin: 2px 0 8px; }
.empty{ color: #c0c4cc; text-align: center; padding: 40px 0; }
.split-toolbar{ display: flex; justify-content: flex-end; margin-bottom: 8px; }
.split-panels{ display: flex; align-items: stretch; gap: 8px; margin-bottom: 10px; }
.split-panel{ flex: 1; border: 1px solid #e4e7ed; border-radius: 6px; display: flex; flex-direction: column; min-width: 0; }
.split-title{ padding: 6px 8px; font-size: 13px; font-weight: bold; background: #f5f7fa; border-bottom: 1px solid #e4e7ed; }
.split-subtotal{ float: right; font-weight: bold; color: #e6a23c; }
.split-list{ flex: 1; max-height: 260px; overflow: auto; padding: 6px; }
.split-item{ padding: 6px 8px; margin-bottom: 4px; border: 1px solid #e4e7ed; border-radius: 4px; cursor: pointer; font-size: 13px; }
.split-item:hover{ border-color: #409eff; }
.split-item.sel{ background: #ecf5ff; border-color: #409eff; color: #409eff; }
.split-item-main{ display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.split-item-name{ flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.split-item-qty{ color: #909399; }
.split-item-sub{ display: flex; justify-content: space-between; margin-top: 2px; font-size: 12px; color: #606266; }
.split-item-price{ color: #909399; }
.split-item-total{ font-weight: bold; }
.split-stepper{ display: inline-flex; align-items: center; gap: 4px; }
.split-step-btn{ width: 22px; height: 22px; line-height: 20px; border: 1px solid #dcdfe6; background: #fff; border-radius: 4px; cursor: pointer; font-size: 14px; color: #409eff; }
.split-step-btn:hover{ border-color: #409eff; }
.split-step-val{ min-width: 18px; text-align: center; font-weight: bold; }
.split-arrows{ display: flex; flex-direction: column; justify-content: center; gap: 8px; }
</style>
