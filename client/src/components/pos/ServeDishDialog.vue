<template>
  <el-dialog title="起菜" :visible.sync="serveDishDialog.show" width="400px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <div v-if="serveDishDialog.items.length === 0" style="padding:20px; text-align:center; color:#909399;">沒有已叫起的品項</div>
    <div v-else>
      <div class="serve-select-all">
        <el-checkbox :value="allChecked" :indeterminate="indeterminate" @change="toggleAll">全選</el-checkbox>
      </div>
      <div style="max-height:400px; overflow:auto;">
        <el-checkbox-group v-model="serveDishDialog.checked">
          <div v-for="(item, idx) in serveDishDialog.items" :key="idx" style="padding:8px 0; border-bottom:1px solid #f0f0f0;">
            <el-checkbox :label="idx">
              <span v-if="item._kind === 'content'" class="serve-combo-name">{{ item._comboName }} · </span>{{ item.name || '品項' }} × {{ item.count || 1 }}
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </div>
    </div>
    <div slot="footer">
      <el-button @click="serveDishDialog.show = false">取消</el-button>
      <el-button type="success" :loading="serveDishDialog.loading" :disabled="!serveDishDialog.checked.length" @click="$emit('submit')">起菜出單</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'serveDishDialog',
  props: {
    serveDishDialog: { type: Object, required: true }
  },
  computed: {
    allChecked () {
      const items = this.serveDishDialog.items || []
      return items.length > 0 && (this.serveDishDialog.checked || []).length === items.length
    },
    indeterminate () {
      const checked = (this.serveDishDialog.checked || []).length
      const total = (this.serveDishDialog.items || []).length
      return checked > 0 && checked < total
    }
  },
  methods: {
    toggleAll (val) {
      const items = this.serveDishDialog.items || []
      this.$set(this.serveDishDialog, 'checked', val ? items.map((_, i) => i) : [])
    }
  }
}
</script>

<style scoped>
.serve-combo-name { color: #909399; }
.serve-select-all { padding: 6px 0 10px; border-bottom: 1px solid #ebeef5; }
</style>
