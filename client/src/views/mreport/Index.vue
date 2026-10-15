<template>
  <div class="mreport">
    <div v-if="!authed" class="mreport-login">
      <div class="mreport-login-box">
        <h1 class="mreport-login-title">營業報表</h1>
        <p class="mreport-login-sub">請登入查看報表</p>
        <input v-model="loginForm.username" type="text" placeholder="用戶名" class="mreport-login-input" @keyup.enter="login">
        <input v-model="loginForm.password" type="password" placeholder="密碼" class="mreport-login-input" @keyup.enter="login">
        <p v-if="loginError" class="mreport-login-error">{{ loginError }}</p>
        <button class="mreport-login-btn" :disabled="loggingIn" @click="login">{{ loggingIn ? '登入中...' : '登入' }}</button>
      </div>
    </div>
    <template v-else>
    <header class="mreport-header">
      <div class="mreport-header-left">
        <h1 class="mreport-title">營業報表</h1>
        <span class="mreport-date">{{ summary.date }}</span>
      </div>
      <div class="mreport-header-right">
        <button class="refresh-btn" @click="refresh">刷新</button>
        <button class="logout-btn" @click="logout">登出</button>
      </div>
    </header>

    <div v-if="loadError" class="mreport-error">{{ loadError }}</div>

    <div class="mreport-body">
      <section class="cards">
        <div class="card card-revenue">
          <p class="card-label">今日營業額</p>
          <p class="card-value">${{ summary.revenue }}</p>
          <p class="card-sub">{{ yoyText }}</p>
        </div>
        <div class="card card-orders">
          <p class="card-label">今日訂單</p>
          <p class="card-value">{{ summary.orders }}</p>
          <p class="card-sub">昨日 {{ summary.yesterday.orders }} 單</p>
        </div>
        <div class="card card-avg">
          <p class="card-label">平均每單</p>
          <p class="card-value">${{ summary.avgCheck }}</p>
          <p class="card-sub">未結 {{ summary.unpaid }} 單</p>
        </div>
        <div class="card card-cover">
          <p class="card-label">人均消費</p>
          <p class="card-value">${{ summary.avgCover }}</p>
          <p class="card-sub">昨日 ${{ summary.yesterday.avgCover }}</p>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">翻檯率 / 用枱率</h2>
        <div class="turnover-grid">
          <div class="turnover-stat">
            <p class="turnover-value">{{ turnover.turnover }}</p>
            <p class="turnover-label">翻檯率（單/枱）</p>
          </div>
          <div class="turnover-stat">
            <p class="turnover-value">{{ turnover.occupancyRate }}%</p>
            <p class="turnover-label">用枱率</p>
          </div>
          <div class="turnover-stat">
            <p class="turnover-value">{{ turnover.usedTables }}/{{ turnover.tableCount }}</p>
            <p class="turnover-label">用枱數</p>
          </div>
          <div class="turnover-stat">
            <p class="turnover-value">{{ turnover.dineInOrders }}</p>
            <p class="turnover-label">堂食單數</p>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">近 7 天營業額</h2>
        <chart class="chart" :options="trendOption" :auto-resize="true"></chart>
      </section>

      <section class="panel">
        <h2 class="panel-title">今日分市營業</h2>
        <div class="slot-toggle">
          <button :class="{ active: slotLineMetric === 'orders' }" @click="slotLineMetric = 'orders'">折線：單量</button>
          <button :class="{ active: slotLineMetric === 'avgCheck' }" @click="slotLineMetric = 'avgCheck'">折線：客單價</button>
        </div>
        <chart v-if="slotData.length" class="chart" :options="slotOption" :auto-resize="true" @click="onSlotClick"></chart>
        <p v-else class="empty">暫無分市資料</p>
        <div v-if="selectedSlot" class="drilldown">
          <div class="drilldown-head">
            <span class="drilldown-title">{{ selectedSlot.label }}</span>
            <button class="drilldown-close" @click="selectedSlot = null">×</button>
          </div>
          <div class="drilldown-stats">
            <span>營業額 <b>${{ selectedSlot.revenue }}</b></span>
            <span>訂單 <b>{{ selectedSlot.orders }}</b></span>
            <span>折扣 <b>${{ selectedSlot.discount }}</b></span>
          </div>
          <ul v-if="selectedSlot.topItems.length" class="drilldown-items">
            <li v-for="(it, idx) in selectedSlot.topItems" :key="idx">
              <span class="rank">{{ idx + 1 }}</span>
              <span class="name">{{ it.name }}</span>
              <span class="qty">x{{ it.qty }}</span>
              <span class="amount">${{ it.amount }}</span>
            </li>
          </ul>
          <p v-else class="empty">此時段暫無品項</p>
        </div>
      </section>

      <section class="panel">
        <h2 class="panel-title">今日熱銷品項</h2>
        <chart v-if="topItems.length" class="chart" :options="topOption" :auto-resize="true"></chart>
        <p v-else class="empty">暫無銷售資料</p>
      </section>

      <section class="panel">
        <h2 class="panel-title">部門收入</h2>
        <chart v-if="departmentData.length" class="chart" :options="departmentOption" :auto-resize="true"></chart>
        <p v-else class="empty">暫無部門資料</p>
      </section>

      <section class="panel">
        <h2 class="panel-title">付款方式</h2>
        <chart v-if="paymentData.length" class="chart" :options="paymentOption" :auto-resize="true"></chart>
        <p v-else class="empty">暫無付款資料</p>
      </section>

      <section class="panel">
        <h2 class="panel-title">堂食 / 外賣</h2>
        <chart class="chart" :options="typeOption" :auto-resize="true"></chart>
      </section>

      <section class="panel">
        <h2 class="panel-title">取消 / 退單分析</h2>
        <chart v-if="cancelData.length" class="chart" :options="cancelOption" :auto-resize="true"></chart>
        <p v-else class="empty">今日無取消紀錄</p>
      </section>
    </div>
    </template>
  </div>
