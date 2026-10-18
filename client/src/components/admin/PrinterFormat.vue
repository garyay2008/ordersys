<template>
  <div class="printer-format">
    <el-tabs v-model="activeTab">
      <el-tab-pane v-for="tab in tabs" :key="tab.key" :name="tab.key">
        <span slot="label">{{ tab.label }}</span>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form label-width="70px" size="small">
              <el-form-item label="標題">
                <el-input v-model="format[activeTab].title" placeholder="小票標題"></el-input>
              </el-form-item>
              <el-form-item label="改碼字號" v-if="activeTab !== 'qrcode' && activeTab !== 'tableqr' && activeTab !== 'cancelitem'">
                <el-select v-model="format[activeTab].fields.mods.size" style="width: 120px;">
                  <el-option label="正常" :value="1"></el-option>
                  <el-option label="大" :value="2"></el-option>
                  <el-option label="特大" :value="3"></el-option>
                  <el-option label="超大" :value="4"></el-option>
                  <el-option label="最大" :value="5"></el-option>
                  <el-option label="極大" :value="6"></el-option>
                </el-select>
                <span style="margin-left: 8px; font-size: 12px; color: #909399;">改碼（口味備註）印在小票上的字號</span>
              </el-form-item>
              <el-form-item label="二維碼大小" v-if="activeTab === 'tableqr' || activeTab === 'qrcode'">
                <el-select v-model="format[activeTab].fields.qr.size" style="width: 120px;">
                  <el-option label="小" :value="1"></el-option>
                  <el-option label="正常" :value="2"></el-option>
                  <el-option label="中" :value="3"></el-option>
                  <el-option label="大" :value="4"></el-option>
                  <el-option label="特大" :value="5"></el-option>
                  <el-option label="最大" :value="6"></el-option>
                </el-select>
                <span style="margin-left: 8px; font-size: 12px; color: #909399;">點餐碼二維碼尺寸</span>
              </el-form-item>
              <div class="field-head">
                <span class="fh-show">顯示</span>
                <span class="fh-label">字段</span>
                <span class="fh-size">字號</span>
                <span class="fh-bold">粗體</span>
                <span class="fh-align">位置</span>
                <span class="fh-order">排序</span>
                <span class="fh-ops">操作</span>
              </div>

              <div v-for="(line, li) in orderedLines" :key="line.key">
                <!-- 分隔線 -->
                <div v-if="line.isDivider" class="field-row">
                  <el-switch v-model="format[activeTab].fields[line.key].show"></el-switch>
                  <span class="fd-label">分隔線</span>
                  <el-select v-model="format[activeTab].fields[line.key].type" size="mini" class="fd-size" title="線型">
                    <el-option label="雙線 ＝" value="="></el-option>
                    <el-option label="單線 －" value="-"></el-option>
                  </el-select>
                  <span class="fd-bold"></span>
                  <span class="fd-align"></span>
                  <el-button-group class="fd-order">
                    <el-button size="mini" icon="el-icon-arrow-up" :disabled="li === 0" @click="moveLine(li, -1)"></el-button>
                    <el-button size="mini" icon="el-icon-arrow-down" :disabled="li === orderedLines.length - 1" @click="moveLine(li, 1)"></el-button>
                  </el-button-group>
                  <div class="fd-ops">
                    <el-button size="mini" type="danger" icon="el-icon-delete" title="刪除分隔線" @click="removeDivider(line.key)"></el-button>
                  </div>
                </div>

                <!-- 自定義文字 -->
                <div v-else-if="line.isCustom" class="field-row">
                  <el-switch v-model="format[activeTab].fields[line.key].show"></el-switch>
                  <el-input v-model="format[activeTab].fields[line.key].text" size="mini" class="fd-text" placeholder="輸入自定義文字"></el-input>
                  <el-select v-model="format[activeTab].fields[line.key].size" size="mini" class="fd-size">
                    <el-option label="正常" :value="1"></el-option>
                    <el-option label="大" :value="2"></el-option>
                    <el-option label="特大" :value="3"></el-option>
                    <el-option label="超大" :value="4"></el-option>
                    <el-option label="最大" :value="5"></el-option>
                    <el-option label="極大" :value="6"></el-option>
                  </el-select>
                  <el-switch v-model="format[activeTab].fields[line.key].bold" size="mini" class="fd-bold" title="粗體"></el-switch>
                  <el-select v-model="format[activeTab].fields[line.key].align" size="mini" class="fd-align">
                    <el-option label="左" value="left"></el-option>
                    <el-option label="中" value="center"></el-option>
                    <el-option label="右" value="right"></el-option>
                  </el-select>
                  <el-button-group class="fd-order">
                    <el-button size="mini" icon="el-icon-arrow-up" :disabled="li === 0" @click="moveLine(li, -1)"></el-button>
                    <el-button size="mini" icon="el-icon-arrow-down" :disabled="li === orderedLines.length - 1" @click="moveLine(li, 1)"></el-button>
                  </el-button-group>
                  <div class="fd-ops">
                    <el-button size="mini" type="danger" icon="el-icon-delete" title="刪除自定義文字" @click="removeCustom(line.key)"></el-button>
                  </div>
                </div>

                <!-- 條碼欄位（開關 + 尺寸，固定印於大台號上方） -->
                <div v-else-if="line.key === 'barcode'" class="field-row">
                  <el-switch v-model="format[activeTab].fields[line.key].show"></el-switch>
                  <span class="fd-label">{{ line.label }}</span>
                  <el-select v-model="format[activeTab].fields[line.key].size" size="mini" class="fd-size">
                    <el-option label="正常" :value="1"></el-option>
                    <el-option label="中" :value="2"></el-option>
                    <el-option label="大" :value="3"></el-option>
                  </el-select>
                  <span class="fd-barcode-hint">掃描後跳到該枱號（熱敏）</span>
                  <el-button-group class="fd-order">
                    <el-button size="mini" icon="el-icon-arrow-up" :disabled="li === 0" @click="moveLine(li, -1)"></el-button>
                    <el-button size="mini" icon="el-icon-arrow-down" :disabled="li === orderedLines.length - 1" @click="moveLine(li, 1)"></el-button>
                  </el-button-group>
                  <div class="fd-ops"></div>
                </div>

                <!-- 單一欄位 -->
                <div v-else-if="!line.grouped" class="field-row">
                  <el-switch v-model="format[activeTab].fields[line.key].show"></el-switch>
                  <span class="fd-label">{{ line.label }}</span>
                  <el-select v-model="format[activeTab].fields[line.key].size" size="mini" class="fd-size">
                    <el-option label="正常" :value="1"></el-option>
                    <el-option label="大" :value="2"></el-option>
                    <el-option label="特大" :value="3"></el-option>
                    <el-option label="超大" :value="4"></el-option>
                    <el-option label="最大" :value="5"></el-option>
                    <el-option label="極大" :value="6"></el-option>
                  </el-select>
                  <el-switch v-model="format[activeTab].fields[line.key].bold" size="mini" class="fd-bold" title="粗體"></el-switch>
                  <el-select v-model="format[activeTab].fields[line.key].align" size="mini" class="fd-align">
                    <el-option label="左" value="left"></el-option>
                    <el-option label="中" value="center"></el-option>
                    <el-option label="右" value="right"></el-option>
                  </el-select>
                  <el-button-group class="fd-order">
                    <el-button size="mini" icon="el-icon-arrow-up" :disabled="li === 0" @click="moveLine(li, -1)"></el-button>
                    <el-button size="mini" icon="el-icon-arrow-down" :disabled="li === orderedLines.length - 1" @click="moveLine(li, 1)"></el-button>
                  </el-button-group>
                  <div class="fd-ops">
                    <el-button v-if="canGroup(li)" size="mini" icon="el-icon-back" title="合併到上行（同列分組）" @click="groupWithPrevious(li)"></el-button>
                  </div>
                </div>

                <!-- 同列分組 -->
                <div v-else class="group-box">
                  <div class="group-head">
                    <el-tag size="mini" type="info" class="group-tag">分組</el-tag>
                    <span class="fd-label">{{ line.members.map(m => m.label).join(' + ') }}</span>
                    <el-button-group class="fd-order">
                      <el-button size="mini" icon="el-icon-arrow-up" :disabled="li === 0" @click="moveLine(li, -1)"></el-button>
                      <el-button size="mini" icon="el-icon-arrow-down" :disabled="li === orderedLines.length - 1" @click="moveLine(li, 1)"></el-button>
                    </el-button-group>
                    <div class="fd-ops">
                      <el-button size="mini" icon="el-icon-arrow-right" title="取消分組" @click="ungroup(li)"></el-button>
                      <el-button v-if="canGroup(li)" size="mini" icon="el-icon-back" title="合併到上行" @click="groupWithPrevious(li)"></el-button>
                    </div>
                  </div>
                  <div class="group-members">
                    <div v-for="(m, mi) in line.members" :key="m.key" class="member-row">
                      <el-switch v-model="format[activeTab].fields[m.key].show"></el-switch>
                      <span class="fd-label">{{ m.label }}</span>
                      <el-select v-model="format[activeTab].fields[m.key].size" size="mini" class="fd-size">
                        <el-option label="正常" :value="1"></el-option>
                        <el-option label="大" :value="2"></el-option>
                        <el-option label="特大" :value="3"></el-option>
                        <el-option label="超大" :value="4"></el-option>
                        <el-option label="最大" :value="5"></el-option>
                        <el-option label="極大" :value="6"></el-option>
                      </el-select>
                      <el-switch v-model="format[activeTab].fields[m.key].bold" size="mini" class="fd-bold" title="粗體"></el-switch>
                      <el-select v-model="format[activeTab].fields[m.key].align" size="mini" class="fd-align">
                        <el-option label="左" value="left"></el-option>
                        <el-option label="中" value="center"></el-option>
                        <el-option label="右" value="right"></el-option>
                      </el-select>
                      <el-button-group class="fd-order">
                        <el-button size="mini" icon="el-icon-arrow-left" :disabled="mi === 0" title="左移" @click="moveMember(li, mi, -1)"></el-button>
                        <el-button size="mini" icon="el-icon-arrow-right" :disabled="mi === line.members.length - 1" title="右移" @click="moveMember(li, mi, 1)"></el-button>
                      </el-button-group>
                    </div>
                  </div>
                </div>
              </div>

              <div class="add-divider-row">
                <el-button size="mini" icon="el-icon-plus" @click="addDivider">添加分隔線</el-button>
                <el-button size="mini" icon="el-icon-plus" @click="addCustom">添加自定義文字</el-button>
              </div>
            </el-form>
          </el-col>
          <el-col :span="12">
            <div class="preview-tip">
              <span>拖曳 ⠿ 調整上下排序；拖曳欄位到其他欄位可合併為同列分組；點擊欄位顯示工具列。</span>
            </div>
            <div class="ticket-preview" @dragover.prevent @drop.prevent.stop="onRootDrop">
              <div v-if="barcodePreview" class="preview-barcode" :class="'barcode-s' + barcodePreview.size">
                <div class="preview-barcode-label">條碼（掃描枱號）</div>
                <div class="preview-barcode-bars"></div>
              </div>
              <div v-if="deskNoBigPreview" class="preview-block field" @click.stop>
                <div class="block-body">
                  <div class="ticket-line" :class="deskNoBigPreview.cls">{{ deskNoBigPreview.text }}</div>
                </div>
              </div>
              <div v-if="showLogoPreview" class="preview-logo">
                <img :src="logoUrl" alt="店舖 Logo">
              </div>
              <div
                v-for="(line, i) in previewLines"
                :key="line.kind + '-' + line.key + '-' + i"
                class="preview-block"
                :class="[line.kind, { 'is-selected': isSelectedBlock(i), 'drop-target': dragOverIndex === i }]"
                @dragover.prevent="dragOverIndex = i"
                @dragleave="if (dragOverIndex === i) dragOverIndex = -1"
                @drop.prevent.stop="onBlockDrop(line.srcIndex, $event)"
                @click.stop="selectBlock(i)"
              >
                <span
                  class="drag-handle"
                  draggable="true"
                  title="拖動排序"
                  @dragstart.stop="onReorderStart(line.srcIndex, $event)"
                  @dragend="onDragEnd"
                >⠿</span>

                <div
                  class="block-body"
                  :draggable="line.kind === 'field'"
                  @dragstart.stop="line.kind === 'field' ? onGroupStart(line.srcIndex, $event) : null"
                  @dragend="onDragEnd"
                >
                  <!-- 分隔線 -->
                  <template v-if="line.kind === 'divider'">
                    <div v-if="line.show" class="ticket-divider" :class="line.char === '=' ? 'double' : 'single'"></div>
                    <div v-else class="hidden-line">（分隔線已隱藏）</div>
                  </template>

                  <!-- 單一欄位 -->
                  <template v-else-if="line.kind === 'field'">
                    <div v-if="line.qr" class="qr-mock">二維碼<br/>（訂單號）</div>
                    <div v-for="(t, ti) in line.texts" :key="ti" class="ticket-line" :class="[...(t.cls || []), t.cells ? 'ticket-row' : '']" :style="t.color ? { color: t.color } : {}">
                      <template v-if="t.cells">
                        <span v-for="(c, ci) in t.cells" :key="ci" class="ticket-cell" :class="c.align">{{ c.text }}</span>
                      </template>
                      <template v-else>{{ t.text }}</template>
                    </div>
                  </template>

                  <!-- 同列分組 -->
                  <template v-else-if="line.kind === 'group'">
                    <div class="ticket-line ticket-row">
                      <span
                        v-for="(m, mi) in line.members"
                        :key="mi"
                        class="ticket-cell member"
                        :class="[m.align, m.big ? 'big' : '', m.sizeClass, m.bold ? 'bold' : '', { 'is-selected': isSelectedMember(i, mi) }]"
                        draggable="true"
                        @dragstart.stop="onMemberStart(line.srcIndex, m.memberIndex, $event)"
                        @dragend="onDragEnd"
                        @dragover.prevent.stop
                        @drop.prevent.stop="onMemberDrop(line.srcIndex, m.memberIndex, $event)"
                        @click.stop="selectMember(i, mi)"
                      >{{ m.text }}</span>
                    </div>
                  </template>
                </div>

                <!-- 群組工具列 -->
                <div v-if="line.kind === 'group' && isSelectedBlock(i)" class="block-tools" @click.stop>
                  <el-button size="mini" icon="el-icon-arrow-right" title="取消分組" @click="ungroup(line.srcIndex)">拆開</el-button>
                </div>

                <!-- 浮動工具列（欄位 / 分隔線 / 分組成員） -->
                <div v-if="showToolbar(i)" class="float-toolbar" @click.stop>
                  <template v-if="isSelectedDivider">
                    <el-select v-model="format[activeTab].fields[selectedFieldKey].type" size="mini" class="ft-size">
                      <el-option label="雙線" value="="></el-option>
                      <el-option label="單線" value="-"></el-option>
                    </el-select>
                    <el-switch v-model="format[activeTab].fields[selectedFieldKey].show" size="mini"></el-switch>
                    <el-button size="mini" type="danger" icon="el-icon-delete" title="刪除分隔線" @click="removeDivider(selectedFieldKey)"></el-button>
                  </template>
                  <template v-else>
                    <span class="ft-label">{{ selectedLabel }}</span>
                    <el-select v-model="format[activeTab].fields[selectedFieldKey].size" size="mini" class="ft-size">
                      <el-option label="正常" :value="1"></el-option>
                      <el-option label="大" :value="2"></el-option>
                      <el-option label="特大" :value="3"></el-option>
                      <el-option label="超大" :value="4"></el-option>
                      <el-option label="最大" :value="5"></el-option>
                      <el-option label="極大" :value="6"></el-option>
                    </el-select>
                    <el-switch v-model="format[activeTab].fields[selectedFieldKey].bold" size="mini" class="ft-bold" title="粗體"></el-switch>
                    <el-select v-model="format[activeTab].fields[selectedFieldKey].align" size="mini" class="ft-align">
                      <el-option label="左" value="left"></el-option>
                      <el-option label="中" value="center"></el-option>
                      <el-option label="右" value="right"></el-option>
                    </el-select>
                    <el-switch v-model="format[activeTab].fields[selectedFieldKey].show" size="mini"></el-switch>
                  </template>
                </div>
              </div>
            </div>
          </el-col>
        </el-row>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
