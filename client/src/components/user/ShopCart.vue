<template>
    <div>
        <div class="sent-panel" v-show="showSentPanel">
                <div class="sent-header">
                    <span class="sent-title">已點食品</span>
                    <div class="sent-header-right">
                        <span class="sent-total">小計 ${{ sentTotal }}</span>
                        <span class="sent-close" @click="closeSentPanel"><i class="el-icon-close"></i></span>
                    </div>
                </div>
                <div class="sent-list">
                    <div v-for="(item, idx) in sentItems" :key="idx" class="sent-item">
                        <span class="sent-item-name">
                            {{ item.name }}
                            <span class="sent-item-mods" v-if="modsText(item)">（{{ modsText(item) }}）</span>
                        </span>
                        <span class="sent-item-right">
                            <span class="sent-item-qty">x{{ item.count }}</span>
                            <span class="sent-item-price">${{ Math.round((item.price * item.count) * 100) / 100 }}</span>
                        </span>
                    </div>
                </div>
            </div>
            <div class="shopcart" v-show="!hidden">
            <div class="contents">
                <div class="content-left" @click="toggleList">
                    <div class="logo-wrapper">
                        <div class="logo" :class="{'highlight':totalCount>0}">
                            <i class="el-icon-shopping-cart-1" :class="{'highlight':totalCount>0}"></i>
                        </div>
                        <div class="num" v-show="totalCount>0">{{totalCount}}</div>
                    </div>
                    <div class="price">${{totalPrice}}元</div>
                </div>
                <div class="content-view" v-if="sentItems.length" @click.stop="toggleSentPanel">
                    <div class="view-order-btn" :class="{'active': showSentPanel}">
                        <i class="el-icon-tickets"></i>
                        <span>查看訂單</span>
                        <span class="sent-badge">{{ sentCount }}</span>
                    </div>
                </div>
                <div class="content-right" @click.stop.prevent="pay">
                    <div class="pay" :class="payClass">
                        確認下單
                    </div>
                </div>
            </div>
            <transition name="fold">
                <div class="shopcart-list" v-show="listShow">
                    <div class="list-header">
                        <div class="back" @click="hideList">
                            <i class="el-icon-arrow-left"></i>
                        </div>
                        <h1 class="title">購物車</h1>
                        <span class="empty" @click="empty">清空</span>
                    </div>
                    <div class="list-content" ref="listContent">
                        <ul>
                            <li class="food" v-for="(food,index) in selectFoods" :key="index">
                                <span class="name">{{food.name}}</span>
                                <span class="mods" v-if="food.mods && food.mods.length">改碼：{{ food.mods.map(m => typeof m === 'string' ? m : m.name).join('、') }}<span class="mods-edit" @click.stop="editMods(food)">修改</span></span>
                                <span class="mods" v-else-if="food.isCombo"><span class="mods-edit" @click.stop="editMods(food)">修改</span></span>
                                <div class="price">
                                    <span>${{ displayFoodSubtotal(food, index) }}</span>
                                </div>
                                <div class="cartcontrol-wrapper">
                                    <CartControl :food="food"></CartControl>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </transition>
        </div>
        <transition name="fade">
            <div class="list-mask" v-show="listShow" @click="hideList"></div>
        </transition>
        <Confirm ref="confirm" @clear="empty" :orderData="orderData" :show-images="showImages" :show-discount="showDiscount" :service-charge-enabled="serviceChargeEnabled" :service-charge-rate="serviceChargeRate" :sent-items="sentItems" @viewOrder="showSent" @closeSent="closeSentPanel" @edit-mods="editModsFromConfirm"></Confirm>
    </div>
</template>

