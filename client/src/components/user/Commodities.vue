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
                            <h1 class="title" v-if="!item.describe">{{item.name}}<span v-if="item.slotActive" class="slot-title-badge">{{ item.slotName }}時段</span></h1>
                            <p class="category-desc" v-if="item.describe">{{ item.describe }}</p>
                            <ul>
                                <li @click="selectFood(food,$event)" v-for="food in item.foods" :key='food._id' class="food-item">
                                    <div class="icon" v-if="qrSetting.showImages">
                                        <img width="57" height="57" :src="food.img" loading="lazy" decoding="async">
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
            <ShopCart ref="shopcart" :selectFoods="selectFoods" :effective-order="effectiveOrder" :price-override="cartPriceOverride" :showConfirm="showConfirm" :id="id" :sentItems="sentItems" :hidden="overlayOpen" :show-images="qrSetting.showImages" :show-discount="qrSetting.showDiscount" :service-charge-enabled="qrSetting.serviceChargeEnabled" :service-charge-rate="qrSetting.serviceChargeRate" @emptyCart="clearCartItems" @cart-count-changed="onCartCountChanged" @sent-panel-toggle="onSentPanelToggle" @edit-mods="editCartMods"></ShopCart>
        </div>
        <el-dialog :visible.sync="showBundleDrinkPrompt" title="" width="80%" custom-class="bundle-drink-dialog" :show-close="false" :close-on-click-modal="false" append-to-body @closed="onBundleDrinkDialogClosed">
            <div class="bundle-drink-body">
                <p class="bundle-drink-title">你現在想加套餐的餐飲嗎？</p>
                <div class="bundle-drink-actions">
                    <el-button type="primary" round @click="chooseDrink">點餐飲</el-button>
                    <el-button round @click="dismissBundleDrink">遲啲點</el-button>
                </div>
            </div>
        </el-dialog>
        <CommodityDetail ref="detail" :food="selectedFood" :qr-setting="qrSetting" @add="addCartItem" @update="updateCartItem" @open="overlayOpen = true" @close="overlayOpen = false"></CommodityDetail>
        <ComboPicker ref="comboPicker" :mod-codes="modCodeList" :mod-code-categories="modCodeCategories" @add="addCartItem" @update="updateCartItem"></ComboPicker>
    </div>
</template>

