<template>
  <el-dialog title="手寫輸入" :visible.sync="visibleProxy" width="360px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <div class="hw-body">
      <div class="hw-result">
        <span class="hw-result-label">名稱：</span>
        <span class="hw-result-text">{{ result || '（空白）' }}</span>
      </div>
      <div class="hw-canvas-wrap">
        <canvas ref="canvas" class="hw-canvas" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointerleave="onUp"></canvas>
        <div v-if="loading" class="hw-mask">載入字庫中…</div>
        <div v-else-if="!ready" class="hw-mask">字庫載入失敗，請重新整理</div>
      </div>
      <div class="hw-candidates">
        <div v-for="(c, i) in candidates" :key="i" class="hw-cand" @click="pick(c)">{{ c }}</div>
        <div v-if="!candidates.length" class="hw-cand-empty">在方格內手寫一個字，自動辨識</div>
      </div>
    </div>
    <div slot="footer">
      <el-button @click="clearCanvas">清 除</el-button>
      <el-button @click="backspace">回 刪</el-button>
      <el-button @click="close">取 消</el-button>
      <el-button type="primary" @click="done">完 成</el-button>
    </div>
  </el-dialog>
</template>

<script>
import { init, Matcher, AnalyzedCharacter } from 'hanzilookup-js'

const DATA_URL = '/data/mmah.json'

export default {
  name: 'handwritingPad',
  props: {
    visible: { type: Boolean, default: false },
    initialText: { type: String, default: '' }
  },
  data () {
    return {
      ready: false,
      loading: true,
      result: '',
      candidates: [],
      strokes: [],
      current: null,
      drawing: false,
      recognizeTimer: null,
      matcher: null
    }
  },
  computed: {
    visibleProxy: {
      get () { return this.visible },
      set (v) { this.$emit('update:visible', v) }
    }
  },
  watch: {
    visible (v) {
      if (v) {
        this.result = this.initialText || ''
        this.candidates = []
        this.$nextTick(() => this.resetCanvas())
      }
    }
  },
  mounted () {
    this.loadData()
  },
  beforeDestroy () {
    if (this.recognizeTimer) clearTimeout(this.recognizeTimer)
  },
  methods: {
    loadData () {
      init('mmah', DATA_URL, (success) => {
        this.loading = false
        if (success) {
          this.ready = true
          this.matcher = new Matcher('mmah', 0.35)
        } else {
          this.ready = false
        }
        this.$nextTick(() => this.resetCanvas())
      })
    },
    resetCanvas () {
      const canvas = this.$refs.canvas
      if (!canvas) return
      const size = 280
      const dpr = window.devicePixelRatio || 1
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.width = size + 'px'
      canvas.style.height = size + 'px'
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#1f2d3d'
      this.strokes = []
      this.current = null
      this.candidates = []
      this.redraw()
    },
    pos (e) {
      const rect = this.$refs.canvas.getBoundingClientRect()
      return [e.clientX - rect.left, e.clientY - rect.top]
    },
    onDown (e) {
      if (!this.ready) return
      this.drawing = true
      const p = this.pos(e)
      this.current = { points: [p] }
      this.strokes.push(this.current)
      this.$refs.canvas.setPointerCapture && this.$refs.canvas.setPointerCapture(e.pointerId)
      this.redraw()
    },
    onMove (e) {
      if (!this.drawing || !this.current) return
      const p = this.pos(e)
      this.current.points.push(p)
      this.redraw()
    },
    onUp () {
      if (!this.drawing) return
      this.drawing = false
      if (this.current && this.current.points.length < 2) {
        this.strokes.pop()
        this.current = null
        this.redraw()
      } else {
        this.current = null
      }
      if (this.recognizeTimer) clearTimeout(this.recognizeTimer)
      this.recognizeTimer = setTimeout(() => this.recognize(), 350)
    },
    redraw () {
      const canvas = this.$refs.canvas
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.lineWidth = 6
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = '#1f2d3d'
      this.strokes.forEach(stroke => {
        const pts = stroke.points
        if (pts.length < 2) return
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.stroke()
      })
    },
    recognize () {
      if (!this.ready || !this.strokes.length) { this.candidates = []; return }
      const raw = this.strokes
        .filter(s => s.points.length >= 2)
        .map(s => s.points.map(p => [Math.round(p[0]), Math.round(p[1])]))
      if (!raw.length) { this.candidates = []; return }
      try {
        const char = new AnalyzedCharacter(raw)
        this.matcher.match(char, 8, (matches) => {
          const arr = (matches || [])
            .map(m => m.character)
            .filter(c => c && c !== ' ')
          this.candidates = Array.from(new Set(arr)).slice(0, 8)
        })
      } catch (err) {
        console.log('[HandwritingPad] 辨識失敗：' + err.message)
        this.candidates = []
      }
    },
    pick (c) {
      this.result += c
      this.candidates = []
      this.resetCanvas()
    },
    clearCanvas () {
      this.resetCanvas()
    },
    backspace () {
      this.result = this.result.slice(0, -1)
    },
    close () {
      this.$emit('update:visible', false)
    },
    done () {
      this.$emit('confirm', this.result)
      this.close()
    }
  }
}
</script>

<style scoped>
.hw-body{ display: flex; flex-direction: column; gap: 10px; }
.hw-result{ display: flex; align-items: center; font-size: 14px; color: #303133; min-height: 24px; }
.hw-result-label{ color: #606266; }
.hw-result-text{ font-weight: 700; }
.hw-canvas-wrap{ position: relative; border: 2px dashed #c0c4cc; border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #fafafa; }
.hw-canvas{ display: block; touch-action: none; cursor: crosshair; }
.hw-mask{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #909399; font-size: 13px; background: rgba(255,255,255,.7); }
.hw-candidates{ display: flex; flex-wrap: wrap; gap: 6px; min-height: 44px; }
.hw-cand{ width: 44px; height: 44px; border: 1px solid #dcdfe6; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #303133; cursor: pointer; background: #fff; }
.hw-cand:hover{ border-color: #409eff; color: #409eff; }
.hw-cand-empty{ width: 100%; text-align: center; color: #c0c4cc; font-size: 13px; padding: 12px 0; }
</style>
