<template>
    <transition name="fade">
        <div v-show="showFlag" class="combo-picker">
            <div class="header">
                <div class="back" @click="showFlag = false">
                    <i class="el-icon-arrow-left"></i>
                </div>
                <div class="title">選擇套餐搭配</div>
            </div>
            <div class="body" v-if="combo">
                <h2 class="combo-name">
                    {{ combo.name }}
                    <span class="combo-price">${{ combo.price }}</span>
                </h2>
                <p class="combo-desc" v-if="combo.describe">{{ combo.describe }}</p>

                <div v-for="(g, gi) in combo.groups" :key="gi" class="group">
                    <h3 class="group-name" v-if="!g.fixed">
                        {{ g.name }}
                        <span class="group-rule">（選 {{ g.min || 1 }} ~ {{ g.max || 1 }} 項<span v-if="g.allowRepeat">，可重複</span>）</span>
                        <span class="station" v-if="g.station">檔口：{{ g.station }}</span>
                    </h3>

                    <!-- 選單組 -->
                    <div class="items" v-if="!g.fixed">
                        <div v-for="(item, ii) in g.items" :key="ii" class="item"
                             :class="{active: (selCount(gi, item) > 0), soldout: item.soldOut}"
                             @click="toggleItem(gi, item)">
                            <span class="item-name">{{ item.name }}<span v-if="selCount(gi, item) > 1"> x{{ selCount(gi, item) }}</span><span v-if="item.soldOut" class="item-soldout-tag">沽清</span></span>
                            <span class="item-price">${{ item.price }}<span v-if="item.upgradePrice" class="upgrade"> +{{ item.upgradePrice }}</span></span>
                        </div>
                    </div>

                    <!-- 已選／自動帶出品項的改碼與換菜 -->
                    <div v-for="(sel, si) in (selected[gi] || [])" :key="'sel' + si" class="sel-detail">
                        <div class="sel-title" v-if="showSelTitle(gi, sel)">{{ sel.item.name }} <span v-if="sel.count > 1">x{{ sel.count }}</span></div>
                        <div v-for="(mg, mgi) in (sel.item.modGroups || [])" :key="'mg' + mgi" class="mod-row">
                            <div class="mod-head">
                                <span class="mod-label">
                                    <span class="mod-required" v-if="mg.minSelect > 0">必選</span>
                                    {{ modCatName(mg.name) }}<span v-if="rangeText(mg)" class="mod-range">（{{ rangeText(mg) }}）</span>
                                </span>
                                <span v-if="showModStatus(mg)" class="mod-status" :class="{done: modGroupDone(sel, mg)}">{{ modGroupStatusText(sel, mg) }}</span>
                            </div>
                            <div class="mod-items">
                                <span v-for="(m, mi) in mg.mods" :key="mi" class="mod-item"
                                      :class="{active: modActive(sel, m)}"
                                      @click="toggleModifier(gi, si, m, mg)">
                                    {{ m.name }}<span v-if="m.price">+{{ m.price }}</span>
                                </span>
                            </div>
                        </div>
                        <div v-if="sel.item.substitutes && sel.item.substitutes.length" class="mod-row">
                            <div class="mod-head">
                                <span class="mod-label">換菜</span>
                            </div>
                            <div class="mod-items">
                                <span class="mod-item" :class="{active: !sel.substitute}" @click="sel.substitute = null">不換</span>
                                <span v-for="(s, ssi) in sel.item.substitutes" :key="ssi" class="mod-item"
                                      :class="{active: sel.substitute === s}"
                                      @click="sel.substitute = (sel.substitute === s ? null : s)">
                                    {{ s.name }}<span :class="s.priceDelta > 0 ? 'delta-up' : 'delta-down'">{{ s.priceDelta >= 0 ? '+' + s.priceDelta : s.priceDelta }}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="footer" v-if="combo">
                <div class="total">
                    合計：<span class="price">${{ totalPrice }}</span>
                    <span class="extra" v-if="extraTotal > 0">（含加價 +${{ extraTotal }}）</span>
                </div>
                <el-button type="primary" class="submit" :disabled="submitting" @click="confirm">加入購物車</el-button>
            </div>
        </div>
    </transition>
</template>

<script>
// 改碼類別內部名稱 → 顧客易懂名稱對照表（僅 QR/手機下單顯示用）
const MOD_CAT_ALIAS = {
  早A: '麵底',
  '二島-改碼': '配料',
  '包類-可選（一項）': '包類',
  '包類-可選': '包類'
}

