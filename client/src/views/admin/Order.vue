<template>
    <div class="order">
        <el-row>
            <el-col :span="24">
                <el-table
                :data="tableData"
                :max-height="tableHeight"
                style="width: 100%">
                <el-table-column type="expand">
                <template slot-scope="props">
                    <el-form label-position="left" inline class="demo-table-expand">
                    <el-form-item label="訂單編號">
                        <span>{{ props.row.orderNo }}</span>
                    </el-form-item>
                    <el-form-item label="訂單桌號">
                        <span>{{ props.row.deskNo }}</span>
                    </el-form-item>
                    <el-form-item label="訂單內容">
                        <ul>
                            <li v-for="item in props.row.order" :key="item._id">
                                <span>{{ item.name }}</span><span>x{{ item.count }}</span><span>${{ item.price }}</span>
                            </li>
                        </ul>
                    </el-form-item>
                    <el-form-item label="訂單備註">
                        <span>{{ props.row.remark ===''?'無':props.row.remark }}</span>
                    </el-form-item>
                    <el-form-item label="訂單金額">
                        <span class="totalPrice">${{ props.row.totalPrice }}</span>
                    </el-form-item>
                    <el-form-item label="下單時間">
                        <span>{{ props.row.date | formatDate }}</span>
                    </el-form-item>
                    </el-form>
                </template>
                </el-table-column>
                <el-table-column
                label="訂單桌號"
                width="80"
                align="center"
                prop="deskNo">
                </el-table-column>
                <el-table-column
                align="center"
                label="訂單內容">
                <template slot-scope="scope">
                    <span class="ellipsis">{{ scope.row.order | orderList }}</span>
                </template>
                </el-table-column>
                <el-table-column
                align="center"
                label="訂單備註">
                <template slot-scope="scope">
                    <span class="ellipsis">{{ scope.row.remark===''?"無":scope.row.remark }}</span>
                </template>
                </el-table-column>
                <el-table-column
                align="center"
                width="100"
                label="訂單金額">
                <template slot-scope="scope">
                    <span class="totalPrice">${{ scope.row.totalPrice }}</span>
                </template>
                </el-table-column>
                <el-table-column
                align="center"
                fixed="right"
                width="80"
                label="訂單狀態">
                    <template slot-scope="scope">
                        <el-tag
                        :type="scope.row.state === 0 ? 'primary' : 'success'"
                        disable-transitions>
                            {{ scope.row.state===0?"待處理":"已完成" }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column
                align="center"
                fixed="right"
                width="220"
                label="訂單操作">
                    <template slot-scope="scope">
                        <el-dropdown @command="handlePrint" style="margin-right: 6px;">
                            <el-button size="mini" type="primary">打印<i class="el-icon-arrow-down el-icon--right"></i></el-button>
                            <el-dropdown-menu slot="dropdown">
                                <el-dropdown-item :command="{ row: scope.row, type: 'kitchen' }">後廚小票</el-dropdown-item>
                                <el-dropdown-item :command="{ row: scope.row, type: 'receipt' }">結賬小票</el-dropdown-item>
                                <el-dropdown-item :command="{ row: scope.row, type: 'serving' }">上菜紙</el-dropdown-item>
                            </el-dropdown-menu>
                        </el-dropdown>
                        <el-button size="mini" type="success" @click="finish(scope.row)">完成</el-button>
                        <el-popconfirm
                        title="確定要取消當前訂單嗎？"
                        @onConfirm="cancel(scope.row)"
                        >
                        <el-button slot="reference" size="mini" type="warning">取消</el-button>
                        </el-popconfirm>
                    </template>
                </el-table-column>
            </el-table>
            </el-col>
        </el-row>

    </div>
</template>

<script>
export default {
  name: 'order',
  data () {
    return {
      tableData: [],
      tableHeight: window.innerHeight - 105
    }
  },
  methods: {
    finish (data) {
      const cashier = (this.$store.state.user && this.$store.state.user.username) || ''
      this.$axios.post('/api/order/finish', { _id: data._id, cashier })
        .then(res => {
          this.$message({
            type: 'success',
            message: '訂單已完成！'
          })
          this.statisticData(data)
          this.initTableData()
        })
        .catch(err => {
          console.log(err)
        })
    },
    cancel (data) {
      this.$axios.post('/api/order/cancel', { _id: data._id })
        .then(res => {
          this.$message({
            type: 'success',
            message: '訂單已取消！'
          })
          this.initTableData()
        })
        .catch(err => {
          console.log(err)
        })
    },
    handlePrint (cmd) {
      this.$axios.post('/api/order/print', { _id: cmd.row._id, type: cmd.type })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
        })
        .catch(err => {
          this.$message({ type: 'error', message: err.response ? err.response.data : '打印失敗' })
        })
    },
    async statisticData (data) {
      try {
        await this.$axios.post('/api/statistic/submit', { date: data.date, income: data.totalPrice })
      } catch (err) {
        console.log(err)
      }
    },
    initTableData () {
      this.$axios.get('/api/order/unfinished')
        .then(res => {
          this.tableData = res.data
        })
        .catch(err => {
          console.log(err)
        })
    }
  },
  mounted () {
    this.initTableData()
    window.onresize = () => {
      this.tableHeight = window.innerHeight - 105
    }
  },
  sockets: {
    checkOrder () {
      this.initTableData()
    }
  },
  filters: {
    orderList (order) {
      let orderData = ''
      order.forEach(el => {
        orderData += `${el.name}x${el.count} `
      })
      return orderData
    },
    formatDate (time) {
      const date = new Date(time)
      const dateValue = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds()
      return dateValue
    }
  }
}
</script>

<style>
    .order{
        height: 100%;
    }
    .demo-table-expand {
        font-size: 0;
    }
    .demo-table-expand label {
        width: 90px;
        color: #99a9bf;
    }
    .demo-table-expand .el-form-item {
        margin-right: 0;
        margin-bottom: 0;
        width: 100%;
    }
    .demo-table-expand .el-form-item .el-form-item__content ul{
        width:300px;
    }
    .demo-table-expand .el-form-item .el-form-item__content ul li{
        display: flex;
    }
    .demo-table-expand .el-form-item .el-form-item__content ul li span{
        flex: 1;
    }
    .demo-table-expand .el-form-item .el-form-item__content ul li span:first-child{
        flex: 4;
    }
    .totalPrice{
        color: red;
    }
    .ellipsis{
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
