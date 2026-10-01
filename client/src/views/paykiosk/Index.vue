<template>
    <div id="paykiosk" @click="focusInput">
        <!-- 輸入單號 -->
        <div v-if="step === 'home'" class="pk-screen home">
            <h1 class="pk-title">{{ shopName || '自助付款' }}</h1>
            <p class="pk-sub">請輸入訂單編號 或 掃描 Barcode</p>
            <div class="pk-display">{{ inputNo }}</div>
            <input ref="scanInput" v-model="inputNo" class="pk-scan-input"
                   autocomplete="off" placeholder="掃描或輸入單號" @keyup.enter="query">
            <div class="num-pad">
                <button v-for="n in ['1','2','3','4','5','6','7','8','9','清空','0','⌫']" :key="n"
                        class="pad-key" :class="{ 'pad-fn': n === '清空' || n === '⌫' }"
                        @click="onPadKey(n)">{{ n }}</button>
            </div>
            <button class="pk-query" :disabled="!inputNo" @click="query">查詢訂單</button>
            <p v-if="error" class="pk-error">{{ error }}</p>
        </div>

        <!-- 付款 -->
        <div v-else-if="step === 'pay'" class="pk-screen pay">
            <div class="step-header">
                <button class="back-btn" @click="reset"><i class="el-icon-arrow-left"></i> 返回</button>
                <h2>自助付款</h2>
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

        <!-- 完成 -->
        <div v-else-if="step === 'done'" class="pk-screen done">
            <div class="done-icon"><i class="el-icon-circle-check"></i></div>
            <h1 class="done-title">付款成功</h1>
            <p class="done-no">訂單編號：{{ doneResult.orderNo }}</p>
            <p class="done-amount">已付 ¥{{ doneResult.totalPrice }}（{{ doneResult.payMethod }}）</p>
            <p class="done-desc">謝謝光臨</p>
            <button class="big-btn" @click="reset">返回首頁</button>
        </div>
    </div>
</template>

<script>
export default {
  name: 'paykiosk',
  data () {
    return {
      step: 'home',
      inputNo: '',
      error: '',
      shopName: '',
      setting: {
        paymentMethods: ['八達通', '行動支付'],
        fpsQrImage: ''
      },
      payOrder: { orderNo: '', order: [], totalPrice: 0 },
      payMethod: '',
      paying: false,
      doneResult: { orderNo: '', totalPrice: 0, payMethod: '' }
    }
  },
  methods: {
    loadSetting () {
      this.$axios.get('/api/kiosk/setting')
        .then(res => {
          const d = res.data || {}
          this.setting = {
            paymentMethods: Array.isArray(d.paymentMethods) && d.paymentMethods.length ? d.paymentMethods : ['八達通', '行動支付'],
            fpsQrImage: d.fpsQrImage || ''
          }
        })
        .catch(() => {})
    },
    loadShop () {
      this.$axios.get('/api/shop/get')
        .then(res => { this.shopName = (res.data && res.data.shopName) || '' })
        .catch(() => {})
    },
    focusInput () {
      if (this.step !== 'home') return
      const el = this.$refs.scanInput
      if (el) el.focus()
    },
    onPadKey (n) {
      if (n === '清空') this.inputNo = ''
      else if (n === '⌫') this.inputNo = this.inputNo.slice(0, -1)
      else this.inputNo += n
      this.$nextTick(() => this.focusInput())
    },
    query () {
      const no = this.inputNo.trim()
      if (!no) return
      this.error = ''
      this.$axios.get('/api/kiosk/order/' + encodeURIComponent(no))
        .then(res => {
          const d = res.data
          if (!d) {
            this.error = '找不到該訂單'
            return
          }
          if (d.state === 1) {
            this.error = '該訂單已付款'
            return
          }
          this.payOrder = {
            orderNo: d.orderNo,
            order: d.order || [],
            totalPrice: d.totalPrice
          }
          this.payMethod = ''
          this.paying = false
          this.step = 'pay'
        })
        .catch(() => { this.error = '查詢失敗，請重試' })
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
          this.error = err.response ? err.response.data : '付款失敗，請重試'
        })
    },
    reset () {
      this.step = 'home'
      this.inputNo = ''
      this.error = ''
      this.payOrder = { orderNo: '', order: [], totalPrice: 0 }
      this.payMethod = ''
      this.paying = false
      this.$nextTick(() => this.focusInput())
    }
  },
  created () {
    this.loadSetting()
    this.loadShop()
  },
  mounted () {
    this.$nextTick(() => this.focusInput())
  }
}
</script>

