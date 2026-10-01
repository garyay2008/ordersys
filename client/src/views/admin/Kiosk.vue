<template>
    <div id="kioskAdmin">
        <el-card class="kiosk-card">
            <div slot="header" class="clearfix">
                <span>自助點餐機（含付款）設定</span>
            </div>
            <el-form :model="form" label-width="150px">
                <el-form-item label="付款方式">
                    <el-select v-model="form.paymentMethods" multiple filterable allow-create default-first-option placeholder="選擇或輸入付款方式" style="width: 480px;">
                        <el-option v-for="m in methodOptions" :key="m" :label="m" :value="m"></el-option>
                    </el-select>
                    <div class="tip">自助機不支援現金與信用卡，請只保留八達通、行動支付等。</div>
                </el-form-item>
                <el-form-item label="FPS 收款 QR 圖片">
                    <el-input v-model="form.fpsQrImage" placeholder="貼上行動支付 FPS QR 圖片網址" style="width: 480px;"></el-input>
                    <div v-if="form.fpsQrImage" class="fps-preview">
                        <img :src="form.fpsQrImage" alt="FPS QR">
                    </div>
                </el-form-item>
                <el-form-item label="顯示貨品圖片">
                    <el-switch v-model="form.showImages"></el-switch>
                </el-form-item>
                <el-form-item label="收銀機編號">
                    <el-select v-model="form.terminalCode" clearable filterable placeholder="選擇收銀機（單號前綴來源，可留空）" style="width: 480px;">
                        <el-option v-for="t in terminals" :key="t.code" :label="t.code + '（' + (t.name || '') + '）'" :value="t.code"></el-option>
                    </el-select>
                    <div class="tip">對應「收銀機管理」的編號，留空則用時間戳單號。</div>
                </el-form-item>
                <el-form-item label="開啟堂食點餐">
                    <el-switch v-model="form.dineIn"></el-switch>
                </el-form-item>
                <el-form-item label="開啟外賣自取">
                    <el-switch v-model="form.takeaway"></el-switch>
                </el-form-item>
                <el-form-item label="開啟查單付款">
                    <el-switch v-model="form.payByOrderNo"></el-switch>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" @click="save">保存設定</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card class="kiosk-url-card">
            <div slot="header" class="clearfix">
                <span>自助機顯示網址（點餐＋付款）</span>
            </div>
            <p>在自助機瀏覽器開啟以下網址，並按 F11 全螢幕：</p>
            <el-input v-model="kioskUrl" readonly>
                <template slot="append">
                    <el-button @click="copyUrl">複製</el-button>
                </template>
            </el-input>
        </el-card>

        <el-card class="kiosk-url-card">
            <div slot="header" class="clearfix">
                <span>自助付款機顯示網址（僅付款）</span>
            </div>
            <p>在付款機瀏覽器開啟以下網址，客人輸入單號或掃描 Barcode 即可付款：</p>
            <el-input v-model="payKioskUrl" readonly>
                <template slot="append">
                    <el-button @click="copyPayKioskUrl">複製</el-button>
                </template>
            </el-input>
        </el-card>
    </div>
</template>

<script>
export default {
  name: 'kioskAdmin',
  data () {
    return {
      form: {
        paymentMethods: ['八達通', '行動支付'],
        fpsQrImage: '',
        showImages: true,
        terminalCode: '',
        dineIn: true,
        takeaway: true,
        payByOrderNo: true
      },
      methodOptions: ['現金', '信用卡', '行動支付', '八達通'],
      terminals: [],
      kioskUrl: '',
      payKioskUrl: ''
    }
  },
  methods: {
    loadTerminals () {
      this.$axios.get('/api/posterminal/all')
        .then(res => { this.terminals = res.data || [] })
        .catch(() => {})
    },
    load () {
      this.$axios.get('/api/kiosk/setting')
        .then(res => {
          const d = res.data || {}
          this.form = {
            paymentMethods: Array.isArray(d.paymentMethods) ? d.paymentMethods : ['八達通', '行動支付'],
            fpsQrImage: d.fpsQrImage || '',
            showImages: d.showImages !== false,
            terminalCode: d.terminalCode || '',
            dineIn: d.dineIn !== false,
            takeaway: d.takeaway !== false,
            payByOrderNo: d.payByOrderNo !== false
          }
        })
        .catch(() => {})
    },
    save () {
      this.$axios.post('/api/kiosk/setting/save', this.form)
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '保存失敗' }))
    },
    copyUrl () {
      if (navigator.clipboard) navigator.clipboard.writeText(this.kioskUrl)
      this.$message({ type: 'success', message: '已複製' })
    },
    copyPayKioskUrl () {
      if (navigator.clipboard) navigator.clipboard.writeText(this.payKioskUrl)
      this.$message({ type: 'success', message: '已複製' })
    }
  },
  created () {
    this.kioskUrl = `${window.location.origin}/kiosk`
    this.payKioskUrl = `${window.location.origin}/paykiosk`
    this.load()
    this.loadTerminals()
  }
}
</script>

<style scoped>
#kioskAdmin{
    height: 100%;
}
.kiosk-card{
    margin-bottom: 14px;
}
.tip{
    font-size: 12px;
    color: #909399;
    line-height: 1.6;
}
.fps-preview{
    margin-top: 10px;
}
.fps-preview img{
    width: 160px;
    height: 160px;
    object-fit: contain;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
}
.kiosk-url-card p{
    margin: 0 0 10px;
    color: #606266;
    font-size: 13px;
}
</style>
