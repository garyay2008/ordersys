<template>
  <div class="printer">
    <el-card class="box-card">
      <div slot="header" class="clearfix">
        <span>打印機設置</span>
      </div>
      <el-form ref="form" :model="form" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="小票抬頭">
              <el-input v-model="form.shopName" placeholder="默認取店鋪名稱"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="店鋪電話">
              <el-input v-model="form.phone"></el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="店鋪地址">
              <el-input v-model="form.address"></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="底部廣告語">
              <el-input v-model="form.footer"></el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="中文編碼">
              <el-select v-model="form.charset" style="width: 220px;">
                <el-option label="繁體 Big5（台灣／香港）" value="big5"></el-option>
                <el-option label="簡體 GBK" value="gbk"></el-option>
                <el-option label="簡體 GB18030" value="gb18030"></el-option>
                <el-option label="UTF-8" value="utf8"></el-option>
              </el-select>
              <span class="tip">依打印機實際字體選擇；繁體機選 Big5</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="店舖 Logo">
          <el-upload
            class="logo-uploader"
            action=""
            :show-file-list="false"
            :http-request="uploadLogo"
            :before-upload="beforeLogoUpload">
            <img v-if="form.logo" :src="logoPreview" class="logo-preview">
            <i v-else class="el-icon-plus logo-uploader-icon"></i>
          </el-upload>
          <span class="tip">印在小票最上方的店舖標誌（建議黑白、高對比）</span>
          <el-button v-if="form.logo" size="mini" style="margin-left: 8px;" @click="form.logo = ''">移除 Logo</el-button>
          <el-switch v-model="form.logoEnabledAll" active-text="Logo 總開關" style="margin-left: 16px;"></el-switch>
        </el-form-item>
        <el-form-item label="印 Logo 至">
          <el-switch v-model="form.logoEnabled" :disabled="!form.logoEnabledAll" active-text="結賬小票" style="margin-right: 16px;"></el-switch>
          <el-switch v-model="form.logoEnabledServing" :disabled="!form.logoEnabledAll" active-text="上菜紙" style="margin-right: 16px;"></el-switch>
          <el-switch v-model="form.logoEnabledPrint" :disabled="!form.logoEnabledAll" active-text="印單小票" style="margin-right: 16px;"></el-switch>
          <el-switch v-model="form.logoEnabledQrcode" :disabled="!form.logoEnabledAll" active-text="二維碼小票"></el-switch>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="save">保存設置</el-button>
          <el-switch v-model="form.autoPrint" active-text="下單自動打印" style="margin-left: 20px;"></el-switch>
        </el-form-item>
        <el-form-item label="文字轉圖打印">
          <el-switch v-model="form.imagePrint" active-text="感熱 (Thermal)"></el-switch>
          <el-switch v-model="form.dotImagePrint" active-text="針式 (Dot)" style="margin-left: 20px;"></el-switch>
          <div class="tip">無中文字庫打印機：感熱機整張文字轉圖輸出；針機以點陣圖放大（突破 2x2 字號）</div>
        </el-form-item>
        <el-form-item v-if="form.imagePrint">
          <el-alert
            title="感熱文字轉圖模式：中文將於伺服器端以點陣圖輸出（GS v 0），適用於不具中文字庫的感熱打印機。"
            type="info"
            :closable="false"
            show-icon>
          </el-alert>
        </el-form-item>
        <el-form-item v-if="form.imagePrint" label="熱敏字體">
          <el-select v-model="form.thermalFont" style="width: 180px;">
            <el-option label="思源黑體" value="noto"></el-option>
            <el-option label="思源宋體" value="serif"></el-option>
            <el-option label="華文黑體 Medium" value="stheiti"></el-option>
            <el-option label="Arial Unicode" value="arial"></el-option>
          </el-select>
          <span class="tip">熱敏圖像打印使用的中文字體</span>
        </el-form-item>
        <el-form-item v-if="form.imagePrint" label="熱敏文字粗度">
          <el-select v-model="form.imageWeight" style="width: 140px;">
            <el-option label="500（中粗）" :value="500"></el-option>
            <el-option label="550（中粗偏粗）" :value="550"></el-option>
            <el-option label="580（偏粗）" :value="580"></el-option>
            <el-option label="600（粗）" :value="600"></el-option>
            <el-option label="700（特粗）" :value="700"></el-option>
            <el-option label="800（最粗）" :value="800"></el-option>
          </el-select>
          <span class="tip">控制熱敏文字粗度</span>
        </el-form-item>
        <el-form-item v-if="form.dotImagePrint" label="針機文字粗度">
          <el-select v-model="form.dotImageWeight" style="width: 140px;">
            <el-option label="300（細）" :value="300"></el-option>
            <el-option label="400（標準）" :value="400"></el-option>
            <el-option label="500（中粗）" :value="500"></el-option>
            <el-option label="550（中粗偏粗）" :value="550"></el-option>
            <el-option label="570（偏粗）" :value="570"></el-option>
            <el-option label="600（粗）" :value="600"></el-option>
          </el-select>
          <span class="tip">控制針機文字粗度</span>
        </el-form-item>
        <el-form-item v-if="form.dotImagePrint" label="針機字體">
          <el-select v-model="form.dotImageFont" style="width: 180px;">
            <el-option label="思源黑體" value="noto"></el-option>
            <el-option label="思源宋體" value="serif"></el-option>
            <el-option label="華文黑體 Medium" value="stheiti"></el-option>
            <el-option label="Arial Unicode" value="arial"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.dotImagePrint" label="放大字號">
          <el-select v-model="form.dotImageSize" style="width: 180px;">
            <el-option label="25 dot" :value="25"></el-option>
            <el-option label="27 dot" :value="27"></el-option>
            <el-option label="29 dot" :value="29"></el-option>
            <el-option label="31 dot" :value="31"></el-option>
            <el-option label="32 dot" :value="32"></el-option>
          </el-select>
          <span class="tip">針式打印機以點陣圖輸出，放大內建字號</span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="box-card location-card">
      <div slot="header" class="clearfix">
        <span>檔口打印機隊列（Position Printer / Printer Queue）</span>
        <el-button type="primary" size="mini" style="float: right;" @click="save">保存設置</el-button>
        <el-button size="mini" type="primary" style="float: right; margin-right: 6px;" @click="addStation">+ 添加檔口</el-button>
      </div>
      <el-alert
        title="數據流：貨品 (Item) → 打印機隊列 (Printer Queue) → 位置打印機 (Position Printer)"
        type="warning"
        :closable="false"
        show-icon
        description="貨品管理裡給每個貨品選「打印機隊列」（檔口），下單時按隊列自動路由到對應的「位置打印機」打印。打印機隊列 (Printer Queue)：快蒸/慢蒸/腸粉煎炸/大排檔/上什/粉面/海鮮/冷盤/熱炒…，打印機隊列 (Printer Queue) 可隨意修改。">
      </el-alert>
      <el-alert
        title="跳飛流程說明"
        type="info"
        :closable="false"
        style="margin-top: 8px;">
        <div class="tip-block">
          <div>跳飛順序：<b>主機 → 第一備援機 → 第二備援機 → 廚房通用機</b>（最後防線）</div>
          <ul class="tip-list">
            <li>僅同技術：針式只跳針式、熱敏只跳熱敏；相同目標自動去重</li>
            <li>缺紙／開蓋／離線（未送出）不跳飛，改通知前台補紙／補單</li>
            <li>整條鏈合計預算由 POS 設定的「跳飛總時間」控制（30／45／75／90 秒），逾時即停止</li>
          </ul>
          <table class="hint-table">
            <thead>
              <tr><th>欄位</th><th>預設</th><th>說明</th></tr>
            </thead>
            <tbody>
              <tr><td>timeout</td><td>8000</td><td>單次連線逾時（逾時判離線，跳下一台）</td></tr>
              <tr><td>retries</td><td>1</td><td>首次失敗後額外重試次數</td></tr>
              <tr><td>retryDelay</td><td>400</td><td>重試間隔(ms)</td></tr>
            </tbody>
          </table>
        </div>
      </el-alert>
      <div v-for="(p, pi) in form.printers" :key="pi" class="station-box">
        <div class="station-head">
          <el-input v-model="p.name" placeholder="檔口名(如:快蒸)" style="width: 140px;"></el-input>
          <el-select v-model="p.model" placeholder="型號" clearable style="width: 175px; margin-left: 6px;" title="打印機型號（一鍵帶入 tech/dpi/紙寬）" @change="onModelChange(p)">
            <el-option v-for="o in modelOptions" :key="o.value" :label="o.label" :value="o.value"></el-option>
          </el-select>
          <el-select v-model="p.dineInMode" placeholder="堂食單" clearable style="width: 110px; margin-left: 6px;" title="堂食單">
            <el-option label="長單" value="long"></el-option>
            <el-option label="短單" value="short"></el-option>
          </el-select>
          <el-select v-model="p.takeawayMode" placeholder="外賣單" clearable style="width: 110px; margin-left: 6px;" title="外賣單">
            <el-option label="長單" value="long"></el-option>
            <el-option label="短單" value="short"></el-option>
          </el-select>
          <el-input-number v-model="p.copies" :min="1" :max="5" size="small" controls-position="right" style="width: 110px; margin-left: 6px;" title="列印份數"></el-input-number>
          <el-select v-model="p.role" style="width: 120px; margin-left: 6px;">
            <el-option label="廚房檔" value="kitchen"></el-option>
            <el-option label="水吧" value="bar"></el-option>
            <el-option label="收銀臺" value="cashier"></el-option>
            <el-option label="傳菜總檯" value="expeditor"></el-option>
          </el-select>
          <el-select v-model="p.tech" style="width: 130px; margin-left: 6px;">
            <el-option label="針式 (Dot)" value="dot"></el-option>
            <el-option label="感熱 (Thermal)" value="thermal"></el-option>
          </el-select>
          <el-select v-if="p.tech === 'thermal'" v-model="p.dpi" style="width: 90px; margin-left: 6px;" title="解析度">
            <el-option label="180dpi" :value="180"></el-option>
            <el-option label="203dpi" :value="203"></el-option>
          </el-select>
          <el-input v-model="p.ip" placeholder="打印機 IP" style="width: 130px; margin-left: 6px;"></el-input>
          <el-input-number v-model="p.port" :min="1" :max="65535" size="small" controls-position="right" style="width: 110px; margin-left: 6px;" title="端口"></el-input-number>
          <el-input-number v-model="p.timeout" :min="1000" :max="60000" :step="1000" size="small" controls-position="right" style="width: 130px; margin-left: 6px;" title="超時(ms)：連線逾時，逾時即跳飛備援機"></el-input-number>
          <el-input-number v-model="p.retries" :min="0" :max="10" size="small" controls-position="right" style="width: 90px; margin-left: 6px;" title="失敗重試次數（額外重試）"></el-input-number>
          <el-input-number v-model="p.retryDelay" :min="100" :max="10000" :step="100" size="small" controls-position="right" style="width: 120px; margin-left: 6px;" title="重試間隔(ms)"></el-input-number>
          <el-switch v-model="p.statusCheck" active-text="狀態檢查" style="margin-left: 8px;" title="DLE EOT 即時狀態檢查（缺紙/開蓋/離線）。USB 轉 LAN 列印伺服器不支援時建議關閉，可避免每單白等數秒"></el-switch>
          <el-select v-model="p.paperWidth" style="width: 90px; margin-left: 6px;" title="紙寬">
            <el-option :label="'58mm'" :value="58"></el-option>
            <el-option :label="'80mm'" :value="80"></el-option>
          </el-select>
          <el-select v-model="p.fallbackTo" clearable placeholder="備援機(可空)" style="width: 140px; margin-left: 6px;" title="主機離線時自動跳飛到此檔口（僅同技術：針式只列針式、熱敏只列熱敏）">
            <el-option v-for="o in otherStations(pi)" :key="o.name" :label="o.name" :value="o.name"></el-option>
          </el-select>
          <el-select v-model="p.fallbackTo2" clearable placeholder="第二備援機(可空)" style="width: 150px; margin-left: 6px;" title="第一備援機也離線時，跳飛到此檔口（僅同技術）">
            <el-option v-for="o in otherStations(pi)" :key="o.name" :label="o.name" :value="o.name"></el-option>
          </el-select>
          <span class="tip">主機離線時自動改印到同技術備援機，再失敗改印第二備援機</span>
          <el-switch v-if="p.role === 'cashier'" v-model="p.cashDrawer" active-text="錢箱" style="margin-left: 8px;"></el-switch>
          <el-button size="mini" type="success" @click="testLocation(p)" style="margin-left: 8px;">打印機測試</el-button>
          <el-button size="mini" type="warning" @click="testFallback(p)" style="margin-left: 8px;">測試備援</el-button>
          <el-button size="mini" type="danger" icon="el-icon-delete" @click="form.printers.splice(pi, 1)"></el-button>
        </div>
      </div>
    </el-card>

    <el-card class="box-card location-card">
      <div slot="header" class="clearfix">
        <span>小票打印指定（每種小票打印到哪臺位置打印機）</span>
        <el-button type="primary" size="mini" style="float: right;" @click="save">保存設置</el-button>
      </div>
      <el-form label-width="90px" size="small">
        <el-form-item label="後廚小票">
          <el-select v-model="form.ticketTargets.kitchen" clearable placeholder="自動分檔（按貨品檔口）" style="width: 320px;">
            <el-option label="自動分檔（按貨品檔口）" value=""></el-option>
            <el-option v-for="p in kitchenStations" :key="p.name" :label="p.name" :value="p.name"></el-option>
          </el-select>
          <span class="tip">選擇具體檔口則整張後廚單打印到該檔口</span>
        </el-form-item>
        <el-form-item label="結賬小票">
          <el-select v-model="form.ticketTargets.receipt" clearable placeholder="默認（收銀臺）" style="width: 320px;">
            <el-option label="默認（收銀臺）" value=""></el-option>
            <el-option v-for="p in allStations" :key="p.name" :label="p.name" :value="p.name"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="上菜紙">
          <el-select v-model="form.ticketTargets.serving" clearable placeholder="默認（傳菜總檯）" style="width: 320px;">
            <el-option label="默認（傳菜總檯）" value=""></el-option>
            <el-option v-for="p in allStations" :key="p.name" :label="p.name" :value="p.name"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="印單小票">
          <el-select v-model="form.ticketTargets.print" clearable placeholder="默認（收銀臺）" style="width: 320px;">
            <el-option label="默認（收銀臺）" value=""></el-option>
            <el-option v-for="p in allStations" :key="p.name" :label="p.name" :value="p.name"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="重印單據">
          <el-select v-model="form.ticketTargets.reprint" clearable placeholder="默認（收銀臺）" style="width: 320px;">
            <el-option label="默認（收銀臺）" value=""></el-option>
            <el-option v-for="p in allStations" :key="p.name" :label="p.name" :value="p.name"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="二維碼小票">
          <el-select v-model="form.ticketTargets.qrcode" clearable placeholder="默認（傳菜總檯）" style="width: 320px;">
            <el-option label="默認（傳菜總檯）" value=""></el-option>
            <el-option v-for="p in allStations" :key="p.name" :label="p.name" :value="p.name"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="點餐碼">
          <el-select v-model="form.ticketTargets.tableqr" clearable placeholder="默認（沿用二維碼/收據）" style="width: 320px;">
            <el-option label="默認（沿用二維碼/收據）" value=""></el-option>
            <el-option v-for="p in allStations" :key="p.name" :label="p.name" :value="p.name"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="追單小票">
          <el-select v-model="form.ticketTargets.chase" clearable placeholder="自動分檔（按貨品檔口）" style="width: 320px;">
            <el-option label="自動分檔（按貨品檔口）" value=""></el-option>
            <el-option v-for="p in kitchenStations" :key="p.name" :label="p.name" :value="p.name"></el-option>
          </el-select>
          <span class="tip">追單小票打印到指定檔口（或自動按貨品檔口分拆）</span>
        </el-form-item>
        <el-form-item label="打柯單（班地厘訊息）">
          <el-select v-model="form.ticketTargets.pantry" clearable placeholder="默認（廚房通用機）" style="width: 320px;">
            <el-option label="默認（廚房通用機）" value=""></el-option>
            <el-option v-for="p in kitchenStations" :key="p.name" :label="p.name" :value="p.name"></el-option>
          </el-select>
          <span class="tip">打柯單訊息打印到指定檔口（默認廚房通用機）</span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="box-card location-card">
      <div slot="header" class="clearfix">
        <span>座位分區打印機（Zone Printing）</span>
        <el-button size="mini" type="primary" style="float: right;" @click="addZone">+ 添加分區</el-button>
      </div>
      <el-alert
        title="分區說明"
        type="info"
        :closable="false"
        show-icon
        description="適合大面積餐廳（一樓小吃區/二樓包廂/戶外花園）。按桌號歸屬區域，下單同步打印「預結單」到該區服務檯，結賬發票從該區收銀機出。">
      </el-alert>
      <div v-for="(z, zi) in form.zones" :key="zi" class="zone-box">
        <el-form inline size="small">
          <el-form-item label="區域名">
            <el-input v-model="z.name" placeholder="如:二樓包廂" style="width:130px;"></el-input>
          </el-form-item>
          <el-form-item label="桌號">
            <el-input v-model="z.desksText" placeholder="逗號分隔,如 11,12,13" style="width:210px;"></el-input>
          </el-form-item>
          <el-form-item label="服務檯IP">
            <el-input v-model="z.serviceIp" placeholder="預結單打印機" style="width:140px;"></el-input>
          </el-form-item>
          <el-form-item label="收銀IP">
            <el-input v-model="z.cashierIp" placeholder="發票打印機" style="width:140px;"></el-input>
          </el-form-item>
          <el-button type="danger" size="mini" icon="el-icon-delete" @click="form.zones.splice(zi, 1)"></el-button>
        </el-form>
      </div>
    </el-card>

    <el-card class="box-card location-card">
      <div slot="header" class="clearfix">
        <span>中央埋單印表機（功能鍵「中央埋單」印單專用）</span>
        <el-button type="primary" size="mini" style="float: right;" @click="save">保存設置</el-button>
      </div>
      <el-form inline size="small">
        <el-form-item label="型號">
          <el-select v-model="form.centralPrint.model" placeholder="型號" clearable style="width: 200px;" title="打印機型號（一鍵帶入 tech/dpi/紙寬）" @change="onModelChange(form.centralPrint)">
            <el-option v-for="o in modelOptions" :key="o.value" :label="o.label" :value="o.value"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="技術">
          <el-select v-model="form.centralPrint.tech" style="width: 130px;">
            <el-option label="針式 (Dot)" value="dot"></el-option>
            <el-option label="感熱 (Thermal)" value="thermal"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.centralPrint.tech === 'thermal'" label="解析度">
          <el-select v-model="form.centralPrint.dpi" style="width: 90px;">
            <el-option label="180dpi" :value="180"></el-option>
            <el-option label="203dpi" :value="203"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="IP">
          <el-input v-model="form.centralPrint.ip" placeholder="打印機 IP" style="width: 150px;"></el-input>
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="form.centralPrint.port" :min="1" :max="65535" size="small" controls-position="right"></el-input-number>
        </el-form-item>
        <el-form-item label="紙寬">
          <el-select v-model="form.centralPrint.paperWidth" style="width: 90px;">
            <el-option :label="'58mm'" :value="58"></el-option>
            <el-option :label="'80mm'" :value="80"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="份數">
          <el-input-number v-model="form.centralPrint.copies" :min="1" :max="5" size="small" controls-position="right"></el-input-number>
        </el-form-item>
      </el-form>
      <el-alert
        title="當 POS 按下「中央埋單」功能鍵時，印單小票會直接打印到這裡指定的印表機（與各收銀機的印單印表機無關）。"
        type="info"
        :closable="false"
        show-icon>
      </el-alert>
    </el-card>

    <el-card class="box-card format-card">
      <div slot="header" class="clearfix">
        <span>小票格式設置</span>
        <el-radio-group v-model="formatTech" size="mini" style="margin-left: 16px;">
          <el-radio-button label="thermal">熱敏打印機</el-radio-button>
          <el-radio-button label="dot">針式打印機</el-radio-button>
        </el-radio-group>
        <el-button type="primary" size="mini" style="float: right;" @click="save">保存設置</el-button>
      </div>
      <printer-format
        :format="currentFormat"
        :shop-name="form.shopName"
        :address="form.address"
        :phone="form.phone"
        :footer="form.footer"
        :logo="form.logo"
        :logo-enabled-all="form.logoEnabledAll"
        :logo-enabled="form.logoEnabled"
        :logo-enabled-serving="form.logoEnabledServing"
        :logo-enabled-print="form.logoEnabledPrint"
        :logo-enabled-qrcode="form.logoEnabledQrcode">
      </printer-format>
    </el-card>
  </div>
