<template>
    <div>
        <div id="commodities">
            <div class="goods" style="bottom: 48px">
                <div class="menu-wrapper" ref="menuWrapper">
                    <ul>
                        <li v-for="(item,index) in goods" :key='index' :class="{'menu-item':true,'current':currentIndex === index}" @click="selectMenu(index,$event)" ref="menuList">
                            <span class="text border-1px">
                                {{item.name}}
                                <span class="cat-count" v-if="getCatItemCount(item)">{{ getCatItemCount(item) }}</span>
                                <span v-if="item.slotActive" class="slot-badge">{{ item.slotName }}</span>
                            </span>
                        </li>
                    </ul>
                </div>
                <div class="foods-wrapper" ref="foodsWrapper">
                    <ul>
                        <li v-for="(item,index) in goods" :key='index' class="food-list food-list-hook">
                            <h1 class="title">{{item.name}}<span v-if="item.slotActive" class="slot-title-badge">{{ item.slotName }}時段</span></h1>
                            <ul>
                                <li @click="selectFood(food,$event)" v-for="food in item.foods" :key='food._id' class="food-item">
                                    <div class="icon" v-if="qrSetting.showImages">
                                        <img width="57" height="57" :src="food.img">
                                    </div>
                                    <div class="contents">
                                        <div class="name-row">
                                            <h2 class="name">{{food.name}}</h2>
                                            <div class="price">
                                                <template v-if="getFoodCount(food) > 0">
                                                    <span class="now">{{ getFoodCount(food) }}份 ${{ Math.round(food.price * getFoodCount(food) * 100) / 100 }}</span>
                                                </template>
                                                <template v-else>
                                                    <span class="now">${{food.price}}</span><span class="old" v-show="food.isDiscount && qrSetting.showDiscount">${{food.onSale}}</span>
                                                </template>
                                            </div>
                                            <div class="cartcontrol-wrapper" v-if="!food.soldOut">
                                                <el-button v-if="food.isCombo || food._isCombo" size="mini" type="primary" round @click.stop.prevent="openCombo(food)">選搭配</el-button>
                                                <CartControl v-else-if="!(qrSetting.showSpecs && food.specs && food.specs.length)" :food="food" :require-mods="hasMandatoryMods(food)" @require-mods="openFoodDetail(food)" @item-added="onItemAdded(food)" @item-removed="onItemRemoved(food)"></CartControl>
                                                <el-button v-else size="mini" type="primary" round @click.stop.prevent="selectFood(food,$event)">選規格</el-button>
                                            </div>
                                        </div>
                                        <div class="mods-summary" v-if="modsMap[food._id] && modsMap[food._id].length">
                                            {{ modsMap[food._id].join('、') }}
                                        </div>
                                        <div class="desc" v-if="qrSetting.showDescribe">{{food.describe}}</div>
                                        <div v-if="qrSetting.showStock && !food.soldOut && food.stock >= 0" class="stock-line">剩餘 {{ food.stock }} 份</div>
                                        <div class="food-bottom">
                                            <div v-if="food.soldOut" class="sold-out">已售罄</div>
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </li>
                    </ul>
                </div>
            </div>
            <ShopCart ref="shopcart" :selectFoods="selectFoods" :effective-order="effectiveOrder" :price-override="cartPriceOverride" :showConfirm="showConfirm" :id="id" :sentItems="sentItems" :show-images="qrSetting.showImages" :show-discount="qrSetting.showDiscount" :service-charge-enabled="qrSetting.serviceChargeEnabled" :service-charge-rate="qrSetting.serviceChargeRate" @emptyCart="clearCartItems" @cart-count-changed="onCartCountChanged" @sent-panel-toggle="onSentPanelToggle"></ShopCart>
        </div>
        <CommodityDetail ref="detail" :food="selectedFood" :qr-setting="qrSetting" @add="addCartItem"></CommodityDetail>
        <ComboPicker ref="comboPicker" @add="addCartItem"></ComboPicker>
    </div>
