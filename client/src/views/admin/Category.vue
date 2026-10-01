<template>
  <div id="category">
    <div class="split-layout">
      <!-- Left: Tree Panel -->
      <div class="tree-panel">
        <div class="tree-toolbar">
          <el-input placeholder="搜尋分類（名稱／編號）" prefix-icon="el-icon-search" size="small" v-model="treeSearch" clearable style="width: 100%;"></el-input>
          <el-autocomplete v-model="commoditySearch" :fetch-suggestions="queryCommodities" placeholder="搜尋貨品分類（輸入貨品編號）" size="small" clearable style="width: 100%; margin-top: 8px;" @select="onCommoditySelect" @keyup.enter.native="locateCommodityCategory"></el-autocomplete>
          <el-button type="primary" size="small" class="btn-shadow" style="width: 100%; margin-top: 8px;" @click="openAdd(null)">+ 添加頂層分類</el-button>
          <el-button type="warning" size="small" plain style="width: 100%; margin-top: 8px;" @click="randomColors">
            <i class="el-icon-refresh"></i> 一鍵隨機配色
          </el-button>
          <el-button size="small" plain style="width: 100%; margin-top: 8px;" @click="refresh">
            <i class="el-icon-refresh"></i> 重新整理
          </el-button>
        </div>
        <div class="tree-scroll">
          <el-tree
            :data="categoryTree"
            :props="treeProps"
            :filter-node-method="filterNode"
            ref="catTree"
            node-key="_id"
            highlight-current
            :expand-on-click-node="false"
            :current-node-key="selectedNodeId"
            draggable
            :allow-drop="allowDrop"
            :allow-drag="allowDrag"
            @node-drop="onNodeDrop"
            @node-click="onTreeNodeClick"
          >
            <span class="tree-node" slot-scope="{ data }">
              <span class="tree-node-label">
                <i class="el-icon-folder" style="margin-right: 4px; color: #E6A23C;"></i>
                <span v-if="data.code" class="tree-code">{{ data.code }}</span>
                {{ data.cName }}
              </span>
              <span class="tree-node-actions">
                <el-button type="text" size="mini" icon="el-icon-top" title="上移" @click.stop="moveSibling(data, -1)"></el-button>
                <el-button type="text" size="mini" icon="el-icon-bottom" title="下移" @click.stop="moveSibling(data, 1)"></el-button>
                <el-button type="text" size="mini" :icon="data.active ? 'el-icon-circle-check' : 'el-icon-circle-close'" :title="data.active ? '停用' : '啟用'" :class="{ 'remove-btn': !data.active }" @click.stop="toggleActive(data)"></el-button>
                <el-button type="text" size="mini" icon="el-icon-plus" @click.stop="openAdd(data._id)"></el-button>
                <el-button type="text" size="mini" icon="el-icon-edit" @click.stop="openEdit(data)"></el-button>
                <el-button type="text" size="mini" icon="el-icon-delete" class="remove-btn" @click.stop="delCategory(data)"></el-button>
              </span>
            </span>
          </el-tree>
          <div v-if="!categoryTree.length" class="empty-tip">暫無分類</div>
        </div>
      </div>

      <!-- Right: Content Panel -->
      <div class="content-panel">
        <div class="content-tabs">
          <el-radio-group v-model="rightTab" size="mini" @change="onRightTabChange">
            <el-radio-button label="content">內容</el-radio-button>
            <el-radio-button label="pos">POS 預覽</el-radio-button>
          </el-radio-group>
        </div>
        <template v-if="rightTab === 'content'">
        <template v-if="selectedCategory">
          <div class="content-header">
            <div class="breadcrumb">
              <span class="crumb-link" @click="selectNode(null)">全部分類</span>
              <template v-for="(b, bi) in breadcrumb">
                <span class="crumb-sep" :key="'s'+bi"> / </span>
                <span class="crumb-link" :key="b._id" @click="selectNode(b)">{{ b.cName }}</span>
              </template>
            </div>
            <div class="content-actions">
              <el-button size="small" type="primary" plain @click="openAdd(selectedCategory._id)" :disabled="!canAddChild">+ 添加子分類</el-button>
              <el-button size="small" type="success" plain @click="openPicker">+ 添加貨品</el-button>
              <el-button size="small" type="warning" plain @click="openComboPicker">+ 添加套餐</el-button>
              <el-button size="small" type="info" plain @click="openModCatPicker">+ 添加改碼類別</el-button>
              <el-button size="small" type="info" plain @click="openModCodePicker">+ 添加改碼</el-button>
              <el-button size="small" @click="openEdit(selectedCategory)">編輯</el-button>
            </div>
          </div>

          <div class="cat-info">
            <el-tag size="mini" :type="selectedCategory.active ? 'success' : 'info'">{{ selectedCategory.active ? '啟用' : '停用' }}</el-tag>
            <el-tag size="mini" type="info" style="margin-left: 4px;">{{ selectedCategory.code || '—' }}</el-tag>
            <el-tag size="mini" type="warning" style="margin-left: 4px;" v-if="selectedCategory.department">部門: {{ selectedCategory.department }}</el-tag>
            <span class="info-text">排序: {{ selectedCategory.no }}</span>
            <span class="info-text">POS: {{ formatEt((selectedCategory.effectiveTime || {}).pos) }}</span>
            <span class="info-text">QR: {{ formatEt((selectedCategory.effectiveTime || {}).qr) }}</span>
            <el-tag v-for="m in modeOptions" :key="m" size="mini" :type="(selectedCategory.serviceModes || []).includes(m) ? 'success' : 'info'" style="margin-left: 4px;">{{ m }}</el-tag>
          </div>

          <div v-if="!canAddChild" class="depth-warning">
            <i class="el-icon-warning"></i> 已達最大 {{ maxDepth }} 層深度限制，無法再添加子分類
          </div>

          <!-- Mixed Items List -->
          <div class="content-section">
            <div class="section-title">
              混合列表 <el-tag size="mini" type="info">{{ mixedItems.length }}</el-tag>
              <span class="section-tip">拖曳排序 · 子分類 / 貨品 / 套餐 / 改碼 / 改碼類別可自由交叉</span>
            </div>
            <div v-if="!mixedItems.length" class="empty-tip">此分類暫無內容，點擊上方按鈕添加</div>
            <div v-else class="commodity-list">
              <div v-for="(item, idx) in mixedItems" :key="item._itemKey" class="commodity-item"
                   draggable="true" @dragstart="onMixedDragStart($event, idx)" @dragover.prevent="onMixedDragOver($event, idx)" @dragend="onMixedDragEnd">
                <span class="item-index">{{ idx + 1 }}</span>
                <div class="item-type-icon" :class="'type-' + item._itemType">
                  <i :class="itemTypeIcon(item)"></i>
                </div>
                <img v-if="item.img" :src="item.img" class="item-img">
                <div class="item-info" :class="{ 'clickable': item._itemType === 'category' }" @click="item._itemType === 'category' && selectItemCategory(item)">
                  <span class="item-code">{{ item.code || item.plu || '' }}</span>
                  <span class="item-name">{{ item.cName || item.name }}</span>
                  <span class="item-price" v-if="item.price">$ {{ item.price }}</span>
                  <span v-if="item._itemType === 'modcode'" class="item-modcat-badge">改碼</span>
                  <span v-if="item._itemType === 'modcodecategory'" class="item-modcat-badge">改碼類別</span>
                </div>
                <div class="item-actions">
                  <el-button type="text" size="mini" :disabled="idx === 0" @click="mixedMoveUp(idx)"><i class="el-icon-top"></i></el-button>
                  <el-button type="text" size="mini" :disabled="idx === mixedItems.length - 1" @click="mixedMoveDown(idx)"><i class="el-icon-bottom"></i></el-button>
                  <el-button type="text" size="mini" class="remove-btn" @click="removeMixedItem(idx, item)"><i class="el-icon-close"></i></el-button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-placeholder">
          <i class="el-icon-folder-opened" style="font-size: 48px; color: #c0c4cc;"></i>
          <p style="margin-top: 12px; color: #909399;">請在左側選擇一個分類查看內容</p>
        </div>
        </template>
        <template v-else>
          <div class="pos-preview">
            <div class="pos-preview-header">
              <span class="pos-preview-title">POS 收銀預覽</span>
              <span class="pos-preview-hint">僅顯示「POS 收銀」渠道且已啟用的分類；點擊分類可下鑽子分類</span>
            </div>
            <div class="pos-mock">
              <div class="pos-mock-brand">點餐系統</div>
              <div class="pos-mock-pills">
                <div v-for="cat in posPreviewTopCats" :key="'pill' + cat._id" class="pos-pill" :class="{ active: posPreviewTopActiveId === String(cat._id) }" :style="posPillStyle(cat)" @click="posDrill(cat)">{{ cat.cName }}</div>
                <div v-if="!posPreviewTopCats.length" class="pos-preview-empty">暫無頂層分類</div>
              </div>
              <div v-if="posPreviewActiveCat" class="pos-mock-crumb">
                <span v-for="(b, bi) in posPreviewBreadcrumb" :key="'b' + bi">
                  <span class="pos-crumb-link" @click="posDrill(b)">{{ b.cName }}</span>
                  <span v-if="bi < posPreviewBreadcrumb.length - 1" class="pos-crumb-sep"> / </span>
                </span>
              </div>
              <div class="pos-mock-body">
                <div v-if="posPreviewBackVisible" class="pos-tile pos-back-tile" @click="posGoBack"><i class="el-icon-arrow-left"></i> 返回</div>
                <div v-for="child in posPreviewChildren" :key="'sub' + child._id" class="pos-tile" :style="posTileStyle(child)" @click="posDrill(child)">{{ child.cName }}<i class="el-icon-arrow-right pos-tile-arrow"></i></div>
                <div v-for="f in posPreviewFoods" :key="'f' + String(f._id) + f._itemType" class="pos-food">
                  <span class="pos-food-name">{{ f.name }}<span v-if="f._itemType === 'modcode'" class="pos-food-badge">改碼</span><span v-if="f._itemType === 'modcodecategory'" class="pos-food-badge">改碼類別</span></span>
                  <span v-if="f.price > 0" class="pos-food-price">${{ f.price }}</span>
                </div>
                <div v-if="!posPreviewBackVisible && !posPreviewChildren.length && !posPreviewFoods.length" class="pos-preview-empty">{{ posPreviewActiveCat ? '此分類暫無內容' : '請點擊上方分類查看內容' }}</div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Add / Edit Dialog -->
    <el-dialog :title="editMode === 'add' ? '添加分類' : '編輯分類'" :visible.sync="editVisible" width="520px" :before-close="closeEdit">
      <el-form ref="catForm" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="父分類">
          <el-select v-model="form.parentId" placeholder="頂層分類（無父分類）" clearable style="width: 100%;">
            <el-option label="頂層分類" value=""></el-option>
            <el-option v-for="c in allFlatCategories" :key="c._id" :label="c.cName" :value="c._id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="分類編號" prop="code">
          <el-input v-model="form.code" placeholder="請輸入分類編號"></el-input>
        </el-form-item>
        <el-form-item label="分類名稱" prop="cName">
          <el-input v-model="form.cName" placeholder="請輸入分類名稱"></el-input>
        </el-form-item>
        <el-form-item label="部門">
          <el-select v-model="form.department" placeholder="選擇部門" filterable clearable style="width: 100%;">
            <el-option v-for="d in departmentOptions" :key="d" :label="d" :value="d"></el-option>
          </el-select>
        </el-form-item>

        <!-- Effective Time: POS -->
        <el-form-item label="生效時間">
          <div class="et-row">
            <el-tag size="small" type="success" style="margin-right: 8px;">POS</el-tag>
            <el-select v-model="form.effectiveTime.pos.type" size="small" style="width: 130px;">
              <el-option label="永久" value="permanent"></el-option>
              <el-option label="生效日期" value="dateRange"></el-option>
              <el-option label="星期" value="weekly"></el-option>
              <el-option label="不生效" value="disabled"></el-option>
            </el-select>
          </div>
          <div v-if="form.effectiveTime.pos.type === 'dateRange'" class="et-sub">
            <el-date-picker v-model="form.effectiveTime.pos.startDate" type="date" placeholder="開始日期" value-format="yyyy-MM-dd" size="small" style="width: 42%;"></el-date-picker>
            <span class="et-dash">~</span>
            <el-date-picker v-model="form.effectiveTime.pos.endDate" type="date" placeholder="結束日期" value-format="yyyy-MM-dd" size="small" style="width: 42%;"></el-date-picker>
          </div>
          <div v-if="form.effectiveTime.pos.type === 'weekly'" class="et-sub">
            <el-checkbox-group v-model="form.effectiveTime.pos.weekdays">
              <el-checkbox v-for="dw in weekdayOptions" :key="'pw'+dw.value" :label="dw.value">{{ dw.label }}</el-checkbox>
            </el-checkbox-group>
          </div>
          <div v-if="form.effectiveTime.pos.type === 'dateRange' || form.effectiveTime.pos.type === 'weekly'" class="et-sub et-time-row">
            <span class="et-time-label">時間段</span>
            <el-input v-model="form.effectiveTime.pos.startTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
            <span class="et-dash">~</span>
            <el-input v-model="form.effectiveTime.pos.endTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
          </div>

          <!-- Effective Time: QR -->
          <div class="et-row" style="margin-top: 10px;">
            <el-tag size="small" type="warning" style="margin-right: 8px;">QR</el-tag>
            <el-select v-model="form.effectiveTime.qr.type" size="small" style="width: 130px;">
              <el-option label="永久" value="permanent"></el-option>
              <el-option label="生效日期" value="dateRange"></el-option>
              <el-option label="星期" value="weekly"></el-option>
              <el-option label="不生效" value="disabled"></el-option>
            </el-select>
          </div>
          <div v-if="form.effectiveTime.qr.type === 'dateRange'" class="et-sub">
            <el-date-picker v-model="form.effectiveTime.qr.startDate" type="date" placeholder="開始日期" value-format="yyyy-MM-dd" size="small" style="width: 42%;"></el-date-picker>
            <span class="et-dash">~</span>
            <el-date-picker v-model="form.effectiveTime.qr.endDate" type="date" placeholder="結束日期" value-format="yyyy-MM-dd" size="small" style="width: 42%;"></el-date-picker>
          </div>
          <div v-if="form.effectiveTime.qr.type === 'weekly'" class="et-sub">
            <el-checkbox-group v-model="form.effectiveTime.qr.weekdays">
              <el-checkbox v-for="dw in weekdayOptions" :key="'qw'+dw.value" :label="dw.value">{{ dw.label }}</el-checkbox>
            </el-checkbox-group>
          </div>
          <div v-if="form.effectiveTime.qr.type === 'dateRange' || form.effectiveTime.qr.type === 'weekly'" class="et-sub et-time-row">
            <span class="et-time-label">時間段</span>
            <el-input v-model="form.effectiveTime.qr.startTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
            <span class="et-dash">~</span>
            <el-input v-model="form.effectiveTime.qr.endTime" placeholder="HH:mm" size="small" style="width: 90px;"></el-input>
          </div>
        </el-form-item>

        <el-form-item label="適用區域" prop="serviceModes">
          <el-checkbox-group v-model="form.serviceModes">
            <el-checkbox v-for="m in modeOptions" :key="m" :label="m"></el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="渠道開關">
          <el-checkbox-group v-model="form.channels">
            <el-checkbox label="pos">POS 收銀</el-checkbox>
            <el-checkbox label="qr">QR 手機</el-checkbox>
          </el-checkbox-group>
          <div class="field-tip">整類不顯示於該渠道</div>
        </el-form-item>
        <el-form-item label="漸變色">
          <div class="color-row">
            <div class="color-item">
              <label class="color-label">起始色</label>
              <el-color-picker v-model="form.colorFrom" :predefine="presetColors" show-alpha></el-color-picker>
              <span class="color-val">{{ form.colorFrom || '無' }}</span>
            </div>
            <div class="color-item">
              <label class="color-label">結束色</label>
              <el-color-picker v-model="form.colorTo" :predefine="presetColors" show-alpha></el-color-picker>
              <span class="color-val">{{ form.colorTo || '無' }}</span>
            </div>
            <div class="color-item">
              <label class="color-label">文字色</label>
              <el-color-picker v-model="form.textColor" :predefine="presetTextColors" show-alpha></el-color-picker>
              <span class="color-val">{{ form.textColor || '#ffffff' }}</span>
            </div>
          </div>
          <div class="color-preview" v-if="form.colorFrom && form.colorTo" :style="colorPreviewStyle">
            預覽文字
          </div>
          <div class="field-tip">設定後，POS 點餐版面的分類 Tab 將顯示漸變色效果（兩色都填才生效）</div>
        </el-form-item>
        <el-form-item label="時段設定">
          <div style="width: 100%;">
            <div v-for="(ts, idx) in form.timeSlots" :key="idx" style="display: flex; align-items: center; margin-bottom: 6px;">
              <el-input v-model="ts.name" placeholder="時段名" style="width: 28%;"></el-input>
              <el-input v-model="ts.start" placeholder="HH:mm" style="width: 22%; margin-left: 4px;"></el-input>
              <el-input v-model="ts.end" placeholder="HH:mm" style="width: 22%; margin-left: 4px;"></el-input>
              <el-button type="danger" icon="el-icon-delete" size="mini" @click="removeTimeSlot(idx)" style="margin-left: 4px;"></el-button>
            </div>
            <el-button size="mini" type="primary" plain @click="addTimeSlot">+ 添加時段</el-button>
          </div>
        </el-form-item>
      </el-form>
      <span slot="footer">
        <el-button @click="closeEdit">取消</el-button>
        <el-button type="primary" class="btn-shadow" @click="submitForm">確定</el-button>
      </span>
    </el-dialog>

    <!-- Combo Picker Dialog -->
    <el-dialog title="添加套餐到分類" :visible.sync="comboPickerVisible" width="480px" append-to-body>
      <el-input v-model="comboPickerSearch" placeholder="搜尋套餐名稱" size="small" prefix-icon="el-icon-search" clearable style="margin-bottom: 10px;"></el-input>
      <div v-if="filteredComboPickerList.length" class="picker-list">
        <div v-for="pi in filteredComboPickerList" :key="pi._id" class="picker-item" @click="addCombo(pi)">
          <img v-if="pi.img" :src="pi.img" class="picker-img">
          <div class="picker-info">
            <span class="picker-name">{{ pi.name }}</span>
            <span class="picker-cat">{{ pi.type === 'fixed' ? '固定桌菜' : '選單合菜' }}</span>
          </div>
          <span class="picker-price">$ {{ pi.price }}</span>
        </div>
      </div>
      <div v-else class="empty-tip">無可用套餐</div>
    </el-dialog>

    <!-- Commodity Picker Dialog -->
    <el-dialog title="添加貨品到分類" :visible.sync="pickerVisible" width="480px" append-to-body>
      <el-input v-model="pickerSearch" placeholder="搜尋貨品名稱或編號" size="small" prefix-icon="el-icon-search" clearable style="margin-bottom: 10px;"></el-input>
      <div v-if="filteredPickerList.length" class="picker-list">
        <div v-for="pi in filteredPickerList" :key="pi._id" class="picker-item" @click="addCommodity(pi)">
          <img v-if="pi.img" :src="pi.img" class="picker-img">
          <div class="picker-info">
            <span class="picker-name">{{ pi.name }}</span>
            <span class="picker-cat">{{ pi.category }}</span>
          </div>
          <span class="picker-price">$ {{ pi.price }}</span>
        </div>
      </div>
      <div v-else class="empty-tip">無可用貨品</div>
    </el-dialog>

    <!-- 改碼類別選擇器 -->
    <el-dialog title="添加改碼類別到分類" :visible.sync="modCatPickerVisible" width="480px" append-to-body>
      <el-input v-model="modCatPickerSearch" placeholder="搜尋改碼類別名稱或編號" size="small" prefix-icon="el-icon-search" clearable style="margin-bottom: 10px;"></el-input>
      <div v-if="filteredModCatPickerList.length" class="picker-list">
        <div v-for="mc in filteredModCatPickerList" :key="mc._id" class="picker-item" @click="addModCatToCategory(mc)">
          <div class="picker-info">
            <span class="picker-name"><span v-if="mc.code" style="font-weight:700; margin-right:4px;">{{ mc.code }}</span>{{ mc.name }}</span>
            <span class="picker-cat">{{ modCountByCategory(mc.name) }} 個改碼</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-tip">無可用改碼類別</div>
    </el-dialog>

    <!-- 改碼選擇器 -->
    <el-dialog title="添加改碼到分類" :visible.sync="modCodePickerVisible" width="480px" append-to-body>
      <el-input v-model="modCodePickerSearch" placeholder="搜尋改碼名稱或編號" size="small" prefix-icon="el-icon-search" clearable style="margin-bottom: 10px;"></el-input>
      <div v-if="filteredModCodePickerList.length" class="picker-list">
        <div v-for="m in filteredModCodePickerList" :key="m._id" class="picker-item" @click="addModCodeToCategory(m)">
          <div class="picker-info">
            <span class="picker-name"><span v-if="m.code" style="font-weight:700; margin-right:4px;">{{ m.code }}</span>{{ m.name }}</span>
            <span class="picker-cat">{{ m.category || '未分類' }}</span>
          </div>
          <span v-if="m.price > 0" class="picker-price">+${{ m.price }}</span>
        </div>
      </div>
      <div v-else class="empty-tip">無可用改碼</div>
    </el-dialog>
  </div>
