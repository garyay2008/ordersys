/*
 * @Author: 0x3E5
 * @Date: 2023-02-27 14:56:02
 * @LastEditTime: 2023-02-27 15:08:02
 * @LastEditors: 0x3E5
 * @Description:
 * @FilePath: \orderSYS\client\vue.config.js
 */
module.exports = {
  publicPath: '/', // 根域上下文目录
  outputDir: 'dist', // 构建输出目录
  assetsDir: 'assets', // 静态资源目录 (js, css, img, fonts)
  pages: {
    index: {
      entry: 'src/main.js',
      template: 'public/index.html',
      filename: 'index.html',
      title: 'OrderSYS'
    },
    login: {
      entry: 'src/login-main.js',
      template: 'public/login.html',
      filename: 'login.html',
      title: '系統登錄'
    }
  },
  lintOnSave: false, // 是否开启eslint保存检测，有效值：ture | false | 'error'
  runtimeCompiler: false, // 运行时版本是否需要编译（.vue SFC 已於建置時預編譯，使用 runtime-only 省下模板編譯器體積）
  productionSourceMap: true, // 是否在构建生产包时生成 sourceMap 文件，false将提高构建速度
  chainWebpack: config => {
    // MPA 多入口：僅由「index 與 login 兩個入口共同使用」的 node_modules 才進 chunk-vendors，
    // 讓 login 頁不必載入主入口專屬的完整 element-ui（50 個元件），大幅縮小登入頁首屏體積。
    config.optimization.splitChunks({
      cacheGroups: {
        defaultVendors: {
          name: 'chunk-vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: 'initial',
          minChunks: 2
        },
        common: {
          name: 'chunk-common',
          minChunks: 2,
          priority: -20,
          chunks: 'initial',
          reuseExistingChunk: true
        }
      }
    })
  },
  parallel: require('os').cpus().length > 1, // 构建时开启多进程处理babel编译
  pluginOptions: { // 第三方插件配置
  },
  pwa: { // 单页插件相关配置 https://github.com/vuejs/vue-cli/tree/dev/packages/%40vue/cli-plugin-pwa
  },
  devServer: {
    open: true,
    host: '0.0.0.0',
    port: 8080,
    https: false,
    allowedHosts: 'all',
    historyApiFallback: true,
    proxy: { // 配置跨域
      '/api': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      },
      '/goods': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/shop': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  transpileDependencies: [
    'vue-echarts',
    'resize-detector'
  ]
}
