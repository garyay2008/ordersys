<template>
    <transition name="move">
        <div v-show="showConfirm" class="confirm-order">
            <template v-if="!orderSuccess">
                <div class="header">
                    <div class="back" @click="hide">
                        <i class="el-icon-arrow-left"></i>
                    </div>
                    <div class="title">確認訂單</div>
                </div>
                <div class="contents">
                    <div class="order-list">
                        <div v-if="sentItems.length" class="section-title">已點食品</div>
                        <ul v-if="sentItems.length">
                            <li v-for="(item, idx) in sentItems" :key="'sent-' + idx">
                                <div class="item-info">
                                    <span class="name">{{ item.name }}</span>
                                    <span class="mods-line" v-if="item.mods && item.mods.length">（{{ item.mods.map(m => typeof m === 'string' ? m : m.name).join('、') }}）</span>
                                </div>
                                <span class="count">x{{ item.count }}</span>
                                <span class="price">${{ Math.round((item.price * item.count) * 100) / 100 }}</span>
                            </li>
                        </ul>
                        <div class="section-title">後加食品</div>
                        <ul>
                            <li v-for="(item, idx) in orderData.order" :key="item.key || item._id + '-' + idx">
                                <img v-if="showImages" :src="item.img" width="40px" height="40px" alt="">
                                <div class="item-info">
                                    <span class="name">{{ item.name }}</span>
                                    <div class="mods-row" v-if="(item.mods && item.mods.length) || item.isCombo">
                                        <span class="edit-mod-btn" @click.stop="editMods(item)">修改</span>
                                        <span class="mods-line" v-if="item.mods && item.mods.length">（{{ item.mods.map(m => typeof m === 'string' ? m : m.name).join('、') }}）</span>
                                    </div>
                                </div>
                                <span class="count">x{{ item.count }}</span>
                                <span class="onSale" v-if="showDiscount">${{ item.onSale * item.count }}</span>
                                <span class="price">${{ item.price * item.count }}</span>
                            </li>
                        </ul>
                        <div class="total">
                            <div class="total-row" v-if="serviceChargeEnabled">服務費 ({{ serviceChargeRate }}%)<span class="price">${{ serviceChargeAmount }}</span></div>
                            <div class="total-row grand">總計<span class="price">${{ grandTotal }}</span></div>
                        </div>
                    </div>
                </div>
                <div class="bottom-area">
                    <el-button type="primary" class="submitBtn" @click="askConfirm">確認下單</el-button>
                </div>
            </template>
            <template v-else>
                <div class="success-view">
                    <div class="success-icon">
                        <i class="el-icon-circle-check"></i>
                    </div>
                    <div class="success-title">您的訂單已送出</div>
                    <div class="success-desc">請耐心等待...</div>
                    <div class="success-actions">
                        <el-button type="primary" class="success-btn" @click="viewOrder">查看我的單據</el-button>
                        <el-button class="success-btn continue-btn" @click="continueOrder">繼續點餐</el-button>
                    </div>
                </div>
            </template>
        <el-dialog :visible.sync="showConfirmBox" title="" width="80%" custom-class="confirm-submit-dialog" :show-close="false" :close-on-click-modal="false" append-to-body>
            <div class="confirm-box-body">
                <p class="confirm-box-title">訂單確認！</p>
                <p class="confirm-box-desc">一旦訂單被確認，就不能取消。</p>
                <div class="confirm-box-actions">
                    <el-button type="primary" round :disabled="submitting" @click="doSubmit">確認</el-button>
                    <el-button round @click="cancelConfirm">取消</el-button>
                </div>
            </div>
        </el-dialog>
        </div>
    </transition>
</template>

