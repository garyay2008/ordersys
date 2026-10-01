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
          <el-form-item label="店鋪圖片">
            <el-upload
              class="logo-uploader"
              :action="uploadUrl"
              :show-file-list="false"
              :on-success="handleImgSuccess"
              :before-upload="beforeImgUpload">
              <img v-if="form.shopImg" :src="form.shopImg" class="logo">
              <i v-else class="el-icon-plus logo-uploader-icon"></i>
              <div slot="tip" class="el-upload__tip">(只能上傳jpg文件，且不超過2MB)</div>
            </el-upload>
          </el-form-item>
          <el-form-item label="店鋪名稱" prop="shopName">
            <el-input v-model="form.shopName" placeholder="請輸入店鋪名稱！"></el-input>
          </el-form-item>
          <el-form-item label="店鋪簡介" prop="shopIntro">
            <el-input type="textarea" v-model="form.shopIntro" placeholder="請輸入店鋪簡介！"></el-input>
          </el-form-item>
          <el-form-item label="店鋪公告" prop="shopNotice">
            <el-input type="textarea" v-model="form.shopNotice" placeholder="請輸入店鋪公告！"></el-input>
          </el-form-item>
            <el-button
              type="primary"
              class="submitBtn"
              @click="submitForm('form')"
            >下一步</el-button>
        </el-form>
      </el-col>
    </el-row>

  </div>
</template>

<script>
export default {
  name: 'shop',
  data () {
    return {
      uploadUrl: '/api/shop/upload',
      form: {
        shopImg: '',
        shopName: '',
        shopIntro: '',
        shopNotice: ''
      },
      rules: {
        shopName: [
          { required: true, message: '店鋪名稱不能為空！', trigger: 'blur' },
          { min: 2, max: 18, message: '長度在2到18個字符之間！', trigger: 'blur' }
        ],
        shopIntro: [
          { required: true, message: '店鋪簡介不能為空！', trigger: 'blur' },
          { min: 10, message: '店鋪簡介最少為10個字符！', trigger: 'blur' }
        ],
        shopNotice: [
          { required: true, message: '店鋪公告不能為空！', trigger: 'blur' },
          { min: 10, message: '店鋪公告最少為10個字符！', trigger: 'blur' }
        ]
      }
    }
  },
  methods: {
    submitForm (formName) {
      if (!this.form.shopImg) {
        this.$message({ type: 'error', message: '店鋪圖片上傳失敗請重試' })
        return
      }
      this.$refs[formName].validate(valid => {
        if (valid) {
          this.$axios.post('/api/shop/create', this.form)
            .then(res => {
              this.$message({
                message: '店鋪信息初始化成功',
                type: 'success'
              })
              this.$axios.post('/api/init/setStat', { shop: true })
              this.$emit('changeStatus', 2)
              this.$router.push('/init/complete')
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
    },
    handleImgSuccess (res, file) {
      if (res.status === 'ok') {
        this.form.shopImg = res.url
      }
    },
    beforeImgUpload (file) {
      const isJPG = file.type === 'image/jpeg'
      const isLt2M = file.size / 1024 / 1024 < 2

      if (!isJPG) {
        this.$message.error('上傳圖片只能是 JPG 格式!')
      }
      if (!isLt2M) {
        this.$message.error('上傳圖片大小不能超過 2MB!')
      }
      return isJPG && isLt2M
    }
  },
  created () {
    this.$emit('changeStatus', 1)
    this.$axios.get('/api/init/getStat')
      .then(result => {
        const status = result.data
        if (!status.admin) {
          this.$emit('changeStatus', 0)
          this.$router.push('/init/admin')
        } else if (status.shop) {
          this.$emit('changeStatus', 3)
          this.$router.push('/init/complete')
        }
      })
      .catch(err => {
        console.log(err)
      })
  }
}
</script>

<style scoped>
.logo-uploader .el-upload {
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.logo-uploader .el-upload:hover {
  border-color: #409EFF;
}
.logo-uploader-icon {
  margin-top: 1px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  font-size: 28px;
  color: #8c939d;
  width: 100px;
  height: 100px;
  line-height: 100px;
  text-align: center;
}
.logo-uploader-icon:hover{
  border-color: #409EFF;
}
.logo {
  width: 100px;
  height: 100px;
  display: block;
}
.submitBtn{
    width: 200px;
    display: block;
    margin: 0 auto;
}
</style>
