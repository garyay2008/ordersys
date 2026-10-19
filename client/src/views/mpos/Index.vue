<template>
  <div id="mpos">
    <!-- ============ 登入畫面 ============ -->
    <div v-if="!loggedIn" class="mpos-login">
      <div class="login-card">
        <div class="login-logo">
          <i class="el-icon-phone-outline"></i>
          <h1>侍應流動點餐</h1>
          <p>Mobile POS</p>
        </div>
        <el-form @submit.native.prevent="doLogin">
          <el-form-item>
            <el-input v-model.trim="loginForm.no" placeholder="員工編號" size="large" autofocus @keyup.enter.native="doLogin">
              <i slot="prefix" class="el-icon-user"></i>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-input v-model="loginForm.password" type="password" placeholder="密碼" size="large" @keyup.enter.native="doLogin">
              <i slot="prefix" class="el-icon-lock"></i>
            </el-input>
          </el-form-item>
          <el-button type="primary" size="large" class="login-btn" :loading="loginLoading" @click="doLogin">登入</el-button>
        </el-form>
      </div>
    </div>

    <!-- ============ 枱號版面 ============ -->
    <div v-else-if="!selectedTable" class="mpos-board">
      <div class="board-header">
        <div class="board-title">
          <i class="el-icon-s-grid"></i>
          <span>選擇枱號</span>
        </div>
        <div class="board-user">
          <span class="staff-chip"><i class="el-icon-user"></i> {{ staff.name }}</span>
          <el-button size="mini" plain icon="el-icon-refresh" @click="loadTables"></el-button>
          <el-button size="mini" plain icon="el-icon-switch-button" @click="logout"></el-button>
        </div>
      </div>
      <div class="zone-tabs" v-if="boardZones.length > 1">
        <span v-for="z in boardZones" :key="z" class="zone-tab" :class="{ active: activeZone === z }" @click="activeZone = z">{{ z }}</span>
      </div>
      <div class="board-grid" v-loading="boardLoading">
        <div v-for="t in visibleTables" :key="t._id" class="table-card" :class="boardClass(t.no)" @click="enterTable(t)">
          <div class="table-no">{{ t.name || t.no }}</div>
          <div class="table-seats"><i class="el-icon-user"></i> {{ t.seats || 0 }} 位</div>
          <div class="table-status">{{ boardStatus(t.no) }}</div>
          <div class="table-amount" v-if="tableAmount(t.no) > 0">${{ tableAmount(t.no) }}</div>
        </div>
        <div v-if="!visibleTables.length" class="empty-hint">暫無枱號</div>
      </div>
    </div>

    <!-- ============ 點餐畫面 ============ -->
    <div v-else class="mpos-order">
      <div class="order-header">
        <el-button class="back-btn" icon="el-icon-arrow-left" circle @click="backToBoard"></el-button>
        <div class="order-table">
          <div class="order-table-no">{{ currentTableName }}</div>
          <div class="order-pax">
            <i class="el-icon-user"></i>
            <el-input-number v-model="pax" :min="1" :max="99" size="mini" controls-position="right"></el-input-number>
            人
          </div>
        </div>
        <div class="order-actions">
          <el-button size="mini" plain @click="toggleSentPanel">{{ sentPanelVisible ? '返回點餐' : '已送項目' }}</el-button>
          <el-button size="mini" plain icon="el-icon-switch-button" @click="logout"></el-button>
        </div>
      </div>

      <div class="menu-body" v-show="!sentPanelVisible">
        <div class="cat-sidebar">
          <div v-for="(cat, i) in goods" :key="i" class="cat-item" :class="{ active: activeCat === i }" @click="selectCat(i, cat)">
            {{ cat.name }}
            <span v-if="catItemCount(cat)" class="cat-badge">{{ catItemCount(cat) }}</span>
          </div>
        </div>
        <div class="food-list" ref="foodList">
          <div v-for="(cat, i) in goods" :key="i" class="food-cat">
            <div class="food-cat-title" :ref="'catTitle' + i">{{ cat.name }}</div>
            <div v-for="food in cat.foods" :key="food._id" class="food-row" :class="{ soldout: food.soldOut }" @click="onFoodClick(food)">
              <div class="food-img" v-if="food.img">
                <img :src="food.img" alt="">
              </div>
              <div class="food-info">
                <div class="food-name">{{ food.name }}</div>
                <div class="food-price">${{ food.price }}</div>
              </div>
              <div class="food-right">
                <span v-if="food.soldOut" class="soldout-tag">售罄</span>
                <template v-else>
                  <span v-if="food.isCombo || food._isCombo" class="food-action combo">選搭配</span>
                  <span v-else-if="food.specs && food.specs.length" class="food-action spec">選規格</span>
                  <span v-else class="food-action add">
                    <span v-if="getFoodCount(food)" class="count-badge">{{ getFoodCount(food) }}</span>
                    <i class="el-icon-plus"></i>
                  </span>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 已送項目面板 -->
      <div class="sent-panel" v-if="sentPanelVisible">
        <div class="sent-header">已送項目（{{ currentTableName }}）</div>
        <div class="sent-list">
          <div v-for="(s, i) in sentItems" :key="i" class="sent-row">
            <span class="sent-name">{{ s.name }}</span>
            <span class="sent-count">x{{ s.count }}</span>
            <span class="sent-price">${{ Math.round((s.price || 0) * (s.count || 1) * 100) / 100 }}</span>
          </div>
          <div v-if="!sentItems.length" class="empty-hint">尚未送單</div>
        </div>
      </div>

      <!-- 購物車 -->
      <div class="cart-bar" v-if="!sentPanelVisible">
        <div class="cart-summary" @click="cartSheet = true">
          <i class="el-icon-shopping-cart-2"></i>
          <span class="cart-count">{{ cartCount }} 件</span>
          <span v-if="bundleOn" class="bundle-badge">撞餐 -${{ bundleSavings.toFixed(2) }}</span>
          <span class="cart-total">${{ cartTotal }}</span>
          <i class="el-icon-arrow-up" v-if="cartItems.length"></i>
        </div>
        <el-button type="primary" class="send-btn" :disabled="!cartItems.length" :loading="submitting" @click="submitOrder">送單</el-button>
      </div>
    </div>

    <!-- 購物車編輯抽屜 -->
    <transition name="sheet">
      <div v-if="cartSheet" class="cart-sheet-mask" @click.self="cartSheet = false">
        <div class="cart-sheet">
          <div class="cart-sheet-header">
            <span>購物車</span>
            <el-button size="mini" type="text" @click="clearCart">清空</el-button>
          </div>
          <div class="cart-sheet-list">
            <div v-for="(item, i) in cartItems" :key="item.key || i" class="cart-row">
              <div class="cart-row-info">
                <div class="cart-row-name">{{ item.name }}</div>
                <div class="cart-row-mods" v-if="item.mods && item.mods.length">{{ modsText(item.mods) }}</div>
                <div class="cart-row-price">${{ Math.round(item.price * 100) / 100 }} / 份</div>
              </div>
              <div class="cart-row-ctrl">
                <i class="el-icon-remove-outline" @click="decItem(item)"></i>
                <span class="cart-row-count">{{ item.count }}</span>
                <i class="el-icon-circle-plus" @click="incItem(item)"></i>
              </div>
            </div>
            <div v-if="!cartItems.length" class="empty-hint">購物車是空的</div>
          </div>
          <div class="bundle-row" v-if="bundleEnabled && bundlePlan.bundles.length">
            <span class="bundle-label">撞餐優惠</span>
            <el-switch v-model="bundleApplied"></el-switch>
            <span class="bundle-saving">-${{ bundlePlan.totalSavings.toFixed(2) }}</span>
          </div>
          <div class="cart-sheet-footer">
            <span class="cart-total-label">合計</span>
            <span class="cart-total">${{ cartTotal }}</span>
            <el-button type="primary" class="send-btn" :disabled="!cartItems.length" :loading="submitting" @click="submitOrder">送單</el-button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 複用：貨品詳情（規格 / 改碼）與套餐搭配 -->
    <CommodityDetail ref="detail" :food="selectedFood" :qr-setting="posQrSetting" channel="pos" @add="addCartItem"></CommodityDetail>
    <ComboPicker ref="comboPicker" :mod-codes="modCodeList" @add="addCartItem"></ComboPicker>
  </div>
