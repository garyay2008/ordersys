<template>
  <div class="q-display">
    <div class="qd-head">
      <div class="qd-title">{{ state.title || '排隊叫號' }}</div>
      <div class="qd-subtitle">{{ state.subtitle || '請取票後在候餐區等候' }}</div>
    </div>

    <div class="qd-banner" v-if="state.lastCalled">
      <div class="qd-banner-label">現在叫號</div>
      <div class="qd-banner-no">{{ state.lastCalled.ticketNo }}</div>
      <div class="qd-banner-text">請 {{ state.lastCalled.ticketNo }} 號入座</div>
    </div>
    <div class="qd-banner qd-banner-empty" v-else>
      <div class="qd-banner-label">現在叫號</div>
      <div class="qd-banner-no">—</div>
      <div class="qd-banner-text">請取票後在候餐區等候</div>
    </div>

    <div class="qd-cards">
      <div v-for="c in state.categories" :key="c.prefix" class="qd-card" :style="{ borderColor: c.color }">
        <div class="qd-card-head" :style="{ background: c.color }">
          <span class="qd-card-prefix">{{ c.prefix }}</span>
          <span class="qd-card-label">{{ c.label }}</span>
        </div>
        <div class="qd-card-rows">
          <div class="qd-row">
            <span class="qd-row-label">現在叫號</span>
            <span class="qd-row-val qd-row-current">{{ c.current ? c.current.ticketNo : '—' }}</span>
          </div>
          <div class="qd-row">
            <span class="qd-row-label">下一組</span>
            <span class="qd-row-val">{{ c.next ? c.next.ticketNo : '—' }}</span>
          </div>
          <div class="qd-row">
            <span class="qd-row-label">等候</span>
            <span class="qd-row-val">{{ c.waitingCount }} 張</span>
          </div>
        </div>
      </div>
    </div>

    <div class="qd-footer">總等候 {{ state.totalWaiting }} 張</div>
  </div>
</template>

<script>
export default {
  name: 'queueDisplay',
  data () {
    return {
      state: { categories: [], lastCalled: null, totalWaiting: 0, title: '', subtitle: '', voiceEnabled: true }
    }
  },
  sockets: {
    queueChanged (payload) {
      this.loadState(payload)
    }
  },
  created () {
    this.loadState()
    this.pollTimer = setInterval(() => this.loadState(), 30000)
  },
  beforeDestroy () {
    if (this.pollTimer) clearInterval(this.pollTimer)
  },
  methods: {
    async loadState (payload) {
      try {
        const res = await this.$axios.get('/api/queue/state')
        const state = res.data || {}
        const prevNo = this.state.lastCalled ? this.state.lastCalled.ticketNo : null
        this.state = state
        if (payload && payload.lastCalled && payload.lastCalled.ticketNo) {
          if (payload.recall || payload.lastCalled.ticketNo !== prevNo) {
            if (this.state.voiceEnabled) this.speak('請 ' + payload.lastCalled.ticketNo + ' 號入座')
          }
        }
      } catch (e) { /* ignore */ }
    },
    speak (text) {
      try {
        if (!('speechSynthesis' in window)) return
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'zh-HK'
        u.rate = 0.9
        const voices = window.speechSynthesis.getVoices()
        const zh = voices.find(v => /zh|cmn|yue|HK|TW/i.test(v.lang))
        if (zh) u.voice = zh
        window.speechSynthesis.speak(u)
      } catch (e) { /* ignore */ }
    }
  }
}
</script>

<style scoped>
.q-display{ min-height: 100vh; background: linear-gradient(160deg, #0f172a, #1e293b); color: #f1f5f9; padding: 4vh 5vw; box-sizing: border-box; font-family: "Microsoft JhengHei", Arial, sans-serif; }
.qd-head{ text-align: center; margin-bottom: 3vh; }
.qd-title{ font-size: 6vh; font-weight: 900; letter-spacing: 6px; }
.qd-subtitle{ font-size: 2.6vh; color: #94a3b8; margin-top: 1vh; }
.qd-banner{ text-align: center; padding: 4vh 2vw; border-radius: 18px; margin-bottom: 4vh; background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; box-shadow: 0 8px 30px rgba(239,68,68,.35); }
.qd-banner-empty{ background: linear-gradient(135deg, #334155, #475569); box-shadow: none; }
.qd-banner-label{ font-size: 3vh; opacity: .9; }
.qd-banner-no{ font-size: 16vh; font-weight: 900; letter-spacing: 8px; line-height: 1.2; }
.qd-banner-text{ font-size: 5vh; font-weight: 700; letter-spacing: 3px; }
.qd-cards{ display: flex; gap: 2vw; justify-content: center; flex-wrap: wrap; }
.qd-card{ flex: 1 1 240px; max-width: 420px; background: #0b1220; border: 3px solid #409eff; border-radius: 18px; overflow: hidden; }
.qd-card-head{ display: flex; align-items: center; justify-content: center; gap: 12px; padding: 1.8vh 1vw; color: #fff; }
.qd-card-prefix{ font-size: 5vh; font-weight: 900; }
.qd-card-label{ font-size: 3.2vh; font-weight: 700; }
.qd-card-rows{ padding: 1.5vh 1.5vw 2vh; }
.qd-row{ display: flex; justify-content: space-between; align-items: center; padding: 1.6vh 0.5vw; border-bottom: 1px solid #1e293b; }
.qd-row:last-child{ border-bottom: none; }
.qd-row-label{ font-size: 3vh; color: #94a3b8; }
.qd-row-val{ font-size: 4.5vh; font-weight: 800; }
.qd-row-current{ color: #fbbf24; }
.qd-footer{ text-align: center; margin-top: 3vh; font-size: 3vh; color: #64748b; }
</style>
