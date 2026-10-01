<template>
    <div id="category-dialog">
        <el-dialog :title="dialog.title" :visible.sync="dialog.show" width="55%" :before-close="handleClose">
        <el-tabs v-model="activeTab">
            <el-tab-pane label="分類設定" name="settings">
                <el-form ref="form" :model="form" :rules="form_rules">
                    <el-form-item label="分類名稱" prop="cName" :label-width="formLabelWidth">
                        <el-input v-model="form.cName" autocomplete="off" placeholder="請輸入分類名稱！"></el-input>
                    </el-form-item>
                    <el-form-item label="適用單別" prop="serviceModes" :label-width="formLabelWidth">
                        <el-checkbox-group v-model="form.serviceModes">
                            <el-checkbox v-for="mode in serviceModes" :key="mode" :label="mode"></el-checkbox>
                        </el-checkbox-group>
                    </el-form-item>
                    <el-form-item label="渠道開關" :label-width="formLabelWidth">
                        <el-checkbox-group v-model="form.channels">
                            <el-checkbox label="pos">POS 收銀</el-checkbox>
                            <el-checkbox label="qr">QR 手機</el-checkbox>
                        </el-checkbox-group>
                        <div class="channel-tip">整類不顯示於該渠道（如自助用品類只開 QR）</div>
                    </el-form-item>
                    <el-form-item label="漸變色" :label-width="formLabelWidth">
                        <div class="color-row">
                            <div class="color-item">
                                <label class="color-label">起始色</label>
                                <el-color-picker v-model="form.colorFrom" :predefine="presetColors" show-alpha></el-color-picker>
                                <span class="color-val">{{ form.colorFrom || '無' }}</span>
                            </div>
                            <div class="color-item">
                                <label class="color-label">結束色</label>
                                <el-color-picker v-model="form.colorTo" :predefine="presetColors" show-alpha></el-color-picker>
                                <span class="color-val">{{ form.colorTo || '無' }}</span>
                            </div>
                            <div class="color-item">
                                <label class="color-label">文字色</label>
                                <el-color-picker v-model="form.textColor" :predefine="presetTextColors" show-alpha></el-color-picker>
                                <span class="color-val">{{ form.textColor || '#ffffff' }}</span>
                            </div>
                        </div>
                        <div class="color-preview" v-if="form.colorFrom && form.colorTo" :style="colorPreviewStyle">
                            預覽文字
                        </div>
                        <div class="channel-tip">設定後，POS 點餐版面的分類 Tab 將顯示漸變色效果（兩色都填才生效）</div>
                    </el-form-item>
                    <el-form-item label="時段設定" :label-width="formLabelWidth">
                        <div style="width: 100%;">
                            <div v-for="(slot, index) in form.slots" :key="index" style="margin-bottom: 6px;">
                                <el-input v-model="slot.name" placeholder="時段名，如 下午茶" style="width: 26%;"></el-input>
                                <el-input v-model="slot.start" placeholder="開始 HH:mm" style="width: 24%; margin-left: 4px;"></el-input>
                                <el-input v-model="slot.end" placeholder="結束 HH:mm" style="width: 24%; margin-left: 4px;"></el-input>
                                <el-button type="danger" icon="el-icon-delete" size="mini" @click="removeSlot(index)" style="margin-left: 4px;"></el-button>
                            </div>
                            <el-button size="mini" type="primary" plain @click="addSlot">+ 添加時段</el-button>
                            <div class="channel-tip">到達時段時，此分類自動排到點餐版面最前（午市 / 下午茶自動換版）</div>
                        </div>
                    </el-form-item>
                </el-form>
            </el-tab-pane>
            <el-tab-pane v-if="dialog.option === 'edit'" label="分類貨品" name="commodities">
                <div class="section-header">
                    <span class="section-title">拖曳排序 / 加減貨品</span>
                    <el-button size="mini" type="primary" plain @click="openAddPicker">+ 添加貨品</el-button>
                </div>
                <div v-if="!categoryCommodities.length" class="empty-tip">此分類暫無貨品，點擊上方按鈕添加</div>
                <div v-else class="commodity-list">
                    <div v-for="(item, index) in categoryCommodities" :key="item._id"
                         class="commodity-item"
                         draggable="true"
                         @dragstart="onDragStart($event, index)"
                         @dragover.prevent="onDragOver($event, index)"
                         @dragend="onDragEnd"
                         :class="{ 'drag-over': dragOverIndex === index }">
                        <span class="item-index">{{ index + 1 }}</span>
                        <img :src="item.img" class="item-img" v-if="item.img">
                        <div class="item-info">
                            <span class="item-name">{{ item.name }}</span>
                            <span class="item-price">$ {{ item.price }}</span>
                        </div>
                        <div class="item-actions">
                            <el-button type="text" size="mini" :disabled="index === 0" @click="moveUp(index)">
                                <i class="el-icon-top"></i>
                            </el-button>
                            <el-button type="text" size="mini" :disabled="index === categoryCommodities.length - 1" @click="moveDown(index)">
                                <i class="el-icon-bottom"></i>
                            </el-button>
                            <el-button type="text" size="mini" class="remove-btn" @click="removeCommodity(index, item)">
                                <i class="el-icon-close"></i>
                            </el-button>
                        </div>
                    </div>
                </div>
            </el-tab-pane>
        </el-tabs>

        <div slot="footer" class="dialog-footer">
            <el-button class="cancel-shadow" @click="handleClose">取 消</el-button>
            <el-button type="primary" class="btn-shadow" @click="submitForm('form')">確 定</el-button>
        </div>
        </el-dialog>

        <el-dialog title="添加貨品到分類" :visible.sync="pickerVisible" width="45%" append-to-body>
            <el-input v-model="pickerSearch" placeholder="搜尋貨品名稱或編號" size="small" prefix-icon="el-icon-search" clearable style="margin-bottom: 10px;"></el-input>
            <div class="picker-list" v-if="filteredPickerList.length">
                <div v-for="item in filteredPickerList" :key="item._id" class="picker-item" @click="addCommodityToCategory(item)">
                    <img :src="item.img" class="picker-img" v-if="item.img">
                    <div class="picker-info">
                        <span class="picker-name">{{ item.name }}</span>
                        <span class="picker-cat">{{ item.category }}</span>
                    </div>
                    <span class="picker-price">$ {{ item.price }}</span>
                </div>
            </div>
            <div v-else class="empty-tip">無可用貨品</div>
        </el-dialog>
    </div>