<script>
export default {
  name: 'confirmOrder',
  props: {
    orderData: {
      type: Object
    },
    sentItems: {
      type: Array,
      default () { return [] }
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
      showConfirm: false,
      orderSuccess: false,
      showConfirmBox: false,
      submitting: false
    }
  },
  computed: {
    sentTotal () {
      let total = 0
      this.sentItems.forEach(item => {
        total += (item.price || 0) * (item.count || 1)
      })
      return Math.round(total * 100) / 100
    },
    serviceChargeAmount () {
      if (!this.serviceChargeEnabled) return 0
      return Math.round((this.orderData.totalPrice || 0) * (this.serviceChargeRate || 0) / 100 * 100) / 100
    },
    grandTotal () {
      return Math.round(((this.orderData.totalPrice || 0) + this.sentTotal + this.serviceChargeAmount) * 100) / 100
    }
  },
  methods: {
    show () {
      this.orderSuccess = false
      this.showConfirm = true
      this.showConfirmBox = false
      this.submitting = false
    },
    hide () {
      this.showConfirm = false
    },
    viewOrder () {
      this.showConfirm = false
      this.orderSuccess = false
      this.$emit('viewOrder')
    },
    continueOrder () {
      this.showConfirm = false
      this.orderSuccess = false
      this.$emit('closeSent')
    },
    editMods (item) {
      this.$emit('edit-mods', item)
    },
    askConfirm () {
      this.showConfirmBox = true
    },
    cancelConfirm () {
      this.showConfirmBox = false
    },
    doSubmit () {
      if (this.submitting) return
      this.submitting = true
      this.showConfirmBox = false
      const payload = { ...this.orderData, source: 'qr' }
      this.$axios.post('/api/order/submit', payload)
        .then(res => {
          this.$socket.emit('submitOrder')
          this.$emit('clear')
          this.orderSuccess = true
        })
        .catch(_ => {
          this.$message({ type: 'error', message: '下單失敗，請稍後再試' })
        })
    }
  }
}
</script>