</template>

<script>
import ECharts from 'vue-echarts'
import 'echarts/lib/chart/line'
import 'echarts/lib/chart/bar'
import 'echarts/lib/chart/pie'
import 'echarts/lib/component/tooltip'
import 'echarts/lib/component/title'
import 'echarts/lib/component/legend'
import 'echarts/lib/component/grid'

export default {
  name: 'mreport',
  components: {
    chart: ECharts
  },
  data () {
    return {
      authed: !!localStorage.getItem('orderTk'),
      loginForm: { username: '', password: '' },
      loggingIn: false,
      loginError: '',
      loadError: '',
      summary: {
        date: '',
        revenue: 0,
        orders: 0,
        avgCheck: 0,
        pax: 0,
        avgCover: 0,
        unpaid: 0,
        yesterday: { revenue: 0, orders: 0, pax: 0, avgCover: 0 }
      },
      trend: { dates: [], revenue: [], orders: [], avgCover: [] },
      slotData: [],
      slotLineMetric: 'orders',
      selectedSlot: null,
      topItems: [],
      paymentData: [],
      typeData: [],
      departmentData: [],
      cancelData: [],
      turnover: { tableCount: 0, dineInOrders: 0, usedTables: 0, pax: 0, turnover: 0, occupancyRate: 0 }
    }
  },
  computed: {
    yoyText () {
      const y = this.summary.yesterday.revenue
      if (!y) return '昨日無營業額'
      const diff = Math.round((this.summary.revenue - y) * 100) / 100
      const pct = Math.round((diff / y) * 1000) / 10
      return (diff >= 0 ? '較昨日 +' : '較昨日 ') + '$' + diff + '（' + (pct >= 0 ? '+' : '') + pct + '%）'
    },
    trendOption () {
      return {
        tooltip: { trigger: 'axis' },
        legend: { data: ['營業額', '訂單數', '人均消費'], top: 0 },
        grid: { left: 10, right: 10, top: 36, bottom: 10, containLabel: true },
        xAxis: { type: 'category', data: this.trend.dates },
        yAxis: [
          { type: 'value', name: '金額', position: 'left' },
          { type: 'value', name: '單數', position: 'right', minInterval: 1 }
        ],
        series: [
          { name: '營業額', type: 'bar', data: this.trend.revenue, itemStyle: { color: '#297fff' }, barMaxWidth: 24 },
          { name: '訂單數', type: 'line', yAxisIndex: 1, smooth: true, data: this.trend.orders, itemStyle: { color: '#FC7992' } },
          { name: '人均消費', type: 'line', data: this.trend.avgCover, lineStyle: { type: 'dashed', color: '#18b26b' }, itemStyle: { color: '#18b26b' }, symbol: 'circle' }
        ]
      }
    },
    slotOption () {
      const isOrders = this.slotLineMetric === 'orders'
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: params => {
            const s = this.slotData.find(x => x.label === params[0].name)
            if (!s) return params[0].name
            return s.label +
              '<br/>營業額：$' + s.revenue +
              '<br/>' + (isOrders ? '訂單數：' : '客單價：$') + (isOrders ? s.orders : s.avgCheck) +
              '<br/>昨日：$' + s.yesterdayRevenue +
              '<br/>上週同日：$' + s.lastWeekRevenue +
              (s.discount ? '<br/>折扣：$' + s.discount : '')
          }
        },
        legend: { data: ['營業額', '昨日', '上週同日', isOrders ? '訂單數' : '客單價'], top: 0 },
        grid: { left: 10, right: 10, top: 36, bottom: 10, containLabel: true },
        xAxis: { type: 'category', data: this.slotData.map(s => s.label), axisLabel: { rotate: 30 } },
        yAxis: [
          { type: 'value', name: '金額', position: 'left' },
          { type: 'value', name: isOrders ? '單數' : '金額', position: 'right', minInterval: isOrders ? 1 : undefined }
        ],
        series: [
          { name: '營業額', type: 'bar', data: this.slotData.map(s => s.revenue), itemStyle: { color: '#297fff' }, barMaxWidth: 26 },
          { name: '昨日', type: 'line', data: this.slotData.map(s => s.yesterdayRevenue), lineStyle: { type: 'dashed', color: '#9ab' }, itemStyle: { color: '#9ab' }, symbol: 'none' },
          { name: '上週同日', type: 'line', data: this.slotData.map(s => s.lastWeekRevenue), lineStyle: { type: 'dashed', color: '#FC7992' }, itemStyle: { color: '#FC7992' }, symbol: 'none' },
          { name: isOrders ? '訂單數' : '客單價', type: 'line', yAxisIndex: 1, data: this.slotData.map(s => isOrders ? s.orders : s.avgCheck), itemStyle: { color: '#18b26b' }, symbol: 'circle' }
        ]
      }
    },
    topOption () {
      const items = this.topItems.slice().reverse()
      return {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 10, right: 30, top: 10, bottom: 10, containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: items.map(i => i.name) },
        series: [
          { name: '數量', type: 'bar', data: items.map(i => i.qty), itemStyle: { color: '#5b9cff' }, barMaxWidth: 18, label: { show: true, position: 'right' } }
        ]
      }
    },
    paymentOption () {
      return {
        tooltip: { trigger: 'item', formatter: params => params.name + '<br/>$' + params.value + '（' + params.percent + '%）' },
        legend: { bottom: 0 },
        series: [
          {
            name: '付款方式',
            type: 'pie',
            radius: ['38%', '62%'],
            center: ['50%', '45%'],
            data: this.paymentData.map(p => ({ name: p.name, value: p.amount })),
            label: { formatter: '{b}\n{d}%' },
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } }
          }
        ]
      }
    },
    typeOption () {
      return {
        tooltip: { trigger: 'item', formatter: params => params.name + '<br/>$' + params.value + '（' + params.percent + '%）' },
        legend: { bottom: 0 },
        series: [
          {
            name: '銷售模式',
            type: 'pie',
            radius: '62%',
            center: ['50%', '45%'],
            data: this.typeData.map(t => ({ name: t.name, value: t.amount })),
            label: { formatter: '{b}\n{d}%' }
          }
        ]
      }
    },
    departmentOption () {
      return {
        tooltip: { trigger: 'item', formatter: params => params.name + '<br/>$' + params.value + '（' + params.percent + '%）' },
        legend: { bottom: 0 },
        series: [
          {
            name: '部門收入',
            type: 'pie',
            radius: ['38%', '62%'],
            center: ['50%', '45%'],
            data: this.departmentData.map(d => ({ name: d.name, value: d.amount })),
            label: { formatter: '{b}\n{d}%' },
            emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' } }
          }
        ]
      }
    },
    cancelOption () {
      const items = this.cancelData.slice().reverse()
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: params => {
            const p = params[0]
            const it = this.cancelData.find(x => x.name === p.name)
            return (it ? it.name : p.name) + '<br/>金額：$' + p.value + (it ? '<br/>次數：' + it.count : '')
          }
        },
        grid: { left: 10, right: 30, top: 10, bottom: 10, containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: items.map(i => i.name) },
        series: [
          { name: '金額', type: 'bar', data: items.map(i => i.amount), itemStyle: { color: '#e8706a' }, barMaxWidth: 18, label: { show: true, position: 'right' } }
        ]
      }
    }
  },
  methods: {
    async refresh () {
      this.loadError = ''
      const requests = [
        ['summary', this.$axios.get('/api/mreport/summary')],
        ['trend', this.$axios.get('/api/mreport/trend?days=7')],
        ['slots', this.$axios.get('/api/mreport/slots')],
        ['top', this.$axios.get('/api/mreport/top?limit=10')],
        ['payment', this.$axios.get('/api/mreport/payment')],
        ['departments', this.$axios.get('/api/mreport/departments')],
        ['cancellations', this.$axios.get('/api/mreport/cancellations')],
        ['turnover', this.$axios.get('/api/mreport/turnover')]
      ]
      const results = await Promise.allSettled(requests.map(([, p]) => p))
      const errors = []
      results.forEach((r, i) => {
        const key = requests[i][0]
        if (r.status === 'rejected') {
          const reason = r.reason || {}
          const data = reason.response && reason.response.data
          const msg = typeof data === 'string' ? data : (data && data.msg) || reason.message || '請求失敗'
          errors.push(key + '：' + msg)
          return
        }
        const res = r.value
        if (key === 'summary') this.summary = res.data
        else if (key === 'trend') this.trend = res.data
        else if (key === 'slots') this.slotData = res.data.slots || []
        else if (key === 'top') this.topItems = res.data.items || []
        else if (key === 'payment') {
          this.paymentData = res.data.payment || []
          this.typeData = res.data.types || []
        } else if (key === 'departments') this.departmentData = res.data.departments || []
        else if (key === 'cancellations') this.cancelData = res.data.items || []
        else if (key === 'turnover') this.turnover = res.data || this.turnover
      })
      if (errors.length) {
        this.loadError = '資料載入失敗：' + errors.join('；')
        console.error('[mreport] ' + errors.join(' | '))
      }
      this.authed = !!localStorage.getItem('orderTk')
    },
    onSlotClick (params) {
      const slot = this.slotData.find(s => s.label === params.name)
      this.selectedSlot = slot || null
    },
    async login () {
      if (!this.loginForm.username || !this.loginForm.password) {
        this.loginError = '請輸入用戶名和密碼'
        return
      }
      this.loggingIn = true
      this.loginError = ''
      try {
        const res = await this.$axios.post('/api/users/login', this.loginForm)
        const token = res.data.token
        if (!token) throw new Error('登入失敗')
        localStorage.setItem('orderTk', token)
        this.authed = true
        this.refresh()
      } catch (err) {
        const data = err.response && err.response.data
        this.loginError = typeof data === 'string' ? data : '登入失敗，請檢查用戶名和密碼'
      } finally {
        this.loggingIn = false
      }
    },
    logout () {
      localStorage.removeItem('orderTk')
      this.authed = false
      this.loginForm.password = ''
    }
  },
  mounted () {
    if (this.authed) this.refresh()
  }
}
</script>