</template>

<script>
import CommodityDetail from '@/components/user/CommodityDetail'
import ComboPicker from '@/components/user/ComboPicker'
import { computeBundles } from '@/utils/bundle'

export default {
  name: 'mposIndex',
  components: { CommodityDetail, ComboPicker },
  data () {
    return {
      loggedIn: false,
      loginForm: { no: '', password: '' },
      loginLoading: false,
      staff: { no: '', name: '', role: '', permissionLevel: 1, defaultTerminal: '' },

      boardLoading: false,
      tables: [],
      unfinishedOrders: [],
      activeZone: '',
      selectedTable: null,
      pax: 1,

      goods: [],
      activeCat: 0,
      selectedFood: {},
      modCodeList: [],
      cartItems: [],
      cartSheet: false,
      submitting: false,

      combos: [],
      matchingRules: [],
      bundleGroups: [],
      bundleEnabled: false,
      bundleMode: 'auto',
      bundleRule: 'bestPrice',
      bundleApplied: true,

      sentItems: [],
      sentPanelVisible: false,

      posQrSetting: {
        showImages: true,
        showDescribe: true,
        showStock: false,
        showModPrices: true,
        showSoldOutItems: true,
        showDiscount: false,
        showSpecs: true
      }
    }
  },
  computed: {
    boardZones () {
      const zones = []
      this.tables.forEach(t => { if (t.zone && zones.indexOf(t.zone) < 0) zones.push(t.zone) })
      return zones
    },
    visibleTables () {
      if (!this.activeZone) return this.tables
      return this.tables.filter(t => (t.zone || '') === this.activeZone)
    },
    currentTableName () {
      const t = this.tables.find(x => String(x.no) === String(this.selectedTable))
      return t ? (t.name || t.no) : this.selectedTable
    },
    cartCount () {
      return this.cartItems.reduce((s, i) => s + (i.count || 0), 0)
    },
    cartTotal () {
      const sum = this.cartItems.reduce((s, i) => s + (i.price || 0) * (i.count || 0), 0)
      return Math.max(0, Math.round((sum - this.bundleSavings) * 100) / 100)
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
          .filter(f => this.matchingRuleTriggerMatches(f, r))
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
          _matchingRule: true,
          groups: [
            { name: '主食', min: 1, max: 1, groupPrice: 0, items: triggerItems },
            { name: '跟餐', min: 1, max: 1, groupPrice: 0, items: addonItems }
          ]
        })
      })
      return out
    },
    bundleCombos () {
      return (this.combos || []).concat(this.matchingRuleCombos)
    },
    bundlePlan () {
      if (!this.bundleEnabled) return { bundles: [], bundledIndexes: [], totalSavings: 0 }
      return computeBundles(this.cartItems, this.bundleCombos, { bundleEnabled: true, bundleRule: this.bundleRule })
    },
    bundleOn () {
      return this.bundleEnabled && this.bundleApplied && this.bundlePlan.bundles.length > 0
    },
    bundleSavings () {
      return this.bundleOn ? this.bundlePlan.totalSavings : 0
    }
  },
  methods: {
    // 撞餐規則主食側判定：主菜組別(triggerGroupIds)，空=任意主食
    matchingRuleTriggerMatches (f, r) {
      const trigGroups = (r.triggerGroupIds || []).map(String)
      if (trigGroups.length) {
        const gid = f && f.mainGroupId ? String(f.mainGroupId) : ''
        return !!gid && trigGroups.includes(gid)
      }
      return true
    },
    /* ---------- 登入 ---------- */
    doLogin () {
      if (!this.loginForm.no || !this.loginForm.password) {
        this.$message({ type: 'warning', message: '請輸入員工編號與密碼' })
        return
      }
      this.loginLoading = true
      this.$axios.post('/api/staff/login', { no: this.loginForm.no, password: this.loginForm.password })
        .then(res => {
          const d = res.data || {}
          this.staff = {
            no: String(d.no || ''),
            name: d.name || '',
            role: d.role || '',
            permissionLevel: d.permissionLevel || 1,
            defaultTerminal: d.defaultTerminal || ''
          }
          if (d.token) localStorage.setItem('orderTk', d.token)
          localStorage.setItem('mposStaff', JSON.stringify(this.staff))
          this.loggedIn = true
          this.loadTables()
        })
        .catch(err => {
          this.$message({ type: 'error', message: err.response ? err.response.data : '登入失敗' })
        })
        .finally(() => { this.loginLoading = false })
    },
    logout () {
      localStorage.removeItem('orderTk')
      localStorage.removeItem('mposStaff')
      this.loggedIn = false
      this.staff = { no: '', name: '', role: '', permissionLevel: 1, defaultTerminal: '' }
      this.selectedTable = null
      this.tables = []
      this.unfinishedOrders = []
    },

    /* ---------- 枱號版面 ---------- */
    loadTables () {
      this.boardLoading = true
      return this.$axios.get('/api/table/all')
        .then(res => {
          this.tables = (res.data || []).filter(t => t.enabled !== false)
          if (!this.activeZone && this.boardZones.length) this.activeZone = this.boardZones[0]
          return this.loadUnfinished()
        })
        .catch(err => { console.log(err); return Promise.resolve() })
        .finally(() => { this.boardLoading = false })
    },
    loadUnfinished () {
      return this.$axios.get('/api/order/unfinished')
        .then(res => { this.unfinishedOrders = res.data || [] })
        .catch(err => { console.log(err); this.unfinishedOrders = [] })
    },
    boardStatus (no) {
      const orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(no) && o.order && o.order.length)
      if (!orders.length) return '空枱'
      if (orders.some(o => o.source === 'extension')) return '使用中'
      if (orders.some(o => o.printed)) return '已印單'
      return '用餐中'
    },
    boardClass (no) {
      const s = this.boardStatus(no)
      if (s === '空枱') return 'free'
      if (s === '使用中') return 'busy'
      if (s === '已印單') return 'printed'
      return 'dining'
    },
    tableAmount (no) {
      return this.unfinishedOrders.filter(o => String(o.deskNo) === String(no)).reduce((sum, o) => sum + (o.totalPrice || 0), 0)
    },
    enterTable (t) {
      this.selectedTable = String(t.no)
      this.pax = t.seats || 1
      this.cartItems = []
      this.sentItems = []
      this.sentPanelVisible = false
      this.loadMenu()
      this.fetchSentItems()
    },
    backToBoard () {
      this.selectedTable = null
      this.cartItems = []
      this.sentItems = []
      this.sentPanelVisible = false
      this.loadUnfinished()
    },

    /* ---------- 菜單 ---------- */
    loadMenu () {
      const mods = this.$axios.get('/api/modcode/list', { params: { channel: 'pos' } })
        .then(res => { this.modCodeList = res.data || [] })
        .catch(() => { this.modCodeList = [] })
      const menu = this.$axios.get('/api/commodity/menu', { params: { mode: '堂食', channel: 'pos' } })
        .then(res => {
          this.goods = res.data || []
          return this.$axios.get('/api/combo/menu', { params: { channel: 'pos' } }).then(r => {
            this.combos = r.data || []
            const existing = new Set()
            this.goods.forEach(g => (g.foods || []).forEach(f => { if (f._isCombo) existing.add(String(f._id)) }))
            const extra = this.combos.filter(c => !existing.has(String(c._id)))
            if (extra.length) {
              this.goods.push({ name: '套餐', type: 999, foods: extra.map(c => Object.assign({}, c, { isCombo: true })) })
            }
          })
        })
        .catch(() => { this.goods = [] })
      const rules = this.$axios.get('/api/matchingrule/list').then(res => { this.matchingRules = res.data || [] }).catch(() => { this.matchingRules = [] })
      const groups = this.$axios.get('/api/bundlegroup/list').then(res => { this.bundleGroups = res.data || [] }).catch(() => { this.bundleGroups = [] })
      const setting = this.$axios.get('/api/possetting/get').then(res => {
        const d = res.data || {}
        this.bundleEnabled = !!d.bundleEnabled
        this.bundleMode = d.bundleMode === 'manual' || d.bundleMode === 'both' ? d.bundleMode : 'auto'
        this.bundleRule = d.bundleRule === 'priority' ? 'priority' : 'bestPrice'
        this.bundleApplied = this.bundleMode !== 'manual'
      }).catch(() => {})
      return Promise.all([mods, menu, rules, groups, setting]).then(() => { this.activeCat = 0 })
    },
    selectCat (i) {
      this.activeCat = i
      const el = this.$refs['catTitle' + i]
      if (el && el[0] && this.$refs.foodList) {
        this.$refs.foodList.scrollTo({ top: el[0].offsetTop - 8, behavior: 'smooth' })
      }
    },
    catItemCount (cat) {
      return (cat.foods || []).reduce((s, f) => s + this.getFoodCount(f), 0)
    },
    getFoodCount (food) {
      return this.cartItems.filter(x => String(x._id) === String(food._id)).reduce((s, x) => s + (x.count || 0), 0)
    },
    hasMandatoryMods (food) {
      const cats = food.modCategories || []
      if (!cats.length) return false
      return this.modCodeList.some(m => m.mandatory && cats.indexOf(m.category) >= 0)
    },
    onFoodClick (food) {
      if (food.soldOut) return
      if (food.isCombo || food._isCombo) {
        this.$refs.comboPicker.show(food.isCombo ? food : food._comboData)
        return
      }
      if ((food.specs && food.specs.length) || this.hasMandatoryMods(food)) {
        this.selectedFood = food
        this.$refs.detail.show()
        return
      }
      this.addCartItem({ _id: food._id, commodityId: food._id, name: food.name, price: food.price, img: food.img })
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
      if (exist) exist.count++
      else this.cartItems.push(Object.assign({ key, count: 1 }, item))
      this.$message({ type: 'success', message: '已加入購物車', showClose: false, duration: 600 })
    },
    incItem (item) {
      item.count++
    },
    decItem (item) {
      item.count--
      if (item.count <= 0) this.cartItems.splice(this.cartItems.indexOf(item), 1)
    },
    clearCart () {
      this.cartItems = []
      this.cartSheet = false
    },
    modsText (mods) {
      return mods.map(m => (typeof m === 'string' ? m : m.name)).join('、')
    },

    /* ---------- 撞餐 ---------- */
    modsExtraOf (item) {
      return (item.mods || []).reduce((s, m) => s + (m && typeof m === 'object' && m.price ? Number(m.price) || 0 : 0), 0)
    },
    buildBundleSubmitItems (items, plan) {
      if (!plan || !plan.bundles || !plan.bundles.length) return items
      const out = []
      const consumed = {}
      ;(plan.bundles || []).forEach(b => {
        const combo = this.bundleCombos.find(c => String(c._id) === String(b.comboId))
        if (!combo) return
        if (combo._matchingRule) {
          ;(this.buildMatchingRuleSubmitItems(combo, b, items) || []).forEach(it => out.push(it))
        } else {
          const item = this.buildComboItemFromBundle(combo, b, items)
          if (item) out.push(item)
        }
        ;(b.items || []).forEach(x => { consumed[x.index] = (consumed[x.index] || 0) + (x.qty || 1) })
      })
      ;(items || []).forEach((it, index) => {
        const used = consumed[index] || 0
        const total = it.count || 1
        const remaining = total - used
        if (remaining <= 0) return
        if (remaining === total) out.push(it)
        else out.push(Object.assign({}, it, { count: remaining }))
      })
      return out
    },
    buildMatchingRuleSubmitItems (combo, bundle, items) {
      const out = []
      ;(bundle.items || []).forEach(x => {
        const src = items[x.index]
        if (!src) return
        const group = (combo.groups || [])[x.gi]
        const comboItem = (group && group.items) ? group.items[x.ii] : null
        const upgrade = (x.upgradePrice !== undefined && x.upgradePrice !== null)
          ? Number(x.upgradePrice) || 0
          : Number(comboItem && comboItem.upgradePrice) || 0
        const copy = Object.assign({}, src, { count: x.qty || 1 })
        if (x.gi !== 0) {
          copy.bundleOrigPrice = Number(src.price) || 0
          copy.price = Math.round((upgrade + this.modsExtraOf(src)) * 100) / 100
          copy.bundlePrice = true
        } else {
          copy.bundleMain = true
        }
        out.push(copy)
      })
      return out
    },
    buildComboItemFromBundle (combo, bundle, items) {
      const contents = []
      let extraTotal = 0
      ;(combo.groups || []).forEach((group, gi) => {
        let pickedInGroup = false
        ;(bundle.items || []).forEach(x => {
          if (x.gi !== gi) return
          const src = items[x.index]
          if (!src) return
          pickedInGroup = true
          const comboItem = (group.items || [])[x.ii]
          const upgrade = Number(comboItem && comboItem.upgradePrice) || 0
          const modsExtra = this.modsExtraOf(src)
          const basePrice = Math.max(0, (Number(src.price) || 0) - modsExtra)
          const mods = (src.mods || []).slice()
          const qty = x.qty || 1
          for (let q = 0; q < qty; q++) {
            extraTotal += upgrade + modsExtra
            contents.push({
              _id: src._id || '',
              commodityId: src._id || '',
              name: src.name,
              price: Math.round((basePrice + upgrade) * 100) / 100,
              count: 1,
              station: src.station || '',
              stations: src.stations || [],
              mods
            })
          }
        })
        if (pickedInGroup && Number(group.groupPrice) > 0) extraTotal += Number(group.groupPrice)
      })
      return {
        _id: combo._id,
        name: combo.name,
        price: Math.round(((combo.price || 0) + extraTotal) * 100) / 100,
        count: 1,
        isCombo: true,
        contents
      }
    },

    /* ---------- 送單 ---------- */
    submitOrder () {
      if (!this.cartItems.length) {
        this.$message({ type: 'warning', message: '請先點餐' })
        return
      }
      const plan = this.bundleOn ? this.bundlePlan : null
      const submitItems = this.buildBundleSubmitItems(this.cartItems, plan)
      const order = submitItems.map(i => ({
        _id: i._id,
        commodityId: i.commodityId || i._id,
        name: i.name,
        price: i.price,
        count: i.count || 1,
        spec: i.spec,
        mods: i.mods || [],
        isCombo: !!i.isCombo,
        contents: i.contents,
        bundleGroupId: i.bundleGroupId || '',
        mainGroupId: i.mainGroupId || '',
        bundlePrice: !!i.bundlePrice,
        bundleMain: !!i.bundleMain,
        bundleOrigPrice: i.bundleOrigPrice || 0
      }))
      const totalPrice = Math.max(0, Math.round(submitItems.reduce((s, i) => s + (i.price || 0) * (i.count || 1), 0) * 100) / 100)
      this.submitting = true
      this.$axios.post('/api/order/submit', {
        deskNo: this.selectedTable,
        order,
        totalPrice,
        zone: '堂食',
        source: 'pos',
        print: true,
        printed: false,
        waiter: this.staff.name || this.staff.no,
        pax: this.pax,
        terminalCode: this.staff.defaultTerminal || ''
      }).then(res => {
        this.$message({ type: 'success', message: res.data || '送單成功' })
        this.$socketEmit('submitOrder')
        this.cartItems = []
        this.cartSheet = false
        this.fetchSentItems()
      }).catch(err => {
        this.$message({ type: 'error', message: err.response ? err.response.data : '送單失敗' })
      }).finally(() => { this.submitting = false })
    },

    /* ---------- 已送項目 ---------- */
    toggleSentPanel () {
      this.sentPanelVisible = !this.sentPanelVisible
      if (this.sentPanelVisible) this.fetchSentItems()
    },
    fetchSentItems () {
      if (!this.selectedTable) return
      this.$axios.get('/api/order/current', { params: { deskNo: this.selectedTable } })
        .then(res => {
          if (res.data && res.data.order && res.data.order.length) {
            this.sentItems = res.data.order.map(item => ({
              name: item.name,
              count: item.count || 1,
              price: item.customPrice || item.price || 0
            }))
          } else {
            this.sentItems = []
          }
        })
        .catch(() => { this.sentItems = [] })
    }
  },
  sockets: {
    tableUpdate () {
      if (this.loggedIn) this.loadUnfinished()
    }
  },
  created () {
    // 嘗試還原登入狀態
    const saved = localStorage.getItem('mposStaff')
    if (saved && localStorage.getItem('orderTk')) {
      try {
        this.staff = JSON.parse(saved)
        this.loggedIn = true
        this.loadTables()
      } catch (e) {
        this.logout()
      }
    }
  }
}
</script>

