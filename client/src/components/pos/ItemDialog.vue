<template>
  <el-dialog title="品項編輯" :visible.sync="itemDialog.show" top="0vh" :modal="false" custom-class="pos-dialog item-edit-dialog" append-to-body>
    <div class="mod-toolbar">
      <span class="mod-toolbar-hint">改碼類別 {{ modGroups.length }}</span>
      <el-button size="mini" type="text" @click="toggleAll(true)">全部展開</el-button>
      <el-button size="mini" type="text" @click="toggleAll(false)">全部收起</el-button>
    </div>
    <div v-for="(group, gi) in modGroups" :key="gi" class="mod-group">
      <div class="mod-group-name" @click="toggleGroup(gi)">
        <span class="arrow" :class="{open: isOpen(gi)}">▸</span>
        <span class="mod-group-title">{{ group.name }}</span>
        <span v-if="group.minSelect > 0 || group.maxSelect > 0" class="range-hint">{{ rangeText(group) }}</span>
        <span class="cnt">{{ group.items.length }}</span>
        <i v-if="hasMandatory(group)" class="req-badge">必</i>
      </div>
      <div v-show="isOpen(gi)" class="mod-group-body">
        <span v-for="m in group.items" :key="m._id" class="mod-chip"
              :class="{active: mods.some(x => x && (x.id || x.name) === m._id)}"
              @click="toggleMod(m)">
          {{ m.name }}<template v-if="(m.price || 0) > 0"> +${{ m.price }}</template><i v-if="m.mandatory" class="req">必</i>
        </span>
      </div>
    </div>
    <div class="custom-row">
      <el-input v-model="customMod" placeholder="自訂改碼" size="small" style="width: 180px;" @keyup.enter.native="addCustomMod"></el-input>
      <el-button size="small" icon="el-icon-edit-outline" @click="openPad">手寫</el-button>
    </div>
    <div slot="footer">
      <el-button v-if="mods.length" type="danger" plain @click="clearAll">清除改碼</el-button>
      <el-button @click="cancel">取 消</el-button>
      <el-button type="primary" @click="confirm">確 定</el-button>
    </div>
    <handwriting-pad :visible.sync="hwVisible" :initial-text="customMod" @confirm="onHwConfirm"></handwriting-pad>
  </el-dialog>
</template>

<script>
import HandwritingPad from './HandwritingPad.vue'
export default {
  name: 'itemDialog',
  components: { HandwritingPad },
  props: {
    itemDialog: { type: Object, required: true },
    modGroups: { type: Array, default: () => [] }
  },
  data () {
    return { mods: [], customMod: '', openGroups: {}, hwVisible: false }
  },
  watch: {
    'itemDialog.show' (show) {
      if (show) {
        this.mods = (this.itemDialog.mods || []).slice()
        this.customMod = this.itemDialog.customMod || ''
        // 從「改碼類別」按鈕進入（category 有值）時，直接展開改碼，唔使再撳入去
        const forceOpen = !!this.itemDialog.category
        this.$nextTick(() => {
          // 預設只展開「有必選改碼」的群組，其餘收起，避免畫面太長
          this.openGroups = {}
          this.modGroups.forEach((g, gi) => {
            this.$set(this.openGroups, gi, forceOpen || (g.items || []).some(m => m.mandatory))
          })
        })
      }
    }
  },
  methods: {
    isOpen (gi) {
      return !!this.openGroups[gi]
    },
    toggleGroup (gi) {
      this.$set(this.openGroups, gi, !this.openGroups[gi])
    },
    toggleAll (open) {
      const next = {}
      this.modGroups.forEach((g, gi) => { next[gi] = open })
      this.openGroups = next
    },
    hasMandatory (group) {
      return (group.items || []).some(m => m.mandatory)
    },
    rangeText (group) {
      const min = group.minSelect || 0
      const max = group.maxSelect || 0
      if (min > 0 && max > 0) return `最少${min} 最多${max}`
      if (min > 0) return `最少${min}`
      if (max > 0) return `最多${max}`
      return ''
    },
    groupCount (group) {
      return this.mods.filter(m => m && m.id && (group.items || []).some(it => it._id === m.id)).length
    },
    toggleMod (m) {
      const idx = this.mods.findIndex(x => x && (x.id || x.name) === m._id)
      if (idx >= 0) {
        this.mods.splice(idx, 1)
      } else {
        const group = this.modGroups.find(g => (g.items || []).some(it => it._id === m._id))
        if (group && group.maxSelect > 0 && this.groupCount(group) >= group.maxSelect) {
          this.$message({ type: 'warning', message: `「${group.name}」最多可選 ${group.maxSelect} 項` })
          return
        }
        this.mods.push({ id: m._id, name: m.name, price: m.price || 0, station: m.station || '' })
      }
      this.emitChange()
    },
    addCustomMod () {
      const name = this.customMod.trim()
      if (!name) return
      if (!this.mods.some(x => x && (x.id || x.name) === name)) this.mods.push({ name })
      this.customMod = ''
      this.emitChange()
    },
    openPad () {
      this.hwVisible = true
    },
    onHwConfirm (text) {
      this.customMod = (text || '').trim()
    },
    emitChange () {
      this.$emit('change', this.mods.slice())
    },
    confirm () {
      for (const g of this.modGroups) {
        const min = g.minSelect || 0
        const max = g.maxSelect || 0
        if (!min && !max) continue
        const cnt = this.groupCount(g)
        if (min > 0 && cnt < min) {
          this.$message({ type: 'warning', message: `「${g.name}」最少需選 ${min} 項` })
          return
        }
        if (max > 0 && cnt > max) {
          this.$message({ type: 'warning', message: `「${g.name}」最多可選 ${max} 項` })
          return
        }
      }
      this.$emit('confirm', this.mods.slice())
    },
    cancel () {
      this.$emit('cancel')
    },
    clearAll () {
      this.mods = []
      this.customMod = ''
      this.$emit('confirm', [])
    }
  }
}
</script>

