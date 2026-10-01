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
                    <h3 class="group-name">
                        {{ g.name }}
                        <span class="group-rule" v-if="!g.fixed">（選 {{ g.min || 1 }} ~ {{ g.max || 1 }} 項<span v-if="g.allowRepeat">，可重複</span>）</span>
                        <span class="group-rule" v-else>（固定出餐）</span>
                        <span class="station" v-if="g.station">檔口：{{ g.station }}</span>
                    </h3>

                    <!-- 固定出餐組：自動帶出，僅展示 -->
                    <div class="items" v-if="g.fixed">
                        <div v-for="(item, ii) in g.items" :key="ii" class="item fixed-item">
                            <span class="item-name">{{ item.name }}</span>
                            <span class="item-tag">自動帶出</span>
                        </div>
                    </div>

                    <!-- 選單組 -->
                    <div class="items" v-else>
                        <div v-for="(item, ii) in g.items" :key="ii" class="item"
                             :class="{active: (selCount(gi, item) > 0)}"
                             @click="toggleItem(gi, item)">
                            <span class="item-name">{{ item.name }}<span v-if="selCount(gi, item) > 1"> x{{ selCount(gi, item) }}</span></span>
                            <span class="item-price">${{ item.price }}<span v-if="item.upgradePrice" class="upgrade"> +{{ item.upgradePrice }}</span></span>
                        </div>
                    </div>

                    <!-- 選中項的客製化/換菜 -->
                    <template v-if="!g.fixed">
                      <div v-for="(sel, si) in (selected[gi] || [])" :key="'sel' + si" class="sel-detail">
                          <div class="sel-title">{{ sel.item.name }} <span v-if="sel.count > 1">x{{ sel.count }}</span></div>
                          <div v-if="sel.item.modifiers && sel.item.modifiers.length" class="mod-row">
                              <span class="mod-label">客製化：</span>
                              <span v-for="(m, mi) in sel.item.modifiers" :key="mi" class="mod-item"
                                    :class="{active: sel.modifiers.indexOf(m) >= 0}"
                                    @click="toggleModifier(gi, si, m)">
                                  {{ m.code ? m.code + ' ' : '' }}{{ m.name }}<span v-if="m.price">+{{ m.price }}</span>
                              </span>
                          </div>
                          <div v-if="sel.item.substitutes && sel.item.substitutes.length" class="mod-row">
                              <span class="mod-label">換菜：</span>
                              <span class="mod-item" :class="{active: !sel.substitute}" @click="sel.substitute = null">不換</span>
                              <span v-for="(s, ssi) in sel.item.substitutes" :key="ssi" class="mod-item"
                                    :class="{active: sel.substitute === s}"
                                    @click="sel.substitute = (sel.substitute === s ? null : s)">
                                  {{ s.name }}<span :class="s.priceDelta > 0 ? 'delta-up' : 'delta-down'">{{ s.priceDelta >= 0 ? '+' + s.priceDelta : s.priceDelta }}</span>
                              </span>
                          </div>
                      </div>
                    </template>
                </div>
            </div>
            <div class="footer" v-if="combo">
                <div class="total">
                    合計：<span class="price">${{ totalPrice }}</span>
                    <span class="extra" v-if="extraTotal > 0">（含加價 +${{ extraTotal }}）</span>
                </div>
                <el-button type="primary" class="submit" @click="confirm">加入購物車</el-button>
            </div>
        </div>
    </transition>
</template>

