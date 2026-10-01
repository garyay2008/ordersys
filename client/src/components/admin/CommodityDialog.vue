<template>
    <div id="category-dialog">
        <el-dialog :title="dialog.title" :visible.sync="dialog.show" width="30%">
        <el-form ref="form" :model="form" :rules="form_rules">
            <el-form-item label="貨品圖片" :label-width="formLabelWidth">
                <el-upload
                class="commodity-uploader"
                action=""
                :show-file-list="false"
                :http-request="uploadSectionFile"
                :before-upload="beforeImgUpload">
                    <img v-if="form.img" :src="form.img" class="commodity">
                    <i v-else class="el-icon-plus commodity-uploader-icon"></i>
                    <div slot="tip" class="el-upload__tip">(只能上傳jpg文件，且不超過2MB)</div>
                </el-upload>
            </el-form-item>
            <el-form-item label="貨品名稱" prop="name" :label-width="formLabelWidth">
                <el-input v-model="form.name" autocomplete="off" placeholder="請輸入貨品名稱"></el-input>
            </el-form-item>
            <el-form-item label="列印名稱" :label-width="formLabelWidth">
                <el-input v-model="form.name2" autocomplete="off" placeholder="出品部(廚房)顯示名稱，留空則用貨品名稱"></el-input>
            </el-form-item>
            <el-form-item label="PLU 碼" :label-width="formLabelWidth">
                <el-input v-model="form.plu" autocomplete="off" placeholder="貨品編碼，如 A1 / 101（快速點單用）"></el-input>
            </el-form-item>
            <el-form-item label="貨品編號" :label-width="formLabelWidth">
                <el-input v-model="form.code" autocomplete="off" placeholder="唯一編號，如 SKU001"></el-input>
            </el-form-item>
            <el-form-item label="貨品描述" prop="describe" :label-width="formLabelWidth">
                <el-input type="textarea" maxlength="200" :autosize="{ minRows: 4, maxRows: 4 }" show-word-limit v-model.number="form.describe" autocomplete="off" placeholder="請輸入貨品描述"></el-input>
            </el-form-item>
            <el-form-item label="貨品分類" prop="category" :label-width="formLabelWidth">
                <el-select v-model="form.category" placeholder="請選擇" @change="onCategoryChange">
                    <el-option
                    v-for="item in categoryList"
                    :key="item._id"
                    :label="item.cName"
                    :value="item.cName">
                    </el-option>
                </el-select>
            </el-form-item>

            <el-form-item label="價格1" prop="price" :label-width="formLabelWidth">
                <div style="display: flex; align-items: center; gap: 8px; width: 100%;">
                    <el-input type="number" v-model="form.price" autocomplete="off" placeholder="請輸入價格1" style="flex: 1;"></el-input>
                    <el-button size="mini" type="success" plain @click="fillAll">填滿</el-button>
                </div>
            </el-form-item>
            <el-form-item v-for="n in 9" :key="n" :label="'價格' + (n + 1)" :label-width="formLabelWidth">
                <el-input type="number" v-model.number="form.specs[n].price" autocomplete="off" placeholder="留空則按價格1"></el-input>
            </el-form-item>
            <el-form-item label="浮動價格" :label-width="formLabelWidth">
                <el-switch v-model="form.openPrice" active-color="#13ce66" inactive-color="#ff4949"></el-switch>
                <span class="channel-tip">開啟後 POS 點選會彈出「品名＋金額」輸入（手寫單）</span>
            </el-form-item>
            <el-form-item label="貨品打折"  v-model="form.isDiscount" :label-width="formLabelWidth">
                <el-switch
                v-model="form.isDiscount"
                active-color="#13ce66"
                inactive-color="#ff4949">
                </el-switch>
            </el-form-item>
            <el-form-item label="折前價格" prop="onSale" :label-width="formLabelWidth">
                <el-input type="number" v-model="form.onSale" autocomplete="off" placeholder="請輸入折前價格"></el-input>
            </el-form-item>
            <el-form-item label="貨品售罄"  v-model="form.soldOut" :label-width="formLabelWidth">
                <el-switch
                v-model="form.soldOut"
                active-color="#13ce66"
                inactive-color="#ff4949">
                </el-switch>
            </el-form-item>
            <el-form-item label="必選項目" :label-width="formLabelWidth">
                <el-switch
                v-model="form.mandatory"
                active-color="#13ce66"
                inactive-color="#ff4949">
                </el-switch>
                <span class="channel-tip">開啟後此貨品為茶芥必選，結帳／印單需在單內</span>
            </el-form-item>
            <el-form-item label="POS 顯示" :label-width="formLabelWidth">
                <el-switch v-model="form.showOnPos" active-color="#13ce66" inactive-color="#ff4949"></el-switch>
                <span class="channel-tip">關閉後收銀版面不顯示（員工餐/私房菜專用）</span>
            </el-form-item>
            <el-form-item label="QR 顯示" :label-width="formLabelWidth">
                <el-switch v-model="form.showOnQr" active-color="#13ce66" inactive-color="#ff4949"></el-switch>
                <span class="channel-tip">關閉後客人手機不顯示（時價海鮮防亂點）</span>
            </el-form-item>
            <el-form-item label="打印機隊列" :label-width="formLabelWidth">
                <el-select v-model="form.stations" placeholder="選擇打印機隊列(最多3個)" multiple :multiple-limit="3" clearable style="width: 100%;">
                    <el-option v-for="s in stations" :key="s.name" :label="s.label" :value="s.name"></el-option>
                </el-select>
            </el-form-item>
            <el-form-item label="改碼類別" :label-width="formLabelWidth">
                <el-select v-model="form.modCategories" placeholder="選擇改碼類別(可多選)" multiple clearable style="width: 100%;">
                    <el-option v-for="c in modCategoryObjs" :key="c.name" :label="(c.code ? c.code + ' ' : '') + c.name" :value="c.name"></el-option>
                </el-select>
            </el-form-item>
            <el-form-item label="部門" :label-width="formLabelWidth">
                <el-select v-model="form.department" placeholder="選擇部門" clearable style="width: 100%;">
                    <el-option v-for="d in departments" :key="d.name" :label="(d.code ? d.code + ' ' : '') + d.name" :value="d.name"></el-option>
                </el-select>
            </el-form-item>
            <el-form-item label="跟餐組別" :label-width="formLabelWidth">
                <el-select v-model="form.bundleGroupId" placeholder="選擇跟餐組別（留空 = 不跟餐）" clearable style="width: 100%;">
                    <el-option v-for="g in bundleGroups" :key="g._id" :label="g.name + ' ($' + (Number(g.price) || 0) + ')'" :value="g._id"></el-option>
                </el-select>
                <span class="channel-tip">撞餐規則配到此貨品時，用該組別的跟餐價</span>
            </el-form-item>
        </el-form>
        <div slot="footer" class="dialog-footer">
            <el-button class="cancel-shadow" @click="dialog.show = false">取 消</el-button>
            <el-button type="primary" class="btn-shadow" @click="submitForm('form')">確 定</el-button>
        </div>
        </el-dialog>
    </div>
