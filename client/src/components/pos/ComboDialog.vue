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
                :class="{active: (comboDialog.selections[gi] || []).indexOf(ii) >= 0, disabled: group.fixed}"
                @click="comboSelected(gi, ii)">
            {{ item.name }}<template v-if="item.upgradePrice > 0"> +${{ item.upgradePrice }}</template>
          </span>
        </div>
        <!-- 選中品項的改碼（Modifier Master：走蔥/加蛋/轉凍飲） -->
        <div v-for="(selIdx, si) in (comboDialog.selections[gi] || [])" :key="'cmsel' + si" class="combo-mod-block">
          <template v-if="group.items[selIdx] && (group.items[selIdx].modifiers || []).length">
            <div class="combo-mod-title">「{{ group.items[selIdx].name }}」改碼：</div>
            <span v-for="m in group.items[selIdx].modifiers" :key="m.modCodeId || m.name" class="mod-chip"
                  :class="{active: comboMods(gi, selIdx).some(x => x && (x.id || x.name) === (m.modCodeId || m.name))}"
                  @click="comboToggleMod(gi, selIdx, m)">
              {{ m.name }}<template v-if="(m.price || 0) > 0"> +${{ m.price }}</template>
            </span>
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
  methods: {
    comboSelected (gi, ii) {
      const combo = this.comboDialog.combo
      const group = combo && combo.groups ? combo.groups[gi] : null
      if (!group || group.fixed) return
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
    comboToggleMod (gi, selIdx, m) {
      const key = gi + ':' + selIdx
      const mods = (this.comboDialog.mods[key] || []).slice()
      const idx = mods.findIndex(x => x && (x.id || x.name) === (m.modCodeId || m.name))
      if (idx >= 0) mods.splice(idx, 1)
      else mods.push({ id: m.modCodeId || '', name: m.name, price: m.price || 0, station: m.station || '' })
      this.$set(this.comboDialog.mods, key, mods)
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
.combo-mod-block{ border-top: 1px dashed #ebeef5; padding: 8px 10px 2px; }
.combo-mod-title{ margin: 4px 0 6px; font-size: 14px; color: #909399; }
.empty{ padding: 24px; text-align: center; color: #909399; font-size: 20px; }
</style>

<style>
.el-dialog.combo-picker-dialog{ position: absolute; top: 0; bottom: 0; left: var(--item-edit-left, 60px); right: 0; margin: 0; width: auto; display: flex; flex-direction: column; overflow: hidden; }
.el-dialog.combo-picker-dialog .el-dialog__header{ padding-bottom: 0; }
.el-dialog.combo-picker-dialog .el-dialog__body{ flex: 1; min-height: 0; overflow: auto; padding-top: 4px; }
</style>