<script>
export default {
  name: 'comboPicker',
  data () {
    return {
      showFlag: false,
      combo: null,
      selected: {}
    }
  },
  computed: {
    extraTotal () {
      let extra = 0
      const groups = this.combo ? (this.combo.groups || []) : []
      groups.forEach((g, gi) => {
        const sels = this.selected[gi] || []
        const entered = g.fixed ? ((g.items || []).length > 0) : (sels.length > 0)
        if (entered && Number(g.groupPrice) > 0) extra += Number(g.groupPrice)
        sels.forEach(s => {
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
    show (combo) {
      this.combo = combo
      this.selected = {}
      this.showFlag = true
    },
    selCount (gi, item) {
      const sel = this.selected[gi] || []
      const s = sel.find(x => x.item.name === item.name)
      return s ? s.count : 0
    },
    toggleItem (gi, item) {
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
    toggleModifier (gi, si, m) {
      const sel = this.selected[gi][si]
      if (!sel.modifiers) this.$set(sel, 'modifiers', [])
      const idx = sel.modifiers.indexOf(m)
      if (idx >= 0) sel.modifiers.splice(idx, 1)
      else sel.modifiers.push(m)
    },
    confirm () {
      const groups = this.combo.groups || []
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi]
        if (g.fixed) continue
        const sel = this.selected[gi] || []
        const count = sel.reduce((sum, s) => sum + s.count, 0)
        if (count < (g.min || 1)) {
          this.$message({ type: 'warning', message: `請為「${g.name}」選擇至少 ${g.min || 1} 項` })
          return
        }
      }
      const contents = []
      groups.forEach((g, gi) => {
        if (g.fixed) {
          g.items.forEach(item => {
            contents.push({ name: item.name, price: item.price, station: g.station })
          })
        } else {
          (this.selected[gi] || []).forEach(s => {
            let label = s.item.name
            if (s.count > 1) label += ' x' + s.count
            if (s.substitute) label += '→' + s.substitute.name
            contents.push({
              name: label,
              price: (s.item.price || 0) + (s.item.upgradePrice || 0) + (s.substitute ? (s.substitute.priceDelta || 0) : 0),
              station: g.station,
              mods: (s.modifiers || []).map(m => ({ id: m.modCodeId, name: m.name, price: m.price || 0, station: g.station }))
            })
            ;(s.modifiers || []).forEach(m => {
              contents.push({ name: '　· ' + m.name, price: m.price, station: g.station })
            })
          })
        }
      })
      this.$emit('add', {
        _id: this.combo._id,
        name: this.combo.name,
        price: this.totalPrice,
        img: this.combo.img,
        isCombo: true,
        contents
      })
      this.showFlag = false
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
.combo-picker > .header > .back{ position: absolute; left: 0; top: 0; padding: 0 10px; cursor: pointer; }
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
.combo-picker .items > .item.active{ border-color: var(--primary); color: var(--primary); background: var(--primary-soft); }
.combo-picker .items > .item.fixed-item{ cursor: default; border-style: dashed; }
.combo-picker .items > .item > .item-price{ color: var(--accent); }
.combo-picker .items > .item > .item-price > .upgrade{ color: #e6a23c; font-size: 12px; }
.combo-picker .items > .item > .item-tag{ font-size: 12px; color: #67c23a; }
.combo-picker .sel-detail{ border-left: 2px solid var(--primary); padding: 6px 0 6px 10px; margin: 8px 0; background: #f7fbfe; }
.combo-picker .sel-detail > .sel-title{ font-size: 13px; font-weight: bold; color: #07111b; margin-bottom: 4px; }
.combo-picker .mod-row{ margin-bottom: 4px; font-size: 12px; }
.combo-picker .mod-row > .mod-label{ color: #909399; margin-right: 6px; }
.combo-picker .mod-row > .mod-item{
    display: inline-block;
    margin: 0 6px 4px 0;
    padding: 3px 9px;
    border: 1px solid #dcdfe6;
    border-radius: 12px;
    cursor: pointer;
    color: #333;
}
.combo-picker .mod-row > .mod-item.active{ border-color: #e6a23c; color: #e6a23c; background: rgba(230,162,60,0.08); }
.combo-picker .mod-row > .mod-item > .delta-up{ color: var(--accent); }
.combo-picker .mod-row > .mod-item > .delta-down{ color: #67c23a; }
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
