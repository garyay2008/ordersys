<template>
    <div class="modify-order">
        <el-card class="search-card" shadow="never">
            <div slot="header" class="card-header">
                <span class="card-title">修改往日單據</span>
            </div>
            <el-form :inline="true" @submit.native.prevent>
                <el-form-item label="單號">
                    <el-input
                        v-model="searchOrderNo"
                        placeholder="請輸入單號"
                        clearable
                        style="width: 220px"
                        @keyup.enter.native="search">
                    </el-input>
                </el-form-item>
                <el-form-item label="日期（可選）">
                    <el-date-picker
                        v-model="searchDate"
                        type="date"
                        value-format="yyyy-MM-dd"
                        placeholder="選擇日期"
                        style="width: 160px">
                    </el-date-picker>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" icon="el-icon-search" @click="search">查詢</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <el-card v-if="order" class="detail-card" shadow="never">
            <div slot="header" class="card-header">
                <span class="card-title">單據資料</span>
                <span class="order-no">{{ order.orderNo }}</span>
                <el-tag :type="order.state === 0 ? 'primary' : 'success'" size="small">{{ order.state === 0 ? '待處理' : '已完成' }}</el-tag>
            </div>

            <el-descriptions :column="2" border size="medium" class="order-meta">
                <el-descriptions-item label="桌號">{{ order.deskNo }}</el-descriptions-item>
                <el-descriptions-item label="區域">{{ order.zone || '—' }}</el-descriptions-item>
                <el-descriptions-item label="下單時間">{{ formatDate(order.date) }}</el-descriptions-item>
                <el-descriptions-item label="付款方式">{{ order.payMethod || '—' }}</el-descriptions-item>
                <el-descriptions-item label="訂單金額"><span class="total-price">${{ formatMoney(order.totalPrice) }}</span></el-descriptions-item>
                <el-descriptions-item label="來源">{{ order.source || '—' }}</el-descriptions-item>
            </el-descriptions>

            <div class="items-title">訂單內容</div>
            <el-table :data="order.order || []" size="mini" border max-height="280">
                <el-table-column type="index" label="#" width="45" align="center"></el-table-column>
                <el-table-column prop="name" label="品項" min-width="140"></el-table-column>
                <el-table-column prop="count" label="數量" width="70" align="center"></el-table-column>
                <el-table-column label="單價" width="90" align="right">
                    <template slot-scope="scope">{{ formatMoney(unitPrice(scope.row)) }}</template>
                </el-table-column>
                <el-table-column label="小計" width="100" align="right">
                    <template slot-scope="scope">{{ formatMoney(lineTotal(scope.row)) }}</template>
                </el-table-column>
                <el-table-column label="分帳" width="110" align="center">
                    <template slot-scope="scope">
                        <el-button v-if="scope.row.comboId" type="text" size="mini" @click="openDeptSplit(scope.$index)">大單分帳</el-button>
                        <span v-else>—</span>
                    </template>
                </el-table-column>
            </el-table>

            <div class="edit-title">修改單據</div>
            <el-form label-width="90px" class="edit-form">
                <el-form-item label="日期">
                    <el-date-picker
                        v-model="editDate"
                        type="datetime"
                        value-format="yyyy-MM-dd HH:mm:ss"
                        placeholder="選擇日期時間"
                        style="width: 220px">
                    </el-date-picker>
                </el-form-item>
                <el-form-item label="付款方式">
                    <el-select v-model="editPayMethod" placeholder="請選擇付款方式" style="width: 220px" clearable>
                        <el-option v-for="p in payMethods" :key="p.value" :label="p.value" :value="p.value"></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item>
                    <el-button type="primary" :loading="saving" @click="save">儲存修改</el-button>
                </el-form-item>
            </el-form>
        </el-card>

        <split-dept-dialog :dept-dialog="deptDialog" :departments="departments" @confirm="confirmDeptSplit"></split-dept-dialog>
    </div>
</template>

<script>
import SplitDeptDialog from '../../components/pos/SplitDeptDialog'

