<template>
  <el-dialog title="" :visible.sync="shareTablePanel.show" width="480px" append-to-body :close-on-click-modal="false" :show-close="false" custom-class="share-table-dialog">
    <div class="stp-topbar">
      <span class="stp-title">枱號 {{ shareTablePanel.deskNo }}</span>
      <span class="stp-close" title="離開" @click="$emit('close')"><i class="el-icon-close"></i></span>
    </div>
    <div class="stp-main-btn" @click="$emit('enter', shareTablePanel.deskNo)">
      <i class="el-icon-s-home"></i>
      <span>{{ shareTablePanel.deskNo }} 主枱</span>
    </div>
    <div class="stp-divider"><span>搭枱</span></div>
    <div class="stp-sub-grid">
      <div v-for="st in shareTablePanel.subTables" :key="st.no" class="stp-card" :class="cardClass(st.status)" @click="$emit('enter', st.no)">
        <i class="stp-dot" :class="cardClass(st.status)"></i>
        <div v-if="st.badges && st.badges.length" class="stp-badge-group">
          <el-tooltip v-for="b in st.badges" :key="b.key" :content="b.tip" placement="top" effect="dark">
            <div class="stp-badge" :style="{ fontSize: b.fontSize + 'px', color: b.color, background: b.background, width: b.fontSize + 12 + 'px', height: b.fontSize + 12 + 'px', lineHeight: b.fontSize + 12 + 'px' }">{{ b.text }}</div>
          </el-tooltip>
        </div>
        <span class="stp-card-no">{{ st.name }}</span>
        <span class="stp-card-status">{{ st.status }}</span>
      </div>
      <div v-if="shareTablePanel.subTables.length < 4" class="stp-card stp-card-add" @click="$emit('share')">
        <i class="el-icon-plus"></i>
        <span>搭枱</span>
      </div>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'shareTablePanel',
  props: {
    shareTablePanel: { type: Object, required: true }
  },
  methods: {
    cardClass (status) {
      return {
        空枱: 'stp-card-free',
        用餐中: 'stp-card-busy',
        已印單: 'stp-card-printed',
        使用中: 'stp-card-qr',
        退單: 'stp-card-relisted'
      }[status] || 'stp-card-free'
    }
  }
}
</script>

<style scoped>
.stp-topbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.stp-title{ font-size:18px; font-weight:700; color:#1e293b; }
.stp-close{ display:flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:50%; background:#ef4444; color:#fff; font-size:16px; line-height:1; cursor:pointer; transition:all .15s; }
.stp-close:hover{ background:#dc2626; transform:scale(1.1); }
.stp-close:active{ transform:scale(.95); }
.stp-main-btn{ display:flex; align-items:center; justify-content:center; gap:10px; padding:16px; margin-bottom:16px; background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; border-radius:14px; font-size:18px; font-weight:700; cursor:pointer; transition:transform .15s; }
.stp-main-btn:hover{ transform:scale(1.02); }
.stp-divider{ text-align:center; margin:12px 0; color:#909399; font-size:13px; position:relative; }
.stp-divider::before,.stp-divider::after{ content:''; position:absolute; top:50%; width:30%; height:1px; background:#dcdfe6; }
.stp-divider::before{ left:0; }
.stp-divider::after{ right:0; }
.stp-sub-grid{ display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; }
.stp-card{ position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height:110px; padding:18px 10px; border-radius:12px; border:1.5px solid rgba(148,163,184,.25); background:#fff; box-shadow:0 2px 8px rgba(36,61,91,.06); cursor:pointer; transition:all .2s ease; overflow:hidden; }
.stp-card:hover{ transform:translateY(-3px); box-shadow:0 6px 16px rgba(36,61,91,.15); border-color:rgba(64,158,255,.4); }
.stp-card-free{ background:linear-gradient(145deg,#fff,#eef7ff); border-color:#93c5fd; }
.stp-card-busy{ background:linear-gradient(145deg,#fff,#ecfdf5); border-color:#86efac; }
.stp-card-printed{ background:linear-gradient(145deg,#fff,#fefce8); border-color:#fcd34d; }
.stp-card-relisted{ background:linear-gradient(145deg,#fff,#faf5ff); border-color:#c084fc; }
.stp-card-qr{ background:linear-gradient(145deg,#fff,#fef2f2); border-color:#fca5a5; }
.stp-dot{ position:absolute; top:12px; left:12px; width:9px; height:9px; border-radius:50%; }
.stp-badge-group{ position:absolute; top:6px; right:6px; display:flex; flex-direction:column; align-items:flex-end; gap:4px; z-index:3; }
.stp-badge{ text-align:center; border-radius:50%; font-weight:700; }
.stp-dot.stp-card-free{ background:#409eff; }
.stp-dot.stp-card-busy{ background:#67c23a; }
.stp-dot.stp-card-printed{ background:#e6a23c; }
.stp-dot.stp-card-qr{ background:#f56c6c; }
.stp-dot.stp-card-relisted{ background:#9c27b0; }
.stp-card-no{ font-size:30px; font-weight:800; color:#1e293b; line-height:1; }
.stp-card-status{ font-size:13px; font-weight:600; }
.stp-card-free .stp-card-status{ color:#2583d8; }
.stp-card-busy .stp-card-status{ color:#67c23a; }
.stp-card-printed .stp-card-status{ color:#e6a23c; }
.stp-card-relisted .stp-card-status{ color:#9c27b0; }
.stp-card-qr .stp-card-status{ color:#f56c6c; }
.stp-card-add{ flex-direction:row; gap:8px; min-height:auto; padding:18px 10px; border:2px dashed #d1d5db; color:#909399; background:#fafbfc; }
.stp-card-add:hover{ border-color:#3b82f6; color:#3b82f6; background:#eff6ff; }
</style>