<script>
import BScroll from 'better-scroll'
import ShopCart from '@/components/user/ShopCart'
import CartControl from '@/components/user/CartControl'
import CommodityDetail from '@/components/user/CommodityDetail'
import ComboPicker from '@/components/user/ComboPicker'
import { computeBundles, isEffectiveNow } from '@/utils/bundle'
import qrCache from '@/utils/qrCache'
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
      modCodeCategories: [],
      matchingRules: [],
      bundleGroups: [],
      lastCartTotal: 0,
      sentPanelVisible: false,
      showBundleDrinkPrompt: false,
      overlayOpen: false,
      bundleDrinkPromptDismissed: false,
      lastMainDishCount: 0,
      pendingDrinkCategoryIndex: -1,
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
      // 有規格 → 進詳情選規格
      if (this.qrSetting.showSpecs && food.specs && food.specs.length) {
        this.selectedFood = food
        this.$refs.detail.show()
      }
      // 普通貨品 → 點擊名字/價錢不加數量（只能按 + 加數量）
    },
    openCombo (food) {
      this.$refs.comboPicker.show(food.isCombo ? food : food._comboData)
    },
    // 跟 POS 一致：改碼類別開「自動彈出」時才自動打開改碼選單
    hasMandatoryMods (food) {
      const cats = food.modCategories || []
      if (!cats.length) return false
      const items = this.modCodeList.filter(m => cats.indexOf(m.category) >= 0)
      if (!items.length) return false
      return this.modCodeCategories.some(c => {
        if (!c.mandatory || cats.indexOf(c.name) < 0) return false
        // 有指定貨品時，只有這些貨品會自動彈出
        if (Array.isArray(c.commodityIds) && c.commodityIds.length) {
          return c.commodityIds.some(id => String(id) === String(food._id))
        }
        return true
      })
    },
    openFoodDetail (food) {
      this.selectedFood = food
      this.$refs.detail.show()
    },
    cartItemKey (item) {
      let key = item._id
      if (item.spec) {
        key = item._id + '|' + item.spec
      } else if (item.isCombo) {
        const parts = (item.contents || []).map(c => {
          let s = c.name
          if (c.mods && c.mods.length) {
            s += '[' + c.mods.map(m => (typeof m === 'string' ? m : (m.name || ''))).join(',') + ']'
          }
          return s
        }).join('+')
        key = 'combo_' + item._id + '|' + parts
      }
      if (item.mods && item.mods.length) {
        key += '|mods:' + item.mods.map(m => (typeof m === 'string' ? m : m.name)).join(',')
      }
      return key
    },
    addCartItem (item) {
      const key = this.cartItemKey(item)
      const exist = this.cartItems.find(x => x.key === key)
      if (exist) {
        exist.count++
      } else {
        this.cartItems.push(Object.assign({ key, count: 1, onSale: 0 }, item))
      }
    },
    // 修改購物車內未送貨品的改碼：以 targetKey 找到原 cart item，替換 mods 與價格（保留數量）
    updateCartItem ({ payload, targetKey }) {
      const idx = this.cartItems.findIndex(x => x.key === targetKey)
      if (idx < 0) return
      const existing = this.cartItems[idx]
      const key = this.cartItemKey(payload)
      this.cartItems.splice(idx, 1, Object.assign({}, payload, { key, count: existing.count, onSale: existing.onSale || 0 }))
    },
    // 從購物車點「修改」改碼：套餐走 ComboPicker、普通商品走 CommodityDetail 並預填
    editCartMods (item) {
      if (this.$refs.shopcart && this.$refs.shopcart.hideList) this.$refs.shopcart.hideList()
      if (item.isCombo) {
        const combo = this.comboDataById(item)
        if (combo) this.$refs.comboPicker.show(combo, item)
        return
      }
      const meta = this.foodMetaById()
      const food = meta[String(item._id)] || meta[String(item.commodityId)] || Object.assign({}, item)
      this.selectedFood = food
      this.$refs.detail.show(food, item)
    },
    // 依 cart item 找回套餐完整資料（含 groups）供 ComboPicker 重新開啟
    comboDataById (item) {
      const meta = this.foodMetaById()
      const f = meta[String(item._id)]
      if (!f) return null
      return f.isCombo ? f : (f._comboData || null)
    },
    // 依貨品 _id / commodityId 建立對照表，供查詢 categoryId / bundleGroupId
    foodMetaById () {
      const map = {}
      ;(this.goods || []).forEach(g => (g.foods || []).forEach(f => {
        if (f._id) map[String(f._id)] = f
      }))
      return map
    },
    // cart item 的跟餐組別 id（飲品判別）
    cartItemGroupId (item) {
      if (item.bundleGroupId) return String(item.bundleGroupId)
      const meta = this.foodMetaById()
      const m = meta[String(item._id)] || meta[String(item.commodityId)]
      return m && m.bundleGroupId ? String(m.bundleGroupId) : ''
    },
    // cart item 的主菜組別 id（主食判別）
    cartItemMainGroupId (item) {
      if (item.mainGroupId) return String(item.mainGroupId)
      const meta = this.foodMetaById()
      const m = meta[String(item._id)] || meta[String(item.commodityId)]
      return m && m.mainGroupId ? String(m.mainGroupId) : ''
    },
    // 判斷某品項（food/cart item）是否為規則 r 的「主食」側
    // 以主菜組別（triggerGroupIds）判別，留空 = 任意主食
    ruleTriggerMatches (item, r) {
      const trigGroups = (r.triggerGroupIds || []).map(String)
      if (trigGroups.length) {
        const mg = this.cartItemMainGroupId(item)
        return !!mg && trigGroups.includes(mg)
      }
      return true
    },
    // 找出「購物車已有主食、但未點對應跟餐」的撞餐規則（用於彈出加餐飲提示）
    pendingBundleDrinkRule () {
      const rules = (this.matchingRules || []).filter(r => r.enabled !== false && isEffectiveNow(r.effectiveTime))
      if (!rules.length) return null
      // 同一主菜組別的多條規則（如熱飲/凍飲）視為替代選項，合併計算飲品數
      const groups = new Map()
      rules.forEach(r => {
        const trigGroups = (r.triggerGroupIds || []).map(String)
        const key = trigGroups.length ? 'g:' + trigGroups.join(',') : '__any__'
        if (!groups.has(key)) {
          groups.set(key, { rule: r, trigGroups, drinkGroups: new Set() })
        }
        const g = groups.get(key)
        ;(r.bundleGroupIds || []).forEach(id => g.drinkGroups.add(String(id)))
      })
      const items = this.selectFoods || []
      for (const g of groups.values()) {
        if (!g.drinkGroups.size) continue
        let mainCount = 0
        let drinkCount = 0
        items.forEach(f => {
          const grp = this.cartItemGroupId(f)
          const isMain = this.ruleTriggerMatches(f, g.rule)
          if (isMain) mainCount += (f.count || 1)
          const isDrink = g.drinkGroups.size && grp && g.drinkGroups.has(grp)
          if (isDrink) drinkCount += (f.count || 1)
        })
        if (mainCount > drinkCount) return g.rule
      }
      return null
    },
    // 購物車內「主食」數量（偵測新增主食以重新允許提示）
    mainDishCount () {
      const rules = (this.matchingRules || []).filter(r => r.enabled !== false && isEffectiveNow(r.effectiveTime))
      if (!rules.length) return 0
      let count = 0
      ;(this.selectFoods || []).forEach(f => {
        const isMain = rules.some(r => this.ruleTriggerMatches(f, r))
        if (isMain) count += (f.count || 1)
      })
      return count
    },
    // 找出該規則對應跟餐飲品所在的分類 index（供捲動跳轉）
    findAddonCategoryIndex (rule) {
      const groupIds = (rule.bundleGroupIds || []).map(String)
      for (let i = 0; i < (this.goods || []).length; i++) {
        const foods = this.goods[i].foods || []
        const hit = foods.some(f => {
          if (groupIds.length) return f.bundleGroupId && groupIds.includes(String(f.bundleGroupId))
          return false
        })
        if (hit) return i
      }
      return -1
    },
    scrollToCategory (index) {
      if (index < 0 || !this.foodScroll) return
      const foodList = this.$refs.foodsWrapper.getElementsByClassName('food-list-hook')
      const el = foodList[index]
      if (el) this.foodScroll.scrollToElement(el, 300)
    },
    maybePromptBundleDrink () {
      if (this.showBundleDrinkPrompt) return
      // 新增主食時重新允許彈出提示（例如已點 A 餐+飲品後，再點早餐 G 應再次詢問）
      const mainCount = this.mainDishCount()
      if (mainCount > this.lastMainDishCount) {
        this.bundleDrinkPromptDismissed = false
      }
      this.lastMainDishCount = mainCount
      if (this.bundleDrinkPromptDismissed) return
      if (this.pendingBundleDrinkRule()) this.showBundleDrinkPrompt = true
    },
    chooseDrink () {
      const rule = this.pendingBundleDrinkRule()
      this.pendingDrinkCategoryIndex = rule ? this.findAddonCategoryIndex(rule) : -1
      // 點餐飲後不再重複彈出提示（與「遲啲點」一致，本次不再詢問）
      this.bundleDrinkPromptDismissed = true
      this.showBundleDrinkPrompt = false
    },
    // 對話框關閉動畫結束後，直接跳去飲品欄
    onBundleDrinkDialogClosed () {
      if (this.pendingDrinkCategoryIndex >= 0) {
        this.scrollToCategory(this.pendingDrinkCategoryIndex)
        this.pendingDrinkCategoryIndex = -1
      }
    },
    dismissBundleDrink () {
      this.bundleDrinkPromptDismissed = true
      this.showBundleDrinkPrompt = false
    },
    clearCartItems () {
      this.cartItems = []
      this.sentPanelVisible = true
      this.fetchSentItems()
    },
    fetchSentItems () {
      if (!this.id) {
        return
      }
      this.$axios.get('/api/order/current', { params: { deskNo: this.id } })
        .then(res => {
          const raw = (res.data && res.data.order) || []
          const items = raw.filter(item => item.voidStatus !== 1)
          if (items.length) {
            this.sentItems = items.map(item => ({
              name: item.name,
              count: item.count || 1,
              price: item.customPrice || item.price || 0,
              mods: item.mods,
              isCombo: item.isCombo,
              contents: item.contents
            }))
          } else {
            this.sentItems = []
            this.sentPanelVisible = false
          }
        })
        .catch(() => {
          this.sentItems = []
        })
    },
    loadMenu () {
      // 快取優先：僅首次進入（goods 尚為空）時先顯示上次菜單，背景刷新。
      // 之後的刷新（如 menuChanged）不可覆蓋 this.goods，否則會把客人已加的數量清掉。
      if (!this.goods || !this.goods.length) {
        const cached = qrCache.get('goods')
        if (cached && cached.length) {
          this.goods = cached
        }
      }
      return this.$axios.get('/api/commodity/menu', { params: { mode: '堂食', channel: 'qr' } })
        .then(res => {
          const commodities = res.data || []
          return this.$axios.get('/api/combo/menu', { params: { channel: 'qr' } }).then(r => {
            const combos = r.data || []
            const goods = commodities.slice()
            // 去重：已在分類（CategoryItem）裡顯示過的套餐不再重複塞進「套餐」分類
            const existing = new Set()
            goods.forEach(g => (g.foods || []).forEach(f => { if (f._isCombo) existing.add(String(f._id)) }))
            const extra = combos.filter(c => !existing.has(String(c._id)))
            if (extra.length) {
              goods.push({
                name: '套餐',
                type: 999,
                foods: extra.map(c => Object.assign({}, c, { isCombo: true }))
              })
            }
            // 背景刷新期間客人可能已按「+」加數量（count 記在快取顯示的物件上），
            // 若直接整份替換會把已加數量清掉，導致購物車有貨、送出時卻漏單。以 _id 對照保留已加數量。
            const counts = {}
            ;(this.goods || []).forEach(g => (g.foods || []).forEach(f => {
              if (f && f.count) counts[String(f._id)] = f.count
            }))
            // 先快取「乾淨」菜單（尚未複製購物車數量），避免把 count 寫進菜單快取造成下次進入顯示幽靈品項
            qrCache.set('goods', goods)
            if (Object.keys(counts).length) {
              goods.forEach(g => (g.foods || []).forEach(f => {
                if (counts[String(f._id)]) f.count = counts[String(f._id)]
              }))
            }
            this.goods = goods
          })
        })
    },
    applySoldOutFilter () {
      if (!this.qrSetting.showSoldOutItems) {
        this.goods = this.goods.map(g => Object.assign({}, g, { foods: (g.foods || []).filter(f => !f.soldOut) }))
      }
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
  sockets: {
    // POS 變更訂單（退菜/加單/結帳）時，即時同步購物車內的「查看單據」面板
    tableUpdate () {
      this.fetchSentItems()
    },
    // 後台變更菜單/套餐（含「QR 顯示自動品項名」開關）時，即時刷新菜單與套餐
    menuChanged () {
      this.loadMenu().then(() => this.applySoldOutFilter())
    }
  },
  watch: {
    // 購物車變更（加/減品項）時，檢查是否要提示加套餐餐飲
    selectFoods () {
      this.maybePromptBundleDrink()
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
          if (f._isModCode || f._isModCategory) return
          if ((f._isCombo || f.isCombo) && !f.mainGroupId) return
          flat.push(f)
        })
      })
      if (!flat.length) return []
      const groupPriceMap = {}
      ;(this.bundleGroups || []).forEach(g => { groupPriceMap[String(g._id)] = Number(g.price) || 0 })
      const out = []
      rules.forEach(r => {
        const groupIds = (r.bundleGroupIds || []).map(String)
        const addonPrice = Number(r.addonPrice) || 0
        const triggerItems = flat
          .filter(f => this.ruleTriggerMatches(f, r))
          .map(f => ({ commodityId: f._id, name: f.name, price: f.price, upgradePrice: Number(f.price) || 0 }))
        let addonItems
        if (groupIds.length) {
          addonItems = flat
            .filter(f => f.bundleGroupId && groupIds.includes(String(f.bundleGroupId)))
            .map(f => ({ commodityId: f._id, name: f.name, price: f.price, upgradePrice: groupPriceMap[String(f.bundleGroupId)] || 0 }))
        } else {
          addonItems = flat
            .filter(f => !f._isCombo && !f.isCombo)
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
          const upgrade = (x.upgradePrice !== undefined && x.upgradePrice !== null)
            ? Number(x.upgradePrice) || 0
            : Number(comboItem && comboItem.upgradePrice) || 0
          const copy = Object.assign({}, src, { count: x.qty || 1 })
          if (x.gi !== 0) {
            // 跟餐：改收跟餐價（主食保留原價）；改碼由後端收據/印單另計，勿折入 price 以免重複計價
            copy.bundleOrigPrice = Number(src.price) || 0
            copy.price = upgrade
            copy.customPrice = 0
            copy.bundlePrice = true
          } else {
            // 主食：標記為撞餐主食，供後端一配一對照
            copy.bundleMain = true
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
    const cachedMods = qrCache.get('modcodes')
    if (cachedMods && cachedMods.length) this.modCodeList = cachedMods
    const mods = this.$axios.get('/api/modcode/list', { params: { channel: 'qr' } })
      .then(res => {
        this.modCodeList = res.data || []
        qrCache.set('modcodes', this.modCodeList)
      })
      .catch(() => {})
    const modCats = this.$axios.get('/api/modcode/categories')
      .then(res => { this.modCodeCategories = res.data || [] })
      .catch(() => {})
    const rules = this.$axios.get('/api/matchingrule/list')
      .then(res => { this.matchingRules = res.data || [] })
      .catch(() => {})
    const bgs = this.$axios.get('/api/bundlegroup/list')
      .then(res => { this.bundleGroups = res.data || [] })
      .catch(() => {})
    const menu = this.loadMenu()
    // 進入點餐版面時先同步一次「查看單據」，不依賴其他 API 是否載入完成
    this.fetchSentItems()
    Promise.all([qs, pos, menu, mods, modCats, rules, bgs])
      .then(() => {
        // QR 功能設定：隱藏沽清品項
        this.applySoldOutFilter()
        this.$nextTick(() => {
          this._initScroll()
          this._calculateHeight()
        })
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
        line-height: 20px;
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
        font-size: 17px;
        font-weight: 800;
    }
    .goods .text{
        display: table-cell;
        vertical-align: middle;
        text-align: center;
        color: #64748b;
        width: 60px;
        font-size: 16px;
        position: relative;
    }
    .goods .text::after{
        display: block;
        position: absolute;
        left: -12px;
        right: -12px;
        bottom: 0;
        border-top: 2px solid #d3dae3;
        content: ' ';
    }
    #commodities > .goods > .foods-wrapper{
        flex: 1;
        min-width: 0;
        background: #fff;
    }
    .goods > .foods-wrapper .title{
        padding-left: 14px;
        height: 40px;
        line-height: 40px;
        border-left: 4px solid var(--primary);
        font-size: 18px;
        color: #1e3a5f;
        background: linear-gradient(90deg, var(--primary-soft), rgba(255,255,255,0) 70%);
        font-weight: 700;
        letter-spacing: 0.5px;
    }
    .goods > .foods-wrapper .category-desc{
        margin: 6px 14px 0;
        padding: 6px 10px;
        border-radius: 6px;
        background: #f4f4f5;
        font-size: 16px;
        line-height: 1.5;
        color: #555555;
        white-space: normal;
        word-break: break-word;
    }
    .cat-count{
        position: absolute;
        top: 4px;
        right: 2px;
        min-width: 20px;
        height: 20px;
        line-height: 20px;
        text-align: center;
        border-radius: 10px;
        padding: 0 4px;
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(135deg, var(--accent), var(--accent2));
        box-shadow: 0 2px 6px var(--accent-glow);
    }
    .slot-badge{
        margin-left: 6px;
        padding: 2px 8px;
        border-radius: 10px;
        background: linear-gradient(135deg, #f56c6c, #f89898);
        color: #fff;
        font-size: 13px;
        line-height: 20px;
        vertical-align: 1px;
    }
    .slot-title-badge{
        margin-left: 8px;
        padding: 1px 10px;
        border-radius: 10px;
        background: linear-gradient(135deg, #f56c6c, #f89898);
        color: #fff;
        font-size: 14px;
    }
    .goods > .foods-wrapper .food-item{
        display: flex;
        margin: 2px 4px;
        padding: 4px 6px;
        position: relative;
        background: #fff;
        border: 1px solid #f1f5f9;
        border-radius: 14px;
        box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .goods > .foods-wrapper .food-item:active{
        transform: scale(0.985);
        box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
    }
    .goods > .foods-wrapper .food-item::after{
        display: none;
    }
    .goods > .foods-wrapper .food-item:last-of-type::after{
        display: none;
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
        font-size: 29px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        letter-spacing: 1px;
    }
    .food-item > .contents > .stock-line{
        margin-bottom: 4px;
        font-size: 14px;
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
        line-height: 22px;
        font-size: 18px;
        color: #1e293b;
        font-weight: 600;
    }
    .food-item > .contents > .name-row > .price{
        flex-shrink: 0;
        margin-top: 4px;
        margin-left: auto;
        font-weight: 700;
        line-height: 22px;
        text-align: right;
    }
    .food-item > .contents > .name-row > .price > .now{
        margin-right: 8px;
        font-size: 20px;
        color: var(--accent);
    }
    .food-item > .contents > .name-row > .price > .old{
        text-decoration: line-through;
        font-size: 14px;
        color: #94a3b8;
    }
    .food-item > .contents > .desc{
        line-height: 18px;
        margin-bottom: 6px;
        font-size: 14px;
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
        font-size: 17px;
        color: #94a3b8;
        font-weight: 500;
    }
    .bundle-drink-body{
        text-align: center;
        padding: 6px 4px 2px;
    }
    .bundle-drink-title{
        margin: 0 0 18px;
        font-size: 21px;
        font-weight: 700;
        color: #1e293b;
    }
    .bundle-drink-actions{
        display: flex;
        justify-content: center;
        gap: 12px;
    }
</style>
