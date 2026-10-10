<template>
    <div id="kiosk">
        <!-- 首頁 -->
        <div v-if="step === 'home'" class="kiosk-screen home">
            <h1 class="home-title">{{ shopName || '歡迎光臨' }}</h1>
            <div class="home-actions">
                <button v-if="setting.dineIn" class="big-btn" @click="startDineIn">
                    <i class="el-icon-office-building"></i>
                    <span>堂食點餐</span>
                </button>
                <button v-if="setting.takeaway" class="big-btn" @click="startTakeaway">
                    <i class="el-icon-shopping-bag-2"></i>
                    <span>外賣自取</span>
                </button>
                <button v-if="setting.payByOrderNo" class="big-btn" @click="startLookup">
                    <i class="el-icon-money"></i>
                    <span>查單付款</span>
                </button>
            </div>
        </div>

        <!-- 輸入桌號 -->
        <div v-else-if="step === 'table'" class="kiosk-screen table">
            <div class="step-header">
                <button class="back-btn" @click="step = 'home'"><i class="el-icon-arrow-left"></i> 返回</button>
                <h2>請輸入桌號</h2>
            </div>
            <div class="pad-display">{{ padValue }}</div>
            <div class="num-pad">
                <button v-for="n in ['1','2','3','4','5','6','7','8','9','清空','0','⌫']" :key="n"
                        class="pad-key" :class="{ 'pad-fn': n === '清空' || n === '⌫' }"
                        @click="onPadKey(n)">{{ n }}</button>
            </div>
            <div class="pad-actions">
                <button class="big-btn small" :disabled="!padValue" @click="enterOrder">確認桌號</button>
            </div>
        </div>

        <!-- 查單付款：輸入單號 -->
        <div v-else-if="step === 'lookup'" class="kiosk-screen lookup">
            <div class="step-header">
                <button class="back-btn" @click="step = 'home'"><i class="el-icon-arrow-left"></i> 返回</button>
                <h2>查單付款</h2>
            </div>
            <div class="lookup-box">
                <p class="lookup-tip">請輸入訂單編號</p>
                <input v-model="lookupNo" class="lookup-input" placeholder="如 K10001" @keyup.enter="lookupOrder">
                <button class="big-btn small" :disabled="!lookupNo" @click="lookupOrder">查詢</button>
                <p v-if="lookupError" class="lookup-error">{{ lookupError }}</p>
            </div>
        </div>

        <!-- 點餐主畫面 -->
        <div v-else-if="step === 'order'" class="kiosk-screen order">
            <div class="order-top">
                <button class="back-btn" @click="step = 'home'"><i class="el-icon-arrow-left"></i></button>
                <h2 class="order-title">{{ mode === 'dineIn' ? '堂食 · 桌號 ' + deskNo : '外賣自取' }}</h2>
                <div class="order-top-cart" @click="scrollCart = !scrollCart">
                    <i class="el-icon-shopping-cart-1"></i> {{ cartCount }} 件 · ¥{{ cartTotal }}
                </div>
            </div>
            <div class="order-body">
                <div class="cat-col">
                    <div v-for="(cat, i) in goods" :key="i"
                         class="cat-item" :class="{ active: activeCat === i }"
                         @click="activeCat = i">{{ cat.name }}</div>
                </div>
                <div class="food-col">
                    <div class="food-grid">
                        <div v-for="food in currentFoods" :key="food._id" class="food-card"
                             :class="{ 'sold-out': food.soldOut }" @click="selectFood(food)">
                            <div class="food-img" v-if="setting.showImages">
                                <img :src="food.img" v-if="food.img">
                                <div v-else class="food-ph">{{ food.name.charAt(0) }}</div>
                            </div>
                            <div class="food-name">{{ food.name }}</div>
                            <div class="food-price">¥{{ food.price }}</div>
                            <div class="food-qty" v-if="qtyOf(food) > 0">{{ qtyOf(food) }}</div>
                            <div class="food-soldout" v-if="food.soldOut">已售罄</div>
                        </div>
                    </div>
                </div>
                <div class="cart-col">
                    <div class="cart-head">購物車</div>
                    <div class="cart-list">
                        <div v-for="item in cart" :key="item.key" class="cart-item">
                            <div class="cart-item-name">
                                {{ item.name }}
                                <span v-if="item.mods && item.mods.length" class="cart-mods">（{{ item.mods.map(m => typeof m === 'string' ? m : m.name).join('、') }}）</span>
                            </div>
                            <div class="cart-item-bottom">
                                <div class="qty-ctrl">
                                    <button @click="changeQty(item, -1)">−</button>
                                    <span>{{ item.count }}</span>
                                    <button @click="changeQty(item, 1)">＋</button>
                                </div>
                                <div class="cart-item-price">¥{{ Math.round(item.price * item.count * 100) / 100 }}</div>
                            </div>
                        </div>
                        <div v-if="!cart.length" class="cart-empty">請點選商品</div>
                    </div>
                    <div class="cart-foot">
                        <div class="cart-total">合計 ¥{{ cartTotal }}</div>
                        <button class="pay-btn" :disabled="!cart.length" @click="checkout">去付款</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 付款畫面 -->
        <div v-else-if="step === 'pay'" class="kiosk-screen pay">
            <div class="step-header">
                <button class="back-btn" @click="backFromPay"><i class="el-icon-arrow-left"></i> 返回</button>
                <h2>付款</h2>
            </div>
            <div class="pay-body">
                <div class="pay-left">
                    <div class="pay-order-no">單號：{{ payOrder.orderNo }}</div>
                    <div class="pay-items">
                        <div v-for="(item, i) in payOrder.order" :key="i" class="pay-item">
                            <span class="pay-item-name">{{ item.name }} x{{ item.count }}</span>
                            <span class="pay-item-price">¥{{ Math.round((item.price || 0) * (item.count || 1) * 100) / 100 }}</span>
                        </div>
                    </div>
                    <div class="pay-grand">總金額 <span>¥{{ payOrder.totalPrice }}</span></div>
                </div>
                <div class="pay-right">
                    <p class="pay-choose">請選擇付款方式</p>
                    <div class="pay-methods">
                        <button v-for="m in setting.paymentMethods" :key="m"
                                class="pay-method" :class="{ active: payMethod === m }"
                                @click="payMethod = m">{{ m }}</button>
                    </div>
                    <div v-if="payMethod" class="pay-action">
                        <template v-if="payMethod === '八達通'">
                            <p class="pay-hint">請在八達通讀卡機拍卡</p>
                        </template>
                        <template v-else-if="payMethod === '行動支付'">
                            <p class="pay-hint">請用手機掃描下方 QR 付款</p>
                            <img v-if="setting.fpsQrImage" :src="setting.fpsQrImage" class="fps-qr">
                            <div v-else class="fps-placeholder">FPS QR（未設定圖片）</div>
                        </template>
                        <template v-else>
                            <p class="pay-hint">請完成「{{ payMethod }}」付款</p>
                        </template>
                        <button class="big-btn small" :disabled="paying" @click="confirmPay">我已完成付款</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 完成畫面 -->
        <div v-else-if="step === 'done'" class="kiosk-screen done">
            <div class="done-icon"><i class="el-icon-circle-check"></i></div>
            <h1 class="done-title">付款成功</h1>
            <p class="done-no">訂單編號：{{ doneResult.orderNo }}</p>
            <p class="done-amount">已付 ¥{{ doneResult.totalPrice }}（{{ doneResult.payMethod }}）</p>
            <p class="done-desc">請稍候取餐，謝謝光臨</p>
            <button class="big-btn" @click="goHome">返回首頁</button>
        </div>

        <CommodityDetail ref="detail" :food="detailFood" :qr-setting="detailSetting" @add="addCartItem"></CommodityDetail>
        <ComboPicker ref="comboPicker" @add="addCartItem"></ComboPicker>
    </div>
