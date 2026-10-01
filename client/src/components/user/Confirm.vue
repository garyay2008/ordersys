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
                        <div class="order-header">
                            <span class="pic" v-if="showImages">圖片</span>
                            <span class="name">名稱</span>
                            <span class="count">數量</span>
                            <span class="on-sale" v-if="showDiscount">打折</span>
                            <span class="price">價格</span>
                        </div>
                        <ul>
                            <li v-for="item in orderData.order" :key="item._id">
                                <img v-if="showImages" :src="item.img" width="40px" height="40px" alt="">
                                <span class="name">{{ item.name }}</span>
                                <span class="count">x{{ item.count }}</span>
                                <span class="onSale" v-if="showDiscount">${{ item.onSale * item.count }}</span>
                                <span class="price">${{ item.price * item.count }}</span>
                            </li>
                        </ul>
                        <div class="total">
                            <div class="total-row">小計<span class="price">${{ orderData.totalPrice }}</span></div>
                            <div class="total-row" v-if="serviceChargeEnabled">服務費 ({{ serviceChargeRate }}%)<span class="price">${{ serviceChargeAmount }}</span></div>
                            <div class="total-row grand">總計<span class="price">${{ grandTotal }}</span></div>
                        </div>
                    </div>
                </div>
                <div class="bottom-area">
                    <el-button type="primary" class="submitBtn" @click="submitOrder">確認下單</el-button>
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
      orderSuccess: false
    }
  },
  computed: {
    serviceChargeAmount () {
      if (!this.serviceChargeEnabled) return 0
      return Math.round((this.orderData.totalPrice || 0) * (this.serviceChargeRate || 0) / 100 * 100) / 100
    },
    grandTotal () {
      return Math.round(((this.orderData.totalPrice || 0) + this.serviceChargeAmount) * 100) / 100
    }
  },
  methods: {
    show () {
      this.orderSuccess = false
      this.showConfirm = true
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
    submitOrder () {
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
        font-size: 18px;
        color: #1e293b;
        cursor: pointer;
        border-radius: 0 8px 8px 0;
    }
    .confirm-order > .header > .back > .el-icon-arrow-left:active{
        background: #f1f5f9;
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
        margin-bottom: 10px;
        padding: 10px 12px;
        background: #fff;
        border-radius: 10px;
        display: flex;
        align-items: center;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
    }
    .contents > .order-list > ul > li > img{
        border-radius: 8px;
        overflow: hidden;
        object-fit: cover;
    }
    .contents > .order-list > ul > li > .name{
        line-height: 40px;
        text-align: left;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 2;
        padding-left: 8px;
    }
    .contents > .order-list > ul > li > .count{
        line-height: 40px;
        font-size: 14px;
        color: #475569;
        text-align: right;
        flex: 1;
        font-weight: 500;
    }
    .contents > .order-list > ul > li > .onSale{
        line-height: 40px;
        font-size: 13px;
        text-decoration: line-through;
        color: #cbd5e1;
        text-align: right;
        flex: 1;
    }
    .contents > .order-list > ul > li > .price{
        line-height: 40px;
        font-size: 15px;
        color: #1e293b;
        text-align: right;
        flex: 1;
        font-weight: 700;
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
    @keyframes popIn {
        0% { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }
</style>