<style>
.mreport{
  min-height: 100vh;
  background: #f2f5f9;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang TC', 'Noto Sans TC', 'Microsoft JhengHei', Arial, sans-serif;
  color: #233;
}
.mreport-login{
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, #1e5bb5, #297fff);
}
.mreport-login-box{
  width: 100%;
  max-width: 340px;
  background: #fff;
  border-radius: 14px;
  padding: 28px 24px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.18);
}
.mreport-login-title{
  font-size: 22px;
  font-weight: 700;
  color: #1e5bb5;
  margin: 0 0 4px;
  text-align: center;
}
.mreport-login-sub{
  font-size: 13px;
  color: #9ab;
  margin: 0 0 20px;
  text-align: center;
}
.mreport-login-input{
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d5e0ef;
  border-radius: 8px;
  padding: 11px 12px;
  font-size: 14px;
  margin-bottom: 12px;
  outline: none;
}
.mreport-login-input:focus{
  border-color: #297fff;
}
.mreport-login-error{
  color: #e64545;
  font-size: 12px;
  margin: 0 0 10px;
  text-align: center;
}
.mreport-login-btn{
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-size: 15px;
  font-weight: 600;
  background: #1e5bb5;
  color: #fff;
  cursor: pointer;
}
.mreport-login-btn:disabled{
  opacity: 0.6;
  cursor: not-allowed;
}
.mreport-header{
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: linear-gradient(135deg, #1e5bb5, #297fff);
  color: #fff;
  box-shadow: 0 2px 8px rgba(30, 91, 181, 0.35);
}
.mreport-header-left{
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.mreport-title{
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
.mreport-date{
  font-size: 13px;
  opacity: 0.9;
}
.mreport-header-right{
  display: flex;
  gap: 8px;
}
.refresh-btn, .logout-btn{
  border: none;
  border-radius: 6px;
  padding: 7px 14px;
  font-size: 14px;
  cursor: pointer;
}
.refresh-btn{
  background: rgba(255,255,255,0.22);
  color: #fff;
}
.logout-btn{
  background: #fff;
  color: #1e5bb5;
}
.mreport-error{
  margin: 12px 14px 0;
  padding: 10px 12px;
  background: #fdecec;
  border: 1px solid #f5c2c2;
  border-radius: 8px;
  color: #c0392b;
  font-size: 13px;
  line-height: 1.5;
}
.mreport-body{
  padding: 14px;
  max-width: 720px;
  margin: 0 auto;
}
.cards{
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.card{
  background: #fff;
  border-radius: 12px;
  padding: 14px 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.04);
}
.card-label{
  font-size: 12px;
  color: #789;
  margin: 0 0 6px;
}
.card-value{
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: #1e5bb5;
}
.card-sub{
  font-size: 11px;
  color: #9ab;
  margin: 6px 0 0;
}
.panel{
  background: #fff;
  border-radius: 12px;
  margin-top: 14px;
  padding: 14px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.04);
}
.panel-title{
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 10px;
  color: #345;
}
.chart{
  width: 100%;
  height: 260px;
}
.empty{
  text-align: center;
  color: #9ab;
  font-size: 13px;
  padding: 20px 0;
}
.slot-toggle{
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.slot-toggle button{
  border: 1px solid #d5e0ef;
  background: #fff;
  color: #567;
  border-radius: 14px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}
.slot-toggle button.active{
  background: #1e5bb5;
  border-color: #1e5bb5;
  color: #fff;
}
.drilldown{
  margin-top: 12px;
  background: #f7fafd;
  border: 1px solid #e3ebf5;
  border-radius: 10px;
  padding: 12px;
}
.drilldown-head{
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.drilldown-title{
  font-size: 14px;
  font-weight: 600;
  color: #345;
}
.drilldown-close{
  border: none;
  background: transparent;
  color: #9ab;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}
.drilldown-stats{
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #567;
  margin-bottom: 10px;
}
.drilldown-stats b{
  color: #1e5bb5;
}
.drilldown-items{
  list-style: none;
  margin: 0;
  padding: 0;
}
.drilldown-items li{
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #edf2f8;
  font-size: 13px;
}
.drilldown-items li:last-child{
  border-bottom: none;
}
.drilldown-items .rank{
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e8f0fd;
  color: #1e5bb5;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.drilldown-items .name{
  flex: 1;
  color: #345;
}
.drilldown-items .qty{
  color: #9ab;
}
.drilldown-items .amount{
  color: #1e5bb5;
  font-weight: 600;
}
@media (max-width: 480px) {
  .cards{
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .card{
    padding: 10px 8px;
  }
  .card-value{
    font-size: 17px;
  }
}
.turnover-grid{
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.turnover-stat{
  background: #f7fafd;
  border-radius: 10px;
  padding: 14px 12px;
  text-align: center;
}
.turnover-value{
  font-size: 22px;
  font-weight: 700;
  color: #1e5bb5;
  margin: 0 0 4px;
}
.turnover-label{
  font-size: 12px;
  color: #789;
  margin: 0;
}
</style>
