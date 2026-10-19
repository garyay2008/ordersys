<template>
  <el-dialog :title="comboDialog.combo ? comboDialog.combo.name : '套餐選擇'" :visible.sync="comboDialog.show" top="0vh" :modal="false" custom-class="pos-dialog combo-picker-dialog" append-to-body>
    <div v-if="comboDialog.combo" class="combo-picker">
      <div v-for="(group, gi) in comboDialog.combo.groups" :key="gi" class="mod-group">
        <div class="mod-group-name">
          <span class="mod-group-title">{{ group.name }}</span>
          <span class="pick-hint">選 {{ group.min || 0 }} 至 {{ group.max || 1 }} 項</span>
          <span v-if="group.groupPrice > 0" class="group-addon">加購 +${{ group.groupPrice }}</span>
        </div>
        <div class="mod-group-body">
          <span v-for="(item, ii) in group.items" :key="ii" class="mod-chip"
                :class="{active: (comboDialog.selections[gi] || []).indexOf(ii) >= 0, disabled: group.fixed || item.soldOut, soldout: item.soldOut}"
                @click="comboSelected(gi, ii)">
            {{ item.name }}<template v-if="item.upgradePrice > 0"> +${{ item.upgradePrice }}</template><span v-if="item.soldOut" class="mod-chip-soldout">沽清</span>
          </span>
        </div>
        <!-- 選中品項的改碼（Modifier Master：走蔥/加蛋/轉凍飲；依類別分組，同步類別 min/max 並提示） -->
        <div v-for="(selIdx, si) in (comboDialog.selections[gi] || [])" :key="'cmsel' + si" class="combo-mod-block">
          <template v-if="group.items[selIdx] && (group.items[selIdx].modGroups || []).length">
            <div class="combo-mod-title">「{{ group.items[selIdx].name }}」改碼：</div>
            <div v-for="(mg, mgi) in group.items[selIdx].modGroups" :key="'mg' + mgi" class="combo-mod-group">
              <div class="combo-mod-group-name">
                <span class="combo-mod-cat">{{ mg.name }}</span>
                <span v-if="mg.minSelect > 0 || mg.maxSelect > 0" class="range-hint">{{ rangeText(mg) }}</span>
              </div>
              <span v-for="m in mg.mods" :key="m.modCodeId || m.name" class="mod-chip"
                    :class="{active: comboMods(gi, selIdx).some(x => x && (x.id || x.name) === (m.modCodeId || m.name)), soldout: m.soldOut}"
                    title="長按沽清／重售"
                    @click="comboToggleMod(gi, selIdx, m)"
                    @mousedown="startModPress(m)" @mouseup="cancelModPress" @mouseleave="cancelModPress"
                    @touchstart="startModPress(m)" @touchend="cancelModPress" @touchmove="cancelModPress">
                {{ m.name }}<template v-if="(m.price || 0) > 0"> +${{ m.price }}</template><span v-if="m.soldOut" class="mod-chip-soldout">沽清</span>
              </span>
            </div>
          </template>
        </div>
      </div>
      <div v-if="!comboDialog.combo.groups || !comboDialog.combo.groups.length" class="empty">此套餐尚未設定內容</div>
    </div>
    <div slot="footer">
      <el-button @click="comboDialog.show = false">取 消</el-button>
      <el-button type="primary" @click="$emit('confirm')">加入訂單</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'comboDialog',
  props: {
    comboDialog: { type: Object, required: true }
  },
  data () {
    return { modPressTimer: null, modPressed: false }
  },
  methods: {
    comboSelected (gi, ii) {
      const combo = this.comboDialog.combo
      const group = combo && combo.groups ? combo.groups[gi] : null
      if (!group || group.fixed) return
      const item = group.items[ii]
      if (item && item.soldOut) { this.$message({ type: 'warning', message: `「${item.name}」已沽清` }); return }
      const selected = this.comboDialog.selections[gi] || []
      const index = selected.indexOf(ii)
      if (index >= 0) {
        selected.splice(index, 1)
      } else {
        if (!group.allowRepeat && selected.length >= (group.max || 1)) {
          selected.splice(0, selected.length)
        }
        selected.push(ii)
      }
      this.$set(this.comboDialog.selections, gi, selected)
    },
    comboMods (gi, selIdx) {
      const key = gi + ':' + selIdx
      return (this.comboDialog.mods && this.comboDialog.mods[key]) || []
    },
    rangeText (mg) {
      const min = mg.minSelect || 0
      const max = mg.maxSelect || 0
      if (min > 0 && max > 0) return `最少${min} 最多${max}`
      if (min > 0) return `最少${min}`
      if (max > 0) return `最多${max}`
      return ''
    },
    modGroupCount (gi, selIdx, mg) {
      const mods = this.comboMods(gi, selIdx)
      return mods.filter(x => x && (mg.mods || []).some(mm => (mm.modCodeId || mm.name) === (x.id || x.name))).length
    },
    comboToggleMod (gi, selIdx, m) {
      if (this.modPressed) { this.modPressed = false; return }
      if (m.soldOut) { this.$message({ type: 'warning', message: `「${m.name}」已沽清` }); return }
      const key = gi + ':' + selIdx
      const mods = (this.comboDialog.mods[key] || []).slice()
      const idx = mods.findIndex(x => x && (x.id || x.name) === (m.modCodeId || m.name))
      if (idx >= 0) {
        mods.splice(idx, 1)
      } else {
        const item = this.comboDialog.combo && this.comboDialog.combo.groups ? this.comboDialog.combo.groups[gi].items[selIdx] : null
        const mg = item && (item.modGroups || []).find(g => (g.mods || []).some(mm => (mm.modCodeId || mm.name) === (m.modCodeId || m.name)))
        if (mg && mg.maxSelect > 0 && this.modGroupCount(gi, selIdx, mg) >= mg.maxSelect) {
          this.$message({ type: 'warning', message: `「${mg.name}」最多可選 ${mg.maxSelect} 項` })
          return
        }
        mods.push({ id: m.modCodeId || '', name: m.name, price: m.price || 0, station: m.station || '' })
      }
      this.$set(this.comboDialog.mods, key, mods)
    },
    startModPress (m) {
      if (!m || !m.modCodeId) return
      this.cancelModPress()
      this.modPressTimer = setTimeout(() => {
        this.modPressed = true
        this.toggleModSoldOut(m)
        setTimeout(() => { this.modPressed = false }, 800)
      }, 600)
    },
    cancelModPress () {
      if (this.modPressTimer) { clearTimeout(this.modPressTimer); this.modPressTimer = null }
    },
    toggleModSoldOut (m) {
      const soldOut = !m.soldOut
      const action = soldOut ? '沽清' : '重售'
      this.$confirm(`是否將改碼「${m.name}」${action}？`, action, { type: 'warning', confirmButtonText: `確認${action}`, cancelButtonText: '取消' })
        .then(() => {
          this.$axios.post('/api/modcode/soldout', { _id: m.modCodeId, soldOut })
            .then(res => {
              this.$message({ type: 'success', message: res.data })
              this.$set(m, 'soldOut', soldOut)
            })
            .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '更新失敗' }))
        })
        .catch(() => {})
    }
  }
}
</script>

