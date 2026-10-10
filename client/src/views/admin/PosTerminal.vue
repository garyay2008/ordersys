<template>
  <div id="posterminal">
    <el-row>
      <el-button type="primary" size="small" class="btn-shadow" @click="addTerminal">添加收銀機</el-button>
    </el-row>
    <el-row class="row-height">
      <el-col :span="24">
        <el-table :data="list" size="medium" :max-height="tableHeight" style="width: 100%">
          <el-table-column align="center" prop="code" width="120" label="編號"></el-table-column>
          <el-table-column align="center" prop="name" label="名稱" min-width="140"></el-table-column>
          <el-table-column align="center" prop="location" width="120" label="位置">
            <template slot-scope="scope">
              <span>{{ scope.row.location || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="100" label="類型">
            <template slot-scope="scope">
              <el-tag size="mini" :type="typeTag(scope.row.type)">{{ typeLabel(scope.row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" width="100" label="單號前綴">
            <template slot-scope="scope">
              <span style="font-weight:700; color:#409eff;">{{ scope.row.orderPrefix || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="90" label="流水號">
            <template slot-scope="scope">
              <span>{{ scope.row.orderSeq || 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="100" label="印表機 IP">
            <template slot-scope="scope">
              <span>{{ scope.row.printerIp || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column align="center" width="80" label="錢箱">
            <template slot-scope="scope">
              <el-tag size="mini" :type="scope.row.cashDrawer ? 'success' : 'info'">{{ scope.row.cashDrawer ? '有' : '無' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" width="80" label="狀態">
            <template slot-scope="scope">
              <el-tag size="mini" :type="scope.row.enabled ? 'success' : 'info'">{{ scope.row.enabled ? '啟用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" width="140" label="POS 連結">
            <template slot-scope="scope">
              <el-button v-if="scope.row.enabled" size="mini" type="success" icon="el-icon-link" @click="copyPosLink(scope.row)">複製連結</el-button>
              <span v-else style="color:#c0c4cc; font-size:12px;">停用</span>
            </template>
          </el-table-column>
          <el-table-column fixed="right" align="center" width="220" label="操作">
            <template slot-scope="scope">
              <el-button type="text" size="small" @click="editTerminal(scope.row)">編輯</el-button>
              <el-button type="text" size="small" @click="resetSeq(scope.row)">歸零流水號</el-button>
              <el-button type="text" size="small" style="color: #f56c6c;" @click="delTerminal(scope.row)">刪除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-col>
    </el-row>

    <!-- 添加 / 編輯收銀機 -->
    <el-dialog :title="dialog.title" :visible.sync="dialog.show" width="780px">
      <el-form ref="terminalForm" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="收銀機編號" prop="code">
          <el-input v-model="form.code" placeholder="如 POS-01 / KIOSK-01"></el-input>
        </el-form-item>
        <el-form-item label="名稱" prop="name">
          <el-input v-model="form.name" placeholder="如 大門收銀台"></el-input>
        </el-form-item>
        <el-form-item label="位置">
          <el-input v-model="form.location" placeholder="如 大門 / 側門 / 外賣區"></el-input>
        </el-form-item>
        <el-form-item label="類型">
          <el-select v-model="form.type" style="width: 100%;">
            <el-option label="收銀機" value="cashier"></el-option>
            <el-option label="自助點餐機" value="kiosk"></el-option>
            <el-option label="手提平板" value="pad"></el-option>
            <el-option label="廚房顯示" value="kitchen"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="單號前綴">
          <el-input v-model="form.orderPrefix" placeholder="如 1, 2, 3（空=不加前綴）" style="width: 200px;"></el-input>
          <div class="field-tip">多台收銀機用不同前綴避免單號衝突（例：1=1001, 2=2001）</div>
        </el-form-item>
        <el-form-item label="收銀印表機">
          <el-input v-model="form.printerIp" placeholder="IP 地址（如 192.168.1.100）" style="width: 240px;"></el-input>
          <el-input-number v-model="form.printerPort" :min="1" :max="65535" size="small" controls-position="right" style="width: 110px; margin-left: 8px;"></el-input-number>
        </el-form-item>
        <el-form-item label="連接錢箱">
          <el-switch v-model="form.cashDrawer"></el-switch>
          <span class="field-tip" style="margin-left: 8px;">結帳時自動觸發彈開（收據印表機）</span>
        </el-form-item>
        <el-divider content-position="left">本機專屬印表機（留空 IP 則沿用「打印機設置」全域印表機）</el-divider>
        <el-form-item label="收據印表機">
          <div class="printer-cfg">
            <el-select v-model="form.receipt.model" placeholder="型號" clearable size="small" style="width: 170px;" title="打印機型號（一鍵帶入 tech/dpi/紙寬）" @change="onModelChange(form.receipt)">
              <el-option v-for="o in modelOptions" :key="o.value" :label="o.label" :value="o.value"></el-option>
            </el-select>
            <el-select v-model="form.receipt.tech" size="small" style="width: 110px; margin-left: 6px;">
              <el-option label="針式 (Dot)" value="dot"></el-option>
              <el-option label="感熱 (Thermal)" value="thermal"></el-option>
            </el-select>
            <el-select v-if="form.receipt.tech === 'thermal'" v-model="form.receipt.dpi" size="small" style="width: 90px; margin-left: 6px;">
              <el-option label="180dpi" :value="180"></el-option>
              <el-option label="203dpi" :value="203"></el-option>
            </el-select>
            <el-select v-model="form.receipt.paperWidth" size="small" style="width: 80px; margin-left: 6px;">
              <el-option label="58mm" :value="58"></el-option>
              <el-option label="80mm" :value="80"></el-option>
            </el-select>
            <el-input v-model="form.receipt.ip" placeholder="打印機 IP" size="small" style="width: 130px; margin-left: 6px;"></el-input>
            <el-input-number v-model="form.receipt.port" :min="1" :max="65535" size="small" controls-position="right" style="width: 110px; margin-left: 6px;"></el-input-number>
            <el-switch v-model="form.receipt.cashDrawer" active-text="錢箱" size="small" style="margin-left: 6px;"></el-switch>
          </div>
          <div class="field-tip">結帳小票（兼錢箱）；留空 IP 沿用收銀臺印表機</div>
        </el-form-item>
        <el-form-item label="上菜紙印表機">
          <div class="printer-cfg">
            <el-select v-model="form.serving.model" placeholder="型號" clearable size="small" style="width: 170px;" title="打印機型號（一鍵帶入 tech/dpi/紙寬）" @change="onModelChange(form.serving)">
              <el-option v-for="o in modelOptions" :key="o.value" :label="o.label" :value="o.value"></el-option>
            </el-select>
            <el-select v-model="form.serving.tech" size="small" style="width: 110px; margin-left: 6px;">
              <el-option label="針式 (Dot)" value="dot"></el-option>
              <el-option label="感熱 (Thermal)" value="thermal"></el-option>
            </el-select>
            <el-select v-if="form.serving.tech === 'thermal'" v-model="form.serving.dpi" size="small" style="width: 90px; margin-left: 6px;">
              <el-option label="180dpi" :value="180"></el-option>
              <el-option label="203dpi" :value="203"></el-option>
            </el-select>
            <el-select v-model="form.serving.paperWidth" size="small" style="width: 80px; margin-left: 6px;">
              <el-option label="58mm" :value="58"></el-option>
              <el-option label="80mm" :value="80"></el-option>
            </el-select>
            <el-input v-model="form.serving.ip" placeholder="打印機 IP" size="small" style="width: 130px; margin-left: 6px;"></el-input>
            <el-input-number v-model="form.serving.port" :min="1" :max="65535" size="small" controls-position="right" style="width: 110px; margin-left: 6px;"></el-input-number>
          </div>
          <div class="field-tip">上菜紙（傳菜）；留空 IP 沿用傳菜總檯印表機</div>
        </el-form-item>
        <el-form-item label="印單印表機">
          <div class="printer-cfg">
            <el-select v-model="form.print.model" placeholder="型號" clearable size="small" style="width: 170px;" title="打印機型號（一鍵帶入 tech/dpi/紙寬）" @change="onModelChange(form.print)">
              <el-option v-for="o in modelOptions" :key="o.value" :label="o.label" :value="o.value"></el-option>
            </el-select>
            <el-select v-model="form.print.tech" size="small" style="width: 110px; margin-left: 6px;">
              <el-option label="針式 (Dot)" value="dot"></el-option>
              <el-option label="感熱 (Thermal)" value="thermal"></el-option>
            </el-select>
            <el-select v-if="form.print.tech === 'thermal'" v-model="form.print.dpi" size="small" style="width: 90px; margin-left: 6px;">
              <el-option label="180dpi" :value="180"></el-option>
              <el-option label="203dpi" :value="203"></el-option>
            </el-select>
            <el-select v-model="form.print.paperWidth" size="small" style="width: 80px; margin-left: 6px;">
              <el-option label="58mm" :value="58"></el-option>
              <el-option label="80mm" :value="80"></el-option>
            </el-select>
            <el-input v-model="form.print.ip" placeholder="打印機 IP" size="small" style="width: 130px; margin-left: 6px;"></el-input>
            <el-input-number v-model="form.print.port" :min="1" :max="65535" size="small" controls-position="right" style="width: 110px; margin-left: 6px;"></el-input-number>
          </div>
          <div class="field-tip">印單功能鍵輸出；留空 IP 沿用收銀臺印表機（「中央埋單」另於打印機設置指定）</div>
        </el-form-item>
        <el-form-item label="啟用">
          <el-switch v-model="form.enabled"></el-switch>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialog.show = false">取 消</el-button>
        <el-button type="primary" @click="submitTerminal('terminalForm')">確 定</el-button>
      </div>
    </el-dialog>

    <!-- POS 連結提示 -->
    <el-dialog title="POS 連結" :visible.sync="linkDialog.show" width="520px" append-to-body>
      <div style="padding: 10px 0;">
        <div style="font-size: 14px; color: #606266; margin-bottom: 12px;">將以下連結貼到收銀機的瀏覽器書籤或桌面捷徑：</div>
        <el-input v-model="linkDialog.url" readonly style="margin-bottom: 12px;">
          <template slot="prepend">{{ linkDialog.label }}</template>
        </el-input>
        <el-button type="primary" icon="el-icon-document-copy" @click="copyToClipboard(linkDialog.url)">複製連結</el-button>
        <div style="margin-top: 12px; font-size: 12px; color: #909399;">
          <i class="el-icon-info"></i> 此連結已內建收銀機編號，員工打開後會自動選擇該收銀機
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script>
// 打印機型號預設：選型號一鍵帶入 tech / dpi / 紙寬
const PRINTER_MODELS = {
  tmt88: { tech: 'thermal', dpi: 180, paperWidth: 80 },
  xp80ts: { tech: 'thermal', dpi: 203, paperWidth: 80 },
  tmu220: { tech: 'dot', dpi: 180 }
}

function defaultPrinter () {
  return { ip: '', port: 9100, tech: 'thermal', model: '', dpi: 180, paperWidth: 58, copies: 1, cashDrawer: false }
}

export default {
  name: 'posterminal',
  data () {
    return {
      list: [],
      dialog: { show: false, title: '', option: 'add' },
      linkDialog: { show: false, url: '', label: '' },
      form: {
        code: '',
        name: '',
        location: '',
        type: 'cashier',
        orderPrefix: '',
        printerIp: '',
        printerPort: 9100,
        cashDrawer: false,
        receipt: defaultPrinter(),
        serving: defaultPrinter(),
        print: defaultPrinter(),
        enabled: true
      },
      rules: {
        code: [{ required: true, message: '收銀機編號不能為空', trigger: 'blur' }],
        name: [{ required: true, message: '名稱不能為空', trigger: 'blur' }]
      },
      tableHeight: window.innerHeight - 150
    }
  },
  computed: {
    modelOptions () {
      return [
        { value: '', label: '自訂（不自動設定）' },
        { value: 'tmt88', label: 'Epson TM-T88（熱敏 180dpi）' },
        { value: 'xp80ts', label: 'XPrinter XP-80TS（熱敏 203dpi）' },
        { value: 'tmu220', label: 'Epson TM-U220（針式）' }
      ]
    }
  },
  methods: {
    typeLabel (type) {
      const map = { cashier: '收銀機', kiosk: '點餐機', pad: '平板', kitchen: '廚房' }
      return map[type] || type
    },
    typeTag (type) {
      const map = { cashier: '', kiosk: 'success', pad: 'warning', kitchen: 'info' }
      return map[type] || 'info'
    },
    onModelChange (cfg) {
      const m = PRINTER_MODELS[cfg.model]
      if (m) {
        cfg.tech = m.tech
        cfg.dpi = m.dpi
        if (m.paperWidth) cfg.paperWidth = m.paperWidth
      }
    },
    loadData () {
      this.$axios.get('/api/posterminal/all')
        .then(res => { this.list = res.data || [] })
        .catch(err => console.log(err))
    },
    addTerminal () {
      this.dialog = { show: true, title: '添加收銀機', option: 'add' }
      this.form = { code: '', name: '', location: '', type: 'cashier', orderPrefix: '', printerIp: '', printerPort: 9100, cashDrawer: false, receipt: defaultPrinter(), serving: defaultPrinter(), print: defaultPrinter(), enabled: true }
    },
    editTerminal (row) {
      this.dialog = { show: true, title: '編輯收銀機', option: 'edit' }
      this.form = Object.assign({}, row)
      this.form.receipt = Object.assign(defaultPrinter(), row.receipt || {})
      this.form.serving = Object.assign(defaultPrinter(), row.serving || {})
      this.form.print = Object.assign(defaultPrinter(), row.print || {})
    },
    submitTerminal (formName) {
      this.$refs[formName].validate(valid => {
        if (!valid) return
        const url = this.dialog.option === 'add' ? '/api/posterminal/add' : '/api/posterminal/edit'
        this.$axios.post(url, this.form)
          .then(res => {
            this.$message({ type: 'success', message: res.data })
            this.dialog.show = false
            this.loadData()
          })
          .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '操作失敗' }) })
      })
    },
    resetSeq (row) {
      this.$confirm(`確認將「${row.name}」的流水號歸零？`, '歸零確認', { type: 'warning' })
        .then(_ => {
          this.$axios.post('/api/posterminal/resetSeq', { _id: row._id })
            .then(res => {
              this.$message({ type: 'success', message: res.data })
              this.loadData()
            })
            .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '歸零失敗' }) })
        })
        .catch(_ => {})
    },
    delTerminal (row) {
      this.$confirm(`確認刪除收銀機「${row.name}」（${row.code}）嗎？`)
        .then(_ => {
          this.$axios.post('/api/posterminal/del', { _id: row._id })
            .then(res => {
              this.$message({ type: 'success', message: res.data })
              this.loadData()
            })
            .catch(err => console.log(err))
        })
        .catch(_ => {})
    },
    copyPosLink (row) {
      const base = window.location.origin
      const url = base + '/pos?terminal=' + encodeURIComponent(row.code)
      this.linkDialog = { show: true, url, label: row.code }
    },
    copyToClipboard (text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          this.$message({ type: 'success', message: '已複製到剪貼簿' })
        })
      } else {
        const input = document.createElement('input')
        input.value = text
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
        this.$message({ type: 'success', message: '已複製到剪貼簿' })
      }
    }
  },
  created () {
    this.loadData()
    window.onresize = () => { this.tableHeight = window.innerHeight - 150 }
  }
}
</script>

<style scoped>
#posterminal { padding: 2px; }
.row-height { margin-top: 10px; overflow: auto; }
.field-tip { margin-top: 4px; color: #909399; font-size: 12px; }
.printer-cfg { display: flex; flex-wrap: wrap; align-items: center; }
</style>