</template>

<script>
export default {
  name: 'category',
  data: function () {
    return {
      modeOptions: ['堂食', '外賣', '自取'],
      weekdayOptions: [
        { value: 1, label: '一' }, { value: 2, label: '二' }, { value: 3, label: '三' },
        { value: 4, label: '四' }, { value: 5, label: '五' }, { value: 6, label: '六' }, { value: 7, label: '日' }
      ],
      weekdayMap: { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' },
      presetColors: ['#1f2d3d', '#254f7d', '#6a73c8', '#8d94d0', '#5b8fd6', '#4a7cc4', '#43a978', '#359263', '#e08a4e', '#d07440', '#e74c3c', '#27ae60', '#2980b9', '#8e44ad', '#f39c12', '#1abc9c'],
      presetTextColors: ['#ffffff', '#1f2937', '#f01414', '#2563eb', '#e6a23c', '#333333'],

      categoryTree: [],
      treeProps: { children: 'children', label: 'cName' },
      treeSearch: '',
      commoditySearch: '',
      departments: [],
      allFlatCategories: [],
      allCommodities: [],
      allCombos: [],

      selectedCategory: null,
      selectedNodeId: null,
      selectedChildren: [],
      breadcrumb: [],
      mixedItems: [],
      canAddChild: true,
      maxDepth: 5,
      mixedDragIndex: -1,
      mixedDragOverIndex: -1,

      // POS 預覽
      rightTab: 'content',
      posPreviewActiveId: '',
      posPreviewItems: [],

      // 改碼相關
      modCatPickerVisible: false,
      modCatPickerSearch: '',
      modCodePickerVisible: false,
      modCodePickerSearch: '',
      allModCategories: [],
      allModCodes: [],

      form: {
        code: '',
        cName: '',
        department: '',
        active: true,
        parentId: '',
        serviceModes: ['堂食', '外賣', '自取'],
        channels: ['pos', 'qr'],
        timeSlots: [],
        colorFrom: '',
        colorTo: '',
        textColor: '#ffffff',
        effectiveTime: {
          pos: { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] },
          qr: { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] }
        }
      },
      formRules: {
        cName: [{ required: true, message: '分類名稱不能為空！', trigger: 'blur' }],
        serviceModes: [{
          validator: function (rule, value, callback) { value && value.length ? callback() : callback(new Error('至少保留一個適用區域')) },
          trigger: 'change'
        }]
      },
      editMode: 'add',
      editVisible: false,
      editingId: null,

      detailCommodities: [],
      detailCombos: [],
      pickerVisible: false,
      pickerSearch: '',
      comboPickerVisible: false,
      comboPickerSearch: '',
      dragIndex: -1,
      dragOverIndex: -1
    }
  },
  computed: {
    colorPreviewStyle: function () {
      if (!this.form.colorFrom || !this.form.colorTo) return {}
      return {
        background: 'linear-gradient(135deg, ' + this.form.colorFrom + ', ' + this.form.colorTo + ')',
        color: this.form.textColor || '#ffffff',
        padding: '12px 20px',
        borderRadius: '12px',
        marginTop: '8px',
        textAlign: 'center',
        fontWeight: '700',
        fontSize: '14px',
        boxShadow: '0 3px 12px rgba(0,0,0,.15)'
      }
    },
    filteredPickerList: function () {
      var existIds = this.detailCommodities.map(function (c) { return String(c._id) })
      var keyword = this.pickerSearch.trim().toLowerCase()
      return this.allCommodities.filter(function (c) {
        if (existIds.indexOf(String(c._id)) >= 0) return false
        if (keyword) {
          return (c.name && c.name.toLowerCase().indexOf(keyword) >= 0) ||
                 (c.plu && c.plu.toLowerCase().indexOf(keyword) >= 0) ||
                 (c.code && c.code.toLowerCase().indexOf(keyword) >= 0)
        }
        return true
      })
    },
    filteredComboPickerList: function () {
      var existIds = this.detailCombos.map(function (c) { return String(c._id) })
      var keyword = this.comboPickerSearch.trim().toLowerCase()
      return this.allCombos.filter(function (c) {
        if (existIds.indexOf(String(c._id)) >= 0) return false
        if (keyword) {
          return c.name && c.name.toLowerCase().indexOf(keyword) >= 0
        }
        return true
      })
    },
    filteredModCatPickerList: function () {
      var existIds = this.mixedItems.filter(function (i) { return i._itemType === 'modcodecategory' }).map(function (i) { return String(i._id) })
      var keyword = this.modCatPickerSearch.trim().toLowerCase()
      return this.allModCategories.filter(function (c) {
        if (existIds.indexOf(String(c._id)) >= 0) return false
        if (keyword) {
          return (c.name && c.name.toLowerCase().indexOf(keyword) >= 0) ||
                 (c.code && c.code.toLowerCase().indexOf(keyword) >= 0)
        }
        return true
      })
    },
    filteredModCodePickerList: function () {
      var existIds = this.mixedItems.filter(function (i) { return i._itemType === 'modcode' }).map(function (i) { return String(i._id) })
      var keyword = this.modCodePickerSearch.trim().toLowerCase()
      return this.allModCodes.filter(function (c) {
        if (existIds.indexOf(String(c._id)) >= 0) return false
        if (keyword) {
          return (c.name && c.name.toLowerCase().indexOf(keyword) >= 0) ||
                 (c.code && c.code.toLowerCase().indexOf(keyword) >= 0)
        }
        return true
      })
    },
    departmentOptions: function () {
      return this.departments.filter(function (d) { return d.active !== false }).map(function (d) { return d.name })
    },
    posCatById: function () {
      var map = {}
      this.allFlatCategories.forEach(function (c) { map[String(c._id)] = c })
      return map
    },
    posEligibleCats: function () {
      return this.allFlatCategories.filter(function (c) {
        var ch = (c.channels && c.channels.length) ? c.channels : ['pos', 'qr']
        return ch.indexOf('pos') >= 0 && c.active !== false
      })
    },
    posPreviewTopCats: function () {
      return this.posEligibleCats.filter(function (c) { return !c.parentId }).sort(function (a, b) {
        return (a.no - b.no) || (String(a._id) < String(b._id) ? -1 : 1)
      })
    },
    posPreviewActiveCat: function () {
      return this.posCatById[String(this.posPreviewActiveId)] || null
    },
    posPreviewTopActiveId: function () {
      var self = this
      var cur = this.posPreviewActiveCat
      if (!cur) return ''
      var seen = {}
      while (cur && !seen[String(cur._id)]) {
        seen[String(cur._id)] = true
        if (!cur.parentId) return String(cur._id)
        cur = self.posCatById[String(cur.parentId)]
      }
      return String(this.posPreviewActiveId)
    },
    posPreviewBreadcrumb: function () {
      var self = this
      var cur = this.posPreviewActiveCat
      var path = []
      var seen = {}
      while (cur && !seen[String(cur._id)]) {
        seen[String(cur._id)] = true
        path.unshift(cur)
        if (!cur.parentId) break
        cur = self.posCatById[String(cur.parentId)]
      }
      return path
    },
    posPreviewChildren: function () {
      var id = String(this.posPreviewActiveId)
      return this.posEligibleCats.filter(function (c) {
        return c.parentId && String(c.parentId) === id
      }).sort(function (a, b) {
        return (a.no - b.no) || (String(a._id) < String(b._id) ? -1 : 1)
      })
    },
    posPreviewFoods: function () {
      return this.posPreviewItems.filter(function (i) { return i._itemType !== 'category' })
    },
    posPreviewBackVisible: function () {
      var cat = this.posPreviewActiveCat
      return !!(cat && cat.parentId)
    }
  },
  watch: {
    treeSearch: function (val) {
      if (this.$refs.catTree) this.$refs.catTree.filter(val)
    }
  },
  methods: {
    loadTree: function () {
      var self = this
      this.$axios.get('/api/category/tree').then(function (res) {
        self.categoryTree = res.data || []
      }).catch(function () {
        self.categoryTree = []
      })
    },
    loadFlat: function () {
      var self = this
      this.$axios.get('/api/category/all').then(function (res) {
        self.allFlatCategories = res.data || []
      }).catch(function () {
        self.allFlatCategories = []
      })
    },
    loadDepartments: function () {
      var self = this
      this.$axios.get('/api/department/list').then(function (res) {
        self.departments = res.data || []
      }).catch(function () {
        self.departments = []
      })
    },
    refresh: function () {
      this.loadTree()
      this.loadFlat()
      this.loadDepartments()
      this.loadAllModCategories()
      this.loadAllModCodes()
      if (this.selectedCategory) {
        this.loadMixedItems(this.selectedCategory._id)
        this.loadDepth(this.selectedCategory._id)
      }
    },
    filterNode: function (value, data) {
      if (!value) return true
      var q = value.toLowerCase()
      return (data.cName || '').toLowerCase().indexOf(q) >= 0 ||
             (data.code || '').toLowerCase().indexOf(q) >= 0
    },
    onTreeNodeClick: function (data) {
      this.selectNode(data)
    },
    selectNode: function (cat) {
      if (!cat) {
        this.selectedCategory = null
        this.selectedNodeId = null
        this.selectedChildren = []
        this.breadcrumb = []
        this.mixedItems = []
        this.canAddChild = true
        return
      }
      this.selectedCategory = cat
      this.selectedNodeId = cat._id
      this.buildBreadcrumb(cat)
      this.selectedChildren = this.allFlatCategories.filter(function (c) {
        return c.parentId && String(c.parentId) === String(cat._id)
      })
      this.loadMixedItems(cat._id)
      this.loadDepth(cat._id)
    },
    buildBreadcrumb: function (cat) {
      var parentMap = {}
      this.allFlatCategories.forEach(function (c) {
        if (c.parentId) parentMap[String(c._id)] = c.parentId
      })
      var chain = []
      var cur = cat
      while (cur) {
        chain.unshift(cur)
        var pid = parentMap[String(cur._id)]
        if (!pid) break
        cur = this.allFlatCategories.find(function (c) { return String(c._id) === String(pid) })
        if (!cur) break
      }
      this.breadcrumb = chain.slice(0, -1)
    },
    makeDefaultEt: function () {
      return {
        pos: { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] },
        qr: { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] }
      }
    },
    cloneEt: function (src) {
      if (!src) return { type: 'permanent', startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [1, 2, 3, 4, 5], holidays: [] }
      return {
        type: src.type || 'permanent',
        startDate: src.startDate || '',
        endDate: src.endDate || '',
        startTime: src.startTime || '',
        endTime: src.endTime || '',
        weekdays: (src.weekdays || [1, 2, 3, 4, 5]).slice(),
        holidays: (src.holidays || []).slice()
      }
    },
    openAdd: function (parentId) {
      this.editMode = 'add'
      this.editingId = null
      this.form = {
        code: '',
        cName: '',
        department: '',
        active: true,
        parentId: parentId || '',
        serviceModes: this.modeOptions.slice(),
        channels: ['pos', 'qr'],
        timeSlots: [],
        colorFrom: '',
        colorTo: '',
        textColor: '#ffffff',
        effectiveTime: this.makeDefaultEt()
      }
      this.editVisible = true
    },
    openEdit: function (row) {
      this.editMode = 'edit'
      this.editingId = row._id
      var src = row.effectiveTime || {}
      this.form = {
        code: row.code || '',
        cName: row.cName || '',
        department: row.department || '',
        active: row.active,
        parentId: row.parentId || '',
        serviceModes: (row.serviceModes || this.modeOptions).slice(),
        channels: (row.channels && row.channels.length ? row.channels : ['pos', 'qr']).slice(),
        timeSlots: (row.slots || []).map(function (s) { return { name: s.name || '', start: s.start || '', end: s.end || '' } }),
        colorFrom: row.colorFrom || '',
        colorTo: row.colorTo || '',
        textColor: row.textColor || '#ffffff',
        effectiveTime: { pos: this.cloneEt(src.pos), qr: this.cloneEt(src.qr) }
      }
      this.editVisible = true
    },
    closeEdit: function () {
      this.editVisible = false
      if (this.$refs.catForm) this.$refs.catForm.resetFields()
    },
    submitForm: function () {
      var self = this
      this.$refs.catForm.validate(function (valid) {
        if (!valid) return
        var url = self.editMode === 'add' ? '/add' : '/edit'
        var payload = {
          code: self.form.code,
          cName: self.form.cName,
          department: self.form.department || '',
          active: self.form.active,
          parentId: self.form.parentId || null,
          serviceModes: self.form.serviceModes,
          channels: self.form.channels,
          slots: self.form.timeSlots.filter(function (s) { return s.name && s.start && s.end }),
          colorFrom: self.form.colorFrom || '',
          colorTo: self.form.colorTo || '',
          textColor: self.form.textColor || '#ffffff',
          effectiveTime: self.form.effectiveTime
        }
        if (self.editMode === 'edit') payload._id = self.editingId
        self.$axios.post('/api/category' + url, payload).then(function (res) {
          self.$message({ type: 'success', message: res.data })
          self.editVisible = false
          self.loadTree()
          self.loadFlat()
        })
      })
    },
    addTimeSlot: function () {
      this.form.timeSlots.push({ name: '', start: '', end: '' })
    },
    removeTimeSlot: function (idx) {
      this.form.timeSlots.splice(idx, 1)
    },
    updateRow: function (row, data) {
      var self = this
      this.$axios.post('/api/category/edit', { _id: row._id, ...data }).then(function () {
        self.loadTree()
        self.loadFlat()
      }).catch(function () {
        self.$message.error('更新失敗')
        self.loadTree()
        self.loadFlat()
      })
    },
    formatWeekdays: function (weekdays) {
      if (!weekdays || !weekdays.length) return '一至五'
      var map = this.weekdayMap
      return weekdays.slice().sort().map(function (d) { return map[d] }).join('、')
    },
    formatEt: function (et) {
      if (!et || et.type === 'permanent') return '永久'
      if (et.type === 'disabled') return '不生效'
      if (et.type === 'dateRange') {
        var s = (et.startDate || '?') + ' ~ ' + (et.endDate || '?')
        if (et.startTime && et.endTime) s += ' ' + et.startTime + '~' + et.endTime
        return s
      }
      if (et.type === 'weekly') {
        var s2 = '週' + this.formatWeekdays(et.weekdays)
        if (et.startTime && et.endTime) s2 += ' ' + et.startTime + '~' + et.endTime
        return s2
      }
      return '永久'
    },
    randomColors: function () {
      var self = this
      this.$confirm('為所有頂層分類隨機套用漸變色？（會覆蓋現有顏色）', '提示', { type: 'warning' }).then(function () {
        self.$axios.post('/api/category/randomColors').then(function (res) {
          self.$message({ type: 'success', message: res.data })
          self.loadTree()
          self.loadFlat()
        }).catch(function (err) {
          self.$message.error((err.response && err.response.data) || '配色失敗')
        })
      }).catch(function () {})
    },
    delCategory: function (row) {
      var self = this
      this.$confirm('確認刪除分類「' + row.cName + '」嗎？').then(function () {
        self.$axios.post('/api/category/del', { _id: row._id }).then(function (res) {
          self.$message({ type: 'success', message: res.data })
          if (self.selectedCategory && String(self.selectedCategory._id) === String(row._id)) {
            self.selectedCategory = null
            self.selectedNodeId = null
            self.selectedChildren = []
            self.breadcrumb = []
            self.mixedItems = []
          }
          self.loadTree()
          self.loadFlat()
        }).catch(function (err) {
          self.$message.error((err.response && err.response.data) || '刪除失敗')
        })
      }).catch(function () {})
    },
    loadMixedItems: function (id) {
      var self = this
      this.$axios.get('/api/category/' + id + '/items').then(function (res) {
        self.mixedItems = (res.data || []).map(function (item, idx) {
          var key = item._itemType + '_' + item._id + '_' + idx
          return Object.assign({}, item, { _itemKey: key })
        })
      }).catch(function () {
        self.mixedItems = []
      })
    },
    loadDepth: function (id) {
      var self = this
      this.$axios.get('/api/category/' + id + '/depth').then(function (res) {
        self.canAddChild = res.data.canAdd
        self.maxDepth = res.data.maxDepth
      }).catch(function () {
        self.canAddChild = false
      })
    },
    selectItemCategory: function (item) {
      var cat = this.allFlatCategories.find(function (c) { return String(c._id) === String(item._id) })
      if (cat) this.selectNode(cat)
    },
    mixedMoveUp: function (idx) {
      if (idx <= 0) return
      var list = this.mixedItems.slice()
      var tmp = list[idx - 1]; list[idx - 1] = list[idx]; list[idx] = tmp
      this.mixedItems = list
      this.saveMixedOrder()
    },
    mixedMoveDown: function (idx) {
      if (idx >= this.mixedItems.length - 1) return
      var list = this.mixedItems.slice()
      var tmp = list[idx + 1]; list[idx + 1] = list[idx]; list[idx] = tmp
      this.mixedItems = list
      this.saveMixedOrder()
    },
    onMixedDragStart: function (e, idx) {
      this.mixedDragIndex = idx
      e.dataTransfer.effectAllowed = 'move'
    },
    onMixedDragOver: function (e, idx) {
      this.mixedDragOverIndex = idx
    },
    onMixedDragEnd: function () {
      if (this.mixedDragIndex >= 0 && this.mixedDragOverIndex >= 0 && this.mixedDragIndex !== this.mixedDragOverIndex) {
        var list = this.mixedItems.slice()
        var src = list.splice(this.mixedDragIndex, 1)[0]
        list.splice(this.mixedDragOverIndex, 0, src)
        this.mixedItems = list
        this.saveMixedOrder()
      }
      this.mixedDragIndex = -1
      this.mixedDragOverIndex = -1
    },
    saveMixedOrder: function () {
      var self = this
      var items = this.mixedItems.map(function (item) {
        return { targetId: item._id, targetType: item._itemType }
      })
      this.$axios.post('/api/category/' + this.selectedCategory._id + '/saveItems', { items: items })
        .catch(function () { self.$message.error('排序保存失敗') })
    },
    removeMixedItem: function (idx, item) {
      var self = this
      var typeName = item._itemType === 'category' ? '子分類' : item._itemType === 'combo' ? '套餐' : item._itemType === 'modcode' ? '改碼' : item._itemType === 'modcodecategory' ? '改碼類別' : '貨品'
      var itemName = item.cName || item.name
      this.$confirm('確認將' + typeName + '「' + itemName + '」從此分類移除？', '提示', { type: 'warning' }).then(function () {
        self.$axios.post('/api/category/' + self.selectedCategory._id + '/removeItem', { targetId: item._id, targetType: item._itemType }).then(function () {
          self.$message.success('已移除')
          self.mixedItems.splice(idx, 1)
        }).catch(function () {
          self.$message.error('移除失敗')
        })
      }).catch(function () {})
    },
    loadAllCommodities: function () {
      var self = this
      return this.$axios.post('/api/commodity/get', { index: 1, size: 9999, name: '' }).then(function (res) {
        self.allCommodities = (res.data && res.data.result) || []
      }).catch(function () {
        self.allCommodities = []
      })
    },
    queryCommodities: function (queryString, cb) {
      var q = (queryString || '').trim().toLowerCase()
      var matches = this.allCommodities.filter(function (c) {
        return !q ||
          (c.code && String(c.code).toLowerCase().indexOf(q) >= 0) ||
          (c.plu && String(c.plu).toLowerCase().indexOf(q) >= 0) ||
          (c.name && c.name.toLowerCase().indexOf(q) >= 0)
      }).slice(0, 20)
      cb(matches.map(function (c) {
        var code = c.code || c.plu || ''
        return { value: (code ? code + ' · ' : '') + c.name, commodity: c }
      }))
    },
    onCommoditySelect: function (item) {
      if (item && item.commodity) this.locateCommodityCategory(item.commodity)
    },
    locateCommodityCategory: function (commodity) {
      var target = commodity
      if (!target) {
        var q = (this.commoditySearch || '').trim()
        var ql = q.toLowerCase()
        if (!ql) return
        target = this.allCommodities.find(function (c) {
          return (c.code && String(c.code).toLowerCase() === ql) ||
                 (c.plu && String(c.plu).toLowerCase() === ql)
        })
        if (!target) {
          target = this.allCommodities.find(function (c) {
            return (c.code && String(c.code).toLowerCase().indexOf(ql) >= 0) ||
                   (c.plu && String(c.plu).toLowerCase().indexOf(ql) >= 0) ||
                   (c.name && c.name.toLowerCase().indexOf(ql) >= 0)
          })
        }
      }
      if (!target) {
        this.$message({ type: 'warning', message: '找不到此貨品的所屬分類' })
        return
      }
      var catId = target.categoryId ? String(target.categoryId) : ''
      if (!catId && target.category) {
        var byName = this.allFlatCategories.find(function (c) { return c.cName === target.category })
        if (byName) catId = String(byName._id)
      }
      if (!catId) {
        this.$message({ type: 'warning', message: '找不到此貨品的所屬分類' })
        return
      }
      this.selectCategoryInTree(catId)
    },
    selectCategoryInTree: function (catId) {
      this.treeSearch = ''
      var self = this
      this.$nextTick(function () {
        var cat = self.allFlatCategories.find(function (c) { return String(c._id) === catId })
        var tree = self.$refs.catTree
        if (tree) {
          tree.setCurrentKey(catId)
          var node = tree.getNode(catId)
          var cur = node && node.parent
          while (cur) {
            cur.expand()
            cur = cur.parent
          }
        }
        if (cat) self.selectNode(cat)
      })
    },
    openPicker: function () {
      this.pickerSearch = ''
      this.loadAllCommodities()
      this.pickerVisible = true
    },
    addCommodity: function (item) {
      var self = this
      this.$axios.post('/api/category/' + this.selectedCategory._id + '/addItem', { targetType: 'commodity', targetId: item._id }).then(function () {
        self.$message.success('已將「' + item.name + '」加入分類')
        self.loadMixedItems(self.selectedCategory._id)
      }).catch(function (err) {
        self.$message.error((err.response && err.response.data) || '添加失敗')
      })
    },
    removeCommodity: function (idx, item) {
      var self = this
      this.$confirm('確認將「' + item.name + '」從此分類移除？', '提示', { type: 'warning' }).then(function () {
        self.$axios.post('/api/category/' + self.selectedCategory._id + '/removeItem', { targetId: item._id, targetType: 'commodity' }).then(function () {
          self.$message.success('已移除')
          self.loadMixedItems(self.selectedCategory._id)
        }).catch(function () {
          self.$message.error('移除失敗')
        })
      }).catch(function () {})
    },
    moveUp: function (idx) {
      this.mixedMoveUp(idx)
    },
    moveDown: function (idx) {
      this.mixedMoveDown(idx)
    },
    onDragStart: function (e, idx) {
      this.onMixedDragStart(e, idx)
    },
    onDragOver: function (e, idx) {
      this.onMixedDragOver(e, idx)
    },
    onDragEnd: function () {
      this.onMixedDragEnd()
    },
    loadDetailCombos: function (id) {
      var self = this
      this.$axios.get('/api/category/' + id + '/combos').then(function (res) {
        self.detailCombos = res.data || []
      }).catch(function () {
        self.detailCombos = []
      })
    },
    openComboPicker: function () {
      this.comboPickerSearch = ''
      this.loadAllCombos()
      this.comboPickerVisible = true
    },
    addCombo: function (item) {
      var self = this
      this.$axios.post('/api/category/' + this.selectedCategory._id + '/addItem', { targetType: 'combo', targetId: item._id }).then(function () {
        self.$message.success('已將「' + item.name + '」加入分類')
        self.loadMixedItems(self.selectedCategory._id)
      }).catch(function (err) {
        self.$message.error((err.response && err.response.data) || '添加失敗')
      })
    },
    removeCombo: function (idx, item) {
      var self = this
      this.$confirm('確認將「' + item.name + '」從此分類移除？', '提示', { type: 'warning' }).then(function () {
        self.$axios.post('/api/category/' + self.selectedCategory._id + '/removeItem', { targetId: item._id, targetType: 'combo' }).then(function () {
          self.$message.success('已移除')
          self.loadMixedItems(self.selectedCategory._id)
        }).catch(function () {
          self.$message.error('移除失敗')
        })
      }).catch(function () {})
    },
    saveOrder: function () {
      this.saveMixedOrder()
    },
    loadAllCombos: function () {
      var self = this
      this.$axios.get('/api/combo/all').then(function (res) {
        self.allCombos = res.data || []
      }).catch(function () {
        self.allCombos = []
      })
    },
    // 改碼相關方法
    loadAllModCategories: function () {
      var self = this
      this.$axios.get('/api/modcode/categories').then(function (res) {
        self.allModCategories = res.data || []
      }).catch(function () {
        self.allModCategories = []
      })
    },
    loadAllModCodes: function () {
      var self = this
      this.$axios.get('/api/modcode/all').then(function (res) {
        self.allModCodes = res.data || []
      }).catch(function () {
        self.allModCodes = []
      })
    },
    modCountByCategory: function (catName) {
      return this.allModCodes.filter(function (m) { return m.category === catName }).length
    },
    openModCatPicker: function () {
      this.modCatPickerSearch = ''
      this.loadAllModCategories()
      this.loadAllModCodes()
      this.modCatPickerVisible = true
    },
    addModCatToCategory: function (mc) {
      var self = this
      this.$axios.post('/api/category/' + this.selectedCategory._id + '/addItem', { targetType: 'modcodecategory', targetId: mc._id }).then(function () {
        self.$message.success('已將改碼類別「' + mc.name + '」加入分類')
        self.modCatPickerVisible = false
        self.loadMixedItems(self.selectedCategory._id)
      }).catch(function (err) {
        self.$message.error((err.response && err.response.data) || '添加失敗')
      })
    },
    openModCodePicker: function () {
      this.modCodePickerSearch = ''
      this.loadAllModCodes()
      this.modCodePickerVisible = true
    },
    addModCodeToCategory: function (m) {
      var self = this
      this.$axios.post('/api/category/' + this.selectedCategory._id + '/addItem', { targetType: 'modcode', targetId: m._id }).then(function () {
        self.$message.success('已將改碼「' + m.name + '」加入分類')
        self.modCodePickerVisible = false
        self.loadMixedItems(self.selectedCategory._id)
      }).catch(function (err) {
        self.$message.error((err.response && err.response.data) || '添加失敗')
      })
    },
    itemTypeIcon: function (item) {
      if (item._itemType === 'category') return 'el-icon-folder'
      if (item._itemType === 'combo') return 'el-icon-goods'
      if (item._itemType === 'modcode') return 'el-icon-edit-outline'
      if (item._itemType === 'modcodecategory') return 'el-icon-price-tag'
      return 'el-icon-dish'
    },
    getSiblings: function (node) {
      var pid = node.parentId ? String(node.parentId) : null
      return this.allFlatCategories.filter(function (c) {
        var cpid = c.parentId ? String(c.parentId) : null
        return cpid === pid
      }).sort(function (a, b) {
        return (a.no - b.no) || (String(a._id) < String(b._id) ? -1 : 1)
      })
    },
    moveSibling: function (node, dir) {
      var self = this
      var siblings = this.getSiblings(node)
      var idx = -1
      siblings.forEach(function (s, i) { if (String(s._id) === String(node._id)) idx = i })
      if (idx < 0) return
      var target = siblings[idx + dir]
      if (!target) return
      this.$axios.post('/api/category/swapOrder', { id1: node._id, id2: target._id }).then(function () {
        self.loadTree()
        self.loadFlat()
      }).catch(function (err) {
        self.$message.error((err.response && err.response.data) || '排序更新失敗')
        self.loadTree()
        self.loadFlat()
      })
    },
    toggleActive: function (row) {
      var self = this
      this.$axios.post('/api/category/edit', { _id: row._id, active: !row.active }).then(function () {
        self.$message.success(row.active ? '已停用' : '已啟用')
        self.loadTree()
        self.loadFlat()
      }).catch(function (err) {
        self.$message.error((err.response && err.response.data) || '更新失敗')
      })
    },
    allowDrag: function (draggingNode) {
      return true
    },
    allowDrop: function (draggingNode, dropNode, type) {
      return true
    },
    onNodeDrop: function (draggingNode, dropNode, dropType, ev) {
      var self = this
      var draggedId = draggingNode.data._id
      var newParentId = null
      if (dropType === 'inner') {
        newParentId = dropNode.data._id
      } else if (dropNode.data.parentId) {
        newParentId = dropNode.data.parentId
      } else {
        newParentId = null
      }
      if (draggedId === newParentId) return
      this.$axios.post('/api/category/move', { id: draggedId, newParentId: newParentId }).then(function (res) {
        self.$message.success(res.data)
        self.loadTree()
        self.loadFlat()
      }).catch(function (err) {
        self.$message.error((err.response && err.response.data) || '搬移失敗')
        self.loadTree()
        self.loadFlat()
      })
    },
    onRightTabChange: function (tab) {
      if (tab === 'pos') this.initPosPreview()
    },
    initPosPreview: function () {
      if (!this.posPreviewTopCats.length) {
        this.posPreviewActiveId = ''
        this.posPreviewItems = []
        return
      }
      if (!this.posPreviewActiveId || !this.posCatById[String(this.posPreviewActiveId)]) {
        var first = this.posPreviewTopCats[0]
        this.posPreviewActiveId = String(first._id)
        this.loadPosPreviewItems(first._id)
      } else if (!this.posPreviewItems.length) {
        this.loadPosPreviewItems(this.posPreviewActiveId)
      }
    },
    posDrill: function (cat) {
      if (!cat) return
      this.posPreviewActiveId = String(cat._id)
      this.loadPosPreviewItems(cat._id)
    },
    posGoBack: function () {
      var cat = this.posPreviewActiveCat
      if (!cat || !cat.parentId) return
      this.posPreviewActiveId = String(cat.parentId)
      this.loadPosPreviewItems(cat.parentId)
    },
    loadPosPreviewItems: function (id) {
      var self = this
      this.$axios.get('/api/category/' + id + '/items').then(function (res) {
        self.posPreviewItems = res.data || []
      }).catch(function () {
        self.posPreviewItems = []
      })
    },
    posPillStyle: function (cat) {
      var colorFrom = cat && cat.colorFrom
      var colorTo = cat && cat.colorTo
      if (colorFrom && colorTo) {
        return {
          background: 'linear-gradient(145deg, #fff, ' + colorFrom + ')',
          borderColor: colorTo,
          color: '#1e293b'
        }
      }
      return {
        background: 'linear-gradient(145deg, #f8fbff, #dbe7f5)',
        borderColor: '#b9cde5',
        color: '#334155'
      }
    },
    posTileStyle: function (cat) {
      var colorFrom = cat && cat.colorFrom
      var colorTo = cat && cat.colorTo
      var textColor = (cat && cat.textColor) || '#ffffff'
      if (colorFrom && colorTo) {
        return {
          background: 'linear-gradient(145deg, ' + colorFrom + ', ' + colorTo + ')',
          borderColor: colorTo,
          color: textColor
        }
      }
      return {
        background: 'linear-gradient(145deg, #64748b, #475569)',
        borderColor: '#475569',
        color: '#ffffff'
      }
    }
  },
  created: function () {
    this.loadTree()
    this.loadFlat()
    this.loadDepartments()
    this.loadAllModCategories()
    this.loadAllModCodes()
    this.loadAllCommodities()
  }
}
</script>