<style>
:root {
  --primary: #e64545;
  --primary2: #c0392b;
  --primary-soft: rgba(230, 69, 69, 0.08);
  --primary-glow: rgba(230, 69, 69, 0.35);
  --accent: #e64545;
  --accent2: #f56c6c;
  --accent-glow: rgba(230, 69, 69, 0.4);
}
#mpos {
  height: 100%;
  width: 100%;
  background: #f4f5f7;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", Arial, sans-serif;
  overflow: hidden;
  position: relative;
}
/* ---------- 登入 ---------- */
.mpos-login {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #e64545, #c0392b);
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 380px;
  background: #fff;
  border-radius: 20px;
  padding: 32px 28px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}
.login-logo {
  text-align: center;
  margin-bottom: 24px;
  color: #e64545;
}
.login-logo i {
  font-size: 40px;
}
.login-logo h1 {
  font-size: 20px;
  margin: 8px 0 2px;
  color: #1e293b;
}
.login-logo p {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
  letter-spacing: 2px;
}
.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f56c6c, #e64545);
  border: none;
}
/* ---------- 枱號版面 ---------- */
.mpos-board {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.board-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
}
.board-title i {
  color: #e64545;
}
.board-user {
  display: flex;
  align-items: center;
  gap: 6px;
}
.staff-chip {
  font-size: 13px;
  color: #475569;
  background: #f1f5f9;
  border-radius: 20px;
  padding: 4px 10px;
}
.zone-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px 0;
}
.zone-tab {
  padding: 6px 16px;
  border-radius: 20px;
  background: #fff;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
}
.zone-tab.active {
  background: #e64545;
  color: #fff;
}
.board-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  padding: 16px;
  align-content: start;
}
.table-card {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  border: 2px solid transparent;
  position: relative;
}
.table-card .table-no {
  font-size: 22px;
  font-weight: 800;
  color: #1e293b;
}
.table-card .table-seats {
  font-size: 12px;
  color: #94a3b8;
  margin: 4px 0;
}
.table-card .table-status {
  font-size: 13px;
  font-weight: 700;
}
.table-card .table-amount {
  font-size: 12px;
  color: #e64545;
  font-weight: 700;
  margin-top: 4px;
}
.table-card.free {
  border-color: #e2e8f0;
}
.table-card.free .table-status { color: #16a34a; }
.table-card.dining {
  border-color: #fbbf24;
  background: #fffbeb;
}
.table-card.dining .table-status { color: #d97706; }
.table-card.printed {
  border-color: #60a5fa;
  background: #eff6ff;
}
.table-card.printed .table-status { color: #2563eb; }
.table-card.busy {
  border-color: #e64545;
  background: #fef2f2;
}
.table-card.busy .table-status { color: #e64545; }
.empty-hint {
  grid-column: 1 / -1;
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
}
/* ---------- 點餐版面 ---------- */
.mpos-order {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.order-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.back-btn {
  background: #f1f5f9;
  border: none;
  color: #1e293b;
}
.order-table {
  flex: 1;
}
.order-table-no {
  font-size: 18px;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.1;
}
.order-pax {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
}
.order-pax .el-input-number {
  width: 90px;
}
.order-actions {
  display: flex;
  gap: 6px;
}
.menu-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.cat-sidebar {
  width: 96px;
  flex-shrink: 0;
  background: #f1f5f9;
  overflow-y: auto;
  padding: 8px 0;
}
.cat-item {
  position: relative;
  padding: 14px 10px;
  font-size: 14px;
  color: #64748b;
  text-align: center;
  cursor: pointer;
  word-break: break-all;
  line-height: 1.3;
}
.cat-item.active {
  background: #fff;
  color: #e64545;
  font-weight: 700;
  box-shadow: inset 3px 0 0 #e64545;
}
.cat-badge {
  display: inline-block;
  min-width: 16px;
  height: 16px;
  line-height: 16px;
  border-radius: 8px;
  background: #e64545;
  color: #fff;
  font-size: 10px;
  padding: 0 4px;
  margin-left: 4px;
}
.food-list {
  flex: 1;
  overflow-y: auto;
  background: #fff;
}
.food-cat-title {
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 700;
  color: #1e3a5f;
  background: #f8f9fb;
  position: sticky;
  top: 0;
  z-index: 2;
}
.food-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  cursor: pointer;
}
.food-row.soldout {
  opacity: 0.5;
}
.food-img {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: #f1f5f9;
}
.food-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.food-info {
  flex: 1;
  min-width: 0;
}
.food-name {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
.food-price {
  font-size: 14px;
  font-weight: 700;
  color: #e64545;
  margin-top: 4px;
}
.food-right {
  flex-shrink: 0;
}
.food-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 20px;
}
.food-action.add {
  background: #e64545;
  color: #fff;
  font-size: 18px;
  padding: 4px 12px;
}
.food-action.spec,
.food-action.combo {
  background: #fef2f2;
  color: #e64545;
}
.count-badge {
  font-size: 13px;
  background: #fff;
  color: #e64545;
  border-radius: 10px;
  padding: 0 7px;
  line-height: 18px;
  margin-right: 2px;
}
.soldout-tag {
  font-size: 13px;
  color: #94a3b8;
  font-weight: 500;
}
/* ---------- 購物車 ---------- */
.cart-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #1e293b;
  color: #fff;
}
.cart-summary {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 15px;
}
.cart-summary i {
  font-size: 20px;
}
.cart-total {
  font-weight: 800;
  color: #fbbf24;
}
.cart-total-label { color: #cbd5e1; }
.bundle-badge {
  font-size: 12px;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.18);
  border-radius: 10px;
  padding: 2px 8px;
}
.send-btn {
  min-width: 110px;
  height: 44px;
  font-size: 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #f56c6c, #e64545);
  border: none;
}
.send-btn.is-disabled {
  background: #94a3b8;
}
/* ---------- 購物車抽屜 ---------- */
.cart-sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}
.cart-sheet {
  width: 100%;
  max-height: 70vh;
  background: #fff;
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
}
.cart-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  font-size: 17px;
  font-weight: 700;
  border-bottom: 1px solid #f0f2f5;
}
.cart-sheet-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px;
}
.cart-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0f2f5;
}
.cart-row-info { flex: 1; min-width: 0; }
.cart-row-name { font-size: 15px; font-weight: 600; color: #1e293b; }
.cart-row-mods { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.cart-row-price { font-size: 13px; color: #e64545; font-weight: 700; margin-top: 2px; }
.cart-row-ctrl {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cart-row-ctrl i {
  font-size: 26px;
  color: #e64545;
  cursor: pointer;
}
.cart-row-count {
  min-width: 20px;
  text-align: center;
  font-weight: 700;
  color: #1e293b;
}
.bundle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  border-top: 1px solid #f0f2f5;
  font-size: 14px;
  color: #1e293b;
}
.bundle-row .bundle-saving {
  margin-left: auto;
  font-weight: 700;
  color: #e64545;
}
.cart-sheet-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid #f0f2f5;
}
.cart-sheet-footer .cart-total-label { font-size: 15px; }
.cart-sheet-footer .cart-total { font-size: 20px; margin-left: auto; }
.sheet-enter-active, .sheet-leave-active { transition: all 0.25s ease; }
.sheet-enter, .sheet-leave-to { opacity: 0; transform: translateY(40px); }
/* ---------- 已送項目 ---------- */
.sent-panel {
  flex: 1;
  overflow-y: auto;
  background: #fff;
  padding: 16px;
}
.sent-header {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 12px;
}
.sent-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid #f0f2f5;
}
.sent-name { flex: 1; font-size: 14px; color: #1e293b; }
.sent-count { font-size: 13px; color: #64748b; }
.sent-price { font-size: 14px; font-weight: 700; color: #1e293b; }
</style>