<script>
import BScroll from 'better-scroll'
import CartControl from '@/components/user/CartControl'
import Confirm from '@/components/user/Confirm'
export default {
  name: 'shopCart',
  props: {
    selectFoods: {
      type: Array,
      default () {
        return [{
          price: 0,
          count: 0
        }]
      }
    },
    id: {
      type: String
    },
    sentItems: {
      type: Array,
      default () { return [] }
    },
    effectiveOrder: {
      type: Object,
      default: null
    },
    priceOverride: {
      type: Object,
      default: null
    },
    hidden: {
      type: Boolean,
      default: false
    },
    showImages: {
      type: Boolean,
      default: true
    },
    showDiscount: {
      type: Boolean,
      default: true
    },
    serviceChargeEnabled: {
      type: Boolean,
      default: false
    },
    serviceChargeRate: {
      type: Number,
      default: 10
    }
  },
  data () {
    return {
      fold: true,
      showConfirm: false,
      orderData: {},
      showSentPanel: false
    }
  },
  computed: {
    totalPrice () {
      const eff = this.effectiveOrder && this.effectiveOrder.totalPrice
      if (typeof eff === 'number' && eff > 0) {
        return eff
      }
      let total = 0
      this.selectFoods.forEach((food) => {
        total += (food.price || 0) * (food.count || 1)
      })
      total = Math.round(total * 100) / 100
      return total
    },
    totalCount () {
      let count = 0
      this.selectFoods.forEach((food) => {
        count += food.count
      })
      return count
    },
    payClass () {
      if (this.totalPrice <= 0) {
        return 'not-enough'
      } else {
        return 'enough'
      }
    },
    listShow () {
      if (!this.totalCount) {
        return false
      }
      const show = !this.fold
      if (show) {
        this.$nextTick(() => {
          if (!this.scroll) {
            this.scroll = new BScroll(this.$refs.listContent, {
              click: true
            })
          } else {
            this.scroll.refresh()
          }
        })
      }
      return show
    },
    sentTotal () {
      let total = 0
      this.sentItems.forEach(item => {
        total += (item.price || 0) * (item.count || 1)
      })
      return Math.round(total * 100) / 100
    },
    sentCount () {
      let count = 0
      this.sentItems.forEach(item => {
        count += (item.count || 1)
      })
      return count
    }
  },
  methods: {
    modsExtraOf (food) {
      return (food.mods || []).reduce((sum, m) => sum + (typeof m === 'object' && m && m.price ? Number(m.price) || 0 : 0), 0)
    },
    // 已點食品的改碼摘要（含套餐子品項 contents[].mods）
    modsText (item) {
      const fmt = list => (list || []).map(m => (typeof m === 'string' ? m : (m && m.name) || '')).filter(Boolean).join('、')
      const parts = []
      const top = fmt(item.mods)
      if (top) parts.push(top)
      ;(item.contents || []).forEach(c => {
        const ms = fmt(c && c.mods)
        if (ms) parts.push((c.name || '') + '：' + ms)
      })
      return parts.join('；')
    },
    // 跟餐價規則：購物車顯示的單價（跟餐價 + 改碼加價）
    displayFoodPrice (food, index) {
      const o = (this.priceOverride || {})[index]
      if (o && o.qty >= (food.count || 1)) {
        return Math.round((o.price + this.modsExtraOf(food)) * 100) / 100
      }
      return Math.round(((food.price || 0) + this.modsExtraOf(food)) * 100) / 100
    },
    // 跟餐價規則：購物車顯示的小計（已捆綁數量按跟餐價，其餘按原價）
    displayFoodSubtotal (food, index) {
      const o = (this.priceOverride || {})[index]
      if (!o) return Math.round(((food.price || 0) * (food.count || 1)) * 100) / 100
      const total = food.count || 1
      const bundled = Math.min(o.qty, total)
      const remaining = total - bundled
      const modsExtra = this.modsExtraOf(food)
      const unitBundle = Math.round((o.price + modsExtra) * 100) / 100
      const unitFull = Math.round((food.price || 0) * 100) / 100
      return Math.round((bundled * unitBundle + remaining * unitFull) * 100) / 100
    },
    toggleList () {
      if (!this.totalCount) {
        return
      }
      this.fold = !this.fold
    },
    toggleSentPanel () {
      this.showSentPanel = !this.showSentPanel
      this.$emit('sent-panel-toggle', this.showSentPanel)
    },
    closeSentPanel () {
      this.showSentPanel = false
      this.$emit('sent-panel-toggle', false)
    },
    empty () {
      this.selectFoods.forEach((food) => {
        food.count = 0
      })
      // 清空後收回購物車列表，避免再加第一個貨品時又自動展開詳情
      this.fold = true
      this.$emit('emptyCart')
    },
    showSent () {
      this.showSentPanel = true
      this.$emit('sent-panel-toggle', true)
    },
    editMods (food) {
      this.$emit('edit-mods', food)
    },
    editModsFromConfirm (item) {
      this.$refs.confirm.hide()
      this.$emit('edit-mods', item)
    },
    pay () {
      if (this.totalPrice <= 0) {
        return
      }
      const effItems = this.effectiveOrder && Array.isArray(this.effectiveOrder.items) && this.effectiveOrder.items.length
        ? this.effectiveOrder.items
        : this.selectFoods
      const src = effItems && effItems.length ? effItems : this.selectFoods
      // 快照一份，避免送出後購物車數量被清空連帶影響確認版面顯示
      const order = (src || []).map(f => Object.assign({}, f))
      this.orderData = { deskNo: parseInt(this.id), totalPrice: this.totalPrice, order }
      this.$refs.confirm.show()
    },
    hideList () {
      this.fold = true
    }
  },
  components: {
    CartControl,
    Confirm
  }
}
</script>

