<template>
    <div id="qrCode">
        <el-card class="qr-setting-card">
            <div slot="header" class="clearfix">
                <span>QR 功能設定（客人手機點餐版面）</span>
            </div>
            <el-form :model="qrForm" label-width="150px" inline>
                <el-form-item label="顯示貨品圖片">
                    <el-switch v-model="qrForm.showImages" active-text="開啟" inactive-text="關閉"></el-switch>
                </el-form-item>
                <el-form-item label="顯示貨品描述">
                    <el-switch v-model="qrForm.showDescribe" active-text="開啟" inactive-text="關閉"></el-switch>
                </el-form-item>
                <el-form-item label="顯示庫存剩餘">
                    <el-switch v-model="qrForm.showStock" active-text="開啟" inactive-text="關閉"></el-switch>
                </el-form-item>
                <el-form-item label="顯示改碼加價">
                    <el-switch v-model="qrForm.showModPrices" active-text="開啟" inactive-text="關閉"></el-switch>
                </el-form-item>
                <el-form-item label="列出沽清品項">
                    <el-switch v-model="qrForm.showSoldOutItems" active-text="開啟" inactive-text="關閉"></el-switch>
                </el-form-item>
                <el-form-item label="顯示公告">
                    <el-switch v-model="qrForm.showNotice" active-text="開啟" inactive-text="關閉"></el-switch>
                </el-form-item>
                <el-form-item label="顯示詳情按鈕">
                    <el-switch v-model="qrForm.showDetail" active-text="開啟" inactive-text="關閉"></el-switch>
                </el-form-item>
                <el-form-item label="顯示打折">
                    <el-switch v-model="qrForm.showDiscount" active-text="開啟" inactive-text="關閉"></el-switch>
                </el-form-item>
                <el-form-item label="顯示選規格">
                    <el-switch v-model="qrForm.showSpecs" active-text="開啟" inactive-text="關閉"></el-switch>
                    <div class="qr-setting-tip">關閉後，客人點餐版面不再顯示「選規格」按鈕，直接以基礎價加購。</div>
                </el-form-item>
                <el-form-item label="文字大小">
                    <el-radio-group v-model="qrForm.fontScale" size="small">
                        <el-radio-button :label="1">1倍</el-radio-button>
                        <el-radio-button :label="1.25">1.25倍</el-radio-button>
                        <el-radio-button :label="1.5">1.5倍</el-radio-button>
                        <el-radio-button :label="2">2倍</el-radio-button>
                        <el-radio-button :label="2.5">2.5倍</el-radio-button>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="版面主題">
                    <div class="theme-picker">
                        <span v-for="t in themeOptions" :key="t.value"
                              class="theme-swatch"
                              :class="{ active: qrForm.theme === t.value }"
                              :style="{ background: t.swatch }"
                              :title="t.label"
                              @click="qrForm.theme = t.value">
                            <span class="theme-swatch-label">{{ t.label }}</span>
                        </span>
                    </div>
                </el-form-item>
                <el-form-item label="點餐網址前綴">
                    <el-input v-model="qrForm.baseUrl" size="small" style="width: 340px;" placeholder="例如 http://168.70.36.64:3000（留空＝用目前後台網址）"></el-input>
                    <div class="qr-setting-tip">填了公開 IP／域名後，點餐碼固定用此網址；客人手機才能從外面掃得到。</div>
                </el-form-item>
                <el-form-item label="登入畫面背景">
                    <el-upload
                        class="welcome-uploader"
                        action=""
                        :show-file-list="false"
                        :http-request="uploadWelcomeImg"
                        :before-upload="beforeImgUpload">
                        <img v-if="qrForm.welcomeImage" :src="qrForm.welcomeImage" class="welcome-bg-thumb">
                        <i v-else class="el-icon-plus welcome-uploader-icon"></i>
                    </el-upload>
                    <el-input v-model="qrForm.welcomeImage" size="small" style="width: 340px; margin-left: 12px;" placeholder="背景圖網址（留空＝用主題漸層）"></el-input>
                    <div class="qr-setting-tip">上傳圖片或直接填網址；留空則沿用版面主題漸層背景。</div>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" size="small" @click="saveQrSetting">保存 QR 設定</el-button>
                </el-form-item>
            </el-form>
            <div class="qr-setting-tip">關閉圖片後，客人版面改為「菜名」純文字列表；沽清品項關閉後直接從菜單隱藏。</div>
        </el-card>

        <el-row>
            <span class="search-tittle">桌號搜索：</span>
            <el-col :xs="8" :sm="6" :md="6" :lg="5">
                <el-input
                    placeholder="請輸入桌號"
                    prefix-icon="el-icon-search"
                    size="small"
                    v-model="search">
                </el-input>
            </el-col>

            <el-button type="primary" size="small" class="btn-shadow" @click="addTableNum()">添加桌號</el-button>
        </el-row>
        <el-row class="row-height">
            <el-col :span="24">
                <el-table
                    :data="tableData.filter(data => !search || data.no.toString().toLowerCase().includes(search.toLowerCase()))"
                    size="medium"
                    :max-height="tableHeight"
                    :default-sort = "{prop: 'no', order: 'ascending'}"
                    style="width: 100%">
                    <el-table-column
                    fixed
                    align="center"
                    prop="no"
                    sortable
                    label="餐桌號碼">
                    </el-table-column>
                    <el-table-column
                    fixed
                    align="center"
                    prop="url"
                    label="點單鏈接">
                    </el-table-column>
                    <el-table-column
                    fixed
                    align="center"
                    label="點餐碼">
                    <template slot-scope="scope">
                        <el-button primary="success" type="text" @click="qrcode(scope.row)">點擊查看點餐碼</el-button>
                    </template>
                    </el-table-column>
                    <el-table-column
                    fixed="right"
                    align="center"
                    label="操作">
                    <template slot-scope="scope">
                        <el-button type="text" size="medium" @click="delTableNum(scope.row)">刪除</el-button>
                    </template>
                    </el-table-column>
                </el-table>
            </el-col>
        </el-row>
        <TableNumDialog :dialog="dialog" :form ="form" @update="loadData" ></TableNumDialog>
        <ShowQRCode ref="showQRCode" :qrcodeData ="qrcodeData" @close="qrcodeData.visible = false"></ShowQRCode>
    </div>
