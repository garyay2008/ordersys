<template>
  <div id="pos">
    <!-- 登入視圖 -->
    <div v-if="!loggedIn" class="login-view">
      <div class="login-box">
        <!-- 頂部裝飾 -->
        <div class="login-header">
          <div class="login-icon">
            <i class="el-icon-sell"></i>
          </div>
          <div class="login-title">{{ shopName || 'POS 系統' }}</div>
          <div class="login-subtitle">{{ shopIntro || '員工點餐管理平台' }}</div>
        </div>

        <!-- 登入表單 -->
        <div class="login-form">
          <el-input v-model="loginNo" placeholder="員工編號" size="large" prefix-icon="el-icon-user" style="margin-bottom: 16px;"></el-input>
          <el-input v-model="loginPassword" type="password" placeholder="登入密碼" size="large" prefix-icon="el-icon-lock" show-password style="margin-bottom: 20px;" @keyup.enter.native="login"></el-input>
          <el-button type="primary" size="large" style="width: 100%; height: 48px; font-size: 16px; font-weight: 600; border-radius: 8px;" @click="login">
            <i class="el-icon-right"></i> 登 入
          </el-button>
        </div>

        <!-- 上班/下班按鈕 -->
        <div class="login-shift-section">
          <div class="shift-buttons">
            <el-button type="success" plain size="medium" class="shift-btn" @click="openClockIn">
              <i class="el-icon-sunrise-1"></i> 上班
            </el-button>
            <el-button type="danger" plain size="medium" class="shift-btn" @click="openClockOut">
              <i class="el-icon-switch-button"></i> 下班
            </el-button>
          </div>
        </div>

        <!-- 收銀機資訊 -->
        <div v-if="selectedTerminal" class="terminal-info">
          <i class="el-icon-monitor"></i> {{ selectedTerminal }}
        </div>
      </div>
    </div>

    <!-- 枱況圖視圖 -->
    <div v-else-if="view === 'board'" class="board-view">
      <div class="board-header">
        <div class="board-heading">
          <span class="board-title">{{ shopName || '枱況圖' }}</span>
          <span class="board-legend">
            <span class="legend"><i class="dot free"></i>空枱</span>
            <span class="legend"><i class="dot busy"></i>用餐中</span>
            <span class="legend"><i class="dot qr"></i>使用中</span>
            <span class="legend"><i class="dot printed"></i>已印單</span>
          </span>
        </div>
        <div class="board-right">
          <el-button size="small" type="info" plain icon="el-icon-data-line" @click="openDayReport">每日結算</el-button>
          <span class="staff-name"><i class="el-icon-user"></i> {{ staffInfo.name }} · {{ levelLabel(staffInfo.permissionLevel) }}</span>
          <span v-if="selectedTerminal" class="terminal-badge"><i class="el-icon-monitor"></i> {{ selectedTerminal }}</span>
          <span class="current-time header-time"><i class="el-icon-time"></i> {{ currentTime }}</span>
        </div>
      </div>
      <div class="board-body">
        <div class="board-main">
          <div v-if="boardMode === 'grid'" class="floor-canvas" :style="boardCanvasStyle">
            <div v-for="(t, i) in boardTables" :key="t._id" class="board-card floor-card" :class="boardClass(t.no)" :style="Object.assign({ height: boardCardHeight + 'px', width: (boardCardWidth || 200) + 'px' }, floorStyle(t, i))"
                 @mousedown="onBoardMouseDown(t, $event)" @click="onBoardClick(t)">
              <div v-if="!layoutMode && isTransferred(t.no)" class="bc-transfer">轉</div>
              <div class="bc-topline"><span class="bc-seats"><i class="el-icon-user"></i> {{ t.seats }}位</span><i class="bc-status-icon" :class="boardClass(t.no)"></i></div>
              <div class="bc-no">{{ tableLabel(t) }}</div>
              <div class="bc-amount" v-if="tableAmount(t.no) > 0">${{ tableAmount(t.no) }}</div>
              <div class="bc-status">{{ boardStatus(t.no) }}</div>
              <div v-if="hasOrder(t.no)" class="bc-meta">{{ tableDuration(t.no) }}</div>
            </div>
          </div>
          <div v-else-if="boardMode === 'list'" class="table-list-view">
        <div class="list-hero">
          <div class="list-hero-stats">
            <span class="stat-item"><i class="dot free"></i> 空枱 {{ tableRows.filter(r => r.status === '空枱').length }}</span>
            <span class="stat-item"><i class="dot busy"></i> 用餐中 {{ tableRows.filter(r => r.status === '用餐中').length }}</span>
            <span class="stat-item"><i class="dot qr"></i> 使用中 {{ tableRows.filter(r => r.status === '使用中').length }}</span>
            <span class="stat-item"><i class="dot relisted"></i> 退單 {{ tableRows.filter(r => r.status === '退單').length }}</span>
            <span class="stat-item"><i class="dot printed"></i> 已印單 {{ tableRows.filter(r => r.status === '已印單').length }}</span>
          </div>
        </div>
        <div class="list-filter-row">
          <el-select v-model="tableListStatus" size="small" style="width: 130px;"><el-option label="全部狀態" value="all"></el-option><el-option label="空枱" value="free"></el-option><el-option label="用餐中" value="active"></el-option><el-option label="使用中" value="qr"></el-option><el-option label="已印單" value="printed"></el-option></el-select>
          <el-select v-model="tableListSort" size="small" style="width: 150px;"><el-option label="依枱號排序" value="table"></el-option><el-option label="依入座時間" value="time"></el-option><el-option label="依當前消費" value="amount"></el-option></el-select>
          <el-input v-model="tableListKeyword" size="small" clearable placeholder="輸入枱號或客名" prefix-icon="el-icon-search" style="width: 220px;"></el-input>
          <span class="list-count">共 {{ tableListRows.length }} 枱</span>
        </div>
        <el-table :data="tableListRows" stripe size="small" height="calc(100vh - 290px)" :row-class-name="tableRowClass" @row-click="onTableRowClick">
          <el-table-column prop="label" label="枱號" width="100"><template slot-scope="scope"><span class="list-table-no">{{ scope.row.label }}</span></template></el-table-column>
          <el-table-column prop="zone" label="區域" width="110"></el-table-column>
          <el-table-column label="狀態" width="120"><template slot-scope="scope"><span class="status-badge" :class="'sb-' + (scope.row.status === '空枱' ? 'free' : scope.row.status === '用餐中' ? 'busy' : scope.row.status === '使用中' ? 'qr' : 'relisted')">{{ scope.row.status }}</span></template></el-table-column>
          <el-table-column prop="seats" label="人數" width="70"></el-table-column>
          <el-table-column prop="openTime" label="開枱時間" width="140"></el-table-column>
          <el-table-column prop="duration" label="用餐時長" width="100"></el-table-column>
          <el-table-column prop="amount" label="消費" width="110"><template slot-scope="scope"><span class="list-amount">{{ scope.row.amount }}</span></template></el-table-column>
          <el-table-column prop="waiter" label="服務生" min-width="100"></el-table-column>
          <el-table-column label="操作" width="110"><template slot-scope="scope"><el-button size="mini" type="text" class="list-enter-btn" @click.stop="onTableRowClick(scope.row)">進入點餐</el-button></template></el-table-column>
        </el-table>
      </div>
      <div v-else-if="boardMode === 'history'" class="table-list-view">
        <div class="list-hero">
          <div class="list-hero-stats">
            <span class="stat-item"><i class="el-icon-document"></i> 共 {{ historyTotal }} 筆往日單據</span>
          </div>
        </div>
        <div class="list-filter-row">
          <el-date-picker v-model="historyDateRange" type="daterange" range-separator="至" start-placeholder="開始日期" end-placeholder="結束日期" value-format="yyyy-MM-dd" size="small" style="width: 280px;"></el-date-picker>
          <el-button size="small" type="primary" icon="el-icon-search" @click="historyPage = 1; loadHistoryOrders()">搜尋</el-button>
          <el-button size="small" icon="el-icon-refresh" @click="historyKeyword = ''; historyDateRange = []; historyPage = 1; loadHistoryOrders()">重置</el-button>
          <span class="list-count">第 {{ historyPage }} / {{ Math.max(1, Math.ceil(historyTotal / 20)) }} 頁</span>
        </div>
        <el-table :data="historyOrders" stripe size="small" height="calc(100vh - 310px)" v-loading="historyLoading">
          <el-table-column prop="orderNo" label="訂單號" width="185"></el-table-column>
          <el-table-column label="枱號" width="80">
            <template slot-scope="scope">{{ scope.row.deskNo || scope.row.zone || '—' }}</template>
          </el-table-column>
          <el-table-column label="品項" min-width="240">
            <template slot-scope="scope">
              <span v-for="(it, i) in (scope.row.order || []).slice(0, 4)" :key="i">{{ it.name }}×{{ it.count }}{{ historyItemSeparator(i, scope.row.order) }}</span>
              <span v-if="(scope.row.order || []).length > 4" style="color:#909399;">…等 {{ scope.row.order.length }} 項</span>
            </template>
          </el-table-column>
          <el-table-column prop="totalPrice" label="金額" width="100">
            <template slot-scope="scope"><span style="color:#dc2626;font-weight:800;">${{ scope.row.totalPrice }}</span></template>
          </el-table-column>
          <el-table-column label="付款" width="90">
            <template slot-scope="scope">{{ scope.row.payMethod || '—' }}</template>
          </el-table-column>
          <el-table-column label="日期時間" width="165">
            <template slot-scope="scope">{{ formatDate(scope.row.date) }}</template>
          </el-table-column>
          <el-table-column label="服務員" width="100">
            <template slot-scope="scope">{{ scope.row.waiter || '—' }}</template>
          </el-table-column>
          <el-table-column label="狀態" width="80">
            <template slot-scope="scope"><el-tag :type="scope.row.relisted ? 'warning' : 'success'" size="mini">{{ scope.row.relisted ? '退單' : '已完成' }}</el-tag></template>
          </el-table-column>
        </el-table>
        <div v-if="!historyOrders.length && !historyLoading" class="empty" style="padding:40px;">暫無往日單據</div>
        <div v-if="historyTotal > 20" style="display:flex;justify-content:center;gap:8px;margin-top:14px;">
          <el-button size="small" :disabled="historyPage <= 1" icon="el-icon-arrow-left" @click="historyPage--; loadHistoryOrders()">上一頁</el-button>
          <el-button size="small" :disabled="historyPage >= Math.ceil(historyTotal / 20)" @click="historyPage++; loadHistoryOrders()">下一頁<i class="el-icon-arrow-right"></i></el-button>
        </div>
      </div>
      <div v-else class="table-search-view">
        <div class="search-panel">
          <div class="search-hero">
            <i class="el-icon-search search-hero-icon"></i>
            <span class="search-hero-title">搜尋編號</span>
          </div>
          <el-input v-model="tableSearchKeyword" clearable autofocus placeholder="訂單編號或貨品編號" prefix-icon="el-icon-search" size="large" class="search-big-input"></el-input>
          <div class="quick-filter">
            <span class="qf-label">快速篩選：</span>
            <el-radio-group v-model="tableSearchStatus" size="small">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="free"><i class="el-icon-s-home"></i> 空枱</el-radio-button>
              <el-radio-button label="active"><i class="el-icon-dish"></i> 用餐中</el-radio-button>
              <el-radio-button label="qr"><i class="el-icon-mobile-phone"></i> 使用中</el-radio-button>
              <el-radio-button label="printed"><i class="el-icon-printer"></i> 已印單</el-radio-button>
            </el-radio-group>
          </div>
        </div>
        <div class="search-result-bar">
          <span class="search-result-title">搜尋結果</span>
          <span class="search-result-count">找到 {{ tableSearchRows.length }} 筆</span>
        </div>
        <el-table :data="tableSearchRows" stripe size="small" :row-class-name="tableRowClass" @row-click="onTableRowClick">
          <el-table-column label="狀態" width="120"><template slot-scope="scope"><span class="status-badge" :class="'sb-' + (scope.row.status === '空枱' ? 'free' : scope.row.status === '用餐中' ? 'busy' : scope.row.status === '使用中' ? 'qr' : scope.row.status === '已印單' ? 'printed' : 'relisted')">{{ scope.row.status }}</span></template></el-table-column>
          <el-table-column prop="seats" label="人數" width="80"></el-table-column>
          <el-table-column prop="amount" label="消費" width="120"><template slot-scope="scope"><span class="list-amount">{{ scope.row.amount }}</span></template></el-table-column>
          <el-table-column prop="waiter" label="服務生" width="120"></el-table-column>
          <el-table-column label="操作" width="130"><template slot-scope="scope"><el-button size="mini" type="primary" icon="el-icon-right" @click.stop="onTableRowClick(scope.row)">進入點餐</el-button></template></el-table-column>
        </el-table>
        <div class="search-help"><i class="el-icon-info"></i> 提示：支援輸入枱號、客人的姓氏拼音或手機尾號進行模糊搜尋</div>
      </div>
      <div v-if="false" class="board-footer">
        <el-button size="small" icon="el-icon-refresh" @click="refreshBoard">重新整理</el-button>
        <el-button size="small" type="primary" icon="el-icon-plus" @click="boardAction('addTable')">快速開枱</el-button>
        <el-button size="small" icon="el-icon-printer" @click="boardAction('print')">批量列印</el-button>
        <el-button size="small" icon="el-icon-data-analysis" @click="boardAction('report')">導出報表</el-button>
      </div>
      </div>
      <div class="board-sidebar-right" :style="{ width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px', fontSize: sidebarFontSize + 'px' }">
        <template v-for="(btn, si) in sidebarButtons">
          <button v-if="btn.visible" :key="si" class="sb-btn" :class="{ active: sbActiveClass(btn.actionId) }" :style="{ background: btn.bgColor || '', color: btn.textColor || '' }" @click="sbClick(btn.actionId)"><i :class="btn.icon"></i><span>{{ btn.label }}</span></button>
        </template>
        <div class="sidebar-spacer-right"></div>
        <button class="sb-btn bottom" style="color:#ef4444;" @click="logout"><i class="el-icon-switch-button"></i><span>登出</span></button>
      </div>
    </div>
    </div>

    <!-- 點餐視圖 -->
    <template v-if="view === 'order'">
      <!-- 側欄式（參考圖） -->
      <div v-if="orderLayout === 'sidebar'" class="order-layout" ref="orderLayout" :class="{ free: freeMode }" :style="themeVars">
            <div class="order-ticket" ref="orderTicket" :style="[ticketWidthStyle, panelStyle('ticket'), panelColorStyle('ticket')]">
              <div class="ot-head" :style="panelColorStyle('ticketHead')">
                <div class="ot-head-left">
                  <el-button class="head-back" @mousedown.stop @click="backToBoard"><i class="el-icon-arrow-left"></i> 返回枱號</el-button>
                  <div class="ot-staff-tag"><i class="el-icon-user"></i> {{ staffInfo.name }}</div>
                </div>
                <div class="ot-controls" @mousedown.stop>
                  <div class="ot-field">
                    <div class="ot-cap">區域</div>
                    <el-select v-model="selectedZone" size="small" style="width: 92px;" @change="loadMenu">
                      <el-option v-for="z in zones" :key="z._id" :label="z.name" :value="z.name"></el-option>
                    </el-select>
                  </div>
                  <div class="ot-sep"></div>
                  <template v-if="isDineIn">
                    <div class="ot-field">
                      <div class="ot-cap">枱號</div>
                      <div class="ot-big-num" @click="openTableKeypad">{{ selectedTableLabel }}<i class="el-icon-edit-outline ot-edit-icon"></i></div>
                    </div>
                    <div class="ot-sep"></div>
                    <div class="ot-field">
                      <div class="ot-cap">人數</div>
                      <div class="ot-big-num" @click="openPaxKeypad">{{ pax }}<span class="ot-big-unit">位</span><i class="el-icon-edit-outline ot-edit-icon"></i></div>
                    </div>
                  </template>
                  <template v-else>
                    <div class="ot-field">
                      <div class="ot-cap">訂單</div>
                      <div class="ot-big-num ot-takeaway-label">外賣</div>
                    </div>
                  </template>
                </div>
              </div>
              <div v-if="pendingItemDiscount" class="disc-mode-bar">項目折扣模式：點選品項套用折扣（{{ pendingItemDiscount.free ? '贈送' : (pendingItemDiscount.pct ? '折 ' + pendingItemDiscount.pct + '%' : '折 $' + pendingItemDiscount.amount) }}）</div>
              <div class="order-list" ref="orderList">
                <div v-for="(item, index) in cart" :key="index" class="order-row" :class="{ 'order-row-sent': item.sent, 'order-row-called': item.dishStatus === 'called', 'order-row-swiped': swipeIndex === index }"
                     @touchstart="onSwipeStart(index, $event)" @touchmove="onSwipeMove(index, $event)" @touchend="onSwipeEnd(index, $event)">
                  <div class="or-main" :style="swipeStyle(index)">
                    <span class="or-name" :class="{ 'or-locked': item.sent }" @click="item.sent ? null : (pendingItemDiscount ? applyItemDiscount(index) : editItemMods(index))">{{ index + 1 }}. {{ item.name }}<span v-if="item.free" class="tag-free">贈</span><span v-if="item.discount < 1" class="tag-disc">{{ Math.round(item.discount * 100) }}折</span><span v-if="item.dishStatus === 'called'" :style="{ color: calledTagStyle.color, background: calledTagStyle.background, border: '1px solid ' + calledTagStyle.border }" class="tag-called">叫起</span></span>
                    <template v-if="!item.sent">
                      <span class="or-qty">
                        <el-button size="medium" circle icon="el-icon-minus" class="qty-btn" @click="changeQty(index, -1)" @mousedown.native="startQtyHold(index, -1)" @mouseup.native="stopQtyHold" @mouseleave.native="stopQtyHold" style="width: 40px; height: 40px; font-size: 18px; min-width: 40px; min-height: 40px;"></el-button>
                        <span class="qty-num" @click="openQtyPad(index)">{{ item.count }}</span>
                        <el-button size="medium" circle icon="el-icon-plus" class="qty-btn" @click="changeQty(index, 1)" @mousedown.native="startQtyHold(index, 1)" @mouseup.native="stopQtyHold" @mouseleave.native="stopQtyHold" style="width: 40px; height: 40px; font-size: 18px; min-width: 40px; min-height: 40px;"></el-button>
                      </span>
                      <span class="or-price">${{ item.unitPrice }}</span>
                      <span class="or-sub">${{ item.subtotal }}</span>
                    </template>
                  </div>
                  <div class="or-delete" @click="cancelItem(index)"><i class="el-icon-delete"></i></div>
                  <div class="or-remark" v-if="!item.sent && item.mods && item.mods.length" @click="editItemMods(index)">
                    <span class="remark-label">改碼：</span>{{ modNames(item.mods).join('、') }}
                  </div>
                </div>
                <div v-if="!cart.length" class="empty">尚未點餐</div>
                <div v-if="cart.length > 0" class="order-page-btns">
                  <el-button size="mini" circle icon="el-icon-arrow-up" @click="scrollOrder(-1)"></el-button>
                  <el-button size="mini" circle icon="el-icon-arrow-down" @click="scrollOrder(1)"></el-button>
                </div>
              </div>
              <div class="order-footer">
                <div class="total-row right">
                  <span>小計：${{ totalPrice }}</span>
                </div>
                <div class="total-row right" v-if="serviceChargeEnabled">
                  <span>服務費 {{ serviceChargeRate }}%：<span class="sc-amount">${{ serviceChargeAmount }}</span></span>
                </div>
                <div class="total-row right" v-if="orderDiscount > 0">
                  <span>整單折扣：<span class="disc-amount">-${{ orderDiscount }}</span></span>
                </div>
                <div class="total">應付：<span class="total-num">${{ grandTotal }}</span></div>
              </div>
            </div>
        <!-- 左側 vertical keypad（0 / 123456789 / 數量 / PLU） -->
        <div v-if="showSideNav" class="side-nav" ref="sideNav" :style="[sideNavStyle, panelStyle('sideNav'), sideNavColorStyle()]">
          <div class="resizer-sn" title="拖動調整闊度"></div>
          <div class="side-keypad">
            <div class="pad-col">
              <div class="pad-key" @click="padPress('0')">0</div>
              <div v-for="n in ['1', '2', '3', '4', '5', '6', '7', '8', '9']" :key="n" class="pad-key" @click="padPress(n)">{{ n }}</div>
            </div>
          </div>
          <div class="side-item pad-btn active" title="撳掣開數量鍵盤" @click="sideQtyPad">數量</div>
          <div class="side-item pad-btn" @click="sideOpenPlu">PLU</div>
        </div>

        <div class="order-main">
          <div class="order-body">
            <div class="food-column">
              <!-- 中間：食品九宮格 -->
              <div class="food-zone" ref="foodZone" :style="[panelStyle('foodZone'), panelColorStyle('foodZone')]">
              <div class="food-top-row">
                <div class="cat-scroll">
                  <div v-for="c in categories" :key="c" class="cat-pill" :class="{ active: activeCategory === c }" :style="catPillStyle(c)" @click="activeCategory = c">{{ c }}<span v-if="slotBadge(c)" class="pill-slot">{{ slotBadge(c) }}</span></div>
                  <div class="cat-pill" :class="{ active: activeCategory === '__combo__' }" @click="activeCategory = '__combo__'">套餐</div>
                </div>
              </div>
              <div class="food-grids" ref="foodGrids">
                <div v-if="activeCategory !== '__combo__'" class="food-grid food-grid-fix">
                  <div v-for="food in activeFoods" :key="food._id" class="food-wrap">
                    <div class="food-btn" :class="{ 'food-soldout': food.soldOut, 'food-no-img': !showFoodImages }" :style="foodBtnStyle()" @click="addFood(food)">
                      <img v-if="food.img && showFoodImages" :src="food.img" class="food-img">
                      <div class="food-text">
                        <div class="food-plu" v-if="!showFoodImages && food.plu">{{ food.plu }}</div>
                        <div class="food-name">{{ food.name }}<span v-if="food.slotName" class="food-tier-tag">{{ food.slotName }}價</span><span v-if="food.soldOut" class="food-soldout-tag">沽清</span></div>
                        <div class="food-price">${{ food.price }}</div>
                        <div class="food-stock" v-if="food.stock >= 0 && !food.soldOut">剩餘 {{ food.stock }} 份</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="activeCategory === '__combo__'" class="food-grid food-grid-fix">
                  <div v-for="combo in combos" :key="combo._id" class="food-btn combo-btn" :class="{ 'food-soldout': combo.soldOut, 'food-no-img': !showFoodImages }" @click="openComboPicker(combo)">
                    <img v-if="combo.img && showFoodImages" :src="combo.img" class="food-img combo-img">
                    <div class="food-text">
                      <div class="food-name">{{ combo.name }}<span v-if="combo.soldOut" class="food-soldout-tag">售罄</span></div>
                      <div class="food-price">${{ combo.price }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

              <div class="resizer-h" title="拖動調整底部操作區高度"></div>

              <!-- 底部功能 dock（同食品區同闊度） -->
              <div class="action-dock" ref="actionDock" :style="[dockHeightStyle, panelStyle('dock')]">
                <div class="dock-left" ref="dockLeft" :style="[dockMinHStyle(), dockLeftColorStyle()]">
                  <div class="bb-rows">
                    <div class="bb-row" v-for="(row, ri) in dockRows" :key="ri">
                      <div v-for="b in row" :key="b.id" class="btn-wrap" :data-btn="b.id">
                        <el-button :type="btnType(b) || 'default'" :style="btnStyle2(b)" size="medium" :class="bbClass(b.id)" :disabled="btnDisabled(b)" @click="runAction(b.id)">{{ btnLabel(b) }}</el-button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

        </div>
      </div>
      </div>

      <!-- 傳統式（經典三區版面） -->
      <div v-if="orderLayout !== 'sidebar'" class="classic-layout">
        <div class="top-bar">
          <div class="ot-head-left">
            <el-button class="head-back" @click="backToBoard"><i class="el-icon-arrow-left"></i> 返回枱號</el-button>
            <div class="ot-staff-tag classic-staff"><i class="el-icon-user"></i> {{ staffInfo.name }}</div>
          </div>
          <div class="ot-controls" style="gap:8px;">
            <div class="ot-field">
              <div class="ot-cap" style="color:#606266;">區域</div>
              <el-select v-model="selectedZone" size="small" style="width: 92px;" @change="loadMenu">
                <el-option v-for="z in zones" :key="z._id" :label="z.name" :value="z.name"></el-option>
              </el-select>
            </div>
            <div class="ot-sep" style="background:#e2e8f0;"></div>
            <template v-if="isDineIn">
              <div class="ot-field">
                <div class="ot-cap" style="color:#606266;">枱號</div>
                <div class="ot-big-num classic-num" @click="openTableKeypad">{{ selectedTableLabel }}<i class="el-icon-edit-outline ot-edit-icon"></i></div>
              </div>
              <div class="ot-sep" style="background:#e2e8f0;"></div>
              <div class="ot-field">
                <div class="ot-cap" style="color:#606266;">人數</div>
                <div class="ot-big-num classic-num" @click="openPaxKeypad">{{ pax }}<span class="ot-big-unit">位</span><i class="el-icon-edit-outline ot-edit-icon"></i></div>
              </div>
            </template>
            <template v-else>
              <div class="ot-field">
                <div class="ot-cap" style="color:#606266;">訂單</div>
                <div class="ot-big-num classic-num ot-takeaway-label">外賣</div>
              </div>
            </template>
          </div>
        </div>

        <div class="main">
          <div class="left-panel" :style="panelColorStyle('ticket')">
            <div v-if="pendingItemDiscount" class="disc-mode-bar">項目折扣模式：點選品項套用折扣（{{ pendingItemDiscount.free ? '贈送' : (pendingItemDiscount.pct ? '折 ' + pendingItemDiscount.pct + '%' : '折 $' + pendingItemDiscount.amount) }}）</div>
            <div class="order-head">
              <span class="oh-name">品項</span>
              <span class="oh-qty">數量</span>
              <span class="oh-price">單價</span>
              <span class="oh-sub">小計</span>
            </div>
            <div class="order-list" ref="orderList">
              <div v-for="(item, index) in cart" :key="index" class="order-row" :class="{ 'order-row-sent': item.sent, 'order-row-called': item.dishStatus === 'called', 'order-row-swiped': swipeIndex === index }"
                   @touchstart="onSwipeStart(index, $event)" @touchmove="onSwipeMove(index, $event)" @touchend="onSwipeEnd(index, $event)">
                <div class="or-main" :style="swipeStyle(index)">
                  <span class="or-name" :class="{ 'or-locked': item.sent }" @click="item.sent ? null : (pendingItemDiscount ? applyItemDiscount(index) : editItemMods(index))">{{ index + 1 }}. {{ item.name }}<span v-if="item.free" class="tag-free">贈</span><span v-if="item.discount < 1" class="tag-disc">{{ Math.round(item.discount * 100) }}折</span><span v-if="item.dishStatus === 'called'" :style="{ color: calledTagStyle.color, background: calledTagStyle.background, border: '1px solid ' + calledTagStyle.border }" class="tag-called">叫起</span></span>
                  <template v-if="!item.sent">
                    <span class="or-qty">
                      <el-button size="medium" circle icon="el-icon-minus" class="qty-btn" @click="changeQty(index, -1)" @mousedown.native="startQtyHold(index, -1)" @mouseup.native="stopQtyHold" @mouseleave.native="stopQtyHold" style="width: 40px; height: 40px; font-size: 18px; min-width: 40px; min-height: 40px;"></el-button>
                      <span class="qty-num" @click="openQtyPad(index)">{{ item.count }}</span>
                      <el-button size="medium" circle icon="el-icon-plus" class="qty-btn" @click="changeQty(index, 1)" @mousedown.native="startQtyHold(index, 1)" @mouseup.native="stopQtyHold" @mouseleave.native="stopQtyHold" style="width: 40px; height: 40px; font-size: 18px; min-width: 40px; min-height: 40px;"></el-button>
                    </span>
                    <span class="or-price">${{ item.unitPrice }}</span>
                    <span class="or-sub">${{ item.subtotal }}</span>
                  </template>
                </div>
                <div class="or-delete" @click="cancelItem(index)"><i class="el-icon-delete"></i></div>
                <div class="or-remark" v-if="!item.sent && item.mods && item.mods.length" @click="editItemMods(index)">
                  <span class="remark-label">改碼：</span>{{ modNames(item.mods).join('、') }}
                </div>
              </div>
              <div v-if="!cart.length" class="empty">尚未點餐</div>
            </div>
            <div class="order-footer">
              <div class="total-row right">
                <span>小計：${{ totalPrice }}</span>
              </div>
              <div class="total-row right" v-if="serviceChargeEnabled">
                <span>服務費 {{ serviceChargeRate }}%：<span class="sc-amount">${{ serviceChargeAmount }}</span></span>
              </div>
              <div class="total-row right" v-if="orderDiscount > 0">
                <span>整單折扣：<span class="disc-amount">-${{ orderDiscount }}</span></span>
              </div>
              <div class="total">應付：<span class="total-num">${{ grandTotal }}</span></div>
            </div>
          </div>

          <div class="right-panel">
            <div class="cat-scroll">
              <div v-for="c in categories" :key="c" class="cat-pill" :class="{ active: activeCategory === c }" :style="catPillStyle(c)" @click="activeCategory = c">{{ c }}<span v-if="slotBadge(c)" class="pill-slot">{{ slotBadge(c) }}</span></div>
              <div class="cat-pill" :class="{ active: activeCategory === '__combo__' }" @click="activeCategory = '__combo__'">套餐</div>
            </div>
            <div v-if="activeCategory !== '__combo__'" class="food-grid food-grid-fix">
              <div v-for="food in activeFoods" :key="food._id" class="food-btn" :class="{ 'food-soldout': food.soldOut, 'food-no-img': !showFoodImages }" :style="foodBtnStyle()" @click="addFood(food)">
                <img v-if="food.img && showFoodImages" :src="food.img" class="food-img">
                <div class="food-text">
                  <div class="food-plu" v-if="!showFoodImages && food.plu">{{ food.plu }}</div>
                  <div class="food-name">{{ food.name }}<span v-if="food.slotName" class="food-tier-tag">{{ food.slotName }}價</span><span v-if="food.soldOut" class="food-soldout-tag">沽清</span></div>
                  <div class="food-price">${{ food.price }}</div>
                  <div class="food-stock" v-if="food.stock >= 0 && !food.soldOut">剩餘 {{ food.stock }} 份</div>
                </div>
              </div>
            </div>
            <div v-if="activeCategory === '__combo__'" class="food-grid food-grid-fix">
              <div v-for="combo in combos" :key="combo._id" class="food-btn combo-btn" :class="{ 'food-soldout': combo.soldOut, 'food-no-img': !showFoodImages }" @click="openComboPicker(combo)">
                <img v-if="combo.img && showFoodImages" :src="combo.img" class="food-img combo-img">
                <div class="food-text">
                  <div class="food-name">{{ combo.name }}<span v-if="combo.soldOut" class="food-soldout-tag">售罄</span></div>
                  <div class="food-price">${{ combo.price }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bottom-bar">
          <div class="bb-rows">
            <div class="bb-row" v-for="(row, ri) in buttonRows" :key="ri">
              <el-button v-for="b in row" :key="b.id" :type="btnType(b) || 'default'" :style="btnStyle2(b)" size="medium" :class="bbClass(b.id)" :disabled="btnDisabled(b)" @click="runAction(b.id)">{{ btnLabel(b) }}</el-button>
            </div>
            <div class="bb-row">
              <el-dropdown @command="moreCommand" trigger="click">
                <el-button size="medium">更多功能<i class="el-icon-arrow-up el-icon--right"></i></el-button>
                <el-dropdown-menu slot="dropdown">
                  <el-dropdown-item command="refund">更改已結帳單</el-dropdown-item>
                  <el-dropdown-item command="report">報表</el-dropdown-item>
                  <el-dropdown-item command="manager">經理功能</el-dropdown-item>
                  <el-dropdown-item command="addTable">加枱</el-dropdown-item>
                  <el-dropdown-item command="staff">員工權限</el-dropdown-item>
                </el-dropdown-menu>
              </el-dropdown>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 套餐選擇 -->
    <el-dialog :title="comboDialog.combo ? comboDialog.combo.name : '套餐選擇'" :visible.sync="comboDialog.show" width="620px" append-to-body>
      <div v-if="comboDialog.combo" class="combo-picker">
        <div v-for="(group, gi) in comboDialog.combo.groups" :key="gi" class="combo-group">
          <div class="combo-group-title">{{ group.name }} <span>選 {{ group.min || 0 }} 至 {{ group.max || 1 }} 項</span></div>
          <div class="combo-options">
            <el-button v-for="(item, ii) in group.items" :key="ii" size="small" :type="(comboDialog.selections[gi] || []).indexOf(ii) >= 0 ? 'primary' : 'default'" :disabled="group.fixed" @click="comboSelected(gi, ii)">
              {{ item.name }}<span v-if="item.upgradePrice > 0"> +${{ item.upgradePrice }}</span>
            </el-button>
          </div>
          <!-- 選中品項的改碼（Modifier Master：走蔥/加蛋/轉凍飲） -->
          <div v-for="(selIdx, si) in (comboDialog.selections[gi] || [])" :key="'cmsel' + si">
            <template v-if="group.items[selIdx] && (group.items[selIdx].modifiers || []).length">
              <div class="combo-mod-title">「{{ group.items[selIdx].name }}」改碼：</div>
              <span v-for="m in group.items[selIdx].modifiers" :key="m.modCodeId || m.name" class="mod-chip"
                    :class="{active: comboMods(gi, selIdx).some(x => x && (x.id || x.name) === (m.modCodeId || m.name))}"
                    @click="comboToggleMod(gi, selIdx, m)">
                {{ m.name }}<template v-if="(m.price || 0) > 0"> +${{ m.price }}</template>
              </span>
            </template>
          </div>
        </div>
        <div v-if="!comboDialog.combo.groups || !comboDialog.combo.groups.length" class="empty">此套餐尚未設定內容</div>
      </div>
      <div slot="footer">
        <el-button @click="comboDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="confirmCombo">加入訂單</el-button>
      </div>
    </el-dialog>

    <!-- 品項編輯 -->
    <el-dialog title="品項編輯" :visible.sync="itemDialog.show" width="520px" append-to-body>
      <div v-for="(group, gi) in modGroups" :key="gi" class="mod-group">
        <div class="mod-group-name">{{ group.name }}</div>
        <span v-for="m in group.items" :key="m._id" class="mod-chip"
              :class="{active: itemDialog.mods.some(x => x && (x.id || x.name) === m._id)}"
              @click="toggleMod(m)">
          {{ m.code ? m.code + ' ' : '' }}{{ m.name }}<template v-if="(m.price || 0) > 0"> +${{ m.price }}</template><i v-if="m.mandatory" class="req">必</i>
        </span>
      </div>
      <div class="custom-row"><el-input v-model="itemDialog.customMod" placeholder="自訂改碼" size="small" style="width: 180px;" @keyup.enter.native="addCustomMod"></el-input></div>
      <div slot="footer">
        <el-button @click="itemDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="confirmItemDialog">確 定</el-button>
      </div>
    </el-dialog>

    <!-- 整單折扣 -->
    <el-dialog title="整單折扣" :visible.sync="wholeDiscountDialog.show" width="360px" append-to-body>
      <el-form label-width="90px" size="small">
        <el-form-item label="折扣%">
          <el-input-number v-model="wholeDiscountDialog.pct" :min="0" :max="100" @change="onWholePct" style="width: 140px;"></el-input-number> %
        </el-form-item>
        <el-form-item label="折扣金額">
          <el-input-number v-model="wholeDiscountDialog.amount" :min="0" :max="totalPrice" @change="onWholeAmount" style="width: 140px;"></el-input-number> 元
        </el-form-item>
      </el-form>
      <div class="pay-total">折後金額：<span class="pay-num">${{ discountedPreview }}</span></div>
      <div slot="footer">
        <el-button @click="wholeDiscountDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="confirmWholeDiscount">確 定</el-button>
      </div>
    </el-dialog>

    <!-- 項目折扣 -->
    <el-dialog title="項目折扣" :visible.sync="itemDiscountDialog.show" width="360px" append-to-body>
      <el-form label-width="90px" size="small">
        <el-form-item label="折扣%">
          <el-input-number v-model="itemDiscountDialog.pct" :min="0" :max="100" @change="onItemDiscountPct" style="width: 140px;"></el-input-number> %
        </el-form-item>
        <el-form-item label="折扣金額">
          <el-input-number v-model="itemDiscountDialog.amount" :min="0" @change="onItemDiscountAmount" style="width: 140px;"></el-input-number> 元
        </el-form-item>
        <el-form-item label="贈送"><el-switch v-model="itemDiscountDialog.free"></el-switch></el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="itemDiscountDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="confirmItemDiscount">確定（再選品項）</el-button>
      </div>
    </el-dialog>

    <!-- 結帳 / 收款 — Eats365 風格全屏 -->
    <div v-if="payDialog.show" class="pay-overlay">
      <div class="pay-panel">
        <!-- 左側：訂單摘要 -->
        <div class="pay-left">
          <div class="pay-left-header">
            <span class="pay-left-title">訂單摘要</span>
            <span class="pay-left-table" v-if="isDineIn">枱 {{ selectedTable }}</span>
          </div>
          <div class="pay-order-list">
            <div v-for="(item, i) in cart" :key="i" class="pay-order-item">
              <span class="pay-oi-name">{{ item.name }}</span>
              <span class="pay-oi-qty">x{{ item.count }}</span>
              <span class="pay-oi-sub">${{ item.subtotal }}</span>
            </div>
          </div>
          <div class="pay-summary">
            <div class="pay-sum-row" v-if="orderDiscount > 0">
              <span>整單折扣</span><span class="pay-sum-disc">-${{ orderDiscount }}</span>
            </div>
            <div class="pay-sum-row" v-if="serviceChargeEnabled">
              <span>服務費 {{ serviceChargeRate }}%</span><span>${{ serviceChargeAmount }}</span>
            </div>
            <div class="pay-sum-row pay-sum-total">
              <span>應收金額</span><span class="pay-sum-num">${{ grandTotal }}</span>
            </div>
          </div>
        </div>

        <!-- 右側：付款操作區 -->
        <div class="pay-right">
          <div class="pay-right-header">
            <span class="pay-pr-title">選擇付款方式</span>
          </div>

          <!-- 付款方式按鈕網格 -->
          <div class="pay-method-grid">
            <div v-for="m in payMethods" :key="m._id"
                 class="pay-method-btn" :class="{ active: payDialog.method === m.value }"
                 @click="payDialog.method = m.value; onPayMethodChange()">
              <i class="pay-method-icon" :class="payMethodIcon(m.value)"></i>
              <span class="pay-method-label">{{ m.value }}</span>
            </div>
          </div>

          <!-- 現金專區 -->
          <div v-if="isCashMethod" class="pay-cash-section">
            <div class="pay-cash-display">
              <div class="pay-cash-label">實收金額</div>
              <div class="pay-cash-amount">${{ payDialog.cashStr || '0' }}</div>
            </div>

            <!-- 快速金額按鈕 -->
            <div class="pay-quick-row">
              <div class="pay-quick-btn" @click="payQuickAmount('full')">全額 ${{ grandTotal }}</div>
              <div class="pay-quick-btn" @click="payQuickAmount('half')">半數 ${{ halfTotal }}</div>
              <div class="pay-quick-btn" @click="payQuickAmount('custom')">自訂</div>
            </div>

            <!-- 數字鍵盤 -->
            <div class="pay-numpad">
              <div v-for="n in ['1','2','3','4','5','6','7','8','9']" :key="n" class="pay-np-key" @click="payInputDigit(n)">{{ n }}</div>
              <div class="pay-np-key" @click="payInputDigit('0')">0</div>
              <div class="pay-np-key" @click="payInputDot">.</div>
              <div class="pay-np-key pay-np-del" @click="payInputDel"><i class="el-icon-delete"></i></div>
            </div>

            <!-- 找零 -->
            <div class="pay-change-row" v-if="payDialog.change > 0">
              <span>找零</span><span class="pay-change-val">${{ payDialog.change }}</span>
            </div>
            <div class="pay-change-row pay-change-neg" v-else-if="payDialog.change < 0">
              <span>不足</span><span class="pay-change-val">-${{ Math.abs(payDialog.change) }}</span>
            </div>
          </div>

          <!-- 非現金提示 -->
          <div v-else class="pay-noncash-hint">
            <i class="el-icon-check pay-noncash-icon"></i>
            <div>確認後將以「{{ payDialog.method }}」結帳</div>
          </div>

          <!-- 操作按鈕 -->
          <div class="pay-actions">
            <div class="pay-btn-cancel" @click="payDialog.show = false">取消</div>
            <div class="pay-btn-confirm" :class="{ disabled: !canConfirmPay }" @click="confirmPay">
              <i class="el-icon-check"></i> 確認收款
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 數量鍵盤 -->
    <el-dialog title="輸入數量" :visible.sync="qtyDialog.show" width="300px" append-to-body>
      <number-pad :value="qtyDialog.value" @input="qtyDialog.value = $event" @confirm="confirmQty"></number-pad>
    </el-dialog>

    <!-- 枱號 KeyPad -->
    <el-dialog title="輸入枱號" :visible.sync="tableKeypad.show" width="300px" append-to-body :close-on-click-modal="false">
      <number-pad :value="tableKeypad.value" @input="tableKeypad.value = $event" @confirm="confirmTableKeypad"></number-pad>
      <div class="pad-hint">可用枱號：{{ tables.map(t => tableLabel(t)).join('、') }}</div>
    </el-dialog>

    <!-- 人數 KeyPad -->
    <el-dialog title="輸入人數" :visible.sync="paxKeypad.show" width="300px" append-to-body :close-on-click-modal="false">
      <number-pad :value="paxKeypad.value" @input="paxKeypad.value = $event" @confirm="confirmPaxKeypad"></number-pad>
    </el-dialog>

    <!-- PLU 鍵盤 -->
    <el-dialog title="PLU 加入（鍵盤）" :visible.sync="pluDialog.show" width="300px" append-to-body>
      <number-pad :value="pluDialog.value" @input="pluDialog.value = $event" @confirm="confirmPlu"></number-pad>
    </el-dialog>

    <!-- 合拼枱 / 分單 -->
    <el-dialog :title="tableDialog.title" :visible.sync="tableDialog.show" width="440px" append-to-body>
      <el-form label-width="90px" size="small">
        <template v-if="tableDialog.mode === 'merge'">
          <div class="merge-hint">把目前枱（{{ selectedTable }}）併入以下枱號，此枱保留</div>
          <el-form-item label="併入枱號">
            <span class="trans-src">{{ tableDialog.fromTable || '—' }}</span>
          </el-form-item>
        </template>
        <template v-else>
          <div v-if="!currentOrder" class="empty">該枱沒有未結訂單可分單</div>
          <template v-else>
            <div class="split-panels">
              <div class="split-panel">
                <div class="split-title">舊枱（枱 {{ selectedTable }}）</div>
                <div class="split-list">
                  <div v-for="x in splitLeftItems" :key="x.i" class="split-item" :class="{ sel: splitLeftSel.indexOf(x.i) >= 0 }" @click="toggleLeftSel(x.i)">
                    {{ x.item.name }} x{{ x.item.count }}
                  </div>
                  <div v-if="!splitLeftItems.length" class="empty">舊枱無品項</div>
                </div>
              </div>
              <div class="split-arrows">
                <el-button size="mini" icon="el-icon-arrow-right" @click="moveRight"></el-button>
                <el-button size="mini" icon="el-icon-arrow-left" @click="moveLeft"></el-button>
              </div>
              <div class="split-panel">
                <div class="split-title">新枱（移至枱 {{ tableDialog.toTable || '—' }}）</div>
                <div class="split-list">
                  <div v-for="x in splitRightItems" :key="x.i" class="split-item" :class="{ sel: splitRightSel.indexOf(x.i) >= 0 }" @click="toggleRightSel(x.i)">
                    {{ x.item.name }} x{{ x.item.count }}
                  </div>
                  <div v-if="!splitRightItems.length" class="empty">新枱無品項</div>
                </div>
              </div>
            </div>
            <el-form-item label="新枱號">
              <span class="trans-src">{{ tableDialog.toTable || '—' }}</span>
            </el-form-item>
          </template>
        </template>
      </el-form>
      <div class="pad-wrap" v-if="tableDialog.mode === 'split'">
        <number-pad :value="tableDialog.padValue" @input="onPadInput('table', $event)"></number-pad>
      </div>
      <div class="pad-wrap" v-else>
        <number-pad :value="tableDialog.padValue" @input="onPadInput('table', $event)" @confirm="confirmTableOp"></number-pad>
      </div>
      <div class="pad-hint">可用枱號：{{ tables.map(t => tableLabel(t)).join('、') }}</div>
      <div slot="footer">
        <el-button @click="tableDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="confirmTableOp">確 定</el-button>
      </div>
    </el-dialog>

    <!-- 轉枱 -->
    <el-dialog title="轉枱" :visible.sync="transferDialog.show" width="420px" append-to-body>
      <el-form label-width="90px" size="small">
        <el-form-item label="來源枱號">
          <span class="trans-src">{{ transferDialog.from }}</span>
        </el-form-item>
        <el-form-item label="移至枱號">
          <span class="trans-src">{{ transferDialog.toTable || '—' }}</span>
        </el-form-item>
      </el-form>
      <div class="pad-wrap">
        <number-pad :value="transferDialog.padValue" @input="onPadInput('transfer', $event)" @confirm="confirmTransfer"></number-pad>
      </div>
      <div class="pad-hint">可用枱號：{{ tables.map(t => tableLabel(t)).join('、') }}</div>
      <div slot="footer">
        <el-button @click="transferDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="confirmTransfer">確 定</el-button>
      </div>
    </el-dialog>

    <!-- 加枱 -->
    <el-dialog title="加枱" :visible.sync="addTableDialog.show" width="360px" append-to-body>
      <el-form label-width="80px" size="small">
        <el-form-item label="枱號">
          <span class="trans-src">{{ addTableDialog.no || '—' }}</span>
        </el-form-item>
        <el-form-item label="座位數">
          <el-input-number v-model="addTableDialog.seats" :min="1" :max="50"></el-input-number>
        </el-form-item>
        <el-form-item label="區域">
          <el-select v-model="addTableDialog.zone" style="width: 100%;">
            <el-option label="堂食" value="堂食"></el-option>
            <el-option label="外賣" value="外賣"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <div class="pad-wrap">
        <number-pad :value="addTableDialog.padValue" @input="onAddNo" @confirm="confirmAddTable"></number-pad>
      </div>
      <div slot="footer">
        <el-button @click="addTableDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="confirmAddTable">確 定</el-button>
      </div>
    </el-dialog>

    <!-- 掛單 / 叫回 -->
    <el-dialog title="掛單 / 叫回" :visible.sync="holdDialog.show" width="560px" append-to-body>
      <div v-if="!holdList.length" class="empty">尚無掛單</div>
      <el-table v-else :data="holdList" size="mini">
        <el-table-column prop="label" label="名稱" min-width="140"></el-table-column>
        <el-table-column label="內容" min-width="200">
          <template slot-scope="scope">{{ scope.row.items.map(i => i.name + ' x' + i.count).join('、') }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template slot-scope="scope">
            <el-button type="text" size="mini" @click="recallHold(scope.$index)">叫回</el-button>
            <el-button type="text" size="mini" @click="delHold(scope.$index)">刪除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div slot="footer">
        <el-button @click="holdDialog.show = false">關 閉</el-button>
      </div>
    </el-dialog>

    <!-- 更改已結帳單 -->
    <el-dialog title="更改已結帳單" :visible.sync="refundDialog.show" width="720px" append-to-body>
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
                  <el-button type="text" size="mini" @click="voidItem(scope.row, i)">退菜</el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="totalPrice" label="金額" width="90"></el-table-column>
            <el-table-column label="操作" width="110">
              <template slot-scope="scope">
                <el-button type="text" size="mini" @click="cancelOrder(scope.row)">取消整單</el-button>
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
                <el-button type="text" size="mini" @click="openChangePay(scope.row)">更改付款</el-button>
                <el-button type="text" size="mini" @click="refundOrder(scope.row)">退款</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- 更改付款 -->
    <el-dialog title="更改付款" :visible.sync="changePayDialog.show" width="360px" append-to-body>
      <div class="pay-total">訂單 {{ changePayDialog.orderNo }}<br/>金額：<span class="pay-num">${{ changePayDialog.totalPrice }}</span></div>
      <el-form label-width="90px" size="small" style="margin-top: 12px;">
        <el-form-item label="付款方式">
          <el-radio-group v-model="changePayDialog.payMethod">
            <el-radio v-for="m in payMethods" :key="m._id" :label="m.value">{{ m.value }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="changePayDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="confirmChangePay">確定並重印</el-button>
      </div>
    </el-dialog>

    <!-- 沽清設定（售罄清單） -->
    <el-dialog title="沽清設定（售罄清單）" :visible.sync="soldOutDialog.show" width="680px" append-to-body>
      <div class="soldout-header">
        <el-button type="primary" size="small" @click="soldOutDialog.showItemPicker = true">＋ 新增項目</el-button>
        <el-input v-model="soldOutDialog.keyword" placeholder="PLU / 品項名 搜尋" size="small" style="width: 220px; margin-left: 12px;" clearable></el-input>
      </div>
      <div class="soldout-tip">
        <el-alert type="info" :closable="false" show-icon>
          <template slot="title">
            點選「刪除」按鈕，即可從售罄清單中移除商品。
          </template>
        </el-alert>
      </div>
      <el-table :data="soldOutFiltered" size="mini" :max-height="380" :row-class-name="soldOutRowClass">
        <el-table-column prop="plu" label="PLU" width="90"></el-table-column>
        <el-table-column prop="name" label="品項" min-width="150"></el-table-column>
        <el-table-column label="狀態" width="80">
          <template slot-scope="scope">
            <el-tag :type="scope.row.soldOut ? 'info' : 'success'" size="mini">{{ scope.row.soldOut ? '沽清' : '在售' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="限量庫存" width="170">
          <template slot-scope="scope">
            <el-input-number v-model="scope.row.stock" :min="-1" :max="9999" size="mini" style="width: 120px;" @change="setStock(scope.row)"></el-input-number>
            <span class="tip">-1=不限</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90">
          <template slot-scope="scope">
            <el-button type="text" size="mini" style="color: #f56c6c;" @click="removeFromSoldOut(scope.row)">刪除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!soldOutFiltered.length" class="empty" style="padding: 20px;">售罄清單暫無商品</div>
      <div slot="footer">
        <el-button @click="soldOutDialog.show = false">關 閉</el-button>
      </div>
    </el-dialog>

    <!-- 新增售罄項目選擇器 -->
    <el-dialog title="將商品加入售罄清單" :visible.sync="soldOutDialog.showItemPicker" width="600px" append-to-body>
      <div class="soldout-tip">
        <el-alert type="info" :closable="false" show-icon>
          <template slot="title">
            瀏覽商品，點擊商品將其新增至售罄列表。灰色陰影部分表示已售罄。
          </template>
        </el-alert>
      </div>
      <div class="plu-bar" style="margin-bottom: 8px;">
        <el-input v-model="soldOutDialog.pickerKeyword" placeholder="搜尋品項" size="small" style="width: 220px;" clearable></el-input>
      </div>
      <div class="soldout-picker-grid">
        <div v-for="food in soldOutPickerList" :key="food._id" class="soldout-picker-item" :class="{ 'is-soldout': food.soldOut }" @click="toggleSoldOutFromPicker(food)">
          <div class="spp-name">{{ food.name }}</div>
          <div class="spp-tag" v-if="food.soldOut">已售罄</div>
          <div class="spp-tag spp-tag-ok" v-else>在售</div>
        </div>
        <div v-if="!soldOutPickerList.length" class="empty" style="padding: 20px; grid-column: 1/-1;">暫無品項</div>
      </div>
      <div slot="footer">
        <el-button @click="soldOutDialog.showItemPicker = false">完 成</el-button>
      </div>
    </el-dialog>

    <!-- 批量列印 -->
    <el-dialog title="批量列印" :visible.sync="batchPrintDialog.show" width="420px" append-to-body>
      <div class="bp-hint">勾選要列印嘅枱（只有未印單嘅枱可以揀）：</div>
      <div class="bp-list">
        <div v-for="t in boardTables" :key="t._id" class="bp-row">
          <el-checkbox v-model="batchChecked[t.no]" :disabled="bpDisabled(t)">
            {{ tableLabel(t) }} · {{ boardStatus(t.no) }}<template v-if="tableAmount(t.no) > 0"> · ${{ tableAmount(t.no) }}</template>
          </el-checkbox>
        </div>
      </div>
      <div slot="footer">
        <el-button size="small" @click="batchPrintDialog.show = false">取消</el-button>
        <el-button size="small" type="primary" @click="confirmBatchPrint">確認列印</el-button>
      </div>
    </el-dialog>

    <!-- 報表選擇 -->
    <el-dialog title="報表" :visible.sync="reportDialog.show" width="640px" append-to-body :close-on-click-modal="false">
      <template v-if="!reportDialog.result">
        <div style="margin-bottom: 16px;">
          <el-radio-group v-model="reportDialog.dateMode" size="small">
            <el-radio-button label="today">今日</el-radio-button>
            <el-radio-button label="past">往日</el-radio-button>
          </el-radio-group>
        </div>
        <div class="report-grid">
          <div v-for="r in reportTypes" :key="r.id" class="report-grid-item" @click="selectReportType(r)">
            <div class="rgi-icon">{{ r.icon }}</div>
            <div class="rgi-name">{{ r.label }}</div>
          </div>
        </div>
        <div v-if="reportDialog.selecting" style="margin-top: 16px;">
          <el-divider content-position="left">{{ reportDialog.selecting.label }}</el-divider>
          <el-form label-width="100px" size="small">
            <el-form-item v-if="reportDialog.selecting.scope !== false" label="報表範圍">
              <el-radio-group v-model="reportDialog.scope">
                <el-radio label="all">全部</el-radio>
                <el-radio v-if="reportDialog.selecting.personal !== false" label="personal">個人（{{ staffInfo.name }}）</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="reportDialog.dateMode === 'past'" label="時間範圍">
              <el-date-picker
                v-model="reportDialog.dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="開始日期"
                end-placeholder="結束日期"
                value-format="yyyy-MM-dd"
                style="width: 100%;">
              </el-date-picker>
            </el-form-item>
            <el-form-item v-if="reportDialog.dateMode === 'past'" label="分市時段">
              <el-select v-model="reportDialog.slot" size="small" style="width: 100%;">
                <el-option label="全部時段" value="all"></el-option>
                <el-option v-for="s in posSlots" :key="s.name" :label="`${s.name}（${s.start} - ${s.end}）`" :value="s.name"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item v-if="reportDialog.dateMode === 'past' && (!reportDialog.dateRange || reportDialog.dateRange.length < 2)" label="選擇日期">
              <div style="color: #909399; font-size: 12px;">請選擇日期範圍（開始日期和結束日期）</div>
            </el-form-item>
          </el-form>
          <div style="text-align: right; margin-top: 8px;">
            <el-button size="small" @click="reportDialog.selecting = null">返回</el-button>
            <el-button size="small" type="primary" @click="generateReport">確定產生</el-button>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="report-result" id="reportPrintArea">
          <div class="report-result-header">
            <div class="rr-title">{{ reportDialog.result.title }}</div>
            <div class="rr-subtitle">{{ reportDialog.result.subtitle }}</div>
          </div>
          <template v-if="reportDialog.result.columns && reportDialog.result.columns.length">
            <el-table :data="reportDialog.result.data" size="mini" style="width: 100%;">
              <el-table-column v-for="col in reportDialog.result.columns" :key="col.prop" :prop="col.prop" :label="col.label" :width="col.width" :align="col.align || 'left'">
                <template slot-scope="scope" v-if="col.bold">
                  <span style="font-weight: bold;">{{ scope.row[col.prop] }}</span>
                </template>
              </el-table-column>
            </el-table>
          </template>
          <template v-else>
            <div v-for="(section, idx) in reportDialog.result.sections" :key="idx" class="report-section">
              <div class="rs-title">{{ section.title }}</div>
              <el-table :data="section.rows" size="mini" style="width: 100%;">
                <el-table-column prop="label" label="項目" min-width="120"></el-table-column>
                <el-table-column prop="count" label="數量" width="80" align="right"></el-table-column>
                <el-table-column prop="amount" label="金額" width="120" align="right">
                  <template slot-scope="scope">
                    <span :class="{ 'rr-bold': scope.row.bold }">$ {{ formatMoney(scope.row.amount) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="average" label="平均" width="80" align="right"></el-table-column>
                <el-table-column v-if="section.hasExtra" prop="extra" label="備註" min-width="140"></el-table-column>
              </el-table>
              <div class="rs-divider"></div>
            </div>
            <div v-if="!reportDialog.result.sections || !reportDialog.result.sections.length" class="report-empty">暫無報表資料</div>
          </template>
          <div class="report-result-footer">
            <div>列印時間：{{ reportDialog.result.printTime }}</div>
            <div>操作員：{{ staffInfo.name }}（{{ staffInfo.no }}）</div>
          </div>
        </div>
      </template>
      <div slot="footer">
        <template v-if="!reportDialog.result">
          <el-button @click="reportDialog.show = false">退 出</el-button>
        </template>
        <template v-else>
          <el-button @click="reportDialog.result = null; reportDialog.selecting = null">返回選擇</el-button>
          <el-button @click="reportDialog.show = false">退 出</el-button>
          <el-button type="primary" icon="el-icon-printer" @click="printReport">列印報表</el-button>
        </template>
      </div>
    </el-dialog>

    <!-- 無權限提示 -->
    <el-dialog title="⚠️ 無權限操作" :visible.sync="noPermDialog.show" width="400px" append-to-body :close-on-click-modal="false">
      <div style="text-align: center; padding: 10px 0;">
        <div style="font-size: 48px; margin-bottom: 16px;">🚫</div>
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 12px; color: #f56c6c;">{{ noPermDialog.name }}</div>
        <div style="font-size: 14px; color: #606266; margin-bottom: 8px;">
          此功能需要<span style="color: #f56c6c; font-weight: bold;"> {{ levelLabel(noPermDialog.requiredLevel) }}</span>（等級 {{ noPermDialog.requiredLevel }}）以上權限
        </div>
        <div style="font-size: 13px; color: #909399;">
          你目前的權限等級為<span style="font-weight: bold;"> {{ levelLabel(staffInfo.permissionLevel) }}</span>（等級 {{ staffInfo.permissionLevel }}）
        </div>
        <div style="font-size: 13px; color: #909399; margin-top: 8px;">請聯絡經理或管理員獲取權限</div>
      </div>
      <div slot="footer">
        <el-button type="primary" @click="noPermDialog.show = false">我知道了</el-button>
      </div>
    </el-dialog>

    <!-- 起菜 -->
    <el-dialog title="起菜" :visible.sync="serveDishDialog.show" width="400px" append-to-body :close-on-click-modal="false">
      <div v-if="serveDishDialog.items.length === 0" style="padding:20px; text-align:center; color:#909399;">沒有已叫起的品項</div>
      <div v-else style="max-height:400px; overflow:auto;">
        <el-checkbox-group v-model="serveDishDialog.checked">
          <div v-for="(item, idx) in serveDishDialog.items" :key="idx" style="padding:8px 0; border-bottom:1px solid #f0f0f0;">
            <el-checkbox :label="idx">{{ item.name || '品項' }} × {{ item.count || 1 }}</el-checkbox>
          </div>
        </el-checkbox-group>
      </div>
      <div slot="footer">
        <el-button @click="serveDishDialog.show = false">取消</el-button>
        <el-button type="success" :loading="serveDishDialog.loading" :disabled="!serveDishDialog.checked.length" @click="submitServeDish">起菜出單</el-button>
      </div>
    </el-dialog>

    <!-- 搭枱選單 box -->
    <el-dialog title="" :visible.sync="shareTablePanel.show" width="480px" append-to-body :close-on-click-modal="false" :show-close="true" custom-class="share-table-dialog">
      <div class="stp-title">枱號 {{ shareTablePanel.deskNo }}</div>
      <div class="stp-main-btn" @click="enterShareTable(shareTablePanel.deskNo)">
        <i class="el-icon-s-home"></i>
        <span>{{ shareTablePanel.deskNo }} 主枱</span>
      </div>
      <div class="stp-divider"><span>搭枱</span></div>
      <div class="stp-sub-grid">
        <div v-for="st in shareTablePanel.subTables" :key="st.no" class="stp-sub-btn" @click="enterShareTable(st.no)">
          <i class="el-icon-user"></i>
          <span>{{ st.name }}</span>
        </div>
        <div v-if="shareTablePanel.subTables.length < 4" class="stp-sub-btn stp-add-btn" @click="doShareTable">
          <i class="el-icon-plus"></i>
          <span>搭枱</span>
        </div>
      </div>
    </el-dialog>

    <!-- 更改密碼 -->
    <el-dialog title="更改用戶密碼" :visible.sync="changePwdDialog.show" width="340px" append-to-body :close-on-click-modal="false">
      <el-input v-model="changePwdDialog.oldPwd" type="password" placeholder="舊密碼" size="medium" show-password style="margin-bottom:12px;"></el-input>
      <el-input v-model="changePwdDialog.newPwd" type="password" placeholder="新密碼" size="medium" show-password style="margin-bottom:12px;"></el-input>
      <el-input v-model="changePwdDialog.newPwd2" type="password" placeholder="確認新密碼" size="medium" show-password @keyup.enter.native="submitChangePwd"></el-input>
      <div slot="footer">
        <el-button @click="changePwdDialog.show = false">取消</el-button>
        <el-button type="primary" :loading="changePwdDialog.loading" @click="submitChangePwd">確認</el-button>
      </div>
    </el-dialog>

    <!-- 經理功能登入 -->
    <el-dialog title="經理功能" :visible.sync="managerDialog.show" width="340px" append-to-body>
      <template v-if="!isManager">
        <el-input v-model="managerDialog.no" placeholder="經理編號" size="medium" style="margin-bottom: 12px;"></el-input>
        <el-input v-model="managerDialog.password" type="password" placeholder="密碼" size="medium" show-password @keyup.enter.native="managerLogin"></el-input>
      </template>
      <template v-else>
        <div class="manager-menu">
          <el-button v-for="item in resolvedManagerMenu" :key="item.id" size="medium" @click="managerAction(item.id)">{{ item.label }}</el-button>
          <el-button size="medium" type="info" @click="managerAction('logout')">退出經理</el-button>
        </div>
      </template>
      <div slot="footer" v-if="!isManager">
        <el-button @click="managerDialog.show = false">取 消</el-button>
        <el-button type="primary" @click="managerLogin">登 入</el-button>
      </div>
    </el-dialog>

    <!-- 上班/下班打卡 -->
    <el-dialog :title="clockDialog.mode === 'in' ? '☀️ 上班打卡' : '🌙 下班打卡'" :visible.sync="clockDialog.show" width="360px" append-to-body :close-on-click-modal="false">
      <!-- 上班模式 -->
      <div v-if="clockDialog.mode === 'in'" style="padding: 8px 0; text-align: center;">
        <div style="font-size: 36px; color: #67c23a; margin-bottom: 12px;"><i class="el-icon-sunrise-1"></i></div>
        <div style="font-size: 16px; font-weight: 700; color: #303133; margin-bottom: 8px;">{{ staffInfo.name }}</div>
        <div v-if="selectedTerminal" style="font-size: 13px; color: #909399; margin-bottom: 12px;">
          <i class="el-icon-monitor"></i> {{ selectedTerminal }}
        </div>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 12px; color: #909399; margin-bottom: 4px;">你的員工編號：{{ staffInfo.no }}</div>
          <el-input ref="clockStaffInput" v-model="clockDialog.staffNo" placeholder="請輸入員工編號確認" size="medium" @keyup.enter.native="confirmClockIn">
            <template slot="prepend"><i class="el-icon-user"></i></template>
          </el-input>
        </div>
        <div style="font-size: 13px; color: #606266;">
          確認要上班打卡嗎？
        </div>
      </div>
      <!-- 下班模式 -->
      <div v-if="clockDialog.mode === 'out'" style="padding: 8px 0; text-align: center;">
        <div style="font-size: 36px; color: #f56c6c; margin-bottom: 12px;"><i class="el-icon-moon"></i></div>
        <div style="font-size: 16px; font-weight: 700; color: #303133; margin-bottom: 8px;">{{ staffInfo.name }}</div>
        <div v-if="selectedTerminal" style="font-size: 13px; color: #909399; margin-bottom: 8px;">
          <i class="el-icon-monitor"></i> {{ selectedTerminal }}
        </div>
        <div v-if="shiftInfo" style="font-size: 13px; color: #606266; margin-bottom: 12px;">
          <div><i class="el-icon-time"></i> 上班時間：{{ formatTime(shiftInfo.clockInTime) }}</div>
        </div>
        <div style="margin-bottom: 12px;">
          <div style="font-size: 12px; color: #909399; margin-bottom: 4px;">你的員工編號：{{ staffInfo.no }}</div>
          <el-input ref="clockStaffInput" v-model="clockDialog.staffNo" placeholder="請輸入員工編號確認" size="medium" @keyup.enter.native="confirmClockOut">
            <template slot="prepend"><i class="el-icon-user"></i></template>
          </el-input>
        </div>
        <div style="font-size: 13px; color: #606266;">
          確認要下班打卡嗎？
        </div>
      </div>
      <!-- 數字鍵盤 -->
      <div class="clock-numpad">
        <div v-for="n in ['1','2','3','4','5','6','7','8','9']" :key="n" class="clock-np-key" @click="clockInputDigit(n)">{{ n }}</div>
        <div class="clock-np-key clock-np-fn" @click="clockInputDel"><i class="el-icon-delete"></i></div>
        <div class="clock-np-key" @click="clockInputDigit('0')">0</div>
        <div class="clock-np-key clock-np-fn" @click="clockInputClear">C</div>
      </div>
      <div slot="footer">
        <el-button @click="clockDialog.show = false">取 消</el-button>
        <el-button v-if="clockDialog.mode === 'in'" type="success" :loading="clockDialog.loading" :disabled="!clockDialog.staffNo" @click="confirmClockIn">上 班</el-button>
        <el-button v-else type="danger" :loading="clockDialog.loading" :disabled="!clockDialog.staffNo" @click="confirmClockOut">下 班</el-button>
      </div>
    </el-dialog>

    <!-- 每日結算報表 -->
    <el-dialog title="📋 每日結算報表" :visible.sync="dayReportDialog.show" width="620px" append-to-body :close-on-click-modal="false">
      <div v-if="dayReportDialog.result" class="day-report">
        <div class="report-summary">
          <div class="report-row bold"><span>營業日</span><span>{{ dayReportDialog.result.date }}</span></div>
          <div class="report-row"><span>狀態</span><span>{{ dayReportDialog.result.status === 'open' ? '營業中' : '已結算' }}</span></div>
          <div class="report-row"><span>備用金</span><span>${{ money(dayReportDialog.result.startingCash) }}</span></div>
        </div>
        <div class="report-summary" style="margin-top: 12px;">
          <div class="report-row bold"><span>營業總額</span><span>${{ money(dayReportDialog.result.snapshot.totalIncome) }}</span></div>
          <div class="report-row"><span>訂單數</span><span>{{ dayReportDialog.result.snapshot.orderCount }} 單</span></div>
          <div class="report-row"><span>現金收入</span><span>${{ money(dayReportDialog.result.snapshot.cashIncome) }}</span></div>
          <div class="report-row"><span>信用卡收入</span><span>${{ money(dayReportDialog.result.snapshot.cardIncome) }}</span></div>
          <div class="report-row"><span>其他收入</span><span>${{ money(dayReportDialog.result.snapshot.otherIncome) }}</span></div>
          <div class="report-row"><span>折扣</span><span>-${{ money(dayReportDialog.result.snapshot.discountTotal) }}</span></div>
          <div class="report-row"><span>服務費</span><span>${{ money(dayReportDialog.result.snapshot.serviceChargeTotal) }}</span></div>
          <div class="report-row"><span>取消單</span><span>{{ dayReportDialog.result.snapshot.voidCount }} 單 / ${{ money(dayReportDialog.result.snapshot.voidAmount) }}</span></div>
          <div class="report-row bold"><span>應有現金</span><span>${{ money(dayReportDialog.result.expectedCash) }}</span></div>
        </div>
        <div style="margin-top: 16px;">
          <label style="font-size: 13px; color: #606266;">開始備用金</label>
          <el-input v-model="dayReportDialog.startingCash" size="large" placeholder="輸入開始備用金金額" style="margin-top: 6px;">
            <template slot="prepend">$</template>
          </el-input>
        </div>
        <div style="margin-top: 12px;">
          <label style="font-size: 13px; color: #606266;">收銀機實點金額</label>
          <el-input v-model="dayReportDialog.countedCash" size="large" placeholder="輸入收銀機實際金額" style="margin-top: 6px;">
            <template slot="prepend">$</template>
          </el-input>
        </div>
        <div style="margin-top: 12px;">
          <label style="font-size: 13px; color: #606266;">結算備註</label>
          <el-input v-model="dayReportDialog.remark" size="medium" placeholder="備註" style="margin-top: 6px;"></el-input>
        </div>
      </div>
      <div slot="footer">
        <el-button @click="dayReportDialog.show = false">取 消</el-button>
        <el-button v-if="bizDayStatus.isOpen" type="danger" :loading="dayReportDialog.loading" @click="confirmDayClose">確認結算</el-button>
      </div>
    </el-dialog>

    <!-- 單項取消選擇 -->
    <el-dialog title="單項取消" :visible.sync="cancelItemDialog.show" width="400px" append-to-body :close-on-click-modal="false">
      <div class="cancel-item-list">
        <div v-for="(item, idx) in cancelItemDialog.list" :key="idx" class="cancel-item-row">
          <span>{{ item.name }} x{{ item.count }}</span>
          <el-button type="text" style="color:#f56c6c;" @click="cancelItemBySelect(item.index)">取消</el-button>
        </div>
        <div v-if="!cancelItemDialog.list.length" class="empty">購物車為空</div>
      </div>
      <div slot="footer">
        <el-button @click="cancelItemDialog.show = false">關 閉</el-button>
      </div>
    </el-dialog>

    <!-- 取消已落單品項 / 整單取消授權 -->
    <el-dialog :title="cancelDialog.index === -1 ? '整單取消授權' : '取消已落單品項授權'" :visible.sync="cancelDialog.show" width="400px" append-to-body :close-on-click-modal="false">
      <el-form label-width="90px" size="small">
        <el-form-item label="經理編號">
          <el-input v-model="cancelDialog.managerNo" placeholder="經理員工編號"></el-input>
        </el-form-item>
        <el-form-item label="經理密碼">
          <el-input v-model="cancelDialog.managerPwd" type="password" placeholder="密碼" show-password @keyup.enter.native="cancelDialog.index === -1 ? confirmCancelAllSent() : confirmCancelSentItem()"></el-input>
        </el-form-item>
        <el-form-item label="取消原因">
          <el-input v-model="cancelDialog.reason" type="textarea" :rows="2" placeholder="選填"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="cancelDialog.show = false">取 消</el-button>
        <el-button type="danger" :loading="cancelDialog.loading" @click="cancelDialog.index === -1 ? confirmCancelAllSent() : confirmCancelSentItem()">確認取消</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import NumberPad from '../../components/pos/NumberPad'

const DEFAULT_BUTTON_ORDER = [
  'merge', 'split', 'transfer', 'hold', 'recall', 'print', 'chase', 'serving',
  'qrcode', 'wholeDiscount', 'itemDiscount', 'clear', 'submit', 'send', 'checkout', 'cashCheckout', 'soldout',
  'refund', 'report', 'manager', 'addTable', 'cancelAll', 'cancelItem'
]

const BUTTON_META = {
  merge: { label: '合拼枱', funcCode: '1', dineIn: true, type: '' },
  split: { label: '分單', funcCode: '2', dineIn: true, type: '' },
  transfer: { label: '轉枱', funcCode: '3', dineIn: true, type: '' },
  hold: { label: '掛單', funcCode: '4', dineIn: false, type: '' },
  recall: { label: '叫回', funcCode: '5', dineIn: false, type: '' },
  print: { label: '印單', funcCode: '6', dineIn: false, type: 'warning' },
  chase: { label: '追單', funcCode: '7', dineIn: false, type: 'danger' },
  serving: { label: '上菜紙', funcCode: '8', dineIn: false, type: '' },
  qrcode: { label: '二維碼', funcCode: '9', dineIn: false, type: '' },
  wholeDiscount: { label: '整單折扣', funcCode: '10', dineIn: false, type: '' },
  itemDiscount: { label: '項目折扣', funcCode: '11', dineIn: false, type: '' },
  clear: { label: '清空', funcCode: '12', dineIn: false, type: 'danger' },
  submit: { label: '確認下單', funcCode: '13', dineIn: false, type: '' },
  send: { label: '送單', funcCode: '14', dineIn: false, type: 'success' },
  checkout: { label: '結帳', funcCode: '15', dineIn: false, type: 'warning' },
  cashCheckout: { label: '現金結帳', funcCode: '37', dineIn: false, type: 'danger' },
  soldout: { label: '沽清設定', funcCode: '16', dineIn: false, type: '' },
  refund: { label: '更改已結帳單', funcCode: '17', dineIn: false, type: '' },
  report: { label: '報表', funcCode: '18', dineIn: false, type: '' },
  manager: { label: '經理功能', funcCode: '19', dineIn: false, type: '' },
  openDrawer: { label: '開銀櫃', funcCode: '38', dineIn: false, type: '' },
  addTable: { label: '加枱', funcCode: '20', dineIn: false, type: '' },
  cancelAll: { label: '整單取消', funcCode: '21', dineIn: false, type: 'danger' },
  cancelItem: { label: '單項取消', funcCode: '22', dineIn: false, type: 'danger' },
  cashCheckout: { label: '現金結帳', funcCode: '37', dineIn: false, type: 'success' },
  callDish: { label: '叫起', funcCode: '38', dineIn: true, type: 'warning' },
  serveDish: { label: '起菜', funcCode: '39', dineIn: true, type: 'success' },
  reprint: { label: '重印單據', funcCode: '40', dineIn: false, type: 'warning' },
  shareTable: { label: '搭枱', funcCode: '41', dineIn: true, type: '' },
  login: { label: '登入', funcCode: '34', dineIn: false, type: '' },
  logoutBtn: { label: '登出', funcCode: '35', dineIn: false, type: '' },
  changePwd: { label: '更改用戶密碼', funcCode: '36', dineIn: false, type: '' }
}
const SIDEBAR_META = {
  grid: { label: '枱號圖', funcCode: '23' },
  takeaway: { label: '外賣', funcCode: '24' },
  dineIn: { label: '堂食', funcCode: '25' },
  list: { label: '查看單據', funcCode: '26' },
  search: { label: '搜尋編號', funcCode: '27' },
  history: { label: '往日單據', funcCode: '28' },
  refresh: { label: '重新整理', funcCode: '29' },
  addTable: { label: '快速開枱', funcCode: '30' },
  batchPrint: { label: '批量列印', funcCode: '31' },
  report: { label: '報表', funcCode: '32' },
  settings: { label: '經理功能', funcCode: '33' }
}
const FUNC_CODE_TO_BTN_ID = {}
Object.keys(BUTTON_META).forEach(k => { FUNC_CODE_TO_BTN_ID[BUTTON_META[k].funcCode] = k })
Object.keys(SIDEBAR_META).forEach(k => { FUNC_CODE_TO_BTN_ID[SIDEBAR_META[k].funcCode] = 'sb_' + k })

export default {
  name: 'posIndex',
  components: { NumberPad },
  data () {
    return {
      loggedIn: false,
      currentTime: '',
      timeTimer: null,
      loginNo: '',
      loginPassword: '',
      staffInfo: { no: '', name: '', permissionLevel: 1, permissions: [] },
      terminals: [], // 收銀機列表
      selectedTerminal: '', // 當前收銀機
      shiftInfo: null, // 當前班次資訊（上下班狀態）
      clockDialog: { show: false, mode: 'in', openingCash: '', closingCash: '', remark: '', staffNo: '' },
      view: 'board',
      tables: [],
      selectedTable: 1,
      zones: [],
      selectedZone: '堂食',
      pax: 1,
      waiter: '',
      goods: [],
      combos: [],
      activeCategory: '',
      showFoodImages: true,
      qtyHoldTimer: null,
      orderLayout: 'sidebar',
      orderTheme: 'indigo',
      showSideNav: true,
      ticketSide: 'right',
      ticketWidth: 0,
      dockHeight: 0,
      sideNavWidth: 0,
      dockMinH: 0,
      freeLayout: false,
      panels: {},
      panelColors: {},
      hiddenBtns: [],
      payMethods: [],
      payTypes: [],
      btnPos: {},
      btnColors: {},
      sideBuffer: '',
      batchChecked: {},
      comboDialog: { show: false, combo: null, selections: {} },
      carts: {},
      orderRemark: '',
      serviceChargeEnabled: false,
      serviceChargeRate: 10,
      roundingMode: 'none',
      buttonOrder: [],
      btnPerms: {},
      funcCodeToBtnId: FUNC_CODE_TO_BTN_ID,
      posBtnFontSize: 18,
      posBtnWidth: 100,
      posBtnHeight: 40,
      calledTagStyle: { color: '#ea580c', background: '#ffedd5', border: '#fed7aa' },
      boardCardHeight: 110,
      boardCardWidth: 0,
      boardGridCols: 0,
      boardGridRows: 0,
      boardGap: 10,
      modCodeList: [],
      unfinishedOrders: [],
      itemDialog: { show: false, index: null, mods: [], customMod: '' },
      wholeDiscountDialog: { show: false, pct: 0, amount: 0 },
      itemDiscountDialog: { show: false, pct: 0, amount: 0, free: false },
      pendingItemDiscount: null,
      payDialog: { show: false, method: '現金', cashStr: '', change: 0, invoiceNo: '' },
      tableDialog: { show: false, mode: 'merge', title: '', fromTable: null, toTable: null, padValue: '' },
      splitMoved: [],
      splitLeftSel: [],
      splitRightSel: [],
      addTableDialog: { show: false, padValue: '', no: null, seats: 4, zone: '堂食' },
      transferDialog: { show: false, from: null, toTable: null, padValue: '' },
      qtyDialog: { show: false, index: null, value: '' },
      tableKeypad: { show: false, value: '' },
      paxKeypad: { show: false, value: '' },
      pluDialog: { show: false, value: '' },
      holdDialog: { show: false },
      holdList: [],
      refundDialog: { show: false, activeTab: 'void', finished: [] },
      noPermDialog: { show: false, name: '', requiredLevel: 1 },
      reportDialog: { show: false, type: 'cashier', scope: 'all', dateRange: [], slot: 'all', result: null, selecting: null, dateMode: 'today' },
      posSlots: [],
      shopName: '',
      shopIntro: '',
      batchPrintDialog: { show: false },
      reportTypes: [
        { id: 'business', label: '營業報表', icon: '📊', scope: false },
        { id: 'department', label: '分區營業報表', icon: '🏬', scope: false },
        { id: 'cashier', label: '收銀員報表', icon: '💰', personal: true },
        { id: 'payment', label: '付款報表', icon: '💳', personal: true },
        { id: 'cancelPayment', label: '取消付款報表', icon: '❌', personal: true },
        { id: 'itemCancel', label: '項目取消報表', icon: '🗑️', personal: true },
        { id: 'orderCancel', label: '全單取消報表', icon: '🚫', personal: true },
        { id: 'printRecord', label: '印單紀錄報表', icon: '🖨️', personal: true },
        { id: 'mergeTable', label: '合併枱報表', icon: '🔗', personal: false },
        { id: 'itemTransfer', label: '項目轉移報表', icon: '🔄', personal: false },
        { id: 'orderDetail', label: '單據明細詳列', icon: '📋', personal: true },
        { id: 'staffHours', label: '員工工時報表', icon: '🕐', personal: true }
      ],
      shareTableEnabled: false,
      shareTablePanel: { show: false, deskNo: 0, subTables: [] },
      serveDishDialog: { show: false, deskNo: 0, items: [], checked: [], loading: false },
      managerMenu: [],
      changePwdDialog: { show: false, oldPwd: '', newPwd: '', newPwd2: '', loading: false },
      managerDialog: { show: false, no: '', password: '' },
      isManager: false,
      managerName: '',
      pluInput: '',
      changePayDialog: { show: false, orderId: '', orderNo: '', totalPrice: 0, payMethod: '現金' },
      soldOutDialog: { show: false, list: [], keyword: '', showItemPicker: false, pickerKeyword: '' },
      bizDayStatus: { date: '', isOpen: false, businessDay: null, cutoff: '03:00' },
      dayReportDialog: { show: false, result: null, loading: false, startingCash: '', countedCash: '', remark: '' },
      cancelDialog: { show: false, index: null, isSent: false, managerNo: '', managerPwd: '', reason: '', loading: false },
      cancelItemDialog: { show: false, list: [] },
      swipeIndex: -1,
      swipeStartX: 0,
      swipeStartY: 0,
      swipeDelta: 0,
      swipeLocked: false,
      swipeTimer: null,
      activeBoardZone: '',
      layoutMode: false,
      orderDiscount: 0,
      drag: null,
      boardMode: 'grid',
      boardZoneFilter: 'all',
      sidebarBtnConfig: [],
      sidebarFontSize: 12,
      sidebarWidth: 130,
      tableListStatus: 'all',
      tableListSort: 'table',
      tableListKeyword: '',
      tableSearchKeyword: '',
      tableSearchStatus: 'all',
      historyOrders: [],
      historyLoading: false,
      historyPage: 1,
      historyTotal: 0,
      historyKeyword: '',
      historyDateRange: []
    }
  },
  computed: {
    resolvedManagerMenu () {
      return this.managerMenu.filter(m => m.visible !== false).map(m => {
        const id = FUNC_CODE_TO_BTN_ID[m.funcCode] || ''
        if (id && BUTTON_META[id]) {
          return { id, label: BUTTON_META[id].label, funcCode: m.funcCode }
        }
        return { id: m.funcCode, label: '[' + m.funcCode + ']', funcCode: m.funcCode }
      })
    },
    sidebarButtons () {
      return this.sidebarBtnConfig.map(c => {
        const fc = c.funcCode || ''
        const resolvedId = FUNC_CODE_TO_BTN_ID[fc] || ''
        let actionId = c.id
        if (resolvedId && resolvedId !== c.id) {
          actionId = resolvedId.startsWith('sb_') ? resolvedId.replace('sb_', '') : resolvedId
        }
        const meta = SIDEBAR_META[c.id] || {}
        const actMeta = SIDEBAR_META[actionId] || BUTTON_META[actionId] || meta
        const label = actMeta.label || meta.label || c.id
        const icon = { grid: 'el-icon-menu', takeaway: 'el-icon-shopping-bag-2', dineIn: 'el-icon-office-building', list: 'el-icon-tickets', search: 'el-icon-search', history: 'el-icon-time', refresh: 'el-icon-refresh', addTable: 'el-icon-plus', batchPrint: 'el-icon-printer', report: 'el-icon-data-analysis', settings: 'el-icon-setting' }
        return { slotId: c.id, actionId, funcCode: fc, label, icon: icon[actionId] || 'el-icon-more', visible: c.visible !== false, bgColor: c.bgColor || '', textColor: c.textColor || '' }
      })
    },
    isDineIn () { return this.selectedZone === '堂食' },
    isTakeaway () { return !this.isDineIn },
    categories () { return this.goods.map(g => g.name) },
    catColorMap () {
      const m = {}
      this.goods.forEach(g => { m[g.name] = { colorFrom: g.colorFrom || '', colorTo: g.colorTo || '', textColor: g.textColor || '#ffffff' } })
      return m
    },
    hotFoods () {
      const all = []
      this.goods.forEach(g => (g.foods || []).forEach(f => { if (f.onSale > 0 && !f.soldOut) all.push(f) }))
      return all.sort((a, b) => b.onSale - a.onSale).slice(0, 12)
    },
    activeFoods () {
      if (this.activeCategory === '__hot__') return this.hotFoods
      const g = this.goods.find(x => x.name === this.activeCategory)
      return g ? (g.foods || []) : []
    },
    cart () { return this.carts[this.isDineIn ? this.selectedTable : 'takeaway'] || [] },
    selectedTableLabel () {
      if (!this.selectedTable) return '—'
      const t = this.tables.find(x => x.no === this.selectedTable)
      return t ? this.tableLabel(t) : this.selectedTable
    },
    cartKey () { return this.isDineIn ? this.selectedTable : 'takeaway' },
    totalPrice () { return Math.round(this.cart.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100 },
    serviceChargeAmount () {
      if (!this.serviceChargeEnabled) return 0
      return Math.round(this.totalPrice * (this.serviceChargeRate || 0) / 100 * 100) / 100
    },
    grandTotal () {
      const discounted = this.totalPrice - (this.orderDiscount || 0)
      const raw = Math.max(0, Math.round((discounted + this.serviceChargeAmount) * 100) / 100)
      return this.applyRounding(raw)
    },
    halfTotal () {
      return Math.ceil(this.grandTotal / 2)
    },
    isCashMethod () {
      return /現金|cash/i.test(this.payDialog.method || '')
    },
    canConfirmPay () {
      if (this.isCashMethod && Number(this.payDialog.cashStr || 0) < this.grandTotal) return false
      return true
    },
    discountedPreview () {
      return Math.max(0, Math.round((this.totalPrice - (this.wholeDiscountDialog.amount || 0)) * 100) / 100)
    },
    boardZones () {
      const set = []
      this.tables.forEach(t => {
        const z = t.zone || '未分區'
        if (set.indexOf(z) < 0) set.push(z)
      })
      return set
    },
    boardCanvasStyle () {
      const cw = this.boardCardWidth || 200
      const ch = this.boardCardHeight || 110
      const gap = this.boardGap || 0
      let maxY = 0
      this.boardTables.forEach((t, i) => {
        const p = this.tablePos(t, i)
        if (p.y + ch > maxY) maxY = p.y + ch
      })
      return { position: 'relative', minHeight: (maxY + gap + 40) + 'px' }
    },
    boardTables () {
      const z = this.activeBoardZone || this.boardZones[0]
      let filtered = this.tables.filter(t => (this.boardZoneFilter === 'all' || (t.zone || '未分區') === this.boardZoneFilter) && (!z || this.boardZoneFilter !== 'all' || (t.zone || '未分區') === z))
      if (this.shareTableEnabled) {
        filtered = filtered.filter(t => !t.shareSuffix)
      } else {
        const main = filtered.filter(t => !t.shareSuffix)
        const subs = filtered.filter(t => t.shareSuffix)
        const grouped = []
        main.forEach(m => {
          grouped.push(m)
          const linkSubs = subs.filter(s => s.physicalNo === m.no)
          linkSubs.forEach(s => grouped.push(s))
        })
        const unlinked = subs.filter(s => !main.some(m => m.no === s.physicalNo))
        unlinked.forEach(s => grouped.push(s))
        filtered = grouped
      }
      return filtered
    },
    tableRows () {
      return this.tables.map(t => {
        const orders = this.unfinishedOrders.filter(o => o.deskNo === t.no)
        const order = orders[0]
        const amount = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)
        const status = order ? (order.relisted ? '退單' : (orders.some(o => o.source === 'qr' || o.source === 'extension') ? '使用中' : (orders.some(o => o.printed) ? '已印單' : '用餐中'))) : '空枱'
        return { table: t, label: this.tableLabel(t), zone: t.zone || '未分區', status, statusType: status === '空枱' ? 'success' : (status === '退單' ? 'info' : (status === '用餐中' ? 'success' : 'warning')), seats: order && order.pax ? order.pax : (order ? t.seats : '-'), openTime: order && order.date ? this.formatTime(new Date(order.date)) : '-', duration: order && order.date ? this.durationText(order.date) : '-', amount: amount ? '$' + amount : '-', waiter: order && order.waiter ? order.waiter : '-' }
      })
    },
    tableListRows () {
      let rows = this.tableRows.filter(r => (this.tableListStatus === 'all' || (this.tableListStatus === 'free' && r.status === '空枱') || (this.tableListStatus === 'qr' && r.status === '使用中') || (this.tableListStatus === 'active' && r.status === '用餐中') || (this.tableListStatus === 'printed' && r.status === '已印單')) && (this.boardZoneFilter === 'all' || r.zone === this.boardZoneFilter))
      const kw = this.tableListKeyword.trim().toLowerCase()
      if (kw) rows = rows.filter(r => r.label.toString().toLowerCase().indexOf(kw) >= 0 || r.waiter.toLowerCase().indexOf(kw) >= 0)
      if (this.tableListSort === 'amount') rows.sort((a, b) => parseFloat(b.amount.replace('$', '')) - parseFloat(a.amount.replace('$', '')))
      else if (this.tableListSort === 'time') rows.sort((a, b) => a.openTime.localeCompare(b.openTime))
      else rows.sort((a, b) => Number(a.table.no) - Number(b.table.no))
      return rows
    },
    tableSearchRows () {
      const kw = this.tableSearchKeyword.trim().toLowerCase()
      const pluId = kw ? this.pluMap[kw] : null
      return this.tableRows.filter(r => {
        if (this.tableSearchStatus !== 'all') {
          const ok = (this.tableSearchStatus === 'free' && r.status === '空枱') || (this.tableSearchStatus === 'qr' && r.status === '使用中') || (this.tableSearchStatus === 'active' && r.status === '用餐中') || (this.tableSearchStatus === 'printed' && r.status === '已印單')
          if (!ok) return false
        }
        if (!kw) return true
        if (r.label.toString().toLowerCase().indexOf(kw) >= 0 || r.zone.toLowerCase().indexOf(kw) >= 0 || r.waiter.toLowerCase().indexOf(kw) >= 0) return true
        const orders = this.unfinishedOrders.filter(o => o.deskNo === r.table.no)
        if (orders.some(o => String(o.orderNo || '').toLowerCase().indexOf(kw) >= 0)) return true
        // 貨品編號（PLU）／品名／商品 id 配對
        return orders.some(o => (o.order || []).some(it => {
          const id = String(it._id || it.commodityId || '')
          return (pluId && id === pluId) || String(it.name || '').toLowerCase().indexOf(kw) >= 0 || id.toLowerCase().indexOf(kw) >= 0
        }))
      })
    },
    // PLU → 商品 id 對照（搜尋貨品編號用）
    pluMap () {
      const m = {}
      this.goods.forEach(g => (g.foods || []).forEach(f => { if (f.plu) m[String(f.plu).toLowerCase()] = f._id }))
      return m
    },
    currentOrder () {
      if (!this.isDineIn) return null
      return this.unfinishedOrders.find(o => o.deskNo === this.selectedTable) || null
    },
    splitLeftItems () {
      const order = this.currentOrder ? (this.currentOrder.order || []) : []
      return order.map((item, i) => ({ item, i })).filter(x => this.splitMoved.indexOf(x.i) < 0)
    },
    splitRightItems () {
      const order = this.currentOrder ? (this.currentOrder.order || []) : []
      return this.splitMoved.map(i => ({ item: order[i], i })).filter(x => x.item)
    },
    soldOutFiltered () {
      const kw = (this.soldOutDialog.keyword || '').trim().toLowerCase()
      if (!kw) return this.soldOutDialog.list
      return this.soldOutDialog.list.filter(x =>
        String(x.plu || '').toLowerCase().indexOf(kw) >= 0 ||
        String(x.name || '').toLowerCase().indexOf(kw) >= 0
      )
    },
    soldOutPickerList () {
      const kw = (this.soldOutDialog.pickerKeyword || '').trim().toLowerCase()
      const all = []
      this.goods.forEach(g => {
        (g.foods || []).forEach(f => {
          all.push({ _id: f._id, name: f.name, plu: f.plu || '', soldOut: !!f.soldOut, stock: f.stock === undefined || f.stock === null ? -1 : f.stock })
        })
      })
      if (!kw) return all
      return all.filter(x => String(x.name || '').toLowerCase().indexOf(kw) >= 0 || String(x.plu || '').toLowerCase().indexOf(kw) >= 0)
    },
    configuredButtons () {
      const raw = (this.buttonOrder && this.buttonOrder.length) ? this.buttonOrder : DEFAULT_BUTTON_ORDER
      return raw.map(entry => {
        if (typeof entry === 'string') {
          const meta = BUTTON_META[entry]
          return meta ? { id: entry, color: '', funcCode: '', visible: true, label: meta.label, type: meta.type, dineIn: meta.dineIn } : null
        }
        const id = entry.id || this.funcCodeToBtnId[entry.funcCode] || ''
        if (!id) return null
        const meta = BUTTON_META[id]
        if (!meta) return null
        const vis = entry.visible !== false
        const fs = Number(entry.fontSize) || 0
        const w = Number(entry.width) || 0
        const h = Number(entry.height) || 0
        return { id, colorFrom: entry.colorFrom || entry.color || '', colorTo: entry.colorTo || '', textColor: entry.textColor || '', funcCode: entry.funcCode || '', visible: vis, fontSize: fs, width: w, height: h, label: meta.label, type: meta.type, dineIn: meta.dineIn }
      }).filter(b => b && b.visible && (!b.dineIn || this.isDineIn))
    },
    buttonRows () {
      const rows = []
      for (let i = 0; i < this.layoutButtons.length; i += 8) {
        rows.push(this.layoutButtons.slice(i, i + 8))
      }
      return rows
    },
    // 底部功能 dock：全部功能鍵（送單/結帳特大）
    dockButtons () {
      return this.layoutButtons
    },
    // 手動拖動重排後的功能鍵順序（localStorage 覆蓋後台設定）
    layoutButtons () {
      const hidden = this.hiddenBtns || []
      const visible = this.configuredButtons.filter(b => hidden.indexOf(b.id) < 0)
      const ids = this.buttonOrder || []
      if (ids.length) {
        const map = {}
        visible.forEach(b => { map[b.id] = b })
        const out = []
        ids.forEach(id => { if (map[id]) out.push(map[id]) })
        visible.forEach(b => { if (out.indexOf(b) < 0) out.push(b) })
        return out
      }
      return visible
    },
    dockRows () {
      const rows = []
      for (let i = 0; i < this.dockButtons.length; i += 8) {
        rows.push(this.dockButtons.slice(i, i + 8))
      }
      return rows
    },
    // 手動版面：有效清單邊（本地覆蓋優先）
    effectiveTicketSide () {
      return this.ticketSide
    },
    // 自由版面：面板絕對定位
    freeMode () {
      return !!this.freeLayout
    },
    ticketWidthStyle () {
      const w = Number(this.ticketWidth) || 0
      return w ? { flexBasis: w + 'px', maxWidth: 'none' } : {}
    },
    dockHeightStyle () {
      const h = Number(this.dockHeight) || 0
      return h ? { height: h + 'px' } : {}
    },
    sideNavStyle () {
      const w = Number(this.sideNavWidth) || 0
      return w ? { flexBasis: w + 'px' } : {}
    },
    // 入單版面主題配色（後台可設）
    themeVars () {
      const themes = {
        indigo: { from: '#8d94d0', to: '#7b84c9', headFrom: '#6a73c8', headTo: '#8f96d8', dockFrom: '#7b84c9', dockTo: '#9097d6', payFrom: '#b06a5f', payTo: '#c08a80', payDeep: '#8c3f33', payText: '#9c4a3c', slot: '#c0504a', active: '#5a63a8' },
        ocean: { from: '#5b8fd6', to: '#4a7cc4', headFrom: '#3a6fc0', headTo: '#5b8fd6', dockFrom: '#4a7cc4', dockTo: '#6b97d6', payFrom: '#2f6fb0', payTo: '#4a8cd0', payDeep: '#1d5f9e', payText: '#1d5f9e', slot: '#d65a4a', active: '#2f6fb0' },
        emerald: { from: '#43a978', to: '#359263', headFrom: '#2f8f63', headTo: '#43a978', dockFrom: '#359263', dockTo: '#55b58a', payFrom: '#2e8b62', payTo: '#48a87c', payDeep: '#1f7a52', payText: '#1f7a52', slot: '#c0504a', active: '#2f8f63' },
        sunset: { from: '#e08a4e', to: '#d07440', headFrom: '#c96a35', headTo: '#e08a4e', dockFrom: '#d07440', dockTo: '#e69760', payFrom: '#c05a3c', payTo: '#d07852', payDeep: '#a03d2f', payText: '#a03d2f', slot: '#8c3f33', active: '#b3542f' },
        dark: { from: '#2f3547', to: '#232a3a', headFrom: '#3a4157', headTo: '#4a5370', dockFrom: '#232a3a', dockTo: '#39405a', payFrom: '#6b3a32', payTo: '#7d4a40', payDeep: '#542d27', payText: '#c08a80', slot: '#c0504a', active: '#4a5370' }
      }
      const t = themes[this.orderTheme] || themes.indigo
      return {
        '--pos-side-from': t.from,
        '--pos-side-to': t.to,
        '--pos-head-from': t.headFrom,
        '--pos-head-to': t.headTo,
        '--pos-dock-from': t.dockFrom,
        '--pos-dock-to': t.dockTo,
        '--pos-pay-from': t.payFrom,
        '--pos-pay-to': t.payTo,
        '--pos-pay-deep': t.payDeep,
        '--pos-pay-text': t.payText,
        '--pos-slot': t.slot,
        '--pos-active': t.active
      }
    },
    modGroups () {
      const groups = {}
      this.modCodeList.forEach(m => {
        const c = m.category || '其他'
        if (!groups[c]) groups[c] = []
        groups[c].push(m)
      })
      return Object.keys(groups).map(k => ({ name: k, items: groups[k] }))
    }
  },
  methods: {
    payMethodIcon (method) {
      if (/現金|cash/i.test(method)) return 'el-icon-money'
      if (/信用卡|credit|卡/i.test(method)) return 'el-icon-credit-card'
      if (/八達通|octopus/i.test(method)) return 'el-icon-mobile-phone'
      if (/微信|wechat/i.test(method)) return 'el-icon-chat-dot-round'
      if (/支付寶|alipay/i.test(method)) return 'el-icon-wallet'
      return 'el-icon-coins'
    },
    // === 上下班打卡 ===
    loadShiftStatus () {
      if (!this.staffInfo.no || !this.selectedTerminal) return
      this.$axios.post('/api/clock/current', { staffNo: String(this.staffInfo.no || ''), terminalCode: this.selectedTerminal })
        .then(res => {
          this.shiftInfo = (res.data && res.data.shift) || null
        }).catch(() => { this.shiftInfo = null })
    },
    openClockIn () {
      this.clockDialog = { show: true, mode: 'in', openingCash: '', closingCash: '', remark: '', staffNo: '', loading: false }
      this.$nextTick(() => {
        const input = this.$refs.clockStaffInput
        if (input && input.focus) input.focus()
      })
    },
    openClockOut () {
      this.clockDialog = { show: true, mode: 'out', openingCash: '', closingCash: '', remark: '', staffNo: '', loading: false }
      this.$nextTick(() => {
        const input = this.$refs.clockStaffInput
        if (input && input.focus) input.focus()
      })
    },
    clockInputDigit (d) {
      this.clockDialog.staffNo = (this.clockDialog.staffNo || '') + d
    },
    clockInputDel () {
      this.clockDialog.staffNo = (this.clockDialog.staffNo || '').slice(0, -1)
    },
    clockInputClear () {
      this.clockDialog.staffNo = ''
    },
    confirmClockIn () {
      const staffNo = (this.clockDialog.staffNo || '').trim()
      if (!staffNo) {
        this.$message({ type: 'warning', message: '請輸入員工編號！' })
        return
      }
      this.clockDialog.loading = true
      this.$axios.post('/api/clock/in', {
        staffNo,
        terminalCode: this.selectedTerminal
      }).then(res => {
        this.$message({ type: 'success', message: res.data.message || '上班打卡成功！' })
        this.clockDialog.show = false
        this.shiftInfo = res.data.shift || null
      }).catch(err => {
        this.$message({ type: 'error', message: (err.response && err.response.data) || '打卡失敗' })
      }).finally(() => { this.clockDialog.loading = false })
    },
    confirmClockOut () {
      const staffNo = (this.clockDialog.staffNo || '').trim()
      if (!staffNo) {
        this.$message({ type: 'warning', message: '請輸入員工編號！' })
        return
      }
      this.clockDialog.loading = true
      this.$axios.post('/api/clock/out', {
        staffNo,
        terminalCode: this.selectedTerminal,
        remark: ''
      }).then(res => {
        this.clockDialog.show = false
        this.$message({ type: 'success', message: '下班打卡成功！' })
        this.shiftInfo = null
      }).catch(err => {
        this.$message({ type: 'error', message: (err.response && err.response.data) || '打卡失敗' })
      }).finally(() => { this.clockDialog.loading = false })
    },
    loadTerminals () {
      // 從 URL 參數獲取 terminalCode（如 /pos?terminal=POS-01）
      const urlParams = new URLSearchParams(window.location.search)
      const urlTerminal = urlParams.get('terminal') || ''
      this.$axios.get('/api/posterminal/enabled').then(res => {
        this.terminals = (res.data || []).filter(t => t.enabled)
        // 優先使用 URL 參數的 terminalCode
        if (urlTerminal && this.terminals.some(t => t.code === urlTerminal)) {
          this.selectedTerminal = urlTerminal
          localStorage.setItem('posTerminal', urlTerminal)
        } else {
          // 否則恢復上次選擇的收銀機
          const saved = localStorage.getItem('posTerminal')
          if (saved && this.terminals.some(t => t.code === saved)) {
            this.selectedTerminal = saved
          } else if (this.terminals.length === 1) {
            this.selectedTerminal = this.terminals[0].code
          }
        }
      }).catch(() => { this.terminals = [] })
    },
    loadTables () {
      return this.$axios.get('/api/table/all').then(res => {
        this.tables = (res.data || []).map(t => Object.assign({ x: null, y: null }, t))
        if (!this.activeBoardZone && this.boardZones.length) this.activeBoardZone = this.boardZones[0]
        return this.loadUnfinished()
      }).catch(err => { console.log(err); return Promise.resolve() })
    },
    loadUnfinished () {
      return this.$axios.get('/api/order/unfinished').then(res => {
        this.unfinishedOrders = res.data || []
      }).catch(err => { console.log(err); return Promise.resolve() })
    },
    loadShopName () {
      this.$axios.get('/api/shop/get').then(res => {
        this.shopName = (res.data && res.data.shopName) || ''
        this.shopIntro = (res.data && res.data.shopIntro) || ''
      }).catch(() => {})
    },
    loadZones () {
      this.$axios.get('/api/zone/list').then(res => {
        this.zones = res.data || []
        if (this.zones.length && !this.zones.find(z => z.name === this.selectedZone)) this.selectedZone = this.zones[0].name
      }).catch(() => { this.zones = [{ name: '堂食' }, { name: '外賣' }, { name: '外帶' }, { name: '外送' }] })
    },
    loadMenu () {
      const mode = this.selectedZone || '堂食'
      Promise.all([
        this.$axios.get('/api/commodity/menu', { params: { mode, channel: 'pos' } }),
        this.$axios.get('/api/combo/menu')
      ]).then(([foodRes, comboRes]) => {
        this.goods = foodRes.data || []
        this.combos = comboRes.data || []
        if (this.goods.length) this.activeCategory = this.goods[0].name
      }).catch(err => console.log(err))
    },
    openComboPicker (combo) {
      if (combo.soldOut) { this.$message({ type: 'warning', message: '此套餐已售罄' }); return }
      const selections = {}
      ;(combo.groups || []).forEach((group, index) => {
        const defaults = group.fixed ? (group.items || []).map((_, i) => i) : []
        this.$set(selections, index, defaults)
      })
      this.comboDialog = { show: true, combo, selections, mods: {} }
    },
    comboSelected (gi, ii) {
      const combo = this.comboDialog.combo
      const group = combo && combo.groups ? combo.groups[gi] : null
      if (!group) return
      const selected = this.comboDialog.selections[gi] || []
      const index = selected.indexOf(ii)
      if (index >= 0) {
        if (!group.fixed) selected.splice(index, 1)
      } else {
        if (!group.allowRepeat && selected.length >= (group.max || 1)) {
          selected.splice(0, selected.length)
        }
        selected.push(ii)
      }
      this.$set(this.comboDialog.selections, gi, selected)
    },
    comboMods (gi, selIdx) {
      const key = gi + ':' + selIdx
      return (this.comboDialog.mods && this.comboDialog.mods[key]) || []
    },
    comboToggleMod (gi, selIdx, m) {
      const key = gi + ':' + selIdx
      const mods = (this.comboDialog.mods[key] || []).slice()
      const idx = mods.findIndex(x => x && (x.id || x.name) === (m.modCodeId || m.name))
      if (idx >= 0) mods.splice(idx, 1)
      else mods.push({ id: m.modCodeId || '', name: m.name, price: m.price || 0, station: m.station || '' })
      this.$set(this.comboDialog.mods, key, mods)
    },
    confirmCombo () {
      const combo = this.comboDialog.combo
      if (!combo) return
      const contents = []
      const snapshotGroups = []
      let extraTotal = 0
      for (let gi = 0; gi < (combo.groups || []).length; gi++) {
        const group = combo.groups[gi]
        const indexes = this.comboDialog.selections[gi] || []
        if (indexes.length < (group.min || 0) || indexes.length > (group.max || 1)) {
          this.$message({ type: 'warning', message: `請在「${group.name}」選擇 ${(group.min || 0)} 至 ${(group.max || 1)} 項` })
          return
        }
        const selected = indexes.map(ii => group.items[ii]).filter(Boolean)
        snapshotGroups.push({ name: group.name, station: group.station || '', items: selected.map(item => ({ commodityId: item.commodityId || '', name: item.name, price: item.price || 0, upgradePrice: item.upgradePrice || 0 })) })
        selected.forEach((item, selIdx) => {
          // Modifier Master：選中品項的改碼（走蔥/加蛋/轉凍飲 +$3）
          const chosenMods = this.comboMods(gi, selIdx)
          extraTotal += (item.upgradePrice || 0) + chosenMods.reduce((s, m) => s + (m && m.price ? Number(m.price) : 0), 0)
          contents.push({ _id: item.commodityId || '', commodityId: item.commodityId || '', name: item.name, price: (item.price || 0) + (item.upgradePrice || 0), count: 1, station: group.station || '', mods: chosenMods })
        })
      }
      const item = { _id: combo._id, name: combo.name, price: Math.round(((combo.price || 0) + extraTotal) * 100) / 100, count: 1, mods: [], discount: 1, free: false, customPrice: 0, contents, comboId: combo._id, comboName: combo.name, comboSnapshot: { type: combo.type, price: combo.price, groups: snapshotGroups }, sent: false }
      this.refreshItem(item)
      const cart = this.cart
      this.$set(this.carts, this.cartKey, cart.concat(item))
      this.comboDialog.show = false
    },
    loadModCodes () {
      this.$axios.get('/api/modcode/list', { params: { channel: 'pos' } }).then(res => { this.modCodeList = res.data || [] }).catch(() => { this.modCodeList = [] })
    },
    loadAmounts () {
      this.$axios.get('/api/amount/list').then(res => {
        const items = res.data || []
        this.payMethods = items.filter(i => i.key === 'payMethod')
        this.payTypes = items.filter(i => i.key === 'payType')
        if (this.payMethods.length && !this.payMethods.some(m => m.value === this.payDialog.method)) {
          this.payDialog.method = this.payMethods[0].value
        }
      }).catch(() => {})
    },
    loadPosSetting () {
      this.$axios.get('/api/possetting/get').then(res => {
        const d = res.data || {}
        this.serviceChargeEnabled = !!d.serviceChargeEnabled
        this.serviceChargeRate = d.serviceChargeRate || 10
        this.roundingMode = d.roundingMode || 'none'
        this.shareTableEnabled = !!d.shareTableEnabled
        this.showFoodImages = d.showFoodImages !== false
        this.orderLayout = d.orderLayout === 'classic' ? 'classic' : 'sidebar'
        this.orderTheme = ['indigo', 'ocean', 'emerald', 'sunset', 'dark'].indexOf(d.orderTheme) >= 0 ? d.orderTheme : 'indigo'
        this.showSideNav = d.showSideNav !== false
        this.ticketSide = d.ticketSide === 'left' ? 'left' : 'right'
        this.ticketWidth = Number(d.ticketWidth) || 0
        this.dockHeight = Number(d.dockHeight) || 0
        this.sideNavWidth = Number(d.sideNavWidth) || 0
        this.dockMinH = Number(d.dockMinH) || 0
        this.freeLayout = !!d.freeLayout
        this.panels = d.panels || {}
        this.panelColors = d.panelColors || {}
        this.btnPos = d.btnPos || {}
        this.btnColors = d.btnColors || {}
        this.hiddenBtns = Array.isArray(d.hiddenBtns) ? d.hiddenBtns : []
        this.sidebarBtnConfig = Array.isArray(d.sidebarButtons) ? d.sidebarButtons : []
        this.sidebarFontSize = (d.sidebarSettings && d.sidebarSettings.fontSize) || 12
        this.sidebarWidth = (d.sidebarSettings && d.sidebarSettings.width) || 130
        // 分市時間主檔（報表同步＋時段價）
        this.posSlots = Array.isArray(d.slots) ? d.slots.filter(s => s && s.name) : []
        const pbs = d.posBtnSettings || {}
        if (pbs.fontSize) this.posBtnFontSize = pbs.fontSize
        if (pbs.width) this.posBtnWidth = pbs.width
        if (pbs.height) this.posBtnHeight = pbs.height
        this.managerMenu = Array.isArray(d.managerMenu) ? d.managerMenu : []
        const cts = d.calledTagStyle || {}
        this.calledTagStyle = { color: cts.color || '#ea580c', background: cts.background || '#ffedd5', border: cts.border || '#fed7aa' }
        const bl = d.boardLayout || {}
        this.boardCardHeight = bl.cardHeight || 110
        this.boardCardWidth = bl.cardWidth || 0
        this.boardGridCols = bl.gridCols || 0
        this.boardGridRows = bl.gridRows || 0
        this.boardGap = bl.gap !== undefined ? bl.gap : 10
        this.btnPerms = Object.assign({}, this.btnPerms, d.btnPerms || {})
        const rawOrder = (d.buttonOrder && d.buttonOrder.length) ? d.buttonOrder.map(e => {
          if (typeof e === 'string') return { id: e }
          if (e.funcCode && !e.id) e.id = FUNC_CODE_TO_BTN_ID[e.funcCode] || ''
          return e
        }) : DEFAULT_BUTTON_ORDER.slice()
        rawOrder.forEach(e => { const bid = e.id || FUNC_CODE_TO_BTN_ID[e.funcCode] || ''; if (bid && e.perm) this.btnPerms[bid] = e.perm })
        this.buttonOrder = rawOrder
      }).catch(() => {})
    },
    loadHolds () {
      try { this.holdList = JSON.parse(localStorage.getItem('pos_hold') || '[]') } catch (e) { this.holdList = [] }
    },
    persistHolds () {
      try { localStorage.setItem('pos_hold', JSON.stringify(this.holdList)) } catch (e) {}
    },
    tablePos (t, i) {
      if (t.x !== null && t.x !== undefined && t.y !== null && t.y !== undefined) return { x: t.x, y: t.y }
      const cw = this.boardCardWidth || 200
      const ch = this.boardCardHeight || 110
      const gap = this.boardGap || 0
      const cols = this.boardGridCols || 5
      return { x: (i % cols) * (cw + gap), y: Math.floor(i / cols) * (ch + gap) }
    },
    floorStyle (t, i) {
      const p = this.tablePos(t, i)
      const style = { left: p.x + 'px', top: p.y + 'px' }
      if (!this.shareTableEnabled && t.shareSuffix) {
        style.transform = 'scale(0.85)'
        style.opacity = '0.85'
        style.zIndex = '1'
      }
      return style
    },
    onBoardMouseDown (t, e) {
      if (this.layoutMode) {
        e.preventDefault()
        this.startDrag(t, e)
      }
    },
    onBoardClick (t) {
      if (this.layoutMode) return
      if (this.shareTableEnabled) {
        const hasOrder = this.unfinishedOrders.some(o => o.deskNo === t.no && o.order && o.order.length)
        if (hasOrder) {
          const subTables = this.tables.filter(tb => tb.physicalNo === t.no && tb.shareSuffix)
          this.shareTablePanel = { show: true, deskNo: t.no, subTables }
          return
        }
      }
      this.enterTable(t.no)
    },
    enterShareTable (no) {
      this.shareTablePanel.show = false
      this.enterTable(no)
    },
    doShareTable () {
      this.shareTableDialog = { show: true, deskNo: this.shareTablePanel.deskNo, loading: false }
    },
    toggleLayout () { this.layoutMode = !this.layoutMode },
    startDrag (t, e) {
      const p = this.tablePos(t, this.boardTables.indexOf(t))
      this.drag = { table: t, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }
      const move = (ev) => {
        if (!this.drag) return
        const nx = Math.max(0, Math.round(this.drag.ox + (ev.clientX - this.drag.sx)))
        const ny = Math.max(0, Math.round(this.drag.oy + (ev.clientY - this.drag.sy)))
        this.$set(this.drag.table, 'x', nx)
        this.$set(this.drag.table, 'y', ny)
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        this.drag = null
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    },
    saveLayout () {
      const tables = []
      this.boardZones.forEach(z => {
        const list = this.tables.filter(t => (t.zone || '未分區') === z)
        list.forEach((t, i) => {
          const p = this.tablePos(t, i)
          tables.push({ _id: t._id, x: t.x === null || t.x === undefined ? p.x : t.x, y: t.y === null || t.y === undefined ? p.y : t.y })
        })
      })
      this.$axios.post('/api/table/layout', { tables })
        .then(res => { this.$message({ type: 'success', message: res.data }); this.layoutMode = false; this.loadTables() })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '儲存失敗' }))
    },
    boardClass (no) {
      if (no === this.selectedTable) return 'board-active'
      const orders = this.unfinishedOrders.filter(o => o.deskNo === no)
      if (orders.length) {
        if (orders.some(o => o.relisted)) return 'board-relisted'
        if (orders.some(o => o.source === 'qr' || o.source === 'extension')) return 'board-qr'
        if (orders.some(o => o.printed)) return 'board-printed'
        return 'board-busy'
      }
      return 'board-free'
    },
    boardStatus (no) {
      if (no === this.selectedTable) return '使用中'
      const orders = this.unfinishedOrders.filter(o => o.deskNo === no)
      if (orders.length) {
        if (orders.some(o => o.relisted)) return '退單'
        if (orders.some(o => o.source === 'qr' || o.source === 'extension')) return '使用中'
        if (orders.some(o => o.printed)) return '已印單'
        return '用餐中'
      }
      return '空枱'
    },
    tableAmount (no) {
      return this.unfinishedOrders.filter(o => o.deskNo === no).reduce((sum, o) => sum + (o.totalPrice || 0), 0)
    },
    tableDuration (no) {
      const order = this.unfinishedOrders.find(o => o.deskNo === no)
      return order && order.date ? this.durationText(order.date) : ''
    },
    hasOrder (no) {
      return this.unfinishedOrders.some(o => o.deskNo === no && o.order && o.order.length)
    },
    isTransferred (no) {
      return this.unfinishedOrders.some(o => o.deskNo === no && o.transferredFrom > 0)
    },
    tableLabel (t) {
      // 搭枱子枱顯示名稱（如 23A），退款虛擬枱顯示名稱（如 5Z），其餘顯示數字
      if (t.shareSuffix) return t.name || String(t.no)
      if (t.name && /^\d+Z$/.test(t.name)) return t.name
      return t.no
    },
    applyRounding (amount) {
      if (this.roundingMode === 'up') return Math.ceil(amount)
      if (this.roundingMode === 'down') return Math.floor(amount)
      if (this.roundingMode === 'normal') return Math.round(amount)
      return amount
    },
    login () {
      const no = this.loginNo.trim()
      if (!no || !this.loginPassword) {
        this.$message({ type: 'warning', message: '請輸入員工編號與密碼' })
        return
      }
      this.$axios.post('/api/staff/login', { no, password: this.loginPassword })
        .then(res => {
          this.loggedIn = true
          this.staffInfo = { no: String(res.data.no || ''), name: res.data.name, role: res.data.role, permissionLevel: res.data.permissionLevel || 1, permissions: res.data.permissions || [] }
          this.isManager = res.data.role === '管理員' || (res.data.permissionLevel || 1) >= 3
          this.waiter = res.data.name
          if (res.data.token) localStorage.setItem('orderTk', res.data.token)
          localStorage.setItem('posTerminal', this.selectedTerminal)
          this.view = 'board'
          this.loadTables()
          this.loadBizDayStatus()
        })
        .catch(err => {
          this.$message({ type: 'error', message: err.response ? err.response.data : '登入失敗' })
        })
    },
    enterTable (no) {
      const orders = this.unfinishedOrders.filter(o => o.deskNo === no && o.order && o.order.length)
      if (orders.some(o => o.source === 'qr' || o.source === 'extension')) {
        this.$message({ type: 'warning', message: '此枱由分機或 QR CODE 使用中，完成訂單後才可使用' })
        return
      }
      this.selectedTable = no
      this.selectedZone = '堂食'
      this.view = 'order'
      this.onTableChange()
      // 該枱已有未結單時，載入接續點餐
      const existingCart = this.carts[no] || []
      if (!existingCart.length) {
        const orders = this.unfinishedOrders.filter(o => o.deskNo === no)
        if (orders.length) {
          orders.forEach(o => {
            (o.order || []).forEach(item => {
              const ni = {
                _id: item._id || item.name,
                name: item.name,
                price: item.price || 0,
                count: item.count || 1,
                mods: item.mods || [],
                discount: item.discount || 1,
                free: !!item.free,
                customPrice: item.customPrice || 0,
                station: item.station,
                stations: item.stations,
                contents: item.contents || [],
                comboId: item.comboId,
                comboName: item.comboName,
                comboSnapshot: item.comboSnapshot,
                dishStatus: item.dishStatus || '',
                sent: true
              }
              this.refreshItem(ni)
              existingCart.push(ni)
            })
          })
          this.$set(this.carts, no, existingCart)
          if (orders.length) this.$message({ type: 'info', message: `已載入枱號 ${no} 的未結單（${orders.length} 筆）` })
        }
      }
    },
    enterTakeaway () {
      this.selectedZone = '外賣'
      this.view = 'order'
      if (!this.carts.takeaway) this.$set(this.carts, 'takeaway', [])
    },
    backToBoard () {
      this.view = 'board'
      this.selectedTable = null
      this.loadUnfinished()
    },
    logout () {
      localStorage.removeItem('orderTk')
      this.loggedIn = false
      this.loginNo = ''
      this.loginPassword = ''
      this.view = 'board'
      this.selectedTable = null
      this.carts = {}
    },
    onTableChange () {
      const t = this.tables.find(x => x.no === this.selectedTable)
      if (t) this.pax = t.seats || this.pax
      if (!this.carts[this.selectedTable]) this.$set(this.carts, this.selectedTable, [])
      this.orderDiscount = 0
    },
    calcUnit (item) {
      // Modifier Master：加價改碼（轉凍飲 +$3）計入單價
      const modsExtra = (item.mods || []).reduce((sum, m) => sum + (typeof m === 'object' && m && m.price ? Number(m.price) || 0 : 0), 0)
      const base = item.free ? 0 : ((item.customPrice > 0 ? item.customPrice : item.price) + modsExtra)
      return Math.round(base * (item.discount || 1) * 100) / 100
    },
    refreshItem (item) {
      item.unitPrice = this.calcUnit(item)
      item.subtotal = Math.round(item.unitPrice * item.count * 100) / 100
    },
    levelLabel (level) {
      if (level >= 4) return '管理員'
      if (level === 3) return '經理'
      if (level === 2) return '收銀員'
      return '服務員'
    },
    hasPermission (perm) {
      if ((this.staffInfo.permissionLevel || 1) >= 4) return true
      return (this.staffInfo.permissions || []).indexOf(perm) >= 0
    },
    openPluPad () {
      this.pluDialog = { show: true, value: this.pluInput || '' }
    },
    confirmPlu () {
      const code = (this.pluDialog.value || '').trim()
      if (!code) { this.pluDialog.show = false; return }
      this.pluInput = code
      this.pluDialog.show = false
      this.addByPlu()
    },
    addByPlu () {
      const code = (this.pluInput || '').trim()
      if (!code) return
      let found = null
      // 1) PLU 精確匹配
      this.goods.forEach(g => {
        if (!found) found = (g.foods || []).find(f => String(f.plu || '') === code)
      })
      // 2) 簡碼/名稱模糊搜尋：名稱包含關鍵字的第一個可點品項
      if (!found) {
        const kw = code.toLowerCase()
        this.goods.forEach(g => {
          if (!found) found = (g.foods || []).find(f => !f.soldOut && String(f.name || '').toLowerCase().indexOf(kw) >= 0)
        })
      }
      if (!found) { this.$message({ type: 'warning', message: '找不到該 PLU / 名稱品項' }); return }
      this.pluInput = ''
      this.addFood(found)
    },
    addFood (food) {
      if (food.soldOut) { this.$message({ type: 'warning', message: '此品項已沽清' }); return }
      const cart = this.cart
      const exist = cart.find(i => i._id === food._id && !(i.mods && i.mods.length) && !i.free && i.discount === 1 && !i.customPrice && !i.sent)
      if (exist) {
        exist.count++
        this.refreshItem(exist)
        this.$set(this.carts, this.cartKey, cart.slice())
      } else {
        const item = { _id: food._id, name: food.name, price: food.price, count: 1, mods: [], discount: 1, free: false, customPrice: 0, station: food.station, stations: food.stations, sent: false }
        this.refreshItem(item)
        this.$set(this.carts, this.cartKey, cart.concat(item))
      }
      this.scrollOrderList('bottom')
    },
    openTableSearch () {
      this.boardMode = 'search'
      this.tableSearchKeyword = ''
      this.tableSearchStatus = 'all'
    },
    sbVis (id) {
      const c = this.sidebarBtnConfig.find(b => b.id === id)
      return c ? c.visible !== false : true
    },
    sbStyle (id) {
      const c = this.sidebarBtnConfig.find(b => b.id === id)
      if (!c) return {}
      const s = {}
      if (c.bgColor) s.background = c.bgColor
      if (c.textColor) s.color = c.textColor
      return s
    },
    sbActiveClass (id) {
      if (id === 'grid' && this.boardMode === 'grid') return 'active'
      if (id === 'list' && this.boardMode === 'list') return 'active'
      if (id === 'search' && this.boardMode === 'search') return 'active'
      if (id === 'history' && this.boardMode === 'history') return 'active'
      if (id === 'takeaway' && this.boardZoneFilter === '外賣') return 'active'
      if (id === 'dineIn' && this.boardZoneFilter === '堂食') return 'active'
      return ''
    },
    sbIcon (id) {
      const icons = { grid: 'el-icon-menu', takeaway: 'el-icon-shopping-bag-2', dineIn: 'el-icon-office-building', list: 'el-icon-tickets', search: 'el-icon-search', history: 'el-icon-time', refresh: 'el-icon-refresh', addTable: 'el-icon-plus', batchPrint: 'el-icon-printer', report: 'el-icon-data-analysis', settings: 'el-icon-setting' }
      return icons[id] || 'el-icon-more'
    },
    sbClick (id) {
      if (id === 'grid') { this.boardMode = 'grid'; return }
      if (id === 'takeaway') { this.boardZoneFilter = '外賣'; return }
      if (id === 'dineIn') { this.boardZoneFilter = '堂食'; return }
      if (id === 'list') { this.boardMode = 'list'; return }
      if (id === 'search') { this.openTableSearch(); return }
      if (id === 'history') { this.openHistory(); return }
      if (id === 'refresh') { this.refreshBoard(); return }
      if (id === 'addTable') { this.boardAction('addTable'); return }
      if (id === 'batchPrint') { this.boardAction('print'); return }
      if (id === 'report') { this.boardAction('report'); return }
      if (id === 'settings') { this.openSoldOut(); return }
      if (BUTTON_META[id]) { this.runAction(id); return }
    },
    refreshBoard () {
      this.loadTables()
      this.$message({ type: 'success', message: '枱況已更新' })
    },
    durationText (date) {
      const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
      return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
    },
    onTableRowClick (row) {
      this.enterTable(row.table ? row.table.no : row.no)
    },
    tableRowClass ({ row }) {
      if (row.status === '使用中') return 'table-row-qr'
      if (row.status === '用餐中') return 'table-row-busy'
      if (row.status === '退單') return 'table-row-relisted'
      if (row.status === '已印單') return 'table-row-printed'
      return 'table-row-free'
    },
    openSoldOut () {
      const list = []
      this.goods.forEach(g => {
        (g.foods || []).forEach(f => {
          list.push({ _id: f._id, plu: f.plu || '', name: f.name, soldOut: !!f.soldOut, stock: f.stock === undefined || f.stock === null ? -1 : f.stock })
        })
      })
      this.soldOutDialog = { show: true, keyword: '', list, showItemPicker: false, pickerKeyword: '' }
    },
    soldOutRowClass ({ row }) {
      return row.soldOut ? 'soldout-highlight' : ''
    },
    toggleSoldOutFromPicker (food) {
      this.$axios.post('/api/commodity/soldout', { _id: food._id, soldOut: !food.soldOut })
        .then(() => {
          food.soldOut = !food.soldOut
          this.$message({ type: 'success', message: food.soldOut ? `「${food.name}」已加入售罄清單` : `「${food.name}」已從售罄清單移除` })
          this.syncSoldOutToFood(food)
          // 同步更新左側清單
          const row = this.soldOutDialog.list.find(x => x._id === food._id)
          if (row) this.$set(row, 'soldOut', food.soldOut)
        })
        .catch(() => this.$message({ type: 'error', message: '更新失敗' }))
    },
    removeFromSoldOut (row) {
      this.$axios.post('/api/commodity/soldout', { _id: row._id, soldOut: false })
        .then(() => {
          row.soldOut = false
          this.$message({ type: 'success', message: `「${row.name}」已從售罄清單移除` })
          this.syncSoldOutToFood(row)
        })
        .catch(() => this.$message({ type: 'error', message: '更新失敗' }))
    },
    setStock (row) {
      this.$axios.post('/api/commodity/soldout', { _id: row._id, stock: row.stock })
        .then(() => {
          // 前端同步：庫存 ≤ 0 自動沽清，> 0 自動重售（與後端邏輯一致）
          if (row.stock <= 0) {
            row.soldOut = true
            this.$message({ type: 'success', message: '限量庫存已歸零，已自動沽清' })
          } else if (row.soldOut) {
            row.soldOut = false
            this.$message({ type: 'success', message: '限量庫存已更新，已自動重售' })
          } else {
            this.$message({ type: 'success', message: '限量庫存已更新' })
          }
          this.syncSoldOutToFood(row)
        })
        .catch(() => this.$message({ type: 'error', message: '更新失敗' }))
    },
    syncSoldOutToFood (row) {
      this.goods.forEach(g => {
        const f = (g.foods || []).find(x => x._id === row._id)
        if (f) {
          this.$set(f, 'soldOut', row.soldOut)
          this.$set(f, 'stock', row.stock)
        }
      })
    },
    changeQty (index, delta) {
      const item = this.cart[index]
      if (item.sent && !this.hasPermission('order.changeSentQty')) {
        this.$message({ type: 'warning', message: '你沒有修改已落單品項數量的權限' })
        return
      }
      const nextCart = this.cart.slice()
      const nextItem = nextCart[index]
      nextItem.count += delta
      if (nextItem.count <= 0) nextCart.splice(index, 1)
      else this.refreshItem(nextItem)
      this.$set(this.carts, this.cartKey, nextCart)
    },
    // 長撳連加/連減（按住 0.4 秒後自動重複）
    startQtyHold (index, delta) {
      this.stopQtyHold()
      this.qtyHoldTimer = setTimeout(() => {
        this.qtyHoldTimer = setInterval(() => this.changeQty(index, delta), 140)
      }, 400)
    },
    stopQtyHold () {
      if (this.qtyHoldTimer) {
        clearTimeout(this.qtyHoldTimer)
        clearInterval(this.qtyHoldTimer)
        this.qtyHoldTimer = null
      }
    },
    // 底部操作欄：頻率分大小（送單/結帳特大，經理功能收細）
    bbClass (id) {
      // 功能格仔一樣大
      return ['bb-btn']
    },
    panelStyle (key) {
      const p = this.panels[key]
      if (!p || !this.freeLayout) return {}
      return { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px' }
    },
    btnStyle2 (b) {
      const st = Object.assign({}, this.btnStyle(b))
      st.fontSize = (b.fontSize || this.posBtnFontSize) + 'px'
      st.minWidth = (b.width || this.posBtnWidth) + 'px'
      st.width = (b.width || this.posBtnWidth) + 'px'
      if (b.height || this.posBtnHeight) st.height = (b.height || this.posBtnHeight) + 'px'
      const cf = b.colorFrom || ''
      const ct = b.colorTo || ''
      if (cf && ct) {
        st.background = `linear-gradient(145deg, #fff, ${cf})`
        st.borderColor = ct
        st.boxShadow = `0 1px 4px ${ct}40`
      } else if (cf) {
        st.backgroundColor = cf
        st.borderColor = cf
      }
      st.color = b.textColor || '#1e293b'
      return st
    },
    panelColorStyle (key) {
      const c = this.panelColors[key]
      return c ? { background: c } : {}
    },
    sideNavColorStyle () {
      return this.panelColorStyle('sideNav')
    },
    dockLeftColorStyle () {
      const c = this.panelColors.dock
      return c ? { background: c } : {}
    },
    dockMinHStyle () {
      const h = Number(this.dockMinH) || 0
      return h ? { minHeight: h + 'px' } : {}
    },
    padPress (n) {
      this.sideBuffer = (this.sideBuffer || '') + n
    },
    sideQtyPad () {
      this.qtyDialog = { show: true, index: null, value: this.sideBuffer || '' }
      this.sideBuffer = ''
    },
    sideOpenPlu () {
      this.pluDialog = { show: true, value: this.sideBuffer || '' }
      this.sideBuffer = ''
    },
    openQtyPad (index) {
      const item = this.cart[index]
      if (item.sent && !this.hasPermission('order.changeSentQty')) {
        this.$message({ type: 'warning', message: '你沒有修改已落單品項數量的權限' })
        return
      }
      this.qtyDialog = { show: true, index, value: String(item ? item.count : 1) }
    },
    openTableKeypad () {
      this.tableKeypad = { show: true, value: this.selectedTable ? String(this.selectedTable) : '' }
    },
    confirmTableKeypad () {
      const v = parseInt(this.tableKeypad.value, 10)
      if (!v) { this.$message({ type: 'warning', message: '請輸入有效枱號' }); return }
      if (!this.tableExists(v)) { this.$message({ type: 'warning', message: `枱號 ${v} 不存在` }); return }
      this.selectedTable = v
      this.onTableChange()
      this.tableKeypad.show = false
    },
    openPaxKeypad () {
      this.paxKeypad = { show: true, value: String(this.pax || 1) }
    },
    confirmPaxKeypad () {
      const n = parseInt(this.paxKeypad.value, 10)
      if (!n || n < 1 || n > 50) { this.$message({ type: 'warning', message: '請輸入 1-50 的人數' }); return }
      this.pax = n
      this.paxKeypad.show = false
    },
    confirmQty () {
      const item = this.cart[this.qtyDialog.index]
      if (!item) { this.qtyDialog.show = false; return }
      if (item.sent && !this.hasPermission('order.changeSentQty')) {
        this.$message({ type: 'warning', message: '你沒有修改已落單品項數量的權限' })
        this.qtyDialog.show = false
        return
      }
      const n = parseInt(this.qtyDialog.value, 10)
      if (!n || n < 1) { this.$message({ type: 'warning', message: '請輸入有效數量' }); return }
      const newCart = this.cart.slice()
      const newIdx = Object.assign({}, newCart[this.qtyDialog.index])
      newIdx.count = n
      this.refreshItem(newIdx)
      newCart[this.qtyDialog.index] = newIdx
      this.$set(this.carts, this.cartKey, newCart)
      this.qtyDialog.show = false
    },
    openItemDialog (index) {
      const item = this.cart[index]
      this.itemDialog = { show: true, index, mods: (item.mods || []).slice(), customMod: '' }
    },
    editItemMods (index) {
      const item = this.cart[index]
      if (item && item.sent) {
        if (!this.hasPermission('order.changeSentMods')) {
          this.$message({ type: 'warning', message: '你沒有修改已落單品項改碼的權限' })
          return
        }
      }
      this.openItemDialog(index)
    },
    toggleMod (m) {
      const mods = this.itemDialog.mods
      const idx = mods.findIndex(x => x && (x.id || x.name) === m._id)
      if (idx >= 0) mods.splice(idx, 1)
      else mods.push({ id: m._id, name: m.name, price: m.price || 0, station: m.station || '' })
    },
    addCustomMod () {
      const name = this.itemDialog.customMod.trim()
      if (!name) return
      if (!this.itemDialog.mods.some(x => x && (x.id || x.name) === name)) this.itemDialog.mods.push({ name })
      this.itemDialog.customMod = ''
    },
    modNames (mods) {
      return (mods || []).map(m => {
        if (typeof m === 'string') return m
        if (!m) return ''
        return (m.code ? m.code + ' ' : '') + (m.name || '')
      }).filter(Boolean)
    },
    slotBadge (categoryName) {
      const g = this.goods.find(x => x.name === categoryName)
      return g && g.slotActive ? g.slotName : ''
    },
    catPillStyle (categoryName) {
      const colors = this.catColorMap[categoryName]
      if (!colors || !colors.colorFrom || !colors.colorTo) return {}
      return {
        background: `linear-gradient(145deg, #fff, ${colors.colorFrom})`,
        borderColor: colors.colorTo,
        color: '#1e293b',
        boxShadow: `0 1px 4px ${colors.colorTo}40`
      }
    },
    foodBtnStyle () {
      const colors = this.catColorMap[this.activeCategory]
      if (!colors || !colors.colorFrom || !colors.colorTo) return {}
      return {
        background: `linear-gradient(145deg, #fff, ${colors.colorFrom})`,
        borderColor: colors.colorTo,
        boxShadow: `0 1px 3px ${colors.colorTo}20`
      }
    },
    // 純文字模式：類別固定顏色（九宮格靠顏色記憶），無類別時用穩定雜湊色
    foodColor (category) {
      const palette = ['#e74c3c', '#e67e22', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#d35400', '#2c3e50', '#c0392b', '#009688', '#34495e', '#7f8c8d']
      const idx = this.categories.indexOf(category)
      if (idx >= 0) return palette[idx % palette.length]
      let hash = 0
      const key = String(category || 'default')
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 997
      return palette[hash % palette.length]
    },
    confirmItemDialog () {
      const newCart = this.cart.slice()
      const item = newCart[this.itemDialog.index]
      if (item) {
        const newItem = Object.assign({}, item)
        newItem.mods = this.itemDialog.mods.slice()
        this.refreshItem(newItem)
        newCart[this.itemDialog.index] = newItem
      }
      this.$set(this.carts, this.cartKey, newCart)
      this.itemDialog.show = false
    },
    openWholeDiscount () {
      const amount = this.orderDiscount || 0
      const pct = this.totalPrice > 0 ? Math.round(amount / this.totalPrice * 10000) / 100 : 0
      this.wholeDiscountDialog = { show: true, pct, amount }
    },
    onWholePct (v) {
      this.wholeDiscountDialog.pct = v || 0
      this.wholeDiscountDialog.amount = Math.round(this.totalPrice * (v || 0) / 100 * 100) / 100
    },
    onWholeAmount (v) {
      this.wholeDiscountDialog.amount = v || 0
      this.wholeDiscountDialog.pct = this.totalPrice > 0 ? Math.round((v || 0) / this.totalPrice * 10000) / 100 : 0
    },
    confirmWholeDiscount () {
      this.orderDiscount = Math.round((this.wholeDiscountDialog.amount || 0) * 100) / 100
      this.wholeDiscountDialog.show = false
    },
    // 項目折扣（先設折扣，再點選品項套用）
    openItemDiscount () {
      if (this.pendingItemDiscount) {
        this.pendingItemDiscount = null
        this.$message({ type: 'info', message: '已取消項目折扣模式' })
        return
      }
      this.itemDiscountDialog = { show: true, pct: 0, amount: 0, free: false }
    },
    onItemDiscountPct (v) {
      this.itemDiscountDialog.pct = v || 0
      if (v > 0) this.itemDiscountDialog.amount = 0
    },
    onItemDiscountAmount (v) {
      this.itemDiscountDialog.amount = v || 0
      if (v > 0) this.itemDiscountDialog.pct = 0
    },
    confirmItemDiscount () {
      const d = this.itemDiscountDialog
      if (!d.free && !d.pct && !d.amount) { this.$message({ type: 'warning', message: '請輸入折扣%或折扣金額或勾選贈送' }); return }
      this.pendingItemDiscount = { pct: d.pct || 0, amount: d.amount || 0, free: !!d.free }
      this.itemDiscountDialog.show = false
      this.$message({ type: 'info', message: '請點選要套用折扣的品項' })
    },
    applyItemDiscount (index) {
      const item = this.cart[index]
      const d = this.pendingItemDiscount
      if (!d || !item) return
      item.free = d.free
      if (d.free) {
        item.discount = 1
        item.customPrice = 0
      } else if (d.amount > 0) {
        item.customPrice = Math.max(0, Math.round((item.price - d.amount) * 100) / 100)
        item.discount = 1
      } else if (d.pct > 0) {
        item.discount = Math.round((100 - d.pct) / 100 * 100) / 100
        item.customPrice = 0
      } else {
        item.discount = 1
        item.customPrice = 0
      }
      this.refreshItem(item)
    },
    openPay () {
      if (!this.cart.length) { this.$message({ type: 'warning', message: '請先點餐' }); return }
      const defaultMethod = this.payMethods.length ? this.payMethods[0].value : '現金'
      this.payDialog = { show: true, method: defaultMethod, cashStr: String(this.grandTotal), change: 0, invoiceNo: '' }
      this.calcChange()
    },
    onCashInput (v) {
      this.payDialog.cashStr = v
      this.calcChange()
    },
    confirmCashInput () {
      // 快速帶入應收金額（若未輸入則用應收）
      if (!this.payDialog.cashStr) this.payDialog.cashStr = String(this.grandTotal)
      this.calcChange()
    },
    calcChange () {
      if (!this.isCashMethod) { this.payDialog.change = 0; return }
      const cash = Number(this.payDialog.cashStr || 0)
      this.payDialog.change = Math.round((cash - this.grandTotal) * 100) / 100
    },
    onPayMethodChange () {
      this.calcChange()
    },
    payInputDigit (d) {
      if (this.payDialog.cashStr === '0') this.payDialog.cashStr = ''
      this.payDialog.cashStr += d
      this.calcChange()
    },
    payInputDot () {
      if (this.payDialog.cashStr.indexOf('.') >= 0) return
      this.payDialog.cashStr += '.'
    },
    payInputDel () {
      this.payDialog.cashStr = this.payDialog.cashStr.slice(0, -1)
      this.calcChange()
    },
    payQuickAmount (type) {
      if (type === 'full') this.payDialog.cashStr = String(this.grandTotal)
      else if (type === 'half') this.payDialog.cashStr = String(Math.ceil(this.grandTotal / 2))
      else this.payDialog.cashStr = ''
      this.calcChange()
    },
    confirmPay () {
      if (this.isCashMethod && Number(this.payDialog.cashStr || 0) < this.grandTotal) {
        this.$message({ type: 'warning', message: '實收金額不足' }); return
      }
      const newItems = this.cart.filter(i => !i.sent)
      const newTotal = Math.round(newItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100
      const submitNew = () => {
        if (!newItems.length) return Promise.resolve()
        const order = newItems.map(i => ({
          _id: i._id,
          name: i.name,
          price: i.price,
          count: i.count,
          station: i.station,
          stations: i.stations,
          mods: i.mods || [],
          discount: i.discount,
          free: i.free,
          customPrice: i.customPrice
        }))
        return this.$axios.post('/api/order/submit', { deskNo: this.isDineIn ? this.selectedTable : 0, order, remark: this.orderRemark, totalPrice: newTotal, zone: this.selectedZone, waiter: this.waiter, terminalCode: this.selectedTerminal })
      }
      submitNew()
        .then(() => this.$axios.get('/api/order/unfinished'))
        .then(r => {
          const os = (r.data || []).filter(o => o.deskNo === (this.isDineIn ? this.selectedTable : 0))
          return os.length ? os[0] : null
        })
        .then(latest => {
          if (!latest) throw new Error('no order')
          const invoiceNo = 'INV-' + latest.orderNo
          this.payDialog.invoiceNo = invoiceNo
          const payMethod = this.payDialog.method || '現金'
          // 整單折扣 + 服務費：結帳時套用到訂單
          const discount = Math.round((this.orderDiscount || 0) * 100) / 100
          const discounted = Math.round((latest.totalPrice - discount) * 100) / 100
          const finalTotal = Math.round((discounted + this.serviceChargeAmount) * 100) / 100
          const finishPayload = {
            _id: latest._id,
            totalPrice: finalTotal,
            serviceCharge: this.serviceChargeAmount,
            discount,
            pax: this.pax,
            waiter: this.waiter,
            payMethod,
            terminalCode: this.selectedTerminal
          }
          return this.$axios.post('/api/order/finish', finishPayload).then(() => {
            return this.$axios.post('/api/order/print', { _id: latest._id, type: 'receipt', invoiceNo, payMethod }).catch(() => {})
          })
        })
        .then(() => {
          const change = this.isCashMethod ? `，找零 $${this.payDialog.change}` : ''
          this.$message({ type: 'success', message: `收款完成${change}，發票流水號 ${this.payDialog.invoiceNo}` })
          this.payDialog.show = false
          this.clearCart()
          return this.loadUnfinished()
        })
        .then(() => {
          this.view = 'board'
          this.selectedTable = null
        })
        .catch(e => { if (e.message !== 'no order') this.$message({ type: 'error', message: '結帳失敗' }) })
    },
    quickCashCheckout () {
      if (!this.cart.length) { this.$message({ type: 'warning', message: '請先點餐' }); return }
      this.$confirm(`確定以現金 $${this.grandTotal} 直接結帳？`, '現金結帳', { confirmButtonText: '確定', cancelButtonText: '取消', type: 'warning' })
        .then(() => {
          const defaultMethod = this.payMethods.find(m => /現金|cash/i.test(m.value))
          const payMethodName = defaultMethod ? defaultMethod.value : '現金'
          const newItems = this.cart.filter(i => !i.sent)
          const newTotal = Math.round(newItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100
          const submitNew = () => {
            if (!newItems.length) return Promise.resolve()
            const order = newItems.map(i => ({
              _id: i._id,
              name: i.name,
              price: i.price,
              count: i.count,
              station: i.station,
              stations: i.stations,
              mods: i.mods || [],
              discount: i.discount,
              free: i.free,
              customPrice: i.customPrice
            }))
            return this.$axios.post('/api/order/submit', {
              deskNo: this.isDineIn ? this.selectedTable : 0,
              order,
              remark: this.orderRemark,
              totalPrice: newTotal,
              zone: this.selectedZone,
              waiter: this.waiter,
              terminalCode: this.selectedTerminal
            })
          }
          submitNew()
            .then(() => this.$axios.get('/api/order/unfinished'))
            .then(r => {
              const os = (r.data || []).filter(o => o.deskNo === (this.isDineIn ? this.selectedTable : 0))
              return os.length ? os[0] : null
            })
            .then(latest => {
              if (!latest) throw new Error('no order')
              const invoiceNo = 'INV-' + latest.orderNo
              const discount = Math.round((this.orderDiscount || 0) * 100) / 100
              const discounted = Math.round((latest.totalPrice - discount) * 100) / 100
              const finalTotal = Math.round((discounted + this.serviceChargeAmount) * 100) / 100
              return this.$axios.post('/api/order/finish', {
                _id: latest._id,
                totalPrice: finalTotal,
                serviceCharge: this.serviceChargeAmount,
                discount,
                pax: this.pax,
                waiter: this.waiter,
                payMethod: payMethodName,
                terminalCode: this.selectedTerminal
              }).then(() => this.$axios.post('/api/order/print', {
                _id: latest._id,
                type: 'receipt',
                invoiceNo,
                payMethod: payMethodName
              }).catch(() => {}))
            })
            .then(() => {
              this.$message({ type: 'success', message: '現金結帳成功' })
              this.clearCart()
              return this.loadUnfinished()
            })
            .then(() => { this.view = 'board'; this.selectedTable = null })
            .catch(e => { if (e.message !== 'no order') this.$message({ type: 'error', message: '現金結帳失敗' }) })
        })
        .catch(() => {})
    },
    openMerge () {
      this.splitMoved = []
      this.splitLeftSel = []
      this.splitRightSel = []
      this.tableDialog = { show: true, mode: 'merge', title: '合拼枱', fromTable: null, toTable: null, padValue: '' }
    },
    openSplit () {
      this.splitMoved = []
      this.splitLeftSel = []
      this.splitRightSel = []
      this.tableDialog = { show: true, mode: 'split', title: '分單', fromTable: null, toTable: null, padValue: '' }
    },
    toggleLeftSel (i) {
      const idx = this.splitLeftSel.indexOf(i)
      if (idx >= 0) this.splitLeftSel.splice(idx, 1)
      else this.splitLeftSel.push(i)
    },
    toggleRightSel (i) {
      const idx = this.splitRightSel.indexOf(i)
      if (idx >= 0) this.splitRightSel.splice(idx, 1)
      else this.splitRightSel.push(i)
    },
    moveRight () {
      this.splitLeftSel.forEach(i => {
        if (this.splitMoved.indexOf(i) < 0) this.splitMoved.push(i)
      })
      this.splitLeftSel = []
    },
    moveLeft () {
      this.splitMoved = this.splitMoved.filter(i => this.splitRightSel.indexOf(i) < 0)
      this.splitRightSel = []
    },
    onPadInput (which, v) {
      if (which === 'transfer') {
        this.transferDialog.padValue = v
        this.transferDialog.toTable = v === '' ? null : Number(v)
      } else {
        this.tableDialog.padValue = v
        if (this.tableDialog.mode === 'merge') this.tableDialog.fromTable = v === '' ? null : Number(v)
        else this.tableDialog.toTable = v === '' ? null : Number(v)
      }
    },
    tableExists (no) {
      return this.tables.some(t => t.no === no)
    },
    reloadCurrentCart () {
      const no = this.selectedTable
      const unsent = (this.carts[no] || []).filter(i => !i.sent)
      const items = []
      this.unfinishedOrders.filter(o => o.deskNo === no).forEach(o => {
        (o.order || []).forEach(item => {
          const ni = {
            _id: item._id || item.name,
            name: item.name,
            price: item.price || 0,
            count: item.count || 1,
            mods: item.mods || [],
            discount: item.discount || 1,
            free: !!item.free,
            customPrice: item.customPrice || 0,
            station: item.station,
            stations: item.stations,
            sent: true
          }
          this.refreshItem(ni)
          items.push(ni)
        })
      })
      this.$set(this.carts, no, items.concat(unsent))
    },
    confirmTableOp () {
      if (this.tableDialog.mode === 'merge') {
        const to = this.tableDialog.fromTable
        if (to === null || to === undefined) { this.$message({ type: 'warning', message: '請輸入要併入的枱號' }); return }
        if (!this.tableExists(to)) { this.$message({ type: 'warning', message: `枱號 ${to} 不存在` }); return }
        if (to === this.selectedTable) { this.$message({ type: 'warning', message: '不能併入目前枱號' }); return }
        // 相反邏輯：把「目前枱」併入「目標枱」（目標枱保留，目前枱清空）
        if (!this.carts[to]) this.$set(this.carts, to, [])
        const target = this.carts[to]
        const source = this.cart
        source.forEach(item => {
          const exist = target.find(i => i._id === item._id && JSON.stringify(i.mods) === JSON.stringify(item.mods))
          if (exist) exist.count += item.count
          else target.push(JSON.parse(JSON.stringify(item)))
        })
        this.$set(this.carts, this.selectedTable, [])
        this.$message({ type: 'success', message: `已將枱號 ${this.selectedTable} 併入枱號 ${to}` })
        // 後端持久化：目前枱 -> 目標枱
        this.$axios.post('/api/order/transfer', { from: this.selectedTable, to })
          .then(() => this.loadTables())
          .catch(() => {})
        this.tableDialog.show = false
        this.backToBoard()
      } else {
        const to = this.tableDialog.toTable
        const indexes = this.splitMoved
        if (to === null || to === undefined) { this.$message({ type: 'warning', message: '請輸入目標枱號' }); return }
        if (!this.tableExists(to)) { this.$message({ type: 'warning', message: `枱號 ${to} 不存在` }); return }
        if (to === this.selectedTable) { this.$message({ type: 'warning', message: '不能分單到目前枱號' }); return }
        if (!indexes.length) { this.$message({ type: 'warning', message: '請先將品項移到新枱' }); return }
        this.$axios.post('/api/order/split', { from: this.selectedTable, to, indexes })
          .then(res => {
            this.$message({ type: 'success', message: res.data })
            this.tableDialog.show = false
            return this.$axios.get('/api/order/unfinished')
          })
          .then(r => {
            this.unfinishedOrders = r.data || []
            this.reloadCurrentCart()
          })
          .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '分單失敗' }))
      }
    },
    // 換枱 / 轉枱
    openTransfer (from) {
      const validFrom = (typeof from === 'number') ? from : this.selectedTable
      this.transferDialog = { show: true, from: validFrom, toTable: null, padValue: '' }
    },
    confirmTransfer () {
      const from = this.transferDialog.from
      const to = this.transferDialog.toTable
      if (to === null || to === undefined) { this.$message({ type: 'warning', message: '請輸入目標枱號' }); return }
      if (!this.tableExists(to)) { this.$message({ type: 'warning', message: `枱號 ${to} 不存在` }); return }
      if (to === from) { this.$message({ type: 'warning', message: '目標枱號與來源枱號相同' }); return }
      this.$axios.post('/api/order/transfer', { from, to })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.transferDialog.show = false
          this.$set(this.carts, from, [])
          this.loadTables()
          this.backToBoard()
        })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '轉枱失敗' }))
    },
    // 加枱
    openAddTable () {
      this.addTableDialog = { show: true, padValue: '', no: null, seats: 4, zone: this.activeBoardZone || '堂食' }
    },
    onAddNo (v) {
      this.addTableDialog.padValue = v
      this.addTableDialog.no = v === '' ? null : Number(v)
    },
    confirmAddTable () {
      const no = this.addTableDialog.no
      if (!no) { this.$message({ type: 'warning', message: '請輸入枱號' }); return }
      if (this.tables.some(t => t.no === no)) { this.$message({ type: 'warning', message: `枱號 ${no} 已存在` }); return }
      this.$axios.post('/api/table/add', { no, seats: this.addTableDialog.seats, zone: this.addTableDialog.zone, enabled: true })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.addTableDialog.show = false
          this.loadTables()
        })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '加枱失敗' }))
    },
    // 掛單 / 叫回
    holdOrder () {
      const unsent = this.cart.filter(i => !i.sent)
      if (!unsent.length) { this.$message({ type: 'warning', message: '沒有未下單的品項可掛單' }); return }
      const label = this.isDineIn ? `枱 ${this.selectedTable} ${this.formatTime(new Date())}` : `${this.selectedZone} ${this.formatTime(new Date())}`
      this.holdList.push({ label, zone: this.selectedZone, deskNo: this.isDineIn ? this.selectedTable : 0, items: JSON.parse(JSON.stringify(unsent)), remark: this.orderRemark })
      // 移除已掛單的未送品項
      const remaining = this.cart.filter(i => i.sent)
      this.$set(this.carts, this.cartKey, remaining)
      this.orderRemark = ''
      this.persistHolds()
      this.$message({ type: 'success', message: '已掛單，可稍後叫回' })
    },
    openHold () { this.holdDialog.show = true },
    recallHold (index) {
      const h = this.holdList[index]
      if (!h) return
      // 若目標枱/單別不同，切換過去
      if (h.deskNo) {
        this.selectedZone = '堂食'
        this.selectedTable = h.deskNo
        this.onTableChange()
      } else {
        this.selectedZone = h.zone
        if (!this.carts.takeaway) this.$set(this.carts, 'takeaway', [])
      }
      const target = this.cart
      h.items.forEach(item => {
        const exist = target.find(i => i.name === item.name && JSON.stringify(i.mods || []) === JSON.stringify(item.mods || []))
        if (exist) exist.count += item.count
        else target.push(JSON.parse(JSON.stringify(item)))
      })
      if (h.remark) this.orderRemark = h.remark
      this.holdList.splice(index, 1)
      this.persistHolds()
      this.holdDialog.show = false
      this.view = 'order'
      this.$message({ type: 'success', message: '已叫回掛單' })
    },
    delHold (index) {
      this.holdList.splice(index, 1)
      this.persistHolds()
    },
    formatTime (d) {
      if (!d) return '--'
      const t = new Date(d)
      const p = n => (n < 10 ? '0' + n : '' + n)
      return `${p(t.getHours())}:${p(t.getMinutes())}`
    },
    money (v) {
      return (Number(v) || 0).toFixed(2)
    },
    formatMoney (v) {
      return (Number(v) || 0).toFixed(2)
    },
    formatDate (d) {
      if (!d) return ''
      const t = new Date(d)
      const p = n => (n < 10 ? '0' + n : '' + n)
      return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`
    },
    historyItemSeparator (index, order) {
      const len = (order || []).length
      return index < Math.min(len, 4) - 1 ? '、' : ''
    },
    openHistory () {
      this.boardMode = 'history'
      this.historyPage = 1
      this.loadHistoryOrders()
    },
    loadHistoryOrders () {
      this.historyLoading = true
      const params = {
        index: this.historyPage,
        size: 20
      }
      if (this.historyDateRange && this.historyDateRange.length === 2) {
        params.search = this.historyDateRange[0]
      }
      this.$axios.post('/api/order/finished', params)
        .then(res => {
          this.historyOrders = (res.data && res.data.result) || []
          this.historyTotal = (res.data && res.data.total) || 0
        })
        .catch(() => {
          this.historyOrders = []
          this.historyTotal = 0
        })
        .finally(() => {
          this.historyLoading = false
        })
    },
    // 更改已結帳單
    openReport () {
      const today = new Date()
      const td = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
      this.reportDialog = { show: true, type: 'cashier', scope: 'all', dateRange: [td, td], slot: 'all', result: null, selecting: null, dateMode: 'today' }
    },
    selectReportType (r) {
      this.reportDialog.selecting = r
      this.reportDialog.type = r.id
      this.reportDialog.scope = 'all'
      this.reportDialog.dateRange = []
    },
    generateReport () {
      let dateRange = this.reportDialog.dateRange
      if (this.reportDialog.dateMode === 'today') {
        const today = new Date()
        const y = today.getFullYear()
        const m = String(today.getMonth() + 1).padStart(2, '0')
        const d = String(today.getDate()).padStart(2, '0')
        dateRange = [y + '-' + m + '-' + d, y + '-' + m + '-' + d]
      }
      if (!dateRange || dateRange.length < 2) {
        this.$message({ type: 'warning', message: '請選擇日期範圍' })
        return
      }
      this.$axios.post('/api/statistic/posReport', {
        type: this.reportDialog.type,
        scope: this.reportDialog.scope,
        date_from: dateRange[0],
        date_to: dateRange[1],
        slot: this.reportDialog.dateMode === 'today' ? 'all' : this.reportDialog.slot,
        waiter: this.reportDialog.scope === 'personal' ? this.staffInfo.name : ''
      })
        .then(res => {
          this.reportDialog.result = res.data || { title: '報表', subtitle: '', rows: [], printTime: '' }
        })
        .catch(() => this.$message({ type: 'error', message: '獲取報表失敗' }))
    },
    printReport () {
      const printContent = document.getElementById('reportPrintArea')
      if (!printContent) return
      const w = window.open('', '_blank')
      w.document.write('<html><head><title>列印報表</title>')
      w.document.write('<style>body{font-family:monospace;padding:20px;} table{width:100%;border-collapse:collapse;} td,th{padding:4px 8px;border-bottom:1px dashed #ccc;font-size:13px;} .rr-title{text-align:center;font-size:18px;font-weight:bold;} .rr-subtitle{text-align:center;font-size:12px;color:#666;margin-bottom:10px;} .rr-bold{font-weight:bold;} .report-result-footer{margin-top:12px;font-size:11px;color:#999;border-top:1px solid #ddd;padding-top:8px;}</style>')
      w.document.write('</head><body>')
      w.document.write(printContent.innerHTML)
      w.document.write('</body></html>')
      w.document.close()
      w.print()
    },
    loadBizDayStatus () {
      this.$axios.get('/api/businessday/current').then(res => {
        this.bizDayStatus = res.data || { date: '', isOpen: false, businessDay: null, cutoff: '03:00' }
        // 登入畫面不自動彈出每日結算對話框
      }).catch(() => {})
    },
    openDayReport () {
      this.dayReportDialog = { show: true, result: null, loading: true, startingCash: '', countedCash: '', remark: '' }
      this.$axios.post('/api/businessday/dayReport', {}).then(res => {
        this.dayReportDialog.result = res.data
      }).catch(err => {
        this.$message({ type: 'error', message: (err.response && err.response.data) || '獲取每日結算報表失敗' })
        this.dayReportDialog.show = false
      }).finally(() => { this.dayReportDialog.loading = false })
    },
    confirmDayClose () {
      this.$confirm('確定要進行每日結算？結算後本營業日將關閉。', '每日結算確認', { type: 'warning' }).then(() => {
        this.dayReportDialog.loading = true
        this.$axios.post('/api/businessday/close', {
          startingCash: Number(this.dayReportDialog.startingCash) || 0,
          countedCash: Number(this.dayReportDialog.countedCash) || 0,
          remark: this.dayReportDialog.remark,
          staffName: this.staffInfo.name || ''
        }).then(res => {
          this.$message({ type: 'success', message: res.data.message || '每日結算成功！' })
          this.dayReportDialog.show = false
          this.loadBizDayStatus()
        }).catch(err => {
          this.$message({ type: 'error', message: (err.response && err.response.data) || '每日結算失敗' })
        }).finally(() => { this.dayReportDialog.loading = false })
      }).catch(() => {})
    },
    moreCommand (cmd) {
      this.runAction(cmd)
    },
    btnStyle (b) {
      if (!b.color) return {}
      return { backgroundColor: b.color, borderColor: b.color, color: '#fff' }
    },
    btnLabel (b) {
      if (b.id === 'itemDiscount' && this.pendingItemDiscount) return '項目折扣中…'
      return b.label
    },
    btnType (b) {
      if (b.id === 'itemDiscount' && this.pendingItemDiscount) return 'warning'
      return b.type || ''
    },
    btnDisabled (b) {
      if (b.id !== 'print') return false
      const deskNo = this.isDineIn ? this.selectedTable : 0
      const orders = this.unfinishedOrders.filter(o => o.deskNo === deskNo)
      return !orders.length || !!orders[0].printed
    },
    boardAction (id) {
      if (id === 'print') { this.openBatchPrint(); return }
      this.runAction(id)
    },
    openBatchPrint () {
      this.batchChecked = {}
      this.boardTables.forEach(t => this.$set(this.batchChecked, t.no, false))
      this.batchPrintDialog.show = true
    },
    bpDisabled (t) {
      return !this.unfinishedOrders.some(o => o.deskNo === t.no && !o.printed)
    },
    confirmBatchPrint () {
      const selected = this.boardTables.filter(t => this.batchChecked[t.no])
      if (!selected.length) { this.$message({ type: 'warning', message: '請至少勾選一張枱' }); return }
      const pending = selected
        .map(t => this.unfinishedOrders.find(o => o.deskNo === t.no && !o.printed))
        .filter(Boolean)
      if (!pending.length) { this.$message({ type: 'warning', message: '所選枱台沒有可列印的未印訂單' }); return }
      Promise.all(pending.map(o =>
        this.$axios.post('/api/order/print', { _id: o._id, type: 'print' })
          .then(() => { this.$set(o, 'printed', true); return true })
          .catch(() => false)
      )).then(results => {
        const ok = results.filter(Boolean).length
        this.$message({ type: 'success', message: `批量列印完成：成功 ${ok} 張` })
        this.batchPrintDialog.show = false
        this.batchChecked = {}
        this.loadUnfinished()
      })
    },
    showNoPermission (id, requiredLevel) {
      const name = (BUTTON_META[id] && BUTTON_META[id].label) || id
      this.noPermDialog = { show: true, name, requiredLevel }
    },
    runAction (id) {
      // 觸感回饋（支援震動的裝置）
      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(12)
      // 檢查按鈕權限
      const perm = (this.btnPerms[id] !== undefined) ? this.btnPerms[id] : (this.buttonOrder.find(e => e.id === id) || {}).perm || 1
      if (perm > (this.staffInfo.permissionLevel || 1)) {
        this.showNoPermission(id, perm)
        return
      }
      switch (id) {
        case 'merge': this.openMerge(); break
        case 'split': this.openSplit(); break
        case 'transfer': this.openTransfer(); break
        case 'hold': this.holdOrder(); break
        case 'recall': this.openHold(); break
        case 'print': this.printTicket('print'); break
        case 'chase': this.printTicket('kitchen'); break
        case 'serving': this.printTicket('serving'); break
        case 'qrcode': this.printTicket('qrcode'); break
        case 'wholeDiscount': this.openWholeDiscount(); break
        case 'itemDiscount': this.openItemDiscount(); break
        case 'clear': this.clearNewItems(); break
        case 'submit': this.submitOrder(); break
        case 'send': this.sendOrder(); break
        case 'checkout': this.openPay(); break
        case 'cashCheckout': this.quickCashCheckout(); break
        case 'soldout': this.openSoldOut(); break
        case 'refund': this.openRefund(); break
        case 'report': this.openReport(); break
        case 'manager': this.openManager(); break
        case 'openDrawer': this.openDrawerAction(); break
        case 'addTable': this.openAddTable(); break
        case 'cancelAll': this.cancelAll(); break
        case 'cancelItem': this.cancelItemFromBtn(); break
        case 'staff': this.openStaffPerm(); break
        case 'callDish': this.openCallDish(); break
        case 'serveDish': this.openServeDish(); break
        case 'reprint': this.openReprint(); break
        case 'shareTable': this.openShareTable(); break
        case 'login': this.login(); break
        case 'logoutBtn': this.logout(); break
        case 'changePwd': this.openChangePwd(); break
      }
    },
    openStaffPerm () {
      window.open('/admin/staff', '_blank')
    },
    openDrawerAction () {
      if (!this.selectedTerminal) {
        this.$message({ type: 'warning', message: '未設置收銀機，無法開啟銀櫃' })
        return
      }
      this.$axios.post('/api/printer/openDrawer', { terminalCode: this.selectedTerminal })
        .then(res => { this.$message({ type: 'success', message: res.data || '銀櫃已開啟' }) })
        .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '銀櫃開啟失敗' }) })
    },
    openShareTable () {
      const deskNo = this.selectedTable || 0
      if (!deskNo) { this.$message({ type: 'warning', message: '請先選擇要搭枱的物理枱號' }); return }
      const subTables = this.tables.filter(tb => tb.physicalNo === deskNo && tb.shareSuffix)
      this.shareTablePanel = { show: true, deskNo, subTables }
    },
    doShareTable () {
      const deskNo = this.shareTablePanel.deskNo
      this.$axios.post('/api/order/shareTable', { deskNo })
        .then(res => {
          this.shareTablePanel.show = false
          const newNo = res.data.table ? res.data.table.no : 0
          return this.loadTables().then(() => {
            if (newNo) this.enterTable(newNo)
          })
        })
        .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '搭枱失敗' }) })
    },
    openReprint () {
      const deskNo = this.selectedTable || 0
      const order = deskNo ? this.unfinishedOrders.find(o => o.deskNo === deskNo) : null
      if (!order) { this.$message({ type: 'warning', message: '請先選擇有訂單的枱位' }); return }
      this.$confirm('確定要重印枱 ' + order.deskNo + ' 的最後單據？', '重印單據', { type: 'warning' }).then(() => {
        this.$axios.post('/api/order/reprint', { deskNo: order.deskNo })
          .then(res => { this.$message({ type: 'success', message: res.data || '重印成功' }) })
          .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '重印失敗' }) })
      }).catch(() => {})
    },
    scrollOrder (dir) {
      const el = this.$refs.orderList
      if (el) el.scrollBy({ top: dir * 200, behavior: 'smooth' })
    },
    openCallDish () {
      const items = this.cart.filter(i => !i.sent && i.dishStatus !== 'called')
      if (!items.length) { this.$message({ type: 'info', message: '沒有可叫起的品項' }); return }
      this.cart.forEach(i => { if (!i.sent && i.dishStatus !== 'called') { this.$set(i, 'dishStatus', 'called') } })
      this.$message({ type: 'success', message: '已標記叫起，送單時廚房不會出單' })
    },
    openServeDish () {
      const order = this.currentOrder
      if (!order) { this.$message({ type: 'info', message: '該枱沒有未結訂單' }); return }
      const items = (order.order || []).map((it, idx) => ({ ...it, _idx: idx })).filter(it => it.dishStatus === 'called')
      if (!items.length) { this.$message({ type: 'info', message: '沒有已叫起的品項' }); return }
      this.serveDishDialog = { show: true, deskNo: order.deskNo, items, checked: [], loading: false }
    },
    submitServeDish () {
      this.serveDishDialog.loading = true
      const realIndexes = this.serveDishDialog.checked.map(i => this.serveDishDialog.items[i]._idx)
      this.$axios.post('/api/order/serveDish', { deskNo: this.serveDishDialog.deskNo, indexes: realIndexes })
        .then(res => {
          this.$message({ type: 'success', message: res.data || '起菜成功，已列印到後廚' })
          this.serveDishDialog.show = false
          realIndexes.forEach(idx => {
            const cartItem = this.cart[idx]
            if (cartItem) this.$set(cartItem, 'dishStatus', 'served')
          })
          this.loadUnfinished()
        })
        .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '起菜失敗' }) })
        .finally(() => { this.serveDishDialog.loading = false })
    },
    openChangePwd () {
      if (!this.loggedIn) { this.$message({ type: 'warning', message: '請先登入' }); return }
      this.changePwdDialog = { show: true, oldPwd: '', newPwd: '', newPwd2: '', loading: false }
    },
    submitChangePwd () {
      const d = this.changePwdDialog
      if (!d.oldPwd) { this.$message({ type: 'warning', message: '請輸入舊密碼' }); return }
      if (!d.newPwd || d.newPwd.length < 6) { this.$message({ type: 'warning', message: '新密碼至少6位' }); return }
      if (d.newPwd !== d.newPwd2) { this.$message({ type: 'warning', message: '兩次密碼不一致' }); return }
      d.loading = true
      this.$axios.post('/api/staff/changePassword', { no: this.staffInfo.no, oldPassword: d.oldPwd, newPassword: d.newPwd })
        .then(res => {
          this.$message({ type: 'success', message: res.data.message || '密碼更改成功！' })
          this.changePwdDialog.show = false
        })
        .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '更改失敗' }) })
        .finally(() => { d.loading = false })
    },
    openManager () {
      this.managerDialog = { show: true, no: '', password: '' }
    },
    managerLogin () {
      const no = (this.managerDialog.no || '').trim()
      if (!no || !this.managerDialog.password) { this.$message({ type: 'warning', message: '請輸入經理編號與密碼' }); return }
      this.$axios.post('/api/staff/login', { no, password: this.managerDialog.password })
        .then(res => {
          if (res.data.role !== '管理員') { this.$message({ type: 'error', message: '非經理身份，無法使用經理功能' }); return }
          this.isManager = true
          this.managerName = res.data.name
          if (res.data.token) localStorage.setItem('orderTk', res.data.token)
          this.managerDialog.password = ''
          this.$message({ type: 'success', message: '經理登入成功' })
        })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '登入失敗' }))
    },
    managerAction (action) {
      this.managerDialog.show = false
      if (action === 'logout') {
        this.isManager = false
        this.managerName = ''
        this.$message({ type: 'info', message: '已退出經理模式' })
        return
      }
      this.runAction(action)
    },
    openRefund () {
      this.refundDialog = { show: true, activeTab: 'void', finished: [] }
      this.loadUnfinished()
      this.$axios.post('/api/order/finished', { index: 1, size: 200 })
        .then(res => { this.refundDialog.finished = (res.data && res.data.result) || [] })
        .catch(() => { this.refundDialog.finished = [] })
    },
    voidItem (order, index) {
      if (!this.hasPermission('order.voidItem')) {
        this.$message({ type: 'warning', message: '你沒有退菜權限' })
        return
      }
      const item = order.order[index]
      this.$confirm(`確認退菜「${item.name} x${item.count}」嗎？`)
        .then(_ => this.$axios.post('/api/order/voidItem', { _id: order._id, index }))
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.loadUnfinished()
        })
        .catch(err => { if (err !== 'cancel' && err !== 'close') this.$message({ type: 'error', message: err.response ? err.response.data : '退菜失敗' }) })
    },
    cancelOrder (order) {
      this.$confirm(`確認取消整單 ${order.orderNo} 嗎？`)
        .then(_ => this.$axios.post('/api/order/cancel', { _id: order._id }))
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.loadUnfinished()
        })
        .catch(err => { if (err !== 'cancel' && err !== 'close') this.$message({ type: 'error', message: '取消失敗' }) })
    },
    refundOrder (order) {
      if (!this.hasPermission('payment.refund')) {
        this.$message({ type: 'warning', message: '你沒有退款權限' })
        return
      }
      this.$confirm(`確認退款訂單 ${order.orderNo}，金額 $${order.totalPrice} 嗎？`)
        .then(_ => this.$axios.post('/api/order/refund', { _id: order._id, reason: '' }))
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.openRefund()
          this.loadTables()
        })
        .catch(err => { if (err !== 'cancel' && err !== 'close') this.$message({ type: 'error', message: err.response ? err.response.data : '退款失敗' }) })
    },
    openChangePay (order) {
      this.changePayDialog = { show: true, orderId: order._id, orderNo: order.orderNo, totalPrice: order.totalPrice, payMethod: order.payMethod || '現金' }
    },
    confirmChangePay () {
      this.$axios.post('/api/order/changePayment', { _id: this.changePayDialog.orderId, payMethod: this.changePayDialog.payMethod })
        .then(() => this.$axios.post('/api/order/print', { _id: this.changePayDialog.orderId, type: 'receipt', invoiceNo: 'INV-' + this.changePayDialog.orderNo, payMethod: this.changePayDialog.payMethod }).catch(() => {}))
        .then(() => {
          this.$message({ type: 'success', message: '付款已更改並重印' })
          this.changePayDialog.show = false
          this.openRefund()
        })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '更改付款失敗' }))
    },
    printTicket (type) {
      const deskNo = this.isDineIn ? this.selectedTable : 0
      const orders = this.unfinishedOrders.filter(o => o.deskNo === deskNo)
      if (!orders.length) {
        this.$message({ type: 'warning', message: '該枱無未結訂單可打印' })
        return
      }
      const latest = orders[0]
      if (latest.printed) {
        this.$message({ type: 'warning', message: '此枱已印單，不能重複打印' })
        return
      }
      this.$axios.post('/api/order/print', { _id: latest._id, type })
        .then(res => {
          this.$set(latest, 'printed', true)
          this.$message({ type: 'success', message: res.data })
          this.backToBoard()
        })
        .catch(err => {
          if (type === 'print') {
            this.$set(latest, 'printed', true)
            this.$message({ type: 'warning', message: '打印失败，但座位状态已更新' })
            this.backToBoard()
          } else {
            this.$message({ type: 'error', message: err.response ? err.response.data : '打印失敗' })
          }
        })
    },
    clearNewItems () {
      // 只清空「未下單」的新品項，保留已落單（已下單）品項
      const remaining = this.cart.filter(i => i.sent)
      this.$set(this.carts, this.cartKey, remaining)
      this.orderRemark = ''
      this.orderDiscount = 0
    },
    clearCart () {
      this.$set(this.carts, this.cartKey, [])
      this.orderRemark = ''
      this.orderDiscount = 0
    },
    cancelItemFromBtn () {
      this.cancelItemDialog = { show: true, list: this.cart.map((item, i) => ({ ...item, index: i })) }
    },
    cancelItemBySelect (index) {
      const item = this.cart[index]
      if (!item) return
      if (!item.sent) {
        this.$confirm(`確認取消「${item.name} x${item.count}」嗎？`, '取消品項', { type: 'warning' })
          .then(() => {
            const nextCart = this.cart.slice()
            nextCart.splice(index, 1)
            this.$set(this.carts, this.cartKey, nextCart)
            this.$message({ type: 'success', message: '已取消品項' })
          }).catch(() => {})
      } else {
        this.cancelDialog = { show: true, index, isSent: true, managerNo: this.staffInfo.no || '', managerPwd: '', reason: '', loading: false }
      }
    },
    confirmCancelSentItem () {
      const { index, managerNo, managerPwd, reason } = this.cancelDialog
      const item = this.cart[index]
      if (!item || !item.sent) return
      if (!managerNo || !managerPwd) { this.$message({ type: 'warning', message: '請輸入經理編號與密碼' }); return }
      this.cancelDialog.loading = true
      this.$axios.post('/api/staff/login', { no: managerNo, password: managerPwd })
        .then(res => {
          if ((res.data.permissionLevel || 1) < 3) {
            this.$message({ type: 'error', message: '需要經理（等級3）以上權限' })
            this.cancelDialog.loading = false
            return
          }
          const deskNo = this.isDineIn ? this.selectedTable : 0
          const orders = this.unfinishedOrders.filter(o => o.deskNo === deskNo)
          if (!orders.length) {
            this.$message({ type: 'warning', message: '找不到對應訂單' })
            this.cancelDialog.loading = false
            return
          }
          const targetOrder = orders[0]
          const itemIdx = (targetOrder.order || []).findIndex(it => it.name === item.name)
          if (itemIdx < 0) {
            this.$message({ type: 'warning', message: '找不到該品項在訂單中的位置' })
            this.cancelDialog.loading = false
            return
          }
          this.$axios.post('/api/order/voidItem', { _id: targetOrder._id, index: itemIdx, reason })
            .then(() => {
              return this.$axios.post('/api/order/print', { _id: targetOrder._id, type: 'kitchen' }).catch(() => {})
            })
            .then(() => {
              const nextCart = this.cart.slice()
              nextCart.splice(index, 1)
              this.$set(this.carts, this.cartKey, nextCart)
              this.cancelDialog.show = false
              this.cancelDialog.loading = false
              this.$message({ type: 'success', message: '已取消已落單品項' })
              return this.loadUnfinished()
            })
            .catch(() => {
              this.cancelDialog.loading = false
              this.$message({ type: 'error', message: '取消品項失敗' })
            })
        })
        .catch(() => {
          this.cancelDialog.loading = false
          this.$message({ type: 'error', message: '經理驗證失敗' })
        })
    },
    cancelAll () {
      if (!this.cart.length) { this.$message({ type: 'warning', message: '購物車為空' }); return }
      const hasSent = this.cart.some(i => i.sent)
      if (hasSent) {
        this.cancelDialog = { show: true, index: -1, isSent: true, managerNo: this.staffInfo.no || '', managerPwd: '', reason: '', loading: false }
      } else {
        this.$confirm('確認清空所有未下單品項嗎？', '整單取消', { type: 'warning' })
          .then(() => {
            this.clearCart()
            this.$message({ type: 'success', message: '已清空購物車' })
          }).catch(() => {})
      }
    },
    confirmCancelAllSent () {
      const { managerNo, managerPwd, reason } = this.cancelDialog
      if (!managerNo || !managerPwd) { this.$message({ type: 'warning', message: '請輸入經理編號與密碼' }); return }
      this.cancelDialog.loading = true
      this.$axios.post('/api/staff/login', { no: managerNo, password: managerPwd })
        .then(res => {
          if ((res.data.permissionLevel || 1) < 3) {
            this.$message({ type: 'error', message: '需要經理（等級3）以上權限' })
            this.cancelDialog.loading = false
            return
          }
          const deskNo = this.isDineIn ? this.selectedTable : 0
          const orders = this.unfinishedOrders.filter(o => o.deskNo === deskNo)
          if (!orders.length) {
            this.clearCart()
            this.cancelDialog.show = false
            this.cancelDialog.loading = false
            this.$message({ type: 'success', message: '已清空' })
            return
          }
          const targetOrder = orders[0]
          this.$axios.post('/api/order/cancel', { _id: targetOrder._id, reason })
            .then(() => {
              this.clearCart()
              this.cancelDialog.show = false
              this.cancelDialog.loading = false
              this.$message({ type: 'success', message: '整單已取消' })
              return this.loadUnfinished()
            })
            .catch(() => {
              this.cancelDialog.loading = false
              this.$message({ type: 'error', message: '整單取消失敗' })
            })
        })
        .catch(() => {
          this.cancelDialog.loading = false
          this.$message({ type: 'error', message: '經理驗證失敗' })
        })
    },
    onSwipeStart (index, e) {
      this.swipeIndex = index
      this.swipeStartX = e.touches[0].clientX
      this.swipeStartY = e.touches[0].clientY
      this.swipeDelta = 0
      this.swipeLocked = false
    },
    onSwipeMove (index, e) {
      if (this.swipeIndex !== index) return
      const dx = e.touches[0].clientX - this.swipeStartX
      const dy = e.touches[0].clientY - this.swipeStartY
      if (!this.swipeLocked && (Math.abs(dy) > Math.abs(dx))) {
        this.swipeLocked = true
      }
      if (this.swipeLocked) return
      if (dx < 0) e.preventDefault()
      this.swipeDelta = Math.min(0, Math.max(-80, dx))
    },
    onSwipeEnd (index, e) {
      if (this.swipeIndex !== index) return
      if (this.swipeLocked) {
        this.swipeIndex = -1
        this.swipeDelta = 0
        return
      }
      if (this.swipeDelta < -40) {
        this.$nextTick(() => {
          this.swipeIndex = index
          this.swipeDelta = -64
        })
        return
      }
      this.$nextTick(() => {
        this.swipeIndex = -1
        this.swipeDelta = 0
      })
    },
    swipeStyle (index) {
      if (this.swipeIndex !== index || !this.swipeDelta) return {}
      return { transform: `translateX(${this.swipeDelta}px)`, transition: 'none' }
    },
    doSubmit (print) {
      const newItems = this.cart.filter(i => !i.sent)
      if (!newItems.length) {
        if (print) this.backToBoard()
        else this.$message({ type: 'warning', message: '沒有新加的菜品，請先點餐' })
        return
      }
      const order = newItems.map(i => ({
        _id: i._id,
        name: i.name,
        price: i.price,
        count: i.count,
        station: i.station,
        stations: i.stations,
        mods: i.mods || [],
        discount: i.discount,
        free: i.free,
        customPrice: i.customPrice,
        contents: i.contents,
        comboId: i.comboId,
        comboName: i.comboName,
        comboSnapshot: i.comboSnapshot,
        dishStatus: i.dishStatus || ''
      }))
      const newTotal = Math.round(newItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100
      const payload = {
        deskNo: this.isDineIn ? this.selectedTable : 0,
        order,
        remark: this.orderRemark,
        totalPrice: newTotal,
        zone: this.selectedZone,
        source: 'pos',
        print,
        printed: false,
        waiter: this.waiter,
        terminalCode: this.selectedTerminal
      }
      this.$axios.post('/api/order/submit', payload)
        .then(() => {
          this.$message({ type: 'success', message: print ? '送單成功，已發送打印機' : '下單成功' })
          const updatedCart = this.cart.map(i => Object.assign({}, i, { sent: true }))
          this.$set(this.carts, this.cartKey, updatedCart)
          return this.loadUnfinished()
        })
        .then(() => {
          this.view = 'board'
          this.selectedTable = null
        })
        .catch(() => { this.$message({ type: 'error', message: print ? '送單失敗' : '下單失敗' }) })
    },
    submitOrder () { this.doSubmit(false) },
    sendOrder () { this.doSubmit(true) },
    scrollOrderList (dir) {
      const el = this.$refs.orderList
      if (!el) return
      const step = 80
      if (dir === 'up') el.scrollTop -= step
      else if (dir === 'down') el.scrollTop += step
      else if (dir === 'top') el.scrollTop = 0
      else if (dir === 'bottom') el.scrollTop = el.scrollHeight
    },
    updateTime () {
      const now = new Date()
      const pad = n => String(n).padStart(2, '0')
      this.currentTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    }
  },
  sockets: {
    posSettingChanged () {
      this.loadPosSetting()
      this.loadAmounts()
    },
    menuChanged () {
      this.loadMenu()
    },
    tableLayoutChanged () {
      this.loadZones()
      this.loadTables()
      this.loadPosSetting()
    },
    tableUpdate () {
      this.loadTables()
    },
    zoneChanged () {
      this.loadZones()
    }
  },
  created () {
    this.updateTime()
    this.timeTimer = setInterval(() => { this.updateTime() }, 1000)
    this.loadTerminals()
    this.loadShopName()
    this.loadZones()
    this.loadMenu()
    this.loadModCodes()
    this.loadPosSetting()
    this.loadAmounts()
    this.loadHolds()
    this.loadShiftStatus()
  },
  beforeDestroy () {
    if (this.timeTimer) clearInterval(this.timeTimer)
    this.stopQtyHold()
  }
}
</script>

<style scoped>
#pos{ display: flex; flex-direction: column; height: 100vh; background: #f3f6fb; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif; margin: 0; padding: 0; }
.login-view{ flex: 1; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); position: relative; overflow: hidden; }
.login-view::before{ content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,.03) 0%, transparent 60%); animation: loginBgPulse 8s ease-in-out infinite; }
@keyframes loginBgPulse{ 0%, 100%{ transform: scale(1); } 50%{ transform: scale(1.1); } }
.login-box{ width: 420px; background: #fff; border-radius: 16px; padding: 40px 36px; box-shadow: 0 20px 60px rgba(0,0,0,.4); position: relative; z-index: 1; }
.login-header{ text-align: center; margin-bottom: 32px; }
.login-icon{ width: 80px; height: 80px; margin: 0 auto 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(102,126,234,.4); }
.login-icon i{ font-size: 40px; color: #fff; }
.login-title{ text-align: center; font-size: 28px; font-weight: 800; color: #1f2937; margin-bottom: 6px; letter-spacing: -0.5px; }
.login-subtitle{ text-align: center; font-size: 14px; color: #909399; }
.login-form{ margin-bottom: 24px; }
.login-shift-section{ border-top: 1px solid #f0f2f5; padding-top: 20px; margin-bottom: 16px; }
.shift-status{ text-align: center; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: #67c23a; font-weight: 600; }
.shift-status-dot{ width: 8px; height: 8px; border-radius: 50%; background: #67c23a; animation: pulse 2s infinite; }
@keyframes pulse{ 0%, 100%{ opacity: 1; transform: scale(1); } 50%{ opacity: .6; transform: scale(1.2); } }
.shift-buttons{ display: flex; gap: 12px; }
.shift-btn{ flex: 1; height: 44px; font-size: 14px; font-weight: 600; border-radius: 8px; }
.terminal-info{ text-align: center; font-size: 12px; color: #909399; padding: 10px; background: #f8f9fa; border-radius: 8px; }
.staff-name{ font-size: 13px; color: #d8e4f2; margin-right: 8px; }
/* 枱況圖視圖 */
.board-view{ flex: 1; display: flex; flex-direction: column; background: #f3f6fb; }
.board-header{ display: flex; align-items: center; min-height: 72px; padding: 0 24px; background: linear-gradient(135deg,#172b4d,#254f7d); color: #fff; }
.board-heading{ display:flex; align-items:center; gap:16px; }.board-title{ font-size: 21px; font-weight: 700; letter-spacing: 1px; }.board-legend{ display:inline-flex; align-items:center; gap:12px; margin-left:8px; }.board-legend .legend{ color:#d8e4f2; font-size:13px; }.board-subtitle{ font-size: 12px; color: #b9c9dc; }
.board-right{ margin-left: auto; display: flex; align-items: center; gap: 10px; }.board-right .el-button{ border-radius: 7px; }.board-right .el-button--success.is-plain,.board-right .el-button--danger.is-plain{ background: rgba(255,255,255,.08); }
.current-time{ color: #d8e4f2; font-size: 13px; white-space: nowrap; }.header-time{ color: #a8b8d0; font-size: 13px; }
.legend{ font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.dot{ display: inline-block; width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 3px rgba(148,163,184,.12); }
.dot.free{ background: #409eff; }
.dot.busy{ background: #67c23a; }
.dot.printed{ background: #e6a23c; }
.dot.relisted{ background: #9c27b0; }
.dot.qr{ background: #f56c6c; }
.board-zone-tabs{ display: flex; align-items: center; gap: 6px; padding: 10px 20px 0; background: #f5f6f8; }
.zone-tab{ padding: 6px 18px; border-radius: 16px 16px 0 0; font-size: 14px; color: #606266; background: #e9edf2; cursor: pointer; }
.zone-tab.active{ background: #1f2d3d; color: #fff; font-weight: bold; }
.zone-tab-right{ margin-left: auto; display: flex; gap: 8px; }
.floor-canvas{ flex: 1; overflow: auto; position: relative; padding: 16px; background: radial-gradient(circle at 20% 10%,#fff 0,#f3f6fb 52%); }
.board-card{ height: 110px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; border: 1.5px solid rgba(148,163,184,.25); background: #fff; box-shadow: 0 2px 8px rgba(36,61,91,.06); transition: all .2s ease; overflow: hidden; min-width: 0; }
.board-card:hover{ transform: translateY(-3px); box-shadow: 0 6px 16px rgba(36,61,91,.15); border-color: rgba(64,158,255,.4); }
.floor-card{ position: absolute; }
.board-free{ background: linear-gradient(145deg,#fff,#eef7ff); border-color: #93c5fd; }
.board-busy{ background: linear-gradient(145deg,#fff,#ecfdf5); border-color: #86efac; }
.board-printed{ background: linear-gradient(145deg,#fff,#fefce8); border-color: #fcd34d; }
.board-relisted{ background: linear-gradient(145deg,#fff,#faf5ff); border-color: #c084fc; }
.board-qr{ background: linear-gradient(145deg,#fff,#fef2f2); border-color: #fca5a5; }
.bc-topline{ position:absolute; top:13px; left:15px; right:15px; display:flex; justify-content:space-between; align-items:center; z-index:1; }.bc-status-icon{ width:9px; height:9px; border-radius:50%; }.bc-status-icon.board-free{ background:#409eff; }.bc-status-icon.board-busy{ background:#67c23a; }.bc-status-icon.board-printed{ background:#e6a23c; }.bc-status-icon.board-qr{ background:#f56c6c; }.bc-status-icon.board-active{ background:#f56c6c; }.bc-no{ font-size: 42px; font-weight: 800; color: #1e293b; line-height:1; }
.bc-zone{ font-size: 12px; color: #64748b; }
.bc-topline .bc-seats{ margin-top: 0; }
.bc-seats{ font-size: 12px; color: #64748b; }
.bc-amount{ font-size: 17px; color: #dc2626; font-weight: 800; margin-top: 5px; }
.bc-status{ font-size: 12px; margin-top: 5px; font-weight: 600; }.bc-meta{ position:absolute; bottom:10px; font-size:11px; color:#94a3b8; z-index:1; }
.board-free .bc-status{ color: #2583d8; }
.board-busy .bc-status{ color: #67c23a; }
.board-printed .bc-status{ color: #e6a23c; }
.board-relisted .bc-status{ color: #9c27b0; }
.board-active .bc-status{ color: #f56c6c; }
.board-takeaway{ display: flex; justify-content: center; padding: 14px; }
/* 點餐視圖 */
.top-bar{ display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 3px 14px; background: #1f2d3d; color: #fff; flex: 0 0 auto; }
.bottom-bar{ display: flex; align-items: center; justify-content: flex-end; padding: 14px 20px; background: linear-gradient(180deg, #1e293b, #0f172a); flex: 0 0 auto; border-top: 1px solid rgba(148,163,184,.12); box-shadow: 0 -4px 16px rgba(15,23,42,.15); }
.bb-rows{ display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.bb-row{ display: flex; gap: 8px; }
.bb-row .el-button{ border-radius: 12px; font-weight: 700; font-size: 15px; padding: 11px 22px; transition: all .2s; background: rgba(255,255,255,.92); border-color: rgba(255,255,255,.6); color: #1e293b; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
.bb-row .el-button:hover{ transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.2); background: #fff; }
.bb-row .el-button:active{ transform: scale(.96); }
/* 按壓動畫＋頻率分大小 */
.bb-btn{ transition: transform .08s ease, box-shadow .08s ease; }
.bb-btn:active{ transform: scale(.95); }
.tb-item{ display: flex; align-items: center; gap: 6px; }
.tb-label{ font-size: 15px; color: #475569; font-weight: 600; }
.tb-right{ margin-left: auto; display: grid; grid-template-columns: repeat(4, auto); gap: 6px; align-content: center; }
.main{ flex: 1; display: flex; overflow: hidden; }
/* === 新入單版面（照設計圖：左側欄＋右上清單＋中間食品＋底部雙色 dock） === */
.classic-layout{ flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.order-layout{ position: relative; flex: 1; display: flex; min-height: 0; background: #eef1f9; }
/* 自由版面：面板絕對定位 */
.order-layout.free .side-nav,
.order-layout.free .food-zone,
.order-layout.free .order-ticket,
.order-layout.free .action-dock{ position: absolute; margin: 0; }
.order-layout.free .resizer-v, .order-layout.free .resizer-h, .order-layout.free .resizer-sn{ display: none; }
.order-layout.free .order-ticket{ z-index: 6; max-width: none; min-width: 0; }
.order-layout.free .side-nav{ z-index: 7; }
.order-layout.free .action-dock{ z-index: 5; }
.side-nav{ position: relative; flex: 0 0 65px; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 6px 5px; background: linear-gradient(180deg, var(--pos-side-from, #8d94d0), var(--pos-side-to, #7b84c9)); overflow-y: auto; }
.resizer-sn{ position: absolute; top: 0; right: -3px; width: 7px; height: 100%; cursor: col-resize; z-index: 5; }
.resizer-sn:hover{ background: rgba(255,255,255,.5); }
.resizer-v{ flex: 0 0 7px; margin: 12px 0 0; cursor: col-resize; border-radius: 4px; }
.resizer-v:hover{ background: var(--pos-head-from, #6a73c8); opacity: .35; }
.resizer-h{ height: 0; margin: 0; cursor: row-resize; border-radius: 4px; }
.resizer-h:hover{ background: var(--pos-head-from, #6a73c8); opacity: .35; }
.side-back:hover{ background: rgba(255,255,255,.3); }
.side-item{ position: relative; width: 74px; padding: 10px 0 8px; border-radius: 16px; background: rgba(255,255,255,.14); color: #fff; text-align: center; cursor: pointer; font-size: 22px; font-weight: 700; transition: all .15s; }
.side-item:hover{ background: rgba(255,255,255,.26); }
.side-item.active{ background: #fff; color: var(--pos-active, #5a63a8); box-shadow: 0 4px 10px rgba(0,0,0,.2); }
.side-name{ display: block; font-size: 12px; font-weight: 600; margin-top: 3px; }
.side-slot{ position: absolute; top: -6px; right: -10px; padding: 0 6px; border-radius: 8px; background: var(--pos-slot, #c0504a); color: #fff; font-size: 9px; line-height: 14px; }
/* 側欄內建 keypad（最頂 0，向下直排 1-9，再向下 數量 / PLU，填滿全高） */
.side-keypad{ flex: 1; width: 100%; display: flex; flex-direction: column; background: rgba(255,255,255,.12); border-radius: 12px; padding: 5px 4px; }
.pad-col{ flex: 1; display: flex; flex-direction: column; gap: 5px; }
.pad-key{ flex: 1; min-height: 34px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,.94); color: #3a4164; font-size: 15px; font-weight: 800; border-radius: 10px; cursor: pointer; user-select: none; transition: all .1s; box-shadow: 0 2px 4px rgba(0,0,0,.06); }
.pad-key:hover{ background: #fff; box-shadow: 0 3px 8px rgba(0,0,0,.12); }
.pad-key:active{ transform: scale(.94); background: #e0ecff; }
.side-nav > .side-item.pad-btn{ width: 100%; margin-top: 5px; padding: 10px 0; font-size: 14px; font-weight: 800; flex-shrink: 0; }
.order-main{ flex: 1; display: flex; flex-direction: column; min-width: 0; }
.top-bar{ display: flex; align-items: center; gap: 18px; padding: 12px 20px; background: #fff; border-bottom: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(36,61,91,.05); }
.order-body{ flex: 1; display: flex; min-height: 0; }
.food-zone{ flex: 1; display: flex; flex-direction: column; min-width: 0; background: #fff; border-radius: 0; overflow: hidden; box-shadow: none; border: none; margin: 0; }.food-top-row{ padding: 4px 14px 0; margin-bottom: 0; }
.food-grids{ padding: 0 14px 10px; }
.food-column{ flex: 1; display: flex; flex-direction: column; min-width: 0; }
.food-grids{ flex: 1; overflow-y: auto; margin-top: 4px; padding-bottom: 2px; }
.order-ticket{ flex: 0 0 36%; max-width: 480px; min-width: 380px; margin: 0; display: flex; flex-direction: column; background: #fff; border-radius: 0; overflow: hidden; box-shadow: 0 8px 24px rgba(36,61,91,.10); border: 1px solid #e6e9f5; }
.ot-head{ display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: linear-gradient(135deg, var(--pos-head-from, #6a73c8), var(--pos-head-to, #8f96d8)); color: #fff; font-size: 16px; font-weight: 800; cursor: grab; user-select: none; gap: 10px; }
.ot-head:active{ cursor: grabbing; }
.ot-head-left{ display: flex; flex-direction: column; align-items: center; gap: 6px; }
.ot-sub{ font-size: 13px; font-weight: 600; background: rgba(255,255,255,.22); padding: 2px 10px; border-radius: 12px; }
.ot-controls{ display: flex; gap: 8px; align-items: center; }
.ot-sep{ width: 1px; height: 28px; background: rgba(255,255,255,.3); flex-shrink: 0; }
.head-back{ background: rgba(255,255,255,.22); color: #fff; border-color: transparent; flex-shrink: 0; font-size: 13px; font-weight: 700; padding: 7px 14px; border-radius: 8px; }
.head-back:hover{ background: rgba(255,255,255,.34); color: #fff; }
.ot-controls .el-input__inner{ background: rgba(255,255,255,.95); border-color: transparent; color: #1f2937; font-weight: 600; font-size: 14px; height: 32px; line-height: 32px; border-radius: 6px; }
.ot-controls .el-input-number .el-input__inner{ text-align: center; }
.ot-field{ display: flex; flex-direction: column; align-items: stretch; gap: 3px; }
.ot-cap{ font-size: 11px; font-weight: 700; color: rgba(255,255,255,.92); letter-spacing: 1px; text-align: center; }
.ot-big-num{ display: flex; align-items: baseline; justify-content: center; gap: 2px; background: rgba(255,255,255,.95); color: #1f2937; font-size: 28px; font-weight: 900; padding: 4px 12px; border-radius: 8px; cursor: pointer; min-width: 60px; text-align: center; line-height: 1.2; transition: all .15s; }
.ot-big-num:hover{ background: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,.6); }
.ot-big-num:active{ transform: scale(.95); }
.ot-big-unit{ font-size: 13px; font-weight: 600; color: #64748b; }
.ot-edit-icon{ font-size: 12px; color: #94a3b8; margin-left: 2px; }
.ot-staff-tag{ display: inline-flex; align-items: center; gap: 4px; background: rgba(255,255,255,.22); padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; flex-shrink: 0; }
.ot-takeaway-label{ background: rgba(255,255,255,.95); color: #e6a23c; }
.classic-num{ background: #fff; border-color: #e2e8f0; }
.classic-num:hover{ box-shadow: 0 0 0 2px #93c5fd; }
.classic-staff{ background: #f1f5f9; color: #475569; }
.food-top-row{ display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.food-top-row .cat-scroll{ flex: 1; margin-bottom: 0; }
.back-mini{ flex-shrink: 0; }
.order-ticket .order-list{ flex: 1; }
.order-ticket .order-footer{ border-top: 1px solid #e2e8f0; }
.action-dock{ display: flex; gap: 0; padding: 0; border-top: 1px solid #e2e8f0; }
.dock-left{ flex: 1; border-radius: 0; padding: 0; background: linear-gradient(135deg, var(--pos-dock-from, #7b84c9), var(--pos-dock-to, #9097d6)); min-width: 0; }
.dock-left .bb-rows{ align-items: stretch; }
.dock-left .bb-rows{ width: 100%; }
.dock-left .bb-row{ display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; width: 100%; }
.dock-left .bb-row .el-button{ width: 100%; height: 40px; margin: 0; padding: 0 6px; font-size: 28px; }
.dock-left .btn-wrap{ width: 100%; }
.dock-left .el-button{ background: rgba(255,255,255,.94); border-color: rgba(255,255,255,.9); color: #1e293b; font-size: 28px; }
.dock-left .el-button:hover{ background: #fff; }
.dock-left{ position: relative; }
.btn-wrap{ position: relative; display: inline-flex; }
.order-row{ position: relative; }
.order-list{ position: relative; }
.food-wrap{ position: relative; }
.board-mini-grid{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; align-content: start; }
.board-strip{ display: flex; gap: 8px; overflow-x: auto; overflow-y: hidden; padding: 4px 2px; margin-bottom: 8px; flex-shrink: 0; scrollbar-width: none; }
.board-strip::-webkit-scrollbar{ display: none; }
.strip-card{ min-width: 104px; padding: 7px 10px; border-radius: 12px; background: #fff; border: 2px solid #d7dde8; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px; transition: all .15s; flex-shrink: 0; }
.strip-card:hover{ transform: translateY(-2px); box-shadow: 0 6px 14px rgba(36,61,91,.12); }
.strip-card.board-active{ border-color: #409eff; background: #ecf5ff; }
.strip-card.board-busy{ border-color: #67c23a; }
.strip-card.board-printed{ border-color: #e6a23c; }
.strip-card.board-qr{ border-color: #f56c6c; }
.strip-card.board-relisted{ border-color: #9c27b0; }
.sc-no{ font-size: 16px; font-weight: 800; color: #1f2937; }
.sc-status{ font-size: 10px; color: #64748b; }
.sc-amt{ font-size: 11px; font-weight: 700; color: #e6a23c; }
.ticket-strip{ background: #fffdf8; border-bottom: 1px dashed #e2e8f0; padding: 6px 8px; }
.ticket-strip .strip-card{ min-width: 84px; padding: 5px 8px; border-radius: 10px; }
.board-mini-card{ position: relative; min-height: 92px; border-radius: 14px; background: #fff; border: 2px solid #d7dde8; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: pointer; transition: all .15s; box-shadow: 0 2px 8px rgba(36,61,91,.06); }
.board-mini-card:hover{ transform: translateY(-2px); box-shadow: 0 8px 18px rgba(36,61,91,.14); }
.board-mini-card.board-active{ border-color: #409eff; background: #ecf5ff; }
.board-mini-card.board-busy{ border-color: #67c23a; }
.board-mini-card.board-printed{ border-color: #e6a23c; }
.board-mini-card.board-qr{ border-color: #f56c6c; }
.board-mini-card.board-relisted{ border-color: #9c27b0; }
.bmc-no{ font-size: 22px; font-weight: 800; color: #1f2937; }
.bmc-status{ font-size: 12px; color: #64748b; }
.bmc-amount{ font-size: 13px; font-weight: 700; color: #e6a23c; }
@media (max-width: 1200px){
  .order-ticket{ flex: 0 0 38%; min-width: 320px; }
}
@media (max-width: 900px){
  .order-body{ flex-direction: column; }
  .order-ticket{ flex: 1 1 auto; max-width: none; min-width: 0; margin: 12px; }
  .side-nav{ flex: 0 0 76px; }
}
.left-panel{ flex: 0 0 46%; display: flex; flex-direction: column; background: #f8fafc; border-right: 1px solid #e2e8f0; }
.order-head{ display: flex; padding: 10px 16px; font-size: 14px; color: #94a3b8; border-bottom: 1px solid #e2e8f0; background: #fff; }
/* 清單頂細字 meta 行（枱號・人數・服務員） */
.list-meta{ display: flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 13px; color: #64748b; background: #fff; border-bottom: 1px solid #f0f2f5; }
.list-meta .lm-table{ font-weight: 700; color: #1f2937; }
.list-meta .lm-sep{ color: #cbd5e1; }
.list-meta .lm-right{ margin-left: auto; color: #e6a23c; font-weight: 600; }
.oh-name{ flex: 3; }
.oh-qty{ flex: 1.5; text-align: center; }
.oh-price{ flex: 1; text-align: right; color: #64748b; font-weight: 500; }
.oh-sub{ flex: 1; text-align: right; }
.order-list{ flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px 12px; -webkit-overflow-scrolling: touch; }
.order-row{ position: relative; padding: 10px 12px; margin-bottom: 6px; border: 1px solid #f0f2f5; border-radius: 10px; background: #fff; transition: box-shadow .15s, background .15s, opacity .15s; box-shadow: 0 1px 4px rgba(36,61,91,.04); overflow: hidden; }
.order-row:hover{ box-shadow: 0 3px 10px rgba(36,61,91,.08); }
.order-row-sent{ background: #f9fafb; opacity: 0.55; border-color: #f0f0f0; box-shadow: none; }
.order-row-called{ background: #fff7ed; border-color: #fed7aa; }
.or-main{ display: flex; align-items: center; transition: transform .25s cubic-bezier(.4,0,.2,1); }
.or-name{ flex: 3; font-size: 20px; font-weight: 700; color: #1e293b; cursor: pointer; line-height: 1.3; }
.or-name:hover{ color: #409eff; }
.or-name.or-locked{ cursor: not-allowed; }
.or-name.or-locked:hover{ color: inherit; }
.tag-free{ margin-left: 6px; font-size: 11px; color: #fff; background: #67c23a; padding: 1px 5px; border-radius: 3px; }
.tag-disc{ margin-left: 6px; font-size: 11px; color: #e6a23c; border: 1px solid #e6a23c; padding: 0 4px; border-radius: 3px; }
.tag-called{ margin-left: 6px; font-size: 10px; padding: 0 4px; border-radius: 3px; font-weight: 600; }
.share-table-dialog{ border-radius:14px; }
.share-table-dialog .el-dialog__header{ display:none; }
.share-table-dialog .el-dialog__body{ padding:20px; }
.stp-title{ font-size:18px; font-weight:700; color:#1e293b; text-align:center; margin-bottom:16px; }
.stp-main-btn{ display:flex; align-items:center; justify-content:center; gap:10px; padding:16px; margin-bottom:16px; background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; border-radius:14px; font-size:18px; font-weight:700; cursor:pointer; transition:transform .15s; }
.stp-main-btn:hover{ transform:scale(1.02); }
.stp-divider{ text-align:center; margin:12px 0; color:#909399; font-size:13px; position:relative; }
.stp-divider::before,.stp-divider::after{ content:''; position:absolute; top:50%; width:30%; height:1px; background:#dcdfe6; }
.stp-divider::before{ left:0; }
.stp-divider::after{ right:0; }
.stp-sub-grid{ display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; }
.stp-sub-btn{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:18px; background:#f0f4f9; border-radius:12px; cursor:pointer; transition:all .15s; font-size:15px; font-weight:600; color:#475569; }
.stp-sub-btn:hover{ background:#e0eaff; color:#2563eb; transform:translateY(-2px); }
.stp-add-btn{ border:2px dashed #d1d5db; color:#909399; background:#fafbfc; }
.stp-add-btn:hover{ border-color:#3b82f6; color:#3b82f6; background:#eff6ff; }
.order-page-btns{ display:flex; justify-content:center; gap:6px; padding:4px 0; border-top:1px solid #f0f0f0; }
.order-page-btns .el-button{ padding:4px 8px; font-size:14px; }
.or-qty{ flex: 1.5; display: flex; align-items: center; justify-content: center; gap: 4px; }
.qty-num{ min-width: 34px; min-height: 32px; text-align: center; font-size: 22px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 2px 8px; border-radius: 6px; -webkit-tap-highlight-color: transparent; transition: transform .08s ease; }
.qty-num:active{ transform: scale(.92); background: #ecf5ff; }
/* 數量掣加大＋按壓動畫 */
.qty-btn{ transition: transform .08s ease; }
.qty-btn:active{ transform: scale(.9); }
.or-price{ flex: 1; text-align: right; font-weight: 600; color: #475569; font-size: 18px; }
.or-sub{ flex: 1; text-align: right; font-weight: 800; color: #dc2626; font-size: 18px; }
.or-delete{ position:absolute; right:0; top:0; bottom:0; width:64px; display:flex; align-items:center; justify-content:center; background:#f56c6c; color:#fff; font-size:22px; cursor:pointer; border-radius:0 10px 10px 0; z-index:2; opacity:0; transition: opacity .15s ease; pointer-events: none; }
.order-row-swiped .or-delete{ opacity:1; pointer-events: auto; }
.or-remark{ font-size: 12px; color: #f01414; margin-top: 4px; padding-left: 20px; cursor: pointer; }
.remark-label{ color: #e6a23c; }
.empty{ color: #c0c4cc; text-align: center; padding: 40px 0; }
.order-footer{ padding: 10px 16px 14px; border-top: 1px solid #e2e8f0; background: #fff; margin-top: auto; }
.total{ text-align: right; font-size: 17px; margin-bottom: 0; display: flex; align-items: baseline; justify-content: flex-end; gap: 8px; border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 2px; }
.total-num{ color: #dc2626; font-weight: 800; font-size: 30px; }
.total-row{ display: flex; justify-content: space-between; align-items: center; font-size: 15px; color: #475569; margin-bottom: 6px; }
.total-row.right{ justify-content: flex-end; }
.sc-row{ display: flex; align-items: center; gap: 6px; font-size: 13px; }
.sc-amount{ color: #e6a23c; font-weight: bold; }
.right-panel{ flex: 1; display: flex; flex-direction: column; padding: 12px; background: #f8fafc; }
.plu-bar{ display: flex; gap: 8px; margin-bottom: 10px; }
.plu-bar .el-input__inner{ border-radius: 8px; }
.cat-bar{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px; max-width: 420px; }
.cat-bar .el-button{ font-size: 16px; font-weight: 700; padding: 13px 0; border-radius: 12px; margin: 0; }
.cat-bar .el-button{ margin: 0; border-radius: 8px; font-weight: 600; }
.cat-scroll{ display: flex; gap: 10px; margin-bottom: 4px; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 4px; padding-left: 4px; padding-right: 4px; flex-shrink: 0; }
.cat-scroll::-webkit-scrollbar{ display: none; }
.cat-pill{ flex-shrink: 0; height: 40px; line-height: 40px; padding: 0 20px; border-radius: 20px; border: 1.5px solid #dce5f0; background: #fff; color: #475569; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all .2s cubic-bezier(.4,0,.2,1); -webkit-tap-highlight-color: transparent; user-select: none; box-shadow: 0 1px 4px rgba(31,55,88,.06); }
.pill-slot{ display: inline-block; margin-left: 8px; padding: 0 7px; border-radius: 9px; background: #f56c6c; color: #fff; font-size: 11px; line-height: 18px; vertical-align: 2px; }
.cat-pill:hover{ border-color: #93c5fd; color: #2563eb; box-shadow: 0 3px 10px rgba(59,130,246,.12); transform: translateY(-1px); }
.cat-pill:active{ transform: scale(0.95); }
.cat-pill.active{ background: linear-gradient(135deg, #1f2d3d, #254f7d); border-color: #254f7d; color: #fff; box-shadow: 0 4px 16px rgba(23,43,77,.45); transform: scale(1.2); font-weight: 900; }
.food-grid{ flex: 1; overflow-y: auto; overflow-x: hidden; display: grid; grid-template-columns: repeat(6, 1fr); grid-auto-rows: minmax(0, 1fr); gap: 6px; align-content: start; padding: 2px 2px; }
.food-grid.food-grid-fix{ grid-template-columns: repeat(6, 1fr) !important; }
.food-btn{ position: relative; min-height: 88px; border: 1.5px solid rgba(148,163,184,.25); border-radius: 10px; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all .2s cubic-bezier(.4,0,.2,1); -webkit-tap-highlight-color: transparent; padding: 6px 3px; overflow: hidden; box-shadow: 0 2px 8px rgba(36,61,91,.06); }
.food-btn:active{ transform: scale(.97); box-shadow: 0 1px 4px rgba(64,158,255,.15); }
.food-btn:hover{ transform: translateY(-6px) scale(1.02); box-shadow: 0 16px 32px rgba(36,61,91,.18); border-color: rgba(64,158,255,.4); z-index: 2; }
.food-btn.food-soldout{ opacity: 0.45; background: #f5f7fa; box-shadow: none; }
.food-img{ width: 40px; height: 40px; object-fit: cover; border-radius: 10px; margin-bottom: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.08); border: 1px solid #f0f2f5; }
/* 純文字模式：類別色圓形頭像＋菜名首字 */
.food-avatar{ width: 52px; height: 52px; border-radius: 50%; color: #fff; font-size: 20px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; box-shadow: 0 3px 8px rgba(36,61,91,.18); letter-spacing: 1px; }
.combo-avatar{ width: 44px; height: 44px; font-size: 17px; }
.food-no-img .food-name{ font-size: 25px; }
.food-no-img .food-price{ font-size: 25px; }
.food-text{ display: flex; flex-direction: column; align-items: center; gap: 2px; }
.food-soldout-tag{ margin-left: 4px; font-size: 11px; color: #fff; background: #909399; padding: 1px 6px; border-radius: 4px; vertical-align: middle; }
.food-name{ font-size: 25px; font-weight: 700; color: #1e293b; text-align: center; line-height: 1.3; }
.food-plu{ font-size: 12px; color: #94a3b8; font-weight: 700; letter-spacing: .5px; margin-bottom: 2px; text-align: center; }
.food-tier-tag{ margin-left: 6px; padding: 0 6px; border-radius: 6px; background: #f97316; color: #fff; font-size: 11px; font-weight: 700; vertical-align: 2px; }
.food-price{ font-size: 25px; color: #ef4444; margin-top: 2px; font-weight: 800; letter-spacing: .3px; }
.food-stock{ font-size: 11px; color: #e6a23c; margin-top: 1px; font-weight: 600; }
.mod-group{ margin-bottom: 10px; }
.mod-group-name{ font-size: 13px; color: #909399; margin-bottom: 6px; }
.mod-chip{ display: inline-block; margin: 0 6px 6px 0; padding: 4px 12px; border: 1px solid #dcdfe6; border-radius: 14px; cursor: pointer; font-size: 13px; color: #333; transition: transform .08s ease; }
.mod-chip:active{ transform: scale(.92); }
.mod-chip.active{ border-color: #e6a23c; color: #e6a23c; background: rgba(230,162,60,.08); }
.mod-chip .req{ display: inline-block; margin-left: 6px; padding: 0 5px; border-radius: 3px; background: #f56c6c; color: #fff; font-size: 11px; font-style: normal; line-height: 16px; vertical-align: 1px; }
.custom-row{ margin-top: 10px; }
.pay-total{ text-align: center; font-size: 16px; }
.pay-num{ color: #f01414; font-weight: bold; font-size: 28px; }
.pay-change{ color: #67c23a; font-weight: bold; font-size: 20px; }
.disc-row{ display: flex; align-items: center; gap: 4px; }
.disc-amount{ color: #e6a23c; font-weight: bold; }
.disc-mode-bar{ padding: 6px 16px; font-size: 13px; color: #b8860b; background: #fdf6ec; border-bottom: 1px dashed #e6a23c; }
.report-cards{ display: flex; gap: 12px; }
.report-card{ flex: 1; text-align: center; border: 1px solid #e4e7ed; border-radius: 8px; padding: 16px 8px; }
.rc-num{ font-size: 26px; font-weight: bold; color: #409eff; }
.rc-label{ font-size: 13px; color: #909399; margin-top: 4px; }
.manager-menu{ display: flex; flex-direction: column; gap: 10px; }
.trans-src{ font-size: 20px; font-weight: bold; color: #409eff; }
.void-item{ display: flex; align-items: center; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed #eee; }
.void-item span{ font-size: 13px; }
.order-scroll-bar{ display:flex; justify-content:center; gap:4px; padding:4px 0; border-top:1px solid #f0f2f5; background:#f8fafc; flex-shrink:0; }
.order-scroll-bar .el-button{ padding:4px 8px; }
.qty-num{ cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.qty-num:hover{ background: #ecf5ff; color: #409eff; }
.pay-cash-row{ display: flex; align-items: center; gap: 10px; }
.pay-cash-val{ font-size: 24px; font-weight: bold; color: #409eff; min-width: 90px; text-align: right; }
.bc-transfer{ position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; line-height: 26px; text-align: center; border-radius: 50%; background: #e6a23c; color: #fff; font-size: 13px; z-index: 3; }
.pad-wrap{ display: flex; justify-content: center; margin: 6px 0; }
.pad-hint{ text-align: center; font-size: 12px; color: #909399; margin-top: 6px; }
.split-panels{ display: flex; align-items: stretch; gap: 8px; margin-bottom: 10px; }
.split-panel{ flex: 1; border: 1px solid #e4e7ed; border-radius: 6px; display: flex; flex-direction: column; min-width: 0; }
.split-title{ padding: 6px 8px; font-size: 13px; font-weight: bold; background: #f5f7fa; border-bottom: 1px solid #e4e7ed; }
.split-list{ flex: 1; max-height: 220px; overflow: auto; padding: 6px; }
.split-item{ padding: 6px 8px; margin-bottom: 4px; border: 1px solid #e4e7ed; border-radius: 4px; cursor: pointer; font-size: 13px; }
.split-item:hover{ border-color: #409eff; }
.split-item.sel{ background: #ecf5ff; border-color: #409eff; color: #409eff; }
.split-arrows{ display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.merge-hint{ font-size: 12px; color: #909399; margin: 2px 0 8px; }
.cancel-item-list{ max-height: 300px; overflow-y: auto; }
.cancel-item-row{ display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #ebeef5; }
.cancel-item-row:last-child{ border-bottom: none; }
.cancel-item-row span{ font-size: 14px; color: #303133; }
.board-toolbar-wrap{ display:none; }
.board-body{ display:flex; flex:1; overflow:hidden; }
.board-sidebar-right{ display:flex; flex-direction:column; align-items:center; gap:6px; padding:16px 12px; background:linear-gradient(180deg,#ffffff,#f7faff); border-left:2px solid #e8edf5; box-shadow:-4px 0 16px rgba(31,55,88,.06); min-width:120px; width:130px; z-index:2; overflow-y:auto; }
.board-sidebar-right .sb-btn{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; width:100%; padding:10px 6px; border:none; border-radius:10px; background:#f0f4f9; color:#475569; font-size:inherit; font-weight:600; cursor:pointer; transition:all .2s ease; line-height:1.3; }
.board-sidebar-right .sb-btn i{ font-size:18px; }
.board-sidebar-right .sb-btn:hover{ background:#e0eaff; color:#2563eb; transform:translateY(-1px); box-shadow:0 4px 12px rgba(37,99,235,.12); }
.board-sidebar-right .sb-btn.active{ background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; box-shadow:0 4px 16px rgba(37,99,235,.3); }
.board-sidebar-right .sb-btn.accent{ background:linear-gradient(135deg,#10b981,#059669); color:#fff; }
.board-sidebar-right .sb-btn.accent:hover{ background:linear-gradient(135deg,#059669,#047857); box-shadow:0 4px 16px rgba(16,185,129,.3); }
.board-sidebar-right .sb-btn.zone-btn{ background:linear-gradient(135deg,#fef3c7,#fde68a); color:#92400e; border:1px solid #fcd34d; }
.board-sidebar-right .sb-btn.zone-btn:hover{ background:linear-gradient(135deg,#fde68a,#fbbf24); color:#78350f; box-shadow:0 4px 12px rgba(251,191,36,.25); transform:translateY(-1px); }
.board-sidebar-right .sb-btn.zone-btn.active{ background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; border-color:#d97706; box-shadow:0 4px 16px rgba(245,158,11,.35); }
.board-sidebar-right .sb-btn.bottom{ margin-top:auto; background:#f8f9fb; color:#64748b; }
.board-sidebar-right .sb-btn.bottom:hover{ background:#e2e8f0; color:#334155; }
.sidebar-zone-right{ display:flex; flex-direction:column; align-items:center; gap:4px; width:100%; padding:4px 0; }
.sidebar-zone-right .zone-label-right{ font-size:11px; color:#64748b; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
.sidebar-zone-right .el-radio-group{ display:flex; flex-direction:column; width:100%; }
.sidebar-zone-right .el-radio-button{ width:100%; }
.sidebar-zone-right .el-radio-button__inner{ width:100%; text-align:center; border-radius:8px!important; font-size:12px; font-weight:600; padding:6px 4px; border-left:none!important; }
.sidebar-spacer-right{ flex:1; }
.board-main{ flex:1; overflow:auto; }
.board-toolbar{ display:none; }
.toolbar-left,.toolbar-side,.toolbar-zone-inline,.toolbar-divider{ display:none; }
.board-filter-bar{ display:none; }
.board-footer{ display:none; }
.table-list-view,.table-search-view{ flex:1; overflow:auto; padding:18px 24px 24px; background:#f3f6fb; }
.list-hero{ display:flex; align-items:center; min-height:58px; margin-bottom:14px; padding:0 18px; border:1px solid #dfe8f3; border-radius:10px; background:linear-gradient(135deg,#fff,#f7fbff); box-shadow:0 3px 12px rgba(36,61,91,.05); }
.list-hero-stats{ display:flex; align-items:center; flex-wrap:wrap; gap:24px; }
.stat-item{ display:inline-flex; align-items:center; gap:8px; color:#526277; font-size:13px; font-weight:600; white-space:nowrap; }
.stat-item .dot{ width:8px; height:8px; box-shadow:none; }
.list-filter-row{ display:flex; align-items:center; gap:10px; margin-bottom:14px; padding:14px 16px; border:1px solid #dce5f0; border-radius:10px; background:#fff; box-shadow:0 2px 8px rgba(31,55,88,.05); }
.list-count{ margin-left:auto; color:#8492a6; font-size:13px; white-space:nowrap; }
.table-list-view .el-table,.table-search-view .el-table{ border-radius:8px; overflow:hidden; box-shadow:0 3px 12px rgba(36,61,91,.06); }
.table-list-view .el-table th,.table-search-view .el-table th{ background:#f7f9fc; color:#526277; font-weight:700; }
.table-list-view .el-table td,.table-search-view .el-table td{ padding:9px 0; }
.list-table-no{ display:inline-flex; align-items:center; justify-content:center; min-width:48px; padding:5px 9px; border-radius:6px; background:#edf5ff; color:#2878c7; font-weight:800; }
.status-badge{ display:inline-block; min-width:56px; padding:4px 9px; border-radius:12px; text-align:center; font-size:12px; font-weight:700; }
.sb-free{ color:#2576bd; background:#eaf5ff; }
.sb-busy{ color:#4b9a2e; background:#eef9eb; }
.sb-qr{ color:#d34b4b; background:#fff0f0; }
.sb-relisted{ color:#84378e; background:#f6eafa; }
.list-amount{ color:#dc2626; font-weight:800; }
.list-enter-btn{ color:#fff; background:#2878c7; font-weight:600; border:none; padding:4px 12px; border-radius:6px; cursor:pointer; transition:all .15s; }.list-enter-btn:hover{ background:#1d6ab5; box-shadow:0 2px 6px rgba(40,120,199,.3); }
.table-row-qr td{ background:#fffafa !important; }
.table-row-busy td{ background:#fbfefb !important; }
.table-row-relisted td{ background:#fdfaff !important; }
.table-row-printed td{ background:#fffaf0 !important; }
.table-row-free td{ background:#fcfdff !important; }
.table-search-view{ background:#f3f6fb; }
.search-panel{ max-width:none; margin-bottom:14px; padding:20px 22px; border:1px solid #dfe8f3; border-radius:10px; background:linear-gradient(135deg,#fff,#f8fbff); box-shadow:0 3px 12px rgba(36,61,91,.05); }
.search-hero{ display:flex; align-items:center; gap:10px; margin-bottom:16px; }
.search-hero-icon{ display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:9px; background:#eaf5ff; color:#2878c7; font-size:18px; }
.search-hero-title{ color:#263b57; font-size:19px; font-weight:800; }
.search-big-input{ max-width:680px; }
.search-big-input .el-input__inner{ height:42px; border-radius:8px; font-size:14px; }
.quick-filter{ display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-top:16px; color:#526277; font-size:13px; }.quick-filter .el-radio-button__inner{ border-color:#dce5f0; color:#526277; background:#fff; box-shadow:none; }.quick-filter .el-radio-button:first-child .el-radio-button__inner{ border-radius:16px 0 0 16px; }.quick-filter .el-radio-button:last-child .el-radio-button__inner{ border-radius:0 16px 16px 0; }.quick-filter .el-radio-button__orig-radio:checked + .el-radio-button__inner{ color:#fff; background:#2878c7; border-color:#2878c7; box-shadow:-1px 0 0 0 #2878c7; }.qf-label{ color:#526277; font-weight:600; white-space:nowrap; }
.quick-filter .el-radio-group{ margin-left:0; }
.search-result-bar{ display:flex; align-items:center; margin-bottom:10px; padding:0 2px; }
.search-result-title{ margin:0; color:#263b57; font-size:15px; font-weight:800; }
.search-result-count{ margin-left:10px; color:#8492a6; font-size:13px; }
.search-help{ display:flex; align-items:center; gap:5px; margin-top:12px; color:#8492a6; font-size:12px; }
.search-help .el-icon-info{ color:#75a6d3; font-size:14px; }
.report-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.soldout-header{ display: flex; align-items: center; margin-bottom: 8px; }
.soldout-tip{ margin-bottom: 10px; }
.soldout-highlight{ background: #f5f5f5 !important; opacity: 0.65; }
.soldout-picker-grid{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; max-height: 400px; overflow: auto; }
.soldout-picker-item{ height: 72px; border: 1px solid #dcdfe6; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; }
.soldout-picker-item:hover{ border-color: #409eff; box-shadow: 0 2px 8px rgba(64,158,255,.2); }
.soldout-picker-item.is-soldout{ background: #f5f7fa; opacity: 0.55; }
.spp-name{ font-size: 13px; font-weight: bold; margin-bottom: 4px; }
.spp-tag{ font-size: 11px; color: #67c23a; }
.spp-tag-ok{ color: #67c23a; }
.report-result{ padding: 10px 0; }
.report-result-header{ text-align: center; margin-bottom: 12px; }
.rr-title{ font-size: 18px; font-weight: bold; }
.rr-subtitle{ font-size: 12px; color: #909399; margin-top: 4px; }
.rr-bold{ font-weight: bold; }
.report-result-footer{ margin-top: 12px; font-size: 11px; color: #909399; border-top: 1px solid #ebeef5; padding-top: 8px; }
.report-grid{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.report-grid-item{ height: 80px; border: 1px solid #dcdfe6; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; }
.report-grid-item:hover{ border-color: #409eff; background: #ecf5ff; box-shadow: 0 2px 8px rgba(64,158,255,.2); }
.rgi-icon{ font-size: 24px; margin-bottom: 4px; }
.rgi-name{ font-size: 12px; color: #303133; font-weight: bold; }
.combo-btn{ padding: 8px; text-align: center; }
.combo-img{ width: 42px; height: 42px; object-fit: cover; border-radius: 5px; margin-bottom: 3px; }
.combo-picker{ max-height: 55vh; overflow: auto; padding-right: 4px; }
.combo-group{ padding: 12px; margin-bottom: 12px; border: 1px solid #ebeef5; border-radius: 8px; background: #fafcff; }
.combo-group-title{ margin-bottom: 9px; font-size: 14px; font-weight: bold; color: #303133; }
.combo-group-title span{ margin-left: 8px; color: #909399; font-size: 12px; font-weight: normal; }
.combo-options{ display: flex; flex-wrap: wrap; gap: 8px; }
.combo-options .el-button{ margin: 0; }
.combo-mod-title{ margin: 8px 0 4px; font-size: 12px; color: #909399; }
@media (max-width: 1200px){
  .food-grid.food-grid-fix{ grid-template-columns: repeat(6, 1fr) !important; }
  .food-btn{ min-height: 82px; padding: 6px 3px; }
  .food-img{ width: 36px; height: 36px; }
  .left-panel{ flex: 0 0 42%; }
}
@media (max-width: 900px){
  .food-grid.food-grid-fix{ grid-template-columns: repeat(6, 1fr) !important; }
  .cat-bar{ grid-template-columns: repeat(2, 1fr); max-width: 340px; }
  .cat-scroll .cat-pill{ padding: 0 14px; font-size: 12px; height: 36px; line-height: 36px; }
  .food-btn{ min-height: 108px; border-radius: 12px; padding: 10px 4px; }
  .food-img{ width: 56px; height: 56px; border-radius: 10px; }
  .board-card{ height: 130px; }
  .bc-no{ font-size: 30px; }
  .left-panel{ flex: 0 0 100%; }
  .right-panel{ flex: 0 0 100%; }
  .main{ flex-direction: column; }
}
@media (max-width: 600px){
  .food-grid.food-grid-fix{ grid-template-columns: repeat(5, 1fr) !important; }
  .cat-bar{ grid-template-columns: repeat(2, 1fr); max-width: 300px; }
  .food-btn{ min-height: 100px; }
  .food-img{ width: 50px; height: 50px; }
  .food-name{ font-size: 25px; }
  .food-price{ font-size: 25px; }
}
</style>
<style>
.bp-hint{ font-size:15px; color:#606266; margin-bottom:12px; }
.bp-list{ max-height:400px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; }
.bp-row{ padding:8px 12px; border-radius:8px; background:#f5f7fa; transition:background .2s; }
.bp-row:hover{ background:#ecf5ff; }
.bp-row .el-checkbox__label{ font-size:16px; font-weight:600; padding-left:8px; }
.bp-row .el-checkbox__inner{ width:22px; height:22px; border-radius:6px; border-width:2px; }
.bp-row .el-checkbox__input.is-checked .el-checkbox__inner{ background:#409eff; border-color:#409eff; }
.bp-row .el-checkbox__input.is-disabled .el-checkbox__inner{ background:#e4e7ed; border-color:#dcdfe6; }
.bp-row .el-checkbox__input.is-disabled .el-checkbox__label{ color:#c0c4cc; }
.biz-day-badge{ font-size:13px; padding:4px 12px; border-radius:6px; margin-right:4px; white-space:nowrap; }
.biz-day-badge.biz-open{ background:rgba(103,194,58,.2); color:#67c23a; }
.biz-day-badge.biz-closed{ background:rgba(245,108,108,.15); color:#f56c6c; }
.biz-day-info{ display:flex; gap:20px; font-size:14px; color:#606266; margin-bottom:8px; }
.biz-day-info i{ margin-right:4px; }
.shift-report,.day-report{ max-height:65vh; overflow-y:auto; }
.report-summary{ background:#f5f7fa; border-radius:8px; padding:12px 16px; }
.report-row{ display:flex; justify-content:space-between; padding:5px 0; font-size:14px; color:#606266; border-bottom:1px solid #ebeef5; }
.report-row:last-child{ border-bottom:none; }
.report-row.bold{ font-weight:700; color:#303133; font-size:15px; }

/* === 結帳面板 Eats365 風格 === */
.pay-overlay{ position:fixed; top:0; left:0; right:0; bottom:0; z-index:3000; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; animation: fadeIn .2s; }
@keyframes fadeIn{ from{opacity:0} to{opacity:1} }
.pay-panel{ display:flex; width:92vw; max-width:1100px; height:82vh; max-height:680px; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.3); }

/* 左側：訂單摘要 */
.pay-left{ width:38%; display:flex; flex-direction:column; border-right:1px solid #e5eaf2; background:#f8fafc; }
.pay-left-header{ padding:18px 20px 12px; border-bottom:1px solid #e5eaf2; display:flex; justify-content:space-between; align-items:center; }
.pay-left-title{ font-size:16px; font-weight:700; color:#303133; }
.pay-left-table{ font-size:13px; font-weight:700; color:#409eff; background:#ecf5ff; padding:3px 10px; border-radius:6px; }
.pay-order-list{ flex:1; overflow-y:auto; padding:10px 16px; }
.pay-order-item{ display:flex; align-items:center; padding:6px 0; border-bottom:1px dashed #f0f2f5; font-size:13px; }
.pay-oi-name{ flex:1; color:#303133; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pay-oi-qty{ width:40px; text-align:center; color:#909399; font-weight:600; }
.pay-oi-sub{ width:70px; text-align:right; color:#303133; font-weight:600; }
.pay-summary{ padding:12px 20px 18px; border-top:2px solid #e5eaf2; }
.pay-sum-row{ display:flex; justify-content:space-between; padding:4px 0; font-size:13px; color:#606266; }
.pay-sum-disc{ color:#e6a23c; }
.pay-sum-total{ margin-top:6px; padding-top:8px; border-top:1px solid #dcdfe6; font-size:15px; font-weight:700; color:#303133; }
.pay-sum-num{ color:#f01414; font-size:22px; font-weight:800; }

/* 右側：付款操作區 */
.pay-right{ flex:1; display:flex; flex-direction:column; padding:18px 24px; }
.pay-right-header{ margin-bottom:14px; }
.pay-pr-title{ font-size:15px; font-weight:700; color:#303133; }

/* 付款方式按鈕網格 */
.pay-method-grid{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:18px; }
.pay-method-btn{ display:flex; flex-direction:column; align-items:center; justify-content:center; padding:14px 8px; border:2px solid #e5eaf2; border-radius:12px; cursor:pointer; transition:all .15s; background:#fff; }
.pay-method-btn:hover{ border-color:#c0c4cc; background:#f5f7fa; }
.pay-method-btn.active{ border-color:#409eff; background:#ecf5ff; box-shadow:0 0 0 1px #409eff; }
.pay-method-icon{ font-size:24px; color:#606266; margin-bottom:4px; }
.pay-method-btn.active .pay-method-icon{ color:#409eff; }
.pay-method-label{ font-size:13px; font-weight:600; color:#303133; }
.pay-method-btn.active .pay-method-label{ color:#409eff; }

/* 現金專區 */
.pay-cash-section{ flex:1; display:flex; flex-direction:column; }
.pay-cash-display{ text-align:center; margin-bottom:10px; }
.pay-cash-label{ font-size:12px; color:#909399; margin-bottom:2px; }
.pay-cash-amount{ font-size:36px; font-weight:800; color:#303133; letter-spacing:1px; }

/* 快速金額按鈕 */
.pay-quick-row{ display:flex; gap:8px; margin-bottom:12px; }
.pay-quick-btn{ flex:1; text-align:center; padding:10px; border:1.5px solid #dcdfe6; border-radius:8px; font-size:13px; font-weight:700; color:#303133; cursor:pointer; transition:all .15s; background:#fff; }
.pay-quick-btn:hover{ border-color:#409eff; color:#409eff; background:#f5faff; }

/* 數字鍵盤 */
.pay-numpad{ display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:10px; }
.pay-np-key{ text-align:center; padding:12px; border:1px solid #e5eaf2; border-radius:8px; font-size:18px; font-weight:600; color:#303133; cursor:pointer; transition:all .1s; background:#fff; user-select:none; }
.pay-np-key:active{ background:#ecf5ff; border-color:#409eff; transform:scale(.96); }
.pay-np-del{ color:#f56c6c; }

/* 上下班數字鍵盤 */
.clock-numpad{ display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:0 8px 8px; }
.clock-np-key{ text-align:center; padding:12px; border:1px solid #e5eaf2; border-radius:8px; font-size:18px; font-weight:600; color:#303133; cursor:pointer; transition:all .1s; background:#fff; user-select:none; }
.clock-np-key:active{ background:#ecf5ff; border-color:#409eff; transform:scale(.96); }
.clock-np-fn{ color:#f56c6c; }

/* 找零 */
.pay-change-row{ text-align:center; padding:8px; font-size:14px; font-weight:700; color:#67c23a; background:#f0f9eb; border-radius:8px; margin-bottom:8px; }
.pay-change-val{ font-size:20px; margin-left:6px; }
.pay-change-neg{ color:#f56c6c; background:#fef0f0; }

/* 非現金提示 */
.pay-noncash-hint{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#909399; font-size:14px; }
.pay-noncash-icon{ font-size:48px; color:#67c23a; margin-bottom:12px; }

/* 操作按鈕 */
.pay-actions{ display:flex; gap:12px; margin-top:auto; padding-top:14px; border-top:1px solid #e5eaf2; }
.pay-btn-cancel{ flex:1; text-align:center; padding:14px; border:1.5px solid #dcdfe6; border-radius:10px; font-size:15px; font-weight:600; color:#606266; cursor:pointer; transition:all .15s; }
.pay-btn-cancel:hover{ border-color:#f56c6c; color:#f56c6c; }
.pay-btn-confirm{ flex:2; text-align:center; padding:14px; border:none; border-radius:10px; font-size:16px; font-weight:700; color:#fff; background:linear-gradient(135deg,#409eff,#2878c7); cursor:pointer; transition:all .15s; box-shadow:0 4px 14px rgba(64,158,255,.35); }
.pay-btn-confirm:hover{ background:linear-gradient(135deg,#66b1ff,#409eff); transform:translateY(-1px); }
.pay-btn-confirm.disabled{ opacity:.45; pointer-events:none; }
</style>
