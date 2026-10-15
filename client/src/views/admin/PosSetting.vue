<template>
  <div id="possetting">
    <el-card class="box-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-s-tools hd-icon"></i><span>POS 功能設定</span>
      </div>
      <div class="func-code-ref">
        <div class="func-ref-title"><i class="el-icon-document"></i> 功能鍵編號對照表</div>
        <div class="func-ref-grid">
          <span v-for="b in funcRefList" :key="b.funcCode" class="func-ref-item">[{{ b.funcCode }}] {{ b.label }}</span>
        </div>
      </div>
      <el-form ref="form" :model="form" label-width="140px">
        <el-form-item label="訂單編號前綴">
          <div style="display:flex; gap:16px; align-items:center;">
            <div>
              <div style="font-size:12px; color:#606266; margin-bottom:2px;">堂食</div>
              <el-input v-model="form.dineInPrefix" size="small" placeholder="留空預設 10" style="width: 160px;"></el-input>
            </div>
            <div>
              <div style="font-size:12px; color:#606266; margin-bottom:2px;">外賣枱</div>
              <el-input v-model="form.takeawayTablePrefix" size="small" placeholder="留空預設 99" style="width: 160px;"></el-input>
            </div>
            <div>
              <div style="font-size:12px; color:#606266; margin-bottom:2px;">外賣</div>
              <el-input v-model="form.takeawayPrefix" size="small" placeholder="留空預設 88" style="width: 160px;"></el-input>
            </div>
          </div>
          <div class="rounding-hint">訂單號格式：前綴 + 流水號。堂食留空預設 10，外賣枱留空預設 99，外賣留空預設 88。</div>
        </el-form-item>
        <el-form-item label="外賣枱枱號範圍">
          <div style="display:flex; gap:16px; align-items:center;">
            <div>
              <div style="font-size:12px; color:#606266; margin-bottom:2px;">起</div>
              <el-input v-model="form.takeawayTableFrom" size="small" placeholder="預設 901" style="width: 160px;"></el-input>
            </div>
            <div>
              <div style="font-size:12px; color:#606266; margin-bottom:2px;">訖</div>
              <el-input v-model="form.takeawayTableTo" size="small" placeholder="預設 999" style="width: 160px;"></el-input>
            </div>
          </div>
          <div class="rounding-hint">外賣枱區域內、枱號落在起訖範圍內（含）時，票據枱號前顯示「外賣」二字（例如：外賣901）。留空則起預設 901、訖預設 999。</div>
        </el-form-item>
        <el-form-item label="加一服務費">
          <el-switch v-model="form.serviceChargeEnabled" active-text="開啟" inactive-text="關閉"></el-switch>
        </el-form-item>
        <el-form-item label="服務費率">
          <el-input-number v-model="form.serviceChargeRate" :min="0" :max="100" :disabled="!form.serviceChargeEnabled"></el-input-number>
          <span class="unit">%</span>
        </el-form-item>
        <el-form-item label="折前服務費">
          <el-switch v-model="form.serviceChargePreDiscount" active-text="開啟" inactive-text="關閉" :disabled="!form.serviceChargeEnabled"></el-switch>
          <div class="rounding-hint">開啟＝服務費以「商品總額」計算（折前）；關閉＝服務費以「折扣後金額」計算（折後）</div>
        </el-form-item>
        <el-form-item label="應付金額取整">
          <el-select v-model="form.roundingMode" style="width: 100%;">
            <el-option label="不取整（維持原金額）" value="none"></el-option>
            <el-option label="四舍五入（到 $1）" value="normal"></el-option>
            <el-option label="始終進位（Round Up）到 $1" value="up"></el-option>
            <el-option label="始終抹零（Round Down）到 $1" value="down"></el-option>
          </el-select>
          <div class="rounding-hint">
            <span v-if="form.roundingMode === 'normal'">例：$45.3→$45 ／ $45.5→$46 ／ $45.8→$46</span>
            <span v-else-if="form.roundingMode === 'up'">例：$45.1→$46 ／ $45.5→$46 ／ $45.9→$46</span>
            <span v-else-if="form.roundingMode === 'down'">例：$45.1→$45 ／ $45.5→$45 ／ $45.9→$45</span>
          </div>
        </el-form-item>
        <el-form-item label="搭枱功能">
          <el-switch v-model="form.shareTableEnabled" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，點選枱號時會先顯示搭枱選項，支持 A/B/C/D 四組搭枱</div>
        </el-form-item>
        <el-form-item label="顯示食品圖片">
          <el-switch v-model="form.showFoodImages" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">關閉後，POS 入單版面改為只係純文字菜名</div>
        </el-form-item>
        <el-form-item label="手勢功能">
          <el-switch v-model="form.gestureEnabled" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，POS 入單版面支持：左撥顯示明細／右撥隱藏／雙擊單項刪除／三擊整單刪除</div>
        </el-form-item>
        <el-form-item label="營業日截止時間">
          <el-time-picker v-model="form.businessDayCutoff" format="HH:mm" value-format="HH:mm" placeholder="選擇截止時間"></el-time-picker>
          <div class="rounding-hint">每日結算會以此時刻切換營業日。例：03:00 表示凌晨 3 點前仍算前一天。</div>
        </el-form-item>
        <el-form-item label="數字鍵盤數量模式">
          <el-radio-group v-model="form.sideQtyMode">
            <el-radio label="pending">方案一：預設數量</el-radio>
            <el-radio label="select">方案二：選中修改數量</el-radio>
          </el-radio-group>
          <div class="rounding-hint">
            <span v-if="form.sideQtyMode === 'pending'">先輸入數字再按「數量」，下一個加入的菜品會自動套用該數量。</span>
            <span v-else>先點選清單中的菜品（高亮），再按「數量」修改該菜品數量。</span>
          </div>
        </el-form-item>
        <el-form-item label="改碼顯示方式">
          <el-radio-group v-model="form.modCodeUIMode">
            <el-radio label="A">方案 A：列表多選</el-radio>
            <el-radio label="B">方案 B：品項編輯</el-radio>
          </el-radio-group>
          <div class="rounding-hint">
            <span v-if="form.modCodeUIMode === 'A'">點選改碼類別後，以列表多選改碼（highlight 已選），撳「完成」套用。</span>
            <span v-else>點選改碼類別後，開啟「品項編輯」多選 Chip 介面，只顯示該類別改碼。</span>
          </div>
        </el-form-item>
        <el-form-item label="印單重印權限">
          <el-select v-model="form.reprintMinLevel" style="width: 220px;">
            <el-option :value="1" label="服務員以上可重印"></el-option>
            <el-option :value="2" label="收銀員以上可重印"></el-option>
            <el-option :value="3" label="經理以上可重印"></el-option>
            <el-option :value="4" label="管理員可重印"></el-option>
          </el-select>
          <div class="rounding-hint">此等級以下的員工，印單鍵只能印一次；此等級以上可重複印單。</div>
        </el-form-item>
        <el-form-item label="堂食印單次數">
          <el-input-number v-model="form.dineInPrintCopies" :min="1" :max="9" style="width: 220px;"></el-input-number>
          <div class="rounding-hint">按下「印單」時，堂食（枱號）印單小票的印製次數。</div>
        </el-form-item>
        <el-form-item label="外賣印單次數">
          <el-input-number v-model="form.takeawayPrintCopies" :min="1" :max="9" style="width: 220px;"></el-input-number>
          <div class="rounding-hint">按下「印單」時，外賣枱／外賣印單小票的印製次數。</div>
        </el-form-item>
        <el-form-item label="茶芥必選項目">
          <el-switch v-model="form.teaChargesRequired" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，結帳／印單需有「必選項目」貨品在單內，否則提示「未入茶芥」並阻擋。</div>
        </el-form-item>
        <el-form-item label="必選分類">
          <el-select v-model="form.requiredCategoryId" placeholder="選擇提示後自動跳轉的分類" clearable filterable style="width: 100%;">
            <el-option v-for="c in categoryList" :key="c.id" :label="(c.parentName ? c.parentName + ' / ' : '') + c.name" :value="c.id"></el-option>
          </el-select>
          <div class="rounding-hint">提示「未入茶芥」後，POS 會自動跳轉到該分類方便快速加入必選項目。</div>
        </el-form-item>
        <el-form-item label="茶位自動同步人數">
          <el-switch v-model="form.teaSeatSyncPax" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，印單／現金結帳／結帳時，會以茶芥必選貨品數量自動帶入人數。</div>
        </el-form-item>
        <el-form-item label="只列印後加項目上菜紙">
          <el-switch v-model="form.servingNewItemsOnly" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，按上菜紙時只印新加入的品項；若沒有後加品項，則整張單再出一次。</div>
        </el-form-item>
        <el-form-item label="直接埋單模式">
          <el-switch v-model="form.directPayMode" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，僅「外賣」模式下的送單／上菜紙／印單功能鍵改為直接結帳（落單即收錢）。外賣枱與堂食不受影響。</div>
        </el-form-item>
        <el-form-item label="套餐名稱只列印一次">
          <el-switch v-model="form.comboNameOnce" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，後廚長單／追單的套餐改為「套餐名標題」一行，下方縮排列出子品項，不再每個子品項重複印套餐名。</div>
        </el-form-item>
        <el-form-item label="撞餐功能">
          <el-switch v-model="form.bundleEnabled" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，POS 可將多項單點自動組合成套餐價（撞餐）。</div>
        </el-form-item>
        <el-form-item v-if="form.bundleEnabled" label="撞餐觸發方式">
          <el-radio-group v-model="form.bundleMode">
            <el-radio label="auto">自動偵測（加單時）</el-radio>
            <el-radio label="manual">手動撞餐鍵</el-radio>
            <el-radio label="both">兩者</el-radio>
          </el-radio-group>
          <div class="rounding-hint">自動偵測：加單時即時比對是否可組套餐；手動：由收銀員按「撞餐」鍵觸發。</div>
        </el-form-item>
        <el-form-item v-if="form.bundleEnabled" label="撞餐計價規則">
          <el-radio-group v-model="form.bundleRule">
            <el-radio label="bestPrice">省最多錢（顧客最優）</el-radio>
            <el-radio label="priority">套餐優先級</el-radio>
          </el-radio-group>
          <div class="rounding-hint">可撞成多個套餐時，bestPrice 選「省最多錢」的組合；priority 選套餐優先級最高的組合。</div>
        </el-form-item>
        <el-form-item label="沽清每日自動重置">
          <el-switch v-model="form.soldOutDailyReset" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，手動沽清的品項會於新營業日自動重售（庫存歸零的自動沽清不受影響）。</div>
        </el-form-item>
        <el-form-item label="貨價跳價錢設定">
          <el-switch v-model="form.jumpPriceEnabled" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">總開關：關閉後所有跳價規則（入單／開枱／埋單／菜單顯示）一律不生效，已設定的規則仍會保留。</div>
        </el-form-item>
        <el-form-item label="取消項目小票">
          <div style="display:flex; gap:24px; align-items:center; flex-wrap:wrap;">
            <div>
              <div style="font-size:12px; color:#606266; margin-bottom:2px;">廚房出單</div>
              <el-switch v-model="form.cancelItemPrint.kitchen" active-text="開" inactive-text="關"></el-switch>
            </div>
            <div>
              <div style="font-size:12px; color:#606266; margin-bottom:2px;">工作站出單</div>
              <el-switch v-model="form.cancelItemPrint.workstation" active-text="開" inactive-text="關"></el-switch>
            </div>
          </div>
          <div class="rounding-hint">退菜後列印「已取消」小票：廚房出單＝廚房印表機是否出單，工作站出單＝本收銀機是否出單。</div>
        </el-form-item>
        <el-form-item label="整單取消小票">
          <div style="display:flex; gap:24px; align-items:center; flex-wrap:wrap;">
            <div>
              <div style="font-size:12px; color:#606266; margin-bottom:2px;">廚房出單</div>
              <el-switch v-model="form.cancelAllPrint.kitchen" active-text="開" inactive-text="關"></el-switch>
            </div>
          </div>
          <div class="rounding-hint">整單取消後收銀機固定列印「整單取消」小票（含原因，內容為印單小票格式），廚房印表機是否出單由此開關控制。</div>
        </el-form-item>
        <el-form-item label="跳飛 POS 通知">
          <el-switch v-model="form.failoverNotify" active-text="開啟" inactive-text="關閉"></el-switch>
          <div class="rounding-hint">開啟後，打印機跳飛（備援機／廚房通用機代印）時，POS 前台頂部會顯示閃爍提示；關閉則不顯示。</div>
        </el-form-item>
        <el-form-item label="跳飛總時間">
          <el-radio-group v-model="form.failoverTimeout">
            <el-radio-button :label="30">30 秒</el-radio-button>
            <el-radio-button :label="45">45 秒</el-radio-button>
            <el-radio-button :label="75">1 分 15 秒</el-radio-button>
            <el-radio-button :label="90">1 分 30 秒</el-radio-button>
          </el-radio-group>
          <div class="rounding-hint">整條跳飛鏈（主機重試＋備援機＋廚房通用機）合計的嘗試時間上限，逾時即停止並回報失敗；各打印機的單次連線逾時仍以「打印機設定」內的 timeout 微調。</div>
        </el-form-item>
        <el-form-item label="POS 字型">
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <el-autocomplete v-model="form.posFontFamily" :fetch-suggestions="queryFonts" placeholder="使用系統預設字型" clearable style="width: 240px;"></el-autocomplete>
            <el-upload
              class="font-uploader"
              :action="uploadFontUrl"
              :headers="uploadFontHeaders"
              :show-file-list="false"
              :on-success="handleFontSuccess"
              :on-error="handleFontError"
              :before-upload="beforeFontUpload">
              <el-button size="small" icon="el-icon-upload2">上傳字型檔</el-button>
              <div slot="tip" class="el-upload__tip">(ttf / otf / woff / woff2)</div>
            </el-upload>
            <span v-if="form.posFontUrl" class="rounding-hint">已上傳：{{ form.posFontFamily || '自訂字型' }}</span>
          </div>
          <div class="rounding-hint">輸入字型名稱（例如「思源宋體」）可直接命名已上傳的字型檔；留空則使用系統預設字型。上傳字型檔後前台 POS 會自動套用。</div>
        </el-form-item>
      </el-form>
      <div class="btn-layout-footer">
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-wallet hd-icon"></i><span>支付方式與用餐方式</span>
      </div>
      <el-form label-width="120px">
        <el-form-item label="支付方式">
          <div class="amount-tags">
            <el-tag v-for="item in payMethods" :key="item._id" closable @close="deleteAmount(item)">{{ item.value }}</el-tag>
            <el-input v-model="newPayMethod" size="small" style="width: 140px; margin-left: 8px;" placeholder="新增支付方式" @keyup.enter.native="addAmount('payMethod', 'newPayMethod')">
              <el-button slot="append" icon="el-icon-plus" @click="addAmount('payMethod', 'newPayMethod')"></el-button>
            </el-input>
          </div>
        </el-form-item>
        <el-form-item label="用餐方式">
          <div class="amount-tags">
            <el-tag v-for="item in payTypes" :key="item._id" closable @close="deleteAmount(item)">{{ item.value }}</el-tag>
            <el-input v-model="newPayType" size="small" style="width: 140px; margin-left: 8px;" placeholder="新增用餐方式" @keyup.enter.native="addAmount('payType', 'newPayType')">
              <el-button slot="append" icon="el-icon-plus" @click="addAmount('payType', 'newPayType')"></el-button>
            </el-input>
          </div>
        </el-form-item>
      </el-form>
      <div class="btn-layout-footer">
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-time hd-icon"></i><span>分市時間設定（報表同步）</span>
      </div>
      <div class="slot-list">
        <div v-for="(slot, index) in form.slots" :key="index" class="slot-row">
          <el-input v-model="slot.name" placeholder="時段名，如 午市" size="small" style="width: 170px;"></el-input>
          <el-input v-model="slot.start" placeholder="開始 HH:mm" size="small" style="width: 130px;"></el-input>
          <span class="slot-sep">→</span>
          <el-input v-model="slot.end" placeholder="結束 HH:mm" size="small" style="width: 130px;"></el-input>
          <el-button type="danger" icon="el-icon-delete" size="mini" @click="form.slots.splice(index, 1)"></el-button>
        </div>
        <el-button size="mini" type="primary" plain @click="addSlot">+ 添加時段</el-button>
        <el-button size="mini" plain @click="addSlot({name:'早市',start:'06:00',end:'11:00'})">+ 早市</el-button>
        <el-button size="mini" plain @click="addSlot({name:'午市',start:'11:00',end:'14:30'})">+ 午市</el-button>
        <el-button size="mini" plain @click="addSlot({name:'下午茶',start:'14:30',end:'18:00'})">+ 下午茶</el-button>
        <el-button size="mini" plain @click="addSlot({name:'晚市',start:'18:00',end:'23:00'})">+ 晚市</el-button>
        <div class="rounding-hint">例：早市 06:00-11:00、午市 11:00-14:30、下午茶 14:30-18:00、晚市 18:00-23:00。POS 報表按此時段分組同篩選。</div>
      </div>
      <div class="btn-layout-footer">
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card btn-layout-card" style="max-width: 1500px;">
      <div slot="header" class="clearfix">
        <i class="el-icon-menu hd-icon"></i><span>按鈕位置自定義（順序＝POS 按鈕順序，隱藏＝不出現，可自訂顏色／尺寸／座標 X・Y，X・Y 為相對功能區左上角，0＝依順序排列）</span>
      </div>
      <el-row :gutter="18">
        <el-col :span="24">
          <div class="btn-layout-list">
            <div class="btn-layout-header pos-btn-grid">
              <span>ON/OFF</span>
              <span>編號</span>
              <span>功能</span>
              <span>POS顯示</span>
              <span>起始/結束/字色</span>
              <span>字體</span>
              <span>寬度</span>
              <span>高度</span>
              <span>X</span>
              <span>Y</span>
              <div class="bl-actions">
                <el-button size="mini" icon="el-icon-plus" @click="addEmptyButton" title="新增空行"></el-button>
                <el-button size="mini" icon="el-icon-document-copy" @click="duplicateLastButton" title="複製上一行"></el-button>
                <el-button size="mini" type="success" plain icon="el-icon-copy-document" @click="applySizeToAll" title="套用尺寸到全部"></el-button>
                <el-button size="mini" type="warning" plain icon="el-icon-brush" @click="randomizeColors" title="隨機配色"></el-button>
              </div>
            </div>
            <div v-for="(entry, idx) in form.buttonOrder" :key="entry.uid" class="btn-layout-row pos-btn-grid" draggable="true" :class="{ 'row-dragging': dragBtnIdx === idx, 'row-drop-target': dragOverBtnIdx === idx && dragBtnIdx !== null && dragBtnIdx !== idx }" @dragstart="onBtnDragStart(idx, $event)" @dragover="onBtnDragOver(idx, $event)" @drop="onBtnDrop(idx, $event)" @dragend="onBtnDragEnd">
              <el-switch v-model="entry.visible"></el-switch>
              <el-input v-model="entry.funcCode" size="mini" style="width: 48px;" placeholder="編號" maxlength="2" @change="onFuncCodeChange(idx)"></el-input>
              <span class="bl-label" style="font-weight:bold;">{{ resolveFuncName(entry.funcCode) }}</span>
              <el-input v-model="entry.label" size="mini" style="width:110px;" placeholder="同功能名" maxlength="12"></el-input>
              <div class="bl-colors">
                <el-color-picker v-model="entry.colorFrom" size="mini" :predefine="['#eef7ff','#d1fae5','#fef3c7','#fee2e2','#ede9fe','#f0f4f9']"></el-color-picker>
                <el-color-picker v-model="entry.colorTo" size="mini" :predefine="['#409eff','#10b981','#f59e0b','#ef4444','#8b5cf6','#1e293b']"></el-color-picker>
                <el-color-picker v-model="entry.textColor" size="mini" :predefine="['#1e293b','#ffffff','#2563eb','#ef4444']"></el-color-picker>
              </div>
              <el-input v-model.number="entry.fontSize" size="mini" style="width:56px;" placeholder="字" @change="onFuncCodeChange(idx)"></el-input>
              <el-input v-model.number="entry.width" size="mini" style="width:56px;" placeholder="寬" @change="onFuncCodeChange(idx)"></el-input>
              <el-input v-model.number="entry.height" size="mini" style="width:56px;" placeholder="高" @change="onFuncCodeChange(idx)"></el-input>
              <el-input v-model.number="entry.x" size="mini" style="width:48px;" placeholder="X"></el-input>
              <el-input v-model.number="entry.y" size="mini" style="width:48px;" placeholder="Y"></el-input>
              <div class="bl-actions">
                <span class="bl-drag-handle" title="拖拽排序">⋮⋮</span>
                <el-button size="mini" icon="el-icon-top" @click="moveButton(idx, -1)"></el-button>
                <el-button size="mini" icon="el-icon-bottom" @click="moveButton(idx, 1)"></el-button>
                <el-button size="mini" icon="el-icon-document-copy" @click="duplicateButton(idx)" title="複製"></el-button>
                <el-button size="mini" icon="el-icon-delete" type="danger" @click="form.buttonOrder.splice(idx, 1)"></el-button>
              </div>
            </div>
          </div>
          <div class="btn-layout-footer">
            <el-button @click="resetOrder">重設為預設</el-button>
            <el-button type="primary" @click="save">保存設置</el-button>
          </div>
        </el-col>
        <el-col :span="24">
          <div class="btn-only-preview">
            <div class="bop-title">即時預覽</div>
            <div class="pos-preview-global-row" style="margin-bottom:10px;">
              <span class="pos-preview-global-label">全局預設：</span>
              <span class="pos-preview-gl-item">字號</span>
              <el-input-number v-model="posBtnSettings.fontSize" :min="10" :max="40" size="mini" style="width:72px;"></el-input-number>
              <span class="pos-preview-gl-item">寬度</span>
              <el-input-number v-model="posBtnSettings.width" :min="40" :max="300" size="mini" style="width:72px;"></el-input-number>
              <span class="pos-preview-gl-item">高度</span>
              <el-input-number v-model="posBtnSettings.height" :min="24" :max="80" size="mini" style="width:72px;"></el-input-number>
              <span class="pos-preview-gl-item">每頁行數</span>
              <el-input-number v-model="posBtnSettings.rowsPerPage" :min="0" :max="10" size="mini" style="width:72px;"></el-input-number>
              <span class="pos-preview-gl-hint">（0=不分頁）</span>
              <span class="pos-preview-gl-item">每頁按鈕</span>
              <el-input-number v-model="posBtnSettings.perRow" :min="1" :max="20" size="mini" style="width:72px;"></el-input-number>
            </div>
            <div class="bop-current">
              <span class="bop-current-label">目前 POS 參數：</span>
              <span v-for="p in currentPosParams" :key="p.label" class="bop-current-tag">{{ p.label }} {{ p.value }}</span>
            </div>
            <div style="display:flex; align-items:stretch; gap:8px;">
              <div v-if="posBtnSettings.rowsPerPage > 0 && simDockTotalPages > 1" class="sim-dock-page-nav" :style="{ background: dockNav.bgColor + '18', borderRadius: '6px', gap: dockNav.gap + 'px' }">
              <button class="sim-nav-btn" :style="{ fontSize: dockNav.fontSize + 'px', width: dockNav.width + 'px', height: dockNav.height + 'px', background: dockNav.bgColor, color: dockNav.textColor }" :disabled="simDockPage <= 0" @click="simDockPrev">▲</button>
              <span :style="{ fontSize: dockNav.pageNumFontSize + 'px', color: dockNav.textColor + 'cc' }">{{ simDockPage + 1 }}/{{ simDockTotalPages }}</span>
              <button class="sim-nav-btn" :style="{ fontSize: dockNav.fontSize + 'px', width: dockNav.width + 'px', height: dockNav.height + 'px', background: dockNav.bgColor, color: dockNav.textColor }" :disabled="simDockPage >= simDockTotalPages - 1" @click="simDockNext">▼</button>
            </div>
              <div class="bop-dock" style="flex:1;">
                <div v-for="(row, ri) in simDockRows" :key="'bp-'+ri" class="bop-dock-row">
                  <div v-for="(b, bi) in row" :key="'bp-'+ri+'-'+bi" class="bop-dock-btn" :style="simBtnStyle(b)">
                    {{ buttonDisplayName(b) }}
                  </div>
                </div>
              </div>
            </div>
            <div class="bop-hint">按「保存設置」後前台自動同步</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="box-card pos-preview-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-monitor hd-icon"></i><span>1:1 POS 介面模擬預覽</span>
        <el-radio-group v-model="previewLayout" size="mini" style="margin-left: 16px;">
          <el-radio-button label="sidebar">側欄式</el-radio-button>
          <el-radio-button label="classic">傳統式</el-radio-button>
        </el-radio-group>
      </div>
      <div class="pos-preview-global-row">
        <span class="pos-preview-global-label">全局按鈕預設：</span>
        <span class="pos-preview-gl-item">字號</span>
        <el-input-number v-model="posBtnSettings.fontSize" :min="10" :max="40" size="mini" style="width:80px;"></el-input-number>
        <span class="pos-preview-gl-item">寬度</span>
        <el-input-number v-model="posBtnSettings.width" :min="40" :max="300" size="mini" style="width:80px;"></el-input-number>
        <span class="pos-preview-gl-item">高度</span>
        <el-input-number v-model="posBtnSettings.height" :min="24" :max="80" size="mini" style="width:80px;"></el-input-number>
        <span class="pos-preview-gl-item">每頁行數</span>
        <el-input-number v-model="posBtnSettings.rowsPerPage" :min="0" :max="10" size="mini" style="width:80px;"></el-input-number>
        <span class="pos-preview-gl-hint">（0=不分頁，個別按鈕設 0 則用全局值）</span>
      </div>
      <div class="pos-sim-wrap" :class="'pos-sim-' + previewLayout">
        <div class="pos-sim-sidenav" v-if="previewLayout === 'sidebar'">
          <div v-for="sb in simSidebarButtons" :key="sb.id" class="pos-sim-sb-btn" :style="sb.bgColor ? { background: sb.bgColor, color: sb.textColor || '#fff' } : {}">
            <span class="pos-sim-sb-icon">⬜</span>
            <span class="pos-sim-sb-label">{{ sb.label }}</span>
          </div>
        </div>
        <div class="pos-sim-food-zone">
          <div class="pos-sim-cat-scroll" :style="{ gap: catBtnSettings.gapY + 'px ' + catBtnSettings.gapX + 'px', gridTemplateColumns: 'repeat(' + (catBtnSettings.cols || 4) + ', minmax(0,1fr))' }">
            <div v-for="(c, ci) in simCategories" :key="c" class="pos-sim-cat-pill" :class="{ active: ci === simActiveCat }" :style="{ fontSize: catBtnSettings.fontSize + 'px', height: catBtnSettings.height + 'px', lineHeight: catBtnSettings.height + 'px', padding: catBtnSettings.paddingY + 'px ' + catBtnSettings.padding + 'px', borderRadius: catBtnSettings.shape === 'card' ? '10px' : '999px' }" @click="simActiveCat = ci">{{ c }}</div>
          </div>
          <div class="pos-sim-food-grid" :style="{ gridTemplateColumns: 'repeat(' + (foodBtnSettings.cols || 6) + ', minmax(0,1fr))', gridTemplateRows: foodBtnSettings.rows ? 'repeat(' + foodBtnSettings.rows + ', minmax(0,1fr))' : undefined }">
            <div v-for="f in simFoods" :key="f.name" class="pos-sim-food-btn">
              <div v-if="showFoodImages" class="pos-sim-food-img"></div>
              <div v-else class="pos-sim-food-avatar" :style="{ background: simCatColors[simActiveCat] }">{{ f.name.charAt(0) }}</div>
              <div class="pos-sim-food-text">
                <div class="pos-sim-food-name">{{ f.name }}</div>
                <div class="pos-sim-food-price">${{ f.price }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="pos-sim-ticket">
          <div class="pos-sim-ticket-head">點餐清單</div>
          <div class="pos-sim-ticket-item"><span>示例菜品 A</span><span>x1</span><span>$48</span></div>
          <div class="pos-sim-ticket-item"><span>示例菜品 B</span><span>x2</span><span>$76</span></div>
          <div class="pos-sim-ticket-foot">合計：<b>$124</b></div>
        </div>
        <div style="display:flex; align-items:stretch; gap:6px;">
          <div v-if="posBtnSettings.rowsPerPage > 0 && simDockTotalPages > 1" class="sim-dock-page-nav" :style="{ background: dockNav.bgColor + '18', borderRadius: '6px', gap: dockNav.gap + 'px' }">
            <button class="sim-nav-btn" :style="{ fontSize: dockNav.fontSize + 'px', width: dockNav.width + 'px', height: dockNav.height + 'px', background: dockNav.bgColor, color: dockNav.textColor }" :disabled="simDockPage <= 0" @click="simDockPrev">▲</button>
            <span :style="{ fontSize: dockNav.pageNumFontSize + 'px', color: dockNav.textColor + 'cc' }">{{ simDockPage + 1 }}/{{ simDockTotalPages }}</span>
            <button class="sim-nav-btn" :style="{ fontSize: dockNav.fontSize + 'px', width: dockNav.width + 'px', height: dockNav.height + 'px', background: dockNav.bgColor, color: dockNav.textColor }" :disabled="simDockPage >= simDockTotalPages - 1" @click="simDockNext">▼</button>
          </div>
          <div class="pos-sim-dock" :class="'pos-sim-dock-' + previewLayout" style="flex:1;">
            <div v-for="(row, ri) in simDockRows" :key="ri" class="pos-sim-dock-row">
              <div v-for="(b, bi) in row" :key="ri + '-' + bi" class="pos-sim-dock-btn" :style="simBtnStyle(b)">
                {{ buttonDisplayName(b) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="box-card sidebar-setting-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-s-grid hd-icon"></i><span>即時座位狀態 Sidebar 設定</span>
      </div>
      <el-form label-width="140px">
        <el-form-item label="Sidebar 字體大小">
          <el-slider v-model="sidebarSettings.fontSize" :min="10" :max="22" :format-tooltip="v => v + 'px'" style="width:200px;"></el-slider>
          <span class="unit">{{ sidebarSettings.fontSize }}px</span>
        </el-form-item>
        <el-form-item label="Sidebar 寬度">
          <el-slider v-model="sidebarSettings.width" :min="90" :max="200" :format-tooltip="v => v + 'px'" style="width:200px;"></el-slider>
          <span class="unit">{{ sidebarSettings.width }}px</span>
        </el-form-item>
      </el-form>
      <el-divider content-position="left">各按鈕設定（顏色 / 顯示 / 拖拽排序）</el-divider>
      <div class="sidebar-btn-list">
        <div v-for="(item, idx) in sidebarButtons" :key="item.id" class="sidebar-btn-row" draggable="true" @dragstart="sbDragStart(idx, $event)" @dragover.prevent @drop="sbDrop(idx)">
          <span class="drag-handle" title="拖拽排序">⋮⋮</span>
          <el-input v-model="item.funcCode" size="mini" style="width: 48px; margin: 0 4px;" placeholder="編號" maxlength="2" @change="onSbFuncCodeChange(idx)"></el-input>
          <span class="bl-label" style="font-weight:bold; min-width:80px;">{{ resolveFuncName(item.funcCode) }}</span>
          <el-switch v-model="item.visible" active-text="ON" inactive-text="OFF"></el-switch>
          <el-color-picker v-model="item.bgColor" size="mini" show-alpha :predefine="['#f0f4f9','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6']"></el-color-picker>
          <el-color-picker v-model="item.textColor" size="mini" :predefine="['#475569','#ffffff','#1e293b','#2563eb']"></el-color-picker>
          <div class="bl-actions">
            <el-button size="mini" icon="el-icon-document-copy" @click="sbCopyColor(idx)" title="複製配色"></el-button>
            <el-button size="mini" icon="el-icon-copy-document" :disabled="!sbCopiedColor" @click="sbPasteColor(idx)" title="套用配色"></el-button>
            <el-button size="mini" icon="el-icon-top" :disabled="idx === 0" @click="moveSidebarBtn(idx, -1)"></el-button>
            <el-button size="mini" icon="el-icon-bottom" :disabled="idx === sidebarButtons.length - 1" @click="moveSidebarBtn(idx, 1)"></el-button>
          </div>
        </div>
      </div>
      <div class="btn-layout-footer">
        <el-button @click="resetSidebar">重設為預設</el-button>
        <el-button icon="el-icon-copy-document" :disabled="!sbCopiedColor" @click="sbApplyColorToAll">套用配色到全部</el-button>
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card sidebar-setting-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-s-tools hd-icon"></i><span>經理功能選單設定</span>
      </div>
      <div class="btn-layout-header">
        <span style="width:52px;">ON/OFF</span>
        <span style="width:52px;">編號</span>
        <span style="min-width:80px;">功能</span>
        <div class="bl-actions" style="margin-left:auto;">
          <el-button size="mini" icon="el-icon-plus" @click="addManagerMenuItem"></el-button>
        </div>
      </div>
      <div class="btn-layout-list" style="max-height:300px;">
        <div v-for="(item, idx) in managerMenuItems" :key="idx" class="btn-layout-row">
          <el-switch v-model="item.visible" active-text="ON" inactive-text="OFF" style="width:52px;"></el-switch>
          <el-input v-model="item.funcCode" size="mini" style="width: 48px;" placeholder="編號" maxlength="2" @change="onManagerMenuChange(idx)"></el-input>
          <span class="bl-label" style="font-weight:bold; min-width:80px;">{{ resolveFuncName(item.funcCode) }}</span>
          <div class="bl-actions" style="margin-left:auto;">
            <el-button size="mini" icon="el-icon-top" :disabled="idx === 0" @click="moveManagerMenu(idx, -1)"></el-button>
            <el-button size="mini" icon="el-icon-bottom" :disabled="idx === managerMenuItems.length - 1" @click="moveManagerMenu(idx, 1)"></el-button>
            <el-button size="mini" icon="el-icon-delete" type="danger" @click="managerMenuItems.splice(idx, 1)"></el-button>
          </div>
        </div>
      </div>
      <div class="btn-layout-footer">
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card sidebar-setting-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-s-grid hd-icon"></i><span>叫起標籤顏色設定</span>
      </div>
      <el-form label-width="120px">
        <el-form-item label="字色">
          <el-color-picker v-model="calledTagStyle.color" :predefine="['#ea580c','#dc2626','#2563eb','#16a34a','#9333ea']"></el-color-picker>
          <span class="unit">{{ calledTagStyle.color || '預設' }}</span>
        </el-form-item>
        <el-form-item label="背景色">
          <el-color-picker v-model="calledTagStyle.background" show-alpha :predefine="['#ffedd5','#fef3c7','#dbeafe','#dcfce7','#f3e8ff']"></el-color-picker>
          <span class="unit">{{ calledTagStyle.background || '預設' }}</span>
        </el-form-item>
        <el-form-item label="邊框色">
          <el-color-picker v-model="calledTagStyle.border" :predefine="['#fed7aa','#fde68a','#bfdbfe','#bbf7d0','#e9d5ff']"></el-color-picker>
          <span class="unit">{{ calledTagStyle.border || '預設' }}</span>
        </el-form-item>
        <el-form-item>
          <span :style="{ color: calledTagStyle.color, background: calledTagStyle.background, border: '1px solid ' + calledTagStyle.border, padding: '2px 8px', borderRadius: '3px', fontSize: '12px', fontWeight: 600 }">預覽：叫起</span>
          <el-button size="mini" style="margin-left:12px;" @click="resetCalledTagStyle">重設為預設</el-button>
        </el-form-item>
      </el-form>
      <div class="btn-layout-footer">
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card sidebar-setting-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-d-arrow-left hd-icon"></i><span>導航按鈕樣式設定（▲/▼ 翻頁）</span>
      </div>
      <el-form label-width="120px">
        <el-form-item label="字體大小">
          <el-slider v-model="dockNav.fontSize" :min="10" :max="30" :show-tooltip="false" style="width:200px;"></el-slider>
          <span class="unit">{{ dockNav.fontSize }}px</span>
        </el-form-item>
        <el-form-item label="按鈕寬度">
          <el-slider v-model="dockNav.width" :min="20" :max="120" :show-tooltip="false" style="width:200px;"></el-slider>
          <span class="unit">{{ dockNav.width }}px</span>
        </el-form-item>
        <el-form-item label="按鈕高度">
          <el-slider v-model="dockNav.height" :min="20" :max="120" :show-tooltip="false" style="width:200px;"></el-slider>
          <span class="unit">{{ dockNav.height }}px</span>
        </el-form-item>
        <el-form-item label="背景色">
          <el-color-picker v-model="dockNav.bgColor" :predefine="['#409eff','#1e5bb5','#6366f1','#10b981','#374151']"></el-color-picker>
          <span class="unit">{{ dockNav.bgColor }}</span>
        </el-form-item>
        <el-form-item label="字色">
          <el-color-picker v-model="dockNav.textColor" :predefine="['#ffffff','#000000','#1e293b','#f0f4f9']"></el-color-picker>
          <span class="unit">{{ dockNav.textColor }}</span>
        </el-form-item>
        <el-form-item label="頁碼字號">
          <el-slider v-model="dockNav.pageNumFontSize" :min="10" :max="30" :show-tooltip="false" style="width:200px;"></el-slider>
          <span class="unit">{{ dockNav.pageNumFontSize }}px</span>
        </el-form-item>
        <el-form-item label="間距">
          <el-slider v-model="dockNav.gap" :min="0" :max="30" :show-tooltip="false" style="width:200px;"></el-slider>
          <span class="unit">{{ dockNav.gap }}px</span>
        </el-form-item>
        <el-form-item>
          <span :style="{ display:'inline-flex', alignItems:'center', gap: dockNav.gap + 'px', padding:'4px 8px', borderRadius:'6px', background: dockNav.bgColor + '20' }">
            <button :style="{ fontSize: dockNav.fontSize + 'px', width: dockNav.width + 'px', height: dockNav.height + 'px', background: dockNav.bgColor, color: dockNav.textColor, border:'none', borderRadius:'4px', fontWeight:700, cursor:'pointer' }">▲</button>
            <span :style="{ fontSize: dockNav.pageNumFontSize + 'px', color: dockNav.textColor }">1/3</span>
            <button :style="{ fontSize: dockNav.fontSize + 'px', width: dockNav.width + 'px', height: dockNav.height + 'px', background: dockNav.bgColor, color: dockNav.textColor, border:'none', borderRadius:'4px', fontWeight:700, cursor:'pointer' }">▼</button>
          </span>
        </el-form-item>
      </el-form>
      <div class="btn-layout-footer">
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card sidebar-setting-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-menu hd-icon"></i><span>分類按鈕 & 貨品按鈕設定</span>
      </div>
      <el-row :gutter="24">
        <el-col :span="12">
          <el-divider content-position="left">分類按鈕</el-divider>
          <el-form label-width="120px">
            <el-form-item label="字體大小">
              <el-slider v-model="catBtnSettings.fontSize" :min="10" :max="30" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ catBtnSettings.fontSize }}px</span>
            </el-form-item>
            <el-form-item label="按鈕高度">
              <el-slider v-model="catBtnSettings.height" :min="24" :max="64" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ catBtnSettings.height }}px</span>
            </el-form-item>
            <el-form-item label="按鈕寬度">
              <el-slider v-model="catBtnSettings.width" :min="0" :max="300" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ catBtnSettings.width || '自動' }}</span>
            </el-form-item>
            <el-form-item label="左右內距">
              <el-slider v-model="catBtnSettings.padding" :min="8" :max="48" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ catBtnSettings.padding }}px</span>
            </el-form-item>
            <el-form-item label="上下內距">
              <el-slider v-model="catBtnSettings.paddingY" :min="0" :max="30" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ catBtnSettings.paddingY }}px</span>
            </el-form-item>
            <el-form-item label="左右行距">
              <el-slider v-model="catBtnSettings.gapX" :min="0" :max="30" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ catBtnSettings.gapX }}px</span>
            </el-form-item>
            <el-form-item label="上下行距">
              <el-slider v-model="catBtnSettings.gapY" :min="0" :max="30" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ catBtnSettings.gapY }}px</span>
            </el-form-item>
            <el-form-item label="每行分類數">
              <el-slider v-model="catBtnSettings.cols" :min="0" :max="12" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ catBtnSettings.cols || '自動' }}</span>
            </el-form-item>
            <el-form-item label="每頁列數">
              <el-slider v-model="catBtnSettings.rows" :min="0" :max="10" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ catBtnSettings.rows || '不分頁' }}</span>
            </el-form-item>
            <el-form-item label="按鈕形狀">
              <el-radio-group v-model="catBtnSettings.shape">
                <el-radio-button label="pill">膠囊形</el-radio-button>
                <el-radio-button label="card">卡片形</el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-form>
          <div style="padding: 8px 0 4px;">
            <span :style="{ display:'inline-block', height: catBtnSettings.height + 'px', lineHeight: catBtnSettings.height + 'px', width: catBtnSettings.width > 0 ? catBtnSettings.width + 'px' : 'auto', textAlign: 'center', padding: catBtnSettings.paddingY + 'px ' + catBtnSettings.padding + 'px', borderRadius: catBtnSettings.shape === 'card' ? '10px' : '999px', fontSize: catBtnSettings.fontSize + 'px', fontWeight: 600, background: 'linear-gradient(135deg, #1f2d3d, #254f7d)', color: '#fff' }">分類名稱</span>
          </div>
        </el-col>
        <el-col :span="12">
          <el-divider content-position="left">貨品按鈕</el-divider>
          <el-form label-width="120px">
            <el-form-item label="每行貨品數">
              <el-slider v-model="foodBtnSettings.cols" :min="0" :max="10" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.cols || '自動' }}</span>
            </el-form-item>
            <el-form-item label="顯示行數">
              <el-slider v-model="foodBtnSettings.rows" :min="0" :max="6" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.rows || '自動' }}</span>
            </el-form-item>
            <el-form-item label="字體大小">
              <el-slider v-model="foodBtnSettings.fontSize" :min="14" :max="36" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.fontSize }}px</span>
            </el-form-item>
            <el-form-item label="最小高度">
              <el-slider v-model="foodBtnSettings.minHeight" :min="30" :max="160" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.minHeight }}px</span>
            </el-form-item>
            <el-form-item label="按鈕寬度">
              <el-slider v-model="foodBtnSettings.width" :min="0" :max="300" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.width || '自動' }}</span>
            </el-form-item>
            <el-form-item label="按鈕高度">
              <el-slider v-model="foodBtnSettings.height" :min="0" :max="200" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.height || '自動' }}</span>
            </el-form-item>
            <el-form-item label="圖片大小">
              <el-slider v-model="foodBtnSettings.imageSize" :min="24" :max="80" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.imageSize }}px</span>
            </el-form-item>
            <el-form-item label="左右內距">
              <el-slider v-model="foodBtnSettings.paddingX" :min="0" :max="30" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.paddingX }}px</span>
            </el-form-item>
            <el-form-item label="上下內距">
              <el-slider v-model="foodBtnSettings.paddingY" :min="0" :max="30" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.paddingY }}px</span>
            </el-form-item>
            <el-form-item label="左右行距">
              <el-slider v-model="foodBtnSettings.gapX" :min="0" :max="30" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.gapX }}px</span>
            </el-form-item>
            <el-form-item label="上下行距">
              <el-slider v-model="foodBtnSettings.gapY" :min="0" :max="30" :show-tooltip="false" style="width:180px;"></el-slider>
              <span class="unit">{{ foodBtnSettings.gapY }}px</span>
            </el-form-item>
            <el-form-item label="顯示 PLU">
              <el-switch v-model="foodBtnSettings.showPlu" active-text="開啟" inactive-text="關閉"></el-switch>
            </el-form-item>
            <el-form-item label="顯示價錢">
              <el-switch v-model="foodBtnSettings.showPrice" active-text="開啟" inactive-text="關閉"></el-switch>
            </el-form-item>
            <el-form-item label="顯示庫存剩餘">
              <el-switch v-model="foodBtnSettings.showStock" active-text="開啟" inactive-text="關閉"></el-switch>
            </el-form-item>
          </el-form>
          <div style="padding: 8px 0 4px;">
            <div :style="{ display:'inline-flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight: (foodBtnSettings.height > 0 ? foodBtnSettings.height : foodBtnSettings.minHeight) + 'px', width: foodBtnSettings.width > 0 ? foodBtnSettings.width + 'px' : '120px', border:'1.5px solid rgba(148,163,184,.25)', borderRadius:'10px', background:'#fff', padding: foodBtnSettings.paddingY + 'px ' + foodBtnSettings.paddingX + 'px' }">
              <div :style="{ width: foodBtnSettings.imageSize + 'px', height: foodBtnSettings.imageSize + 'px', borderRadius:'8px', background:'linear-gradient(135deg,#e0e7ff,#c7d2fe)', marginBottom:'4px' }"></div>
              <div v-if="foodBtnSettings.showPlu" :style="{ fontSize: Math.max(10, foodBtnSettings.fontSize - 4) + 'px', fontWeight:700, color:'#94a3b8', marginBottom:'2px' }">PLU-001</div>
              <div :style="{ fontSize: foodBtnSettings.fontSize + 'px', fontWeight:700, color:'#1e293b' }">貨品名稱</div>
              <div v-if="foodBtnSettings.showPrice" :style="{ fontSize: foodBtnSettings.fontSize + 'px', fontWeight:800, color:'#ef4444' }">$48</div>
            </div>
          </div>
        </el-col>
      </el-row>
      <div class="btn-layout-footer">
        <el-button @click="resetCatFoodBtnSettings">重設為預設</el-button>
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card sidebar-setting-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-sort hd-icon"></i><span>分類按鈕順序設定（拖拽排序＝POS 分類順序，關閉＝不出現，可自訂顯示名／頁碼／字體／跨欄／高度；頁碼 0＝自動分頁，字體/跨欄/高度 0＝沿用全局，跨欄＝該分類佔用幾個欄位）</span>
      </div>
      <div class="btn-layout-header">
        <span style="width:52px;">ON/OFF</span>
        <span style="min-width:180px;">分類名稱</span>
        <span style="min-width:140px;">POS 顯示名</span>
        <span style="width:64px;">頁碼</span>
        <span style="width:64px;">字體</span>
        <span style="width:64px;">跨欄</span>
        <span style="width:64px;">高度</span>
        <div class="bl-actions" style="margin-left:auto;">
          <el-button size="mini" type="warning" plain icon="el-icon-refresh" @click="resetCategoryOrder" title="重設為預設順序">重設</el-button>
        </div>
      </div>
      <div class="btn-layout-list" style="max-height:420px;">
        <div v-for="(item, idx) in categoryOrderList" :key="item.id" class="btn-layout-row cat-order-row" draggable="true" @dragstart="catOrderDragStart(idx, $event)" @dragover.prevent @drop="catOrderDrop(idx)" @dragend="catOrderDragEnd">
          <el-switch v-model="item.visible" active-text="ON" inactive-text="OFF" style="width:52px;"></el-switch>
          <span class="bl-label" style="min-width:180px;" :style="{ paddingLeft: (item.depth * 14) + 'px' }">{{ item.name }}</span>
          <el-input v-model="item.label" size="mini" style="width:140px;" placeholder="同分類名" maxlength="12"></el-input>
          <el-input-number v-model="item.page" :min="0" :max="99" size="mini" style="width:64px;" controls-position="right"></el-input-number>
          <el-input-number v-model="item.fontSize" :min="0" :max="60" size="mini" style="width:64px;" controls-position="right"></el-input-number>
          <el-input-number v-model="item.width" :min="0" :max="12" size="mini" style="width:64px;" controls-position="right" title="跨欄數（0=1欄，最多每行分類數）"></el-input-number>
          <el-input-number v-model="item.height" :min="0" :max="120" size="mini" style="width:64px;" controls-position="right"></el-input-number>
          <div class="bl-actions">
            <span class="bl-drag-handle" title="拖拽排序">⋮⋮</span>
            <el-button size="mini" icon="el-icon-top" :disabled="idx === 0" @click="moveCategoryOrder(idx, -1)"></el-button>
            <el-button size="mini" icon="el-icon-bottom" :disabled="idx === categoryOrderList.length - 1" @click="moveCategoryOrder(idx, 1)"></el-button>
          </div>
        </div>
        <div v-if="!categoryOrderList.length" class="bop-hint" style="padding:12px;">尚未載入分類，請先到「分類管理」建立分類。</div>
      </div>
      <div class="btn-layout-footer">
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card sidebar-setting-card">
      <div slot="header" class="clearfix">
        <i class="el-icon-s-grid hd-icon"></i><span>枱卡操作標籤樣式（合/分/追/轉）</span>
      </div>
      <el-table :data="badgeStyleList" size="small" style="width:100%;">
        <el-table-column label="ON/OFF" width="80">
          <template slot-scope="{ row }">
            <el-switch v-model="row.visible"></el-switch>
          </template>
        </el-table-column>
        <el-table-column prop="label" label="標籤" width="80"></el-table-column>
        <el-table-column label="字色" width="100">
          <template slot-scope="{ row }">
            <el-color-picker v-model="row.color" size="mini" :predefine="['#ffffff','#1e293b','#f0f4f9']"></el-color-picker>
          </template>
        </el-table-column>
        <el-table-column label="背景色" width="100">
          <template slot-scope="{ row }">
            <el-color-picker v-model="row.background" size="mini" :predefine="['#e6a23c','#67c23a','#409eff','#f56c6c','#ecf5ff','#f0f9eb']"></el-color-picker>
          </template>
        </el-table-column>
        <el-table-column label="字體大小" width="160">
          <template slot-scope="{ row }">
            <el-slider v-model="row.fontSize" :min="10" :max="24" :show-tooltip="false" style="width:110px; display:inline-block; vertical-align:middle;"></el-slider>
            <span class="unit">{{ row.fontSize }}px</span>
          </template>
        </el-table-column>
        <el-table-column label="預覽" width="120">
          <template slot-scope="{ row }">
            <div :style="{ display:'inline-block', width: row.fontSize + 8 + 'px', height: row.fontSize + 8 + 'px', lineHeight: row.fontSize + 8 + 'px', textAlign:'center', borderRadius:'50%', color: row.color, background: row.background, fontSize: row.fontSize + 'px', fontWeight:700, verticalAlign:'middle' }">{{ row.char }}</div>
          </template>
        </el-table-column>
      </el-table>
      <div class="btn-layout-footer">
        <el-button size="small" @click="resetBadgeStyle">重設為預設</el-button>
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card" style="max-width: 760px;">
      <div slot="header" class="clearfix">
        <i class="el-icon-s-grid hd-icon"></i><span>卡片枱顯示設定</span>
      </div>
      <div style="display:flex; gap:24px; flex-wrap:wrap;">
        <div>
          <el-form label-width="80px" size="small">
            <template v-for="el in cardDisplayElements">
              <el-divider :key="el.key + '-div'" content-position="left">{{ el.label }}</el-divider>
              <el-form-item :key="el.key + '-show'" label="顯示">
                <el-switch v-model="cardDisplay[el.key].show"></el-switch>
              </el-form-item>
              <el-form-item :key="el.key + '-size'" label="字號">
                <el-slider v-model="cardDisplay[el.key].fontSize" :min="8" :max="60" :show-tooltip="false" style="width:180px;"></el-slider>
                <span class="unit">{{ cardDisplay[el.key].fontSize }}px</span>
              </el-form-item>
              <el-form-item :key="el.key + '-pos'" label="位置">
                <el-select v-model="cardDisplay[el.key].position" style="width:160px;">
                  <el-option label="左上" value="top-left"></el-option>
                  <el-option label="正上" value="top-center"></el-option>
                  <el-option label="右上" value="top-right"></el-option>
                  <el-option label="正中" value="center"></el-option>
                  <el-option label="枱號下" value="below-no"></el-option>
                  <el-option label="金額下" value="below-amount"></el-option>
                  <el-option label="底部" value="bottom"></el-option>
                </el-select>
              </el-form-item>
            </template>
          </el-form>
        </div>
        <div style="min-width:220px;">
          <div style="font-size:13px; font-weight:700; color:#606266; margin-bottom:10px;">即時預覽</div>
          <div class="card-preview-box">
            <div class="cpb-seats" v-if="cardDisplay.seats.show" :style="{ fontSize: cardDisplay.seats.fontSize + 'px' }">👤 {{ 4 }}位</div>
            <div class="cpb-dot" v-if="cardDisplay.dot.show" :style="{ width: cardDisplay.dot.fontSize + 'px', height: cardDisplay.dot.fontSize + 'px' }"></div>
            <div class="cpb-no" v-if="cardDisplay.tableNo.show" :style="{ fontSize: cardDisplay.tableNo.fontSize + 'px' }">15</div>
            <div class="cpb-amount" v-if="cardDisplay.amount.show" :style="{ fontSize: cardDisplay.amount.fontSize + 'px' }">${{ 320 }}</div>
            <div class="cpb-status" v-if="cardDisplay.status.show" :style="{ fontSize: cardDisplay.status.fontSize + 'px', color: '#67c23a' }">用餐中</div>
            <div class="cpb-duration" v-if="cardDisplay.duration.show" :style="{ fontSize: cardDisplay.duration.fontSize + 'px' }">25m</div>
          </div>
        </div>
      </div>
      <div class="btn-layout-footer">
        <el-button size="small" @click="resetCardDisplay">重設為預設</el-button>
        <el-button type="primary" @click="save">保存設置</el-button>
      </div>
    </el-card>

    <el-card class="box-card" style="max-width: 760px;">
      <div slot="header" class="clearfix">
        <i class="el-icon-lock hd-icon"></i><span>權限等級說明</span>
      </div>
      <el-table :data="permExplain" size="mini" style="width: 100%;">
        <el-table-column prop="level" label="等級" width="80"></el-table-column>
        <el-table-column prop="role" label="角色" width="120"></el-table-column>
        <el-table-column prop="desc" label="可執行操作"></el-table-column>
      </el-table>
    </el-card>

    <div style="text-align:center; padding:16px; gap:8px;">
      <el-button type="warning" plain icon="el-icon-download" @click="exportSettings">匯出設定</el-button>
      <el-button type="info" plain icon="el-icon-upload2" @click="$refs.importInput.click()">匯入設定</el-button>
      <input ref="importInput" type="file" accept=".json" style="display:none;" @change="importSettings">
    </div>
  </div>
