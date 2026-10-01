<template>
  <el-dialog title="更改用戶密碼" :visible.sync="changePwdDialog.show" width="340px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <el-input v-model="changePwdDialog.oldPwd" type="password" placeholder="舊密碼" size="medium" show-password style="margin-bottom:12px;"></el-input>
    <el-input v-model="changePwdDialog.newPwd" type="password" placeholder="新密碼" size="medium" show-password style="margin-bottom:12px;"></el-input>
    <el-input v-model="changePwdDialog.newPwd2" type="password" placeholder="確認新密碼" size="medium" show-password @keyup.enter.native="$emit('submit')"></el-input>
    <div slot="footer">
      <el-button @click="changePwdDialog.show = false">取消</el-button>
      <el-button type="primary" :loading="changePwdDialog.loading" @click="$emit('submit')">確認</el-button>
    </div>
  </el-dialog>
</template>

<script>
export default {
  name: 'changePwdDialog',
  props: {
    changePwdDialog: { type: Object, required: true }
  }
}
</script>