export default {
  name: 'printerFormat',
  props: {
    format: { type: Object, required: true },
    shopName: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    footer: { type: String, default: '' },
    logo: { type: String, default: '' },
    logoEnabledAll: { type: Boolean, default: true },
    logoEnabled: { type: Boolean, default: true },
    logoEnabledServing: { type: Boolean, default: false },
    logoEnabledPrint: { type: Boolean, default: false },
    logoEnabledQrcode: { type: Boolean, default: false }
  },
  data () {
    return {
      activeTab: 'kitchen',
      selection: null,
      drag: null,
      dragOverIndex: -1,
      tabs: [
        {
          key: 'kitchen',
          label: '後廚小票',
          fields: [
            { key: 'title', label: '標題' },
            { key: 'shopName', label: '餐廳名稱' },
            { key: 'deskNo', label: '台號' },
            { key: 'deskNo2', label: '台號(右下)' },
            { key: 'orderNo', label: '訂單號' },
            { key: 'waiter', label: '開單員工' },
            { key: 'sendWaiter', label: '送單員工' },
            { key: 'people', label: '人數' },
            { key: 'station', label: '檔口' },
            { key: 'orderNoStation', label: '單號＋檔口' },
            { key: 'dateSendTimeWaiter', label: '日期＋送單時間＋送單員工' },
            { key: 'items', label: '菜品明細' },
            { key: 'items2', label: '菜品明細2' },
            { key: 'items3', label: '菜品明細3' },
            { key: 'total', label: '合計' },
            { key: 'remark', label: '備註' },
            { key: 'time', label: '開單時間' },
            { key: 'sendTime', label: '送單時間' }
          ]
        },
        {
          key: 'receipt',
          label: '結賬小票',
          fields: [
            { key: 'title', label: '標題' },
            { key: 'shopName', label: '餐廳名稱' },
            { key: 'address', label: '地址' },
            { key: 'phone', label: '電話' },
            { key: 'deskNo', label: '台號' },
            { key: 'orderNo', label: '訂單號' },
            { key: 'waiter', label: '開單員工' },
            { key: 'sendWaiter', label: '送單員工' },
            { key: 'people', label: '人數' },
            { key: 'items', label: '菜品明細' },
            { key: 'items2', label: '菜品明細2' },
            { key: 'items3', label: '菜品明細3' },
            { key: 'total', label: '合計' },
            { key: 'serviceCharge', label: '服務費' },
            { key: 'grandTotal', label: '總金額' },
            { key: 'payMethod', label: '收款方式' },
            { key: 'remark', label: '備註' },
            { key: 'time', label: '開單時間' },
            { key: 'sendTime', label: '送單時間' },
            { key: 'date', label: '日期' },
            { key: 'footer', label: '廣告語' }
          ]
        },
        {
          key: 'serving',
          label: '上菜紙',
          fields: [
            { key: 'title', label: '標題' },
            { key: 'shopName', label: '餐廳名稱' },
            { key: 'deskNo', label: '台號' },
            { key: 'orderNo', label: '訂單號' },
            { key: 'waiter', label: '開單員工' },
            { key: 'sendWaiter', label: '送單員工' },
            { key: 'people', label: '用餐人數' },
            { key: 'date', label: '日期' },
            { key: 'items', label: '菜品明細' },
            { key: 'items2', label: '菜品明細2' },
            { key: 'items3', label: '菜品明細3' },
            { key: 'remark', label: '備註' },
            { key: 'time', label: '開單時間' },
            { key: 'sendTime', label: '送單時間' },
            { key: 'footer', label: '廣告語' }
          ]
        },
        {
          key: 'print',
          label: '印單小票',
          fields: [
            { key: 'title', label: '標題' },
            { key: 'shopName', label: '餐廳名稱' },
            { key: 'address', label: '地址' },
            { key: 'phone', label: '電話' },
            { key: 'deskNo', label: '台號' },
            { key: 'barcode', label: '枱號條碼' },
            { key: 'deskNoBig', label: '大台號' },
            { key: 'orderNo', label: '訂單號' },
            { key: 'reprint', label: '重印' },
            { key: 'waiter', label: '開單員工' },
            { key: 'sendWaiter', label: '送單員工' },
            { key: 'people', label: '人數' },
            { key: 'items', label: '菜品明細' },
            { key: 'items2', label: '菜品明細2' },
            { key: 'items3', label: '菜品明細3' },
            { key: 'total', label: '合計' },
            { key: 'serviceCharge', label: '服務費' },
            { key: 'grandTotal', label: '總金額' },
            { key: 'remark', label: '備註' },
            { key: 'time', label: '開單時間' },
            { key: 'sendTime', label: '送單時間' },
            { key: 'date', label: '日期' }
          ]
        },
        {
          key: 'qrcode',
          label: '二維碼小票',
          fields: [
            { key: 'title', label: '標題' },
            { key: 'shopName', label: '餐廳名稱' },
            { key: 'deskNo', label: '台號' },
            { key: 'orderNo', label: '訂單號' },
            { key: 'waiter', label: '開單員工' },
            { key: 'time', label: '開單時間' }
          ]
        },
        {
          key: 'tableqr',
          label: '點餐碼',
          fields: [
            { key: 'title', label: '標題' },
            { key: 'shopName', label: '餐廳名稱' },
            { key: 'deskNo', label: '台號' },
            { key: 'barcode', label: '枱號條碼' },
            { key: 'orderNo', label: '單號' },
            { key: 'date', label: '日期' },
            { key: 'time', label: '時間' },
            { key: 'hint', label: '提示文字' }
          ]
        },
        {
          key: 'chase',
          label: '追單',
          fields: [
            { key: 'title', label: '標題' },
            { key: 'shopName', label: '餐廳名稱' },
            { key: 'deskNo', label: '台號' },
            { key: 'orderNo', label: '訂單號' },
            { key: 'waiter', label: '開單員工' },
            { key: 'sendWaiter', label: '送單員工' },
            { key: 'people', label: '人數' },
            { key: 'items', label: '菜品明細' },
            { key: 'items2', label: '菜品明細2' },
            { key: 'items3', label: '菜品明細3' },
            { key: 'remark', label: '備註' },
            { key: 'time', label: '開單時間' },
            { key: 'sendTime', label: '送單時間' }
          ]
        },
        {
          key: 'pantry',
          label: '打柯單',
          fields: [
            { key: 'title', label: '標題' },
            { key: 'shopName', label: '餐廳名稱' },
            { key: 'deskNo', label: '台號' },
            { key: 'orderNo', label: '訂單號' },
            { key: 'message', label: '訊息內容' },
            { key: 'waiter', label: '開單員工' },
            { key: 'time', label: '開單時間' }
          ]
        },
        {
          key: 'cancelitem',
          label: '取消項目小票',
          fields: [
            { key: 'title', label: '標題' },
            { key: 'shopName', label: '餐廳名稱' },
            { key: 'deskNo', label: '台號' },
            { key: 'orderNo', label: '訂單號' },
            { key: 'waiter', label: '開單員工' },
            { key: 'items', label: '取消項目' },
            { key: 'reason', label: '原因' },
            { key: 'time', label: '取消時間' }
          ]
        }
      ]
    }
  },
  computed: {
    activeTabDef () {
      return this.tabs.find(t => t.key === this.activeTab)
    },
    logoUrl () {
      return this.logo ? '/' + this.logo : ''
    },
    showLogoPreview () {
      if (this.logoEnabledAll === false) return false
      if (!this.logoUrl) return false
      const map = { receipt: this.logoEnabled, serving: this.logoEnabledServing, print: this.logoEnabledPrint, qrcode: this.logoEnabledQrcode, tableqr: this.logoEnabledQrcode }
      return !!map[this.activeTab]
    },
    showDeskNoBigTop () {
      return this.activeTab === 'print'
    },
    barcodePreview () {
      if (this.activeTab !== 'print' && this.activeTab !== 'tableqr') return null
      const fmt = this.format[this.activeTab] || {}
      const fields = fmt.fields || {}
      const f = fields.barcode || { show: false }
      if (f.show === false) return null
      const sz = Math.min(3, Math.max(1, f.size || 1))
      return { size: sz }
    },
    deskNoBigPreview () {
      if (!this.showDeskNoBigTop) return null
      const fmt = this.format.print || {}
      const fields = fmt.fields || {}
      const f = fields.deskNoBig || { show: true, size: 5, align: 'left' }
      if (f.show === false) return null
      const cls = []
      if (f.align) cls.push(f.align)
      const sz = Math.min(6, Math.max(1, f.size || 1))
      if (sz >= 2) cls.push('big')
      cls.push('s' + sz)
      if (f.bold) cls.push('bold')
      return { text: '3', cls }
    },
    orderedLines () {
      const tab = this.activeTabDef
      if (!tab) return []
      const fmt = this.format[tab.key] || {}
      const order = (fmt.order && fmt.order.length) ? fmt.order.slice() : tab.fields.map(fd => fd.key)
      const labelMap = {}
      tab.fields.forEach(fd => { labelMap[fd.key] = fd.label })
      return order.map((item, i) => {
        if (Array.isArray(item)) {
          const members = item.map(key => ({
            key,
            label: labelMap[key] || key
          }))
          return { key: 'group-' + i + '-' + item.join('+'), isDivider: false, grouped: true, members }
        }
        const isDivider = this.isDividerKey(item)
        const isCustom = this.isCustomKey(item)
        const label = isDivider ? '分隔線' : (isCustom ? '自定義文字' : (labelMap[item] || item))
        return {
          key: item,
          isDivider,
          isCustom,
          grouped: false,
          label,
          members: isDivider ? [] : [{ key: item, label }]
        }
      })
    },
    previewLines () {
      const tab = this.activeTabDef
      if (!tab) return []
      const fmt = this.format[tab.key] || {}
      const fields = fmt.fields || {}
      const f = (key) => fields[key] || { show: true, size: 1, align: 'left' }
      const cls = (key) => {
        const o = f(key)
        const arr = []
        if (o.align) arr.push(o.align)
        const s = Math.min(6, Math.max(1, o.size || 1))
        if (s >= 2) arr.push('big')
        arr.push('s' + s)
        if (o.bold) arr.push('bold')
        return arr
      }
      const previewText = (key) => {
        const map = {
          shopName: this.shopName || '示例餐廳',
          title: fmt.title || '示例標題',
          address: this.address || '示例路1號',
          phone: '電話：' + (this.phone || '12345678'),
          deskNo: tab.key === 'kitchen' ? '3' : '台號：3',
          deskNoBig: '3',
          deskNo2: '3',
          orderNo: '訂單號：10000001',
          waiter: '開單員工：張小明',
          sendWaiter: '送單員工：張小明',
          station: '【檔口】',
          orderNoStation: '單號 10000001 檔口 火位',
          dateSendTimeWaiter: '2026-10-10 13:05:56 admin',
          people: '人數：4',
          date: '日期：2026-08-19',
          items: '宮保雞丁  x2',
          items2: '宮保雞丁  x2  13:05:22',
          total: tab.key === 'kitchen' ? '合計：$120' : '合計：$120.00',
          serviceCharge: '服務費：$12.00',
          reprint: '**重印** 2：admin',
          grandTotal: '總金額：$132.00',
          payMethod: '收款方式：現金',
          remark: '備註：不要辣',
          message: '5 號枱加單一碗白飯',
          reason: '原因：顧客取消',
          hint: '請用手機相機掃描下單',
          time: (tab.key === 'cancelitem') ? '取消時間：23:59' : ((tab.key === 'serving' || tab.key === 'receipt' || tab.key === 'print') ? '開單時間：23:59' : (tab.key === 'qrcode' ? '開單時間：2026-08-26 23:59:59' : (tab.key === 'tableqr' ? '開單時間：23:59:59' : '開單時間：08-26 23:59'))),
          sendTime: '送單時間：13:05:22',
          footer: this.footer || '謝謝惠顧，歡迎再次光臨'
        }
        return map[key] || ''
      }
      const labelMap = {}
      tab.fields.forEach(fd => { labelMap[fd.key] = fd.label })
      const order = this.orderedLines
      const lines = []
      for (let i = 0; i < order.length; i++) {
        const line = order[i]
        // 印單小票的「大台號」固定顯示在最左上角（Logo 之上），預覽時於上方單獨渲染，此處跳過避免重複
        if (this.activeTab === 'print' && (line.key === 'deskNoBig' || line.key === 'barcode')) continue
        // 點餐碼的「枱號條碼」亦於上方單獨渲染（掃描跳枱用）
        if (this.activeTab === 'tableqr' && line.key === 'barcode') continue
        if (line.isDivider) {
          const opt = fields[line.key] || { show: true, type: '-' }
          if (opt.show === false) continue
          lines.push({ kind: 'divider', key: line.key, char: opt.type === '=' ? '=' : '-', show: true, srcIndex: i })
          continue
        }
        if (line.grouped) {
          const members = []
          line.members.forEach((m, origIdx) => {
            if (f(m.key).show === false) return
            const mSize = Math.min(6, Math.max(1, f(m.key).size || 1))
            members.push({
              key: m.key,
              label: m.label,
              text: previewText(m.key),
              align: f(m.key).align || 'left',
              big: mSize >= 2,
              sizeClass: 's' + mSize,
              bold: !!f(m.key).bold,
              groupable: this.isGroupableKey(m.key),
              memberIndex: origIdx
            })
          })
          if (members.length) lines.push({ kind: 'group', key: line.key, members, srcIndex: i })
          continue
        }
        const key = line.key
        if (f(key).show === false) continue
        const texts = []
        if (key === 'items') {
          if (tab.key === 'print' || tab.key === 'receipt') {
            texts.push({ cells: [{ text: '宮保雞丁', align: 'left' }, { text: '2', align: 'center' }, { text: '$76.00', align: 'right' }], cls: cls('items') })
            texts.push({ cells: [{ text: '魚香肉絲', align: 'left' }, { text: '1', align: 'center' }, { text: '$44.00', align: 'right' }], cls: cls('items') })
          } else if (tab.key === 'cancelitem') {
            texts.push({ text: '宮保雞丁  x2  23:59', cls: cls('items') })
            texts.push({ text: '魚香肉絲  x1  23:59', cls: cls('items') })
          } else if (tab.key === 'kitchen') {
            texts.push({ text: 'x2  宮保雞丁', cls: cls('items') })
            texts.push({ text: 'x1  魚香肉絲', cls: cls('items') })
          } else {
            texts.push({ text: '宮保雞丁  x2', cls: cls('items') })
            texts.push({ text: '魚香肉絲  x1', cls: cls('items') })
          }
        } else if (key === 'items2') {
          if (tab.key === 'kitchen') {
            texts.push({ cells: [{ text: 'x2  宮保雞丁', align: 'left' }, { text: '13:05:22', align: 'right' }], cls: cls('items2') })
            texts.push({ cells: [{ text: 'x1  魚香肉絲', align: 'left' }, { text: '13:06:10', align: 'right' }], cls: cls('items2') })
          } else {
            texts.push({ cells: [{ text: '宮保雞丁  x2', align: 'left' }, { text: '13:05:22', align: 'right' }], cls: cls('items2') })
            texts.push({ cells: [{ text: '魚香肉絲  x1', align: 'left' }, { text: '13:06:10', align: 'right' }], cls: cls('items2') })
          }
        } else if (key === 'items3') {
          if (tab.key === 'kitchen') {
            texts.push({ text: 'x2  宮保雞丁  $76.00', cls: cls('items3') })
            texts.push({ text: 'x1  魚香肉絲  $44.00', cls: cls('items3') })
          } else {
            texts.push({ cells: [{ text: '宮保雞丁  x2', align: 'left' }, { text: '$76.00', align: 'right' }], cls: cls('items3') })
            texts.push({ cells: [{ text: '魚香肉絲  x1', align: 'left' }, { text: '$44.00', align: 'right' }], cls: cls('items3') })
          }
        } else if (this.isCustomKey(key)) {
          texts.push({ text: (f(key).text || ''), cls: cls(key) })
        } else {
          texts.push({ text: previewText(key), cls: cls(key) })
        }
        lines.push({
          kind: 'field',
          key,
          label: labelMap[key] || key,
          groupable: this.isGroupableKey(key),
          texts,
          color: (tab.key === 'chase' && key === 'title') ? '#dc2626' : null,
          qr: (tab.key === 'qrcode' && key === 'time'),
          srcIndex: i
        })
      }
      return lines
    },
    selectedFieldKey () {
      if (!this.selection) return null
      const line = this.previewLines[this.selection.blockIndex]
      if (!line) return null
      if (line.kind === 'group') {
        const m = line.members[this.selection.memberIndex]
        return m ? m.key : null
      }
      return line.key || null
    },
    isSelectedDivider () {
      if (!this.selection) return false
      const line = this.previewLines[this.selection.blockIndex]
      return !!(line && line.kind === 'divider')
    },
    selectedLabel () {
      if (!this.selection) return ''
      const line = this.previewLines[this.selection.blockIndex]
      if (!line) return ''
      if (line.kind === 'group') {
        const m = line.members[this.selection.memberIndex]
        return m ? m.label : ''
      }
      return line.label || ''
    }
  },
  methods: {
    isDividerKey (key) {
      return !!(key && key.indexOf('divider') === 0)
    },
    isCustomKey (key) {
      return !!(key && key.indexOf('custom') === 0)
    },
    isGroupableKey (key) {
      return !!key && key.indexOf('divider') !== 0 && key.indexOf('custom') !== 0 && key !== 'items' && key !== 'items2' && key !== 'qr' && key !== 'barcode'
    },
    canGroup (li) {
      if (li <= 0) return false
      const lines = this.orderedLines
      const cur = lines[li]
      const prev = lines[li - 1]
      if (!cur || !prev || cur.isDivider || prev.isDivider) return false
      const keys = cur.members.concat(prev.members).map(m => m.key)
      return keys.every(k => this.isGroupableKey(k))
    },
    moveLine (li, dir) {
      const tab = this.activeTabDef
      if (!tab) return
      const fmt = this.format[tab.key] || {}
      if (!fmt.order || !fmt.order.length) this.$set(fmt, 'order', tab.fields.map(fd => fd.key))
      const order = fmt.order
      const newIdx = li + dir
      if (newIdx < 0 || newIdx >= order.length) return
      const tmp = order[li]
      order.splice(li, 1)
      order.splice(newIdx, 0, tmp)
    },
    groupWithPrevious (li) {
      const tab = this.activeTabDef
      if (!tab) return
      const fmt = this.format[tab.key] || {}
      if (!fmt.order || !fmt.order.length) this.$set(fmt, 'order', tab.fields.map(fd => fd.key))
      const order = fmt.order
      const prev = order[li - 1]
      const cur = order[li]
      const prevArr = Array.isArray(prev) ? prev.slice() : [prev]
      const curArr = Array.isArray(cur) ? cur.slice() : [cur]
      order.splice(li - 1, 2, prevArr.concat(curArr))
    },
    ungroup (li) {
      const tab = this.activeTabDef
      if (!tab) return
      const fmt = this.format[tab.key] || {}
      if (!fmt.order) return
      const order = fmt.order
      const item = order[li]
      if (!Array.isArray(item)) return
      order.splice(li, 1, ...item)
    },
    moveMember (li, mi, dir) {
      const tab = this.activeTabDef
      if (!tab) return
      const fmt = this.format[tab.key] || {}
      const order = fmt.order
      if (!order) return
      const group = order[li]
      if (!Array.isArray(group)) return
      const ni = mi + dir
      if (ni < 0 || ni >= group.length) return
      const arr = group.slice()
      const tmp = arr[mi]
      arr[mi] = arr[ni]
      arr[ni] = tmp
      order.splice(li, 1, arr)
    },
    addDivider () {
      const tab = this.activeTabDef
      if (!tab) return
      const fmt = this.format[tab.key] || {}
      if (!fmt.order || !fmt.order.length) this.$set(fmt, 'order', tab.fields.map(fd => fd.key))
      if (!fmt.fields) this.$set(fmt, 'fields', {})
      let n = 1
      while (fmt.fields['divider' + n]) n++
      const key = 'divider' + n
      this.$set(fmt.fields, key, { show: true, type: '-' })
      fmt.order.push(key)
    },
    removeDivider (key) {
      const tab = this.activeTabDef
      if (!tab) return
      const fmt = this.format[tab.key] || {}
      if (!fmt.order) return
      const idx = fmt.order.indexOf(key)
      if (idx >= 0) fmt.order.splice(idx, 1)
      if (fmt.fields && fmt.fields[key]) this.$delete(fmt.fields, key)
    },
    addCustom () {
      const tab = this.activeTabDef
      if (!tab) return
      const fmt = this.format[tab.key] || {}
      if (!fmt.order || !fmt.order.length) this.$set(fmt, 'order', tab.fields.map(fd => fd.key))
      if (!fmt.fields) this.$set(fmt, 'fields', {})
      let n = 1
      while (fmt.fields['custom' + n]) n++
      const key = 'custom' + n
      this.$set(fmt.fields, key, { show: true, size: 1, align: 'left', bold: false, text: '' })
      fmt.order.push(key)
    },
    removeCustom (key) {
      const tab = this.activeTabDef
      if (!tab) return
      const fmt = this.format[tab.key] || {}
      if (!fmt.order) return
      const idx = fmt.order.indexOf(key)
      if (idx >= 0) fmt.order.splice(idx, 1)
      if (fmt.fields && fmt.fields[key]) this.$delete(fmt.fields, key)
    },
    // ---------- WYSIWYG ----------
    getOrder () {
      const tab = this.activeTabDef
      if (!tab) return null
      const fmt = this.format[tab.key] || {}
      if (!fmt.order || !fmt.order.length) this.$set(fmt, 'order', tab.fields.map(fd => fd.key))
      return fmt.order
    },
    setOrder (arr) {
      const tab = this.activeTabDef
      if (!tab) return
      const fmt = this.format[tab.key] || {}
      this.$set(fmt, 'order', arr)
    },
    selectBlock (i) {
      this.selection = { blockIndex: i, memberIndex: null }
    },
    selectMember (i, mi) {
      this.selection = { blockIndex: i, memberIndex: mi }
    },
    isSelectedBlock (i) {
      return !!(this.selection && this.selection.blockIndex === i && this.selection.memberIndex == null)
    },
    isSelectedMember (i, mi) {
      return !!(this.selection && this.selection.blockIndex === i && this.selection.memberIndex === mi)
    },
    showToolbar (i) {
      if (!this.selection || this.selection.blockIndex !== i) return false
      const line = this.previewLines[i]
      if (!line) return false
      if (this.selection.memberIndex != null) return true
      return line.kind === 'field' || line.kind === 'divider'
    },
    onDragStart (mode, srcIndex, memberIndex, e) {
      this.drag = { mode, srcIndex, memberIndex }
      if (e && e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', '')
      }
    },
    onReorderStart (i, e) {
      this.onDragStart('reorder', i, null, e)
    },
    onGroupStart (i, e) {
      this.onDragStart('group', i, null, e)
    },
    onMemberStart (i, mi, e) {
      this.onDragStart('member', i, mi, e)
    },
    onDragEnd () {
      this.drag = null
      this.dragOverIndex = -1
    },
    onBlockDrop (i, e) {
      if (!this.drag) return
      const d = this.drag
      if (d.mode === 'reorder') {
        this.reorderLine(d.srcIndex, i)
      } else if (d.mode === 'group') {
        this.groupInto(d.srcIndex, i, null)
      }
      this.onDragEnd()
    },
    onMemberDrop (i, mi, e) {
      if (!this.drag) return
      const d = this.drag
      if (d.mode === 'member' && d.srcIndex === i) {
        this.moveMemberInGroup(i, d.memberIndex, mi)
      } else if (d.mode === 'group') {
        this.groupInto(d.srcIndex, i, mi)
      }
      this.onDragEnd()
    },
    onRootDrop (e) {
      this.onDragEnd()
    },
    reorderLine (from, to) {
      if (from === to) return
      const order = this.getOrder()
      if (!order) return
      if (from < 0 || to < 0 || from >= order.length || to >= order.length) return
      const item = order.splice(from, 1)[0]
      order.splice(to, 0, item)
    },
    groupInto (src, dst, memberIndex) {
      if (src === dst) return
      const order = this.getOrder()
      if (!order) return
      const srcItem = order[src]
      if (Array.isArray(srcItem) || !this.isGroupableKey(srcItem)) return
      const dstItem = order[dst]
      if (Array.isArray(dstItem)) {
        if (!dstItem.every(k => this.isGroupableKey(k))) return
        const arr = dstItem.slice()
        const at = (memberIndex == null || memberIndex < 0) ? arr.length : memberIndex
        arr.splice(at, 0, srcItem)
        const newOrder = order.slice()
        newOrder[dst] = arr
        newOrder.splice(src, 1)
        this.setOrder(newOrder)
      } else {
        if (!this.isGroupableKey(dstItem)) return
        const group = [dstItem, srcItem]
        const minIdx = Math.min(src, dst)
        const maxIdx = Math.max(src, dst)
        const newOrder = order.slice()
        newOrder.splice(maxIdx, 1)
        newOrder.splice(minIdx, 1, group)
        this.setOrder(newOrder)
      }
    },
    moveMemberInGroup (i, mi, dm) {
      const order = this.getOrder()
      if (!order) return
      const group = order[i]
      if (!Array.isArray(group)) return
      const arr = group.slice()
      const [moved] = arr.splice(mi, 1)
      let at = dm
      if (dm > mi) at = dm - 1
      arr.splice(at, 0, moved)
      order.splice(i, 1, arr)
    }
  }
}
</script>

