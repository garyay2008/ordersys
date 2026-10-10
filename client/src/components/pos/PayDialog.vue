<template>
  <div v-if="payDialog.show" class="pay-overlay">
    <div class="pay-panel">
      <!-- 左側：訂單摘要 -->
      <div class="pay-left">
        <div class="pay-left-header">
          <span class="pay-left-title">訂單摘要</span>
          <span v-if="currentOrder" class="pay-left-orderno">{{ currentOrder.orderNo }}</span>
          <span class="pay-left-table" v-if="isDineIn">枱 {{ selectedTable }}</span>
        </div>
        <div class="pay-order-list">
          <div v-for="(item, i) in cart" :key="i" class="pay-order-item">
            <span class="pay-oi-name">{{ item.name }}</span>
            <span class="pay-oi-qty">x{{ item.count }}</span>
            <span class="pay-oi-sub">${{ item.subtotal }}</span>
          </div>
        </div>
        <div class="pay-summary">
          <div class="pay-sum-row" v-if="orderDiscount > 0">
            <span>整單折扣</span><span class="pay-sum-disc">-${{ orderDiscount }}</span>
          </div>
          <div class="pay-sum-row" v-if="serviceChargeEnabled">
            <span>服務費 {{ serviceChargeRate }}%</span><span>${{ serviceChargeAmount }}</span>
          </div>
          <div class="pay-sum-row pay-sum-total">
            <span>應收金額</span><span class="pay-sum-num">${{ grandTotal }}</span>
          </div>
        </div>
      </div>

      <!-- 右側：付款操作區 -->
      <div class="pay-right">
        <div class="pay-right-header">
          <span class="pay-pr-title">選擇付款方式</span>
        </div>

        <!-- 付款方式按鈕網格 -->
        <div class="pay-method-grid">
          <div v-for="m in payMethods" :key="m._id"
               class="pay-method-btn" :class="{ active: payDialog.method === m.value }"
               @click="payDialog.method = m.value; onPayMethodChange()">
            <i class="pay-method-icon" :class="payMethodIcon(m.value)"></i>
            <span class="pay-method-label">{{ m.value }}</span>
          </div>
        </div>

        <!-- 現金專區 -->
        <div v-if="isCashMethod" class="pay-cash-section">
          <div class="pay-cash-display">
            <div class="pay-cash-label">實收金額</div>
            <div class="pay-cash-amount">${{ payDialog.cashStr || '0' }}</div>
          </div>

          <!-- 快速金額按鈕 -->
          <div class="pay-quick-row">
            <div class="pay-quick-btn" @click="payQuickAmount(100)">$100</div>
            <div class="pay-quick-btn" @click="payQuickAmount(500)">$500</div>
            <div class="pay-quick-btn" @click="payQuickAmount(1000)">$1000</div>
          </div>

          <!-- 數字鍵盤 -->
          <div class="pay-numpad">
            <div v-for="n in ['1','2','3','4','5','6','7','8','9']" :key="n" class="pay-np-key" @click="payInputDigit(n)">{{ n }}</div>
            <div class="pay-np-key" @click="payInputDigit('0')">0</div>
            <div class="pay-np-key" @click="payInputDot">.</div>
            <div class="pay-np-key pay-np-del" @click="payInputDel"><i class="el-icon-delete"></i></div>
          </div>

          <!-- 找零 -->
          <div class="pay-change-row" v-if="payDialog.change > 0">
            <span>找零</span><span class="pay-change-val">${{ payDialog.change }}</span>
          </div>
          <div class="pay-change-row pay-change-neg" v-else-if="payDialog.change < 0 && Number(payDialog.cashStr) > 0">
            <span>不足</span><span class="pay-change-val">-${{ Math.abs(payDialog.change) }}</span>
          </div>
        </div>

        <!-- 非現金提示 -->
        <div v-else class="pay-noncash-hint">
          <i class="el-icon-check pay-noncash-icon"></i>
          <div>確認後將以「{{ payDialog.method }}」結帳</div>
        </div>

        <!-- 小費（僅信用卡） -->
        <div v-if="isCreditCardMethod" class="pay-tip-section">
          <div class="pay-tip-row">
            <span class="pay-tip-label">小費</span>
            <div class="pay-tip-input-wrap">
              <span class="pay-tip-dollar">$</span>
              <input class="pay-tip-input" type="number" min="0" step="0.01" v-model.number="payDialog.tip" placeholder="0" />
            </div>
          </div>
          <div class="pay-quick-row">
            <div class="pay-quick-btn" @click="payQuickTip(0)">無</div>
            <div class="pay-quick-btn" @click="payQuickTip(10)">$10</div>
            <div class="pay-quick-btn" @click="payQuickTip(20)">$20</div>
            <div class="pay-quick-btn" @click="payQuickTip(50)">$50</div>
          </div>
        </div>

        <div v-if="currentOrder" class="pay-order-id">訂單 {{ currentOrder.orderNo }}</div>

        <!-- 操作按鈕 -->
        <div class="pay-actions">
          <div class="pay-btn-cancel" @click="payDialog.show = false">取消</div>
          <div class="pay-btn-confirm" :class="{ disabled: !canConfirmPay }" @click="$emit('confirm')">
            <i class="el-icon-check"></i> 確認收款
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'payDialog',
  props: {
    payDialog: { type: Object, required: true },
    payMethods: { type: Array, default: () => [] },
    cart: { type: Array, default: () => [] },
    currentOrder: { type: Object, default: null },
    selectedTable: { default: null },
    isDineIn: { type: Boolean, default: false },
    orderDiscount: { type: Number, default: 0 },
    serviceChargeEnabled: { type: Boolean, default: false },
    serviceChargeRate: { type: Number, default: 10 },
    serviceChargeAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 }
  },
  computed: {
    isCashMethod () {
      return /現金|cash/i.test(this.payDialog.method || '')
    },
    isCreditCardMethod () {
      return /visa|master|銀聯|中銀|信用卡|credit/i.test(this.payDialog.method || '')
    },
    canConfirmPay () {
      if (!this.isCashMethod) return true
      const cash = Number(this.payDialog.cashStr || 0)
      if (cash > 0 && cash < this.grandTotal) return false
      return true
    }
  },
  methods: {
    payMethodIcon (method) {
      if (/現金|cash/i.test(method)) return 'el-icon-money'
      if (/visa|master|銀聯|中銀|信用卡|credit/i.test(method)) return 'el-icon-bank-card'
      if (/八達通|octopus/i.test(method)) return 'el-icon-mobile-phone'
      if (/微信|wechat/i.test(method)) return 'el-icon-chat-dot-round'
      if (/支付寶|alipay/i.test(method)) return 'el-icon-wallet'
      return 'el-icon-coins'
    },
    onPayMethodChange () {
      this.calcChange()
    },
    calcChange () {
      if (!this.isCashMethod) { this.payDialog.change = 0; return }
      const cash = Number(this.payDialog.cashStr || 0)
      this.payDialog.change = Math.round((cash - this.grandTotal) * 100) / 100
    },
    payInputDigit (d) {
      if (this.payDialog.cashStr === '0') this.payDialog.cashStr = ''
      this.payDialog.cashStr += d
      this.calcChange()
    },
    payInputDot () {
      if (this.payDialog.cashStr.indexOf('.') >= 0) return
      this.payDialog.cashStr += '.'
    },
    payInputDel () {
      this.payDialog.cashStr = this.payDialog.cashStr.slice(0, -1)
      this.calcChange()
    },
    payQuickAmount (amount) {
      this.payDialog.cashStr = String(amount)
      this.calcChange()
    },
    payQuickTip (amount) {
      this.payDialog.tip = amount
    }
  }
}
</script>