</template>

<script>
const DEFAULT_BTN_PERMS = {
  merge: 3,
  split: 3,
  transfer: 3,
  hold: 1,
  recall: 1,
  print: 1,
  chase: 1,
  serving: 1,
  qrcode: 1,
  wholeDiscount: 2,
  itemDiscount: 2,
  clear: 1,
  submit: 1,
  send: 1,
  checkout: 2,
  cashCheckout: 2,
  changePay: 2,
  callDish: 1,
  serveDish: 1,
  reprint: 1,
  soldout: 2,
  refund: 3,
  report: 3,
  manager: 4,
  addTable: 3,
  cancelAll: 3,
  cancelItem: 3,
  login: 1,
  logoutBtn: 1,
  changePwd: 1,
  releaseTable: 3,
  paidOut: 3,
  received: 3,
  changePrice: 2,
  showDetail: 1,
  bundle: 2
}

const BUTTONS = [
  { id: 'merge', label: '合拼枱', funcCode: '1' },
  { id: 'split', label: '分單', funcCode: '2' },
  { id: 'transfer', label: '轉枱', funcCode: '3' },
  { id: 'hold', label: '掛單', funcCode: '4' },
  { id: 'recall', label: '叫回', funcCode: '5' },
  { id: 'print', label: '印單', funcCode: '6' },
  { id: 'chase', label: '追單', funcCode: '7' },
  { id: 'serving', label: '上菜紙', funcCode: '8' },
  { id: 'qrcode', label: '二維碼', funcCode: '9' },
  { id: 'wholeDiscount', label: '整單折扣', funcCode: '10' },
  { id: 'itemDiscount', label: '項目折扣', funcCode: '11' },
  { id: 'clear', label: '清空', funcCode: '12' },
  { id: 'submit', label: '確認下單', funcCode: '13' },
  { id: 'send', label: '送單', funcCode: '14' },
  { id: 'checkout', label: '結帳', funcCode: '15' },
  { id: 'cashCheckout', label: '現金結帳', funcCode: '37' },
  { id: 'callDish', label: '叫起', funcCode: '38' },
  { id: 'serveDish', label: '起菜', funcCode: '39' },
  { id: 'reprint', label: '重印單據', funcCode: '40' },
  { id: 'changePay', label: '更改付款', funcCode: '42' },
  { id: 'soldout', label: '沽清設定', funcCode: '16' },
  { id: 'refund', label: '更改已結帳單', funcCode: '17' },
  { id: 'report', label: '報表', funcCode: '18' },
  { id: 'manager', label: '經理功能', funcCode: '19' },
  { id: 'addTable', label: '加枱', funcCode: '20' },
  { id: 'cancelAll', label: '整單取消', funcCode: '21' },
  { id: 'cancelItem', label: '單項取消', funcCode: '22' },
  { id: 'login', label: '登入', funcCode: '34' },
  { id: 'logoutBtn', label: '登出', funcCode: '35' },
  { id: 'changePwd', label: '更改用戶密碼', funcCode: '36' },
  { id: 'releaseTable', label: '解除枱號狀態', funcCode: '41' },
  { id: 'paidOut', label: '代支', funcCode: '45' },
  { id: 'received', label: '代收', funcCode: '46' },
  { id: 'changePrice', label: '更改價格', funcCode: '47' },
  { id: 'showDetail', label: '顯示明細', funcCode: '48' },
  { id: 'leaveApp', label: '離開', funcCode: '43' },
  { id: 'openDrawer', label: '開銀櫃', funcCode: '53' },
  { id: 'pantry', label: '打柯單', funcCode: '50' },
  { id: 'deptSplit', label: '大單分帳', funcCode: '51' },
  { id: 'centralCheckout', label: '中央埋單', funcCode: '52' },
  { id: 'printTableQr', label: '印點餐碼', funcCode: '54' },
  { id: 'bundle', label: '撞餐', funcCode: '55' }
]
const SIDEBAR_FUNC = [
  { id: 'grid', label: '枱號圖', funcCode: '23' },
  { id: 'takeaway', label: '外賣枱', funcCode: '24' },
  { id: 'dineIn', label: '堂食', funcCode: '25' },
  { id: 'delivery', label: '外賣', funcCode: '57' },
  { id: 'list', label: '查看單據', funcCode: '26' },
  { id: 'search', label: '搜尋編號', funcCode: '27' },
  { id: 'history', label: '往日單據', funcCode: '28' },
  { id: 'refresh', label: '重新整理', funcCode: '29' },
  { id: 'addTable', label: '快速開枱', funcCode: '30' },
  { id: 'batchPrint', label: '批量列印', funcCode: '31' },
  { id: 'report', label: '報表', funcCode: '32' },
  { id: 'settings', label: '經理功能', funcCode: '33' }
]
// 經理功能選單（透過「經理功能」按鈕＋經理登入後叫出，不放進底部功能 dock）
const MANAGER_FUNC = [
  { id: 'copyOrder', label: '複印單據', funcCode: '44' },
  { id: 'refreshPos', label: '重新整理', funcCode: '49' },
  { id: 'dayReport', label: '每日結算', funcCode: '56' }
]
const FUNC_CODE_MAP = {}
BUTTONS.forEach(b => { FUNC_CODE_MAP[b.funcCode] = b.id })
SIDEBAR_FUNC.forEach(b => { FUNC_CODE_MAP[b.funcCode] = 'sb_' + b.id })
MANAGER_FUNC.forEach(b => { FUNC_CODE_MAP[b.funcCode] = b.id })

