<template>
    <div class="header">
        <div class="content-wrapper">
            <div class="avatar">
                <img v-if="shopInfo.shopImg" :src="shopInfo.shopImg" height="64" width="64" alt="">
                <div v-else class="avatar-fallback">{{ shopInitial }}</div>
            </div>
            <div class="shop-info">
                <div class="title">{{ shopInfo.shopName }}</div>
                <div class="intro">{{ shopInfo.shopIntro }}</div>
            </div>
        </div>
        <div class="notice-wrapper" v-if="showNotice" @click="showDetail">
            <span class="notice-title"></span>
            <span class="notice-text">{{ shopInfo.shopNotice }}</span>
            <i class="el-icon-arrow-right"></i>
        </div>
        <div class="background" v-if="shopInfo.shopImg">
            <img :src="shopInfo.shopImg" width="100%" height="100%" alt="">
        </div>
        <transition name="el-fade-in">
            <div v-show="isShow" class="detail">
                <div class="detail-wrapper clearfix">
                    <div class="detail-main">
                        <img v-if="shopInfo.shopImg" :src="shopInfo.shopImg" width="90px" height="90px" alt="">
                        <div v-else class="detail-avatar-fallback">{{ shopInitial }}</div>
                        <h1 class="name">{{ shopInfo.shopName }}</h1>
                        <div class="title">
                            <div class="line"></div>
                            <div class="text">店鋪詳情</div>
                            <div class="line"></div>
                        </div>
                        <div class="text">
                            <p>{{ shopInfo.shopIntro }}</p>
                        </div>
                        <div class="title">
                            <div class="line"></div>
                            <div class="text">店鋪公告</div>
                            <div class="line"></div>
                        </div>
                        <div class="text">
                            <p>{{ shopInfo.shopNotice }}</p>
                        </div>
                    </div>
                </div>
                <div class="detail-close" @click="showDetail">
                    <i class="el-icon-close"></i>
                </div>
            </div>
        </transition>
    </div>
</template>
<script>

export default {
  data () {
    return {
      shopInfo: {
        shopName: '',
        shopIntro: '',
        shopNotice: '',
        shopImg: ''
      },
      isShow: false,
      showNotice: true
    }
  },
  computed: {
    shopInitial () {
      return (this.shopInfo.shopName || '店').charAt(0)
    }
  },
  methods: {
    showDetail () {
      this.isShow = !this.isShow
    }
  },
  created () {
    this.$axios.get('/api/shop/get')
      .then(res => {
        this.shopInfo = res.data
      })
    this.$axios.get('/api/qrsetting/get')
      .then(res => {
        this.showNotice = !res.data || res.data.showNotice !== false
      })
      .catch(() => {})
  }
}
</script>
<style>
    .header{
        position: relative;
        overflow: hidden;
        color: #fff;
        background: linear-gradient(135deg, rgba(255, 87, 34, 0.9), rgba(255, 152, 0, 0.8));
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
    }
    .content-wrapper{
        position: relative;
        padding: 28px 16px 18px 20px;
        display: flex;
        align-items: center;
    }
    .content-wrapper > .avatar{
        display: inline-block;
        vertical-align: top;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        flex-shrink: 0;
    }
    .content-wrapper > .avatar img{
        display: block;
    }
    .content-wrapper > .avatar .avatar-fallback{
        width: 64px;
        height: 64px;
        border-radius: 12px;
        background: linear-gradient(135deg, #ff5722, #ff9800);
        color: #fff;
        font-size: 28px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .content-wrapper > .shop-info{
        display: inline-block;
        flex: 1;
        margin-left: 14px;
        min-width: 0;
        vertical-align: baseline;
    }
    .content-wrapper > .shop-info > .title{
        font-size: 18px;
        font-weight: 700;
        margin: 2px 0 6px 0;
        letter-spacing: 0.5px;
    }
    .content-wrapper > .shop-info > .intro{
        font-size: 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0.85;
    }
    .notice-wrapper{
        position: relative;
        height: 30px;
        line-height: 30px;
        padding: 0 22px 0 12px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        background: rgba(255,255,255,0.08);
        border-top: 1px solid rgba(255,255,255,0.1);
    }
    .notice-wrapper > .notice-title{
        display: inline-block;
        vertical-align: top;
        margin-top: 9px;
        width: 22px;
        height: 12px;
        background-image: url('../../assets/images/notice.png');
        background-size: 22px 12px;
        background-repeat: no-repeat;
        opacity: 0.9;
    }
    .notice-wrapper > .notice-text{
        vertical-align: top;
        font-size: 11px;
        margin: 0 6px;
        opacity: 0.9;
    }
    .notice-wrapper > i {
        position: absolute;
        font-size: 10px;
        right: 12px;
        top: 9px;
        opacity: 0.7;
    }
    .background{
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        filter: blur(20px);
        transform: scale(1.2);
    }
    .background img{
        object-fit: cover;
    }
    .detail{
        position: fixed;
        z-index: 100;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background: rgba(7,17,27,0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
    }
    .detail > .detail-wrapper{
        width: 100%;
        min-height: 100%;
    }
    .detail-wrapper > .detail-main{
        padding-top: 64px;
        padding-bottom: 64px;
    }
    .detail-main > img{
        display: block;
        border-radius: 50%;
        margin: 15px auto;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .detail-main > .detail-avatar-fallback{
        width: 90px;
        height: 90px;
        border-radius: 50%;
        margin: 15px auto;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #ff5722, #ff9800);
        color: #fff;
        font-size: 36px;
        font-weight: 700;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .detail-main > .name{
        line-height: 18px;
        text-align: center;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.5px;
    }
    .detail-main > .title{
        display: flex;
        width: 80%;
        margin: 28px auto 24px auto;
    }
    .title>.line{
        flex: 1;
        position: relative;
        top: -6px;
        border-bottom: 1px solid rgba(255,255,255,0.2);
    }
    .title>.text{
        padding: 0 14px;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.5px;
    }
    .detail-main > .text{
        width: 80%;
        margin: 0 auto;
    }
    .detail-main>.text>p{
        padding: 0 12px;
        line-height: 26px;
        font-size: 13px;
        opacity: 0.85;
    }
    .detail > .detail-close{
        position: relative;
        width: 36px;
        height: 36px;
        margin: -64px auto 0 auto;
        clear: both;
        font-size: 32px;
        opacity: 0.8;
    }
    .show{
        display: block;
    }
    .clearfix::after{
        display: inline-block;
        content: '.';
        height: 0;
        line-height: 0;
        clear: both;
        visibility: hidden;
    }
</style>