<style scoped>
.field-head{
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.fh-show{ flex: 0 0 40px; }
.fh-label{ flex: 1; }
.fh-size{ flex: 0 0 72px; text-align: center; }
.fh-bold{ flex: 0 0 48px; text-align: center; }
.fh-align{ flex: 0 0 72px; text-align: center; }
.fh-order{ flex: 0 0 74px; text-align: center; }
.fh-ops{ flex: 0 0 96px; text-align: center; }

.field-row{
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.field-row > .el-switch{ flex: 0 0 40px; }
.fd-label{ flex: 1; font-size: 13px; color: #303133; }
.fd-size{ flex: 0 0 72px; }
.fd-bold{ flex: 0 0 48px; }
.fd-align{ flex: 0 0 72px; }
.fd-order{ flex: 0 0 74px; }
.fd-ops{ flex: 0 0 96px; display: flex; gap: 4px; justify-content: center; }
.fd-text{ flex: 1; }
.fd-barcode-hint{ flex: 1; font-size: 12px; color: #909399; }
.add-divider-row{ margin-top: 2px; padding-left: 48px; display: flex; gap: 8px; }

.group-box{ margin-bottom: 8px; border: 1px solid #d9ecff; border-left: 3px solid #409eff; border-radius: 4px; background: #f5faff; padding: 6px 8px; }
.group-head{ display: flex; align-items: center; gap: 8px; }
.group-tag{ flex: 0 0 auto; }
.group-head .fd-label{ flex: 1; }
.group-members{ margin-top: 4px; }
.member-row{
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 48px;
  margin-bottom: 6px;
}
.member-row > .el-switch{ flex: 0 0 40px; }

.ticket-preview{
  width: 520px;
  margin: 0 auto;
  background: #fffdf8;
  border: 1px solid #eadfc8;
  padding: 32px 28px;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang TC', sans-serif;
  font-size: 24px;
  line-height: 1.8;
  color: #334155;
  box-shadow: 0 16px 48px rgba(71, 85, 105, .12);
  border-radius: 20px;
}
.ticket-line{ white-space: pre-wrap; word-break: break-all; }
.ticket-divider{ margin: 8px 0; }
.ticket-divider.single{ height: 0; border-top: 1px solid #334155; }
.ticket-divider.double{ height: 3px; border-top: 1px solid #334155; border-bottom: 1px solid #334155; }
.ticket-line.center{ text-align: center; }
.ticket-line.right{ text-align: right; }
.ticket-line.bold{ font-weight: 700; }
.ticket-line.big{ font-weight: 700; color: #1e3a5f; }
.ticket-line.s1{ font-size: 24px; }
.ticket-line.s2{ font-size: 30px; }
.ticket-line.s3{ font-size: 36px; }
.ticket-line.s4{ font-size: 42px; }
.ticket-line.s5{ font-size: 50px; }
.ticket-line.s6{ font-size: 58px; }
.ticket-row{ display: flex; }
.ticket-cell{ flex: 1; }
.ticket-cell.center{ text-align: center; }
.ticket-cell.right{ text-align: right; }
.ticket-cell.big{ font-weight: 700; color: #1e3a5f; }
.ticket-cell.s1{ font-size: 24px; }
.ticket-cell.s2{ font-size: 30px; }
.ticket-cell.s3{ font-size: 36px; }
.ticket-cell.s4{ font-size: 42px; }
.ticket-cell.s5{ font-size: 50px; }
.ticket-cell.s6{ font-size: 58px; }
.ticket-cell.bold{ font-weight: 700; }
.qr-mock{
  width: 232px;
  height: 232px;
  margin: 24px auto;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 24px;
  color: #64748b;
  border: 12px solid #fff;
  outline: 1px solid #cbd5e1;
  background: repeating-conic-gradient(#dbeafe 0% 25%, #fff 0% 50%) 0 0 / 24px 24px;
  border-radius: 16px;
}
.preview-tip{
  font-size: 12px;
  color: #94a3b8;
  text-align: center;
  margin-bottom: 10px;
}
.preview-barcode{
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 4px 0 6px;
}
.preview-barcode-label{
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 3px;
}
.preview-barcode-bars{
  height: 44px;
  width: 220px;
  background: repeating-linear-gradient(90deg, #1e293b 0 2px, transparent 2px 4px, #1e293b 4px 7px, transparent 7px 9px, #1e293b 9px 10px, transparent 10px 14px);
}
.preview-barcode.barcode-s1 .preview-barcode-bars{ height: 36px; }
.preview-barcode.barcode-s2 .preview-barcode-bars{ height: 48px; }
.preview-barcode.barcode-s3 .preview-barcode-bars{ height: 60px; }
.preview-logo{
  display: flex;
  justify-content: center;
  margin: 4px 0 8px;
}
.preview-logo img{
  max-height: 88px;
  max-width: 100%;
  object-fit: contain;
}
.preview-block{
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 6px;
  margin: 2px -6px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: background .12s, border-color .12s;
}
.preview-block:hover{ background: #f8fafc; }
.preview-block.is-selected{ background: #eff6ff; border-color: #409eff; }
.preview-block.drop-target{ border-color: #409eff; background: #eef4ff; }
.drag-handle{
  flex: 0 0 auto;
  cursor: grab;
  color: #cbd5e1;
  font-size: 16px;
  line-height: 1.8;
  user-select: none;
  padding-top: 2px;
}
.drag-handle:hover{ color: #94a3b8; }
.drag-handle:active{ cursor: grabbing; }
.block-body{ flex: 1; min-width: 0; }
.hidden-line{ color: #cbd5e1; font-size: 16px; line-height: 1.8; }
.float-toolbar{
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 4px 6px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
  flex-wrap: wrap;
}
.ft-label{ font-size: 12px; color: #64748b; white-space: nowrap; }
.ft-size{ width: 76px; }
.ft-bold{ width: 48px; }
.ft-align{ width: 76px; }
.block-tools{ flex: 0 0 auto; }
.ticket-cell.member{ cursor: pointer; border-radius: 4px; padding: 0 2px; }
.ticket-cell.member:hover{ background: #f1f5f9; }
.ticket-cell.member.is-selected{ background: #dbeafe; outline: 1px dashed #409eff; }
</style>
