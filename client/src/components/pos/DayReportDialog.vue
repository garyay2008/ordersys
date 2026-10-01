<template>
  <el-dialog :title="dayReportDialog.result && dayReportDialog.result.status === 'closed' ? '📋 每日結算報表（已結算）' : '📋 每日結算報表'" :visible.sync="dayReportDialog.show" width="620px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <div v-if="dayReportDialog.result" class="day-report">
      <div class="report-summary">
        <div class="report-row bold"><span>營業日</span><span>{{ dayReportDialog.result.date }}</span></div>
        <div class="report-row"><span>狀態</span><span>{{ dayReportDialog.result.status === 'open' ? '營業中' : '已結算' }}</span></div>
        <div class="report-row"><span>備用金</span><span>${{ formatMoney(dayReportDialog.result.startingCash) }}</span></div>
      </div>
      <div class="report-summary" style="margin-top: 12px;">
        <div class="report-row bold"><span>營業總額</span><span>${{ formatMoney(dayReportDialog.result.snapshot.totalIncome) }}</span></div>
        <div class="report-row"><span>訂單數</span><span>{{ dayReportDialog.result.snapshot.orderCount }} 單</span></div>
        <div class="report-row"><span>現金收入</span><span>${{ formatMoney(dayReportDialog.result.snapshot.cashIncome) }}</span></div>
        <div class="report-row"><span>信用卡收入</span><span>${{ formatMoney(dayReportDialog.result.snapshot.cardIncome) }}</span></div>
        <div class="report-row"><span>其他收入</span><span>${{ formatMoney(dayReportDialog.result.snapshot.otherIncome) }}</span></div>
        <div class="report-row"><span>折扣</span><span>-${{ formatMoney(dayReportDialog.result.snapshot.discountTotal) }}</span></div>
        <div class="report-row"><span>服務費</span><span>${{ formatMoney(dayReportDialog.result.snapshot.serviceChargeTotal) }}</span></div>
        <div class="report-row"><span>取消單</span><span>{{ dayReportDialog.result.snapshot.voidCount }} 單 / ${{ formatMoney(dayReportDialog.result.snapshot.voidAmount) }}</span></div>
        <div class="report-row"><span>代收</span><span>+${{ formatMoney(dayReportDialog.result.snapshot.receivedTotal) }}</span></div>
        <div class="report-row"><span>代支</span><span>-${{ formatMoney(dayReportDialog.result.snapshot.paidOutTotal) }}</span></div>
        <div class="report-row bold"><span>應有現金</span><span>${{ formatMoney(dayReportDialog.result.expectedCash) }}</span></div>
      </div>
      <div style="margin-top: 16px;">
        <label style="font-size: 13px; color: #606266;">開始備用金</label>
        <el-input v-model="dayReportDialog.startingCash" size="large" placeholder="輸入開始備用金金額" style="margin-top: 6px;">
          <template slot="prepend">$</template>
        </el-input>
      </div>
      <div style="margin-top: 12px;">
        <label style="font-size: 13px; color: #606266;">收銀機實點金額</label>
        <el-input v-model="dayReportDialog.countedCash" size="large" placeholder="輸入收銀機實際金額" style="margin-top: 6px;">
          <template slot="prepend">$</template>
        </el-input>
      </div>
      <div style="margin-top: 12px;">
        <label style="font-size: 13px; color: #606266;">結算備註</label>
        <el-input v-model="dayReportDialog.remark" size="medium" placeholder="備註" style="margin-top: 6px;"></el-input>
      </div>
      <div v-if="departmentTotals.length" class="report-summary" style="margin-top: 16px;">
        <div class="report-row bold"><span>部門匯總</span><span></span></div>
        <div v-for="d in departmentTotals" :key="d.department" class="report-row">
          <span>{{ d.department }}</span>
          <span>{{ d.count }} 項 / ${{ formatMoney(d.amount) }}</span>
        </div>
      </div>
    </div>
    <div slot="footer">
      <el-button @click="$emit('cancel')">取 消</el-button>
      <el-button type="danger" :loading="dayReportDialog.loading" @click="$emit('confirm')">{{ dayReportDialog.result && dayReportDialog.result.status === 'closed' ? '再次結算' : '確認結算' }}</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { formatMoney } from '../../utils/format'

export default {
  name: 'dayReportDialog',
  props: {
    dayReportDialog: { type: Object, required: true }
  },
  computed: {
    departmentTotals () {
      const snap = this.dayReportDialog.result && this.dayReportDialog.result.snapshot
      return (snap && snap.departmentTotals) || []
    }
  },
  methods: {
    formatMoney
  }
}
</script>

<style scoped>
.day-report{ max-height:65vh; overflow-y:auto; }
.report-summary{ background:#f5f7fa; border-radius:8px; padding:12px 16px; }
.report-row{ display:flex; justify-content:space-between; padding:5px 0; font-size:14px; color:#606266; border-bottom:1px solid #ebeef5; }
.report-row:last-child{ border-bottom:none; }
.report-row.bold{ font-weight:700; color:#303133; font-size:15px; }
</style>
