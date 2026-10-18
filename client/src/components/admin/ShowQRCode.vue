<template>
    <div id="showQRCode">
        <el-dialog
        :title="'桌號 ' + qrcodeData.title + ' 點餐碼'"
        :visible.sync="qrcodeData.visible"
        close-on-click-modal
        width="720px"
        center>
            <div class="qr-style-switch">
                <span class="qr-style-switch__label">樣式</span>
                <el-button size="mini" :type="currentStyle === 'B' ? 'primary' : 'default'" @click="selectStyle('B')">品牌藍</el-button>
                <el-button size="mini" :type="currentStyle === 'C' ? 'primary' : 'default'" @click="selectStyle('C')">深海軍藍</el-button>
                <el-button size="mini" :type="currentStyle === 'E' ? 'primary' : 'default'" @click="selectStyle('E')">漸層活力</el-button>
            </div>
            <div class="qr-card" :class="cardClass">
                <div class="qr-card__brand">{{ shopName || '歡迎光臨' }}</div>
                <div class="qr-card__table">桌號 {{ qrcodeData.title }}</div>
                <div class="qr-card__code">
                    <img :src="qrcodeURL" alt="點餐碼">
                    <img v-if="shopLogo" :src="shopLogo" class="qr-card__logo" alt="logo">
                </div>
                <div class="qr-card__hint">掃碼點餐</div>
            </div>
            <span slot="footer" class="dialog-footer">
                <el-button type="primary" @click="$emit('close')">確 定</el-button>
            </span>
        </el-dialog>
    </div>
</template>

<script>
import QRCode from 'qrcode'

const STYLE_COLORS = {
  B: { dark: '#297fff', light: '#ffffff' },
  C: { dark: '#1e3a5f', light: '#ffffff' },
  E: { dark: '#1e3a5f', light: '#ffffff' }
}

const STYLE_CLASS = {
  B: 'qr-card--blue',
  C: 'qr-card--navy',
  E: 'qr-card--gradient'
}

export default {
  name: 'showQRCode',
  props: { qrcodeData: Object },
  data () {
    return {
      qrcodeURL: '',
      shopName: '',
      shopLogo: '',
      currentStyle: 'C',
      qrText: ''
    }
  },
  computed: {
    cardClass () {
      return STYLE_CLASS[this.currentStyle] || STYLE_CLASS.C
    }
  },
  methods: {
    drawQRCode (data) {
      this.qrText = data
      this.render()
    },
    selectStyle (style) {
      this.currentStyle = style
      this.render()
    },
    render () {
      if (!this.qrText) return
      const color = STYLE_COLORS[this.currentStyle] || STYLE_COLORS.C
      QRCode.toDataURL(this.qrText, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 660,
        color
      }, (err, url) => {
        if (err) {
          this.qrcodeURL = ''
          return
        }
        this.qrcodeURL = url
      })
    }
  },
  created () {
    this.$axios.get('/api/shop/get')
      .then(res => {
        this.shopName = (res.data && res.data.shopName) ? res.data.shopName : ''
        this.shopLogo = (res.data && res.data.shopImg) ? res.data.shopImg : ''
      })
      .catch(() => {})
  }
}
</script>

<style scoped>
    .qr-style-switch{
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
    }
    .qr-style-switch .el-button{
        margin-left: 6px;
    }
    .qr-style-switch__label{
        margin-right: 10px;
        font-size: 13px;
        color: #606266;
    }
    .qr-card{
        position: relative;
        overflow: hidden;
        padding: 22px 22px 18px;
        border-radius: 14px;
        text-align: center;
        box-shadow: 0 12px 32px rgba(16, 42, 74, 0.35);
    }
    .qr-card::before{
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
    }
    .qr-card__brand{
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 2px;
    }
    .qr-card__table{
        margin-top: 4px;
        font-size: 15px;
        letter-spacing: 1px;
    }
    .qr-card__code{
        position: relative;
        width: 600px;
        height: 600px;
        margin: 16px auto 12px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .qr-card__code img{
        width: 100%;
        height: 100%;
        display: block;
        border-radius: 8px;
    }
    .qr-card__code .qr-card__logo{
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 140px;
        height: 140px;
        object-fit: contain;
        border-radius: 50%;
        background: #fff;
        padding: 8px;
        box-sizing: border-box;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
    }
    .qr-card__hint{
        font-size: 14px;
        letter-spacing: 6px;
    }

    /* C 深海軍藍 */
    .qr-card--navy{
        background: #1e3a5f;
        border: 1px solid rgba(212, 175, 126, 0.45);
        color: #fff;
    }
    .qr-card--navy::before{
        background: linear-gradient(90deg, #d4af7e, #f0d9a8, #d4af7e);
    }
    .qr-card--navy .qr-card__brand,
    .qr-card--navy .qr-card__hint{
        color: #f0d9a8;
    }
    .qr-card--navy .qr-card__table{
        opacity: 0.92;
    }
    .qr-card--navy .qr-card__code img{
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
    }

    /* B 品牌藍 */
    .qr-card--blue{
        background: #ffffff;
        border: 1px solid #dbe7f7;
        color: #1e3a5f;
    }
    .qr-card--blue::before{
        background: linear-gradient(90deg, #297fff, #5b9cff, #297fff);
    }
    .qr-card--blue .qr-card__brand{
        color: #297fff;
    }
    .qr-card--blue .qr-card__table{
        color: #1e3a5f;
        opacity: 0.8;
    }
    .qr-card--blue .qr-card__hint{
        color: #297fff;
    }
    .qr-card--blue .qr-card__code img{
        box-shadow: 0 0 0 1px #e4ecf7;
    }

    /* E 漸層活力 */
    .qr-card--gradient{
        background: linear-gradient(150deg, #297fff 0%, #2fb8ff 100%);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #fff;
    }
    .qr-card--gradient::before{
        background: rgba(255, 255, 255, 0.5);
    }
    .qr-card--gradient .qr-card__brand,
    .qr-card--gradient .qr-card__hint{
        color: #fff;
    }
    .qr-card--gradient .qr-card__table{
        opacity: 0.95;
    }
    .qr-card--gradient .qr-card__code img{
        box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.35);
    }
</style>