let __btnUid = 0
function genBtnUid () { return 'b' + (++__btnUid) + '_' + Math.random().toString(36).slice(2, 7) }

const DEFAULT_ORDER = BUTTONS.map(b => ({ funcCode: b.funcCode, colorFrom: '', colorTo: '', textColor: '', perm: DEFAULT_BTN_PERMS[b.id] || 1, visible: true, fontSize: 0, width: 0, height: 0, x: 0, y: 0, label: '', uid: genBtnUid() }))
const DEFAULT_CARD_DISPLAY = {
  seats: { show: true, fontSize: 12, position: 'top-left' },
  dot: { show: true, fontSize: 9, position: 'top-right' },
  tableNo: { show: true, fontSize: 42, position: 'center' },
  amount: { show: true, fontSize: 17, position: 'below-no' },
  status: { show: true, fontSize: 12, position: 'below-amount' },
  duration: { show: true, fontSize: 11, position: 'bottom' }
}
const CARD_DISPLAY_ELEMENTS = [
  { key: 'seats', label: '座位數' },
  { key: 'dot', label: '狀態圓點' },
  { key: 'tableNo', label: '枱號' },
  { key: 'amount', label: '金額' },
  { key: 'status', label: '狀態文字' },
  { key: 'duration', label: '用餐時長' }
]

