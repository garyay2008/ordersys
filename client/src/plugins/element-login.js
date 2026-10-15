// 登入頁專用的極簡 Element UI 註冊：只載入登入表單需要的元件，
// 避免把整個 element-ui 塞進登入頁 bundle。
import Vue from 'vue'
import {
  Button,
  Col,
  Form,
  FormItem,
  Input,
  Row,
  Message
} from 'element-ui'

const components = [Button, Col, Form, FormItem, Input, Row]

components.forEach(component => {
  Vue.use(component)
})

Vue.prototype.$message = Message