</template>

<script>
export default {
  name: 'categoryDialog',
  props: { dialog: Object, form: Object },
  data () {
    return {
      formLabelWidth: '80px',
      activeTab: 'settings',
      serviceModes: ['堂食', '外賣', '自取'],
      categoryCommodities: [],
      allCommodities: [],
      pickerVisible: false,
      pickerSearch: '',
      dragIndex: -1,
      dragOverIndex: -1,
      presetColors: ['#1f2d3d', '#254f7d', '#6a73c8', '#8d94d0', '#5b8fd6', '#4a7cc4', '#43a978', '#359263', '#e08a4e', '#d07440', '#e74c3c', '#27ae60', '#2980b9', '#8e44ad', '#f39c12', '#1abc9c'],
      presetTextColors: ['#ffffff', '#1f2937', '#f01414', '#2563eb', '#e6a23c', '#333333'],
      form_rules: {
        cName: [
          { required: true, message: '分類名稱不能為空！', trigger: 'blur' }
        ],
        serviceModes: [
          { validator: (rule, value, callback) => value && value.length ? callback() : callback(new Error('至少保留一個適用單別')), trigger: 'change' }
        ]
      }
    }
  },
  computed: {
    colorPreviewStyle () {
      if (!this.form.colorFrom || !this.form.colorTo) return {}
      return {
        background: `linear-gradient(135deg, ${this.form.colorFrom}, ${this.form.colorTo})`,
        color: this.form.textColor || '#ffffff',
        padding: '12px 20px',
        borderRadius: '12px',
        marginTop: '8px',
        textAlign: 'center',
        fontWeight: '700',
        fontSize: '14px',
        boxShadow: '0 3px 12px rgba(0,0,0,.15)'
      }
    },
    filteredPickerList () {
      const existIds = this.categoryCommodities.map(c => String(c._id))
      const keyword = this.pickerSearch.trim().toLowerCase()
      return this.allCommodities.filter(c => {
        if (existIds.includes(String(c._id))) return false
        if (keyword) {
          return (c.name && c.name.toLowerCase().includes(keyword)) ||
                 (c.plu && c.plu.toLowerCase().includes(keyword)) ||
                 (c.code && c.code.toLowerCase().includes(keyword))
        }
        return true
      })
    }
  },
  watch: {
    'dialog.show' (val) {
      if (val && this.dialog.option === 'edit' && this.form._id) {
        this.loadCategoryCommodities()
        this.loadAllCommodities()
      } else if (!val) {
        this.activeTab = 'settings'
        this.categoryCommodities = []
        this.allCommodities = []
        this.pickerVisible = false
        this.pickerSearch = ''
      }
    }
  },
  methods: {
    handleClose () {
      this.dialog.show = false
    },
    addSlot () {
      if (!this.form.slots) this.$set(this.form, 'slots', [])
      this.form.slots.push({ name: '', start: '', end: '' })
    },
    removeSlot (index) {
      if (this.form.slots) this.form.slots.splice(index, 1)
    },
    loadCategoryCommodities () {
      this.$axios.get(`/api/category/${this.form._id}/commodities`)
        .then(res => { this.categoryCommodities = res.data || [] })
        .catch(() => { this.categoryCommodities = [] })
    },
    loadAllCommodities () {
      this.$axios.post('/api/commodity/get', { index: 1, size: 9999, name: '' })
        .then(res => { this.allCommodities = (res.data && res.data.result) || [] })
        .catch(() => { this.allCommodities = [] })
    },
    openAddPicker () {
      this.pickerSearch = ''
      this.pickerVisible = true
    },
    addCommodityToCategory (item) {
      this.$axios.post(`/api/category/${this.form._id}/addCommodity`, { commodityId: item._id })
        .then(() => {
          this.$message.success(`已將「${item.name}」加入分類`)
          this.loadCategoryCommodities()
          this.$emit('update')
        })
        .catch(() => { this.$message.error('添加失敗') })
    },
    removeCommodity (index, item) {
      this.$confirm(`確認將「${item.name}」從此分類移除？`, '提示', { type: 'warning' })
        .then(() => {
          this.$axios.post(`/api/category/${this.form._id}/removeCommodity`, { commodityId: item._id })
            .then(() => {
              this.$message.success('已移除')
              this.categoryCommodities.splice(index, 1)
              this.$emit('update')
            })
            .catch(() => { this.$message.error('移除失敗') })
        })
        .catch(() => {})
    },
    moveUp (index) {
      if (index <= 0) return
      const list = this.categoryCommodities.slice()
      const temp = list[index - 1]
      list[index - 1] = list[index]
      list[index] = temp
      this.categoryCommodities = list
      this.saveOrder()
    },
    moveDown (index) {
      if (index >= this.categoryCommodities.length - 1) return
      const list = this.categoryCommodities.slice()
      const temp = list[index + 1]
      list[index + 1] = list[index]
      list[index] = temp
      this.categoryCommodities = list
      this.saveOrder()
    },
    onDragStart (event, index) {
      this.dragIndex = index
      event.dataTransfer.effectAllowed = 'move'
    },
    onDragOver (event, index) {
      this.dragOverIndex = index
    },
    onDragEnd () {
      if (this.dragIndex >= 0 && this.dragOverIndex >= 0 && this.dragIndex !== this.dragOverIndex) {
        const list = this.categoryCommodities.slice()
        const source = list.splice(this.dragIndex, 1)[0]
        list.splice(this.dragOverIndex, 0, source)
        this.categoryCommodities = list
        this.saveOrder()
      }
      this.dragIndex = -1
      this.dragOverIndex = -1
    },
    saveOrder () {
      const ids = this.categoryCommodities.map(c => c._id)
      this.$axios.post(`/api/category/${this.form._id}/saveCommodities`, { commodityIds: ids })
        .catch(() => { this.$message.error('排序保存失敗') })
    },
    submitForm (formName) {
      if (this.form.channels === undefined) this.form.channels = ['pos', 'qr']
      if (this.form.slots === undefined) this.form.slots = []
      this.$refs[formName].validate(valid => {
        if (valid) {
          const url = this.dialog.option === 'add' ? '/add' : '/edit'
          this.$axios.post('/api/category' + url, this.form)
            .then(res => {
              this.$message({ type: 'success', message: res.data })
              this.dialog.show = false
              this.$emit('update')
            })
        } else {
          this.activeTab = 'settings'
        }
      })
    }
  }
}
</script>