<style scoped>
.combo-picker{ padding-right: 4px; }
.mod-group{ margin-bottom: 8px; border: 1px solid #ebeef5; border-radius: 6px; overflow: hidden; }
.mod-group-name{ display: flex; align-items: center; gap: 6px; padding: 7px 10px; font-size: 20px; color: #303133; background: #f7f9fc; }
.mod-group-title{ font-weight: 500; }
.pick-hint{ margin-left: 8px; color: #909399; font-size: 13px; font-weight: normal; }
.group-addon{ margin-left: auto; color: #e6a23c; font-size: 13px; font-weight: normal; }
.mod-group-body{ padding: 8px 10px 2px; }
.mod-chip{ display: inline-block; margin: 0 6px 6px 0; padding: 4px 12px; border: 1px solid #dcdfe6; border-radius: 14px; cursor: pointer; font-size: 20px; color: #333; transition: transform .08s ease; }
.mod-chip:active{ transform: scale(.92); }
.mod-chip.active{ border-color: #e6a23c; color: #e6a23c; background: rgba(230,162,60,.08); }
.mod-chip.disabled{ opacity: .5; cursor: not-allowed; }
.mod-chip.soldout{ opacity: .55; cursor: not-allowed; text-decoration: line-through; border-color: #f56c6c; color: #909399; }
.mod-chip-soldout{ margin-left: 6px; font-size: 12px; color: #fff; background: #f01414; padding: 1px 5px; border-radius: 4px; vertical-align: middle; font-weight: 600; }
.combo-mod-block{ border-top: 1px dashed #ebeef5; padding: 8px 10px 2px; }
.combo-mod-title{ margin: 4px 0 6px; font-size: 14px; color: #909399; }
.combo-mod-group{ margin-bottom: 4px; }
.combo-mod-group-name{ display: flex; align-items: center; gap: 6px; margin: 2px 0 4px; }
.combo-mod-cat{ font-size: 13px; color: #606266; font-weight: 600; }
.range-hint{ padding: 0 6px; border-radius: 3px; background: #e6a23c; color: #fff; font-size: 11px; line-height: 16px; }
.empty{ padding: 24px; text-align: center; color: #909399; font-size: 20px; }
</style>

<style>
.el-dialog.combo-picker-dialog{ position: absolute; top: 0; bottom: 0; left: var(--item-edit-left, 60px); right: 0; margin: 0; width: auto; display: flex; flex-direction: column; overflow: hidden; }
.el-dialog.combo-picker-dialog .el-dialog__header{ padding-bottom: 0; }
.el-dialog.combo-picker-dialog .el-dialog__body{ flex: 1; min-height: 0; overflow: auto; padding-top: 4px; }
</style>