</template>

<script>
import CommodityDetail from '@/components/user/CommodityDetail'
import ComboPicker from '@/components/user/ComboPicker'

export default {
  name: 'kiosk',
  data () {
    return {
      step: 'home',
      mode: 'dineIn',
      deskNo: '',
      padValue: '',
      lookupNo: '',
      lookupError: '',
      shopName: '',
      setting: {
        paymentMethods: ['八達通', '行動支付'],
        fpsQrImage: '',
        showImages: true,
        terminalCode: '',
        dineIn: true,
        takeaway: true,
        payByOrderNo: true
      },
      goods: [],
      activeCat: 0,
      cart: [],
      detailFood: {},
      detailSetting: { showImages: true, showDescribe: true, showStock: false, showModPrices: true, showSoldOutItems: true, showDiscount: true },
      payOrder: { orderNo: '', order: [], totalPrice: 0 },
      payFlow: 'order',
      payMethod: '',
      paying: false,
      doneResult: { orderNo: '', totalPrice: 0, payMethod: '' },
      scrollCart: false
    }
  },
  computed: {
    currentFoods () {
      const cat = this.goods[this.activeCat]
      return cat ? (cat.foods || []) : []
    },
    cartCount () {
      return this.cart.reduce((s, i) => s + (i.count || 0), 0)
    },
    cartTotal () {
      return Math.round(this.cart.reduce((s, i) => s + (i.price || 0) * (i.count || 0), 0) * 100) / 100
    }
  },
  methods: {
    loadSetting () {
      this.$axios.get('/api/kiosk/setting')
        .then(res => { this.setting = Object.assign(this.setting, res.data || {}) })
        .catch(() => {})
    },
    loadShop () {
      this.$axios.get('/api/shop/get')
        .then(res => { this.shopName = (res.data && res.data.shopName) || '' })
        .catch(() => {})
    },
    loadMenu () {
      const mode = this.mode === 'dineIn' ? '堂食' : '外賣'
      this.$axios.get('/api/commodity/menu', { params: { mode, channel: 'pos' } })
        .then(res => {
          this.goods = res.data || []
          return this.$axios.get('/api/combo/menu').then(r => {
            const combos = r.data || []
            if (combos.length) {
              this.goods.push({ name: '套餐', type: 999, foods: combos.map(c => Object.assign({}, c, { isCombo: true })) })
            }
          })
        })
        .catch(() => {})
    },
    startDineIn () {
      this.mode = 'dineIn'
      this.padValue = ''
      this.step = 'table'
    },
    startTakeaway () {
      this.mode = 'takeaway'
      this.deskNo = ''
      this.beginOrder()
    },
    startLookup () {
      this.lookupNo = ''
      this.lookupError = ''
      this.step = 'lookup'
    },
    onPadKey (n) {
      if (n === '清空') this.padValue = ''
      else if (n === '⌫') this.padValue = this.padValue.slice(0, -1)
      else this.padValue += n
    },
    enterOrder () {
      this.deskNo = this.padValue
      this.beginOrder()
    },
    beginOrder () {
      this.cart = []
      this.activeCat = 0
      this.loadMenu()
      this.step = 'order'
    },
    selectFood (food) {
      if (food.soldOut) return
      if (food.isCombo) {
        this.$refs.comboPicker.show(food)
        return
      }
      if (food.specs && food.specs.length) {
        this.detailFood = food
        this.$refs.detail.show()
        return
      }
      this.addSimple(food)
    },
    addSimple (food) {
      const key = String(food._id)
      const exist = this.cart.find(x => x.key === key)
      if (exist) exist.count++
      else this.cart.push(Object.assign({ key, count: 1 }, food))
    },
    addCartItem (item) {
      let key = item._id
      if (item.spec) key = item._id + '|' + item.spec
      else if (item.isCombo) key = 'combo_' + item._id + '|' + (item.contents || []).map(c => c.name).join('+')
      if (item.mods && item.mods.length) key += '|mods:' + item.mods.map(m => (typeof m === 'string' ? m : m.name)).join(',')
      const exist = this.cart.find(x => x.key === key)
      if (exist) exist.count++
      else this.cart.push(Object.assign({ key, count: 1, onSale: 0 }, item))
    },
    qtyOf (food) {
      let count = 0
      this.cart.forEach(item => {
        if (String(item._id) === String(food._id)) count += item.count || 0
      })
      return count
    },
    changeQty (item, delta) {
      item.count += delta
      if (item.count <= 0) {
        const idx = this.cart.indexOf(item)
        if (idx >= 0) this.cart.splice(idx, 1)
      }
    },
    checkout () {
      const payload = {
        source: 'kiosk',
        deskNo: this.mode === 'dineIn' ? this.deskNo : 0,
        zone: this.mode === 'dineIn' ? '堂食' : '外賣',
        order: this.cart.map(it => ({
          _id: it._id,
          commodityId: it.commodityId || it._id,
          name: it.name,
          price: it.price,
          count: it.count,
          img: it.img,
          spec: it.spec,
          mods: it.mods,
          isCombo: it.isCombo,
          contents: it.contents,
          noPrintComboName: it.noPrintComboName,
          categoryId: it.categoryId
        })),
        totalPrice: this.cartTotal,
        terminalCode: this.setting.terminalCode || ''
      }
      this.$axios.post('/api/order/submit', payload)
        .then(res => {
          const d = res.data || {}
          this.payOrder = {
            orderNo: d.orderNo,
            order: this.cart.map(it => ({ name: it.name, price: it.price, count: it.count })),
            totalPrice: d.totalPrice || this.cartTotal
          }
          this.payFlow = 'order'
          this.payMethod = ''
          this.paying = false
          this.step = 'pay'
        })
        .catch(err => {
          this.$message({ type: 'error', message: err.response ? err.response.data : '下單失敗，請重試' })
        })
    },
    lookupOrder () {
      const no = this.lookupNo.trim()
      if (!no) return
      this.lookupError = ''
      this.$axios.get('/api/kiosk/order/' + encodeURIComponent(no))
        .then(res => {
          const d = res.data
          if (!d) {
            this.lookupError = '找不到該訂單'
            return
          }
          if (d.state === 1) {
            this.lookupError = '該訂單已付款'
            return
          }
          this.payOrder = {
            orderNo: d.orderNo,
            order: d.order || [],
            totalPrice: d.totalPrice
          }
          this.payFlow = 'lookup'
          this.payMethod = ''
          this.paying = false
          this.step = 'pay'
        })
        .catch(() => { this.lookupError = '查詢失敗，請重試' })
    },
    backFromPay () {
      this.payMethod = ''
      this.step = this.payFlow === 'lookup' ? 'lookup' : 'order'
    },
    confirmPay () {
      if (!this.payMethod || this.paying) return
      this.paying = true
      this.$axios.post('/api/kiosk/pay', { orderNo: this.payOrder.orderNo, payMethod: this.payMethod })
        .then(res => {
          const d = res.data || {}
          this.doneResult = {
            orderNo: d.orderNo || this.payOrder.orderNo,
            totalPrice: d.totalPrice || this.payOrder.totalPrice,
            payMethod: d.payMethod || this.payMethod
          }
          this.step = 'done'
        })
        .catch(err => {
          this.paying = false
          this.$message({ type: 'error', message: err.response ? err.response.data : '付款失敗，請重試' })
        })
    },
    goHome () {
      this.step = 'home'
      this.cart = []
      this.payOrder = { orderNo: '', order: [], totalPrice: 0 }
      this.payMethod = ''
    }
  },
  created () {
    this.loadSetting()
    this.loadShop()
  },
  components: {
    CommodityDetail,
    ComboPicker
  }
}
</script>