export default {
  name: 'comboPicker',
  props: {
    modCodes: { type: Array, default: () => [] },
    modCodeCategories: { type: Array, default: () => [] }
  },
  data () {
    return {
      showFlag: false,
      combo: null,
      selected: {},
      submitting: false,
      editItem: null
    }
  },
  computed: {
    extraTotal () {
      let extra = 0
      const groups = this.combo ? (this.combo.groups || []) : []
      groups.forEach((g, gi) => {
        const sels = this.selected[gi] || []
        if (sels.length > 0 && Number(g.groupPrice) > 0) extra += Number(g.groupPrice)
        sels.forEach(s => {
          if (!s || !s.item || s.item.soldOut) return
          extra += (s.item.upgradePrice || 0) * s.count
          ;(s.modifiers || []).forEach(m => { extra += (m.price || 0) })
          if (s.substitute) extra += (s.substitute.priceDelta || 0)
        })
      })
      return extra
    },
    totalPrice () {
      return (this.combo ? this.combo.price : 0) + this.extraTotal
    }
  },
  methods: {
    show (combo, editItem) {
      this.combo = this.enrichCombo(combo)
      this.submitting = false
      this.editItem = editItem || null
      if (this.editItem) this.restoreSelection(this.editItem)
      else this.initSelection()
      this.showFlag = true
    },
    enrichCombo (combo) {
      if (!combo) return combo
      const copy = Object.assign({}, combo)
      copy.groups = (combo.groups || []).map(g => {
        const gCopy = Object.assign({}, g)
        gCopy.items = (g.items || []).map(it => {
          const ic = Object.assign({}, it)
          const cats = ic.modCategories || []
          ic.modGroups = this.buildModGroups(cats)
          // 無改碼類別但有舊版 flat modifiers 時，仍以「客製化」群組呈現（避免遺失既有改碼）
          if (!ic.modGroups.length && (ic.modifiers || []).length) {
            ic.modGroups = [{
              name: '客製化',
              minSelect: 0,
              maxSelect: 0,
              mods: ic.modifiers.map(m => ({ modCodeId: m.modCodeId || '', name: m.name, price: m.price || 0, station: m.station || '', code: m.code || '' }))
            }]
          }
          if (!ic.modifiers || !ic.modifiers.length) {
            ic.modifiers = ic.modGroups.reduce((acc, mg) => acc.concat(mg.mods), [])
          }
          return ic
        })
        return gCopy
      })
      return copy
    },
    buildModGroups (cats) {
      const catMap = {}
      ;(this.modCodeCategories || []).forEach(c => { catMap[c.name] = c })
      return (cats || []).map(catName => {
        const cat = catMap[catName]
        return {
          name: catName,
          minSelect: (cat && cat.minSelect) || 0,
          maxSelect: (cat && cat.maxSelect) || 0,
          mods: (this.modCodes || []).filter(m => m.category === catName).map(m => ({ modCodeId: String(m._id), name: m.name, price: m.price || 0, station: m.station || '', code: m.code || '' }))
        }
      }).filter(g => g.mods.length)
    },
    initSelection () {
      const sel = {}
      const groups = this.combo ? (this.combo.groups || []) : []
      groups.forEach((g, gi) => {
        if (g.fixed) sel[gi] = (g.items || []).filter(item => !item.soldOut).map(item => ({ item, count: 1, modifiers: [], substitute: null }))
        else sel[gi] = []
      })
      this.selected = sel
    },
    rangeText (mg) {
      const min = mg.minSelect || 0
      const max = mg.maxSelect || 0
      if (min > 0 && max > 0) return min === max ? `選${min}項` : `選${min}~${max}項`
      if (min > 0) return `最少${min}項`
      if (max > 0) return `最多${max}項`
      return ''
    },
    modCatName (name) {
      const raw = (name || '').trim()
      if (MOD_CAT_ALIAS[raw]) return MOD_CAT_ALIAS[raw]
      return raw.replace(/（[^）]*）$/g, '').replace(/\([^)]*\)$/g, '').trim()
    },
    showSelTitle (gi, sel) {
      const group = this.combo && this.combo.groups ? this.combo.groups[gi] : null
      if (!group || !group.fixed) return true
      // 套餐開關「QR 顯示自動品項名」：開則一律顯示，關則退回原行為（無改碼/換菜才顯示）
      if (this.combo && this.combo.showFixedNames !== false) return true
      const hasMods = (sel.item.modGroups || []).length > 0
      const hasSubs = (sel.item.substitutes || []).length > 0
      return !hasMods && !hasSubs
    },
    modActive (sel, m) {
      const mods = sel.modifiers || []
      return mods.some(x => x === m || (m.modCodeId && x.modCodeId === m.modCodeId) || (!m.modCodeId && x.name === m.name))
    },
    modSelectedCount (sel, mg) {
      const mods = sel.modifiers || []
      const inGroup = x => (mg.mods || []).some(mm => mm === x || (x.modCodeId && mm.modCodeId === x.modCodeId) || (!x.modCodeId && mm.name === x.name))
      return mods.filter(inGroup).length
    },
    modGroupDone (sel, mg) {
      const min = mg.minSelect || 0
      const max = mg.maxSelect || 0
      const cnt = this.modSelectedCount(sel, mg)
      if (min > 0) return cnt >= min
      if (max === 1) return cnt >= 1
      return false
    },
    modGroupStatusText (sel, mg) {
      const min = mg.minSelect || 0
      const max = mg.maxSelect || 0
      const done = this.modGroupDone(sel, mg)
      if (min <= 0) return ''
      if (max > 0) return done ? '已完成選擇 ✓' : (min === max ? `請選擇 ${min} 項` : `請選擇 ${min}~${max} 項`)
      return done ? '已完成選擇 ✓' : `請選擇至少 ${min} 項`
    },
    showModStatus (mg) {
      return (mg.minSelect || 0) > 0
    },
    selCount (gi, item) {
      const sel = this.selected[gi] || []
      const s = sel.find(x => x.item.name === item.name)
      return s ? s.count : 0
    },
    toggleItem (gi, item) {
      if (item.soldOut) { this.$message({ type: 'warning', message: `「${item.name}」已沽清` }); return }
      const group = this.combo.groups[gi]
      if (!this.selected[gi]) this.$set(this.selected, gi, [])
      const sel = this.selected[gi]
      const existing = sel.find(x => x.item.name === item.name)
      const total = sel.reduce((sum, x) => sum + x.count, 0)
      if (existing) {
        if (group.allowRepeat && existing.count < group.max) {
          existing.count++
        } else {
          const idx = sel.indexOf(existing)
          sel.splice(idx, 1)
        }
      } else {
        if (total >= group.max) {
          if (!group.allowRepeat) sel.shift()
          else {
            this.$message({ type: 'warning', message: `「${group.name}」最多選 ${group.max} 項` })
            return
          }
        }
        sel.push({ item, count: 1, modifiers: [], substitute: null })
      }
    },
    toggleModifier (gi, si, m, mg) {
      const sel = this.selected[gi][si]
      if (!sel.modifiers) this.$set(sel, 'modifiers', [])
      const mods = sel.modifiers
      const sameGroup = x => (mg.mods || []).some(mm => mm === x || (x.modCodeId && mm.modCodeId === x.modCodeId) || (!x.modCodeId && mm.name === x.name))
      const idx = mods.findIndex(x => x === m || (m.modCodeId && x.modCodeId === m.modCodeId) || (!m.modCodeId && x.name === m.name))
      if (idx >= 0) {
        mods.splice(idx, 1)
      } else {
        if (mg && mg.maxSelect > 0) {
          const count = mods.filter(sameGroup).length
          if (count >= mg.maxSelect) {
            if (mg.maxSelect === 1) {
              const replaceIdx = mods.findIndex(sameGroup)
              if (replaceIdx >= 0) mods.splice(replaceIdx, 1, m)
              else mods.push(m)
              return
            }
            this.$message({ type: 'warning', message: `「${this.modCatName(mg.name)}」最多可選 ${mg.maxSelect} 項` })
            return
          }
        }
        mods.push(m)
      }
    },
    confirm () {
      if (this.submitting) return
      const groups = this.combo.groups || []
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi]
        // 選單組：驗證已選品項數量（固定自動帶出組不需選品項）
        if (!g.fixed) {
          const sel = this.selected[gi] || []
          const count = sel.reduce((sum, s) => sum + s.count, 0)
          if (count < (g.min || 1)) {
            this.$message({ type: 'warning', message: `請為「${g.name}」選擇至少 ${g.min || 1} 項` })
            return
          }
        }
        // 驗證所有已選品項（含固定自動帶出）的必選改碼
        const sels = this.selected[gi] || []
        for (let si = 0; si < sels.length; si++) {
          const s = sels[si]
          const modGroups = (s.item && s.item.modGroups) || []
          for (let mi = 0; mi < modGroups.length; mi++) {
            const mg = modGroups[mi]
            const min = mg.minSelect || 0
            if (min <= 0) continue
            const cnt = this.modSelectedCount(s, mg)
            if (cnt < min) {
              const itemName = (s.item && s.item.name) || g.name
              this.$message({ type: 'warning', message: `「${itemName}」的「${this.modCatName(mg.name)}」請選擇至少 ${min} 項` })
              return
            }
          }
        }
      }
      this.submitting = true
      const contents = []
      groups.forEach((g, gi) => {
        const sels = this.selected[gi] || []
        sels.forEach(s => {
          if (!s || !s.item || s.item.soldOut) return
          let label = s.item.name
          if (s.count > 1) label += ' x' + s.count
          if (s.substitute) label += '→' + s.substitute.name
          contents.push({
            commodityId: s.item.commodityId || '',
            _id: s.item.commodityId || '',
            name: label,
            price: (s.item.price || 0) + (s.item.upgradePrice || 0) + (s.substitute ? (s.substitute.priceDelta || 0) : 0),
            station: g.station,
            mods: (s.modifiers || []).map(m => ({ id: m.modCodeId, name: m.name, price: m.price || 0, station: m.station || g.station }))
          })
        })
      })
      const payload = {
        _id: this.combo._id,
        name: this.combo.name2 || this.combo.name,
        name2: this.combo.name2 || '',
        price: this.totalPrice,
        img: this.combo.img,
        isCombo: true,
        noPrintComboName: !!this.combo.noPrintComboName,
        mainGroupId: this.combo.mainGroupId || '',
        contents
      }
      if (this.editItem) {
        this.$emit('update', { payload, targetKey: this.editItem.key })
      } else {
        this.$emit('add', payload)
      }
      this.showFlag = false
    },
    // 依購物車已選套餐回填選擇（name 比對 + 還原改碼/換菜）
    restoreSelection (editItem) {
      const groups = this.combo.groups || []
      const contents = editItem.contents || []
      const sel = {}
      groups.forEach((g, gi) => {
        if (g.fixed) sel[gi] = (g.items || []).filter(item => !item.soldOut).map(item => ({ item, count: 1, modifiers: [], substitute: null }))
        else sel[gi] = []
      })
      contents.forEach(c => {
        if (!c) return
        const rawName = (c.name || '').trim()
        if (rawName.indexOf('　· ') === 0) return
        let gi = -1
        let item = null
        for (let x = 0; x < groups.length; x++) {
          const g = groups[x]
          const found = (g.items || []).find(it => this.matchBase(rawName, it.name))
          if (found) { gi = x; item = found; break }
        }
        if (!item || gi < 0) return
        let count = 1
        const cm = rawName.match(/ x(\d+)$/)
        if (cm) count = parseInt(cm[1], 10)
        let substitute = null
        const arrowIdx = rawName.indexOf('→')
        if (arrowIdx >= 0) {
          const subName = rawName.slice(arrowIdx + 1)
          substitute = (item.substitutes || []).find(s => s.name === subName) || null
        }
        const modifiers = (c.mods || []).map(cm => {
          const orig = (item.modifiers || []).find(x => (x.modCodeId && String(x.modCodeId) === String(cm.id)) || (x.name && x.name === cm.name))
          return orig || { modCodeId: cm.id || cm.name, name: cm.name, price: cm.price || 0, station: cm.station || '' }
        })
        const target = sel[gi].find(x => x.item.name === item.name)
        if (target) {
          target.count = count
          if (substitute) target.substitute = substitute
          if (modifiers.length) target.modifiers = modifiers
        } else {
          sel[gi].push({ item, count, modifiers, substitute })
        }
      })
      this.selected = sel
    },
    matchBase (fullName, baseName) {
      if (!fullName || !baseName) return false
      if (fullName === baseName) return true
      if (fullName.indexOf(baseName + ' x') === 0) return true
      if (fullName.indexOf(baseName + '→') === 0) return true
      return false
    }
  }
}
</script>

