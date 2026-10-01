<template>
  <el-dialog title="叫起（暫緩出單）" :visible.sync="callDishDialog.show" width="400px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <div v-if="callDishDialog.items.length === 0" style="padding:20px; text-align:center; color:#909399;">沒有可叫起的品項</div>
    <div v-else>
      <div class="call-select-all">
        <el-checkbox :value="allChecked" :indeterminate="indeterminate" @change="toggleAll">全選</el-checkbox>
      </div>
      <div style="max-height:400px; overflow:auto;">
        <el-checkbox-group v-model="callDishDialog.checked">
          <div v-for="(item, idx) in callDishDialog.items" :key="idx" style="padding:8px 0; border-bottom:1px solid #f0f0f0;">
            <el-checkbox :label="idx">{{ item.name || '品項' }} × {{ item.count || 1 }}</el-checkbox>
          </div>
        </el-checkbox-group>
      </div>
      <div class="call-hint">標記叫起後會立即送單，叫起品項不會列印到廚房，待按「起菜」才通知廚房出菜。</div>
    </div>
    <div slot="footer">
      <el-button @click="callDishDialog.show = false">取消</el-button>
      <el-button type="warning" :loading="callDishDialog.loading" :disabled="!callDishDialog.checked.length" @click="$emit('submit')">叫起並送單</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'callDishDialog',
  props: {
    callDishDialog: { type: Object, required: true }
  },
  computed: {
    allChecked () {
      const items = this.callDishDialog.items || []
      return items.length > 0 && (this.callDishDialog.checked || []).length === items.length
    },
    indeterminate () {
      const checked = (this.callDishDialog.checked || []).length
      const total = (this.callDishDialog.items || []).length
      return checked > 0 && checked < total
    }
  },
  methods: {
    toggleAll (val) {
      const items = this.callDishDialog.items || []
      this.$set(this.callDishDialog, 'checked', val ? items.map((_, i) => i) : [])
    }
  }
}
</script>

<style scoped>
.call-select-all { padding: 6px 0 10px; border-bottom: 1px solid #ebeef5; }
.call-hint { padding-top: 10px; font-size: 12px; color: #909399; }
</style>