export default {
  name: 'modifyOrder',
  components: { SplitDeptDialog },
  data () {
    return {
      searchOrderNo: '',
      searchDate: '',
      order: null,
      editDate: '',
      editPayMethod: '',
      payMethods: [],
      departments: [],
      deptDialog: { show: false, title: '', combos: [] },
      saving: false
    }
  },
  mounted () {
    this.loadPayMethods()
    this.loadDepartments()
  },
  methods: {
    formatDate (time) {
      if (!time) return '—'
      const d = new Date(time)
      const pad = n => (n < 10 ? '0' + n : n)
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
    },
    formatMoney (v) {
      return (Number(v) || 0).toFixed(2)
    },
    unitPrice (item) {
      if (!item) return 0
      if (item.free) return 0
      const base = item.customPrice > 0 ? item.customPrice : (item.price || 0)
      return Math.round(base * (item.discount || 1) * 100) / 100
    },
    lineTotal (item) {
      return Math.round(this.unitPrice(item) * (item.count || 1) * 100) / 100
    },
    loadPayMethods () {
      this.$axios.get('/api/amount/payMethod')
        .then(res => {
          this.payMethods = res.data || []
        })
        .catch(() => { this.payMethods = [] })
    },
    loadDepartments () {
      this.$axios.get('/api/department/list')
        .then(res => {
          this.departments = res.data || []
        })
        .catch(() => { this.departments = [] })
    },
    search () {
      const orderNo = (this.searchOrderNo || '').trim()
      if (!orderNo) {
        this.$message({ type: 'warning', message: '請輸入單號' })
        return
      }
      const params = { orderNo }
      if (this.searchDate) params.date = this.searchDate
      this.$axios.get('/api/order/lookup', { params })
        .then(res => {
          this.order = res.data
          this.editDate = this.formatDate(res.data.date)
          this.editPayMethod = res.data.payMethod || ''
        })
        .catch(err => {
          this.order = null
          this.$message({ type: 'error', message: err.response ? err.response.data : '查詢失敗' })
        })
    },
    save () {
      if (!this.order) return
      const payload = { orderNo: this.order.orderNo }
      if (this.editDate) payload.date = this.editDate
      if (this.editPayMethod !== undefined && this.editPayMethod !== null) payload.payMethod = this.editPayMethod
      this.saving = true
      this.$axios.post('/api/order/update', payload)
        .then(res => {
          this.$message({ type: 'success', message: res.data || '單據修改成功' })
          this.saving = false
          this.search()
        })
        .catch(err => {
          this.saving = false
          this.$message({ type: 'error', message: err.response ? err.response.data : '修改失敗' })
        })
    },
    openDeptSplit (index) {
      const items = this.order ? (this.order.order || []) : []
      const combos = items
        .map((item, i) => ({ key: i, item, name: item.name, count: item.count || 1, lineTotal: this.lineTotal(item) }))
        .filter(c => c.item && c.item.comboId)
      if (!combos.length) {
        this.$message({ type: 'warning', message: '該單據內沒有套餐可分帳' })
        return
      }
      if (!this.departments.length) {
        this.$message({ type: 'warning', message: '尚未設定部門，請先到後台新增部門' })
        return
      }
      this.deptDialog = { show: true, title: '大單分帳（' + (this.order.orderNo || '') + '）', combos }
    },
    confirmDeptSplit (payload) {
      if (!this.order) return
      this.$axios.post('/api/order/setDeptSplit', {
        orderNo: this.order.orderNo,
        itemIndex: payload.key,
        departmentSplit: payload.departmentSplit
      })
        .then(res => {
          this.$message({ type: 'success', message: res.data || '部門分帳已儲存' })
          this.search()
        })
        .catch(err => {
          this.$message({ type: 'error', message: err.response ? err.response.data : '部門分帳失敗' })
        })
    }
  }
}
</script>

<style scoped>
.modify-order{
    padding: 16px;
}
.search-card, .detail-card{
    margin-bottom: 16px;
}
.card-header{
    display: flex;
    align-items: center;
}
.card-title{
    font-size: 16px;
    font-weight: 700;
    color: #303133;
}
.order-no{
    margin-left: 16px;
    color: #e6a23c;
    font-weight: 700;
    font-size: 16px;
}
.order-no + .el-tag{
    margin-left: 12px;
}
.order-meta{
    margin-bottom: 16px;
}
.total-price{
    color: #f56c6c;
    font-weight: 700;
}
.items-title, .edit-title{
    margin: 16px 0 10px;
    font-size: 14px;
    font-weight: 700;
    color: #303133;
}
.edit-form{
    margin-top: 8px;
}
</style>