<style scoped>
#paykiosk{
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: #f1f5f9;
    color: #1e293b;
    font-family: "Helvetica Neue", Helvetica, Arial, "PingFang TC", "Microsoft JhengHei", sans-serif;
    overflow: hidden;
}
.pk-screen{
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    padding: 24px;
    box-sizing: border-box;
}
.home{ display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; }
.pk-title{ font-size: 44px; font-weight: 800; letter-spacing: 2px; margin: 0; }
.pk-sub{ font-size: 24px; color: #64748b; margin: 0; }
.pk-display{
    width: 480px; height: 72px; line-height: 72px; text-align: center;
    font-size: 32px; font-weight: 700; background: #fff; border-radius: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,.06); overflow: hidden; white-space: nowrap;
}
.pk-scan-input{
    width: 480px; height: 0; padding: 0; border: none; outline: none;
    opacity: 0; position: absolute;
}
.num-pad{ display: grid; grid-template-columns: repeat(3, 110px); gap: 14px; }
.pad-key{
    height: 74px; font-size: 28px; font-weight: 700; color: #1e293b;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; cursor: pointer;
}
.pad-key:active{ background: #f1f5f9; }
.pad-key.pad-fn{ color: #ff5722; }
.pk-query{
    min-width: 300px; height: 64px; font-size: 24px; font-weight: 700; color: #fff;
    background: linear-gradient(135deg, #ff5722, #ff9800); border: none; border-radius: 14px; cursor: pointer;
}
.pk-query:disabled{ opacity: .45; cursor: not-allowed; }
.pk-error{ color: #ef4444; font-size: 20px; }
.step-header{ display: flex; align-items: center; gap: 20px; margin-bottom: 24px; }
.step-header h2{ font-size: 32px; margin: 0; }
.back-btn{
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 20px; font-size: 20px; color: #475569;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer;
}
.back-btn:active{ background: #f1f5f9; }
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
.pay-hint{ font-size: 20px; color: #475569; margin: 0; }
.fps-qr{ width: 200px; height: 200px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 12px; }
.fps-placeholder{ width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; border: 1px dashed #cbd5e1; border-radius: 12px; color: #94a3b8; }
.big-btn{
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
    min-width: 220px; min-height: 180px; padding: 24px;
    font-size: 30px; font-weight: 700; color: #fff;
    background: linear-gradient(135deg, #ff5722, #ff9800);
    border: none; border-radius: 20px; cursor: pointer;
    box-shadow: 0 8px 24px rgba(255, 87, 34, 0.3);
    transition: all .15s ease;
}
.big-btn.small{ min-width: 160px; min-height: 60px; padding: 12px 32px; font-size: 22px; flex-direction: row; }
.big-btn:active{ transform: scale(.96); }
.big-btn:disabled{ opacity: .45; cursor: not-allowed; }
.done{ display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; }
.done-icon{ font-size: 96px; color: #00c853; }
.done-title{ font-size: 42px; font-weight: 800; margin: 0; }
.done-no{ font-size: 26px; font-weight: 700; margin: 0; }
.done-amount{ font-size: 22px; color: #ff3b30; margin: 0; }
.done-desc{ font-size: 20px; color: #64748b; margin: 0; }
</style>