</template>

<script>
import TableNumDialog from '../../components/admin/TableNumDialog'
import ShowQRCode from '../../components/admin/ShowQRCode'
export default {
  name: 'qrCode',
  data () {
    return {
      dialog: {
        show: false,
        title: '添加餐桌號碼'
      },
      form: {
        url: '',
        no: ''
      },
      qrcodeData: {
        title: '',
        visible: false
      },
      qrForm: {
        showImages: true,
        showDescribe: true,
        showStock: false,
        showModPrices: true,
        showSoldOutItems: true,
        showNotice: true,
        showDetail: true,
        showDiscount: true,
        showSpecs: false,
        fontScale: 1,
        theme: 'orange',
        baseUrl: '',
        welcomeImage: ''
      },
      themeOptions: [
        { value: 'orange', label: '經典橘', swatch: 'linear-gradient(135deg, #ff5722, #ff9800)' },
        { value: 'green', label: '森林綠', swatch: 'linear-gradient(135deg, #16a085, #2ecc71)' },
        { value: 'blue', label: '海洋藍', swatch: 'linear-gradient(135deg, #2980b9, #00bcd4)' },
        { value: 'indigo', label: '藍紫', swatch: 'linear-gradient(135deg, #8d94d0, #7b84c9)' },
        { value: 'purple', label: '尊爵紫', swatch: 'linear-gradient(135deg, #8e44ad, #d05ce3)' }
      ],
      tableData: [],
      tableHeight: window.innerHeight - 142,
      search: ''
    }
  },
  methods: {
    loadData () {
      this.$axios.get('/api/qrcode/all')
        .then(res => {
          this.tableData = res.data
        })
        .catch(err => console.log(err))
      this.loadQrSetting()
    },
    loadQrSetting () {
      this.$axios.get('/api/qrsetting/get')
        .then(res => {
          const d = res.data || {}
          this.qrForm = {
            showImages: d.showImages !== false,
            showDescribe: d.showDescribe !== false,
            showStock: !!d.showStock,
            showModPrices: d.showModPrices !== false,
            showSoldOutItems: d.showSoldOutItems !== false,
            showNotice: d.showNotice !== false,
            showDetail: d.showDetail !== false,
            showDiscount: d.showDiscount !== false,
            showSpecs: !!d.showSpecs,
            fontScale: Number(d.fontScale) || 1,
            theme: d.theme || 'orange',
            baseUrl: d.baseUrl || '',
            welcomeImage: d.welcomeImage || ''
          }
        })
        .catch(err => console.log(err))
    },
    uploadWelcomeImg (params) {
      const file = params.file
      const form = new FormData()
      form.append('file', file)
      this.$axios.post('/api/qrsetting/upload', form, {
        headers: { 'content-type': 'multipart/form-data' }
      })
        .then(res => {
          if (res.data && res.data.status === 'ok' && res.data.url) {
            this.qrForm.welcomeImage = res.data.url
            this.$message({ type: 'success', message: '背景圖已上傳，請記得保存 QR 設定' })
          } else {
            this.$message({ type: 'error', message: '上傳失敗，請重試' })
          }
        })
        .catch(() => {
          this.$message({ type: 'error', message: '上傳失敗，請重試' })
        })
    },
    beforeImgUpload (file) {
      const ok = /^image\/(jpeg|png|webp|gif)$/.test(file.type)
      const isLt5M = file.size / 1024 / 1024 < 5
      if (!ok) this.$message({ type: 'error', message: '只能上傳 jpg/png/webp/gif 圖片' })
      if (!isLt5M) this.$message({ type: 'error', message: '圖片不能超過 5MB' })
      return ok && isLt5M
    },
    saveQrSetting () {
      this.$axios.post('/api/qrsetting/save', this.qrForm)
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '保存失敗' }))
    },
    addTableNum () {
      this.dialog = {
        show: true,
        title: '添加餐桌號碼'
      }
      this.form = {
        url: (this.qrForm.baseUrl || document.URL.split('/admin/qrcode')[0]).replace(/\/+$/, ''),
        no: ''
      }
    },
    delTableNum (row) {
      this.$confirm(`確認刪除桌號 “${row.no}” 嗎？`)
        .then(_ => {
          this.$axios.post('/api/qrcode/del', { _id: row._id })
            .then(result => {
              this.$message({
                type: 'success',
                message: result.data
              })
              this.loadData()
            })
            .catch(err => {
              console.log(err)
            })
        })
        .catch(_ => {})
    },
    qrcode (row) {
      this.qrcodeData = {
        title: row.no,
        visible: true
      }
      this.$refs.showQRCode.drawQRCode(row.url)
    }
  },
  created () {
    this.loadData()
    window.onresize = () => {
      this.tableHeight = window.innerHeight - 142
    }
  },
  components: {
    TableNumDialog,
    ShowQRCode
  }
}
</script>

