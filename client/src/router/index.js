import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    meta: {
      title: '系統登錄'
    },
    redirect: '/login'
  },
  {
    path: '/init',
    component: () => import('../views/init/Init'),
    meta: {
      title: '系統初始化'
    },
    children: [
      {
        path: '',
        meta: {
          title: '初始化管理員'
        },
        component: () => import('../views/init/Admin')
      },
      {
        path: '/init/admin',
        name: 'RegAdmin',
        component: () => import('../views/init/Admin'),
        meta: {
          title: '初始化管理員'
        }
      },
      {
        path: '/init/shop',
        name: 'SetShop',
        component: () => import('../views/init/Shop'),
        meta: {
          title: '設置店鋪信息'
        }
      },
      {
        path: '/init/complete',
        name: 'Complete',
        component: () => import('../views/init/Complete'),
        meta: {
          title: '初始化完成'
        }
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    meta: {
      title: '系統登錄'
    },
    component: () => import('../views/admin/Login')
  },
  {
    path: '/admin',
    component: () => import('../views/admin/Index'),
    children: [
      {
        path: '',
        meta: {
          title: '首頁'
        },
        component: () => import('../views/admin/Home')
      },
      {
        path: '/admin/home',
        name: 'Home',
        meta: {
          title: '首頁'
        },
        component: () => import('../views/admin/Home')
      },
      {
        path: '/admin/order',
        name: 'Order',
        meta: {
          title: '訂單管理'
        },
        component: () => import('../views/admin/Order')
      },
      {
        path: '/admin/history',
        name: 'History',
        meta: {
          title: '歷史訂單'
        },
        component: () => import('../views/admin/History')
      },
      {
        path: '/admin/category',
        name: 'Category',
        meta: {
          title: '分類管理'
        },
        component: () => import('../views/admin/Category')
      },
      {
        path: '/admin/commodity',
        name: 'Commodity',
        meta: {
          title: '貨品管理'
        },
        component: () => import('../views/admin/Commodity')
      },
      {
        path: '/admin/combo',
        name: 'Combo',
        meta: {
          title: '套餐管理'
        },
        component: () => import('../views/admin/Combo')
      },
      {
        path: '/admin/bundle',
        name: 'Bundle',
        meta: {
          title: '撞餐設定'
        },
        component: () => import('../views/admin/Bundle')
      },
      {
        path: '/admin/bundlegroup',
        name: 'BundleGroup',
        meta: {
          title: '跟餐組別管理'
        },
        component: () => import('../views/admin/BundleGroup')
      },
      {
        path: '/admin/maingroup',
        name: 'MainGroup',
        meta: {
          title: '主菜組別管理'
        },
        component: () => import('../views/admin/MainGroup')
      },
      {
        path: '/admin/matchingrule',
        name: 'MatchingRule',
        meta: {
          title: '撞餐規則'
        },
        component: () => import('../views/admin/MatchingRule')
      },
      {
        path: '/admin/modcode',
        name: 'ModCode',
        meta: {
          title: '改碼管理'
        },
        component: () => import('../views/admin/ModCode')
      },
      {
        path: '/admin/department',
        name: 'Department',
        meta: {
          title: '部門管理'
        },
        component: () => import('../views/admin/Department')
      },
      {
        path: '/admin/jumpprice',
        name: 'JumpPrice',
        meta: {
          title: '貨價跳價錢設定'
        },
        component: () => import('../views/admin/JumpPrice')
      },
      {
        path: '/admin/qrcode',
        name: 'QRcode',
        meta: {
          title: '點餐碼管理'
        },
        component: () => import('../views/admin/QRCode')
      },
      {
        path: '/admin/qrsort',
        name: 'QrSort',
        meta: {
          title: 'QR 排序'
        },
        component: () => import('../views/admin/QrSort')
      },
      {
        path: '/admin/emenu',
        name: 'Emenu',
        meta: {
          title: '電子菜單'
        },
        component: () => import('../views/admin/Emenu')
      },
      {
        path: '/admin/table',
        name: 'Table',
        meta: {
          title: '桌號管理'
        },
        component: () => import('../views/admin/Table')
      },
      {
        path: '/admin/zone',
        name: 'Zone',
        meta: {
          title: '區域管理'
        },
        component: () => import('../views/admin/Zone')
      },
      {
        path: '/admin/staff',
        name: 'Staff',
        meta: {
          title: '用戶管理'
        },
        component: () => import('../views/admin/Staff')
      },
      {
        path: '/admin/posterminal',
        name: 'PosTerminal',
        meta: {
          title: '收銀機管理'
        },
        component: () => import('../views/admin/PosTerminal')
      },
      {
        path: '/admin/possetting',
        name: 'PosSetting',
        meta: {
          title: 'POS 功能設定'
        },
        component: () => import('../views/admin/PosSetting')
      },
      {
        path: '/admin/kiosk',
        name: 'Kiosk',
        meta: {
          title: '自助點餐機設定'
        },
        component: () => import('../views/admin/Kiosk')
      },
      {
        path: '/admin/systemmaint',
        name: 'SystemMaint',
        meta: {
          title: '系統維護'
        },
        component: () => import('../views/admin/SystemMaint')
      },
      {
        path: '/admin/modifyorder',
        name: 'ModifyOrder',
        meta: {
          title: '修改往日單據'
        },
        component: () => import('../views/admin/ModifyOrder')
      },
      {
        path: '/admin/shop',
        name: 'Shop',
        meta: {
          title: '店鋪信息'
        },
        component: () => import('../views/admin/Shop')
      },
      {
        path: '/admin/user',
        name: 'User',
        meta: {
          title: '個人信息'
        },
        component: () => import('../views/admin/User')
      },
      {
        path: '/admin/printer',
        name: 'Printer',
        meta: {
          title: '打印機設置'
        },
        component: () => import('../views/admin/Printer')
      },
      {
        path: '/admin/printmonitor',
        name: 'PrintMonitor',
        meta: {
          title: '列印佇列監控'
        },
        component: () => import('../views/admin/PrintMonitor')
      },
      {
        path: '/admin/queue',
        name: 'Queue',
        meta: {
          title: '排隊叫號'
        },
        component: () => import('../views/admin/Queue')
      },
      {
        path: '/admin/*',
        name: 'AdminNotFount',
        meta: {
          title: '出錯了'
        },
        component: () => import('../views/404')
      }
    ]
  },
  {
    path: '/index/:id',
    name: 'UserShop',
    props: true,
    meta: {
      title: '在線點餐'
    },
    component: () => import('../views/user/Index')
  },
  {
    path: '/emenu/:id',
    name: 'EmenuBoard',
    props: true,
    meta: {
      title: '電子菜單'
    },
    component: () => import('../views/emenu/Index')
  },
  {
    path: '/pos',
    name: 'Pos',
    meta: {
      title: '桌面 POS 點餐'
    },
    component: () => import('../views/pos/Index')
  },
  {
    path: '/mpos',
    name: 'Mpos',
    meta: {
      title: '侍應流動點餐'
    },
    component: () => import('../views/mpos/Index')
  },
  {
    path: '/kiosk',
    name: 'Kiosk',
    meta: {
      title: '自助點餐機'
    },
    component: () => import('../views/kiosk/Index')
  },
  {
    path: '/paykiosk',
    name: 'PayKiosk',
    meta: {
      title: '自助付款機'
    },
    component: () => import('../views/paykiosk/Index')
  },
  {
    path: '/queue',
    name: 'QueueDisplay',
    meta: {
      title: '排隊叫號顯示屏'
    },
    component: () => import('../views/queue/Display')
  },
  {
    path: '/queue/kiosk',
    name: 'QueueKiosk',
    meta: {
      title: '排隊取票機'
    },
    component: () => import('../views/queue/Ticket')
  },
  {
    path: '/*',
    name: 'NotFound',
    meta: {
      title: '出錯了'
    },
    component: () => import('../views/404')
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

function setTitle (to) {
  if (to.meta.title) {
    document.title = to.meta.title
  }
}

// 路由守卫
router.beforeEach((to, from, next) => {
  setTitle(to)
  const isLogin = !!localStorage.getItem('orderTk')
  if (to.path === '/login' || to.path === '/init' || to.path === '/init/admin' || to.path === '/init/shop' || to.path === '/init/complete' || to.path.startsWith('/index/') || to.path.startsWith('/pos') || to.path.startsWith('/mpos') || to.path.startsWith('/emenu/') || to.path.startsWith('/kiosk') || to.path.startsWith('/paykiosk') || to.path.startsWith('/queue')) {
    next()
  } else {
    isLogin ? next() : next('/login')
  }
})

export default router