<style scoped>
#kiosk{
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: #f1f5f9;
    color: #1e293b;
    font-family: "Helvetica Neue", Helvetica, Arial, "PingFang TC", "Microsoft JhengHei", sans-serif;
    overflow: hidden;
}
.kiosk-screen{
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    padding: 24px;
    box-sizing: border-box;
}
/* 首頁 */
.home{ display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; }
.home-title{ font-size: 44px; font-weight: 800; letter-spacing: 2px; }
.home-actions{ display: flex; gap: 28px; flex-wrap: wrap; justify-content: center; }
.big-btn{
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
    min-width: 220px; min-height: 180px; padding: 24px;
    font-size: 30px; font-weight: 700; color: #fff;
    background: linear-gradient(135deg, #ff5722, #ff9800);
    border: none; border-radius: 20px; cursor: pointer;
    box-shadow: 0 8px 24px rgba(255, 87, 34, 0.3);
    transition: all .15s ease;
}
.big-btn i{ font-size: 56px; }
.big-btn.small{ min-width: 160px; min-height: 60px; padding: 12px 32px; font-size: 22px; flex-direction: row; }
.big-btn:active{ transform: scale(.96); }
.big-btn:disabled{ opacity: .45; cursor: not-allowed; }
.step-header{ display: flex; align-items: center; gap: 20px; margin-bottom: 24px; }
.step-header h2{ font-size: 32px; margin: 0; }
.back-btn{
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 20px; font-size: 20px; color: #475569;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer;
}
.back-btn:active{ background: #f1f5f9; }
/* 桌號輸入 */
.table{ display: flex; flex-direction: column; align-items: center; }
.pad-display{
    width: 360px; height: 80px; line-height: 80px; text-align: center;
    font-size: 40px; font-weight: 700; background: #fff; border-radius: 16px;
    margin: 30px 0 20px; box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.num-pad{ display: grid; grid-template-columns: repeat(3, 100px); gap: 14px; margin-bottom: 28px; }
.pad-key{
    height: 80px; font-size: 30px; font-weight: 700; color: #1e293b;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; cursor: pointer;
}
.pad-key:active{ background: #f1f5f9; }
.pad-key.pad-fn{ color: #ff5722; }
/* 查單付款 */
.lookup{ display: flex; flex-direction: column; align-items: center; }
.lookup-box{ display: flex; flex-direction: column; align-items: center; gap: 20px; margin-top: 40px; width: 480px; }
.lookup-tip{ font-size: 24px; color: #64748b; }
.lookup-input{
    width: 100%; height: 64px; font-size: 28px; text-align: center;
    border: 2px solid #e2e8f0; border-radius: 14px; outline: none;
}
.lookup-input:focus{ border-color: #ff5722; }
.lookup-error{ color: #ef4444; font-size: 18px; }
/* 點餐主畫面 */
.order{ display: flex; flex-direction: column; padding: 16px; }
.order-top{ display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
.order-title{ font-size: 26px; margin: 0; flex: 1; }
.order-top-cart{ font-size: 20px; font-weight: 700; color: #ff5722; cursor: pointer; }
.order-body{ flex: 1; display: flex; gap: 14px; overflow: hidden; }
.cat-col{
    width: 200px; background: #fff; border-radius: 16px; overflow-y: auto; padding: 8px;
}
.cat-item{
    padding: 20px 16px; font-size: 20px; font-weight: 600; color: #475569;
    border-radius: 12px; cursor: pointer; margin-bottom: 6px;
}
.cat-item.active{ background: linear-gradient(135deg, #ff5722, #ff9800); color: #fff; }
.food-col{ flex: 1; overflow-y: auto; }
.food-grid{ display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; padding: 4px; }
.food-card{
    position: relative; background: #fff; border-radius: 16px; padding: 16px; cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,.05); transition: all .15s ease;
}
.food-card:active{ transform: scale(.97); }
.food-card.sold-out{ opacity: .45; }
.food-img{ height: 130px; border-radius: 12px; overflow: hidden; margin-bottom: 10px; background: #f1f5f9; }
.food-img img{ width: 100%; height: 100%; object-fit: cover; display: block; }
.food-ph{ height: 100%; display: flex; align-items: center; justify-content: center; font-size: 44px; font-weight: 700; color: #cbd5e1; }
.food-name{ font-size: 18px; font-weight: 600; margin-bottom: 6px; }
.food-price{ font-size: 20px; font-weight: 700; color: #ff3b30; }
.food-qty{
    position: absolute; top: 10px; right: 10px; min-width: 28px; height: 28px; line-height: 28px;
    text-align: center; background: #ff5722; color: #fff; border-radius: 14px; font-size: 15px; font-weight: 700;
}
.food-soldout{ position: absolute; top: 10px; left: 10px; background: #64748b; color: #fff; border-radius: 8px; padding: 2px 8px; font-size: 13px; }
.cart-col{ width: 320px; background: #fff; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; }
.cart-head{ padding: 18px; font-size: 22px; font-weight: 700; border-bottom: 1px solid #f0f2f5; }
.cart-list{ flex: 1; overflow-y: auto; padding: 12px; }
.cart-item{ padding: 12px 0; border-bottom: 1px solid #f0f2f5; }
.cart-item-name{ font-size: 16px; font-weight: 600; }
.cart-mods{ font-size: 13px; color: #ff5722; font-weight: 400; }
.cart-item-bottom{ display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
.qty-ctrl{ display: flex; align-items: center; gap: 12px; }
.qty-ctrl button{
    width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff;
    font-size: 22px; cursor: pointer; color: #ff5722;
}
.qty-ctrl span{ font-size: 18px; font-weight: 700; min-width: 20px; text-align: center; }
.cart-item-price{ font-size: 18px; font-weight: 700; color: #ff3b30; }
.cart-empty{ text-align: center; color: #94a3b8; font-size: 18px; margin-top: 40px; }
.cart-foot{ padding: 16px; border-top: 1px solid #f0f2f5; }
.cart-total{ font-size: 24px; font-weight: 800; margin-bottom: 12px; }
.pay-btn{
    width: 100%; height: 56px; font-size: 22px; font-weight: 700; color: #fff;
    background: linear-gradient(135deg, #ff5722, #ff9800); border: none; border-radius: 14px; cursor: pointer;
}
.pay-btn:disabled{ opacity: .45; cursor: not-allowed; }
/* 付款 */
.pay-body{ display: flex; gap: 20px; height: calc(100% - 90px); }
.pay-left{ flex: 1; background: #fff; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; }
.pay-order-no{ font-size: 22px; font-weight: 700; margin-bottom: 16px; }
.pay-items{ flex: 1; overflow-y: auto; }
.pay-item{ display: flex; justify-content: space-between; padding: 10px 0; font-size: 18px; border-bottom: 1px solid #f0f2f5; }
.pay-item-price{ color: #475569; font-weight: 600; }
.pay-grand{ font-size: 30px; font-weight: 800; padding-top: 16px; border-top: 1px solid #f0f2f5; }
.pay-grand span{ color: #ff3b30; }
.pay-right{ width: 460px; background: #fff; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; }
.pay-choose{ font-size: 22px; font-weight: 700; }
.pay-methods{ display: flex; flex-direction: column; gap: 14px; margin: 16px 0; }
.pay-method{
    height: 64px; font-size: 24px; font-weight: 700; color: #475569;
    border: 2px solid #e2e8f0; border-radius: 14px; background: #fff; cursor: pointer;
}
.pay-method.active{ border-color: #ff5722; color: #ff5722; background: rgba(255,87,34,.06); }
.pay-action{ display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: auto; }
.pay-hint{ font-size: 20px; color: #475569; }
.fps-qr{ width: 200px; height: 200px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 12px; }
.fps-placeholder{ width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; border: 1px dashed #cbd5e1; border-radius: 12px; color: #94a3b8; }
/* 完成 */
.done{ display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; }
.done-icon{ font-size: 96px; color: #00c853; }
.done-title{ font-size: 42px; font-weight: 800; margin: 0; }
.done-no{ font-size: 26px; font-weight: 700; }
.done-amount{ font-size: 22px; color: #ff3b30; }
.done-desc{ font-size: 20px; color: #64748b; }
</style>
