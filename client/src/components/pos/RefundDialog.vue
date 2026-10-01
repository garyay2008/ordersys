<template>
  <el-dialog title="更改已結帳單" :visible.sync="refundDialog.show" width="720px" custom-class="pos-dialog" append-to-body>
    <el-tabs v-model="refundDialog.activeTab">
      <el-tab-pane label="退菜 / 取消單" name="void">
        <el-table :data="unfinishedOrders" size="mini" :max-height="420">
          <el-table-column label="枱號" width="80">
            <template slot-scope="scope">{{ scope.row.deskNo ? scope.row.deskNo : (scope.row.zone || '外賣') }}</template>
          </el-table-column>
          <el-table-column prop="orderNo" label="訂單號" width="175"></el-table-column>
          <el-table-column label="品項" min-width="220">
            <template slot-scope="scope">
              <div v-for="(it, i) in (scope.row.order || [])" :key="i" class="void-item">
                <span>{{ it.name }} x{{ it.count }}</span>
                <el-button type="text" size="mini" @click="$emit('void-item', scope.row, i)">退菜</el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="totalPrice" label="金額" width="90"></el-table-column>
          <el-table-column label="操作" width="110">
            <template slot-scope="scope">
              <el-button type="text" size="mini" @click="$emit('cancel-order', scope.row)">取消整單</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="更改已結帳單" name="refund">
        <el-table :data="refundDialog.finished" size="mini" :max-height="420">
          <el-table-column prop="orderNo" label="訂單號" width="165"></el-table-column>
          <el-table-column label="枱號" width="70">
            <template slot-scope="scope">{{ scope.row.deskNo ? scope.row.deskNo : (scope.row.zone || '外賣') }}</template>
          </el-table-column>
          <el-table-column prop="totalPrice" label="金額" width="80"></el-table-column>
          <el-table-column label="付款" width="90">
            <template slot-scope="scope">{{ scope.row.payMethod || '—' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="170">
            <template slot-scope="scope">
              <el-button type="text" size="mini" @click="$emit('change-pay', scope.row)">更改付款</el-button>
              <el-button type="text" size="mini" @click="$emit('refund-order', scope.row)">退款</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </el-dialog>
</template>

<script>
export default {
  name: 'refundDialog',
  props: {
    refundDialog: { type: Object, required: true },
    unfinishedOrders: { type: Array, default: () => [] }
  }
}
</script>

<style scoped>
.void-item{ display: flex; align-items: center; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #eee; }
.void-item span{ font-size: 13px; }
</style>
