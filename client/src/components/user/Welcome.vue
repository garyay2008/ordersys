<template>
    <div class="welcome">
        <div class="welcome-bg">
            <img v-if="welcomeImage" class="welcome-bg-img" :src="welcomeImage" alt="">
            <div v-if="welcomeImage" class="welcome-bg-overlay"></div>
        </div>
        <div class="welcome-content">
            <div class="welcome-avatar">
                <img v-if="shopInfo.shopImg" :src="shopInfo.shopImg" alt="">
                <div v-else class="welcome-avatar-fallback">{{ shopInitial }}</div>
            </div>
            <h1 class="welcome-name">{{ shopInfo.shopName || '歡迎光臨' }}</h1>
            <p class="welcome-intro">{{ shopInfo.shopIntro }}</p>
            <div class="welcome-notice" v-if="shopInfo.shopNotice">
                <span class="welcome-notice-label">公告</span>
                <span class="welcome-notice-text">{{ shopInfo.shopNotice }}</span>
            </div>
            <el-button class="welcome-start" type="primary" round @click="$emit('start')">開始點餐</el-button>
        </div>
    </div>
</template>

<script>
export default {
  name: 'userWelcome',
  data () {
    return {
      welcomeImage: '',
      shopInfo: {
        shopName: '',
        shopIntro: '',
        shopNotice: '',
        shopImg: ''
      }
    }
  },
  computed: {
    shopInitial () {
      return (this.shopInfo.shopName || '店').charAt(0)
    }
  },
  created () {
    this.$axios.get('/api/shop/get')
      .then(res => {
        this.shopInfo = res.data || this.shopInfo
      })
      .catch(() => {})
    this.$axios.get('/api/qrsetting/get')
      .then(res => {
        this.welcomeImage = (res.data && res.data.welcomeImage) || ''
      })
      .catch(() => {})
  }
}
</script>

<style scoped>
.welcome{
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    color: #fff;
    z-index: 10;
}
.welcome-bg{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--primary), var(--primary2));
}
.welcome-bg-img{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}
.welcome-bg-overlay{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.35);
}
.welcome-bg::after{
    content: '';
    position: absolute;
    top: -30%;
    right: -20%;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
}
.welcome-bg::before{
    content: '';
    position: absolute;
    bottom: -15%;
    left: -18%;
    width: 260px;
    height: 260px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.10);
}
.welcome-content{
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    box-sizing: border-box;
    text-align: center;
}
.welcome-avatar{
    width: 108px;
    height: 108px;
    border-radius: 24px;
    overflow: hidden;
    margin-bottom: 22px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    background: rgba(255, 255, 255, 0.18);
    flex-shrink: 0;
}
.welcome-avatar img{
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.welcome-avatar-fallback{
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 44px;
    font-weight: 700;
    background: linear-gradient(135deg, var(--primary), var(--primary2));
}
.welcome-name{
    margin: 0 0 10px 0;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 1px;
}
.welcome-intro{
    margin: 0 0 18px 0;
    max-width: 280px;
    font-size: 13px;
    line-height: 1.6;
    opacity: 0.9;
}
.welcome-notice{
    display: inline-flex;
    align-items: center;
    max-width: 300px;
    margin-bottom: 30px;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.16);
    border: 1px solid rgba(255, 255, 255, 0.25);
    font-size: 12px;
    line-height: 1.5;
    text-align: left;
}
.welcome-notice-label{
    flex-shrink: 0;
    margin-right: 8px;
    padding: 1px 8px;
    border-radius: 999px;
    background: #fff;
    color: var(--primary);
    font-weight: 700;
    font-size: 11px;
}
.welcome-notice-text{
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}
.welcome-start{
    width: 220px;
    height: 50px;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 2px;
    border: none;
    background: #fff;
    color: var(--primary);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
}
.welcome-start:hover,
.welcome-start:focus{
    background: #fff;
    color: var(--primary);
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.22);
}
</style>