<style scoped>
.color-row{
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
}
.color-item{
    display: flex;
    align-items: center;
    gap: 8px;
}
.color-label{
    font-size: 13px;
    color: #606266;
    font-weight: 600;
    white-space: nowrap;
}
.color-val{
    font-size: 12px;
    color: #909399;
}
.color-preview{
    margin-top: 8px;
}
.cancel-shadow{
    box-shadow: 0px 0px 20px rgba(85, 86, 99, 0.262);
}
.btn-shadow{
    box-shadow: 0px 0px 20px rgba(53, 141, 230, 0.562);
}
.channel-tip{
    margin-top: 4px;
    color: #909399;
    font-size: 12px;
}
.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.section-title {
    font-weight: bold;
    font-size: 14px;
    color: #303133;
}
.empty-tip {
    text-align: center;
    color: #c0c4cc;
    padding: 20px 0;
    font-size: 13px;
}
.commodity-list {
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid #EBEEF5;
    border-radius: 4px;
}
.commodity-item {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    border-bottom: 1px solid #F2F6FC;
    cursor: grab;
    transition: background 0.15s;
}
.commodity-item:hover {
    background: #F5F7FA;
}
.commodity-item.drag-over {
    border-top: 2px solid #409EFF;
}
.commodity-item:last-child {
    border-bottom: none;
}
.item-index {
    width: 28px;
    text-align: center;
    color: #909399;
    font-size: 12px;
    flex-shrink: 0;
}
.item-img {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    margin: 0 8px;
    object-fit: cover;
    flex-shrink: 0;
}
.item-info {
    flex: 1;
    min-width: 0;
}
.item-name {
    display: block;
    font-size: 13px;
    color: #303133;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.item-price {
    font-size: 12px;
    color: #E6A23C;
}
.item-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
}
.item-actions .el-button {
    padding: 4px;
    margin-left: 2px;
}
.remove-btn {
    color: #F56C6C !important;
}
.picker-list {
    max-height: 360px;
    overflow-y: auto;
}
.picker-item {
    display: flex;
    align-items: center;
    padding: 8px 10px;
    border-bottom: 1px solid #F2F6FC;
    cursor: pointer;
    transition: background 0.15s;
}
.picker-item:hover {
    background: #ECF5FF;
}
.picker-img {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    margin-right: 10px;
    object-fit: cover;
}
.picker-info {
    flex: 1;
    min-width: 0;
}
.picker-name {
    display: block;
    font-size: 13px;
    color: #303133;
}
.picker-cat {
    font-size: 12px;
    color: #909399;
}
.picker-price {
    font-size: 13px;
    color: #E6A23C;
    flex-shrink: 0;
}
</style>