<style scoped>
    #qrCode{
        height: 100%;
    }
    .row-height{
        margin-top: 10px;
        overflow: auto;
    }
    .qr-setting-card{
        margin-bottom: 14px;
    }
    .qr-setting-tip{
        margin-top: 4px;
        font-size: 12px;
        color: #909399;
    }
    .welcome-uploader{
        display: inline-block;
        vertical-align: top;
    }
    .welcome-uploader .el-upload{
        width: 90px;
        height: 56px;
        border: 1px dashed #d9d9d9;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        cursor: pointer;
    }
    .welcome-uploader .el-upload:hover{
        border-color: #409eff;
    }
    .welcome-bg-thumb{
        width: 90px;
        height: 56px;
        object-fit: cover;
        display: block;
    }
    .welcome-uploader-icon{
        font-size: 22px;
        color: #8c939d;
    }
    .theme-picker{
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .theme-swatch{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 74px;
        height: 32px;
        padding: 0 12px;
        border-radius: 16px;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
        transition: all 0.2s ease;
    }
    .theme-swatch-label{
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
    .theme-swatch.active{
        outline: 2px solid #111;
        outline-offset: 2px;
    }
    .btn-shadow{
        float: right;
        top: 0;
        box-shadow: 0px 0px 20px rgba(53, 141, 230, 0.562);
    }
    .warn-shadow{
        box-shadow: 0px 0px 20px rgba(255, 255, 220, .3)
    }
    .box-card{
        box-shadow: 1px 1px 15px rgba(58,59,69,.3)!important;
        border-radius: 6px;
    }
    .search-tittle{
        display: inline-block;
        float: left;
        height: 32px;
        line-height: 32px;
        color: #111;
    }
</style>
