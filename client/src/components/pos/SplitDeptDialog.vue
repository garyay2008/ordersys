<template>
  <el-dialog :title="deptDialog.title || '部門分帳'" :visible.sync="deptDialog.show" width="760px" custom-class="pos-dialog" append-to-body :close-on-click-modal="false">
    <!-- 選擇套餐 -->
    <div v-if="!selected" class="ddp-list">
      <div v-if="!combos.length" class="ddp-empty">沒有可分帳的套餐</div>
      <div v-for="(c, i) in combos" :key="i" class="ddp-item" @click="pick(c)">
        <span class="ddp-name">{{ c.name }}</span>
        <span class="ddp-qty">×{{ c.count }}</span>
        <span class="ddp-total">${{ c.lineTotal.toFixed(2) }}</span>
      </div>
    </div>

    <!-- 分部門金額 -->
    <div v-else class="ddp-split">
      <div class="ddp-main">
        <div class="ddp-head">
          <span class="ddp-head-name">{{ selected.name }}（×{{ selected.count }}）</span>
          <span class="ddp-head-total">應分 ${{ selected.lineTotal.toFixed(2) }}</span>
        </div>
        <div v-for="d in departments" :key="d._id" class="ddp-row" :class="{ 'ddp-row-active': amountPad.dept === d.name }">
          <span class="ddp-dept">{{ d.name }}</span>
          <div class="ddp-amount" @click="openAmount(d)">${{ (Number(amounts[d.name]) || 0).toFixed(2) }}</div>
        </div>
        <div class="ddp-actions">
          <el-button size="mini" @click="splitEvenly">平均分</el-button>
          <el-button size="mini" @click="fillRemainder">填滿剩餘</el-button>
        </div>
        <div class="ddp-summary" :class="{ 'ddp-ok': Math.abs(remaining) < 0.01 }">
          已分 ${{ splitTotal.toFixed(2) }} / 尚餘 ${{ remaining.toFixed(2) }}
        </div>
      </div>

      <div class="ddp-pad">
        <div class="ddp-pad-head">
          <span>{{ amountPad.dept ? '輸入「' + amountPad.dept + '」分帳金額' : '分帳金額鍵盤' }}</span>
          <el-button v-if="amountPad.dept" size="mini" type="text" @click="closeAmount">取消</el-button>
        </div>
        <number-pad v-if="amountPad.dept" :value="amountPad.value" decimal @input="amountPad.value = $event" @confirm="confirmAmount"></number-pad>
        <div v-else class="ddp-pad-empty">請點選左方部門金額</div>
      </div>
    </div>

    <div slot="footer">
      <el-button v-if="selected" @click="selected = null">返回選套餐</el-button>
      <el-button @click="deptDialog.show = false">取 消</el-button>
      <el-button type="primary" :disabled="!selected" @click="confirm">確 定</el-button>
    </div>
  </el-dialog>
</template>

<script>
import NumberPad from './NumberPad'

