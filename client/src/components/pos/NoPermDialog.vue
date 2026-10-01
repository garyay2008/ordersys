<template>
  <el-dialog title="⚠️ 無權限操作" :visible.sync="noPermDialog.show" width="400px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <div style="text-align: center; padding: 10px 0;">
      <div style="font-size: 48px; margin-bottom: 16px;">🚫</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px; color: #f56c6c;">{{ noPermDialog.name }}</div>
      <div style="font-size: 14px; color: #606266; margin-bottom: 8px;">
        此功能需要<span style="color: #f56c6c; font-weight: bold;"> {{ levelLabel(noPermDialog.requiredLevel) }}</span>（等級 {{ noPermDialog.requiredLevel }}）以上權限
      </div>
      <div style="font-size: 13px; color: #909399;">
        你目前的權限等級為<span style="font-weight: bold;"> {{ levelLabel(staffPermissionLevel) }}</span>（等級 {{ staffPermissionLevel }}）
      </div>
      <div style="font-size: 13px; color: #909399; margin-top: 8px;">請聯絡經理或管理員獲取權限</div>
    </div>
    <div slot="footer">
      <el-button type="primary" @click="noPermDialog.show = false">我知道了</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'noPermDialog',
  props: {
    noPermDialog: { type: Object, required: true },
    staffPermissionLevel: { type: Number, default: 1 }
  },
  methods: {
    levelLabel (level) {
      if (level >= 4) return '管理員'
      if (level === 3) return '經理'
      if (level === 2) return '收銀員'
      return '服務員'
    }
  }
}
</script>
