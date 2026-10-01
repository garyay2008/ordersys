<template>
    <div id="emenuAdmin">
        <el-card class="emenu-card">
            <div slot="header" class="clearfix">
                <span>電子菜單（牆上大螢幕）設定</span>
            </div>
            <el-form :model="form" label-width="150px" inline>
                <el-form-item label="顯示貨品圖片">
                    <el-switch v-model="form.showImages"></el-switch>
                </el-form-item>
                <el-form-item label="顯示價格">
                    <el-switch v-model="form.showPrice"></el-switch>
                </el-form-item>
                <el-form-item label="顯示貨品描述">
                    <el-switch v-model="form.showDescribe"></el-switch>
                </el-form-item>
                <el-form-item label="顯示沽清品項">
                    <el-switch v-model="form.showSoldOut"></el-switch>
                </el-form-item>
                <el-form-item label="自動輪播分類">
                    <el-switch v-model="form.autoRotate"></el-switch>
                </el-form-item>
                <el-form-item label="輪播秒數">
                    <el-input-number v-model="form.rotateInterval" :min="3" :max="120" size="small"></el-input-number>
                </el-form-item>
                <el-form-item label="每列欄數">
                    <el-input-number v-model="form.columns" :min="1" :max="6" size="small"></el-input-number>
                </el-form-item>
                <el-form-item label="字體倍率">
                    <el-radio-group v-model="form.fontScale" size="small">
                        <el-radio-button :label="1">1倍</el-radio-button>
                        <el-radio-button :label="1.25">1.25倍</el-radio-button>
                        <el-radio-button :label="1.5">1.5倍</el-radio-button>
                        <el-radio-button :label="2">2倍</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="主題色">
                    <el-color-picker v-model="form.themeColor"></el-color-picker>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" size="small" @click="save">保存設定</el-button>
                </el-form-item>
            </el-form>
            <div class="emenu-tip">關閉輪播後，大螢幕可點左側分類手動切換；沽清品項關閉後直接隱藏。</div>
        </el-card>

        <el-card class="emenu-url-card">
            <div slot="header" class="clearfix">
                <span>大螢幕顯示網址</span>
            </div>
            <p>在大螢幕瀏覽器開啟以下網址，並按 F11 全螢幕：</p>
            <el-input v-model="emenuUrl" readonly>
                <template slot="append">
                    <el-button @click="copyUrl">複製</el-button>
                </template>
            </el-input>
        </el-card>
    </div>
</template>

<script>
export default {
  name: 'emenuAdmin',
  data () {
    return {
      form: {
        showImages: true,
        showPrice: true,
        showDescribe: false,
        showSoldOut: true,
        autoRotate: true,
        rotateInterval: 8,
        columns: 4,
        fontScale: 1,
        themeColor: ''
      },
      emenuUrl: ''
    }
  },
  methods: {
    load () {
      this.$axios.get('/api/emenu/setting')
        .then(res => {
          const d = res.data || {}
          this.form = {
            showImages: d.showImages !== false,
            showPrice: d.showPrice !== false,
            showDescribe: !!d.showDescribe,
            showSoldOut: d.showSoldOut !== false,
            autoRotate: d.autoRotate !== false,
            rotateInterval: Number(d.rotateInterval) || 8,
            columns: Number(d.columns) || 4,
            fontScale: Number(d.fontScale) || 1,
            themeColor: d.themeColor || ''
          }
        })
        .catch(() => {})
    },
    save () {
      this.$axios.post('/api/emenu/save', this.form)
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '保存失敗' }))
    },
    copyUrl () {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(this.emenuUrl)
      }
      this.$message({ type: 'success', message: '已複製' })
    }
  },
  created () {
    this.emenuUrl = `${window.location.origin}/emenu/1`
    this.load()
  }
}
</script>

<style scoped>
#emenuAdmin{
    height: 100%;
}
.emenu-card{
    margin-bottom: 14px;
}
.emenu-url-card p{
    margin: 0 0 10px;
    color: #606266;
    font-size: 13px;
}
.emenu-tip{
    margin-top: 4px;
    font-size: 12px;
    color: #909399;
}
</style>
