<template>
    <div id="userShop" :style="themeVars">
        <div v-if="disabled" class="invalid-mask">
            <div class="invalid-card">
                <h1 class="invalid-title">點餐已暫停</h1>
                <p class="invalid-text">本店目前暫停手機點餐，請直接向店員下單。</p>
            </div>
        </div>
        <div v-else-if="invalid" class="invalid-mask">
            <div class="invalid-card">
                <h1 class="invalid-title">此點餐碼已失效</h1>
                <p class="invalid-text">請向店員索取新的點餐碼，或重新掃描枱面上的點餐碼。</p>
            </div>
        </div>
        <template v-else>
            <Welcome v-if="!started" @start="started = true"></Welcome>
            <Commodities v-else :id="id"></Commodities>
        </template>
    </div>
</template>

<script>
import Commodities from '@/components/user/Commodities'
import Welcome from '@/components/user/Welcome'

const THEMES = {
  orange: { primary: '#ff5722', primary2: '#ff9800', accent: '#ff3b30', accent2: '#ff6b6b' },
  green: { primary: '#16a085', primary2: '#2ecc71', accent: '#e67e22', accent2: '#f39c12' },
  blue: { primary: '#2980b9', primary2: '#00bcd4', accent: '#e74c3c', accent2: '#ff6b6b' },
  indigo: { primary: '#8d94d0', primary2: '#7b84c9', accent: '#e74c3c', accent2: '#ff6b6b' },
  purple: { primary: '#8e44ad', primary2: '#d05ce3', accent: '#ff5722', accent2: '#ff6b6b' }
}

function hexToRgba (hex, a) {
  const h = String(hex || '').replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

export default {
  name: 'userShop',
  props: ['id'],
  data () {
    return {
      fontScale: 1,
      started: false,
      theme: 'orange',
      invalid: false,
      disabled: false,
      checking: true
    }
  },
  computed: {
    themeVars () {
      const t = THEMES[this.theme] || THEMES.orange
      return {
        '--primary': t.primary,
        '--primary2': t.primary2,
        '--primary-soft': hexToRgba(t.primary, 0.08),
        '--primary-glow': hexToRgba(t.primary, 0.35),
        '--accent': t.accent,
        '--accent2': t.accent2,
        '--accent-glow': hexToRgba(t.accent, 0.4)
      }
    }
  },
  methods: {
    applyFontScale (scale) {
      scale = Number(scale) || 1
      document.body.style.zoom = scale !== 1 ? String(scale) : ''
    }
  },
  created () {
    this.$axios.get('/api/qrsetting/get')
      .then(res => {
        const d = res.data || {}
        const scale = d.fontScale ? Number(d.fontScale) : 1
        this.fontScale = scale || 1
        this.applyFontScale(this.fontScale)
        this.theme = d.theme || 'orange'
        this.disabled = d.qrEnabled === false
      })
      .catch(() => {})

    // 枱面點餐碼：帶 token 時先驗證（僅未結帳單有效；結帳後失效）
    const t = this.$route.query.t
    if (t) {
      this.$axios.get('/api/order/tableQr/validate', { params: { t } })
        .then(res => {
          this.invalid = !(res.data && res.data.valid)
          this.checking = false
        })
        .catch(() => {
          this.invalid = true
          this.checking = false
        })
    } else {
      this.checking = false
    }

    // 掃碼進入：若該桌已有未結品項，跳過「開始點餐」直接進入查看單據版面
    this.$axios.get('/api/order/current', { params: { deskNo: this.id } })
      .then(res => {
        const items = (res.data && res.data.order) ? res.data.order.filter(item => item.voidStatus !== 1) : []
        if (items.length) this.started = true
      })
      .catch(() => {})
  },
  beforeDestroy () {
    this.applyFontScale(1)
  },
  components: {
    Commodities,
    Welcome
  }
}
</script>

<style scoped>
body,html{
    line-height: 1;
    font-weight: 200;
    font-family: "PingFang SC", "STHeitiSC-Light", "Helvetica-Light", arial, san-serif;
}
 #userShop{
     height: 100%;
 }
.invalid-mask{
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--primary), var(--primary2));
    z-index: 20;
}
.invalid-card{
    margin: 24px;
    padding: 40px 28px;
    max-width: 320px;
    text-align: center;
    background: rgba(255, 255, 255, 0.96);
    border-radius: 18px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}
.invalid-title{
    margin: 0 0 14px;
    font-size: 22px;
    font-weight: 800;
    color: #e74c3c;
}
.invalid-text{
    margin: 0;
    font-size: 14px;
    line-height: 1.7;
    color: #64748b;
}
</style>
