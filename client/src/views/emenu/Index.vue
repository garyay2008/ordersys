<template>
    <div id="emenu" :style="{ fontSize: baseFont }">
        <div class="emenu-header" :style="headerStyle">
            <span class="shop-name">{{ shopName }}</span>
            <span class="clock">{{ clock }}</span>
        </div>
        <div class="emenu-body">
            <div class="emenu-nav">
                <div
                    v-for="(cat, idx) in goods"
                    :key="idx"
                    class="emenu-nav-item"
                    :class="{ active: activeIndex === idx }"
                    @click="selectCategory(idx)">
                    {{ cat.name }}
                </div>
            </div>
            <div class="emenu-main">
                <div class="emenu-category-title">{{ currentCategory.name }}</div>
                <div class="emenu-grid" :style="{ gridTemplateColumns: gridColumns }">
                    <div
                        v-for="food in currentFoods"
                        :key="food._id"
                        class="emenu-card"
                        :class="{ 'sold-out': food.soldOut }">
                        <div class="emenu-img" v-if="setting.showImages">
                            <img :src="food.img" v-if="food.img">
                            <div v-else class="emenu-img-placeholder">{{ food.name.charAt(0) }}</div>
                        </div>
                        <div class="emenu-info">
                            <div class="emenu-name">{{ food.name }}</div>
                            <div class="emenu-desc" v-if="setting.showDescribe && food.describe">{{ food.describe }}</div>
                            <div class="emenu-price" v-if="setting.showPrice">
                                <template v-if="food.soldOut">已售罄</template>
                                <template v-else>¥{{ food.price }}</template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
  name: 'emenuBoard',
  props: ['id'],
  data () {
    return {
      shopName: '',
      setting: {
        showImages: true,
        showPrice: true,
        showDescribe: false,
        showSoldOut: true,
        autoRotate: true,
        rotateInterval: 8,
        columns: 4,
        fontScale: 1,
        categoryIds: [],
        themeColor: ''
      },
      goods: [],
      activeIndex: 0,
      clock: '',
      rotateTimer: null,
      pollTimer: null
    }
  },
  computed: {
    baseFont () {
      return ((this.setting.fontScale || 1) * 16) + 'px'
    },
    columns () {
      return Math.max(1, parseInt(this.setting.columns) || 4)
    },
    gridColumns () {
      return `repeat(${this.columns}, 1fr)`
    },
    headerStyle () {
      return this.setting.themeColor ? { background: this.setting.themeColor } : {}
    },
    currentCategory () {
      return this.goods[this.activeIndex] || { name: '', foods: [] }
    },
    currentFoods () {
      const foods = this.currentCategory.foods || []
      if (this.setting.showSoldOut) return foods
      return foods.filter(f => !f.soldOut)
    }
  },
  methods: {
    loadShop () {
      this.$axios.get('/api/shop/get')
        .then(res => { this.shopName = (res.data && res.data.shopName) || '' })
        .catch(() => {})
    },
    loadSetting () {
      return this.$axios.get('/api/emenu/setting')
        .then(res => { this.setting = Object.assign(this.setting, res.data || {}) })
        .catch(() => {})
    },
    loadMenu () {
      return this.$axios.get('/api/commodity/menu', { params: { mode: '堂食', channel: 'qr' } })
        .then(res => {
          this.goods = res.data || []
          return this.$axios.get('/api/combo/menu').then(r => {
            const combos = r.data || []
            if (combos.length) {
              this.goods.push({
                name: '套餐',
                type: 999,
                foods: combos.map(c => Object.assign({}, c, { isCombo: true }))
              })
            }
          })
        })
        .catch(() => {})
    },
    selectCategory (idx) {
      this.activeIndex = idx
    },
    nextCategory () {
      if (!this.goods.length) return
      this.activeIndex = (this.activeIndex + 1) % this.goods.length
    },
    updateClock () {
      const d = new Date()
      const pad = n => String(n).padStart(2, '0')
      this.clock = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    },
    startClock () {
      this.updateClock()
      setInterval(this.updateClock, 30000)
    },
    startRotate () {
      if (this.rotateTimer) clearInterval(this.rotateTimer)
      const seconds = Math.max(3, parseInt(this.setting.rotateInterval) || 8)
      this.rotateTimer = setInterval(() => {
        if (this.setting.autoRotate) this.nextCategory()
      }, seconds * 1000)
    },
    startPolling () {
      if (this.pollTimer) clearInterval(this.pollTimer)
      this.pollTimer = setInterval(() => { this.loadMenu() }, 30000)
    }
  },
  created () {
    this.loadShop()
    this.loadMenu()
    this.startClock()
    this.startPolling()
    this.loadSetting().then(() => this.startRotate())
  },
  beforeDestroy () {
    if (this.rotateTimer) clearInterval(this.rotateTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
  }
}
</script>

<style scoped>
#emenu{
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #0f172a;
    color: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-family: "Helvetica Neue", Helvetica, Arial, "PingFang TC", "Microsoft JhengHei", sans-serif;
}
.emenu-header{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 32px;
    height: 72px;
    flex-shrink: 0;
    background: linear-gradient(135deg, #ff5722, #ff9800);
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
}
.shop-name{
    font-size: 1.6em;
    font-weight: 700;
    letter-spacing: 2px;
}
.clock{
    font-size: 1.1em;
    opacity: 0.92;
    font-variant-numeric: tabular-nums;
}
.emenu-body{
    flex: 1;
    display: flex;
    overflow: hidden;
}
.emenu-nav{
    width: 180px;
    flex-shrink: 0;
    background: #1e293b;
    overflow-y: auto;
    padding: 12px 0;
}
.emenu-nav-item{
    padding: 14px 20px;
    font-size: 1.05em;
    cursor: pointer;
    color: #cbd5e1;
    border-left: 4px solid transparent;
    transition: all 0.2s ease;
}
.emenu-nav-item:hover{
    color: #fff;
    background: #28354a;
}
.emenu-nav-item.active{
    color: #fff;
    background: #334155;
    border-left-color: #ff9800;
    font-weight: 700;
}
.emenu-main{
    flex: 1;
    padding: 24px 32px;
    overflow-y: auto;
}
.emenu-category-title{
    font-size: 1.8em;
    font-weight: 700;
    margin-bottom: 20px;
    padding-left: 14px;
    border-left: 5px solid #ff5722;
    letter-spacing: 1px;
}
.emenu-grid{
    display: grid;
    gap: 20px;
}
.emenu-card{
    background: #1e293b;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    transition: opacity 0.3s ease;
}
.emenu-card.sold-out{
    opacity: 0.45;
}
.emenu-img img{
    width: 100%;
    height: 160px;
    object-fit: cover;
    display: block;
    background: #334155;
}
.emenu-img-placeholder{
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3em;
    background: #334155;
    color: #94a3b8;
}
.emenu-info{
    padding: 14px 16px;
}
.emenu-name{
    font-size: 1.15em;
    font-weight: 600;
    line-height: 1.3;
}
.emenu-desc{
    font-size: 0.85em;
    color: #94a3b8;
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.emenu-price{
    font-size: 1.3em;
    font-weight: 700;
    color: #ff5722;
    margin-top: 8px;
}
</style>