<style>
    .sent-panel{
        position: fixed;
        top: 0;
        left: 0;
        z-index: 60;
        width: 100%;
        height: 100%;
        background: #f8f9fb;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        transition: all 0.3s ease;
    }
    .sent-header{
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        background: #f8f9fb;
        border-bottom: 1px solid #f0f2f5;
        position: sticky;
        top: 0;
        z-index: 1;
    }
    .sent-header-right{
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .sent-title{
        font-size: 32.5px;
        font-weight: 700;
        color: var(--accent);
    }
    .sent-total{
        font-size: 14px;
        font-weight: 700;
        color: var(--accent);
    }
    .sent-close{
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #64748b;
        font-size: 22px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .sent-close:active{
        background: #cbd5e1;
    }
    .sent-list{
        padding: 4px 16px 8px;
    }
    .sent-item{
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 10px 0;
        border-bottom: 1px solid #f5f5f5;
    }
    .sent-item:last-child{
        border-bottom: none;
    }
    .sent-item-name{
        flex: 1;
        min-width: 0;
        font-size: 13px;
        color: #1e293b;
        font-weight: 500;
        white-space: normal;
        word-break: break-word;
        line-height: 1.5;
    }
    .sent-item-mods{
        font-size: 11px;
        color: var(--accent);
        font-weight: 400;
    }
    .sent-item-right{
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
        margin-left: 10px;
    }
    .sent-item-qty{
        font-size: 12px;
        color: #64748b;
    }
    .sent-item-price{
        font-size: 13px;
        font-weight: 700;
        color: #1e293b;
    }
    .shopcart{
        position: fixed;
        left: 0px;
        bottom: 0px;
        z-index: 50;
        width: 100%;
        height: 50px;
    }
    .shopcart > .contents{
        display: flex;
        background: #fff;
        border-top: 1px solid #e8ecf1;
        font-size: 0;
        color: #333;
        box-shadow: 0 -2px 12px rgba(0,0,0,0.06);
    }
    .contents > .content-left{
        flex: 1;
    }
    .contents > .content-left > .logo-wrapper{
        display: inline-block;
        vertical-align: top;
        position: relative;
        top: -12px;
        margin: 0 14px;
        padding: 6px;
        width: 56px;
        height: 56px;
        box-sizing: border-box;
        border-radius: 50%;
        background: #fff;
        border: 2px solid #e8ecf1;
        transition: border-color 0.2s;
    }
    .contents > .content-left > .logo-wrapper > .logo{
        width: 100%;
        height: 100%;
        border-radius: 50%;
        text-align: center;
        background: #e8ecf1;
        color: #94a3b8;
        transition: all 0.25s ease;
    }
    .contents > .content-left > .logo-wrapper > .logo > i{
        font-size: 28px;
        display: block;
        height: 40px;
        width: 40px;
        line-height: 40px;
    }
    .contents > .content-left > .logo-wrapper > .logo.highlight{
        background: linear-gradient(135deg, var(--primary), var(--primary2));
        color: #fff;
        box-shadow: 0 4px 12px var(--primary-glow);
    }
    .contents > .content-left > .logo-wrapper.highlight{
        border-color: var(--primary);
    }
    .contents > .content-left > .logo-wrapper > .num{
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 20px;
        height: 18px;
        line-height: 18px;
        text-align: center;
        border-radius: 10px;
        padding: 0 4px;
        font-size: 10px;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(135deg, var(--accent), var(--accent2));
        box-shadow: 0 2px 8px var(--accent-glow);
    }
    .contents > .content-left > .price{
        display: inline-block;
        vertical-align: top;
        margin-top: 14px;
        line-height: 22px;
        padding-right: 12px;
        box-sizing: border-box;
        font-size: 16px;
        font-weight: 700;
        color: #1e293b;
    }
    .contents > .content-left > .desc{
        display: inline-block;
        vertical-align: top;
        margin: 14px 0 0 12px;
        line-height: 22px;
        font-size: 10px;
    }
    .contents > .content-view{
        display: flex;
        align-items: stretch;
        cursor: pointer;
    }
    .view-order-btn{
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 50px;
        line-height: 50px;
        padding: 0 14px;
        background: linear-gradient(135deg, var(--primary), var(--primary2));
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.5px;
        box-shadow: 0 2px 8px var(--primary-glow);
        transition: all 0.25s ease;
        white-space: nowrap;
    }
    .view-order-btn:active{
        opacity: 0.85;
    }
    .view-order-btn.active{
        box-shadow: 0 0 0 2px var(--accent), 0 2px 10px var(--primary-glow);
    }
    .view-order-btn > i{
        font-size: 14px;
    }
    .sent-badge{
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
    }
    .contents > .content-right{
        flex: 0 0 110px;
        width: 110px;
    }
    .contents > .content-right > .pay{
        height: 50px;
        line-height: 50px;
        text-align: center;
        font-size: 13px;
        font-weight: 600;
        background: #e2e8f0;
        color: #94a3b8;
        transition: all 0.25s ease;
        letter-spacing: 0.5px;
    }
    .contents > .content-right > .pay.not-enough{
        background: #e2e8f0;
        color: #94a3b8;
    }
    .contents > .content-right > .pay.enough{
        background: linear-gradient(135deg, var(--primary), var(--primary2));
        color: #fff;
        box-shadow: 0 2px 12px var(--primary-glow);
    }

    .shopcart > .ball-container .ball{
        position: fixed;
        left: 32px;
        bottom: 24px;
        z-index: 200;
        transition: all 0.4s cubic-bezier(0.49, -0.29, 0.75, 0.41);
    }
    .shopcart > .ball-container .ball > .inner{
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), var(--primary2));
        transition: all 0.4s linear;
    }

    .shopcart > .shopcart-list{
        position: fixed;
        left: 0px;
        top: 0px;
        right: 0px;
        bottom: 0px;
        z-index: 1;
        width: 100%;
        height: 100%;
        background: #f8f9fb;
        display: flex;
        flex-direction: column;
    }
    .shopcart > .shopcart-list.fold-enter-active,
    .shopcart > .shopcart-list.fold-leave-active{
        transition: transform 0.3s ease;
    }
    .shopcart > .shopcart-list.fold-enter,
    .shopcart > .shopcart-list.fold-leave-to{
        transform: translate3d(0, 100%, 0);
    }
    .shopcart > .shopcart-list > .list-header{
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 52px;
        flex: 0 0 52px;
        background: #fff;
        border-bottom: 1px solid #f0f2f5;
    }
    .shopcart > .shopcart-list > .list-header > .back{
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        display: flex;
        align-items: center;
    }
    .shopcart > .shopcart-list > .list-header > .back > .el-icon-arrow-left{
        display: block;
        padding: 10px 14px;
        font-size: 22px;
        color: #fff;
        background: var(--accent);
        border-radius: 0 20px 20px 0;
        box-shadow: 0 2px 10px var(--accent-glow);
        cursor: pointer;
    }
    .shopcart > .shopcart-list > .list-header > .title{
        font-size: 17px;
        color: #1e293b;
        font-weight: 700;
        letter-spacing: 0.3px;
    }
    .shopcart > .shopcart-list > .list-header > .empty{
        position: absolute;
        right: 16px;
        top: 0;
        height: 52px;
        line-height: 52px;
        font-size: 13px;
        color: var(--accent);
        cursor: pointer;
    }
    .shopcart > .shopcart-list > .list-content{
        flex: 1;
        padding: 0 16px;
        overflow: hidden;
        background: #fff;
    }
    .shopcart > .shopcart-list > .list-content  .food{
        position: relative;
        padding: 12px 0;
        box-sizing: border-box;
    }
    .shopcart > .shopcart-list > .list-content  .food::after{
        display: block;
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        border-top: 1px solid #f0f2f5;
        content: ' ';
    }
    .shopcart > .shopcart-list > .list-content  .food > .name{
        line-height: 24px;
        font-size: 14px;
        color: #1e293b;
        font-weight: 500;
    }
    .shopcart > .shopcart-list > .list-content  .food > .mods{
        display: block;
        line-height: 18px;
        font-size: 12px;
        color: var(--accent);
    }
    .shopcart > .shopcart-list > .list-content  .food > .mods > .mods-edit{
        margin-left: 8px;
        font-size: 11px;
        font-weight: 600;
        color: var(--primary);
        text-decoration: underline;
        cursor: pointer;
    }
    .shopcart > .shopcart-list > .list-content  .food > .price{
        position: absolute;
        right: 88px;
        bottom: 12px;
        line-height: 24px;
        font-size: 14px;
        font-weight: 700;
        color: var(--accent);
    }
    .shopcart > .shopcart-list > .list-content  .food > .cartcontrol-wrapper{
        position: absolute;
        right: 0px;
        bottom: 6px;
    }

    .list-mask{
        position: fixed;
        top: 0px;
        left: 0px;
        width: 100%;
        height: 100%;
        z-index: 40;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        opacity: 1;
        background: rgba(7, 17, 27, 0.55);
    }
    .list-mask.fade-enter-active, .list-mask.fade-leave-active{
        transition: all 0.5s;
    }
    .list-mask.fade-enter, .list-mask.fade-leave-to{
        opacity: 0;
        background: rgba(7, 17, 27, 0);
    }
</style>
