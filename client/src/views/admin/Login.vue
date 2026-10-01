<template>
    <div id="login">
        <div class="login-box">
            <p class="login-title">歡迎使用點餐系統</p>
            <el-row>
                <el-col :span="24">
                    <el-form ref="loginForm" :model="loginForm" :rules="rules" label-width="40px">
                        <el-form-item label="帳號" prop="username">
                            <el-input v-model="loginForm.username" placeholder="請輸入帳號"></el-input>
                        </el-form-item>
                        <el-form-item label="密碼" prop="password">
                            <el-input type="password" v-model="loginForm.password" @keyup.enter.native="login('loginForm')" show-password placeholder="請輸入密碼"></el-input>
                        </el-form-item>
                            <el-button type="primary" class="submitBtn" @click="login('loginForm')">登錄</el-button>
                    </el-form>
                </el-col>
            </el-row>
        </div>
    </div>
</template>

<script>
import jwtDecode from 'jwt-decode'
export default {
  name: 'login',
  data () {
    const checkUser = (rule, value, callback) => {
      if (value === '') {
        callback(new Error('用戶名不能為空！'))
      } else {
        callback()
      }
    }
    const checkPass = (rule, value, callback) => {
      if (value === '') {
        callback(new Error('密碼不能為空！'))
      } else {
        callback()
      }
    }
    return {
      loginForm: {
        username: '',
        password: ''
      },
      rules: {
        username: [
          { validator: checkUser, message: '用戶名不能為空！', trigger: 'blur' },
          { min: 6, max: 10, message: '長度在6到10個字符之間！', trigger: 'blur' }
        ],
        password: [
          { validator: checkPass, message: '密碼不能為空！', trigger: 'blur' },
          { min: 6, max: 16, message: '長度在6到16個字符之間！' }
        ]
      }
    }
  },
  methods: {
    login (formName) {
      this.$refs[formName].validate(valid => {
        if (valid) {
          this.$axios.post('/api/users/login', this.loginForm)
            .then(res => {
              const { token } = res.data
              localStorage.setItem('orderTk', token)
              const decoded = jwtDecode(token)
              this.$store.dispatch('changeStat', !this.isEmpty(decoded))
              this.$store.dispatch('setUser', decoded)
              this.$router.push('/admin')
            })
            .catch(err => {
              console.log(err)
            })
        } else {
          return false
        }
      })
    },
    isEmpty (value) {
      return (value === undefined || value === null || (typeof value === 'object' && Object.keys(value).length === 0) || (typeof value === 'string' && value.trim().length === 0))
    }
  }
}
</script>

<style>
  *{
    margin: 0;
    padding: 0;
  }
  #login{
    width: 100%;
    height: 100%;
    background-color: rgb(217, 236, 255);
    background-image: url('../../assets/images/loginBG.svg');
    background-repeat: no-repeat;
    background-position: center 110px;
    background-size: 100%;
    position: relative;
  }
  #login .login-box{
      border-radius: 6px;
      padding: 20px;
      width: 350px;
      background: #fff;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%,-50%);
      box-shadow: 0px 0px 20px rgba(83, 168, 255, 0.3);
  }
  #login .login-title{
      font-size: 20px;
      text-align: center;
      padding: 20px 0px;
  }
  #login .submitBtn{
    width: 200px;
    display: block;
    margin: 0 auto;
    box-shadow: 0px 0px 20px rgba(53, 141, 230, 0.562);
    background: #297fff;
    border-color: #297fff;
  }
  #login .submitBtn:hover{
    background: #5b9cff;
    border-color: #5b9cff;
  }
</style>