</template>

<script>
import BScroll from 'better-scroll'
import ShopCart from '@/components/user/ShopCart'
import CartControl from '@/components/user/CartControl'
import CommodityDetail from '@/components/user/CommodityDetail'
import ComboPicker from '@/components/user/ComboPicker'
import { computeBundles } from '@/utils/bundle'
export default {
  name: 'commoditiesList',
  props: ['id'],
  data () {
    return {
      goods: [],
      listHeight: [],
      scrollY: 0,
      drop: [],
      selectedFood: {},
      showConfirm: false,
      cartItems: [],
      sentItems: [],
      modsMap: {},
      modCodeList: [],
      matchingRules: [],
      bundleGroups: [],
      lastCartTotal: 0,
      sentPanelVisible: false,
      qrSetting: {
        showImages: true,
        showDescribe: true,
        showStock: false,
        showModPrices: true,
        showSoldOutItems: true,
        showDiscount: true,
        showSpecs: false,
        serviceChargeEnabled: false,
        serviceChargeRate: 10
      }
    }
  },
  methods: {
    qrColor (category) {
      const palette = ['#e74c3c', '#e67e22', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#d35400', '#2c3e50', '#c0392b', '#009688', '#34495e', '#7f8c8d']
      let hash = 0
      const key = String(category || 'default')
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 997
      return palette[hash % palette.length]
    },
    getCatItemCount (cat) {
      let count = 0
      ;(cat.foods || []).forEach(f => {
        count += this.getFoodCount(f)
      })
      return count
    },
    getFoodCount (food) {
      let count = food.count || 0
      this.cartItems.forEach(item => {
        if (String(item._id) === String(food._id) || String(item.commodityId) === String(food._id)) {
          count += item.count || 0
        }
      })
      return count
    },
    onItemAdded (food) {
      const cartItem = this.cartItems.find(x => String(x._id) === String(food._id) || String(x.commodityId) === String(food._id))
      if (cartItem && cartItem.mods && cartItem.mods.length) {
        this.$set(this.modsMap, food._id, cartItem.mods.map(m => typeof m === 'string' ? m : m.name))
      }
    },
    onItemRemoved (food) {
      const cartItem = this.cartItems.find(x => String(x._id) === String(food._id) || String(x.commodityId) === String(food._id))
      if (cartItem && cartItem.count <= 1) {
        this.$delete(this.modsMap, food._id)
      }
    },
    onCartCountChanged (count) {
      if (count > this.lastCartTotal) {
        this.pulseCart = true
        setTimeout(() => { this.pulseCart = false }, 600)
      }
      this.lastCartTotal = count
    },
    onSentPanelToggle (visible) {
      this.sentPanelVisible = visible
    },
    selectMenu (index, event) {
      // 把原生自帶的click事件過濾掉
      if (!event._constructed) {
        return
      }
      const foodList = this.$refs.foodsWrapper.getElementsByClassName('food-list-hook')
      const el = foodList[index]
      this.foodScroll.scrollToElement(el, 300)
    },
    selectFood (food, event) {
      if (!event._constructed) {
        return
      }
      if (food.isCombo || food._isCombo) {
        this.$refs.comboPicker.show(food.isCombo ? food : food._comboData)
        return
      }
      this.selectedFood = food
      this.$refs.detail.show()
    },
    openCombo (food) {
      this.$refs.comboPicker.show(food.isCombo ? food : food._comboData)
    },
    hasMandatoryMods (food) {
      const cats = food.modCategories || []
      if (!cats.length) return false
      return this.modCodeList.some(m => m.mandatory && cats.indexOf(m.category) >= 0)
    },
    openFoodDetail (food) {
      this.selectedFood = food
      this.$refs.detail.show()
    },
    addCartItem (item) {
      let key = item._id
      if (item.spec) {
        key = item._id + '|' + item.spec
      } else if (item.isCombo) {
        const parts = (item.contents || []).map(c => c.name).join('+')
        key = 'combo_' + item._id + '|' + parts
      }
      if (item.mods && item.mods.length) {
        key += '|mods:' + item.mods.map(m => (typeof m === 'string' ? m : m.name)).join(',')
      }
      const exist = this.cartItems.find(x => x.key === key)
      if (exist) {
        exist.count++
      } else {
        this.cartItems.push(Object.assign({ key, count: 1, onSale: 0 }, item))
      }
    },
    clearCartItems () {
      this.cartItems = []
      this.sentPanelVisible = true
      this.fetchSentItems()
    },
    fetchSentItems () {
      if (!this.id) return
      this.$axios.get('/api/order/current', { params: { deskNo: this.id } })
        .then(res => {
          if (res.data && res.data.order && res.data.order.length) {
            this.sentItems = res.data.order.map(item => ({
              name: item.name,
              count: item.count || 1,
              price: item.customPrice || item.price || 0,
              mods: item.mods
            }))
          } else {
            this.sentItems = []
            this.sentPanelVisible = false
          }
        })
        .catch(() => { this.sentItems = [] })
    },
    _initScroll () {
      this.meunScroll = new BScroll(this.$refs.menuWrapper, {
        click: true
      })
      this.foodScroll = new BScroll(this.$refs.foodsWrapper, {
        click: true,
        probeType: 3
      })
      this.foodScroll.on('scroll', (pos) => {
        if (pos.y <= 0) {
          this.scrollY = Math.abs(Math.round(pos.y))
        }
      })
    },
    _calculateHeight () {
      const foodList = this.$refs.foodsWrapper.getElementsByClassName('food-list-hook')
      let height = 0
      this.listHeight.push(height)
      for (let i = 0; i < foodList.length; i++) {
        const item = foodList[i]
        height += item.clientHeight
        this.listHeight.push(height)
      }
    },
    _followScroll (index) {
      if (!this.meunScroll) return
      const menuList = this.$refs.menuList
      const el = menuList && menuList[index]
      if (!el) return
      this.meunScroll.scrollToElement(el, 300, 0, -100)
    }
  },
  computed: {
    currentIndex () {
      const lastIndex = Math.max(this.goods.length - 1, 0)
      for (let i = 0; i < this.listHeight.length; i++) {
        const height1 = this.listHeight[i]
        const height2 = this.listHeight[i + 1]
        if (!height2 || (this.scrollY >= height1 && this.scrollY < height2)) {
          this._followScroll(Math.min(i, lastIndex))
          return Math.min(i, lastIndex)
        }
      }
      return 0
    },
    selectFoods () {
      const foods = []
      this.goods.forEach((good) => {
        good.foods.forEach((food) => {
          if (food.count) {
            foods.push(food)
          }
        })
      })
      this.cartItems.forEach(item => {
        if (item.count) foods.push(item)
      })
      return foods
    },
    matchingRuleCombos () {
      const rules = (this.matchingRules || []).filter(r => r.enabled !== false)
      if (!rules.length) return []
      const flat = []
      ;(this.goods || []).forEach(cat => {
        ;(cat.foods || []).forEach(f => {
          if (f._isCombo || f.isCombo || f._isModCode || f._isModCategory) return
          flat.push(f)
        })
      })
      if (!flat.length) return []
      const groupPriceMap = {}
      ;(this.bundleGroups || []).forEach(g => { groupPriceMap[String(g._id)] = Number(g.price) || 0 })
      const out = []
      rules.forEach(r => {
        const triggerIds = (r.triggerCategoryIds || []).map(String)
        const addonIds = (r.addonCategoryIds || []).map(String)
        const groupIds = (r.bundleGroupIds || []).map(String)
        const addonPrice = Number(r.addonPrice !== undefined ? r.addonPrice : r.combinedPrice) || 0
        const triggerItems = flat
          .filter(f => triggerIds.length ? triggerIds.includes(String(f.categoryId || '')) : true)
          .map(f => ({ commodityId: f._id, name: f.name, price: f.price, upgradePrice: Number(f.price) || 0 }))
        let addonItems
        if (groupIds.length) {
          // 新：撞跟餐組別，跟餐價取自組別
          addonItems = flat
            .filter(f => f.bundleGroupId && groupIds.includes(String(f.bundleGroupId)))
            .map(f => ({ commodityId: f._id, name: f.name, price: f.price, upgradePrice: groupPriceMap[String(f.bundleGroupId)] || 0 }))
        } else {
          // 舊：撞跟餐分類
          addonItems = flat
            .filter(f => addonIds.length ? addonIds.includes(String(f.categoryId || '')) : true)
            .map(f => ({ commodityId: f._id, name: f.name, price: f.price, upgradePrice: addonPrice }))
        }
        if (!triggerItems.length || !addonItems.length) return
        out.push({
          _id: 'mrule_' + r._id,
          name: r.name,
          price: 0,
          type: 'select',
          autoBundle: true,
          bundlePriority: r.priority || 0,
          effectiveTime: r.effectiveTime,
          departmentSplit: [],
          showItems: true,
          _matchingRule: true,
          groups: [
            { name: '主食', min: 1, max: 1, groupPrice: 0, items: triggerItems },
            { name: '跟餐', min: 1, max: 1, groupPrice: 0, items: addonItems }
          ]
        })
      })
      return out
    },
    bundlePlan () {
      if (!this.matchingRuleCombos.length) return { bundles: [], bundledIndexes: [], totalSavings: 0 }
      return computeBundles(this.selectFoods, this.matchingRuleCombos, { bundleEnabled: true, bundleRule: 'priority' })
    },
    // 跟餐價規則：跟餐品項在 selectFoods 中的 index → { qty: 已捆綁數量, price: 跟餐價 }
    // 用於購物車即時顯示跟餐價（例如 $0），與 POS 一致。
    cartPriceOverride () {
      const map = {}
      ;(this.bundlePlan.bundles || []).forEach(b => {
        const combo = this.matchingRuleCombos.find(c => String(c._id) === String(b.comboId))
        if (!combo || !combo._matchingRule) return
        ;(b.items || []).forEach(x => {
          if (x.gi === 0) return
          const group = (combo.groups || [])[x.gi]
          const comboItem = (group && group.items) ? group.items[x.ii] : null
          const upgrade = Number(comboItem && comboItem.upgradePrice) || 0
          const entry = map[x.index] || (map[x.index] = { qty: 0, price: upgrade })
          entry.qty += (x.qty || 1)
        })
      })
      return map
    },
    effectiveOrder () {
      const plan = this.bundlePlan
      const srcItems = this.selectFoods || []
      if (!plan.bundles.length) {
        const total = srcItems.reduce((sum, f) => sum + (f.price || 0) * (f.count || 1), 0)
        return { items: srcItems, totalPrice: Math.round(total * 100) / 100 }
      }
      const out = []
      const consumed = {}
      ;(plan.bundles || []).forEach(b => {
        const combo = this.matchingRuleCombos.find(c => String(c._id) === String(b.comboId))
        if (!combo) return
        ;(b.items || []).forEach(x => {
          const src = srcItems[x.index]
          if (!src) return
          const group = (combo.groups || [])[x.gi]
          const comboItem = (group && group.items) ? group.items[x.ii] : null
          const upgrade = Number(comboItem && comboItem.upgradePrice) || 0
          const copy = Object.assign({}, src, { count: x.qty || 1 })
          if (x.gi !== 0) {
            const modsExtra = (src.mods || []).reduce((s, m) => s + (m && m.price ? Number(m.price) : 0), 0)
            copy.price = Math.round((upgrade + modsExtra) * 100) / 100
            copy.customPrice = 0
            copy.bundlePrice = true
          }
          out.push(copy)
          consumed[x.index] = (consumed[x.index] || 0) + (x.qty || 1)
        })
      })
      srcItems.forEach((it, index) => {
        const used = consumed[index] || 0
        const total = it.count || 1
        const remaining = total - used
        if (remaining <= 0) return
        if (remaining === total) out.push(it)
        else out.push(Object.assign({}, it, { count: remaining }))
      })
      const totalPrice = out.reduce((sum, f) => sum + (f.price || 0) * (f.count || 1), 0)
      return { items: out, totalPrice: Math.round(totalPrice * 100) / 100 }
    }
  },
  created () {
    const qs = this.$axios.get('/api/qrsetting/get')
      .then(res => { this.qrSetting = Object.assign(this.qrSetting, res.data || {}) })
      .catch(() => {})
    const pos = this.$axios.get('/api/possetting/get')
      .then(res => {
        const d = res.data || {}
        this.qrSetting.serviceChargeEnabled = !!d.serviceChargeEnabled
        this.qrSetting.serviceChargeRate = d.serviceChargeRate || 10
      })
      .catch(() => {})
    const mods = this.$axios.get('/api/modcode/list', { params: { channel: 'qr' } })
      .then(res => { this.modCodeList = res.data || [] })
      .catch(() => {})
    const rules = this.$axios.get('/api/matchingrule/list')
      .then(res => { this.matchingRules = res.data || [] })
      .catch(() => {})
    const bgs = this.$axios.get('/api/bundlegroup/list')
      .then(res => { this.bundleGroups = res.data || [] })
      .catch(() => {})
    const menu = this.$axios.get('/api/commodity/menu', { params: { mode: '堂食', channel: 'qr' } })
      .then(res => {
        this.goods = res.data || []
        return this.$axios.get('/api/combo/menu', { params: { channel: 'qr' } }).then(r => {
          const combos = r.data || []
          // 去重：已在分類（CategoryItem）裡顯示過的套餐不再重複塞進「套餐」分類
          const existing = new Set()
          this.goods.forEach(g => (g.foods || []).forEach(f => { if (f._isCombo) existing.add(String(f._id)) }))
          const extra = combos.filter(c => !existing.has(String(c._id)))
          if (extra.length) {
            this.goods.push({
              name: '套餐',
              type: 999,
              foods: extra.map(c => Object.assign({}, c, { isCombo: true }))
            })
          }
        })
      })
    Promise.all([qs, pos, menu, mods, rules, bgs])
      .then(() => {
        // QR 功能設定：隱藏沽清品項
        if (!this.qrSetting.showSoldOutItems) {
          this.goods = this.goods.map(g => Object.assign({}, g, { foods: (g.foods || []).filter(f => !f.soldOut) }))
        }
        this.$nextTick(() => {
          this._initScroll()
          this._calculateHeight()
        })
        this.fetchSentItems()
      })
      .catch(err => console.log(err))
  },
  components: {
    ShopCart,
    CartControl,
    CommodityDetail,
    ComboPicker
  }
}
</script>

<style scoped>
    #commodities > .goods{
        display: flex;
        position: absolute;
        top: 0;
        bottom: 48px;
        width: 100%;
        overflow: hidden;
    }
    #commodities > .goods > .menu-wrapper{
        flex: 0 0 84px;
        width: 84px;
        background: #f5f7fa;
        border-right: 1px solid #e8ecf1;
    }
    .menu-wrapper > ul > .menu-item{
        position: relative;
        display: table;
        height: 56px;
        width: 60px;
        line-height: 15px;
        padding: 0 12px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .menu-wrapper > ul > .menu-item:active{
        background: rgba(0,0,0,0.03);
    }
    .menu-wrapper > ul > .current{
        position: relative;
        z-index: 10;
        margin-top: -1px;
        background: linear-gradient(135deg, var(--primary), var(--primary2));
        box-shadow: 0 4px 12px var(--primary-glow);
    }
    .menu-wrapper > ul > .current .text{
        color: #fff;
        font-size: 13px;
        font-weight: 800;
    }
    .goods .text{
        display: table-cell;
        vertical-align: middle;
        text-align: center;
        color: #64748b;
        width: 60px;
        font-size: 12px;
        position: relative;
    }
    .goods .text::after{
        display: block;
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        border-top: 1px solid #eef1f5;
        content: ' ';
    }
    #commodities > .goods > .foods-wrapper{
        flex: 1;
        min-width: 0;
        background: #fff;
    }
    .goods > .foods-wrapper .title{
        padding-left: 14px;
        height: 30px;
        line-height: 30px;
        border-left: 3px solid var(--primary);
        font-size: 13px;
        color: #1e3a5f;
        background: #f8f9fb;
        font-weight: 600;
    }
    .cat-count{
        position: absolute;
        top: 4px;
        right: 2px;
        min-width: 16px;
        height: 16px;
        line-height: 16px;
        text-align: center;
        border-radius: 8px;
        padding: 0 4px;
        font-size: 10px;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(135deg, var(--accent), var(--accent2));
        box-shadow: 0 2px 6px var(--accent-glow);
    }
    .slot-badge{
        margin-left: 6px;
        padding: 1px 8px;
        border-radius: 10px;
        background: linear-gradient(135deg, #f56c6c, #f89898);
        color: #fff;
        font-size: 10px;
        line-height: 16px;
        vertical-align: 1px;
    }
    .slot-title-badge{
        margin-left: 8px;
        padding: 1px 10px;
        border-radius: 10px;
        background: linear-gradient(135deg, #f56c6c, #f89898);
        color: #fff;
        font-size: 11px;
    }
    .goods > .foods-wrapper .food-item{
        display: flex;
        margin: 14px 16px;
        padding-bottom: 14px;
        position: relative;
    }
    .goods > .foods-wrapper .food-item::after{
        display: block;
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        border-top: 1px solid #f0f2f5;
        content: ' ';
    }
    .goods > .foods-wrapper .food-item:last-of-type::after{
        border-top: 0px solid rgba(7,17,27,0.1);
    }
    .foods-wrapper .food-item > .icon{
        flex: 0 0 62px;
        margin-right: 12px;
    }
    .foods-wrapper .food-item > .icon > img{
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .foods-wrapper .food-item > .icon .food-avatar{
        width: 62px;
        height: 62px;
        border-radius: 12px;
        color: #fff;
        font-size: 22px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        letter-spacing: 1px;
    }
    .food-item > .contents > .stock-line{
        margin-bottom: 4px;
        font-size: 11px;
        color: #e6a23c;
    }
    .foods-wrapper .food-item > .contents{
        flex: 1;
        min-width: 0;
    }
    .food-item > .contents > .name-row{
        display: flex;
        align-items: flex-start;
    }
    .food-item > .contents > .name-row > .name{
        flex: 0 1 auto;
        margin: 4px 8px 6px 0;
        line-height: 16px;
        font-size: 14px;
        color: #1e293b;
        font-weight: 600;
    }
    .food-item > .contents > .name-row > .price{
        flex-shrink: 0;
        margin-top: 4px;
        margin-left: auto;
        font-weight: 700;
        line-height: 16px;
        text-align: right;
    }
    .food-item > .contents > .name-row > .price > .now{
        margin-right: 8px;
        font-size: 15px;
        color: var(--accent);
    }
    .food-item > .contents > .name-row > .price > .old{
        text-decoration: line-through;
        font-size: 11px;
        color: #94a3b8;
    }
    .food-item > .contents > .desc{
        line-height: 14px;
        margin-bottom: 6px;
        font-size: 11px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .food-item > .contents > .name-row > .cartcontrol-wrapper{
        flex-shrink: 0;
        margin-left: 10px;
        display: flex;
        align-items: center;
    }
    .food-item > .contents > .sold-out{
        position: absolute;
        right: 0px;
        bottom: 18px;
        font-size: 13px;
        color: #94a3b8;
        font-weight: 500;
    }
</style>
