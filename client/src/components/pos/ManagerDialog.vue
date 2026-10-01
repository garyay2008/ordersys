<template>
  <el-dialog title="經理功能" :visible.sync="managerDialog.show" width="340px" custom-class="pos-dialog" append-to-body>
    <template v-if="!isManager">
      <el-input v-model="managerDialog.no" placeholder="經理編號" size="medium" style="margin-bottom: 12px;"></el-input>
      <el-input v-model="managerDialog.password" type="password" placeholder="密碼" size="medium" show-password @keyup.enter.native="$emit('login')"></el-input>
    </template>
    <template v-else>
      <div class="manager-menu">
        <el-button v-for="item in resolvedManagerMenu" :key="item.id" size="medium" @click="$emit('action', item.id)">{{ item.label }}</el-button>
        <el-button size="medium" @click="$emit('action', 'dayReport')">每日結算</el-button>
        <el-button size="medium" type="info" @click="$emit('action', 'logout')">退出經理</el-button>
      </div>
    </template>
    <div slot="footer" v-if="!isManager">
      <el-button @click="managerDialog.show = false">取 消</el-button>
      <el-button type="primary" @click="$emit('login')">登 入</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'managerDialog',
  props: {
    managerDialog: { type: Object, required: true },
    isManager: { type: Boolean, default: false },
    resolvedManagerMenu: { type: Array, default: () => [] }
  }
}
</script>

<style scoped>
.manager-menu{ display: flex; flex-direction: column; gap: 10px; }
</style>