<style scoped>
.combo-picker{
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 60;
    background: #fff;
    display: flex;
    flex-direction: column;
}
.combo-picker > .header{
    height: 45px;
    line-height: 45px;
    background: var(--primary);
    color: #fff;
    position: relative;
    flex: 0 0 45px;
}
.combo-picker > .header > .back{ position: absolute; left: 0; top: 0; cursor: pointer; }
.combo-picker > .header > .back > .el-icon-arrow-left{
    display: block;
    line-height: 1;
    padding: 10px 14px;
    font-size: 22px;
    color: #fff;
    background: var(--accent);
    border-radius: 0 20px 20px 0;
    box-shadow: 0 2px 10px var(--accent-glow);
}
.combo-picker > .header > .title{ text-align: center; font-size: 16px; }
.combo-picker > .body{ flex: 1; overflow: auto; padding: 16px; }
.combo-picker > .body > .combo-name{ font-size: 18px; color: #07111b; margin: 0 0 6px; }
.combo-picker > .body > .combo-name > .combo-price{ color: var(--accent); font-size: 16px; }
.combo-picker > .body > .combo-desc{ color: #93999f; font-size: 12px; margin: 0 0 12px; }
.combo-picker .group{ margin-bottom: 18px; }
.combo-picker .group > .group-name{ font-size: 14px; color: #07111b; margin: 0 0 8px; }
.combo-picker .group > .group-name > .group-rule{ font-size: 12px; color: #93999f; font-weight: normal; }
.combo-picker .group > .group-name > .station{ float: right; font-size: 12px; color: #e6a23c; font-weight: normal; }
.combo-picker .items{ display: flex; flex-wrap: wrap; gap: 8px; }
.combo-picker .items > .item{
    flex: 0 0 calc(50% - 4px);
    box-sizing: border-box;
    border: 1px solid #dcdfe6;
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    font-size: 14px;
    color: #333;
}
.combo-picker .items > .item.active{ border-color: #e64545; color: #e64545; background: rgba(230,69,69,0.08); }
.combo-picker .items > .item.soldout{ opacity: .55; cursor: not-allowed; border-color: #f56c6c; color: #909399; text-decoration: line-through; }
.combo-picker .items > .item > .item-name > .item-soldout-tag{ margin-left: 6px; font-size: 11px; color: #fff; background: #f01414; padding: 1px 5px; border-radius: 4px; vertical-align: middle; font-weight: 600; }
.combo-picker .items > .item.fixed-item{ cursor: default; border-style: dashed; }
.combo-picker .items > .item > .item-price{ color: var(--accent); }
.combo-picker .items > .item > .item-price > .upgrade{ color: #e6a23c; font-size: 12px; }
.combo-picker .items > .item > .item-tag{ font-size: 12px; color: #67c23a; }
.combo-picker .sel-detail{ border: 1px solid var(--primary); border-radius: 8px; padding: 10px 12px; margin: 8px 0; background: #f7fbfe; }
.combo-picker .sel-detail > .sel-title{ font-size: 13px; font-weight: bold; color: #07111b; margin-bottom: 4px; }
.combo-picker .mod-row{ margin-bottom: 8px; font-size: 16px; }
.combo-picker .mod-row > .mod-head{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.combo-picker .mod-row > .mod-head > .mod-label{ color: #606266; white-space: nowrap; line-height: 26px; font-weight: 500; }
.combo-picker .mod-row > .mod-head > .mod-label > .mod-range{ color: #e6a23c; font-size: 13px; }
.combo-picker .mod-row > .mod-head > .mod-label > .mod-required{ color: #fff; background: #f56c6c; border-radius: 3px; font-size: 11px; padding: 0 3px; margin-right: 4px; }
.combo-picker .mod-row > .mod-items{ display: flex; flex-wrap: wrap; gap: 8px; }
.combo-picker .mod-row > .mod-head > .mod-status{ flex: 0 0 auto; font-size: 16px; color: #909399; white-space: nowrap; line-height: 26px; }
.combo-picker .mod-row > .mod-head > .mod-status.done{ color: #e64545; font-weight: bold; }
.combo-picker .mod-item{
    display: inline-block;
    margin: 0;
    padding: 8px 14px;
    border: 1px solid #e4e7ed;
    border-radius: 10px;
    cursor: pointer;
    color: #333;
    font-size: 16px;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    transition: all 0.15s ease;
}
.combo-picker .mod-item:hover{ border-color: #c0c4cc; }
.combo-picker .mod-item:active{ transform: scale(0.97); }
.combo-picker .mod-item.active{
    border-color: #e64545;
    color: #e64545;
    background: rgba(230,69,69,0.08);
    box-shadow: 0 0 0 1px #e64545;
}
.combo-picker .mod-item > .delta-up{ color: var(--accent); }
.combo-picker .mod-item > .delta-down{ color: #67c23a; }
.combo-picker > .footer{
    flex: 0 0 auto;
    padding: 10px 16px;
    border-top: 1px solid #ebeef5;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
}
.combo-picker > .footer > .total{ flex: 1; font-size: 15px; }
.combo-picker > .footer > .total > .price{ color: var(--accent); font-weight: bold; font-size: 18px; }
.combo-picker > .footer > .total > .extra{ font-size: 12px; color: #e6a23c; }
.combo-picker > .footer > .submit{ width: 140px; }
</style>