</template>

<script>
import PrinterFormat from '../../components/admin/PrinterFormat'

// 打印機型號預設：選型號一鍵帶入 tech / dpi / 紙寬
const PRINTER_MODELS = {
  tmt88: { tech: 'thermal', dpi: 180, paperWidth: 80 },
  xp80ts: { tech: 'thermal', dpi: 203, paperWidth: 80 },
  tmu220: { tech: 'dot', dpi: 180 }
}

const DEFAULT_FORMAT = {
  kitchen: {
    title: '後廚小票',
    order: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'waiter', 'sendWaiter', 'people', 'station', 'orderNoStation', 'dateSendTimeWaiter', 'divider2', 'items', 'items2', 'items3', 'total', 'divider3', 'remark', 'time', 'sendTime', 'deskNo2', 'divider4'],
    fields: {
      title: { show: true, size: 1, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 1, align: 'left' },
      deskNo2: { show: true, size: 1, align: 'right' },
      orderNo: { show: true, size: 1, align: 'left' },
      orderNoStation: { show: false, size: 1, align: 'left' },
      dateSendTimeWaiter: { show: false, size: 1, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      sendWaiter: { show: true, size: 1, align: 'left' },
      people: { show: true, size: 1, align: 'left' },
      station: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      items2: { show: false, size: 1, align: 'left' },
      items3: { show: true, size: 1, align: 'left' },
      total: { show: true, size: 1, align: 'right' },
      mods: { show: true, size: 1, align: 'left' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      sendTime: { show: true, size: 1, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  receipt: {
    title: '結賬小票',
    order: ['shopName', 'title', 'address', 'phone', 'divider1', 'deskNo', 'orderNo', 'waiter', 'sendWaiter', 'people', 'divider2', 'items', 'items2', 'items3', 'divider3', 'total', 'serviceCharge', 'grandTotal', 'payMethod', 'remark', 'time', 'sendTime', 'date', 'divider4', 'footer'],
    fields: {
      title: { show: true, size: 1, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      address: { show: true, size: 1, align: 'center' },
      phone: { show: true, size: 1, align: 'center' },
      deskNo: { show: true, size: 1, align: 'left' },
      orderNo: { show: true, size: 1, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      sendWaiter: { show: true, size: 1, align: 'left' },
      people: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      items2: { show: false, size: 1, align: 'left' },
      items3: { show: true, size: 1, align: 'left' },
      mods: { show: true, size: 1, align: 'left' },
      total: { show: true, size: 1, align: 'right' },
      serviceCharge: { show: true, size: 1, align: 'right' },
      grandTotal: { show: true, size: 4, align: 'right' },
      payMethod: { show: true, size: 1, align: 'right' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      sendTime: { show: true, size: 1, align: 'left' },
      date: { show: true, size: 1, align: 'left' },
      footer: { show: true, size: 1, align: 'center' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '-' }
    }
  },
  serving: {
    title: '上菜紙',
    order: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'waiter', 'sendWaiter', 'people', 'date', 'divider2', 'items', 'items2', 'items3', 'divider3', 'remark', 'time', 'sendTime', 'footer', 'divider4'],
    fields: {
      title: { show: true, size: 1, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 4, align: 'center' },
      orderNo: { show: true, size: 1, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      sendWaiter: { show: true, size: 1, align: 'left' },
      people: { show: true, size: 1, align: 'left' },
      date: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      items2: { show: false, size: 1, align: 'left' },
      items3: { show: true, size: 1, align: 'left' },
      mods: { show: true, size: 1, align: 'left' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      sendTime: { show: true, size: 1, align: 'left' },
      footer: { show: true, size: 1, align: 'center' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  print: {
    title: '印單小票',
    order: ['shopName', 'title', 'address', 'phone', 'divider1', 'deskNo', 'barcode', 'deskNoBig', 'orderNo', 'reprint', 'waiter', 'sendWaiter', 'people', 'divider2', 'items', 'items2', 'items3', 'divider3', 'total', 'serviceCharge', 'grandTotal', 'remark', 'time', 'sendTime', 'date', 'divider4'],
    fields: {
      title: { show: true, size: 1, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      address: { show: true, size: 1, align: 'center' },
      phone: { show: true, size: 1, align: 'center' },
      deskNo: { show: true, size: 4, align: 'center' },
      deskNoBig: { show: true, size: 5, align: 'left' },
      barcode: { show: false, size: 1 },
      orderNo: { show: true, size: 1, align: 'left' },
      reprint: { show: true, size: 2, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      sendWaiter: { show: true, size: 1, align: 'left' },
      people: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      items2: { show: false, size: 1, align: 'left' },
      items3: { show: true, size: 1, align: 'left' },
      mods: { show: true, size: 1, align: 'left' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      sendTime: { show: true, size: 1, align: 'left' },
      date: { show: true, size: 1, align: 'left' },
      total: { show: true, size: 4, align: 'right' },
      serviceCharge: { show: true, size: 1, align: 'right' },
      grandTotal: { show: true, size: 4, align: 'right' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  qrcode: {
    title: '二維碼小票',
    order: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'waiter', 'divider2', 'time', 'divider3'],
    fields: {
      title: { show: true, size: 1, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 4, align: 'center' },
      orderNo: { show: true, size: 1, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      qr: { show: true, size: 2 },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '=' }
    }
  },
  tableqr: {
    title: '掃碼點餐',
    order: ['shopName', 'title', 'deskNo', 'barcode', 'orderNo', 'date', 'time', 'hint', 'divider1'],
    fields: {
      title: { show: true, size: 3, align: 'center' },
      shopName: { show: true, size: 3, align: 'center' },
      deskNo: { show: true, size: 3, align: 'center' },
      barcode: { show: false, size: 1 },
      orderNo: { show: true, size: 1, align: 'left' },
      date: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      hint: { show: true, size: 1, align: 'center' },
      qr: { show: true, size: 3 },
      divider1: { show: true, type: '-' }
    }
  },
  chase: {
    title: '【追單】',
    order: ['title', 'shopName', 'divider1', 'deskNo', 'orderNo', 'waiter', 'sendWaiter', 'people', 'divider2', 'items', 'items2', 'items3', 'divider3', 'remark', 'time', 'sendTime', 'divider4'],
    fields: {
      title: { show: true, size: 4, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 4, align: 'center' },
      orderNo: { show: true, size: 1, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      sendWaiter: { show: true, size: 1, align: 'left' },
      people: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      items2: { show: false, size: 1, align: 'left' },
      items3: { show: true, size: 1, align: 'left' },
      mods: { show: true, size: 1, align: 'left' },
      remark: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      sendTime: { show: true, size: 1, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  pantry: {
    title: '【班地厘訊息】',
    order: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'divider2', 'message', 'divider3', 'waiter', 'time', 'divider4'],
    fields: {
      title: { show: true, size: 4, align: 'center' },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 1, align: 'left' },
      orderNo: { show: true, size: 1, align: 'left' },
      message: { show: true, size: 3, align: 'left' },
      mods: { show: true, size: 1, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  },
  cancelitem: {
    title: '已取消',
    order: ['shopName', 'title', 'divider1', 'deskNo', 'orderNo', 'waiter', 'divider2', 'items', 'reason', 'divider3', 'time', 'divider4'],
    fields: {
      title: { show: true, size: 3, align: 'center', bold: true },
      shopName: { show: true, size: 4, align: 'center' },
      deskNo: { show: true, size: 1, align: 'left' },
      orderNo: { show: true, size: 1, align: 'left' },
      waiter: { show: true, size: 1, align: 'left' },
      items: { show: true, size: 1, align: 'left' },
      reason: { show: true, size: 1, align: 'left' },
      time: { show: true, size: 1, align: 'left' },
      divider1: { show: true, type: '=' },
      divider2: { show: true, type: '-' },
      divider3: { show: true, type: '-' },
      divider4: { show: true, type: '=' }
    }
  }
}

function withBoldDefaults () {
  const fmt = JSON.parse(JSON.stringify(DEFAULT_FORMAT))
  Object.keys(fmt).forEach(type => {
    const fields = fmt[type] && fmt[type].fields
    if (!fields) return
    Object.keys(fields).forEach(k => {
      if (fields[k] && fields[k].bold === undefined) fields[k].bold = false
    })
  })
  return fmt
}

function defaultPrinters () {
  const kitchen = ['冷盤', '熱炒', '點心', '燉湯', '快蒸', '慢蒸', '腸粉煎炸', '大排檔', '上什', '粉面', '海鮮']
  const list = kitchen.map(name => ({
    name, role: 'kitchen', dineInMode: 'long', takeawayMode: '', tech: 'dot', ip: '', port: 9100, paperWidth: 80, copies: 2, cashDrawer: false, fallbackTo: '', fallbackTo2: '', timeout: 8000, retries: 1, retryDelay: 400, statusCheck: true, model: '', dpi: 180
  }))
  list.push({ name: '水吧', role: 'bar', dineInMode: 'long', takeawayMode: '', tech: 'thermal', ip: '', port: 9100, paperWidth: 58, copies: 1, cashDrawer: false, fallbackTo: '', fallbackTo2: '', timeout: 8000, retries: 1, retryDelay: 400, statusCheck: true, model: '', dpi: 180 })
  list.push({ name: '外賣', role: 'kitchen', dineInMode: '', takeawayMode: 'long', tech: 'thermal', ip: '', port: 9100, paperWidth: 58, copies: 1, cashDrawer: false, fallbackTo: '', fallbackTo2: '', timeout: 8000, retries: 1, retryDelay: 400, statusCheck: true, model: '', dpi: 180 })
  list.push({ name: '收銀臺', role: 'cashier', dineInMode: '', takeawayMode: '', tech: 'thermal', ip: '', port: 9100, paperWidth: 58, copies: 1, cashDrawer: true, fallbackTo: '', fallbackTo2: '', timeout: 8000, retries: 1, retryDelay: 400, statusCheck: true, model: '', dpi: 180 })
  list.push({ name: '傳菜總檯', role: 'expeditor', dineInMode: '', takeawayMode: '', tech: 'thermal', ip: '', port: 9100, paperWidth: 80, copies: 1, cashDrawer: false, fallbackTo: '', fallbackTo2: '', timeout: 8000, retries: 1, retryDelay: 400, statusCheck: true, model: '', dpi: 180 })
  return list
}

function flattenOrder (order) {
  const out = []
  for (const item of order || []) {
    if (Array.isArray(item)) out.push(...item)
    else out.push(item)
  }
  return out
}

export default {
  name: 'printer',
  data () {
    return {
      formatTech: 'thermal',
      form: {
        shopName: '',
        phone: '',
        address: '',
        footer: '謝謝惠顧，歡迎再次光臨',
        logo: '',
        logoEnabledAll: true,
        logoEnabled: true,
        logoEnabledServing: false,
        logoEnabledPrint: false,
        logoEnabledQrcode: false,
        charset: 'big5',
        autoPrint: false,
        imagePrint: false,
        imageWeight: 400,
        thermalFont: 'noto',
        dotImagePrint: false,
        dotImageSize: 31,
        dotImageFont: 'noto',
        dotImageWeight: 400,
        format: withBoldDefaults(),
        formatDot: withBoldDefaults(),
        printers: defaultPrinters(),
        ticketTargets: { kitchen: '', receipt: '', serving: '', print: '', reprint: '', qrcode: '', tableqr: '', chase: '', pantry: '' },
        zones: [],
        centralPrint: { ip: '', port: 9100, tech: 'thermal', model: '', dpi: 180, paperWidth: 58, copies: 1 }
      }
    }
  },
  computed: {
    logoPreview () {
      return this.form.logo ? '/' + this.form.logo : ''
    },
    currentFormat () {
      return this.formatTech === 'dot' ? this.form.formatDot : this.form.format
    },
    kitchenStations () {
      return (this.form.printers || []).filter(p => p.role === 'kitchen' || p.role === 'bar')
    },
    allStations () {
      return (this.form.printers || []).filter(p => p.name && p.name.trim() !== '')
    },
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
    beforeLogoUpload (file) {
      const isImg = /\.(png|jpe?g|gif|bmp)$/i.test(file.name)
      if (!isImg) {
        this.$message({ type: 'error', message: '請上傳圖片檔（png/jpg/gif/bmp）' })
        return false
      }
      if (file.size > 2 * 1024 * 1024) {
        this.$message({ type: 'error', message: '圖片不能超過 2MB' })
        return false
      }
      return true
    },
    uploadLogo (params) {
      const file = params.file
      const form = new FormData()
      form.append('file', file)
      this.$axios.post('/api/printer/uploadLogo', form, {
        headers: { 'content-type': 'multipart/form-data' }
      })
        .then(res => {
          if (res.data && res.data.status === 'ok') {
            this.form.logo = res.data.logo
            this.$message({ type: 'success', message: 'Logo 上傳成功' })
          } else {
            this.$message({ type: 'error', message: 'Logo 上傳失敗，請重試！' })
          }
        })
        .catch(err => {
          console.log(err)
          this.$message({ type: 'error', message: 'Logo 上傳失敗，請重試！' })
        })
    },
    loadData () {
      this.$axios.get('/api/printer/get')
        .then(res => {
          const d = res.data || {}
          if (d._id) {
            this.form = Object.assign({}, this.form, d)
            // 舊數據無 Logo 總開關欄位：預設開啟
            if (d.logoEnabledAll === undefined) this.form.logoEnabledAll = true
            // 舊數據無針機字重欄位：沿用原本共用的 imageWeight
            if (d.dotImageWeight === undefined) this.form.dotImageWeight = d.imageWeight || 400
            // 舊數據無熱敏字體欄位：預設思源黑體
            if (d.thermalFont === undefined) this.form.thermalFont = 'noto'
            // 兼容舊數據：location → name/role
            if (this.form.printers && this.form.printers.length) {
              this.form.printers.forEach(p => {
                if (!p.role && p.location) p.role = p.location
                if (!p.name && p.location) p.name = p.location
                if (p.fallbackTo === undefined) p.fallbackTo = ''
                if (p.fallbackTo2 === undefined) p.fallbackTo2 = ''
                if (p.timeout === undefined) p.timeout = 8000
                if (p.retries === undefined) p.retries = 1
                if (p.retryDelay === undefined) p.retryDelay = 400
                if (p.statusCheck === undefined) p.statusCheck = true
                if (p.model === undefined) p.model = ''
                if (p.dpi === undefined) p.dpi = 180
                if (!p.dineInMode && !p.takeawayMode) {
                  if (p.name === '外賣') p.takeawayMode = 'long'
                  else if (p.role === 'kitchen' || p.role === 'bar') p.dineInMode = 'long'
                }
              })
            } else {
              this.form.printers = defaultPrinters()
            }
            this.applyFormats('format', d.format)
            this.applyFormats('formatDot', d.formatDot || d.format)
            this.form.zones = (d.zones || []).map(z => Object.assign({}, z, {
              desksText: (z.desks || []).join(',')
            }))
            this.form.ticketTargets = Object.assign({ kitchen: '', receipt: '', serving: '', print: '', reprint: '', qrcode: '', tableqr: '', chase: '', pantry: '' }, d.ticketTargets || {})
            this.form.centralPrint = Object.assign({ ip: '', port: 9100, tech: 'thermal', model: '', dpi: 180, paperWidth: 58, copies: 1 }, d.centralPrint || {})
          } else {
            this.$axios.get('/api/shop/get').then(r => {
              if (r.data && r.data.shopName) this.form.shopName = r.data.shopName
            })
          }
        })
        .catch(err => console.log(err))
    },
    applyFormats (key, source) {
      this.$set(this.form, key, {})
      ;['kitchen', 'receipt', 'serving', 'print', 'qrcode', 'tableqr', 'chase', 'pantry', 'cancelitem'].forEach(type => {
        const base = JSON.parse(JSON.stringify(DEFAULT_FORMAT[type]))
        const custom = (source && source[type]) || {}
        const customFields = Object.assign({}, custom.fields || {})
        // 舊資料無 order 陣列，且 size 2 為舊「放大」→ 遷移為新「超大」(4)
        if (!custom.order || !custom.order.length) {
          Object.keys(customFields).forEach(k => {
            if (customFields[k] && customFields[k].size === 2) customFields[k].size = 4
          })
        }
        const merged = Object.assign({}, base, custom)
        // 欄位向後相容：order 需包含全部默認常規欄位與分隔線，否則套用新默認 order
        if (!merged.order || !merged.order.length) {
          merged.order = base.order
        } else {
          const flatOrder = flattenOrder(merged.order)
          const defaultRegular = base.order.filter(k => k && k.indexOf('divider') !== 0)
          const defaultDivider = base.order.filter(k => k && k.indexOf('divider') === 0)
          const hasAllRegular = defaultRegular.every(k => flatOrder.indexOf(k) >= 0)
          const hasDivider = (defaultDivider.length === 0) || flatOrder.some(k => k && k.indexOf('divider') === 0)
          if (hasAllRegular && hasDivider) {
            merged.order = custom.order
          } else if (hasDivider) {
            const missing = defaultRegular.filter(k => flatOrder.indexOf(k) < 0)
            const order = custom.order.slice()
            let insertAt = order.length
            for (let i = order.length - 1; i >= 0; i--) {
              const it = order[i]
              if (typeof it === 'string' && it.indexOf('divider') === 0) { insertAt = i; break }
            }
            order.splice(insertAt, 0, ...missing)
            merged.order = order
          } else {
            merged.order = base.order
          }
        }
        merged.fields = Object.assign({}, base.fields, customFields)
        Object.keys(merged.fields).forEach(k => {
          if (merged.fields[k] && merged.fields[k].bold === undefined) merged.fields[k].bold = false
          if (k === 'barcode' && merged.fields[k] && merged.fields[k].size === undefined) merged.fields[k].size = 1
        })
        this.$set(this.form[key], type, merged)
      })
    },
    addStation () {
      this.form.printers.push({ name: '', role: 'kitchen', dineInMode: 'long', takeawayMode: '', tech: 'dot', ip: '', port: 9100, paperWidth: 80, copies: 1, cashDrawer: false, fallbackTo: '', fallbackTo2: '', timeout: 8000, retries: 1, retryDelay: 400, statusCheck: true, model: '', dpi: 180 })
    },
    addZone () {
      this.form.zones.push({ name: '', desksText: '', serviceIp: '', servicePort: 9100, cashierIp: '', cashierPort: 9100 })
    },
    onModelChange (p) {
      const m = PRINTER_MODELS[p.model]
      if (m) {
        p.tech = m.tech
        p.dpi = m.dpi
        if (m.paperWidth) p.paperWidth = m.paperWidth
      }
    },
    save () {
      const payload = JSON.parse(JSON.stringify(this.form))
      payload.printers = (this.form.printers || []).filter(p => p.name && p.name.trim() !== '')
      payload.zones = (this.form.zones || [])
        .filter(z => z.name && z.name.trim() !== '')
        .map(z => ({
          name: z.name,
          desks: (z.desksText || '').split(',').map(s => Number(s.trim())).filter(n => !isNaN(n)),
          serviceIp: z.serviceIp || '',
          servicePort: z.servicePort || 9100,
          cashierIp: z.cashierIp || '',
          cashierPort: z.cashierPort || 9100
        }))
      this.$axios.post('/api/printer/save', payload)
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '保存失敗' }))
    },
    testPrinter () {
      const printer = (this.form.printers || []).find(p => p.ip && p.port)
      if (!printer) {
        this.$message({ type: 'warning', message: '請先設定打印機 IP 和端口' })
        return
      }
      const payload = Object.assign({}, this.form, printer)
      this.$axios.post('/api/printer/test', payload)
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '測試打印失敗' }))
    },
    testLocation (p) {
      const payload = Object.assign({}, this.form, p, {
        shopName: this.form.shopName,
        phone: this.form.phone,
        address: this.form.address,
        footer: this.form.footer
      })
      this.$axios.post('/api/printer/test', payload)
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '測試打印失敗' }))
    },
    otherStations (pi) {
      const cur = this.form.printers[pi]
      const curTech = (cur && cur.tech) || 'dot'
      return (this.form.printers || []).filter((p, i) => i !== pi && p.name && p.name.trim() !== '' && ((p.tech || 'dot') === curTech))
    },
    testFallback (p) {
      if (!p.fallbackTo) {
        this.$message({ type: 'warning', message: '該檔口未設置備援機' })
        return
      }
      const payload = Object.assign({}, this.form, p, {
        stationName: p.name,
        shopName: this.form.shopName,
        phone: this.form.phone,
        address: this.form.address,
        footer: this.form.footer
      })
      this.$axios.post('/api/printer/testFallback', payload)
        .then(res => this.$message({ type: 'success', message: res.data }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '測試備援失敗' }))
    }
  },
  mounted () {
    this.loadData()
  },
  components: {
    PrinterFormat
  }
}
</script>

<style scoped>
.box-card{ width: 100%; }
.location-card{ width: 100%; margin-top: 16px; }
.format-card{ width: 100%; margin-top: 16px; }
.tip{ font-size: 12px; color: #909399; margin-left: 8px; }
.station-box{ border: 1px solid #ebeef5; border-radius: 4px; padding: 10px 12px; margin-top: 10px; background: #fafafa; }
.station-head{ display: flex; align-items: center; flex-wrap: wrap; gap: 2px; }
.zone-box{ border: 1px solid #ebeef5; border-radius: 4px; padding: 10px 12px; margin-top: 10px; background: #fafafa; }
.logo-uploader{ display: inline-block; }
.logo-uploader .el-upload{ border: 1px dashed #d9d9d9; border-radius: 6px; cursor: pointer; position: relative; overflow: hidden; width: 120px; height: 60px; }
.logo-uploader .el-upload:hover{ border-color: #409EFF; }
.logo-uploader-icon{ font-size: 26px; color: #8c939d; width: 120px; height: 60px; line-height: 60px; text-align: center; }
.logo-preview{ width: 120px; height: 60px; object-fit: contain; background: #fff; display: block; }
.hint-table{ width: 100%; border-collapse: collapse; font-size: 12px; color: #5e6d82; }
.hint-table th, .hint-table td{ border: 1px solid #ebeef5; padding: 4px 8px; text-align: left; }
.hint-table th{ background: #f5f7fa; color: #303133; font-weight: 600; }
.tip-block{ font-size: 13px; color: #5e6d82; line-height: 1.8; }
.tip-list{ margin: 6px 0 8px; padding-left: 18px; }
</style>
