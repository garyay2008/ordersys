<template>
  <div class="q-ticket">
    <template v-if="!ticket">
      <div class="qt-head">
        <div class="qt-title">取票</div>
        <div class="qt-subtitle">請選擇用餐人數</div>
      </div>
      <div class="qt-cats">
        <button v-for="c in categories" :key="c.prefix" class="qt-cat" :style="{ borderColor: c.color, background: c.color + '14' }" @click="take(c)">
          <span class="qt-cat-prefix" :style="{ color: c.color }">{{ c.prefix }}</span>
          <span class="qt-cat-label">{{ c.label }}</span>
        </button>
      </div>
    </template>

    <template v-else>
      <div class="qt-done">
        <div class="qt-done-label">您的票號</div>
        <div class="qt-done-no">{{ ticket.ticketNo }}</div>
        <div class="qt-done-text">{{ ticket.label }}</div>
        <div class="qt-done-wait">請在候餐區等候叫號</div>
        <button class="qt-again" @click="reset">再取一張</button>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  name: 'queueTicket',
  data () {
    return {
      categories: [],
      ticket: null,
      loading: false
    }
  },
  created () {
    this.$axios.get('/api/queue/setting')
      .then(res => { this.categories = (res.data && res.data.categories) || [] })
      .catch(() => {})
  },
  methods: {
    take (cat) {
      if (this.loading) return
      this.loading = true
      this.$axios.post('/api/queue/take', { category: cat.prefix, pax: cat.minPax })
        .then(res => { this.ticket = res.data })
        .catch(err => this.$message({ type: 'error', message: (err.response && err.response.data) || '取票失敗' }))
        .finally(() => { this.loading = false })
    },
    reset () {
      this.ticket = null
    }
  }
}
</script>

<style scoped>
.q-ticket{ min-height: 100vh; background: linear-gradient(160deg, #0f172a, #1e293b); color: #f1f5f9; padding: 6vh 8vw; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: "Microsoft JhengHei", Arial, sans-serif; }
.qt-head{ text-align: center; margin-bottom: 6vh; }
.qt-title{ font-size: 8vh; font-weight: 900; letter-spacing: 6px; }
.qt-subtitle{ font-size: 3vh; color: #94a3b8; margin-top: 1.5vh; }
.qt-cats{ display: flex; gap: 3vw; justify-content: center; flex-wrap: wrap; }
.qt-cat{ width: 320px; height: 320px; border-radius: 24px; border: 4px solid #409eff; background: transparent; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; cursor: pointer; transition: transform .12s; }
.qt-cat:active{ transform: scale(.96); }
.qt-cat-prefix{ font-size: 12vh; font-weight: 900; line-height: 1; }
.qt-cat-label{ font-size: 4.5vh; font-weight: 700; }
.qt-done{ text-align: center; }
.qt-done-label{ font-size: 3.5vh; color: #94a3b8; }
.qt-done-no{ font-size: 20vh; font-weight: 900; letter-spacing: 10px; color: #fbbf24; line-height: 1.2; }
.qt-done-text{ font-size: 4vh; color: #cbd5e1; margin-top: 2vh; }
.qt-done-wait{ font-size: 3vh; color: #94a3b8; margin-top: 1.5vh; }
.qt-again{ margin-top: 6vh; padding: 2vh 5vw; font-size: 3.2vh; border-radius: 12px; border: none; background: #409eff; color: #fff; cursor: pointer; }
</style>
