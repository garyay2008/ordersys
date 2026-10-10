<template>
    <transition name="move">
        <div v-show="showFlag" class="food">
            <div class="fond-content">
                <div class="image-header" :class="{ 'no-img': !qrSetting.showImages }">
                    <img v-if="qrSetting.showImages" :src="food.img" alt="">
                    <div class="back" @click="hide">
                        <i class="el-icon-arrow-left"></i>
                    </div>
                </div>
                <div class="contents">
                    <h1 class="title">{{food.name}}</h1>
                    <div class="price">
                        <span class="now">${{ currentPrice }}</span>
                        <span class="old" v-show="food.isDiscount && qrSetting.showDiscount">${{food.onSale}}</span>
                    </div>
                    <div class="specs" v-if="qrSetting.showSpecs && food.specs && food.specs.length">
                        <span class="spec-title">規格</span>
                        <span v-for="(s, i) in food.specs" :key="i"
                              class="spec-item" :class="{active: selectedSpec === i}"
                              @click.stop="selectedSpec = i">
                            {{ s.name }} ${{ s.price }}
                        </span>
                    </div>
                    <div class="specs mods" v-if="modCodeList.length">
                        <span class="spec-title">口味改碼</span>
                        <span v-for="(m, i) in modCodeList" :key="i"
                              class="spec-item" :class="{active: selectedMods.some(x => x && (x.id || x.name) === m._id)}"
                              @click.stop="toggleMod(m)">
                            {{ m.name }}<template v-if="qrSetting.showModPrices && (m.price || 0) > 0"> (+${{ m.price }})</template><i v-if="m.mandatory" class="req-badge">必選</i>
                        </span>
                        <el-input v-model="customMod" placeholder="自定義(如 走蔥)" size="mini"
                                  style="width: 130px; display: inline-block; margin-left: 6px;"
                                  @keyup.enter.native="addCustomMod"></el-input>
                    </div>
                    <template v-if="!food.soldOut">
                        <div class="cartcontrol-wrapper" v-if="!(food.specs && food.specs.length)">
                            <CartControl :food="food"></CartControl>
                        </div>
                    </template>
                        <div v-else class="sold-out">已售罄</div>
                </div>
                <div class="split" v-show="food.describe"></div>
                <div class="info" v-show="food.describe">
                    <h1 class="title">商品信息</h1>
                    <p class="text">{{food.describe}}</p>
                </div>
            </div>
            <transition name="fade">
                <div v-if="!food.soldOut" class="buy" :class="{ submitting }" @click.stop.prevent="addFirst($event)">加入購物車</div>
            </transition>
        </div>
    </transition>
</template>