<style>
    .move-enter-active, .move-leave-active{
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .move-enter, .move-leave-to{
        opacity: 0;
        transform: translate3d(100%, 0, 0);
    }
    .confirm-order{
        z-index: 50;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #f8f9fb;
        display: flex;
        flex-direction: column;
    }
    .confirm-order > .header{
        position: relative;
        background: #fff;
        height: 52px;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        border-bottom: 1px solid #f0f2f5;
        flex-shrink: 0;
    }
    .confirm-order > .header > .back{
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        display: flex;
        align-items: center;
    }
    .confirm-order > .header > .back > .el-icon-arrow-left{
        display: block;
        padding: 10px 14px;
        font-size: 22px;
        color: #fff;
        background: var(--accent);
        border-radius: 0 20px 20px 0;
        box-shadow: 0 2px 10px var(--accent-glow);
        cursor: pointer;
    }
    .confirm-order > .header > .back > .el-icon-arrow-left:active{
        opacity: 0.85;
    }
    .confirm-order > .header > .title{
        font-size: 17px;
        font-weight: 700;
        color: #1e293b;
        letter-spacing: 0.3px;
    }
    .confirm-order > .contents{
        flex: 1;
        width: 100%;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 8px;
    }
    .confirm-order > .contents > .order-list{
        padding: 16px;
    }
    .contents > .order-list > .order-header{
        display: flex;
        font-size: 12px;
        color: #94a3b8;
        text-align: center;
        padding-bottom: 8px;
        border-bottom: 1px solid #f0f2f5;
        margin-bottom: 12px;
        font-weight: 600;
    }
    .contents > .order-list > .order-header > .pic{
        display: block;
        width: 40px;
    }
    .contents > .order-list > .order-header > .name{
        flex: 2;
        text-align: left;
    }
    .contents > .order-list > .order-header > .count,
    .contents > .order-list > .order-header > .on-sale,
    .contents > .order-list > .order-header > .price{
        text-align: right;
        flex: 1;
    }
    .contents > .order-list > ul > li{
        margin-bottom: 2px;
        padding: 3px 10px;
        background: #fff;
        border-radius: 8px;
        display: flex;
        align-items: center;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    }
    .contents > .order-list > ul > li > img{
        border-radius: 8px;
        overflow: hidden;
        object-fit: cover;
    }
    .contents > .order-list > ul > li > .item-info{
        flex: 2;
        min-width: 0;
        padding-left: 8px;
        display: flex;
        flex-direction: column;
    }
    .contents > .order-list > ul > li > .item-info > .name{
        line-height: 20px;
        text-align: left;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .contents > .order-list > ul > li > .count{
        line-height: 20px;
        font-size: 14px;
        color: #475569;
        text-align: right;
        flex: 1;
        font-weight: 500;
    }
    .contents > .order-list > ul > li > .onSale{
        line-height: 20px;
        font-size: 13px;
        text-decoration: line-through;
        color: #cbd5e1;
        text-align: right;
        flex: 1;
    }
    .contents > .order-list > ul > li > .price{
        line-height: 20px;
        font-size: 15px;
        color: #1e293b;
        text-align: right;
        flex: 1;
        font-weight: 700;
    }
    .contents > .order-list > ul > li > .item-info > .mods-row{
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 2px;
    }
    .contents > .order-list > ul > li > .item-info > .mods-row > .edit-mod-btn{
        flex: 0 0 auto;
        padding: 2px 8px;
        line-height: 16px;
        font-size: 11px;
        font-weight: 600;
        color: var(--primary);
        border: 1px solid var(--primary);
        border-radius: 10px;
        cursor: pointer;
        white-space: nowrap;
    }
    .contents > .order-list > .total{
        margin-top: 12px;
        padding: 14px 16px;
        background: #fff;
        border-radius: 10px;
        text-align: left;
        font-size: 14px;
        color: #1e293b;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    }
    .contents > .order-list > .total > .total-row{
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 0;
    }
    .contents > .order-list > .total > .total-row.grand{
        margin-top: 4px;
        padding-top: 8px;
        border-top: 1px solid #f0f2f5;
        font-weight: 700;
    }
    .contents > .order-list > .total > .price{
        color: var(--accent);
        font-weight: 700;
        font-size: 16px;
    }
    .contents > .order-list > .total > .total-row.grand > .price{
        font-size: 20px;
    }
    .confirm-order > .bottom-area{
        padding: 0 16px 24px;
        background: #fff;
        border-top: 1px solid #f0f2f5;
        flex-shrink: 0;
    }
    .bottom-area > .submitBtn{
        width: 100%;
        margin-top: 14px;
        height: 44px;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.5px;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--primary), var(--primary2)) !important;
        border: none !important;
        box-shadow: 0 4px 16px var(--primary-glow);
        transition: all 0.2s ease;
    }
    .bottom-area > .submitBtn:active{
        transform: scale(0.97);
        box-shadow: 0 2px 8px var(--primary-glow);
    }
    .bottom-area > .submitBtn:hover{
        box-shadow: 0 6px 20px var(--primary-glow);
    }
    .success-view{
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 24px 16px;
    }
    .success-icon{
        font-size: 72px;
        color: #00c853;
        margin-bottom: 20px;
        animation: popIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
    }
    .success-title{
        font-size: 20px;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 8px;
    }
    .success-desc{
        font-size: 14px;
        color: #94a3b8;
        margin-bottom: 36px;
    }
    .success-actions{
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: 100%;
    }
    .success-btn{
        width: 100%;
        height: 44px;
        font-size: 15px;
        font-weight: 700;
        border-radius: 12px;
        border: none !important;
        background: linear-gradient(135deg, var(--primary), var(--primary2)) !important;
        color: #fff !important;
        box-shadow: 0 4px 16px var(--primary-glow);
        transition: all 0.2s ease;
    }
    .success-btn:active{
        transform: scale(0.97);
    }
    .success-btn.continue-btn{
        background: #f1f5f9 !important;
        color: #475569 !important;
        box-shadow: none;
    }
    .success-btn.continue-btn:active{
        background: #e2e8f0 !important;
    }
    .section-title{
        font-size: 32.5px;
        font-weight: 700;
        color: var(--accent);
        margin: 4px 0 6px;
        padding-left: 8px;
        border-left: 3px solid var(--accent);
    }
    .contents > .order-list > ul > li > .item-info .mods-line{
        line-height: 16px;
        font-size: 12px;
        color: var(--accent);
        font-weight: 400;
        white-space: normal;
        word-break: break-all;
    }
    .confirm-box-body{
        text-align: center;
        padding: 6px 4px 2px;
    }
    .confirm-box-title{
        margin: 0 0 8px;
        font-size: 18px;
        font-weight: 700;
        color: #1e293b;
    }
    .confirm-box-desc{
        margin: 0 0 20px;
        font-size: 14px;
        color: #e74c3c;
        font-weight: 600;
    }
    .confirm-box-actions{
        display: flex;
        justify-content: center;
        gap: 12px;
    }
    @keyframes popIn {
        0% { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }
</style>