<style scoped>
#category { height: 100%; }
.split-layout { display: flex; height: 100%; gap: 12px; }
.tree-panel { width: 280px; min-width: 240px; flex-shrink: 0; display: flex; flex-direction: column; border: 1px solid #EBEEF5; border-radius: 6px; background: #fff; }
.tree-toolbar { padding: 12px; border-bottom: 1px solid #EBEEF5; }
.tree-scroll { flex: 1; overflow-y: auto; padding: 8px 0; }
.tree-node { flex: 1; display: flex; align-items: center; justify-content: space-between; font-size: 13px; padding-right: 8px; }
.tree-node-label { display: flex; align-items: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-code { font-size: 11px; color: #909399; margin-right: 4px; font-family: Menlo, Monaco, Consolas, monospace; flex-shrink: 0; }
.tree-node-actions { display: none; flex-shrink: 0; margin-left: 4px; }
.tree-node:hover .tree-node-actions { display: inline-flex; }
.tree-node-actions .el-button { padding: 2px; margin-left: 1px; }
.content-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; border: 1px solid #EBEEF5; border-radius: 6px; background: #fff; padding: 16px; overflow-y: auto; }
.content-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.breadcrumb { display: flex; align-items: center; font-size: 14px; }
.crumb-link { color: #409EFF; cursor: pointer; }
.crumb-link:hover { text-decoration: underline; }
.crumb-sep { color: #c0c4cc; margin: 0 2px; }
.content-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.cat-info { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; padding: 10px 12px; background: #F5F7FA; border-radius: 4px; }
.info-text { font-size: 12px; color: #606266; }
.content-section { margin-bottom: 16px; }
.section-title { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.btn-shadow { box-shadow: 0px 0px 20px rgba(53, 141, 230, 0.562); }
.field-tip { margin-top: 4px; color: #909399; font-size: 12px; }
.color-row { display: flex; gap: 20px; flex-wrap: wrap; }
.color-item { display: flex; align-items: center; gap: 8px; }
.color-label { font-size: 13px; color: #606266; font-weight: 600; white-space: nowrap; }
.color-val { font-size: 12px; color: #909399; }
.color-preview { margin-top: 8px; }
.remove-btn { color: #F56C6C !important; }
.empty-tip { text-align: center; color: #c0c4cc; padding: 20px 0; font-size: 13px; }
.empty-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.depth-warning { padding: 8px 12px; background: #FDF6EC; border: 1px solid #E6A23C; border-radius: 4px; color: #E6A23C; font-size: 13px; margin-bottom: 12px; }
.depth-warning i { margin-right: 4px; }
.section-tip { font-size: 12px; font-weight: normal; color: #909399; margin-left: 8px; }
.item-type-icon { width: 32px; height: 32px; border-radius: 4px; display: flex; align-items: center; justify-content: center; margin: 0 6px; flex-shrink: 0; font-size: 16px; }
.type-category { background: #FDF6EC; color: #E6A23C; }
.type-commodity { background: #F0F9EB; color: #67C23A; }
.type-combo { background: #ECF5FF; color: #409EFF; }
.type-modcode { background: #FDF0F4; color: #F56C6C; }
.type-modcodecategory { background: #F5F0FB; color: #9B59B6; }
.item-info.clickable { cursor: pointer; }
.item-info.clickable:hover .item-name { color: #409EFF; text-decoration: underline; }
.et-row { display: flex; align-items: center; }
.et-sub { margin-top: 6px; margin-left: 38px; }
.et-time-row { display: flex; align-items: center; }
.et-time-label { font-size: 12px; color: #606266; margin-right: 6px; flex-shrink: 0; }
.et-dash { margin: 0 4px; }
.item-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.grid-card { width: 140px; padding: 16px 10px; border: 1px solid #EBEEF5; border-radius: 6px; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: all 0.2s; }
.grid-card:hover { border-color: #409EFF; background: #ECF5FF; }
.folder-card .card-name { margin-top: 8px; font-size: 13px; color: #303133; text-align: center; word-break: break-all; }
.folder-card .card-meta { font-size: 11px; color: #909399; margin-top: 4px; }
.commodity-list { max-height: 420px; overflow-y: auto; border: 1px solid #EBEEF5; border-radius: 4px; }
.commodity-item { display: flex; align-items: center; padding: 6px 10px; border-bottom: 1px solid #F2F6FC; cursor: grab; transition: background 0.15s; }
.commodity-item:hover { background: #F5F7FA; }
.commodity-item:last-child { border-bottom: none; }
.item-index { width: 28px; text-align: center; color: #909399; font-size: 12px; flex-shrink: 0; }
.item-img { width: 36px; height: 36px; border-radius: 4px; margin: 0 6px; object-fit: cover; flex-shrink: 0; }
.item-info { flex: 1; min-width: 0; }
.item-code { display: block; font-size: 11px; color: #909399; }
.item-name { display: block; font-size: 13px; color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-price { font-size: 12px; color: #E6A23C; }
.item-actions { flex-shrink: 0; display: flex; align-items: center; }
.item-actions .el-button { padding: 4px; margin-left: 2px; }
.picker-list { max-height: 360px; overflow-y: auto; }
.picker-item { display: flex; align-items: center; padding: 8px 10px; border-bottom: 1px solid #F2F6FC; cursor: pointer; transition: background 0.15s; }
.picker-item:hover { background: #ECF5FF; }
.picker-img { width: 40px; height: 40px; border-radius: 4px; margin-right: 10px; object-fit: cover; }
.picker-info { flex: 1; min-width: 0; }
.picker-name { display: block; font-size: 13px; color: #303133; }
.picker-cat { font-size: 12px; color: #909399; }
.picker-price { font-size: 13px; color: #E6A23C; flex-shrink: 0; }
.item-modcat-badge { display: inline-block; font-size: 10px; color: #909399; background: #F0F2F5; padding: 1px 6px; border-radius: 3px; margin-left: 4px; }
.modcat-list { display: flex; flex-direction: column; gap: 10px; }
.modcat-card { border: 1px solid #EBEEF5; border-radius: 6px; overflow: hidden; }
.modcat-header { display: flex; align-items: center; padding: 8px 12px; background: #F5F7FA; border-bottom: 1px solid #EBEEF5; }
.modcat-code { font-weight: 700; font-size: 13px; color: #409EFF; margin-right: 6px; }
.modcat-name { font-size: 13px; font-weight: 600; color: #303133; flex: 1; }
.modcat-items { padding: 6px 12px; max-height: 160px; overflow-y: auto; }
.modcat-item { display: inline-flex; align-items: center; padding: 3px 8px; margin: 2px 4px 2px 0; border: 1px solid #DCDFE6; border-radius: 12px; font-size: 12px; background: #fff; }
.mod-item-code { font-weight: 700; color: #409EFF; margin-right: 3px; }
.mod-item-name { color: #303133; }
.mod-item-price { color: #E6A23C; margin-left: 4px; font-weight: 600; }
.modcat-empty { color: #c0c4cc; font-size: 12px; padding: 4px 0; }
.content-tabs { padding-bottom: 12px; }
.pos-preview { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.pos-preview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.pos-preview-title { font-size: 14px; font-weight: 600; color: #303133; }
.pos-preview-hint { font-size: 12px; color: #909399; }
.pos-mock { flex: 1; min-height: 460px; border: 6px solid #1f2937; border-radius: 16px; background: #f5f7fa; display: flex; flex-direction: column; overflow: hidden; }
.pos-mock-brand { padding: 8px 12px; font-size: 13px; font-weight: 700; color: #fff; background: #1f2937; text-align: center; flex-shrink: 0; }
.pos-mock-pills { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px; background: #fff; border-bottom: 1px solid #ebeef5; max-height: 96px; overflow-y: auto; flex-shrink: 0; }
.pos-pill { padding: 0 14px; height: 34px; line-height: 32px; border: 1.5px solid #b9cde5; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; box-shadow: 0 1px 3px rgba(31,55,88,.08); }
.pos-pill.active { outline: 2px solid #409EFF; }
.pos-mock-crumb { padding: 6px 12px; font-size: 12px; color: #606266; background: #fff; border-bottom: 1px solid #ebeef5; flex-shrink: 0; }
.pos-crumb-link { color: #409EFF; cursor: pointer; }
.pos-crumb-link:hover { text-decoration: underline; }
.pos-crumb-sep { color: #c0c4cc; margin: 0 2px; }
.pos-mock-body { flex: 1; overflow-y: auto; padding: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; align-content: start; }
.pos-tile { display: flex; align-items: center; justify-content: space-between; padding: 0 10px; height: 44px; border: 1.5px solid #475569; border-radius: 8px; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; }
.pos-tile-arrow { font-size: 12px; }
.pos-back-tile { background: #eef1f6; border-color: #c0c4cc; color: #606266; justify-content: center; }
.pos-food { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 8px 10px; background: #fff; border: 1px solid #ebeef5; border-radius: 8px; font-size: 13px; }
.pos-food-name { color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pos-food-badge { display: inline-block; font-size: 10px; color: #F56C6C; background: #FDF0F4; padding: 1px 5px; border-radius: 3px; margin-left: 4px; }
.pos-food-price { color: #E6A23C; font-weight: 600; flex-shrink: 0; }
.pos-preview-empty { color: #c0c4cc; font-size: 12px; padding: 16px 0; text-align: center; grid-column: 1 / -1; }
</style>
