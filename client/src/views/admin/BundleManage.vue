<template>
  <div id="bundlemanage">
    <el-card shadow="never" class="global-card">
      <div slot="header" class="card-header">撞餐功能設定</div>
      <el-form label-width="120px" class="global-form">
        <el-form-item label="撞餐功能">
          <el-switch v-model="global.bundleEnabled" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="hint">開啟後，POS 可將多項單點自動組合成套餐價（撞餐）。</div>
        </el-form-item>
        <el-form-item v-if="global.bundleEnabled" label="觸發方式">
          <el-radio-group v-model="global.bundleMode">
            <el-radio label="auto">自動偵測（加單時）</el-radio>
            <el-radio label="manual">手動撞餐鍵</el-radio>
            <el-radio label="both">兩者</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="global.bundleEnabled" label="計價規則">
          <el-radio-group v-model="global.bundleRule">
            <el-radio label="bestPrice">省最多錢（顧客最優）</el-radio>
            <el-radio label="priority">套餐優先級</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="small" @click="saveGlobal">保存設定</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="跟餐組別" name="bundlegroup" lazy>
        <BundleGroup></BundleGroup>
      </el-tab-pane>
      <el-tab-pane label="主菜組別" name="maingroup" lazy>
        <MainGroup></MainGroup>
      </el-tab-pane>
      <el-tab-pane label="撞餐規則" name="matchingrule" lazy>
        <MatchingRule></MatchingRule>
      </el-tab-pane>
      <el-tab-pane label="套餐綁定" name="bundlecombo" lazy>
        <Bundle></Bundle>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import BundleGroup from './BundleGroup'
import MainGroup from './MainGroup'
import MatchingRule from './MatchingRule'
import Bundle from './Bundle'

export default {
  name: 'bundleManage',
  components: { BundleGroup, MainGroup, MatchingRule, Bundle },
  data () {
    return {
      activeTab: 'bundlegroup',
      global: { bundleEnabled: false, bundleMode: 'auto', bundleRule: 'bestPrice' }
    }
  },
  methods: {
    loadGlobal () {
      this.$axios.get('/api/possetting/get')
        .then(res => {
          const d = res.data || {}
          this.global.bundleEnabled = !!d.bundleEnabled
          this.global.bundleMode = d.bundleMode || 'auto'
          this.global.bundleRule = d.bundleRule || 'bestPrice'
        })
        .catch(err => console.log(err))
    },
    saveGlobal () {
      this.$axios.post('/api/possetting/save', {
        bundleEnabled: !!this.global.bundleEnabled,
        bundleMode: this.global.bundleMode,
        bundleRule: this.global.bundleRule
      })
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '保存失敗' }))
    }
  },
  created () {
    this.loadGlobal()
  }
}
</script>

<style scoped>
#bundlemanage{ height: 100%; }
.global-card{ margin-bottom: 12px; }
.card-header{ font-weight: bold; color: #409eff; }
.global-form{ padding: 0 10px; }
.hint{ font-size: 12px; color: #c0c4cc; margin-left: 8px; }
</style>
