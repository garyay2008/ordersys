<template>
    <el-row class="menu-page">
        <el-col :span="24">
            <h5 class="leftLogo">POS 後枱</h5>
            <el-menu
            :default-active="active"
            text-color="#c7d2e0"
            active-text-color="#fff">
                <template v-for="item in items">
                    <router-link v-if="!item.isGroup && !item.openBlank" :to="item.path" :key="item.path">
                        <el-menu-item
                        :index="item.path"
                        >
                            <i :class="item.icon"></i>
                            <span slot="title">{{item.name}}</span>
                        </el-menu-item>
                    </router-link>
                    <a v-else-if="!item.isGroup && item.openBlank" :href="item.path" target="_blank" :key="item.path">
                        <el-menu-item
                        :index="item.path"
                        >
                            <i :class="item.icon"></i>
                            <span slot="title">{{item.name}}</span>
                        </el-menu-item>
                    </a>
                    <el-submenu v-if="item.children" :index="item.path" :key="item.path">
                        <template slot="title">
                            <i :class="item.icon"></i>
                            <span slot="title">{{ item.name }}</span>
                        </template>
                        <router-link v-for="(citem,cindex) in item.children" :to="citem.path" :key="cindex">
                            <el-menu-item :index="citem.path"><span slot="title">{{citem.name}}</span></el-menu-item>
                        </router-link>
                    </el-submenu>
                </template>
            </el-menu>
        </el-col>
    </el-row>
</template>

<script>
export default {
  name: 'leftNav',
  data () {
    return {
      items: [
        {
          icon: 'el-icon-odometer',
          name: '運營統計',
          path: '/admin/home',
          isGroup: false
        },
        // 訂單管理暫時隱藏，日後再啟用
        // { icon: 'el-icon-document', name: '訂單管理', path: '/admin/order', isGroup: false },
        {
          icon: 'el-icon-takeaway-box',
          name: '歷史訂單',
          path: '/admin/history',
          isGroup: false
        },
        {
          icon: 'el-icon-food',
          name: '菜譜管理',
          path: 'menu',
          isGroup: true,
          children: [
            { path: '/admin/category', name: '分類管理' },
            { path: '/admin/commodity', name: '貨品管理' },
            { path: '/admin/combo', name: '套餐管理' },
            { path: '/admin/bundle', name: '撞餐設定' },
            { path: '/admin/bundlegroup', name: '跟餐組別管理' },
            { path: '/admin/maingroup', name: '主菜組別管理' },
            { path: '/admin/matchingrule', name: '撞餐規則' },
            { path: '/admin/modcode', name: '改碼管理' },
            { path: '/admin/department', name: '部門管理' },
            { path: '/admin/jumpprice', name: '貨價跳價錢設定' }
          ]
        },
        {
          icon: 'el-icon-mobile',
          name: 'QR code 管理',
          path: 'qrcode',
          isGroup: true,
          children: [
            { path: '/admin/qrcode', name: '點餐碼管理' },
            { path: '/admin/qrsort', name: 'QR 排序' }
          ]
        },
        {
          icon: 'el-icon-s-marketing',
          name: '電子菜單',
          path: '/admin/emenu',
          isGroup: false
        },
        {
          icon: 'el-icon-tableware',
          name: '桌號管理',
          path: '/admin/table',
          isGroup: false
        },
        {
          icon: 'el-icon-place',
          name: '區域管理',
          path: '/admin/zone',
          isGroup: false
        },
        {
          icon: 'el-icon-user',
          name: '用戶管理',
          path: '/admin/staff',
          isGroup: false
        },
        {
          icon: 'el-icon-monitor',
          name: '收銀機管理',
          path: '/admin/posterminal',
          isGroup: false
        },
        {
          icon: 'el-icon-s-operation',
          name: 'POS 功能設定',
          path: '/admin/possetting',
          isGroup: false
        },
        {
          icon: 'el-icon-s-custom',
          name: '自助點餐機',
          path: '/admin/kiosk',
          isGroup: false
        },
        {
          icon: 'el-icon-service',
          name: '侍應流動點餐',
          path: '/mpos',
          isGroup: false,
          openBlank: true
        },
        {
          icon: 'el-icon-s-order',
          name: '排隊叫號',
          path: '/admin/queue',
          isGroup: false
        },
        {
          icon: 'el-icon-setting',
          name: '系統管理',
          path: 'system',
          isGroup: true,
          children: [
            { path: '/admin/shop', name: '店鋪信息' },
            { path: '/admin/printer', name: '打印機設置' },
            { path: '/admin/printmonitor', name: '列印佇列監控' },
            { path: '/admin/user', name: '個人信息' },
            { path: '/admin/systemmaint', name: '系統維護' },
            { path: '/admin/modifyorder', name: '修改往日單據' }
          ]
        }
      ]
    }
  },
  computed: {
    active () {
      if (location.pathname === '/admin') {
        return '/admin/home'
      }
      return location.pathname
    }
  }
}
</script>

<style scoped>
a{
    text-decoration: none;
}
.leftLogo{
    height: 60px;
    padding: 0;
    margin: 0;
    box-sizing: border-box;
    color: #fff;
    font-size: 24px;
    letter-spacing: 3px;
    text-align: center;
    line-height: 60px;
    background: linear-gradient(135deg, #297fff, #1e6fe0);
    box-shadow: 0 2px 10px rgba(0,0,0,.28);
    font-weight: 700;
}
.menu-page{
    min-height: 100%;
    background: linear-gradient(180deg, #1e3a5f 0%, #102a4a 100%);
    z-index: 99;
}
.el-menu{
    border-right: none;
    background: transparent;
}
/deep/ .el-menu-item,
/deep/ .el-submenu__title{
    height: 48px;
    line-height: 48px;
    transition: all .2s;
}
/deep/ .el-menu-item:hover,
/deep/ .el-submenu__title:hover{
    background: rgba(255,255,255,.08) !important;
}
/deep/ .el-menu-item.is-active{
    background: linear-gradient(90deg, rgba(41,127,255,.38), rgba(41,127,255,.06));
    color: #fff !important;
    border-left: 3px solid #297fff;
    box-sizing: border-box;
}
/deep/ .el-submenu.is-opened > .el-submenu__title{
    background: rgba(0,0,0,.16);
    color: #fff;
}
/deep/ .el-submenu .el-menu{
    background: transparent;
}
/deep/ .el-submenu .el-menu-item{
    background: transparent;
    padding-left: 48px !important;
    color: #d5e2f2;
}
/deep/ .el-submenu .el-menu-item:hover{
    background: rgba(41,127,255,.16) !important;
    color: #fff !important;
}
/deep/ .el-submenu .el-menu-item.is-active{
    background: linear-gradient(90deg, rgba(41,127,255,.28), rgba(41,127,255,.04));
    color: #fff !important;
    border-left: 3px solid #5b9cff;
}
</style>