export default {
  name: 'posSetting',
  data () {
    return {
      payMethods: [],
      payTypes: [],
      newPayMethod: '',
      newPayType: '',
      dragging: null,
      dragBtnIdx: null,
      dragOverBtnIdx: null,
      resizing: null,
      dragOffset: { x: 0, y: 0 },
      resizeStart: { x: 0, y: 0, w: 0, h: 0 },
      snapToGrid: false,
      gridSize: 16,
      fullscreenPreview: false,
      history: [],
      historyIndex: -1,
      historyMax: 50,
      panelLocks: { sideNav: false, foodZone: false, ticket: false, dock: false },
      panelOpacity: { sideNav: 100, foodZone: 100, ticket: 100, dock: 100 },
      panelRadius: { sideNav: 4, foodZone: 4, ticket: 4, dock: 4 },
      panelZIndex: { sideNav: 5, foodZone: 3, ticket: 4, dock: 2 },
      sideNavCols: 3,
      globalFontSize: 14,
      BUTTONS,
      sidebarButtons: SIDEBAR_FUNC.map(b => ({ id: b.id, label: b.label, funcCode: b.funcCode, visible: true, bgColor: '', textColor: '' })),
      sbCopiedColor: null,
      calledTagStyle: { color: '#ea580c', background: '#ffedd5', border: '#fed7aa' },
      badgeStyleList: [
        { key: 'transfer', label: '轉', char: '轉', fontSize: 13, color: '#ffffff', background: '#e6a23c', visible: true },
        { key: 'merge', label: '合', char: '合', fontSize: 13, color: '#ffffff', background: '#67c23a', visible: true },
        { key: 'split', label: '分', char: '分', fontSize: 13, color: '#ffffff', background: '#409eff', visible: true },
        { key: 'chase', label: '追', char: '追', fontSize: 13, color: '#ffffff', background: '#f56c6c', visible: true }
      ],
      boardLayout: { cardHeight: 110, cardWidth: 0, gridCols: 0, gridRows: 0, gap: 10 },
      cardDisplay: JSON.parse(JSON.stringify(DEFAULT_CARD_DISPLAY)),
      cardDisplayElements: CARD_DISPLAY_ELEMENTS,
      managerMenuItems: [],
      uploadFontUrl: '/api/possetting/uploadfont',
      fontOptions: [
        { label: '系統預設（留空）', value: '' },
        { label: 'Noto Sans TC', value: 'Noto Sans TC' },
        { label: 'Microsoft JhengHei', value: 'Microsoft JhengHei' },
        { label: 'PingFang TC', value: 'PingFang TC' },
        { label: 'Arial', value: 'Arial' },
        { label: 'Helvetica Neue', value: 'Helvetica Neue' }
      ],
      categoryList: [],
      categoryOrderList: [],
      categoryOrderConfig: [],
      catOrderDragIdx: null,
      posBtnSettings: { fontSize: 18, width: 100, height: 40, rowsPerPage: 2, perRow: 8 },
      catBtnSettings: { fontSize: 13, width: 0, height: 40, padding: 20, paddingY: 0, gapX: 10, gapY: 10, cols: 4, rows: 6, shape: 'pill' },
      foodBtnSettings: { cols: 0, rows: 0, fontSize: 25, width: 0, height: 0, minHeight: 88, imageSize: 40, paddingX: 3, paddingY: 6, gapX: 6, gapY: 6, showPlu: true, showPrice: true, showStock: true },
      simDockPage: 0,
      dockNav: { fontSize: 18, width: 100, height: 40, bgColor: '#409eff', textColor: '#ffffff', pageNumFontSize: 12, gap: 6 },
      sidebarSettings: { fontSize: 12, width: 130 },
      previewLayout: 'sidebar',
      simActiveCat: 0,
      simFoods: [
        { name: '示例菜品A', price: 48 },
        { name: '示例菜品B', price: 58 },
        { name: '示例菜品C', price: 38 },
        { name: '示例菜品D', price: 68 },
        { name: '示例菜品E', price: 45 },
        { name: '示例菜品F', price: 55 },
        { name: '示例菜品G', price: 35 },
        { name: '示例菜品H', price: 78 }
      ],
      simCatColors: ['#e74c3c', '#e67e22', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#d35400', '#2c3e50'],
      permExplain: [
        { level: '4', role: '管理員', desc: '全部權限（含經理功能）' },
        { level: '3', role: '經理', desc: '合拼枱、分單、轉枱、更改已結帳單、報表、加枱、員工權限、已送品項可改數量' },
        { level: '2', role: '收銀員', desc: '整單折扣、項目折扣、結帳、沽清設定' },
        { level: '1', role: '服務員', desc: '掛單、叫回、印單、追單、上菜紙、二維碼、清空、確認下單、送單' }
      ],
      form: {
        serviceChargeEnabled: false,
        serviceChargeRate: 10,
        serviceChargePreDiscount: true,
        roundingMode: 'none',
        shareTableEnabled: false,
        showFoodImages: true,
        gestureEnabled: true,
        businessDayCutoff: '03:00',
        sideQtyMode: 'pending',
        modCodeUIMode: 'A',
        reprintMinLevel: 3,
        dineInPrintCopies: 1,
        takeawayPrintCopies: 1,
        dineInPrefix: '10',
        takeawayTablePrefix: '99',
        takeawayPrefix: '88',
        takeawayTableFrom: '901',
        takeawayTableTo: '999',
        orderLayout: 'sidebar',
        orderTheme: 'indigo',
        showSideNav: true,
        ticketSide: 'right',
        ticketWidth: 0,
        dockHeight: 0,
        sideNavWidth: 0,
        dockMinH: 0,
        panelsSideNavX: 0,
        panelsSideNavY: 0,
        panelsSideNavW: 92,
        panelsSideNavH: 0,
        panelsFoodZoneX: 0,
        panelsFoodZoneY: 0,
        panelsFoodZoneW: 0,
        panelsFoodZoneH: 0,
        panelsTicketX: 0,
        panelsTicketY: 0,
        panelsTicketW: 0,
        panelsTicketH: 0,
        panelsDockX: 0,
        panelsDockY: 0,
        panelsDockW: 0,
        panelsDockH: 0,
        panelColorsTicketHead: '',
        panelColorsSideNav: '',
        panelColorsFoodZone: '',
        panelColorsDock: '',
        slots: [],
        teaChargesRequired: false,
        requiredCategoryId: '',
        teaSeatSyncPax: false,
        servingNewItemsOnly: false,
        directPayMode: false,
        comboNameOnce: false,
        bundleEnabled: false,
        bundleMode: 'auto',
        bundleRule: 'bestPrice',
        soldOutDailyReset: false,
        jumpPriceEnabled: true,
        failoverNotify: true,
        failoverTimeout: 45,
        cancelItemPrint: { kitchen: true, workstation: false },
        cancelAllPrint: { kitchen: true },
        posFontFamily: '',
        posFontUrl: '',
        buttonOrder: JSON.parse(JSON.stringify(DEFAULT_ORDER))
      }
    }
  },
  computed: {
    uploadFontHeaders () {
      return { Authorization: localStorage.orderTk || '' }
    },
    funcRefList () {
      const list = BUTTONS.map(b => ({ funcCode: b.funcCode, label: b.label })).concat(SIDEBAR_FUNC.map(b => ({ funcCode: b.funcCode, label: b.label })), MANAGER_FUNC.map(b => ({ funcCode: b.funcCode, label: b.label })))
      return list.sort((a, b) => (Number(a.funcCode) || 0) - (Number(b.funcCode) || 0))
    },
    canvasScale () {
      return 960 / 1920
    },
    previewPanels () {
      const s = this.canvasScale
      return [
        {
          key: 'sideNav',
          label: '側欄',
          formPrefix: 'SideNav',
          x: this.form.panelsSideNavX * s,
          y: this.form.panelsSideNavY * s,
          w: this.form.panelsSideNavW * s || 92 * s,
          h: this.form.panelsSideNavH * s || 1080 * s,
          color: this.form.panelColorsSideNav,
          defaultColor: 'rgba(47,64,86,0.92)'
        },
        {
          key: 'foodZone',
          label: '食品區',
          formPrefix: 'FoodZone',
          x: this.form.panelsFoodZoneX * s,
          y: this.form.panelsFoodZoneY * s,
          w: this.form.panelsFoodZoneW * s || (1920 - 380) * s,
          h: this.form.panelsFoodZoneH * s || (1080 - 100) * s,
          color: this.form.panelColorsFoodZone,
          defaultColor: '#f0f2f5'
        },
        {
          key: 'ticket',
          label: '清單',
          formPrefix: 'Ticket',
          x: this.form.panelsTicketX * s,
          y: this.form.panelsTicketY * s,
          w: this.form.panelsTicketW * s || 380 * s,
          h: this.form.panelsTicketH * s || (1080 - 100) * s,
          color: this.form.panelColorsTicketHead,
          defaultColor: '#ffffff'
        },
        {
          key: 'dock',
          label: '底部功能區',
          formPrefix: 'Dock',
          x: this.form.panelsDockX * s,
          y: this.form.panelsDockY * s,
          w: this.form.panelsDockW * s || 1920 * s,
          h: this.form.panelsDockH * s || 100 * s,
          color: this.form.panelColorsDock,
          defaultColor: '#2f4056'
        }
      ]
    },
    hiddenButtons () {
      const ids = this.form.buttonOrder.map(e => e.id)
      return this.BUTTONS.filter(b => ids.indexOf(b.id) < 0)
    },
    pvTicketHeadStyle () {
      const bg = this.form.panelColorsTicketHead
      return bg ? { background: bg } : {}
    },
    simSidebarButtons () {
      return this.sidebarButtons.filter(b => b.visible)
    },
    simCategories () {
      const names = this.categoryOrderList.filter(c => c.visible).map(c => c.label || c.name)
      if (names.length) return names
      return ['菜品分類A', '菜品分類B', '菜品分類C', '菜品分類D', '菜品分類E']
    },
    simDockButtons () {
      return this.form.buttonOrder.filter(e => e.visible)
    },
    simAllDockRows () {
      const btns = this.simDockButtons
      const cols = this.posBtnSettings.perRow || 8
      const rows = []
      for (let i = 0; i < btns.length; i += cols) {
        rows.push(btns.slice(i, i + cols))
      }
      return rows
    },
    simDockRows () {
      const all = this.simAllDockRows
      const rpp = this.posBtnSettings.rowsPerPage || 0
      if (rpp <= 0) return all
      const start = this.simDockPage * rpp
      return all.slice(start, start + rpp)
    },
    simDockTotalPages () {
      const all = this.simAllDockRows
      const rpp = this.posBtnSettings.rowsPerPage || 0
      if (rpp <= 0) return 1
      return Math.max(1, Math.ceil(all.length / rpp))
    },
    showFoodImages () {
      return this.form.showFoodImages !== false
    },
    themeName () {
      const m = { indigo: '藍紫', ocean: '海洋藍', emerald: '翡翠綠', sunset: '日落橙', dark: '深夜' }
      return m[this.form.orderTheme] || this.form.orderTheme || '藍紫'
    },
    layoutName () {
      return this.form.orderLayout === 'classic' ? '傳統式' : '側欄式'
    },
    currentPosParams () {
      return [
        { label: '字號', value: this.posBtnSettings.fontSize + 'px' },
        { label: '寬度', value: this.posBtnSettings.width + 'px' },
        { label: '高度', value: this.posBtnSettings.height + 'px' },
        { label: '每頁行數', value: this.posBtnSettings.rowsPerPage > 0 ? this.posBtnSettings.rowsPerPage : '不分頁' }
      ]
    }
  },
  watch: {
    'posBtnSettings.rowsPerPage' () {
      this.simDockPage = 0
    },
    categoryList () {
      this.applyCategoryOrder(this.categoryOrderConfig)
    }
  },
  methods: {
    simDockPrev () {
      if (this.simDockPage > 0) this.simDockPage--
    },
    simDockNext () {
      if (this.simDockPage < this.simDockTotalPages - 1) this.simDockPage++
    },
    moveSidebarBtn (idx, dir) {
      const arr = this.sidebarButtons
      const j = idx + dir
      if (j < 0 || j >= arr.length) return
      const tmp = arr[idx]
      arr.splice(idx, 1)
      arr.splice(j, 0, tmp)
    },
    sbCopyColor (idx) {
      const item = this.sidebarButtons[idx]
      if (!item) return
      this.sbCopiedColor = { bgColor: item.bgColor || '', textColor: item.textColor || '' }
      this.$message({ type: 'success', message: '已複製配色' })
    },
    sbPasteColor (idx) {
      if (!this.sbCopiedColor) return
      const item = this.sidebarButtons[idx]
      if (!item) return
      item.bgColor = this.sbCopiedColor.bgColor
      item.textColor = this.sbCopiedColor.textColor
    },
    sbApplyColorToAll () {
      if (!this.sbCopiedColor) return
      this.sidebarButtons.forEach(b => {
        b.bgColor = this.sbCopiedColor.bgColor
        b.textColor = this.sbCopiedColor.textColor
      })
      this.$message({ type: 'success', message: '已套用配色到全部按鈕' })
    },
    simBtnStyle (b) {
      const fs = (b.fontSize || 0) ? b.fontSize : this.posBtnSettings.fontSize
      const w = (b.width || 0) ? b.width : this.posBtnSettings.width
      const h = (b.height || 0) ? b.height : this.posBtnSettings.height
      const st = {
        fontSize: fs + 'px',
        height: h + 'px',
        color: b.textColor || '#1e293b',
        background: 'rgba(255,255,255,.94)',
        borderColor: 'rgba(255,255,255,.9)',
        border: '1px solid rgba(255,255,255,.9)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontWeight: '700',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: '1',
        minWidth: '0',
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        padding: '0 6px',
        transition: 'all .2s'
      }
      if (this.previewLayout === 'sidebar') {
        st.minWidth = '0'
        st.width = '100%'
      } else {
        st.minWidth = w + 'px'
        st.width = w + 'px'
      }
      const cf = b.colorFrom || ''
      const ct = b.colorTo || ''
      if (cf && ct) {
        st.background = 'linear-gradient(145deg, #fff, ' + cf + ')'
        st.borderColor = ct
        st.boxShadow = '0 1px 4px ' + ct + '40'
      } else if (cf) {
        st.backgroundColor = cf
        st.borderColor = cf
      }
      return st
    },
    resetSidebar () {
      this.sidebarButtons.forEach(b => { b.visible = true; b.bgColor = ''; b.textColor = '' })
      this.sidebarSettings.fontSize = 12
      this.sidebarSettings.width = 130
    },
    loadCategories () {
      this.$axios.get('/api/category/tree').then(res => {
        const list = []
        const walk = (nodes, depth, parentName) => {
          ;(nodes || []).forEach(n => {
            list.push({ id: String(n._id), name: n.cName || n.name || '', parentName: parentName || '', depth: depth || 0 })
            if (n.children && n.children.length) walk(n.children, (depth || 0) + 1, n.cName || n.name || '')
          })
        }
        walk(res.data || [], 0, '')
        this.categoryList = list
      }).catch(() => { this.categoryList = [] })
    },
    applyCategoryOrder (cfg) {
      const list = this.categoryList || []
      const cfgArr = Array.isArray(cfg) ? cfg : []
      const cfgMap = {}
      cfgArr.forEach(c => { cfgMap[String(c.id)] = c })
      const seen = {}
      const out = []
      cfgArr.forEach(c => {
        const item = list.find(x => String(x.id) === String(c.id))
        if (item) {
          seen[item.id] = true
          out.push({ id: item.id, name: item.name, parentName: item.parentName, depth: item.depth, visible: c.visible !== false, label: c.label || '', page: Number(c.page) || 0, fontSize: Number(c.fontSize) || 0, width: Number(c.width) || 0, height: Number(c.height) || 0 })
        }
      })
      list.forEach(item => {
        if (!seen[item.id]) out.push({ id: item.id, name: item.name, parentName: item.parentName, depth: item.depth, visible: true, label: '', page: 0, fontSize: 0, width: 0, height: 0 })
      })
      this.categoryOrderList = out
    },
    catOrderDragStart (idx, e) {
      this.catOrderDragIdx = idx
      if (e && e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        try { e.dataTransfer.setData('text/plain', String(idx)) } catch (err) {}
      }
    },
    catOrderDrop (idx) {
      const from = this.catOrderDragIdx
      if (from === null || from === undefined || from === idx) { this.catOrderDragIdx = null; return }
      const item = this.categoryOrderList.splice(from, 1)[0]
      this.categoryOrderList.splice(idx, 0, item)
      this.catOrderDragIdx = null
    },
    catOrderDragEnd () {
      this.catOrderDragIdx = null
    },
    moveCategoryOrder (idx, dir) {
      const to = idx + dir
      if (to < 0 || to >= this.categoryOrderList.length) return
      const item = this.categoryOrderList.splice(idx, 1)[0]
      this.categoryOrderList.splice(to, 0, item)
    },
    resetCategoryOrder () {
      this.categoryOrderList = (this.categoryList || []).map(item => ({ id: item.id, name: item.name, parentName: item.parentName, depth: item.depth, visible: true, label: '', page: 0, fontSize: 0, width: 0, height: 0 }))
    },
    loadData () {
      this.loadAmounts()
      this.loadCategories()
      this.$axios.get('/api/possetting/get')
        .then(res => {
          const d = res.data || {}
          this.categoryOrderConfig = Array.isArray(d.categoryOrder) ? d.categoryOrder : []
          this.applyCategoryOrder(this.categoryOrderConfig)
          this.form.serviceChargeEnabled = !!d.serviceChargeEnabled
          this.form.serviceChargeRate = d.serviceChargeRate || 10
          this.form.serviceChargePreDiscount = d.serviceChargePreDiscount !== false
          this.form.roundingMode = d.roundingMode || 'none'
          this.form.shareTableEnabled = !!d.shareTableEnabled
          this.form.showFoodImages = d.showFoodImages !== false
          this.form.gestureEnabled = d.gestureEnabled !== false
          this.form.businessDayCutoff = d.businessDayCutoff || '03:00'
          this.form.sideQtyMode = d.sideQtyMode || 'pending'
          this.form.modCodeUIMode = d.modCodeUIMode || 'A'
          this.form.reprintMinLevel = d.reprintMinLevel == null ? 3 : d.reprintMinLevel
          this.form.dineInPrintCopies = d.dineInPrintCopies == null ? 1 : d.dineInPrintCopies
          this.form.takeawayPrintCopies = d.takeawayPrintCopies == null ? 1 : d.takeawayPrintCopies
          this.form.dineInPrefix = d.dineInPrefix || '10'
          this.form.takeawayTablePrefix = d.takeawayTablePrefix || '99'
          this.form.takeawayPrefix = d.takeawayPrefix || '88'
          this.form.takeawayTableFrom = d.takeawayTableFrom || '901'
          this.form.takeawayTableTo = d.takeawayTableTo || '999'
          this.form.orderLayout = d.orderLayout || 'sidebar'
          this.form.orderTheme = d.orderTheme || 'indigo'
          this.form.showSideNav = d.showSideNav !== false
          this.form.ticketSide = d.ticketSide || 'right'
          this.form.ticketWidth = d.ticketWidth || 0
          this.form.dockHeight = d.dockHeight || 0
          this.form.sideNavWidth = d.sideNavWidth || 0
          this.form.dockMinH = d.dockMinH || 0
          const panels = d.panels || {}
          this.form.panelsSideNavX = (panels.sideNav && panels.sideNav.x) || 0
          this.form.panelsSideNavY = (panels.sideNav && panels.sideNav.y) || 0
          this.form.panelsSideNavW = (panels.sideNav && panels.sideNav.w) || 92
          this.form.panelsSideNavH = (panels.sideNav && panels.sideNav.h) || 0
          this.form.panelsFoodZoneX = (panels.foodZone && panels.foodZone.x) || 0
          this.form.panelsFoodZoneY = (panels.foodZone && panels.foodZone.y) || 0
          this.form.panelsFoodZoneW = (panels.foodZone && panels.foodZone.w) || 0
          this.form.panelsFoodZoneH = (panels.foodZone && panels.foodZone.h) || 0
          this.form.panelsTicketX = (panels.ticket && panels.ticket.x) || 0
          this.form.panelsTicketY = (panels.ticket && panels.ticket.y) || 0
          this.form.panelsTicketW = (panels.ticket && panels.ticket.w) || 0
          this.form.panelsTicketH = (panels.ticket && panels.ticket.h) || 0
          this.form.panelsDockX = (panels.dock && panels.dock.x) || 0
          this.form.panelsDockY = (panels.dock && panels.dock.y) || 0
          this.form.panelsDockW = (panels.dock && panels.dock.w) || 0
          this.form.panelsDockH = (panels.dock && panels.dock.h) || 0
          const pc = d.panelColors || {}
          this.form.panelColorsTicketHead = pc.ticketHead || ''
          this.form.panelColorsSideNav = pc.sideNav || ''
          this.form.panelColorsFoodZone = pc.foodZone || ''
          this.form.panelColorsDock = pc.dock || ''
          this.panelOpacity = Object.assign({ sideNav: 100, foodZone: 100, ticket: 100, dock: 100 }, d.panelOpacity || {})
          this.panelRadius = Object.assign({ sideNav: 4, foodZone: 4, ticket: 4, dock: 4 }, d.panelRadius || {})
          this.panelZIndex = Object.assign({ sideNav: 5, foodZone: 3, ticket: 4, dock: 2 }, d.panelZIndex || {})
          this.sideNavCols = d.sideNavCols || 3
          this.globalFontSize = d.globalFontSize || 14
          this.form.slots = Array.isArray(d.slots) ? d.slots.map(x => ({ name: x.name || '', start: x.start || '', end: x.end || '' })) : []
          this.form.teaChargesRequired = !!d.teaChargesRequired
          this.form.requiredCategoryId = d.requiredCategoryId || ''
          this.form.teaSeatSyncPax = !!d.teaSeatSyncPax
          this.form.servingNewItemsOnly = !!d.servingNewItemsOnly
          this.form.directPayMode = !!d.directPayMode
          this.form.comboNameOnce = !!d.comboNameOnce
          this.form.bundleEnabled = !!d.bundleEnabled
          this.form.bundleMode = d.bundleMode || 'auto'
          this.form.bundleRule = d.bundleRule || 'bestPrice'
          this.form.soldOutDailyReset = !!d.soldOutDailyReset
          this.form.jumpPriceEnabled = d.jumpPriceEnabled !== false
          this.form.failoverNotify = d.failoverNotify !== false
          this.form.failoverTimeout = [30, 45, 75, 90].indexOf(Number(d.failoverTimeout)) >= 0 ? Number(d.failoverTimeout) : 45
          const cip = d.cancelItemPrint || {}
          this.form.cancelItemPrint = { kitchen: cip.kitchen !== false, workstation: cip.workstation === true }
          const cap = d.cancelAllPrint || {}
          this.form.cancelAllPrint = { kitchen: cap.kitchen !== false }
          this.form.posFontFamily = d.posFontFamily || ''
          this.form.posFontUrl = d.posFontUrl || ''
          const perms = d.btnPerms || DEFAULT_BTN_PERMS
          const raw = (d.buttonOrder && d.buttonOrder.length) ? d.buttonOrder : DEFAULT_ORDER
          const mapped = raw.map(e => {
            if (typeof e === 'string') return { funcCode: '', color: '', perm: perms[e] || 1, visible: true }
            const fc = e.funcCode || e.no || ''
            const resolvedId = FUNC_CODE_MAP[fc] || ''
            const cf = e.colorFrom || e.color || ''
            const ct = e.colorTo || ''
            return { funcCode: fc, colorFrom: cf, colorTo: ct, textColor: e.textColor || '', perm: e.perm || (resolvedId ? (perms[resolvedId] || DEFAULT_BTN_PERMS[resolvedId] || 1) : 1), visible: e.visible !== false, fontSize: Number(e.fontSize) || 0, width: Number(e.width) || 0, height: Number(e.height) || 0, x: Number(e.x) || 0, y: Number(e.y) || 0, label: e.label || '', uid: e.uid || genBtnUid() }
          })
          const usedCodes = mapped.map(e => e.funcCode).filter(Boolean)
          BUTTONS.forEach(b => {
            if (usedCodes.indexOf(b.funcCode) < 0) {
              mapped.push({ funcCode: b.funcCode, colorFrom: '', colorTo: '', textColor: '', perm: DEFAULT_BTN_PERMS[b.id] || 1, visible: true, fontSize: 0, width: 0, height: 0, x: 0, y: 0, label: '', uid: genBtnUid() })
            }
          })
          this.form.buttonOrder = mapped
          const cts = d.calledTagStyle || {}
          this.calledTagStyle = { color: cts.color || '#ea580c', background: cts.background || '#ffedd5', border: cts.border || '#fed7aa' }
          const bgs = d.badgeStyle || {}
          const defaultBadge = [
            { key: 'transfer', label: '轉', char: '轉', fontSize: 13, color: '#ffffff', background: '#e6a23c', visible: true },
            { key: 'merge', label: '合', char: '合', fontSize: 13, color: '#ffffff', background: '#67c23a', visible: true },
            { key: 'split', label: '分', char: '分', fontSize: 13, color: '#ffffff', background: '#409eff', visible: true },
            { key: 'chase', label: '追', char: '追', fontSize: 13, color: '#ffffff', background: '#f56c6c', visible: true }
          ]
          this.badgeStyleList = defaultBadge.map(d => {
            const s = bgs[d.key] || {}
            return { key: d.key, label: d.label, char: d.char, fontSize: s.fontSize || d.fontSize, color: s.color || d.color, background: s.background || d.background, visible: s.visible !== false }
          })
          const bl = d.boardLayout || {}
          this.boardLayout = { cardHeight: bl.cardHeight || 110, cardWidth: bl.cardWidth || 0, gridCols: bl.gridCols || 0, gridRows: bl.gridRows || 0, gap: bl.gap !== undefined ? bl.gap : 10 }
          this.managerMenuItems = Array.isArray(d.managerMenu) ? d.managerMenu.map(m => ({ funcCode: m.funcCode || '', visible: m.visible !== false })) : []
          const cd = d.cardDisplay || {}
          const newCd = {}
          CARD_DISPLAY_ELEMENTS.forEach(el => {
            newCd[el.key] = { show: cd[el.key] ? cd[el.key].show !== false : true, fontSize: (cd[el.key] && cd[el.key].fontSize) || DEFAULT_CARD_DISPLAY[el.key].fontSize, position: (cd[el.key] && cd[el.key].position) || DEFAULT_CARD_DISPLAY[el.key].position }
          })
          this.cardDisplay = newCd
          const bs = d.posBtnSettings || {}
          this.posBtnSettings.fontSize = bs.fontSize || 18
          this.posBtnSettings.width = bs.width || 100
          this.posBtnSettings.height = bs.height || 40
          this.posBtnSettings.rowsPerPage = bs.rowsPerPage != null ? bs.rowsPerPage : 2
          this.posBtnSettings.perRow = bs.perRow != null ? bs.perRow : 8
          const cbs = d.catBtnSettings || {}
          this.catBtnSettings = { fontSize: cbs.fontSize || 13, width: cbs.width != null ? cbs.width : 0, height: cbs.height || 40, padding: cbs.padding != null ? cbs.padding : 20, paddingY: cbs.paddingY != null ? cbs.paddingY : 0, gapX: cbs.gapX != null ? cbs.gapX : 10, gapY: cbs.gapY != null ? cbs.gapY : 10, cols: cbs.cols > 0 ? cbs.cols : 4, rows: cbs.rows != null ? cbs.rows : 6, shape: cbs.shape || 'pill' }
          const fbs = d.foodBtnSettings || {}
          this.foodBtnSettings = { cols: fbs.cols != null ? fbs.cols : 0, rows: fbs.rows != null ? fbs.rows : 0, fontSize: fbs.fontSize || 25, width: fbs.width != null ? fbs.width : 0, height: fbs.height != null ? fbs.height : 0, minHeight: fbs.minHeight || 88, imageSize: fbs.imageSize || 40, paddingX: fbs.paddingX != null ? fbs.paddingX : 3, paddingY: fbs.paddingY != null ? fbs.paddingY : 6, gapX: fbs.gapX != null ? fbs.gapX : 6, gapY: fbs.gapY != null ? fbs.gapY : 6, showPlu: fbs.showPlu !== false, showPrice: fbs.showPrice !== false, showStock: fbs.showStock !== false }
          const dn = d.dockNav || {}
          this.dockNav.fontSize = dn.fontSize || 18
          this.dockNav.width = dn.width || 100
          this.dockNav.height = dn.height || 40
          this.dockNav.bgColor = dn.bgColor || '#409eff'
          this.dockNav.textColor = dn.textColor || '#ffffff'
          this.dockNav.pageNumFontSize = dn.pageNumFontSize || 12
          this.dockNav.gap = dn.gap != null ? dn.gap : 6
          const sb = d.sidebarSettings || {}
          this.sidebarSettings.fontSize = sb.fontSize || 12
          this.sidebarSettings.width = sb.width || 130
          const sbBtns = d.sidebarButtons || []
          const sbDef = this.sidebarButtons
          const sbMap = {}
          sbBtns.forEach(b => { sbMap[b.id] = b })
          this.sidebarButtons = sbDef.map(d => Object.assign({}, d, sbMap[d.id] || {}))
        })
        .catch(err => console.log(err))
    },
    loadAmounts () {
      this.$axios.get('/api/amount/list').then(res => {
        const items = Array.isArray(res.data) ? res.data : []
        this.payMethods = items.filter(i => i && i.key === 'payMethod')
        this.payTypes = items.filter(i => i && i.key === 'payType')
      }).catch(() => {})
    },
    addAmount (key, dataKey) {
      const val = (this[dataKey] || '').trim()
      if (!val) return
      this.$axios.post('/api/amount/save', { key, value: val }).then(() => {
        this[dataKey] = ''
        this.loadAmounts()
      }).catch(err => {
        this.$message({ type: 'error', message: err.response ? err.response.data : '新增失敗' })
      })
    },
    deleteAmount (item) {
      this.$axios.post('/api/amount/delete', { _id: item._id }).then(() => {
        this.loadAmounts()
      }).catch(err => {
        this.$message({ type: 'error', message: err.response ? err.response.data : '刪除失敗' })
      })
    },
    addSlot (preset) {
      if (preset) {
        this.form.slots.push({ name: preset.name, start: preset.start, end: preset.end })
      } else {
        this.form.slots.push({ name: '', start: '', end: '' })
      }
    },
    addEmptyButton () {
      this.form.buttonOrder.push({ funcCode: '', colorFrom: '', colorTo: '', textColor: '', perm: 1, visible: true, fontSize: 0, width: 0, height: 0, x: 0, y: 0, label: '', uid: genBtnUid() })
    },
    duplicateLastButton () {
      const last = this.form.buttonOrder[this.form.buttonOrder.length - 1]
      if (!last) { this.addEmptyButton(); return }
      const copy = JSON.parse(JSON.stringify(last))
      copy.uid = genBtnUid()
      this.form.buttonOrder.push(copy)
    },
    duplicateButton (idx) {
      const src = this.form.buttonOrder[idx]
      if (!src) return
      const copy = JSON.parse(JSON.stringify(src))
      copy.uid = genBtnUid()
      this.form.buttonOrder.splice(idx + 1, 0, copy)
    },
    applySizeToAll () {
      const last = this.form.buttonOrder[this.form.buttonOrder.length - 1]
      if (!last) return
      this.form.buttonOrder.forEach(e => {
        if (last.fontSize) e.fontSize = last.fontSize
        if (last.width) e.width = last.width
        if (last.height) e.height = last.height
      })
      this.$message({ type: 'success', message: '已套用尺寸到全部按鈕' })
    },
    randomizeColors () {
      const pairs = [
        { from: '#dbeafe', to: '#3b82f6' },
        { from: '#d1fae5', to: '#10b981' },
        { from: '#fef3c7', to: '#f59e0b' },
        { from: '#fee2e2', to: '#ef4444' },
        { from: '#ede9fe', to: '#8b5cf6' },
        { from: '#cffafe', to: '#06b6d4' },
        { from: '#ffe4e6', to: '#f43f5e' },
        { from: '#dcfce7', to: '#22c55e' },
        { from: '#e0e7ff', to: '#6366f1' },
        { from: '#fce7f3', to: '#ec4899' }
      ]
      const shuffled = pairs.slice()
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const tmp = shuffled[i]
        shuffled[i] = shuffled[j]
        shuffled[j] = tmp
      }
      this.form.buttonOrder.forEach((e, i) => {
        const c = shuffled[i % shuffled.length]
        e.colorFrom = c.from
        e.colorTo = c.to
        e.textColor = '#1e293b'
      })
      this.$message({ type: 'success', message: '已隨機配色' })
    },
    sbDragIdx: -1,
    sbDragStart (idx, e) {
      this.sbDragIdx = idx
      e.dataTransfer.effectAllowed = 'move'
    },
    sbDrop (targetIdx) {
      if (this.sbDragIdx < 0 || this.sbDragIdx === targetIdx) return
      const item = this.sidebarButtons.splice(this.sbDragIdx, 1)[0]
      this.sidebarButtons.splice(targetIdx, 0, item)
      this.sbDragIdx = -1
    },
    resetCalledTagStyle () {
      this.calledTagStyle = { color: '#ea580c', background: '#ffedd5', border: '#fed7aa' }
    },
    resetBadgeStyle () {
      this.badgeStyleList = [
        { key: 'transfer', label: '轉', char: '轉', fontSize: 13, color: '#ffffff', background: '#e6a23c', visible: true },
        { key: 'merge', label: '合', char: '合', fontSize: 13, color: '#ffffff', background: '#67c23a', visible: true },
        { key: 'split', label: '分', char: '分', fontSize: 13, color: '#ffffff', background: '#409eff', visible: true },
        { key: 'chase', label: '追', char: '追', fontSize: 13, color: '#ffffff', background: '#f56c6c', visible: true }
      ]
    },
    resetCatFoodBtnSettings () {
      this.catBtnSettings = { fontSize: 13, width: 0, height: 40, padding: 20, paddingY: 0, gapX: 10, gapY: 10, cols: 4, rows: 6, shape: 'pill' }
      this.foodBtnSettings = { cols: 0, rows: 0, fontSize: 25, width: 0, height: 0, minHeight: 88, imageSize: 40, paddingX: 3, paddingY: 6, gapX: 6, gapY: 6, showPlu: true, showPrice: true, showStock: true }
    },
    resetCardDisplay () {
      this.cardDisplay = JSON.parse(JSON.stringify(DEFAULT_CARD_DISPLAY))
    },
    exportSettings () {
      const payload = Object.assign({}, this.form, {
        managerMenu: this.managerMenuItems.map(m => ({ funcCode: m.funcCode, visible: m.visible })),
        calledTagStyle: this.calledTagStyle,
        badgeStyle: this.badgeStyleList.reduce((o, s) => { o[s.key] = { fontSize: s.fontSize, color: s.color, background: s.background, visible: s.visible !== false }; return o }, {}),
        sidebarSettings: this.sidebarSettings,
        sidebarButtons: this.sidebarButtons.map(b => ({ id: b.id, funcCode: b.funcCode, visible: b.visible, bgColor: b.bgColor, textColor: b.textColor })),
        posBtnSettings: this.posBtnSettings,
        catBtnSettings: this.catBtnSettings,
        categoryOrder: this.categoryOrderList.map(c => ({ id: c.id, visible: c.visible !== false, label: c.label || '', page: Number(c.page) || 0, fontSize: Number(c.fontSize) || 0, width: Number(c.width) || 0, height: Number(c.height) || 0 })),
        foodBtnSettings: this.foodBtnSettings
      })
      delete payload.panelsSideNavX
      delete payload.panelsSideNavY
      delete payload.panelsSideNavW
      delete payload.panelsSideNavH
      delete payload.panelsFoodZoneX
      delete payload.panelsFoodZoneY
      delete payload.panelsFoodZoneW
      delete payload.panelsFoodZoneH
      delete payload.panelsTicketX
      delete payload.panelsTicketY
      delete payload.panelsTicketW
      delete payload.panelsTicketH
      delete payload.panelsDockX
      delete payload.panelsDockY
      delete payload.panelsDockW
      delete payload.panelsDockH
      delete payload.panelColorsTicketHead
      delete payload.panelColorsSideNav
      delete payload.panelColorsFoodZone
      delete payload.panelColorsDock
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'possetting_' + new Date().toISOString().slice(0, 10) + '.json'
      a.click()
      URL.revokeObjectURL(url)
      this.$message({ type: 'success', message: '設定已匯出' })
    },
    importSettings (e) {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result)
          this.$confirm('確定要匯入設定？現有設定會被覆蓋。', '匯入設定', { type: 'warning' }).then(() => {
            this.$axios.post('/api/possetting/save', data).then(() => {
              this.$message({ type: 'success', message: '匯入成功！' })
              this.loadData()
            }).catch(err => {
              this.$message({ type: 'error', message: err.response ? err.response.data : '匯入失敗' })
            })
          }).catch(() => {})
        } catch (err) {
          this.$message({ type: 'error', message: '檔案格式錯誤' })
        }
        e.target.value = ''
      }
      reader.readAsText(file)
    },
    resolveFuncLabel (funcCode) {
      if (!funcCode) return '—'
      const b = BUTTONS.find(x => x.funcCode === funcCode) || SIDEBAR_FUNC.find(x => x.funcCode === funcCode) || MANAGER_FUNC.find(x => x.funcCode === funcCode)
      return b ? ('[' + funcCode + '] ' + b.label) : ('[' + funcCode + '] ?')
    },
    resolveFuncName (funcCode) {
      if (!funcCode) return '—'
      const b = BUTTONS.find(x => x.funcCode === funcCode) || SIDEBAR_FUNC.find(x => x.funcCode === funcCode) || MANAGER_FUNC.find(x => x.funcCode === funcCode)
      return b ? b.label : '?'
    },
    buttonDisplayName (b) {
      return (b && b.label) || this.resolveFuncName(b ? b.funcCode : '')
    },
    onFuncCodeChange (idx) {
      const entry = this.form.buttonOrder[idx]
      if (entry && FUNC_CODE_MAP[entry.funcCode]) {
        const b = BUTTONS.find(x => x.funcCode === entry.funcCode)
        if (b) entry.perm = DEFAULT_BTN_PERMS[b.id] || 1
      }
    },
    onSbFuncCodeChange (idx) {
      const item = this.sidebarButtons[idx]
      if (item && FUNC_CODE_MAP[item.funcCode]) {
        const b = BUTTONS.find(x => x.funcCode === item.funcCode)
        if (b) item.label = b.label
      }
    },
    addManagerMenuItem () {
      this.managerMenuItems.push({ funcCode: '', visible: true })
    },
    onManagerMenuChange (idx) {
      // just refresh label via resolveFuncName
    },
    moveManagerMenu (idx, dir) {
      const arr = this.managerMenuItems
      const j = idx + dir
      if (j < 0 || j >= arr.length) return
      const tmp = arr[idx]
      arr.splice(idx, 1)
      arr.splice(j, 0, tmp)
    },
    moveButton (idx, dir) {
      const arr = this.form.buttonOrder
      const j = idx + dir
      if (j < 0 || j >= arr.length) return
      const tmp = arr[idx]
      arr.splice(idx, 1)
      arr.splice(j, 0, tmp)
    },
    onBtnDragStart (idx, e) {
      const t = e && e.target
      if (t && t.closest && t.closest('input, textarea, select, button, .el-switch, .el-color-picker')) {
        if (e.preventDefault) e.preventDefault()
        return
      }
      this.dragBtnIdx = idx
      if (e && e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        try { e.dataTransfer.setData('text/plain', String(idx)) } catch (err) {}
      }
    },
    onBtnDragOver (idx, e) {
      if (e && e.preventDefault) e.preventDefault()
      this.dragOverBtnIdx = idx
    },
    onBtnDrop (idx, e) {
      if (e && e.preventDefault) e.preventDefault()
      const from = this.dragBtnIdx
      this.dragBtnIdx = null
      this.dragOverBtnIdx = null
      if (from === null || from === idx) return
      const arr = this.form.buttonOrder
      const moved = arr.splice(from, 1)[0]
      arr.splice(idx, 0, moved)
    },
    onBtnDragEnd () {
      this.dragBtnIdx = null
      this.dragOverBtnIdx = null
    },
    resetOrder () {
      this.form.buttonOrder = JSON.parse(JSON.stringify(DEFAULT_ORDER))
    },
    panelStyle (p) {
      return {
        left: p.x + 'px',
        top: p.y + 'px',
        width: p.w + 'px',
        height: p.h + 'px'
      }
    },
    onPanelMouseDown (e, key) {
      if (this.panelLocks[key]) return
      this.dragging = key
      const rect = this.$refs.layoutCanvas.getBoundingClientRect()
      const s = this.canvasScale
      const fk = this._formKey(key)
      this.dragOffset = {
        x: e.clientX - rect.left - (this.form[fk + 'X'] * s),
        y: e.clientY - rect.top - (this.form[fk + 'Y'] * s)
      }
    },
    onResizeMouseDown (e, key) {
      if (this.panelLocks[key]) return
      this.resizing = key
      const fk = this._formKey(key)
      this.resizeStart = {
        x: e.clientX,
        y: e.clientY,
        w: this.form[fk + 'W'],
        h: this.form[fk + 'H']
      }
    },
    onCanvasMouseMove (e) {
      if (!this.dragging && !this.resizing) return
      const rect = this.$refs.layoutCanvas.getBoundingClientRect()
      const s = this.canvasScale
      if (this.dragging) {
        const fk = this._formKey(this.dragging)
        let nx = Math.round((e.clientX - rect.left - this.dragOffset.x) / s)
        let ny = Math.round((e.clientY - rect.top - this.dragOffset.y) / s)
        if (this.snapToGrid) { nx = this.snapVal(nx); ny = this.snapVal(ny) }
        nx = Math.max(0, Math.min(1920, nx))
        ny = Math.max(0, Math.min(1080, ny))
        this.form[fk + 'X'] = nx
        this.form[fk + 'Y'] = ny
      } else if (this.resizing) {
        const fk = this._formKey(this.resizing)
        let nw = Math.round(this.resizeStart.w + (e.clientX - this.resizeStart.x) / s)
        let nh = Math.round(this.resizeStart.h + (e.clientY - this.resizeStart.y) / s)
        if (this.snapToGrid) { nw = this.snapVal(nw); nh = this.snapVal(nh) }
        const minW = fk === 'panelsSideNav' ? 64 : 200
        const minH = fk === 'panelsDock' ? 60 : 100
        nw = Math.max(minW, Math.min(1920, nw))
        nh = Math.max(minH, Math.min(1080, nh))
        this.form[fk + 'W'] = nw
        this.form[fk + 'H'] = nh
      }
    },
    onCanvasMouseUp () {
      if (this.dragging || this.resizing) this.pushHistory()
      this.dragging = null
      this.resizing = null
    },
    _formKey (key) {
      const map = { sideNav: 'panelsSideNav', foodZone: 'panelsFoodZone', ticket: 'panelsTicket', dock: 'panelsDock' }
      return map[key] || key
    },
    panelFreeStyle (key) {
      const fk = this._formKey(key)
      const x = this.form[fk + 'X'] || 0
      const y = this.form[fk + 'Y'] || 0
      const w = this.form[fk + 'W'] || 0
      const h = this.form[fk + 'H'] || 0
      const s = this.canvasScale
      const colors = { sideNav: this.form.panelColorsSideNav, foodZone: this.form.panelColorsFoodZone, ticket: this.form.panelColorsTicketHead, dock: this.form.panelColorsDock }
      const opacity = (this.panelOpacity[key] != null ? this.panelOpacity[key] : 100) / 100
      const radius = this.panelRadius[key] != null ? this.panelRadius[key] : 4
      const zIndex = this.panelZIndex[key] != null ? this.panelZIndex[key] : 1
      return {
        position: 'absolute',
        left: x * s + 'px',
        top: y * s + 'px',
        width: w * s + 'px',
        height: h * s + 'px',
        background: colors[key] || '#e0e0e0',
        opacity: opacity,
        borderRadius: radius + 'px',
        zIndex: zIndex
      }
    },
    resetLayout () {
      this.form.panelsSideNavX = 0
      this.form.panelsSideNavY = 0
      this.form.panelsSideNavW = 92
      this.form.panelsSideNavH = 0
      this.form.panelsFoodZoneX = 0
      this.form.panelsFoodZoneY = 0
      this.form.panelsFoodZoneW = 0
      this.form.panelsFoodZoneH = 0
      this.form.panelsTicketX = 0
      this.form.panelsTicketY = 0
      this.form.panelsTicketW = 0
      this.form.panelsTicketH = 0
      this.form.panelsDockX = 0
      this.form.panelsDockY = 0
      this.form.panelsDockW = 0
      this.form.panelsDockH = 0
      this.form.panelColorsTicketHead = ''
      this.form.panelColorsSideNav = ''
      this.form.panelColorsFoodZone = ''
      this.form.panelColorsDock = ''
      this.panelOpacity = { sideNav: 100, foodZone: 100, ticket: 100, dock: 100 }
      this.panelRadius = { sideNav: 4, foodZone: 4, ticket: 4, dock: 4 }
      this.panelZIndex = { sideNav: 5, foodZone: 3, ticket: 4, dock: 2 }
      this.sideNavCols = 3
      this.globalFontSize = 14
      this.panelLocks = { sideNav: false, foodZone: false, ticket: false, dock: false }
      this.history = []
      this.historyIndex = -1
    },
    handleFontSuccess (res) {
      if (res && res.url) {
        this.form.posFontUrl = res.url
        if (!this.form.posFontFamily) this.form.posFontFamily = '自訂字型'
        this.save()
      } else {
        this.$message({ type: 'error', message: '字型上傳失敗，請重試' })
      }
    },
    handleFontError () {
      this.$message({ type: 'error', message: '字型上傳失敗，請重試' })
    },
    beforeFontUpload (file) {
      const ext = (file.name || '').split('.').pop().toLowerCase()
      if (['ttf', 'otf', 'woff', 'woff2'].indexOf(ext) < 0) {
        this.$message({ type: 'error', message: '只支援 ttf / otf / woff / woff2 字型檔！' })
        return false
      }
      return true
    },
    queryFonts (queryString, cb) {
      const q = (queryString || '').toLowerCase()
      const list = this.fontOptions
        .filter(f => f.value)
        .map(f => ({ value: f.value }))
      const results = q ? list.filter(i => i.value.toLowerCase().indexOf(q) >= 0) : list
      cb(results)
    },
    save () {
      const payload = Object.assign({}, this.form, {
        panels: {
          sideNav: { x: this.form.panelsSideNavX, y: this.form.panelsSideNavY, w: this.form.panelsSideNavW, h: this.form.panelsSideNavH },
          foodZone: { x: this.form.panelsFoodZoneX, y: this.form.panelsFoodZoneY, w: this.form.panelsFoodZoneW, h: this.form.panelsFoodZoneH },
          ticket: { x: this.form.panelsTicketX, y: this.form.panelsTicketY, w: this.form.panelsTicketW, h: this.form.panelsTicketH },
          dock: { x: this.form.panelsDockX, y: this.form.panelsDockY, w: this.form.panelsDockW, h: this.form.panelsDockH }
        },
        panelColors: {
          ticketHead: this.form.panelColorsTicketHead,
          sideNav: this.form.panelColorsSideNav,
          foodZone: this.form.panelColorsFoodZone,
          dock: this.form.panelColorsDock
        },
        panelOpacity: this.panelOpacity,
        panelRadius: this.panelRadius,
        panelZIndex: this.panelZIndex,
        sideNavCols: this.sideNavCols,
        globalFontSize: this.globalFontSize,
        posBtnSettings: { fontSize: this.posBtnSettings.fontSize, width: this.posBtnSettings.width, height: this.posBtnSettings.height || 40, rowsPerPage: this.posBtnSettings.rowsPerPage || 2, perRow: this.posBtnSettings.perRow || 8 },
        catBtnSettings: { fontSize: this.catBtnSettings.fontSize, width: this.catBtnSettings.width, height: this.catBtnSettings.height, padding: this.catBtnSettings.padding, paddingY: this.catBtnSettings.paddingY, gapX: this.catBtnSettings.gapX, gapY: this.catBtnSettings.gapY, cols: this.catBtnSettings.cols || 4, rows: this.catBtnSettings.rows != null ? this.catBtnSettings.rows : 6, shape: this.catBtnSettings.shape || 'pill' },
        categoryOrder: this.categoryOrderList.map(c => ({ id: c.id, visible: c.visible !== false, label: c.label || '', page: Number(c.page) || 0, fontSize: Number(c.fontSize) || 0, width: Number(c.width) || 0, height: Number(c.height) || 0 })),
        foodBtnSettings: { cols: this.foodBtnSettings.cols, rows: this.foodBtnSettings.rows, fontSize: this.foodBtnSettings.fontSize, width: this.foodBtnSettings.width, height: this.foodBtnSettings.height, minHeight: this.foodBtnSettings.minHeight, imageSize: this.foodBtnSettings.imageSize, paddingX: this.foodBtnSettings.paddingX, paddingY: this.foodBtnSettings.paddingY, gapX: this.foodBtnSettings.gapX, gapY: this.foodBtnSettings.gapY, showPlu: this.foodBtnSettings.showPlu, showPrice: this.foodBtnSettings.showPrice, showStock: this.foodBtnSettings.showStock },
        dockNav: { fontSize: this.dockNav.fontSize, width: this.dockNav.width, height: this.dockNav.height, bgColor: this.dockNav.bgColor, textColor: this.dockNav.textColor, pageNumFontSize: this.dockNav.pageNumFontSize, gap: this.dockNav.gap },
        sidebarSettings: { fontSize: this.sidebarSettings.fontSize, width: this.sidebarSettings.width },
        calledTagStyle: { color: this.calledTagStyle.color, background: this.calledTagStyle.background, border: this.calledTagStyle.border },
        badgeStyle: this.badgeStyleList.reduce((o, s) => { o[s.key] = { fontSize: s.fontSize, color: s.color, background: s.background, visible: s.visible !== false }; return o }, {}),
        boardLayout: { cardHeight: this.boardLayout.cardHeight, cardWidth: this.boardLayout.cardWidth, gridCols: this.boardLayout.gridCols, gridRows: this.boardLayout.gridRows, gap: this.boardLayout.gap },
        cardDisplay: JSON.parse(JSON.stringify(this.cardDisplay)),
        managerMenu: this.managerMenuItems.map(m => ({ funcCode: m.funcCode, visible: m.visible })),
        sidebarButtons: this.sidebarButtons.map(b => ({ id: b.id, funcCode: b.funcCode, visible: b.visible, bgColor: b.bgColor, textColor: b.textColor }))
      })
      delete payload.panelsSideNavX
      delete payload.panelsSideNavY
      delete payload.panelsSideNavW
      delete payload.panelsSideNavH
      delete payload.panelsFoodZoneX
      delete payload.panelsFoodZoneY
      delete payload.panelsFoodZoneW
      delete payload.panelsFoodZoneH
      delete payload.panelsTicketX
      delete payload.panelsTicketY
      delete payload.panelsTicketW
      delete payload.panelsTicketH
      delete payload.panelsDockX
      delete payload.panelsDockY
      delete payload.panelsDockW
      delete payload.panelsDockH
      delete payload.panelColorsTicketHead
      delete payload.panelColorsSideNav
      delete payload.panelColorsFoodZone
      delete payload.panelColorsDock
      this.$axios.post('/api/possetting/save', payload)
        .then(res => this.$message({ type: 'success', message: '已保存，前台將自動同步' }))
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '保存失敗' }))
    },
    snapVal (v) {
      return Math.round(v / this.gridSize) * this.gridSize
    },
    toggleLock (key) {
      this.$set(this.panelLocks, key, !this.panelLocks[key])
    },
    changeZIndex (key, dir) {
      const cur = this.panelZIndex[key] || 1
      this.$set(this.panelZIndex, key, Math.max(1, Math.min(20, cur + dir)))
    },
    pushHistory () {
      const snapshot = JSON.parse(JSON.stringify({
        form: this.form,
        panelOpacity: this.panelOpacity,
        panelRadius: this.panelRadius,
        panelZIndex: this.panelZIndex,
        sideNavCols: this.sideNavCols,
        globalFontSize: this.globalFontSize
      }))
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1)
      }
      this.history.push(snapshot)
      if (this.history.length > this.historyMax) this.history.shift()
      this.historyIndex = this.history.length - 1
    },
    undo () {
      if (this.historyIndex <= 0) return
      this.historyIndex--
      this._restoreHistory(this.history[this.historyIndex])
    },
    redo () {
      if (this.historyIndex >= this.history.length - 1) return
      this.historyIndex++
      this._restoreHistory(this.history[this.historyIndex])
    },
    _restoreHistory (snap) {
      const f = snap.form
      const keys = Object.keys(f)
      keys.forEach(k => { this.$set(this.form, k, f[k]) })
      this.panelOpacity = JSON.parse(JSON.stringify(snap.panelOpacity))
      this.panelRadius = JSON.parse(JSON.stringify(snap.panelRadius))
      this.panelZIndex = JSON.parse(JSON.stringify(snap.panelZIndex))
      this.sideNavCols = snap.sideNavCols
      this.globalFontSize = snap.globalFontSize
    },
    handleKeydown (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); this.undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); this.redo() }
    },
    fsPanelStyle (p) {
      return {
        position: 'absolute',
        left: (p.x / 1920 * 100) + '%',
        top: (p.y / 1080 * 100) + '%',
        width: (p.w / 1920 * 100) + '%',
        height: (p.h / 1080 * 100) + '%',
        background: p.color || p.defaultColor,
        border: '2px solid rgba(76,132,255,0.5)',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    },
    applyPreset (type) {
      const presets = {
        classic: {
          sideNav: { x: 0, y: 0, w: 92, h: 980 },
          foodZone: { x: 92, y: 0, w: 1448, h: 880 },
          ticket: { x: 1540, y: 0, w: 380, h: 880 },
          dock: { x: 0, y: 980, w: 1920, h: 100 }
        },
        sidebar: {
          sideNav: { x: 0, y: 0, w: 180, h: 1080 },
          foodZone: { x: 180, y: 0, w: 1360, h: 980 },
          ticket: { x: 1540, y: 0, w: 380, h: 980 },
          dock: { x: 180, y: 980, w: 1740, h: 100 }
        },
        kiosk: {
          sideNav: { x: 0, y: 0, w: 0, h: 0 },
          foodZone: { x: 0, y: 0, w: 1540, h: 1080 },
          ticket: { x: 1540, y: 0, w: 380, h: 980 },
          dock: { x: 0, y: 980, w: 1540, h: 100 }
        }
      }
      const p = presets[type]
      if (!p) return
      this.form.panelsSideNavX = p.sideNav.x
      this.form.panelsSideNavY = p.sideNav.y
      this.form.panelsSideNavW = p.sideNav.w
      this.form.panelsSideNavH = p.sideNav.h
      this.form.panelsFoodZoneX = p.foodZone.x
      this.form.panelsFoodZoneY = p.foodZone.y
      this.form.panelsFoodZoneW = p.foodZone.w
      this.form.panelsFoodZoneH = p.foodZone.h
      this.form.panelsTicketX = p.ticket.x
      this.form.panelsTicketY = p.ticket.y
      this.form.panelsTicketW = p.ticket.w
      this.form.panelsTicketH = p.ticket.h
      this.form.panelsDockX = p.dock.x
      this.form.panelsDockY = p.dock.y
      this.form.panelsDockW = p.dock.w
      this.form.panelsDockH = p.dock.h
      this.pushHistory()
    }
  },
  created () {
    this.loadData()
  },
  mounted () {
    document.addEventListener('keydown', this.handleKeydown)
    this.pushHistory()
  },
  beforeDestroy () {
    document.removeEventListener('keydown', this.handleKeydown)
  }
}
</script>

