<template>
  <div>
    <el-row>
      <el-col :span="24">
        <el-form
          ref="form"
          :model="form"
          label-width="80px"
          :rules="rules"
        >
          <el-form-item label="用 戶 名  " prop="username">
            <el-input v-model="form.username" placeholder="請輸入用戶名！"></el-input>
          </el-form-item>
          <el-form-item label="電子郵箱" prop="email">
            <el-input type="email" v-model="form.email" placeholder="請輸入電子郵箱！"></el-input>
          </el-form-item>
          <el-form-item label="登錄密碼" prop="password">
            <el-input type="password" v-model="form.password" placeholder="請輸入密碼！"></el-input>
          </el-form-item>
          <el-form-item label="重複密碼" prop="password2">
            <el-input type="password" v-model="form.password2" placeholder="請輸入重複密碼！"></el-input>
          </el-form-item>
            <el-button
              type="primary"
              @click="submitForm('form')"
              class="submitBtn"
            >下一步</el-button>
        </el-form>
      </el-col>
    </el-row>

  </div>
</template>

<script>
export default {
  name: 'admin',
  data () {
    const validatePass2 = (rule, value, callback) => {
      if (value !== this.form.password) {
        callback(new Error('兩次輸入密碼不一致！'))
      } else {
        callback()
      }
    }
    return {
      form: {
        username: '',
        email: '',
        password: '',
        password2: ''
      },
      rules: {
        username: [
          { required: true, message: '用戶名不能為空！', trigger: 'blur' },
          { min: 6, max: 10, message: '長度在6到10個字符之間！', trigger: 'blur' }
        ],
        email: [
          { type: 'email', required: true, message: '郵箱格式不正確', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '密碼不能為空！', trigger: 'blur' },
          { min: 6, max: 16, message: '長度在6到16之間！', trigger: 'blur' }
        ],
        password2: [
          { required: true, message: '確認密碼不能為空！', trigger: 'blur' },
          { min: 6, max: 16, message: '長度在6到16之間！', trigger: 'blur' },
          { validator: validatePass2, trigger: 'blur' }
        ]
      }
    }
  },
  methods: {
    submitForm (formName) {
      this.$refs[formName].validate(valid => {
        if (valid) {
          this.$axios.post('/api/users/init', this.form)
            .then(res => {
              this.$message({
                message: '管理員初始化成功',
                type: 'success'
              })
              this.$axios.post('/api/init/setStat', { admin: true })
              this.$emit('changeStatus')
              this.$router.push('/init/shop')
            })
            .catch(err => {
              console.log(err)
            })
        } else {
          this.$message({
            type: 'error',
            message: '填寫信息有誤請重新輸入！'
          })
          return false
        }
      })
    }
  },
  created () {
    this.$emit('changeStatus', 0)
    this.$axios.get('/api/init/getStat')
      .then(result => {
        const status = result.data
        if (status.admin) {
          this.$emit('changeStatus', 1)
          this.$router.push('/init/shop')
        }
      })
      .catch(err => {
        console.log(err)
      })
  }
}
</script>

<style scoped>
.submitBtn{
    width: 200px;
    display: block;
    margin: 0 auto;
}
</style>