</template>

<script>
export default {
  name: 'categoryDialog',
  props: { dialog: Object, form: Object, categoryList: Array },
  data () {
    return {
      uploadUrl: '/api/commodity/upload',
      formLabelWidth: '80px',
      stations: [],
      modCategories: [],
      modCategoryObjs: [],
      departments: [],
      bundleGroups: [],
      form_rules: {
        name: [
          { required: true, message: '貨品名稱不能為空！', trigger: 'blur' }
        ],
        category: [
          { required: true, message: '分類不能為空', trigger: 'blur' }
        ],
        price: [
          { required: true, message: '貨品價格不能為空', trigger: 'blur' }
        ]
      }
    }
  },
  methods: {
    onCategoryChange (val) {
      const cat = this.categoryList.find(c => c.cName === val)
      this.form.categoryId = cat ? cat._id : ''
    },
    loadStations () {
      this.$axios.get('/api/printer/get')
        .then(res => {
          const d = res.data || {}
          const printers = d.printers || []
          const list = printers
            .filter(p => p.role === 'kitchen' || p.role === 'bar' || !p.role)
            .filter(p => p.name && p.name.trim() !== '')
            .map(p => ({ name: p.name, ip: p.ip || '', label: p.ip ? `${p.name} (${p.ip})` : p.name }))
          this.stations = list.length
            ? list
            : ['冷盤', '熱炒', '點心', '燉湯', '水吧', '主食'].map(n => ({ name: n, ip: '', label: n }))
        })
        .catch(() => {
          this.stations = ['冷盤', '熱炒', '點心', '燉湯', '水吧', '主食'].map(n => ({ name: n, ip: '', label: n }))
        })
    },
    loadModCategories () {
      this.$axios.get('/api/modcode/categories')
        .then(res => {
          this.modCategoryObjs = (res.data || [])
          this.modCategories = this.modCategoryObjs.map(c => c.name)
        })
        .catch(() => { this.modCategories = []; this.modCategoryObjs = [] })
    },
    loadDepartments () {
      this.$axios.get('/api/department/list')
        .then(res => { this.departments = res.data || [] })
        .catch(() => { this.departments = [] })
    },
    loadBundleGroups () {
      this.$axios.get('/api/bundlegroup/list')
        .then(res => { this.bundleGroups = (res.data || []).filter(g => g.active !== false) })
        .catch(() => { this.bundleGroups = [] })
    },
    normalizeSpecs () {
      const arr = []
      const p1 = (this.form.price === '' || this.form.price == null) ? '' : Number(this.form.price)
      for (let i = 0; i < 10; i++) {
        const prev = (this.form.specs && this.form.specs[i]) ? this.form.specs[i] : {}
        const raw = i === 0 ? p1 : prev.price
        arr.push({
          name: '價格' + (i + 1),
          price: (raw === '' || raw == null) ? '' : Number(raw)
        })
      }
      return arr
    },
    fillAll () {
      const p1 = this.form.price
      if (p1 === '' || p1 == null) {
        this.$message({ type: 'warning', message: '請先填寫價格1' })
        return
      }
      const specs = Array.isArray(this.form.specs) ? this.form.specs.slice(0, 10) : []
      while (specs.length < 10) specs.push({ name: '價格' + (specs.length + 1), price: '' })
      for (let i = 1; i < 10; i++) {
        specs[i] = { name: '價格' + (i + 1), price: Number(p1) }
      }
      this.form.specs = specs
      this.$message({ type: 'success', message: '已填滿價格2～10' })
    },
    submitForm (formName) {
      // 貨品圖片為選填：未上傳仍可保存
      // 折前價格可為空：空值統一歸 0
      const onSale = Number(this.form.onSale)
      this.form.onSale = isNaN(onSale) ? 0 : onSale
      // 主價格轉數字
      const p1 = (this.form.price === '' || this.form.price == null) ? 0 : Number(this.form.price)
      this.form.price = isNaN(p1) ? 0 : p1
      // 固定 10 筆價格（價格1～價格10），價格1＝主價格，空值存 ''
      this.form.specs = this.normalizeSpecs()
      // 多打印機隊列：確保數組 + 兼容單值 station
      if (!this.form.stations) this.form.stations = []
      this.form.stations = this.form.stations.filter(s => s && s.trim() !== '')
      this.form.station = this.form.stations.length ? this.form.stations[0] : ''
      // 渠道開關：舊資料缺欄位時預設兩邊都顯示
      if (this.form.showOnPos === undefined) this.form.showOnPos = true
      if (this.form.showOnQr === undefined) this.form.showOnQr = true
      this.$refs[formName].validate(valid => {
        if (valid) {
          const url = this.dialog.option === 'add' ? '/add' : '/edit'
          this.$axios.post('/api/commodity' + url, this.form)
            .then(res => {
              this.$message({
                type: 'success',
                message: res.data
              })
              this.dialog.show = false
              this.$emit('update')
            })
        }
      })
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
    },
    uploadSectionFile (params) {
      const file = params.file
      const form = new FormData()
      form.append('file', file)
      this.$axios.post('/api/commodity/upload', form, {
        headers: { 'content-type': 'multipart/form-data' }
      })
        .then(res => {
          if (res.data.status === 'ok') {
            this.form.img = res.data.url
          } else {
            this.$message({
              type: 'error',
              message: '圖片上傳失敗，請重試！'
            })
          }
        })
        .catch(err => {
          console.log(err)
          this.$message({
            type: 'error',
            message: '圖片上傳失敗，請重試！'
          })
        })
    }
  },
  mounted () {
    this.loadStations()
    this.loadModCategories()
    this.loadDepartments()
    this.loadBundleGroups()
  }
}
</script>

<style scoped>
.commodity-uploader{
    padding: 10px;
}
.commodity-uploader .el-upload {
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.commodity-uploader .el-upload:hover {
  border-color: #409EFF;
}
.commodity-uploader-icon {
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
.commodity-uploader-icon:hover{
  border-color: #409EFF;
}
.commodity {
  width: 100px;
  height: 100px;
  display: block;
}
.cancel-shadow{
    box-shadow: 0px 0px 20px rgba(85, 86, 99, 0.262);
}
.btn-shadow{
    box-shadow: 0px 0px 20px rgba(53, 141, 230, 0.562);
}
.channel-tip{
    margin-left: 10px;
    color: #909399;
    font-size: 12px;
}
.spec-name{
    display: inline-block;
    width: 60px;
    color: #606266;
    font-size: 13px;
    vertical-align: middle;
}
</style>
