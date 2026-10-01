<template>
  <el-dialog title="掛單 / 叫回" :visible.sync="holdDialog.show" width="560px" custom-class="pos-dialog" append-to-body>
    <div v-if="!holdList.length" class="empty">尚無掛單</div>
    <el-table v-else :data="holdList" size="mini">
      <el-table-column prop="label" label="名稱" min-width="140"></el-table-column>
      <el-table-column label="內容" min-width="200">
        <template slot-scope="scope">{{ scope.row.items.map(i => i.name + ' x' + i.count).join('、') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template slot-scope="scope">
          <el-button type="text" size="mini" @click="$emit('recall', scope.$index)">叫回</el-button>
          <el-button type="text" size="mini" @click="$emit('delete', scope.$index)">刪除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div slot="footer">
      <el-button @click="holdDialog.show = false">關 閉</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'holdDialog',
  props: {
    holdDialog: { type: Object, required: true },
    holdList: { type: Array, default: () => [] }
  }
}
</script>