<script>
import BScroll from 'better-scroll'
import CartControl from '@/components/user/CartControl'
export default {
  name: 'commodityDetail',
  props: {
    food: {
      type: Object
    },
    qrSetting: {
      type: Object,
      default: () => ({ showImages: true, showDescribe: true, showStock: false, showModPrices: true, showSoldOutItems: true, showDiscount: true, showSpecs: false })
    },
    channel: {
      type: String,
      default: 'qr'
    }
  },
  data () {
    return {
      showFlag: false,
      selectedSpec: 0,
      selectedMods: [],
      modCodeList: [],
      customMod: '',
      submitting: false,
      editItem: null
    }
  },
  computed: {
    currentPrice () {
      if (this.qrSetting.showSpecs && this.food.specs && this.food.specs.length && this.selectedSpec >= 0) {
        const s = this.food.specs[this.selectedSpec]
        return s ? s.price : this.food.price
      }
      return this.food.price
    }
  },
  methods: {
    show (food, editItem) {
      this.showFlag = true
      this.$emit('open')
      this.selectedSpec = 0
      this.selectedMods = []
      this.customMod = ''
      this.submitting = false
      this.editItem = editItem || null
      if (this.editItem) {
        const specs = (food && food.specs) || this.food.specs || []
        if (this.editItem.spec) {
          const idx = specs.findIndex(sp => sp.name === this.editItem.spec)
          if (idx >= 0) this.selectedSpec = idx
        }
        this.selectedMods = (this.editItem.mods || []).map(m => {
          if (typeof m === 'string') return { name: m }
          return { id: m.id, name: m.name, price: m.price || 0, station: m.station || '' }
        })
      }
      this.loadModCodes()
      this.$nextTick(() => {
        if (!this.scroll) {
          this.scroll = new BScroll(this.$el, {
            click: true
          })
        } else {
          this.scroll.refresh()
        }
      })
    },
    loadModCodes () {
      this.$axios.get('/api/modcode/list', { params: { channel: this.channel } })
        .then(res => {
          const all = res.data || []
          const cats = this.food.modCategories || []
          // 依商品的改碼類別過濾；未設定改碼類別則不顯示任何口味
          this.modCodeList = cats.length ? all.filter(m => cats.indexOf(m.category) >= 0) : []
          this.$nextTick(() => {
            if (this.scroll) this.scroll.refresh()
          })
        })
        .catch(() => {
          this.modCodeList = []
          this.$nextTick(() => {
            if (this.scroll) this.scroll.refresh()
          })
        })
    },
    toggleMod (m) {
      const idx = this.selectedMods.findIndex(x => x && (x.id || x.name) === m._id)
      if (idx >= 0) this.selectedMods.splice(idx, 1)
      else this.selectedMods.push({ id: m._id, name: m.name, price: m.price || 0, station: m.station || '' })
    },
    addCustomMod () {
      const name = this.customMod.trim()
      if (!name) return
      if (!this.selectedMods.some(x => x && (x.id || x.name) === name)) this.selectedMods.push({ name })
      this.customMod = ''
    },
    qrColor (category) {
      const palette = ['#e74c3c', '#e67e22', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#d35400', '#2c3e50', '#c0392b', '#009688', '#34495e', '#7f8c8d']
      let hash = 0
      const key = String(category || 'default')
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 997
      return palette[hash % palette.length]
    },
    // QR 端必選改碼驗證：同一類別內有 mandatory 的改碼，至少要選一項
    validateMandatoryMods () {
      const byCat = {}
      this.modCodeList.forEach(m => {
        if (!m.mandatory) return
        const c = m.category || '其他'
        if (!byCat[c]) byCat[c] = []
        byCat[c].push(m)
      })
      for (const cat in byCat) {
        const need = byCat[cat]
        const ok = need.some(m => this.selectedMods.some(x => x && (x.id || x.name) === m._id))
        if (!ok) {
          this.$message({ type: 'warning', message: `請選擇「${cat}」的必選改碼` })
          return false
        }
      }
      return true
    },
    hide () {
      this.showFlag = false
      this.$emit('close')
    },
    addFirst (event) {
      if (!event._constructed) {
        return
      }
      if (this.submitting) return
      if (!this.validateMandatoryMods()) return
      this.submitting = true
      setTimeout(() => { this.submitting = false }, 400)
      const specs = this.qrSetting.showSpecs ? this.food.specs : []
      const mods = this.selectedMods.slice()
      const modsExtra = mods.reduce((sum, m) => sum + (m && m.price ? Number(m.price) : 0), 0)
      const s = (specs && specs.length) ? (specs[this.selectedSpec] || specs[0]) : null
      const hasModOrSpec = (specs && specs.length) || mods.length
      if (!hasModOrSpec && !this.editItem) {
        this.$set(this.food, 'count', 1)
        this.hide()
        return
      }
      const payload = {
        _id: this.food._id,
        commodityId: this.food._id,
        name: this.food.name + (s ? '(' + s.name + ')' : ''),
        price: Math.round(((s ? s.price : this.food.price) + modsExtra) * 100) / 100,
        img: this.food.img,
        spec: s ? s.name : undefined,
        mods: mods.length ? mods : undefined
      }
      if (this.editItem) {
        this.$emit('update', { payload, targetKey: this.editItem.key })
        this.hide()
      } else {
        if (this.food.count) this.food.count = 0
        this.$emit('add', payload)
        this.hide()
      }
    }
  },
  components: {
    CartControl
  }
}
</script>

<style>
    .food{
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        z-index: 30;
        width: 100%;
        background: #f8f9fb;
        transform: translate3d(0, 0, 0);
    }
    .food.move-enter-active, .food.move-leave-active{
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .food.move-enter, .food.move-leave-to{
        opacity: 0;
        transform: translate3d(100%, 0, 0);
    }
    .food .image-header{
        position: relative;
        width: 100%;
        height: 0;
        padding-top: 100%;
        overflow: hidden;
    }
    .food .image-header > img{
        position: absolute;
        top: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .food .image-header > .no-img-header{
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #e2e8f0, #f1f5f9);
    }
    .food .image-header > .no-img-header .no-img-char{
        font-size: 96px;
        font-weight: 700;
        color: #94a3b8;
        letter-spacing: 2px;
    }
    .food .image-header.no-img{
        height: 52px;
        padding-top: 0;
        background: #f8f9fb;
        display: flex;
        align-items: center;
    }
    .food .image-header.no-img > .back{
        position: static;
    }
    .food .image-header > .back{
        position: absolute;
        top: 12px;
        left: 0;
        z-index: 2;
    }
    .food .image-header > .back > .el-icon-arrow-left{
        display: block;
        padding: 10px 14px;
        font-size: 22px;
        color: #fff;
        background: var(--accent);
        border-radius: 0 20px 20px 0;
        box-shadow: 0 2px 10px var(--accent-glow);
    }
    .food > .fond-content{
        padding-bottom: 60px;
    }
    .food .contents{
        position: relative;
        padding: 20px 18px 20px;
        background: #fff;
        border-radius: 0;
    }
    .food .contents > .title{
        line-height: 1.4;
        margin-bottom: 10px;
        font-size: 18px;
        font-weight: 700;
        color: #1e293b;
    }

    .food .contents > .price{
        font-weight: 700;
        line-height: 28px;
        margin-bottom: 4px;
    }
    .food .contents > .price > .now{
        margin-right: 8px;
        font-size: 20px;
        color: var(--accent);
    }
    .food .contents > .price > .old{
        text-decoration: line-through;
        font-size: 12px;
        color: #94a3b8;
    }
    .food .contents > .specs{
        margin: 14px 0;
        padding: 12px 0;
        border-top: 1px solid #f0f2f5;
    }
    .food .contents > .specs.mods{
        margin-top: 10px;
        padding-top: 14px;
    }
    .food .contents > .specs > .spec-title{
        font-size: 13px;
        color: #94a3b8;
        margin-right: 10px;
        font-weight: 600;
    }
    .food .contents > .specs > .spec-item{
        display: inline-block;
        margin: 0 8px 8px 0;
        padding: 6px 14px;
        border: 1.5px solid #e2e8f0;
        border-radius: 8px;
        font-size: 13px;
        color: #475569;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    .food .contents > .specs > .spec-item:active{
        transform: scale(0.96);
    }
    .food .contents > .specs > .spec-item.active{
        border-color: var(--primary);
        color: var(--primary);
        background: var(--primary-soft);
        font-weight: 600;
    }
    .food .contents > .specs .req-badge{
        font-size: 10px;
        color: #fff;
        background: var(--accent);
        border-radius: 4px;
        padding: 1px 4px;
        margin-left: 4px;
        font-style: normal;
    }
    .food .contents > .sold-out{
        position: absolute;
        right: 14px;
        bottom: 20px;
        font-size: 14px;
        color: #94a3b8;
        font-weight: 500;
    }
    .food .contents > .cartcontrol-wrapper{
        position: absolute;
        right: 14px;
        bottom: 14px;
    }
    .food > .buy{
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10;
        height: 48px;
        line-height: 48px;
        padding: 0;
        box-sizing: border-box;
        border-radius: 0;
        text-align: center;
        font-size: 15px;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(135deg, var(--primary), var(--primary2));
        box-shadow: 0 -2px 12px var(--primary-glow);
        transition: all 0.2s ease;
    }
    .food > .buy:active{
        opacity: 0.85;
    }
    .food > .buy.submitting{
        opacity: 0.6;
        pointer-events: none;
    }
    .food > .buy.fade-enter-active, .food > .buy.fade-leave-active{
        transition: all 0.2s;
    }
    .food > .buy.fade-enter, .food > .buy.fade-leave-to{
        opacity: 0;
    }
    .food .info{
        padding: 18px;
        padding-bottom: 25px;
        margin-top: 10px;
        background: #fff;
    }
    .food .info > .title{
        line-height: 1.4;
        margin-bottom: 8px;
        font-size: 15px;
        color: #1e293b;
        font-weight: 600;
    }
    .food .info > .text{
        font-size: 13px;
        line-height: 22px;
        padding: 0 4px;
        color: #64748b;
    }
    .split{
        width: 100%;
        height: 10px;
        border-top: 1px solid #f0f2f5;
        background: #f8f9fb;
    }
</style>