export default {
  name: 'splitDeptDialog',
  components: { NumberPad },
  props: {
    deptDialog: { type: Object, required: true },
    departments: { type: Array, default: () => [] }
  },
  data () {
    return {
      selected: null,
      amounts: {},
      amountPad: { dept: '', value: '' }
    }
  },
  computed: {
    combos () {
      return (this.deptDialog.combos || [])
    },
    splitTotal () {
      return Math.round(Object.keys(this.amounts).reduce((s, k) => s + (Number(this.amounts[k]) || 0), 0) * 100) / 100
    },
    remaining () {
      const target = this.selected ? this.selected.lineTotal : 0
      return Math.round((target - this.splitTotal) * 100) / 100
    }
  },
  methods: {
    pick (c) {
      this.selected = c
      this.amountPad.dept = ''
      this.amountPad.value = ''
      const amts = {}
      this.departments.forEach(d => { amts[d.name] = 0 })
      if (c.item && Array.isArray(c.item.departmentSplit)) {
        c.item.departmentSplit.forEach(s => {
          if (s && amts[s.department] !== undefined) amts[s.department] = Math.round((Number(s.amount) || 0) * 100) / 100
        })
      }
      this.amounts = amts
    },
    openAmount (d) {
      const cur = Number(this.amounts[d.name]) || 0
      this.amountPad = { dept: d.name, value: cur > 0 ? String(cur) : '' }
    },
    closeAmount () {
      this.amountPad.dept = ''
      this.amountPad.value = ''
    },
    confirmAmount () {
      const dept = this.amountPad.dept
      if (!dept) return
      let v = parseFloat(this.amountPad.value)
      if (isNaN(v) || v < 0) v = 0
      if (this.selected && v > this.selected.lineTotal) v = this.selected.lineTotal
      this.$set(this.amounts, dept, Math.round(v * 100) / 100)
      this.amountPad.dept = ''
      this.amountPad.value = ''
    },
    splitEvenly () {
      if (!this.departments.length) return
      const n = this.departments.length
      const each = Math.floor(this.selected.lineTotal / n * 100) / 100
      const amts = {}
      this.departments.forEach((d, i) => { amts[d.name] = i === n - 1 ? Math.round((this.selected.lineTotal - each * (n - 1)) * 100) / 100 : each })
      this.amounts = amts
    },
    fillRemainder () {
      const names = this.departments.map(d => d.name)
      if (!names.length) return
      const last = names[names.length - 1]
      const others = names.slice(0, -1).reduce((s, k) => s + (Number(this.amounts[k]) || 0), 0)
      this.$set(this.amounts, last, Math.max(0, Math.round((this.selected.lineTotal - others) * 100) / 100))
    },
    confirm () {
      if (!this.selected) return
      if (Math.abs(this.remaining) > 0.01) {
        this.$message({ type: 'warning', message: '分帳金額合計必須等於套餐小計！' })
        return
      }
      const departmentSplit = this.departments
        .filter(d => (Number(this.amounts[d.name]) || 0) > 0)
        .map(d => ({ department: d.name, amount: Math.round((Number(this.amounts[d.name]) || 0) * 100) / 100 }))
      this.$emit('confirm', { key: this.selected.key, departmentSplit })
      this.deptDialog.show = false
      this.selected = null
    }
  }
}
</script>

<style scoped>
.ddp-list{ max-height: 360px; overflow-y: auto; }
.ddp-empty{ text-align: center; color: #c0c4cc; padding: 30px 0; }
.ddp-item{ display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid #e4e7ed; border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all .15s; }
.ddp-item:hover{ border-color: #409eff; background: #ecf5ff; }
.ddp-name{ flex: 1; font-size: 16px; font-weight: 700; color: #303133; }
.ddp-qty{ color: #909399; font-size: 14px; }
.ddp-total{ color: #e6a23c; font-weight: 800; font-size: 16px; }
.ddp-head{ display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f5f7fa; border-radius: 8px; margin-bottom: 12px; }
.ddp-head-name{ font-size: 16px; font-weight: 700; color: #303133; }
.ddp-head-total{ color: #e6a23c; font-weight: 800; font-size: 16px; }
.ddp-row{ display: flex; align-items: center; gap: 14px; margin-bottom: 10px; padding: 4px 6px; border-radius: 8px; transition: background .12s; }
.ddp-row-active{ background: #ecf5ff; }
.ddp-dept{ width: 120px; flex-shrink: 0; font-size: 15px; color: #606266; }
.ddp-amount{ width: 150px; height: 32px; line-height: 30px; padding: 0 10px; border: 1px solid #dcdfe6; border-radius: 4px; text-align: right; font-size: 15px; font-weight: 700; color: #409eff; cursor: pointer; background: #fff; }
.ddp-amount:hover{ border-color: #409eff; }
.ddp-actions{ margin: 10px 0 8px; }
.ddp-summary{ font-size: 14px; color: #f56c6c; font-weight: 700; margin-bottom: 8px; }
.ddp-summary.ddp-ok{ color: #67c23a; }
.ddp-split{ display: flex; align-items: flex-start; gap: 18px; }
.ddp-main{ flex: 1; min-width: 0; }
.ddp-pad{ width: 260px; flex-shrink: 0; border-left: 1px dashed #dcdfe6; padding-left: 18px; }
.ddp-pad-head{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; font-weight: 700; color: #303133; min-height: 24px; }
.ddp-pad-empty{ height: 200px; display: flex; align-items: center; justify-content: center; color: #c0c4cc; font-size: 14px; text-align: center; border: 1px dashed #e4e7ed; border-radius: 8px; }
</style>