<style scoped>
#possetting{ padding: 2px; }
.box-card{ max-width: 1200px; margin-bottom: 18px; border-radius: 14px; border: 1px solid #edf0f5; box-shadow: 0 4px 18px rgba(31,45,61,.06); overflow: hidden; }
.box-card /deep/ .el-card__header{ background: linear-gradient(90deg, #f4f7ff 0%, #ffffff 70%); border-bottom: 1px solid #eef2f8; padding: 13px 18px; font-size: 15px; font-weight: 700; color: #1f2937; }
.box-card /deep/ .el-card__body{ padding: 18px 20px; }
.hd-icon{ color: #4c84ff; margin-right: 8px; font-size: 16px; }
/deep/ .el-form-item__label{ font-weight: 600; color: #475569; }
/deep/ .el-input__inner, /deep/ .el-textarea__inner{ border-radius: 8px; }
/deep/ .el-radio{ margin-right: 14px; }
.unit{ margin-left: 6px; font-size: 14px; color: #606266; }
.btn-layout-list{ max-height: 480px; overflow: auto; border: 1px solid #f0f2f5; border-radius: 10px; }
.drag-handle{ cursor: grab; user-select: none; font-size: 14px; color: #909399; margin-right: 4px; letter-spacing: 2px; }
.drag-handle:hover{ color: #409eff; }
.sidebar-btn-row[draggable="true"]:active{ opacity: 0.5; }
.cat-order-row[draggable="true"]:active{ opacity: 0.5; }
.cat-order-row .bl-label{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.btn-layout-header{ display: flex; align-items: center; gap: 10px; padding: 6px 12px; background: #f4f7ff; border-bottom: 2px solid #e0e5ef; font-size: 12px; font-weight: 700; color: #606266; }
.btn-layout-row{ display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid #f0f0f0; transition: background .15s; }
.btn-layout-header.pos-btn-grid, .btn-layout-row.pos-btn-grid{ display: grid; grid-template-columns: 48px 48px 130px 110px 110px 56px 56px 56px 48px 48px 1fr; gap: 8px; align-items: center; }
.btn-layout-row:hover{ background: #f8faff; }
.btn-layout-row.hidden{ opacity: 0.5; }
.bl-label{ font-size: 14px; color: #303133; width: 130px; }
.bl-id{ font-size: 12px; color: #c0c4cc; }
.bl-colors{ display: flex; gap: 2px; align-items: center; }
.bl-actions{ margin-left: auto; display: flex; gap: 4px; align-items: center; }
.bl-drag-handle{ display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 26px; cursor: grab; color: #909399; font-size: 15px; line-height: 1; user-select: none; border-radius: 4px; letter-spacing: 2px; }
.bl-drag-handle:hover{ background: #eef2ff; color: #4338ca; }
.bl-drag-handle:active{ cursor: grabbing; }
.btn-layout-row.row-dragging{ opacity: 0.45; background: #eef2ff; }
.btn-layout-row.row-dragging *{ pointer-events: none; }
.btn-layout-row.row-drop-target{ box-shadow: inset 0 -2px 0 #409eff, inset 0 2px 0 #409eff; background: #ecf5ff; }
.bl-divider{ padding: 8px 10px; font-size: 12px; color: #909399; background: #f5f7fa; }
.btn-layout-footer{ margin-top: 12px; display: flex; gap: 10px; }
.sidebar-btn-list{ max-height: 360px; overflow: auto; border: 1px solid #f0f2f5; border-radius: 10px; }
.sidebar-btn-row{ display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid #f0f0f0; transition: background .15s; }
.sidebar-btn-row:hover{ background: #f8faff; }
.sb-color-hint{ font-size: 12px; color: #909399; min-width: 50px; }
.amount-tags{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
/deep/ .el-tag{ margin: 0; }
.rounding-hint{ margin-top: 4px; font-size: 12px; color: #909399; line-height: 18px; }
.slot-list{ padding: 2px 0; }
.slot-row{ display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.slot-sep{ color: #c0c4cc; }
.pos-row{ display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pos-label{ font-size: 12px; color: #909399; min-width: 16px; }
.layout-card /deep/ .el-divider__text{ font-size: 13px; font-weight: 600; color: #4c84ff; }
.action-bar{ display: flex; align-items: center; gap: 8px; padding: 8px 0; margin-bottom: 8px; flex-wrap: wrap; background: #f8faff; border-radius: 8px; padding: 8px 12px; }
.ab-divider{ width: 1px; height: 20px; background: #dcdfe6; margin: 0 4px; }
.ab-counter{ font-size: 11px; color: #909399; margin-left: 2px; }
.ab-spacer{ flex: 1; }
.layout-canvas-wrap{ margin: 8px 0 4px; }
.layout-canvas{ width: 960px; height: 540px; background: #1a1a2e; border: 2px solid #d0d5dd; border-radius: 8px; overflow: hidden; user-select: none; position: relative; }
.layout-canvas.is-free{ position: relative; }
.grid-overlay{ position: absolute; inset: 0; z-index: 0; pointer-events: none; background-image: linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px); }
.pv-panel-header{ display: flex; align-items: center; gap: 4px; padding: 2px 4px; background: rgba(0,0,0,.15); border-radius: 3px 3px 0 0; width: 100%; min-height: 18px; }
.pv-z-ctrl{ display: flex; gap: 2px; margin-left: auto; }
.pv-z-ctrl i{ font-size: 10px; color: rgba(255,255,255,.7); cursor: pointer; padding: 1px; }
.pv-z-ctrl i:hover{ color: #fff; }
.pv-lock-btn{ font-size: 10px; color: rgba(255,255,255,.7); cursor: pointer; margin-left: 4px; }
.pv-lock-btn:hover{ color: #fff; }
.pv-label{ font-size: 8px; color: rgba(255,255,255,.8); font-weight: 700; text-align: center; }
.pv-pad{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; width: 100%; flex: 1; }
.pv-pad span{ background: rgba(255,255,255,.25); color: #fff; font-size: 7px; text-align: center; padding: 2px 0; border-radius: 2px; }
.pv-hint{ font-size: 6px; color: rgba(255,255,255,.5); margin-top: 2px; }
.pv-ticket-head{ background: #f0f2f5; padding: 3px 6px; font-size: 7px; font-weight: 700; color: #303133; border-bottom: 1px solid #e4e7ed; }
.pv-ticket-body{ flex: 1; padding: 2px 6px; overflow: hidden; }
.pv-order-item{ display: flex; align-items: center; gap: 4px; font-size: 6px; color: #606266; padding: 1px 0; border-bottom: 1px dashed #f0f0f0; }
.pv-oi-name{ flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-oi-qty{ color: #909399; }
.pv-oi-price{ color: #303133; font-weight: 600; }
.pv-ticket-foot{ border-top: 1px solid #e4e7ed; padding: 3px 6px; text-align: right; }
.pv-total{ font-size: 7px; font-weight: 700; color: #303133; }
.pv-ticket-abs{ position: absolute; border: 2px solid rgba(76,132,255,.7); border-radius: 4px; cursor: move; z-index: 4; display: flex; flex-direction: column; background: #fff; }
.pv-food-zone-abs{ position: absolute; border: 2px solid rgba(76,132,255,.7); border-radius: 4px; cursor: move; z-index: 3; display: flex; flex-direction: column; overflow: hidden; }
.pv-food-cats{ display: flex; gap: 3px; padding: 3px 6px; border-bottom: 1px solid #f0f0f0; }
.pv-cat{ font-size: 6px; padding: 2px 6px; border-radius: 8px; background: #f0f2f5; color: #606266; cursor: pointer; white-space: nowrap; }
.pv-cat.active{ background: #4c84ff; color: #fff; }
.pv-food-grid{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px 6px; flex: 1; }
.pv-food-item{ background: #f5f7fa; border-radius: 4px; display: flex; align-items: center; justify-content: center; border: 1px solid #ebeef5; }
.pv-food-icon{ font-size: 6px; color: #909399; }
.pv-dock-abs{ position: absolute; border: 2px solid rgba(76,132,255,.7); border-radius: 4px; cursor: move; z-index: 2; display: flex; flex-direction: column; }
.pv-dock-btns{ display: flex; gap: 3px; padding: 3px 6px; flex-wrap: wrap; align-items: center; flex: 1; }
.pv-dock-btn{ font-size: 5px; background: rgba(255,255,255,.9); padding: 2px 4px; border-radius: 2px; color: #303133; }
.pv-resize-handle{ position: absolute; right: 0; bottom: 0; width: 10px; height: 10px; cursor: nwse-resize; background: linear-gradient(135deg, transparent 50%, #4c84ff 50%); border-radius: 0 0 2px 0; z-index: 6; }
.layout-canvas-info{ display: flex; align-items: center; gap: 12px; margin-top: 4px; font-size: 12px; color: #909399; }
.layout-canvas-status{ color: #e6a23c; font-weight: 600; }
.visual-controls-row{ display: flex; gap: 18px; flex-wrap: wrap; padding: 6px 0; align-items: center; }
.vc-item{ display: flex; align-items: center; gap: 6px; }
.vc-label{ font-size: 13px; color: #606266; font-weight: 600; white-space: nowrap; }
.vc-unit{ font-size: 12px; color: #909399; }
.color-pickers-row{ display: flex; gap: 18px; flex-wrap: wrap; padding: 6px 0; }
.color-pick-item{ display: flex; align-items: center; gap: 6px; }
.cp-label{ font-size: 13px; color: #606266; font-weight: 600; }
.cp-hex{ font-size: 12px; color: #909399; }
.card-preview-box{ width: 200px; height: 140px; border: 1.5px solid rgba(148,163,184,.25); border-radius: 12px; background: #fff; box-shadow: 0 2px 8px rgba(36,61,91,.06); position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
.cpb-seats{ position: absolute; top: 10px; left: 12px; color: #64748b; }
.cpb-dot{ position: absolute; top: 12px; right: 12px; border-radius: 50%; background: #67c23a; }
.cpb-no{ font-weight: 800; color: #1e293b; line-height: 1; }
.cpb-amount{ color: #dc2626; font-weight: 800; margin-top: 4px; }
.cpb-status{ font-weight: 600; margin-top: 4px; }
.cpb-duration{ position: absolute; bottom: 8px; color: #94a3b8; }

.pos-preview-global-row{ display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; padding: 8px 12px; background: #f8faff; border-radius: 8px; border: 1px solid #e8ecf4; }
.pos-preview-global-label{ font-size: 13px; font-weight: 700; color: #475569; white-space: nowrap; }
.pos-preview-gl-item{ font-size: 12px; color: #606266; font-weight: 600; white-space: nowrap; }
.pos-preview-gl-hint{ font-size: 11px; color: #909399; }

.pos-sim-wrap{ display: flex; flex-direction: column; width: 100%; border-radius: 10px; overflow: hidden; border: 2px solid #dce5f0; background: #f0f2f5; min-height: 420px; }
.pos-sim-sidebar{ flex-direction: row; }

.pos-sim-sidenav{ display: flex; flex-direction: column; gap: 2px; padding: 4px; width: 140px; min-width: 140px; background: linear-gradient(180deg, #1f2937 0%, #111827 100%); overflow-y: auto; max-height: 420px; }
.pos-sim-sb-btn{ display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: background .15s; color: #cbd5e1; font-size: 12px; }
.pos-sim-sb-btn:hover{ background: rgba(255,255,255,.08); }
.pos-sim-sb-icon{ font-size: 14px; opacity: .7; }
.pos-sim-sb-label{ flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pos-sim-food-zone{ flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.pos-sim-cat-scroll{ display: grid; gap: 6px; padding: 6px 10px; overflow-x: auto; border-bottom: 1px solid #e4e7ed; background: #fff; flex-shrink: 0; }
.pos-sim-cat-scroll::-webkit-scrollbar{ height: 0; }
.pos-sim-cat-pill{ padding: 5px 14px; border-radius: 16px; font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; cursor: pointer; border: 1.5px solid #dce5f0; background: #f5f7fa; color: #606266; transition: all .2s; }
.pos-sim-cat-pill:hover{ background: #ecf5ff; color: #409eff; border-color: #b3d8ff; }
.pos-sim-cat-pill.active{ background: linear-gradient(135deg, #4c84ff, #6366f1); color: #fff; border-color: transparent; box-shadow: 0 2px 8px rgba(76,132,255,.3); }
.pos-sim-food-grid{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; padding: 10px; flex: 1; overflow-y: auto; align-content: start; }
.pos-sim-food-btn{ display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 88px; background: #fff; border-radius: 10px; border: 1.5px solid #ebeef5; cursor: pointer; transition: all .2s; padding: 8px 4px; gap: 4px; }
.pos-sim-food-btn:hover{ border-color: #409eff; box-shadow: 0 2px 12px rgba(64,158,255,.15); transform: translateY(-1px); }
.pos-sim-food-img{ width: 40px; height: 40px; border-radius: 8px; background: linear-gradient(135deg, #e0e7ff, #c7d2fe); }
.pos-sim-food-avatar{ width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 700; }
.pos-sim-food-text{ text-align: center; min-width: 0; width: 100%; }
.pos-sim-food-name{ font-size: 11px; font-weight: 600; color: #1e293b; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.pos-sim-food-price{ font-size: 12px; font-weight: 700; color: #ef4444; margin-top: 2px; }

.pos-sim-ticket{ width: 160px; min-width: 160px; display: flex; flex-direction: column; background: #fff; border-left: 1px solid #e4e7ed; }
.pos-sim-ticket-head{ padding: 8px 10px; font-size: 13px; font-weight: 700; color: #1e293b; background: #f0f2f5; border-bottom: 1px solid #e4e7ed; text-align: center; }
.pos-sim-ticket-item{ display: flex; align-items: center; gap: 4px; padding: 5px 10px; font-size: 11px; color: #606266; border-bottom: 1px dashed #f0f0f0; }
.pos-sim-ticket-item span:first-child{ flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pos-sim-ticket-item span:nth-child(2){ color: #909399; }
.pos-sim-ticket-item span:nth-child(3){ font-weight: 600; color: #303133; white-space: nowrap; }
.pos-sim-ticket-foot{ border-top: 2px solid #e4e7ed; padding: 8px 10px; text-align: right; font-size: 12px; color: #303133; margin-top: auto; }
.pos-sim-ticket-foot b{ color: #ef4444; font-size: 14px; }

.pos-sim-dock{ padding: 6px 8px; background: linear-gradient(90deg, #1f2937 0%, #374151 100%); border-top: 1px solid #4b5563; }
.pos-sim-dock-sidebar{ background: linear-gradient(90deg, #1f2937 0%, #374151 100%); }
.pos-sim-dock-classic{ background: linear-gradient(90deg, #111827 0%, #1f2937 50%, #111827 100%); }
.pos-sim-dock-row{ display: flex; gap: 6px; margin-bottom: 4px; }
.pos-sim-dock-row:last-child{ margin-bottom: 0; }
.pos-sim-dock-btn{ font-weight: 700; background: rgba(255,255,255,.94); border: 1px solid rgba(255,255,255,.9); border-radius: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.08); }

.btn-only-preview{ border: 1px solid #f0f2f5; border-radius: 10px; padding: 12px; background: #f8faff; margin-top: 16px; }
.bop-title{ font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 10px; }
.bop-dock{ background: linear-gradient(90deg, #1f2937 0%, #374151 100%); border-radius: 8px; padding: 8px; }
.bop-dock-row{ display: flex; gap: 6px; margin-bottom: 4px; }
.bop-dock-row:last-child{ margin-bottom: 0; }
.bop-dock-btn{ font-weight: 700; background: rgba(255,255,255,.94); border: 1px solid rgba(255,255,255,.9); border-radius: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; justify-content: center; cursor: pointer; flex: 1; min-width: 0; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.bop-hint{ margin-top: 8px; font-size: 11px; color: #909399; text-align: center; }
.bop-current{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 12px; color: #475569; }
.bop-current-label{ font-weight: 700; color: #303133; }
.bop-current-tag{ background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.sim-dock-page-nav{ display: flex; flex-direction: column; align-items: center; gap: 2px; justify-content: center; padding: 2px 4px; margin: 0 2px; }
.sim-nav-btn{ border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; font-weight: 700; line-height: 1; padding: 0; }
.sim-nav-btn:hover:not(:disabled){ opacity: .85; transform: scale(1.08); }
.sim-nav-btn:disabled{ opacity: .3; cursor: not-allowed; }
</style>
<style>
.func-code-ref{ background: #f5f7fa; border: 1px solid #e4e7ed; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; }
.func-ref-title{ font-size: 15px; font-weight: 700; color: #606266; margin-bottom: 8px; }
.func-ref-grid{ display: flex; flex-wrap: wrap; gap: 8px 14px; }
.func-ref-item{ font-size: 14px; color: #303133; background: #fff; border: 1px solid #dcdfe6; border-radius: 4px; padding: 4px 10px; white-space: nowrap; }
.fullscreen-overlay-dialog .el-dialog__body{ padding: 0; background: #1a1a2e; }
.fs-canvas{ width: 100%; padding-top: 56.25%; position: relative; background: #1a1a2e; }
.fs-panel{ position: absolute; border: 2px solid rgba(76,132,255,.5); border-radius: 4px; }
.fs-label{ font-size: 14px; color: rgba(255,255,255,.8); font-weight: 700; text-shadow: 0 1px 3px rgba(0,0,0,.5); }
</style>