<style scoped>
.mod-toolbar{ display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-bottom: 6px; }
.mod-toolbar-hint{ flex: 1; font-size: 18px; color: #909399; }
.mod-group{ margin-bottom: 8px; border: 1px solid #ebeef5; border-radius: 6px; overflow: hidden; }
.mod-group-name{ display: flex; align-items: center; gap: 6px; padding: 7px 10px; font-size: 20px; color: #303133; cursor: pointer; background: #f7f9fc; user-select: none; }
.mod-group-name .arrow{ display: inline-block; width: 12px; font-size: 12px; color: #909399; transition: transform .12s ease; }
.mod-group-name .arrow.open{ transform: rotate(90deg); }
.mod-group-title{ font-weight: 500; }
.mod-group-name .range-hint{ padding: 0 6px; border-radius: 3px; background: #e6a23c; color: #fff; font-size: 11px; line-height: 16px; }
.mod-group-name .cnt{ margin-left: auto; padding: 0 7px; border-radius: 9px; background: #eef1f6; color: #909399; font-size: 11px; line-height: 18px; }
.req-badge{ display: inline-block; padding: 0 5px; border-radius: 3px; background: #f56c6c; color: #fff; font-size: 11px; font-style: normal; line-height: 16px; }
.mod-group-body{ padding: 8px 10px 2px; }
.mod-chip{ display: inline-block; margin: 0 6px 6px 0; padding: 4px 12px; border: 1px solid #dcdfe6; border-radius: 14px; cursor: pointer; font-size: 20px; color: #333; transition: transform .08s ease; }
.mod-chip:active{ transform: scale(.92); }
.mod-chip.active{ border-color: #e6a23c; color: #e6a23c; background: rgba(230,162,60,.08); }
.mod-chip .req{ display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 3px; background: #f56c6c; color: #fff; font-size: 11px; font-style: normal; line-height: 16px; vertical-align: 1px; }
.custom-row{ margin-top: 10px; display: flex; align-items: center; gap: 8px; }
</style>

<style>
.el-dialog.item-edit-dialog{ position: absolute; top: 0; bottom: 0; left: var(--item-edit-left, 60px); right: 0; margin: 0; width: auto; display: flex; flex-direction: column; overflow: hidden; }
.el-dialog.item-edit-dialog .el-dialog__header{ padding-bottom: 0; }
.el-dialog.item-edit-dialog .el-dialog__body{ flex: 1; min-height: 0; overflow: auto; padding-top: 4px; }
</style>
