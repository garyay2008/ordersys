<template>
  <div class="pos-viewport">
    <!-- 打印機跳飛提示（頂部閃色大字） -->
    <transition name="failover">
      <div v-if="failoverNotice.show" class="failover-banner">
        <div class="failover-title"><i class="el-icon-warning"></i> 打印機跳飛</div>
        <div class="failover-main">「{{ failoverNotice.from }}」→「{{ failoverNotice.to }}」</div>
        <div v-if="failoverNotice.deskNo || failoverNotice.orderNo" class="failover-sub">枱號 {{ failoverNotice.deskNo || '—' }}<span v-if="failoverNotice.orderNo"> · 單號 {{ failoverNotice.orderNo }}</span></div>
      </div>
    </transition>
    <!-- 打印機未送出提示（缺紙/離線/開蓋，未送廚） -->
    <transition name="failover">
      <div v-if="blockedNotice.show" class="failover-banner blocked-banner">
        <div class="failover-title"><i class="el-icon-warning"></i> 打印機未送出</div>
        <div class="failover-main">「{{ blockedNotice.station }}」{{ blockedNotice.reason }}</div>
        <div v-if="blockedNotice.deskNo || blockedNotice.orderNo" class="failover-sub">枱號 {{ blockedNotice.deskNo || '—' }}<span v-if="blockedNotice.orderNo"> · 單號 {{ blockedNotice.orderNo }}</span></div>
      </div>
    </transition>
    <div id="pos" :style="posScaleStyle">
    <!-- 登入視圖 -->
    <div v-if="!loggedIn" class="login-view">
      <div class="login-card">
        <!-- 頂部列：收銀機 + 時鐘 -->
        <div class="login-topbar">
          <span v-if="selectedTerminal" class="login-terminal"><i class="el-icon-monitor"></i> {{ selectedTerminal }}</span>
          <span v-else class="login-terminal login-terminal-empty"></span>
          <div class="login-topbar-right">
            <span class="login-clock"><i class="el-icon-time"></i> {{ currentTime }}</span>
            <el-tooltip content="連線設定" placement="bottom">
              <span class="login-conn-setting" @click="openConnSettings"><i class="el-icon-setting"></i></span>
            </el-tooltip>
          </div>
        </div>

        <!-- 品牌區 -->
        <div class="login-brand">
          <div class="login-icon"><i class="el-icon-sell"></i></div>
          <div class="login-title">{{ shopName || 'POS 系統' }}</div>
        </div>

        <!-- 顯示屏（收銀機樣式） -->
        <div class="login-display">
          <div class="login-steps">
            <div class="login-step" :class="{ active: loginActive === 'no', done: !!loginNo }" @click="loginActive = 'no'">
              <span class="login-step-no">1</span><span>員工編號</span>
            </div>
            <div class="login-step-arrow"><i class="el-icon-right"></i></div>
            <div class="login-step" :class="{ active: loginActive === 'password', done: !!loginPassword }" @click="loginActive = 'password'">
              <span class="login-step-no">2</span><span>密碼</span>
            </div>
          </div>
          <div class="login-screen" :class="{ mask: loginActive === 'password' }" @click="toggleLoginActive">
            <span class="login-screen-label">{{ loginActive === 'no' ? '員工編號' : '密碼' }}</span>
            <span class="login-screen-value">{{ loginActive === 'no' ? (loginNo || '請輸入編號') : (loginPasswordMask || '請輸入密碼') }}</span>
          </div>
        </div>

        <!-- 數字鍵盤 -->
        <div class="login-keypad">
          <number-pad :value="loginActiveValue" :masked="loginActive === 'password'" :confirm-label="loginConfirmLabel" :show-screen="false" @input="onLoginKeypadInput" @confirm="onLoginKeypadConfirm"></number-pad>
        </div>

        <!-- 上班/下班按鈕 -->
        <div class="login-actions">
          <el-button type="success" plain size="medium" class="shift-btn" @click="openClockIn"><i class="el-icon-sunrise-1"></i> 上班</el-button>
          <el-button type="danger" plain size="medium" class="shift-btn" @click="openClockOut"><i class="el-icon-switch-button"></i> 下班</el-button>
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
          <span class="staff-name"><i class="el-icon-user"></i> {{ staffInfo.name }} · {{ levelLabel(staffInfo.permissionLevel) }}</span>
          <span v-if="selectedTerminal" class="terminal-badge"><i class="el-icon-monitor"></i> {{ selectedTerminal }}</span>
          <span class="current-time header-time"><i class="el-icon-time"></i> {{ currentTime }}</span>
        </div>
      </div>
      <div class="board-body">
        <div class="board-main" :class="{ 'board-main-list': boardMode === 'list' || boardMode === 'history' }">
          <div v-if="boardMode === 'grid'" ref="floorCanvas" class="floor-canvas">
            <div class="floor-box" :style="boardBoxStyle">
            <div class="floor-inner" :style="boardScaleStyle">
            <div v-for="(t, i) in boardTables" :key="t._id" class="board-card floor-card" :class="boardClass(t.no)" :style="Object.assign({ height: boardCardHeight + 'px', width: boardCardWidthEff + 'px' }, floorStyle(t, i))"
                 @mousedown="onBoardMouseDown(t, $event)" @mouseup="onBoardMouseUp" @mouseleave="onBoardMouseUp" @click="onBoardClick(t)" @contextmenu.prevent="onBoardContextMenu(t, $event)" @touchstart="onBoardTouchStart(t, $event)" @touchend="onBoardTouchEnd" @touchmove="onBoardTouchMove">
              <div class="bc-badge-group" v-if="!layoutMode && ((badgeStyle.transfer.visible !== false && isTransferred(t.no)) || (badgeStyle.merge.visible !== false && isMerged(t.no)) || (badgeStyle.split.visible !== false && isSplit(t.no)) || (badgeStyle.chase.visible !== false && isChased(t.no)))">
                <el-tooltip v-if="badgeStyle.transfer.visible !== false && isTransferred(t.no)" :content="transferInfo(t.no)" placement="top" effect="dark"><div class="bc-badge" :style="{ fontSize: badgeStyle.transfer.fontSize + 'px', color: badgeStyle.transfer.color, background: badgeStyle.transfer.background, width: badgeStyle.transfer.fontSize + 12 + 'px', height: badgeStyle.transfer.fontSize + 12 + 'px', lineHeight: badgeStyle.transfer.fontSize + 12 + 'px' }">轉</div></el-tooltip>
                <el-tooltip v-if="badgeStyle.merge.visible !== false && isMerged(t.no)" :content="mergeInfo(t.no)" placement="top" effect="dark"><div class="bc-badge" :style="{ fontSize: badgeStyle.merge.fontSize + 'px', color: badgeStyle.merge.color, background: badgeStyle.merge.background, width: badgeStyle.merge.fontSize + 12 + 'px', height: badgeStyle.merge.fontSize + 12 + 'px', lineHeight: badgeStyle.merge.fontSize + 12 + 'px' }">合</div></el-tooltip>
                <el-tooltip v-if="badgeStyle.split.visible !== false && isSplit(t.no)" :content="splitInfo(t.no)" placement="top" effect="dark"><div class="bc-badge" :style="{ fontSize: badgeStyle.split.fontSize + 'px', color: badgeStyle.split.color, background: badgeStyle.split.background, width: badgeStyle.split.fontSize + 12 + 'px', height: badgeStyle.split.fontSize + 12 + 'px', lineHeight: badgeStyle.split.fontSize + 12 + 'px' }">分</div></el-tooltip>
                <el-tooltip v-if="badgeStyle.chase.visible !== false && isChased(t.no)" :content="chasedInfo(t.no)" placement="top" effect="dark"><div class="bc-badge" :style="{ fontSize: badgeStyle.chase.fontSize + 'px', color: badgeStyle.chase.color, background: badgeStyle.chase.background, width: badgeStyle.chase.fontSize + 12 + 'px', height: badgeStyle.chase.fontSize + 12 + 'px', lineHeight: badgeStyle.chase.fontSize + 12 + 'px' }">追</div></el-tooltip>
              </div>
              <div v-if="cardDisplay.seats.show" class="bc-topline"><span class="bc-seats" :style="{ fontSize: cardDisplay.seats.fontSize + 'px' }"><i class="el-icon-user"></i> {{ t.seats }}位</span><i v-if="cardDisplay.dot.show" class="bc-status-icon" :class="boardClass(t.no)" :style="{ width: cardDisplay.dot.fontSize + 'px', height: cardDisplay.dot.fontSize + 'px' }"></i></div>
              <div v-if="cardDisplay.tableNo.show" class="bc-no" :style="{ fontSize: cardDisplay.tableNo.fontSize + 'px' }">{{ tableLabel(t) }}</div>
              <div v-if="cardDisplay.amount.show && tableAmount(t.no) > 0" class="bc-amount" :style="{ fontSize: cardDisplay.amount.fontSize + 'px' }">${{ tableAmount(t.no) }}</div>
              <div v-if="cardDisplay.status.show" class="bc-status" :style="{ fontSize: cardDisplay.status.fontSize + 'px' }">{{ boardStatus(t.no) }}</div>
              <div v-if="cardDisplay.duration.show && hasOrder(t.no)" class="bc-meta" :style="{ fontSize: cardDisplay.duration.fontSize + 'px' }">{{ tableDuration(t.no) }}</div>
            </div>
            </div>
            </div>
          </div>
          <div v-if="boardMode === 'list'" class="table-list-view board-fullpage">
        <div class="list-topbar">
          <span class="list-title"><i class="el-icon-document"></i> 查看單據</span>
          <span class="list-close" title="離開" @click="boardMode = 'grid'"><i class="el-icon-close"></i></span>
        </div>
        <div class="list-hero">
          <div class="list-hero-stats">
            <span class="stat-item"><i class="dot free"></i> 空枱 {{ tableRows.filter(r => r.status === '空枱').length }}</span>
            <span class="stat-item"><i class="dot busy"></i> 用餐中 {{ tableRows.filter(r => r.status === '用餐中').length }}</span>
            <span class="stat-item"><i class="dot qr"></i> 使用中 {{ tableRows.filter(r => r.status === '使用中').length }}</span>
            <span class="stat-item"><i class="dot relisted"></i> 退單 {{ tableRows.filter(r => r.status === '退單').length }}</span>
            <span class="stat-item"><i class="dot printed"></i> 已印單 {{ tableRows.filter(r => r.status === '已印單').length }}</span>
            <span class="stat-item"><i class="dot settled"></i> 已付款 {{ tableRows.filter(r => r.status === '已付款').length }}</span>
          </div>
        </div>
        <div class="list-filter-row">
          <el-select v-model="tableListStatus" size="small" style="width: 130px;"><el-option label="全部狀態" value="all"></el-option><el-option label="空枱" value="free"></el-option><el-option label="用餐中" value="active"></el-option><el-option label="使用中" value="qr"></el-option><el-option label="已印單" value="printed"></el-option><el-option label="已付款" value="settled"></el-option></el-select>
          <el-select v-model="tableListSort" size="small" style="width: 150px;"><el-option label="依枱號排序" value="table"></el-option><el-option label="依入座時間" value="time"></el-option><el-option label="依當前消費" value="amount"></el-option></el-select>
          <el-button-group size="small" style="margin-left: 8px;">
            <el-button :type="tableListZone === 'all' ? 'primary' : ''" @click="tableListZone = 'all'">全部</el-button>
            <el-button :type="tableListZone === '堂食' ? 'primary' : ''" @click="tableListZone = '堂食'">堂食</el-button>
            <el-button :type="tableListZone === '外賣枱' ? 'warning' : ''" @click="tableListZone = '外賣枱'">外賣枱</el-button>
            <el-button :type="tableListZone === '外賣' ? 'danger' : ''" @click="tableListZone = '外賣'">外賣</el-button>
          </el-button-group>
          <el-input v-model="tableListKeyword" size="small" readonly placeholder="輸入枱號" prefix-icon="el-icon-search" style="width: 140px;" @click.native="openListKeypad('keyword')"></el-input>
          <el-input v-model="tableListOrderNo" size="small" readonly placeholder="輸入單號" style="width: 140px;" @click.native="openListKeypad('orderNo')"></el-input>
          <el-input v-model="tableListPluNo" size="small" readonly placeholder="輸入貨品編號" style="width: 140px;" @click.native="openListKeypad('pluNo')"></el-input>
          <span class="list-count">共 {{ tableListRows.length }} 枱</span>
        </div>
        <div class="list-table-wrap">
        <el-table :data="tableListRows" stripe size="small" height="100%" :row-class-name="tableRowClass" @row-click="onTableRowClick">
          <el-table-column prop="label" label="枱號" min-width="70"><template slot-scope="scope"><span class="list-table-no">{{ scope.row.label }}</span></template></el-table-column>
          <el-table-column prop="zone" label="區域" min-width="80"></el-table-column>
          <el-table-column prop="orderNo" label="訂單編號" min-width="130" show-overflow-tooltip></el-table-column>
          <el-table-column label="狀態" min-width="96"><template slot-scope="scope"><span class="status-badge" :class="'sb-' + (scope.row.status === '空枱' ? 'free' : scope.row.status === '用餐中' ? 'busy' : scope.row.status === '使用中' ? 'qr' : scope.row.status === '已付款' ? 'settled' : scope.row.status === '已印單' ? 'printed' : 'relisted')">{{ scope.row.status }}</span></template></el-table-column>
          <el-table-column prop="seats" label="人數" min-width="56"></el-table-column>
          <el-table-column prop="openTime" label="開枱時間" min-width="120"></el-table-column>
          <el-table-column prop="duration" label="用餐時長" min-width="88"></el-table-column>
          <el-table-column prop="amount" label="消費" min-width="88"><template slot-scope="scope"><span class="list-amount">{{ scope.row.amount }}</span></template></el-table-column>
          <el-table-column prop="waiter" label="入單員工" min-width="84" show-overflow-tooltip></el-table-column>
          <el-table-column prop="printer" label="印單員工" min-width="84" show-overflow-tooltip></el-table-column>
          <el-table-column prop="cashier" label="結帳員工" min-width="84" show-overflow-tooltip></el-table-column>
          <el-table-column label="操作" min-width="150"><template slot-scope="scope"><template v-if="scope.row.status === '已付款'"><el-button size="mini" type="text" class="list-enter-btn" @click.stop="openSettledOrder(scope.row)">進入點餐</el-button><el-button size="mini" type="text" @click.stop="openChangePay(scope.row)">更改付款</el-button><el-button size="mini" type="text" @click.stop="promptUnsettle(scope.row)">反結賬</el-button><el-button size="mini" type="text" @click.stop="openDeptSplitOrder(scope.row)">大單分帳</el-button></template><el-button v-else size="mini" type="text" class="list-enter-btn" @click.stop="onTableRowClick(scope.row)">進入點餐</el-button></template></el-table-column>
        </el-table>
        </div>
      </div>
      <div v-else-if="boardMode === 'history'" class="table-list-view board-fullpage">
        <div class="list-topbar">
          <span class="list-title"><i class="el-icon-document"></i> 往日單據</span>
          <span class="list-close" title="離開" @click="boardMode = 'grid'"><i class="el-icon-close"></i></span>
        </div>
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
        <div class="list-table-wrap">
        <el-table :data="historyOrders" stripe size="small" height="100%" v-loading="historyLoading" empty-text="暫無往日單據">
          <el-table-column prop="orderNo" label="單號" width="185"></el-table-column>
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
          <el-table-column label="入單員工" width="100">
            <template slot-scope="scope">{{ scope.row.waiter || '—' }}</template>
          </el-table-column>
          <el-table-column label="印單員工" width="100">
            <template slot-scope="scope">{{ scope.row.printer || '—' }}</template>
          </el-table-column>
          <el-table-column label="結帳員工" width="100">
            <template slot-scope="scope">{{ scope.row.cashier || '—' }}</template>
          </el-table-column>
          <el-table-column label="狀態" width="80">
            <template slot-scope="scope"><el-tag :type="scope.row.relisted ? 'warning' : 'success'" size="mini">{{ scope.row.relisted ? '退單' : '已完成' }}</el-tag></template>
          </el-table-column>
        </el-table>
        </div>
        <div v-if="historyTotal > 20" style="display:flex;justify-content:center;gap:8px;padding:14px 0;flex:0 0 auto;">
          <el-button size="small" :disabled="historyPage <= 1" icon="el-icon-arrow-left" @click="historyPage--; loadHistoryOrders()">上一頁</el-button>
          <el-button size="small" :disabled="historyPage >= Math.ceil(historyTotal / 20)" @click="historyPage++; loadHistoryOrders()">下一頁<i class="el-icon-arrow-right"></i></el-button>
        </div>
      </div>
      <div v-else-if="boardMode === 'search'" class="table-search-view">
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
          <el-table-column prop="waiter" label="入單員工" width="100"></el-table-column>
          <el-table-column prop="printer" label="印單員工" width="100"></el-table-column>
          <el-table-column prop="cashier" label="結帳員工" width="100"></el-table-column>
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
        <button class="sb-btn bottom" style="color:#ef4444;" @click="logout"><i class="el-icon-switch-button"></i><span>登出</span></button>
      </div>
    </div>
    </div>

    <!-- 點餐視圖 -->
    <template v-if="view === 'order'">
      <div v-if="pluInput" class="hw-plu-hint"><span class="hw-plu-label">貨品編號</span><b class="hw-plu-value">{{ pluInput }}</b><span class="hw-plu-help">Enter/＋ 加入 · － 退格 · . 清除</span></div>
      <!-- 側欄式（參考圖） -->
      <div v-if="orderLayout === 'sidebar'" class="order-layout" ref="orderLayout" :class="{ free: freeMode }" :style="themeVars">
            <div class="order-ticket" ref="orderTicket" :style="[ticketWidthStyle, panelStyle('ticket'), panelColorStyle('ticket')]">
              <div class="ot-head" :style="panelColorStyle('ticketHead')">
                <div class="ot-grid">
                  <el-button class="head-back ot-back" @mousedown.stop @click="backToBoard"><i class="el-icon-arrow-left"></i> 返回枱號</el-button>
                  <el-button class="head-back ot-cancel-item" @mousedown.stop @click="cancelItemFromBtn"><i class="el-icon-delete"></i> 單項取消</el-button>
                  <div class="ot-cell ot-mode-cell">
                    <div class="ot-cap">模式</div>
                    <div class="ot-big-num ot-mode-label" :class="{ 'ot-takeaway-label': !isDineIn }">{{ modeLabel }}</div>
                  </div>
                  <el-button class="head-back ot-item-detail" @mousedown.stop @click="toggleShowDetail"><i class="el-icon-document"></i> 詳細</el-button>
                  <div class="ot-cell ot-orderno-cell">
                    <div class="ot-cap">單據編號</div>
                    <div class="ot-big-num ot-order-no">{{ orderNoDisplay }}</div>
                  </div>
                  <div class="ot-cell ot-table-cell" @mousedown.stop>
                    <div class="ot-cap">枱號</div>
                    <div v-if="isDineIn" class="ot-big-num" @click="openTableKeypad">{{ selectedTableLabel }}<i class="el-icon-edit-outline ot-edit-icon"></i></div>
                    <div v-else class="ot-big-num ot-takeaway-label">{{ takeawayNoDisplay }}</div>
                  </div>
                  <div class="ot-cell ot-pax-cell" @mousedown.stop>
                    <div class="ot-cap">人數</div>
                    <div class="ot-big-num" @click="openPaxKeypad">{{ pax }}<span class="ot-big-unit">位</span><i class="el-icon-edit-outline ot-edit-icon"></i></div>
                  </div>
                  <div class="ot-cell ot-staff-cell">
                    <div class="ot-cap">入單員工</div>
                    <div class="ot-big-num ot-staff-name">{{ waiter || staffInfo.name || '—' }}</div>
                  </div>
                </div>
              </div>
              <div v-if="viewingSettled" class="settled-mode-bar">
                <span>已結賬單唯讀查看，如需修改請使用「反結賬」</span>
              </div>
              <div v-if="pendingItemDiscount" class="disc-mode-bar">
                <span>項目折扣：{{ pendingItemDiscount.free ? '贈送' : (pendingItemDiscount.pct ? '折 ' + pendingItemDiscount.pct + '%' : '折 $' + pendingItemDiscount.amount) }} · 已選 {{ discountSelectedIndexes.length }} 項</span>
                <el-button size="mini" type="primary" @click="applyDiscountToSelected">套用折扣</el-button>
                <el-button size="mini" @click="clearItemDiscount">取消</el-button>
              </div>
              <div class="order-list" ref="orderList">
                <cancel-edit-panel v-if="cancelEditMode.active" :cancel-edit-mode="cancelEditMode" :cancel-reasons="cancelReasons" :sent-items="cancelEditSentItems" @confirm="confirmCancelEdit" @cancel="exitCancelEdit"></cancel-edit-panel>
                <template v-else>
                <div v-for="(item, index) in cart" :key="index" class="order-row" :class="{ 'order-row-sent': item.sent, 'order-row-called': item.dishStatus === 'called', 'order-row-swiped': swipeIndex === index, 'order-row-selected': selectedCartIndex === index }"
                     @touchstart="onSwipeStart(index, $event)" @touchmove="onSwipeMove(index, $event)" @touchend="onSwipeEnd(index, $event)" @click="onRowClick(index)">
                  <div class="or-main" @click="selectCartItem(index)">
                    <span class="or-name" :class="{ 'or-name-served': item.dishStatus === 'served' && (item.comboId || (item.contents && item.contents.length)) }" @click.stop="onNameClick(index)">{{ index + 1 }}. {{ item.name }}<span v-if="item.free" class="tag-free tag-cancel" @click.stop="cancelItemDiscount(index)">贈 ✕</span><span v-else-if="item.discount < 1" class="tag-disc tag-cancel" @click.stop="cancelItemDiscount(index)">{{ Math.round(item.discount * 100) }}折 ✕</span><span v-else-if="item.customPrice > 0 && item.customPrice < item.price" class="tag-disc tag-cancel" @click.stop="cancelItemDiscount(index)">-${{ (item.price - item.customPrice).toFixed(2) }} ✕</span><span v-if="pendingItemDiscount && discountSelectedIndexes.includes(index)" :class="pendingItemDiscount.free ? 'tag-free' : 'tag-disc'">{{ pendingItemDiscount.free ? '贈' : (pendingItemDiscount.pct ? Math.round(100 - pendingItemDiscount.pct) + '折' : '-$' + pendingItemDiscount.amount) }}</span><span v-if="item.dishStatus === 'called'" :style="{ color: calledTagStyle.color, background: calledTagStyle.background, border: '1px solid ' + calledTagStyle.border }" class="tag-called">叫起</span><span v-if="item.dishStatus === 'served'" class="tag-served">已起菜</span></span>
                    <span v-if="item.sent" class="or-qty or-qty-locked">×{{ item.count }}</span>
                    <span v-else class="or-qty">
                      <el-button size="medium" circle icon="el-icon-minus" class="qty-btn" @click="changeQty(index, -1)" @mousedown.native="startQtyHold(index, -1)" @mouseup.native="stopQtyHold" @mouseleave.native="stopQtyHold" style="width: 40px; height: 40px; font-size: 18px; min-width: 40px; min-height: 40px;"></el-button>
                      <span class="qty-num" @click="openQtyPad(index)">{{ item.count }}</span>
                      <el-button size="medium" circle icon="el-icon-plus" class="qty-btn" @click="changeQty(index, 1)" @mousedown.native="startQtyHold(index, 1)" @mouseup.native="stopQtyHold" @mouseleave.native="stopQtyHold" style="width: 40px; height: 40px; font-size: 18px; min-width: 40px; min-height: 40px;"></el-button>
                    </span>
                    <span class="or-sub">${{ displaySubtotal(item, index) }}</span>
                  </div>
                  <div class="or-remark" v-if="item.mods && item.mods.length" @click="editItemMods(index)">
                    <span class="remark-label">改碼：</span><span v-for="(m, mi) in item.mods" :key="mi" class="mod-tag">{{ modNames([m])[0] }}<i class="mod-tag-x" @click.stop="removeItemMod(index, mi)">✕</i></span>
                  </div>
                  <div class="or-combo-items" v-if="item.showItems !== false && item.contents && item.contents.length">
                    <div class="combo-item-line" :class="{ 'combo-item-line-selected': selectedContentKey === (index + ':' + ci) }" v-for="(c, ci) in item.contents" :key="ci" @click.stop="openComboItemDialog(index, ci)">· {{ c.name }}<span v-if="c.dishStatus === 'served'" class="tag-served">已起菜</span><span class="combo-item-price">{{ c.priceText || (c.upgradePrice > 0 ? '+$' + c.upgradePrice : '$0') }}</span><template v-if="c.mods && c.mods.length"><span class="combo-mod-text">（{{ modNames(c.mods).join('、') }}）</span></template></div>
                    <div class="combo-edit-link" @click.stop="openComboEdit(index)">重選套餐內容</div>
                  </div>
                  <div class="or-detail" v-if="showDetail && detailLine(item)">{{ detailLine(item) }}</div>
                </div>
                <div v-if="!cart.length" class="empty">尚未點餐</div>
                <div v-if="cart.length > 0" class="order-page-btns">
                  <el-button size="mini" circle icon="el-icon-arrow-up" @click="scrollOrder(-1)"></el-button>
                  <el-button size="mini" circle icon="el-icon-arrow-down" @click="scrollOrder(1)"></el-button>
                </div>
                </template>
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
              <div v-for="n in ['1', '2', '3', '4', '5', '6', '7', '8', '9']" :key="n" class="pad-key pad-key-digit" @click="padPress(n)">{{ n }}</div>
            </div>
          </div>
          <div class="side-item pad-btn active" title="撳掣開數量鍵盤" @click="sideQtyPad">數量</div>
          <div class="side-item pad-btn" @click="sideOpenPlu">PLU</div>
        </div>

        <div class="order-main">
          <div class="order-body">
            <div class="food-column">
              <!-- 中間：食品九宮格 -->
              <div class="food-zone" ref="foodZone" :style="[panelStyle('foodZone'), panelColorStyle('foodZone'), foodVars]">
              <div class="food-top-row">
                <div class="cat-wrap">
                  <div class="cat-scroll" :style="catGridStyle">
                    <template v-for="cell in catGridCells">
                      <div v-if="cell.type === 'pill'" :key="cell.k" class="cat-pill" :class="{ active: activeTopCategoryId === String(cell.pill._id) }" :style="catPillStyle(cell.pill)" @click="openCategory(cell.pill)">{{ cell.pill.name }}<span v-if="slotBadge(cell.pill)" class="pill-slot">{{ slotBadge(cell.pill) }}</span></div>
                      <div v-else-if="cell.type === 'prev'" :key="cell.k" class="cat-pill cat-page-cell cat-page-prev" :class="{ 'cat-page-disabled': catPage <= 0 }" @click="catPrev">上頁</div>
                      <div v-else-if="cell.type === 'next'" :key="cell.k" class="cat-pill cat-page-cell cat-page-next" :class="{ 'cat-page-disabled': catPage >= catTotalPages - 1 }" @click="catNext">下頁</div>
                      <div v-else :key="cell.k" class="cat-pill cat-empty-cell"></div>
                    </template>
                  </div>
                </div>
              </div>
              <div class="food-grids" ref="foodGrids">
                <div class="food-grid food-grid-fix" :class="{ 'food-grid-paged': foodFixedMode }" :style="foodGridStyle">
                  <template v-for="cell in foodGridCells">
                    <div v-if="cell.type === 'item' && cell.item._itemType === 'back'" :key="cell.k" class="food-wrap">
                      <div class="food-btn cat-back-tile" @click="goUpCategory">
                        <div class="food-text">
                          <div class="food-name cat-back-tile-name"><i class="el-icon-arrow-left"></i>返回</div>
                        </div>
                      </div>
                    </div>
                    <div v-else-if="cell.type === 'item' && cell.item._itemType === 'category'" :key="cell.k" class="food-wrap">
                      <div class="food-btn cat-tile" :style="catTileStyle(cell.item)" @click="openCategory(cell.item)">
                        <div class="food-text">
                          <div class="food-name cat-tile-name">{{ cell.item.name }}</div>
                          <div class="cat-tile-arrow"><i class="el-icon-arrow-right"></i></div>
                        </div>
                      </div>
                    </div>
                    <div v-else-if="cell.type === 'item' && cell.item._itemType === 'combo'" :key="cell.k" class="food-wrap">
                      <div class="food-btn combo-btn" :class="{ 'food-soldout': cell.item.soldOut, 'food-no-img': !showFoodImages }" @click="foodClick(cell.item)" @mousedown="startFoodPress(cell.item, $event)" @mouseup="cancelFoodPress" @mouseleave="cancelFoodPress" @touchstart="startFoodPress(cell.item, $event)" @touchend="cancelFoodPress" @touchmove="cancelFoodPress">
                        <img v-if="cell.item.img && showFoodImages" :src="cell.item.img" class="food-img combo-img">
                        <div class="food-text">
                          <div class="food-name">{{ cell.item.name }}<span v-if="cell.item.soldOut" class="food-soldout-tag">售罄</span></div>
                          <div class="food-price" v-if="foodBtnSettings.showPrice !== false">${{ cell.item.price }}</div>
                        </div>
                        <div v-if="cell.item.soldOut" class="food-soldout-cross">✕</div>
                      </div>
                    </div>
                    <div v-else-if="cell.type === 'item'" :key="cell.k" class="food-wrap">
                      <div class="food-btn" :class="{ 'food-soldout': cell.item.soldOut, 'food-no-img': !showFoodImages }" :style="foodBtnStyle()" @click="foodClick(cell.item)" @mousedown="startFoodPress(cell.item, $event)" @mouseup="cancelFoodPress" @mouseleave="cancelFoodPress" @touchstart="startFoodPress(cell.item, $event)" @touchend="cancelFoodPress" @touchmove="cancelFoodPress">
                        <img v-if="cell.item.img && showFoodImages" :src="cell.item.img" class="food-img">
                        <div class="food-text">
                          <div class="food-plu" v-if="foodBtnSettings.showPlu !== false && !showFoodImages && cell.item.plu">{{ cell.item.plu }}</div>
                          <div class="food-name">{{ cell.item.name }}<span v-if="cell.item._isModCode" class="food-mod-badge">改碼</span><span v-if="cell.item.soldOut" class="food-soldout-tag">沽清</span></div>
                          <div class="food-price" v-if="foodBtnSettings.showPrice !== false && !cell.item._isModCategory">${{ cell.item.price }}</div>
                          <div class="food-stock" v-if="foodBtnSettings.showStock !== false && cell.item.stock >= 0 && !cell.item.soldOut">剩餘 {{ cell.item.stock }} 份</div>
                        </div>
                        <div v-if="cell.item.soldOut" class="food-soldout-cross">✕</div>
                      </div>
                    </div>
                    <div v-else-if="cell.type === 'prev'" :key="cell.k" class="food-wrap">
                      <div class="food-btn food-page-cell" :class="{ 'food-page-disabled': foodPage <= 0 }" @click="foodPrev">上頁</div>
                    </div>
                    <div v-else-if="cell.type === 'next'" :key="cell.k" class="food-wrap">
                      <div class="food-btn food-page-cell" :class="{ 'food-page-disabled': foodPage >= foodTotalPages - 1 }" @click="foodNext">下頁</div>
                    </div>
                    <div v-else :key="cell.k" class="food-wrap"><div class="food-btn food-empty-cell"></div></div>
                  </template>
                </div>
              </div>
            </div>

              <div class="resizer-h" title="拖動調整底部操作區高度"></div>

              <!-- 底部功能 dock（同食品區同闊度） -->
              <div class="action-dock" ref="actionDock" :style="[dockHeightStyle, panelStyle('dock')]">
                <div v-if="posDockRowsPerPage > 0 && dockTotalPages > 1" class="dock-page-nav" :style="{ background: dockNav.bgColor + '18', borderRadius: '6px', gap: dockNav.gap + 'px' }">
                  <button class="dock-page-btn" :style="{ fontSize: dockNav.fontSize + 'px', width: dockNav.width + 'px', height: dockNav.height + 'px', background: dockNav.bgColor, color: dockNav.textColor }" :disabled="dockPage <= 0" @click="dockPrev" title="上一頁">▲</button>
                  <span class="dock-page-num" :style="{ fontSize: dockNav.pageNumFontSize + 'px', color: dockNav.textColor + 'cc' }">{{ dockPage + 1 }}/{{ dockTotalPages }}</span>
                  <button class="dock-page-btn" :style="{ fontSize: dockNav.fontSize + 'px', width: dockNav.width + 'px', height: dockNav.height + 'px', background: dockNav.bgColor, color: dockNav.textColor }" :disabled="dockPage >= dockTotalPages - 1" @click="dockNext" title="下一頁">▼</button>
                </div>
                <div class="dock-left" ref="dockLeft" :style="[dockMinHStyle(), dockLeftColorStyle()]">
                  <div class="bb-rows">
                    <div class="bb-row" v-for="(row, ri) in dockRows" :key="ri" :style="dockRowGridStyle">
                      <div v-for="b in row" :key="b.id" class="btn-wrap" :data-btn="b.id" :style="btnPosStyle(b)">
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
      <div v-if="orderLayout !== 'sidebar'" class="classic-layout" :style="themeVars">
        <div class="top-bar">
          <div class="ot-grid classic-grid">
            <el-button class="head-back ot-back" @click="backToBoard"><i class="el-icon-arrow-left"></i> 返回枱號</el-button>
            <el-button class="head-back ot-cancel-item" @click="cancelItemFromBtn"><i class="el-icon-delete"></i> 單項取消</el-button>
            <div class="ot-cell ot-mode-cell">
              <div class="ot-cap">模式</div>
              <div class="ot-big-num ot-mode-label" :class="{ 'ot-takeaway-label': !isDineIn }">{{ modeLabel }}</div>
            </div>
            <el-button class="head-back ot-item-detail" @click="toggleShowDetail"><i class="el-icon-document"></i> 詳細</el-button>
            <div class="ot-cell ot-orderno-cell">
              <div class="ot-cap">單據編號</div>
              <div class="ot-big-num ot-order-no">{{ orderNoDisplay }}</div>
            </div>
            <div class="ot-cell ot-table-cell">
              <div class="ot-cap">枱號</div>
              <div v-if="isDineIn" class="ot-big-num" @click="openTableKeypad">{{ selectedTableLabel }}<i class="el-icon-edit-outline ot-edit-icon"></i></div>
              <div v-else class="ot-big-num ot-takeaway-label">{{ takeawayNoDisplay }}</div>
            </div>
            <div class="ot-cell ot-pax-cell">
              <div class="ot-cap">人數</div>
              <div class="ot-big-num" @click="openPaxKeypad">{{ pax }}<span class="ot-big-unit">位</span><i class="el-icon-edit-outline ot-edit-icon"></i></div>
            </div>
            <div class="ot-cell ot-staff-cell">
              <div class="ot-cap">入單員工</div>
              <div class="ot-big-num ot-staff-name">{{ waiter || staffInfo.name || '—' }}</div>
            </div>
          </div>
        </div>

        <div class="main">
          <div class="left-panel" :style="panelColorStyle('ticket')">
            <div v-if="viewingSettled" class="settled-mode-bar">
              <span>已結賬單唯讀查看，如需修改請使用「反結賬」</span>
            </div>
            <div v-if="pendingItemDiscount" class="disc-mode-bar">
                <span>項目折扣：{{ pendingItemDiscount.free ? '贈送' : (pendingItemDiscount.pct ? '折 ' + pendingItemDiscount.pct + '%' : '折 $' + pendingItemDiscount.amount) }} · 已選 {{ discountSelectedIndexes.length }} 項</span>
                <el-button size="mini" type="primary" @click="applyDiscountToSelected">套用折扣</el-button>
                <el-button size="mini" @click="clearItemDiscount">取消</el-button>
              </div>
            <div class="order-head">
              <span class="oh-name">品項</span>
              <span class="oh-qty">數量</span>
              <span class="oh-price">單價</span>
              <span class="oh-sub">小計</span>
            </div>
            <div class="order-list" ref="orderList">
              <cancel-edit-panel v-if="cancelEditMode.active" :cancel-edit-mode="cancelEditMode" :cancel-reasons="cancelReasons" :sent-items="cancelEditSentItems" @confirm="confirmCancelEdit" @cancel="exitCancelEdit"></cancel-edit-panel>
              <template v-else>
              <div v-for="(item, index) in cart" :key="index" class="order-row" :class="{ 'order-row-sent': item.sent, 'order-row-called': item.dishStatus === 'called', 'order-row-swiped': swipeIndex === index, 'order-row-selected': selectedCartIndex === index }"
                   @touchstart="onSwipeStart(index, $event)" @touchmove="onSwipeMove(index, $event)" @touchend="onSwipeEnd(index, $event)" @click="onRowClick(index)">
                <div class="or-main" @click="selectCartItem(index)">
                  <span class="or-name" :class="{ 'or-name-served': item.dishStatus === 'served' && (item.comboId || (item.contents && item.contents.length)) }" @click.stop="onNameClick(index)">{{ index + 1 }}. {{ item.name }}<span v-if="item.free" class="tag-free tag-cancel" @click.stop="cancelItemDiscount(index)">贈 ✕</span><span v-else-if="item.discount < 1" class="tag-disc tag-cancel" @click.stop="cancelItemDiscount(index)">{{ Math.round(item.discount * 100) }}折 ✕</span><span v-else-if="item.customPrice > 0 && item.customPrice < item.price" class="tag-disc tag-cancel" @click.stop="cancelItemDiscount(index)">-${{ (item.price - item.customPrice).toFixed(2) }} ✕</span><span v-if="pendingItemDiscount && discountSelectedIndexes.includes(index)" :class="pendingItemDiscount.free ? 'tag-free' : 'tag-disc'">{{ pendingItemDiscount.free ? '贈' : (pendingItemDiscount.pct ? Math.round(100 - pendingItemDiscount.pct) + '折' : '-$' + pendingItemDiscount.amount) }}</span><span v-if="item.dishStatus === 'called'" :style="{ color: calledTagStyle.color, background: calledTagStyle.background, border: '1px solid ' + calledTagStyle.border }" class="tag-called">叫起</span><span v-if="item.dishStatus === 'served'" class="tag-served">已起菜</span></span>
                  <span v-if="item.sent" class="or-qty or-qty-locked">×{{ item.count }}</span>
                  <span v-else class="or-qty">
                    <el-button size="medium" circle icon="el-icon-minus" class="qty-btn" @click="changeQty(index, -1)" @mousedown.native="startQtyHold(index, -1)" @mouseup.native="stopQtyHold" @mouseleave.native="stopQtyHold" style="width: 40px; height: 40px; font-size: 18px; min-width: 40px; min-height: 40px;"></el-button>
                    <span class="qty-num" @click="openQtyPad(index)">{{ item.count }}</span>
                    <el-button size="medium" circle icon="el-icon-plus" class="qty-btn" @click="changeQty(index, 1)" @mousedown.native="startQtyHold(index, 1)" @mouseup.native="stopQtyHold" @mouseleave.native="stopQtyHold" style="width: 40px; height: 40px; font-size: 18px; min-width: 40px; min-height: 40px;"></el-button>
                  </span>
                  <span class="or-price">${{ displayUnitPrice(item, index) }}</span>
                  <span class="or-sub">${{ displaySubtotal(item, index) }}</span>
                </div>
                <div class="or-remark" v-if="item.mods && item.mods.length" @click="editItemMods(index)">
                  <span class="remark-label">改碼：</span><span v-for="(m, mi) in item.mods" :key="mi" class="mod-tag">{{ modNames([m])[0] }}<i class="mod-tag-x" @click.stop="removeItemMod(index, mi)">✕</i></span>
                </div>
                <div class="or-combo-items" v-if="item.showItems !== false && item.contents && item.contents.length">
                  <div class="combo-item-line" :class="{ 'combo-item-line-selected': selectedContentKey === (index + ':' + ci) }" v-for="(c, ci) in item.contents" :key="ci" @click.stop="openComboItemDialog(index, ci)">· {{ c.name }}<span v-if="c.dishStatus === 'served'" class="tag-served">已起菜</span><span class="combo-item-price">{{ c.priceText || (c.upgradePrice > 0 ? '+$' + c.upgradePrice : '$0') }}</span><template v-if="c.mods && c.mods.length"><span class="combo-mod-text">（{{ modNames(c.mods).join('、') }}）</span></template></div>
                  <div class="combo-edit-link" @click.stop="openComboEdit(index)">重選套餐內容</div>
                </div>
                <div class="or-detail" v-if="showDetail && detailLine(item)">{{ detailLine(item) }}</div>
              </div>
              <div v-if="!cart.length" class="empty">尚未點餐</div>
              </template>
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

          <div class="right-panel" :style="foodVars">
            <div class="cat-wrap">
              <div class="cat-scroll" :style="catGridStyle">
                <template v-for="cell in catGridCells">
                  <div v-if="cell.type === 'pill'" :key="cell.k" class="cat-pill" :class="{ active: activeTopCategoryId === String(cell.pill._id) }" :style="catPillStyle(cell.pill)" @click="openCategory(cell.pill)">{{ cell.pill.name }}<span v-if="slotBadge(cell.pill)" class="pill-slot">{{ slotBadge(cell.pill) }}</span></div>
                  <div v-else-if="cell.type === 'prev'" :key="cell.k" class="cat-pill cat-page-cell cat-page-prev" :class="{ 'cat-page-disabled': catPage <= 0 }" @click="catPrev">上頁</div>
                  <div v-else-if="cell.type === 'next'" :key="cell.k" class="cat-pill cat-page-cell cat-page-next" :class="{ 'cat-page-disabled': catPage >= catTotalPages - 1 }" @click="catNext">下頁</div>
                  <div v-else :key="cell.k" class="cat-pill cat-empty-cell"></div>
                </template>
              </div>
            </div>
            <div class="food-grid food-grid-fix" :style="foodGridStyle">
              <template v-for="cell in foodGridCells">
                <div v-if="cell.type === 'item' && cell.item._itemType === 'back'" :key="cell.k" class="food-wrap">
                  <div class="food-btn cat-back-tile" @click="goUpCategory">
                    <div class="food-text">
                      <div class="food-name cat-back-tile-name"><i class="el-icon-arrow-left"></i>返回</div>
                    </div>
                  </div>
                </div>
                <div v-else-if="cell.type === 'item' && cell.item._itemType === 'category'" :key="cell.k" class="food-wrap">
                  <div class="food-btn cat-tile" :style="catTileStyle(cell.item)" @click="openCategory(cell.item)">
                    <div class="food-text">
                      <div class="food-name cat-tile-name">{{ cell.item.name }}</div>
                      <div class="cat-tile-arrow"><i class="el-icon-arrow-right"></i></div>
                    </div>
                  </div>
                </div>
                <div v-else-if="cell.type === 'item' && cell.item._itemType === 'combo'" :key="cell.k" class="food-wrap">
                  <div class="food-btn combo-btn" :class="{ 'food-soldout': cell.item.soldOut, 'food-no-img': !showFoodImages }" @click="foodClick(cell.item)" @mousedown="startFoodPress(cell.item, $event)" @mouseup="cancelFoodPress" @mouseleave="cancelFoodPress" @touchstart="startFoodPress(cell.item, $event)" @touchend="cancelFoodPress" @touchmove="cancelFoodPress">
                    <img v-if="cell.item.img && showFoodImages" :src="cell.item.img" class="food-img combo-img">
                    <div class="food-text">
                      <div class="food-name">{{ cell.item.name }}<span v-if="cell.item.soldOut" class="food-soldout-tag">售罄</span></div>
                      <div class="food-price" v-if="foodBtnSettings.showPrice !== false">${{ cell.item.price }}</div>
                    </div>
                    <div v-if="cell.item.soldOut" class="food-soldout-cross">✕</div>
                  </div>
                </div>
                <div v-else-if="cell.type === 'item'" :key="cell.k" class="food-wrap">
                  <div class="food-btn" :class="{ 'food-soldout': cell.item.soldOut, 'food-no-img': !showFoodImages }" :style="foodBtnStyle()" @click="foodClick(cell.item)" @mousedown="startFoodPress(cell.item, $event)" @mouseup="cancelFoodPress" @mouseleave="cancelFoodPress" @touchstart="startFoodPress(cell.item, $event)" @touchend="cancelFoodPress" @touchmove="cancelFoodPress">
                    <img v-if="cell.item.img && showFoodImages" :src="cell.item.img" class="food-img">
                    <div class="food-text">
                      <div class="food-plu" v-if="foodBtnSettings.showPlu !== false && !showFoodImages && cell.item.plu">{{ cell.item.plu }}</div>
                      <div class="food-name">{{ cell.item.name }}<span v-if="cell.item._isModCode" class="food-mod-badge">改碼</span><span v-if="cell.item.soldOut" class="food-soldout-tag">沽清</span></div>
                      <div class="food-price" v-if="foodBtnSettings.showPrice !== false && !cell.item._isModCategory">${{ cell.item.price }}</div>
                      <div class="food-stock" v-if="foodBtnSettings.showStock !== false && cell.item.stock >= 0 && !cell.item.soldOut">剩餘 {{ cell.item.stock }} 份</div>
                    </div>
                    <div v-if="cell.item.soldOut" class="food-soldout-cross">✕</div>
                  </div>
                </div>
                <div v-else-if="cell.type === 'prev'" :key="cell.k" class="food-wrap">
                  <div class="food-btn food-page-cell" :class="{ 'food-page-disabled': foodPage <= 0 }" @click="foodPrev">上頁</div>
                </div>
                <div v-else-if="cell.type === 'next'" :key="cell.k" class="food-wrap">
                  <div class="food-btn food-page-cell" :class="{ 'food-page-disabled': foodPage >= foodTotalPages - 1 }" @click="foodNext">下頁</div>
                </div>
                <div v-else :key="cell.k" class="food-wrap"><div class="food-btn food-empty-cell"></div></div>
              </template>
            </div>
          </div>
        </div>

        <div class="bottom-bar">
          <div class="bb-rows">
            <div class="bb-row" v-for="(row, ri) in buttonRows" :key="ri">
              <el-button v-for="b in row" :key="b.id" :type="btnType(b) || 'default'" :style="[btnStyle2(b), btnPosStyle(b)]" size="medium" :class="bbClass(b.id)" :disabled="btnDisabled(b)" @click="runAction(b.id)">{{ btnLabel(b) }}</el-button>
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
    <combo-dialog :combo-dialog="comboDialog" @confirm="confirmCombo"></combo-dialog>

    <!-- 品項編輯 -->
    <item-dialog :item-dialog="itemDialog" :mod-groups="modGroups" @confirm="confirmItemDialog" @change="previewItemMods" @cancel="onCancelItemDialog"></item-dialog>

    <!-- 改碼類別（混合列表點選，方案 A：多選 + 完成） -->
    <el-dialog :title="'改碼類別：' + modCatFoodDialog.name" :visible.sync="modCatFoodDialog.show" top="0vh" :modal="false" custom-class="pos-dialog modcat-food-dialog" append-to-body>
      <div v-if="modCatFoodDialog.items.length" class="modcat-food-list">
        <div v-for="m in modCatFoodDialog.items" :key="m._id" class="modcat-food-item" :class="{active: isModCatSelected(m)}" @click="toggleModCatFoodItem(m)">
          <span class="modcat-food-name">{{ m.name }}</span>
          <span v-if="(m.price || 0) > 0" class="modcat-food-price">+${{ m.price }}</span>
        </div>
      </div>
      <div v-else class="modcat-food-empty">此改碼類別暫無改碼</div>
      <div slot="footer" class="modcat-food-footer">
        <el-button @click="modCatFoodDialog.show = false">取消</el-button>
        <el-button type="primary" @click="confirmModCatFood">完成</el-button>
      </div>
    </el-dialog>

    <!-- 整單折扣 -->
    <whole-discount-dialog :whole-discount-dialog="wholeDiscountDialog" :total-price="totalPrice" :discounted-preview="discountedPreview" :discount-options="discountOptions" @pct-change="onWholePct" @amount-change="onWholeAmount" @clear="clearWholeDiscount" @confirm="confirmWholeDiscount"></whole-discount-dialog>

    <!-- 項目折扣 -->
    <item-discount-dialog :item-discount-dialog="itemDiscountDialog" :discount-options="discountOptions" @pct-change="onItemDiscountPct" @amount-change="onItemDiscountAmount" @clear="clearItemDiscount" @confirm="confirmItemDiscount"></item-discount-dialog>

    <!-- 結帳 / 收款 — Eats365 風格全屏 -->
    <pay-dialog :pay-dialog="payDialog" :pay-methods="payMethods" :cart="cart" :current-order="currentOrder" :selected-table="selectedTable" :is-dine-in="isDineIn" :order-discount="orderDiscount" :service-charge-enabled="serviceChargeEnabled" :service-charge-rate="serviceChargeRate" :service-charge-amount="serviceChargeAmount" :grand-total="grandTotal" @confirm="confirmPay"></pay-dialog>

    <!-- 數量鍵盤 -->
    <keypad-dialog :visible.sync="qtyDialog.show" title="輸入數量" :value="qtyDialog.value" @input="qtyDialog.value = $event" @confirm="confirmQty" decimal close-on-click-modal></keypad-dialog>

    <!-- 快速數量鍵盤 -->
    <keypad-dialog :visible.sync="qtyPanel.show" title="輸入數量" :value="qtyPanel.value" @input="qtyPanel.value = $event" @confirm="confirmQtyKeypad" decimal></keypad-dialog>

    <!-- 枱號 KeyPad -->
    <keypad-dialog :visible.sync="tableKeypad.show" title="輸入枱號" :value="tableKeypad.value" @input="tableKeypad.value = $event" @confirm="confirmTableKeypad" letters :hint="`可用枱號：${tables.map(t => tableLabel(t)).join('、')}`"></keypad-dialog>

    <!-- 人數 KeyPad -->
    <keypad-dialog :visible.sync="paxKeypad.show" title="輸入人數" :value="paxKeypad.value" @input="paxKeypad.value = $event" @confirm="confirmPaxKeypad"></keypad-dialog>

    <!-- 查看單據 篩選鍵盤 -->
    <keypad-dialog :visible.sync="listKeypad.show" :title="listKeypad.title" :value="listKeypad.value" @input="listKeypad.value = $event" @confirm="confirmListKeypad" :letters="listKeypad.letters"></keypad-dialog>

    <!-- PLU 鍵盤（右側常駐浮層，不遮左邊購物車） -->
    <el-drawer :visible.sync="pluDialog.show" title="PLU 加入（鍵盤）" direction="rtl" :size="340" :modal="false" append-to-body custom-class="plu-drawer">
      <number-pad :value="pluDialog.value" @input="pluDialog.value = $event" @confirm="confirmPlu"></number-pad>
      <div class="plu-fn-keys">
        <div class="plu-fn-key plu-fn-add" @click="confirmPlu">加入</div>
        <div class="plu-fn-key plu-fn-send" @click="directPayActive ? openPay() : sendOrder()">送單</div>
        <div class="plu-fn-key plu-fn-serving" @click="directPayActive ? openPay() : serveTicket()">上菜紙</div>
      </div>
      <div class="plu-fn-exit" @click="pluDialog.show = false">退出</div>
    </el-drawer>

    <!-- 合拼枱 / 分單 -->
    <table-dialog :table-dialog="tableDialog" :selected-table="selectedTable" :table-hint="tables.map(t => tableLabel(t)).join('、')" :current-order="currentOrder" :split-left-items="splitLeftItems" :split-right-items="splitRightItems" :split-left-sel="splitLeftSel" :split-right-sel="splitRightSel" :split-left-total="splitLeftTotal" :split-right-total="splitRightTotal" @pad-input="onPadInput('table', $event)" @confirm="confirmTableOp" @toggle-left="toggleLeftSel" @toggle-right="toggleRightSel" @move-right="moveRight" @move-left="moveLeft" @move-all-right="moveAllRight" @dec-qty="decSplitQty" @inc-qty="incSplitQty"></table-dialog>

    <!-- 轉枱 -->
    <transfer-dialog :transfer-dialog="transferDialog" :table-hint="tables.map(t => tableLabel(t)).join('、')" @input="onPadInput('transfer', $event)" @confirm="confirmTransfer"></transfer-dialog>

    <!-- 加枱 -->
    <add-table-dialog :add-table-dialog="addTableDialog" @input="onAddNo" @confirm="confirmAddTable"></add-table-dialog>

    <!-- 掛單 / 叫回 -->
    <hold-dialog :hold-dialog="holdDialog" :hold-list="holdList" @recall="recallHold" @delete="delHold"></hold-dialog>

    <!-- 更改已結帳單 -->
    <refund-dialog :refund-dialog="refundDialog" :unfinished-orders="unfinishedOrders" @void-item="voidItem" @cancel-order="cancelOrder" @change-pay="openChangePay" @refund-order="refundOrder"></refund-dialog>

    <!-- 更改付款 -->
    <change-pay-dialog :change-pay-dialog="changePayDialog" :pay-methods="payMethods" @confirm="confirmChangePay"></change-pay-dialog>

    <!-- 大單分帳（部門分帳） -->
    <split-dept-dialog :dept-dialog="deptSplitDialog" :departments="departments" @confirm="confirmDeptSplit"></split-dept-dialog>

    <!-- 沽清設定（售罄清單） -->
    <sold-out-dialog :sold-out-dialog="soldOutDialog" :goods="goods"></sold-out-dialog>

    <!-- 批量列印 -->
    <batch-print-dialog :batch-print-dialog="batchPrintDialog" :batch-checked="batchChecked" :rows="batchPrintRows" @confirm="confirmBatchPrint"></batch-print-dialog>

    <!-- 報表選擇 -->
    <report-dialog :report-dialog="reportDialog" :report-types="reportTypes" :pos-slots="posSlots" :staff-info="staffInfo"></report-dialog>

    <!-- 無權限提示 -->
    <no-perm-dialog :no-perm-dialog="noPermDialog" :staff-permission-level="staffInfo.permissionLevel"></no-perm-dialog>

    <!-- 叫起（暫緩出單） -->
    <call-dish-dialog :call-dish-dialog="callDishDialog" @submit="submitCallDish"></call-dish-dialog>

    <!-- 起菜 -->
    <serve-dish-dialog :serve-dish-dialog="serveDishDialog" @submit="submitServeDish"></serve-dish-dialog>

    <!-- 追單 -->
    <chase-dialog :chase-dialog="chaseDialog" @confirm="confirmChase"></chase-dialog>

    <!-- 追單二次確認 -->
    <chase-confirm-dialog :chase-confirm-dialog="chaseConfirmDialog" @confirm="confirmChaseAgain"></chase-confirm-dialog>

    <!-- 搭枱選單 box -->
    <share-table-panel :share-table-panel="shareTablePanel" @enter="enterShareTable" @share="doShareTable" @close="shareTablePanel.show = false"></share-table-panel>

    <!-- 右鍵管理選單 -->
    <transition name="el-zoom-in-top">
      <div v-if="tableContextMenu.show" class="table-context-menu" :style="{ left: tableContextMenu.x + 'px', top: tableContextMenu.y + 'px' }" v-clickoutside="closeTableContextMenu">
        <div class="ctx-menu-item" @click="ctxEnterTable"><i class="el-icon-s-home"></i> 進入點餐</div>
        <div v-if="hasOrder(tableContextMenu.deskNo)" class="ctx-menu-item ctx-danger" @click="ctxForceUnlock"><i class="el-icon-unlock"></i> 強制解鎖（清除訂單）</div>
        <div v-if="boardStatus(tableContextMenu.deskNo) === '空枱'" class="ctx-menu-item ctx-disabled"><i class="el-icon-lock"></i> 已是空枱</div>
      </div>
    </transition>

    <!-- 長按貨品/改碼/套餐 沽清選單 -->
    <transition name="el-zoom-in-top">
      <div v-if="foodSoldOutMenu.show" class="table-context-menu food-soldout-menu" :style="{ left: foodSoldOutMenu.x + 'px', top: foodSoldOutMenu.y + 'px' }" v-clickoutside="closeFoodSoldOutMenu">
        <div v-if="foodSoldOutMenu.item && !foodSoldOutMenu.item.soldOut" class="ctx-menu-item ctx-danger" @click="doFoodSoldOut(foodSoldOutMenu.item, true)"><i class="el-icon-remove-outline"></i> 沽清</div>
        <div v-else-if="foodSoldOutMenu.item" class="ctx-menu-item" @click="doFoodSoldOut(foodSoldOutMenu.item, false)"><i class="el-icon-refresh-left"></i> 重售</div>
      </div>
    </transition>

    <!-- 更改密碼 -->
    <change-pwd-dialog :change-pwd-dialog="changePwdDialog" @submit="submitChangePwd"></change-pwd-dialog>

    <!-- 經理功能登入 -->
    <manager-dialog :manager-dialog="managerDialog" :is-manager="isManager" :resolved-manager-menu="resolvedManagerMenu" @login="managerLogin" @action="managerAction"></manager-dialog>

    <!-- 反結賬授權 -->
    <el-dialog title="反結賬授權" :visible.sync="unsettleAuth.show" width="360px" custom-class="pos-dialog" append-to-body>
      <p style="margin:0 0 12px; color:#606266;">反結賬將沖銷付款並把訂單退回未結，需經理（等級3）以上授權</p>
      <el-input v-model="unsettleAuth.orderNo" placeholder="單號" size="medium" style="margin-bottom: 12px;" :readonly="!!unsettleAuth.order"></el-input>
      <el-input v-model="unsettleAuth.no" placeholder="經理編號" size="medium" style="margin-bottom: 12px;"></el-input>
      <el-input v-model="unsettleAuth.password" type="password" placeholder="密碼" size="medium" show-password @keyup.enter.native="unsettleLogin"></el-input>
      <div slot="footer">
        <el-button @click="unsettleAuth.show = false">取 消</el-button>
        <el-button type="primary" :loading="unsettleAuth.loading" @click="unsettleLogin">確認反結賬</el-button>
      </div>
    </el-dialog>

    <!-- 連線設定（桌面版 Electron 經 preload 讀寫 app-config.json；瀏覽器存 localStorage 並重新導向） -->
    <el-dialog title="連線設定" :visible.sync="connDialog.show" width="420px" custom-class="pos-dialog" append-to-body>
      <el-form label-width="110px" size="small" style="margin-bottom:4px;">
        <el-form-item label="伺服器 IP">
          <el-input v-model="connDialog.host" placeholder="127.0.0.1"></el-input>
        </el-form-item>
        <el-form-item label="連接埠">
          <el-input v-model="connDialog.port" placeholder="3000"></el-input>
        </el-form-item>
        <el-form-item v-if="isElectron" label="PostgreSQL">
          <el-input v-model="connDialog.pgConn" placeholder="postgres://user:pass@127.0.0.1:5432/ordersys"></el-input>
        </el-form-item>
        <el-form-item label="分機編號">
          <el-select v-model="connDialog.stationId" filterable clearable placeholder="選擇分機" style="width:100%">
            <el-option v-for="t in terminals" :key="t.code" :label="t.name ? (t.code + ' - ' + t.name) : t.code" :value="t.code"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <p style="margin:0; color:#909399; font-size:12px; line-height:1.6;">儲存後會自動重新載入。<template v-if="isElectron">伺服器 IP 預設 127.0.0.1（本機後端）；PostgreSQL 留空則沿用程式預設連線；</template><template v-else>瀏覽器會連線到所填的伺服器 IP 與連接埠。</template>分機編號留空則沿用上次選擇。</p>
      <div slot="footer">
        <el-button @click="connDialog.show = false">取 消</el-button>
        <el-button type="primary" :loading="connDialog.saving" @click="saveConnSettings">儲 存</el-button>
      </div>
    </el-dialog>

    <!-- 上班/下班打卡 -->
    <clock-dialog :clock-dialog="clockDialog" :staff-info="staffInfo" :selected-terminal="selectedTerminal" :shift-info="shiftInfo" @shift-changed="shiftInfo = $event"></clock-dialog>

    <!-- 每日結算報表 -->
    <day-report-dialog :day-report-dialog="dayReportDialog" @cancel="dayReportDialog.show = false" @confirm="confirmDayClose"></day-report-dialog>

    <!-- 代支 / 代收 -->
    <cash-move-dialog :cash-move-dialog="cashMoveDialog" @confirm="confirmCashMove"></cash-move-dialog>

    <!-- 打柯單（班地厘訊息） -->
    <pantry-dialog :pantry-dialog="pantryDialog" @confirm="sendPantryMessage"></pantry-dialog>

    <!-- 浮動價格（手寫單） -->
    <open-price-dialog :visible.sync="openPriceDialog.show" :item="openPriceDialog.food" @confirm="confirmOpenPrice"></open-price-dialog>

    <!-- 更改價格 -->
    <keypad-dialog :visible.sync="priceDialog.show" title="更改價格" :value="priceDialog.value" @input="priceDialog.value = $event" @confirm="confirmPrice" decimal close-on-click-modal></keypad-dialog>

    <!-- 單項取消選擇 -->
    <cancel-item-dialog :cancel-item-dialog="cancelItemDialog" :cancel-reasons="cancelReasons" @confirm="confirmCancelItems"></cancel-item-dialog>

    <!-- 取消已落單品項 / 整單取消授權 -->
    <cancel-dialog :cancel-dialog="cancelDialog" :cancel-reasons="cancelReasons" @confirm="confirmCancel"></cancel-dialog>
    </div>
  </div>
</template>

<script>
import KeypadDialog from '../../components/pos/KeypadDialog'
import ReportDialog from '../../components/pos/ReportDialog'
import ClockDialog from '../../components/pos/ClockDialog'
import SoldOutDialog from '../../components/pos/SoldOutDialog'
import DayReportDialog from '../../components/pos/DayReportDialog'
import CashMoveDialog from '../../components/pos/CashMoveDialog'
import RefundDialog from '../../components/pos/RefundDialog'
import HoldDialog from '../../components/pos/HoldDialog'
import ChangePayDialog from '../../components/pos/ChangePayDialog'
import WholeDiscountDialog from '../../components/pos/WholeDiscountDialog'
import ItemDiscountDialog from '../../components/pos/ItemDiscountDialog'
import NoPermDialog from '../../components/pos/NoPermDialog'
import ServeDishDialog from '../../components/pos/ServeDishDialog'
import CallDishDialog from '../../components/pos/CallDishDialog'
import ChaseDialog from '../../components/pos/ChaseDialog'
import ChaseConfirmDialog from '../../components/pos/ChaseConfirmDialog'
import ChangePwdDialog from '../../components/pos/ChangePwdDialog'
import CancelItemDialog from '../../components/pos/CancelItemDialog'
import CancelDialog from '../../components/pos/CancelDialog'
import CancelEditPanel from '../../components/pos/CancelEditPanel'
import ShareTablePanel from '../../components/pos/ShareTablePanel'
import TransferDialog from '../../components/pos/TransferDialog'
import AddTableDialog from '../../components/pos/AddTableDialog'
import ManagerDialog from '../../components/pos/ManagerDialog'
import ComboDialog from '../../components/pos/ComboDialog'
import ItemDialog from '../../components/pos/ItemDialog'
import BatchPrintDialog from '../../components/pos/BatchPrintDialog'
import TableDialog from '../../components/pos/TableDialog'
import PayDialog from '../../components/pos/PayDialog'
import NumberPad from '../../components/pos/NumberPad'
import PantryDialog from '../../components/pos/PantryDialog'
import OpenPriceDialog from '../../components/pos/OpenPriceDialog'
import SplitDeptDialog from '../../components/pos/SplitDeptDialog'
import { computeBundles, isEffectiveNow } from '../../utils/bundle'

const DEFAULT_BUTTON_ORDER = [
  'merge', 'split', 'transfer', 'hold', 'recall', 'print', 'chase', 'serving',
  'qrcode', 'printTableQr', 'wholeDiscount', 'itemDiscount', 'bundle', 'clear', 'submit', 'send', 'checkout', 'cashCheckout', 'changePay', 'soldout',
  'refund', 'report', 'manager', 'addTable', 'cancelAll', 'cancelItem', 'releaseTable',
  'paidOut', 'received', 'changePrice', 'showDetail', 'pantry', 'deptSplit', 'centralCheckout'
]

const BUTTON_META = {
  merge: { label: '合拼枱', funcCode: '1', dineIn: true, type: '' },
  split: { label: '分單', funcCode: '2', dineIn: true, type: '' },
  transfer: { label: '轉枱', funcCode: '3', dineIn: true, type: '' },
  copyOrder: { label: '複印單據', funcCode: '44', dineIn: true, type: '' },
  hold: { label: '掛單', funcCode: '4', dineIn: false, type: '' },
  recall: { label: '叫回', funcCode: '5', dineIn: false, type: '' },
  print: { label: '印單', funcCode: '6', dineIn: false, type: 'warning' },
  chase: { label: '追單', funcCode: '7', dineIn: false, type: 'danger' },
  serving: { label: '上菜紙', funcCode: '8', dineIn: false, type: '' },
  qrcode: { label: '二維碼', funcCode: '9', dineIn: false, type: '' },
  printTableQr: { label: '印點餐碼', funcCode: '54', dineIn: true, type: '' },
  wholeDiscount: { label: '整單折扣', funcCode: '10', dineIn: false, type: '' },
  itemDiscount: { label: '項目折扣', funcCode: '11', dineIn: false, type: '' },
  clear: { label: '清空', funcCode: '12', dineIn: false, type: 'danger' },
  submit: { label: '確認下單', funcCode: '13', dineIn: false, type: '' },
  send: { label: '送單', funcCode: '14', dineIn: false, type: 'success' },
  checkout: { label: '結帳', funcCode: '15', dineIn: false, type: 'warning' },
  soldout: { label: '沽清設定', funcCode: '16', dineIn: false, type: '' },
  refund: { label: '反結帳', funcCode: '17', dineIn: false, type: 'danger' },
  report: { label: '報表', funcCode: '18', dineIn: false, type: '' },
  dayReport: { label: '每日結算', funcCode: '56', dineIn: false, type: '' },
  manager: { label: '經理功能', funcCode: '19', dineIn: false, type: '' },
  openDrawer: { label: '開銀櫃', funcCode: '53', dineIn: false, type: '' },
  addTable: { label: '加枱', funcCode: '20', dineIn: false, type: '' },
  cancelAll: { label: '整單取消', funcCode: '21', dineIn: false, type: 'danger' },
  cancelItem: { label: '單項取消', funcCode: '22', dineIn: false, type: 'danger' },
  cashCheckout: { label: '現金結帳', funcCode: '37', dineIn: false, type: 'success' },
  callDish: { label: '叫起', funcCode: '38', dineIn: true, type: 'warning' },
  serveDish: { label: '起菜', funcCode: '39', dineIn: true, type: 'success' },
  reprint: { label: '重印單據', funcCode: '40', dineIn: false, type: 'warning' },
  login: { label: '登入', funcCode: '34', dineIn: false, type: '' },
  logoutBtn: { label: '登出', funcCode: '35', dineIn: false, type: '' },
  changePay: { label: '更改付款', funcCode: '42', dineIn: false, type: '' },
  changePwd: { label: '更改用戶密碼', funcCode: '36', dineIn: false, type: '' },
  releaseTable: { label: '解除枱號狀態', funcCode: '41', dineIn: true, type: '' },
  leaveApp: { label: '離開', funcCode: '43', dineIn: false, type: '' },
  paidOut: { label: '代支', funcCode: '45', dineIn: false, type: 'warning' },
  received: { label: '代收', funcCode: '46', dineIn: false, type: 'success' },
  changePrice: { label: '更改價格', funcCode: '47', dineIn: false, type: '' },
  showDetail: { label: '顯示明細', funcCode: '48', dineIn: false, type: '' },
  refreshPos: { label: '重新整理', funcCode: '49', dineIn: false, type: '' },
  pantry: { label: '打柯單', funcCode: '50', dineIn: false, type: '' },
  deptSplit: { label: '大單分帳', funcCode: '51', dineIn: false, type: '' },
  centralCheckout: { label: '中央埋單', funcCode: '52', dineIn: false, type: 'warning' },
  bundle: { label: '撞餐', funcCode: '55', dineIn: false, type: '' }
}
const SIDEBAR_META = {
  grid: { label: '枱號圖', funcCode: '23' },
  takeaway: { label: '外賣枱', funcCode: '24' },
  dineIn: { label: '堂食', funcCode: '25' },
  delivery: { label: '外賣', funcCode: '57' },
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

// 只放進「經理功能」選單、不放進底部功能 dock 的功能鍵
const MANAGER_FUNC_IDS = ['copyOrder', 'refreshPos']

export default {
  name: 'posIndex',
  components: { KeypadDialog, ReportDialog, ClockDialog, SoldOutDialog, DayReportDialog, CashMoveDialog, RefundDialog, HoldDialog, ChangePayDialog, WholeDiscountDialog, ItemDiscountDialog, NoPermDialog, ServeDishDialog, CallDishDialog, ChaseDialog, ChaseConfirmDialog, ChangePwdDialog, CancelItemDialog, CancelDialog, CancelEditPanel, ShareTablePanel, TransferDialog, AddTableDialog, ManagerDialog, ComboDialog, ItemDialog, BatchPrintDialog, TableDialog, PayDialog, NumberPad, PantryDialog, OpenPriceDialog, SplitDeptDialog },
  data () {
    return {
      loggedIn: false,
      isElectron: typeof window !== 'undefined' && !!window.appConfig,
      connDialog: { show: false, host: '127.0.0.1', port: 3000, pgConn: '', stationId: '', saving: false },
      currentTime: '',
      timeTimer: null,
      loginNo: '',
      loginPassword: '',
      loginActive: 'no', // 目前鍵盤輸入的欄位：'no' 員工編號 / 'password' 密碼
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
      matchingRules: [],
      bundleGroups: [],
      activeCategory: '',
      showFoodImages: true,
      gestureEnabled: true,
      showDetail: false,
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
      selectedCartIndex: -1,
      selectedContentKey: '',
      discountSelectedIndexes: [],
      batchChecked: {},
      comboDialog: { show: false, combo: null, selections: {}, editIndex: -1, mainDish: null, mainDishAddon: false },
      carts: {},
      orderRemark: '',
      serviceChargeEnabled: false,
      serviceChargeRate: 10,
      serviceChargePreDiscount: true,
      roundingMode: 'none',
      reprintMinLevel: 3,
      modCodeUIMode: 'A',
      teaChargesRequired: false,
      requiredCategoryId: '',
      teaSeatSyncPax: false,
      servingNewItemsOnly: false,
      buttonOrder: [],
      btnPerms: {},
      funcCodeToBtnId: FUNC_CODE_TO_BTN_ID,
      posBtnFontSize: 18,
      posBtnWidth: 100,
      posBtnHeight: 40,
      posDockRowsPerPage: 2,
      posDockPerRow: 8,
      dockPage: 0,
      dockNav: { fontSize: 18, width: 100, height: 40, bgColor: '#409eff', textColor: '#ffffff', pageNumFontSize: 12, gap: 6 },
      catBtnSettings: { fontSize: 13, width: 0, height: 40, padding: 20, paddingY: 0, gapX: 10, gapY: 10, cols: 4, rows: 6, shape: 'pill' },
      catPage: 0,
      foodPage: 0,
      categoryOrder: [],
      foodBtnSettings: { cols: 0, rows: 0, fontSize: 25, width: 0, height: 0, minHeight: 88, imageSize: 40, paddingX: 3, paddingY: 6, gapX: 6, gapY: 6, showPlu: true, showPrice: true, showStock: true },
      foodZoneW: 0,
      foodZoneH: 0,
      foodBtnHReal: 0,
      calledTagStyle: { color: '#ea580c', background: '#ffedd5', border: '#fed7aa' },
      badgeStyle: {
        transfer: { fontSize: 13, color: '#ffffff', background: '#e6a23c', visible: true },
        merge: { fontSize: 13, color: '#ffffff', background: '#67c23a', visible: true },
        split: { fontSize: 13, color: '#ffffff', background: '#409eff', visible: true },
        chase: { fontSize: 13, color: '#ffffff', background: '#f56c6c', visible: true }
      },
      boardCardHeight: 110,
      boardCardWidth: 0,
      boardGridCols: 0,
      boardGridRows: 0,
      boardGap: 10,
      cardDisplay: { seats: { show: true, fontSize: 12, position: 'top-left' }, dot: { show: true, fontSize: 9, position: 'top-right' }, tableNo: { show: true, fontSize: 42, position: 'center' }, amount: { show: true, fontSize: 17, position: 'below-no' }, status: { show: true, fontSize: 12, position: 'below-amount' }, duration: { show: true, fontSize: 11, position: 'bottom' } },
      modCodeList: [],
      modCodeListAll: [],
      modCodeCategories: [],
      unfinishedOrders: [],
      settledTodayOrders: [],
      viewingSettledOrder: null,
      viewingFloatingOrder: null,
      pendingOrderNo: null,
      unsettleAuth: { show: false, no: '', password: '', orderNo: '', loading: false, order: null },
      itemDialog: { show: false, index: null, contentIndex: null, mods: [], customMod: '' },
      modCatFoodDialog: { show: false, name: '', items: [], selected: [] },
      wholeDiscountDialog: { show: false, pct: 0, amount: 0 },
      itemDiscountDialog: { show: false, pct: 0, amount: 0, free: false },
      discountOptions: [],
      pendingItemDiscount: null,
      payDialog: { show: false, method: '現金', cashStr: '', change: 0, invoiceNo: '', tip: 0 },
      tableDialog: { show: false, mode: 'merge', title: '', fromTable: null, toTable: null, padValue: '' },
      splitMoves: {},
      splitLeftSel: [],
      splitRightSel: [],
      addTableDialog: { show: false, padValue: '', no: null, seats: 4, zone: '堂食' },
      transferDialog: { show: false, from: null, toTable: null, padValue: '' },
      qtyDialog: { show: false, index: null, value: '' },
      qtyPanel: { show: false, index: null, value: '' },
      tableKeypad: { show: false, value: '' },
      paxKeypad: { show: false, value: '' },
      pluDialog: { show: false, value: '' },
      cashMoveDialog: { show: false, type: 'paidOut', amount: '', reason: '', loading: false },
      pantryDialog: { show: false, message: '', loading: false },
      openPriceDialog: { show: false, food: null },
      priceDialog: { show: false, index: null, value: '' },
      holdDialog: { show: false },
      holdList: [],
      refundDialog: { show: false, activeTab: 'void', finished: [] },
      noPermDialog: { show: false, name: '', requiredLevel: 1 },
      reportDialog: { show: false, type: 'cashier', scope: 'all', dateRange: [], slot: 'all', result: null, selecting: null, dateMode: 'today', mode: 'entry', printing: false, department: 'all', category: 'all', pluFrom: '', pluTo: '', detail: 'detail' },
      posSlots: [],
      posFontFamily: '',
      posFontUrl: '',
      posFontStack: '',
      shopName: '',
      shopIntro: '',
      batchPrintDialog: { show: false },
      reportTypes: [
        { id: 'dailyClose', label: '日結清機報表', icon: '🧾', scope: false },
        { id: 'monthly', label: '每月營業報表', icon: '📅', scope: false },
        { id: 'sales', label: '銷貨報表', icon: '📦', scope: false },
        { id: 'discount', label: '全日折扣報表', icon: '🏷️', scope: false },
        { id: 'slotReport', label: '分市報表', icon: '🕒', scope: false },
        { id: 'business', label: '營業報表', icon: '📊', scope: false, hidden: true },
        { id: 'department', label: '分區營業報表', icon: '🏬', scope: false, hidden: true },
        { id: 'departmentRevenue', label: '部門收入報表', icon: '🍽️', scope: false },
        { id: 'cashier', label: '收銀員報表', icon: '💰', personal: true },
        { id: 'payment', label: '付款報表', icon: '💳', personal: true },
        { id: 'cancel', label: '取消報表', icon: '❌', personal: true },
        { id: 'printRecord', label: '印單紀錄報表', icon: '🖨️', personal: true },
        { id: 'mergeTable', label: '合併枱報表', icon: '🔗', personal: false },
        { id: 'itemTransfer', label: '項目轉移報表', icon: '🔄', personal: false },
        { id: 'orderDetail', label: '單據明細詳列', icon: '📋', personal: true },
        { id: 'staffHours', label: '員工工時報表', icon: '🕐', personal: true },
        { id: 'staffLog', label: '員工操作日誌', icon: '📝', personal: true }
      ],
      shareTableEnabled: false,
      shareTablePanel: { show: false, deskNo: 0, subTables: [] },
      tableContextMenu: { show: false, x: 0, y: 0, deskNo: '' },
      foodSoldOutMenu: { show: false, x: 0, y: 0, item: null },
      foodPressTimer: null,
      foodPressed: false,
      releaseTableMode: false,
      copyOrderMode: false,
      copyOrderSource: null,
      tablePressTimer: null,
      serveDishDialog: { show: false, deskNo: 0, items: [], checked: [], loading: false },
      callDishDialog: { show: false, items: [], checked: [], loading: false },
      chaseDialog: { show: false, deskNo: 0, items: [], checked: [], loading: false },
      chaseConfirmDialog: { show: false, deskNo: 0, indexes: [], lastChaseTime: '', loading: false },
      managerMenu: [],
      changePwdDialog: { show: false, oldPwd: '', newPwd: '', newPwd2: '', loading: false },
      managerDialog: { show: false, no: '', password: '' },
      failoverNotice: { show: false, from: '', to: '', deskNo: '', orderNo: '' },
      failoverTimer: null,
      blockedNotice: { show: false, station: '', reason: '', deskNo: '', orderNo: '' },
      blockedTimer: null,
      isManager: false,
      managerName: '',
      pluInput: '',
      scanBuffer: '',
      scanLastTs: 0,
      changePayDialog: { show: false, orderId: '', orderNo: '', totalPrice: 0, payMethod: '現金' },
      deptSplitDialog: { show: false, title: '', source: '', orderNo: '', combos: [] },
      departments: [],
      soldOutDialog: { show: false, list: [], keyword: '', showItemPicker: false, pickerKeyword: '' },
      bizDayStatus: { date: '', isOpen: false, businessDay: null, cutoff: '03:00' },
      dayReportDialog: { show: false, result: null, loading: false, startingCash: '', countedCash: '', remark: '' },
      cancelDialog: { show: false, index: null, isSent: false, managerNo: '', managerPwd: '', reason: '', reasons: [], qty: 0, loading: false },
      cancelItemDialog: { show: false, list: [], reasons: [], managerNo: '', managerPwd: '', needsManager: false, loading: false },
      cancelEditMode: { active: false, selected: {}, reasons: [], managerNo: '', managerPwd: '', needsManager: false, loading: false },
      cancelReasons: ['顧客取消', '售罄', '品質問題', '落單錯誤', '測試單', '漏單', '試機', '重單', '過遲出菜'],
      swipeIndex: -1,
      swipeStartX: 0,
      swipeStartY: 0,
      swipeDelta: 0,
      swipeLocked: false,
      swipeTimer: null,
      rowClickCount: 0,
      rowClickIndex: -1,
      rowClickTimer: null,
      activeBoardZone: '',
      layoutMode: false,
      orderDiscount: 0,
      bundleEnabled: false,
      bundleMode: 'auto',
      bundleRule: 'bestPrice',
      directPayMode: false,
      bundleApplied: true,
      drag: null,
      boardMode: 'grid',
      boardZoneFilter: 'all',
      sidebarBtnConfig: [],
      sidebarFontSize: 12,
      sidebarWidth: 130,
      windowW: 0,
      windowH: 0,
      screenW: 0,
      screenH: 0,
      minPosScale: 0.85,
      floorW: 0,
      floorH: 0,
      tableListStatus: 'all',
      tableListZone: '堂食',
      tableListSort: 'table',
      tableListKeyword: '',
      tableListOrderNo: '',
      tableListPluNo: '',
      listKeypad: { show: false, field: '', value: '', title: '輸入', letters: false },
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
    // 搭枱子枱對照表（主枱 physicalNo → 子枱 no 陣列），供 physicalNos() O(1) 查表
    physicalNoMap () {
      const map = {}
      if (!this.shareTableEnabled) return map
      for (const t of this.tables) {
        if (!t.shareSuffix) continue
        const key = String(t.physicalNo)
        if (!map[key]) map[key] = []
        map[key].push(String(t.no))
      }
      return map
    },
    // 未結訂單對照表（deskNo → 訂單陣列，保持 unfinishedOrders 順序）
    orderMap () {
      const map = {}
      for (const o of this.unfinishedOrders) {
        const k = String(o.deskNo)
        if (!map[k]) map[k] = []
        map[k].push(o)
      }
      return map
    },
    loginActiveValue () {
      return this.loginActive === 'no' ? this.loginNo : this.loginPassword
    },
    loginPasswordMask () {
      return this.loginPassword ? new Array(this.loginPassword.length + 1).join('•') : ''
    },
    loginConfirmLabel () {
      return this.loginActive === 'no' ? '下一欄（密碼）' : '登 入'
    },
    posScale () {
      const sh = this.screenH || window.innerHeight || 1080
      return Math.max(sh / 1080, this.minPosScale)
    },
    posCanvasWidth () {
      const sw = this.screenW || window.innerWidth || 1920
      const s = this.posScale || 1
      return Math.round(sw / s)
    },
    posCanvasHeight () {
      const sh = this.screenH || window.innerHeight || 1080
      return Math.round(sh / this.posScale)
    },
    posScaleStyle () {
      const style = {
        width: this.posCanvasWidth + 'px',
        height: this.posCanvasHeight + 'px',
        transform: 'scale(' + this.posScale + ')',
        transformOrigin: '0 0'
      }
      if (this.posFontStack) {
        style.fontFamily = this.posFontStack
      }
      return style
    },
    resolvedManagerMenu () {
      return this.managerMenu.filter(m => m.visible !== false).map(m => {
        const id = FUNC_CODE_TO_BTN_ID[m.funcCode] || ''
        if (id && BUTTON_META[id]) {
          return { id, label: BUTTON_META[id].label, funcCode: m.funcCode, type: BUTTON_META[id].type || '' }
        }
        return { id: m.funcCode, label: '[' + m.funcCode + ']', funcCode: m.funcCode, type: '' }
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
        const icon = { grid: 'el-icon-menu', takeaway: 'el-icon-shopping-bag-2', dineIn: 'el-icon-office-building', delivery: 'el-icon-truck', list: 'el-icon-tickets', search: 'el-icon-search', history: 'el-icon-time', refresh: 'el-icon-refresh', addTable: 'el-icon-plus', batchPrint: 'el-icon-printer', report: 'el-icon-data-analysis', settings: 'el-icon-setting' }
        return { slotId: c.id, actionId, funcCode: fc, label, icon: icon[actionId] || 'el-icon-more', visible: c.visible !== false, bgColor: c.bgColor || '', textColor: c.textColor || '' }
      })
    },
    isDineIn () { return this.selectedZone === '堂食' },
    isTakeaway () { return !this.isDineIn },
    isDelivery () { return this.selectedZone === '外賣' },
    directPayActive () { return this.directPayMode && this.isDelivery },
    modeLabel () { return this.isDineIn ? '堂食' : (this.isDelivery ? '外賣' : '外賣枱') },
    // 外賣叫號：區域 + 號碼同一行（如「外賣 001」），否則退回模式標籤
    takeawayNoDisplay () {
      if (this.isDineIn) return this.selectedTableLabel
      const no = (this.currentOrder && this.currentOrder.takeawayNo) || ''
      return no ? `${this.modeLabel} ${no}` : this.modeLabel
    },
    categoryById () {
      const m = {}
      this.goods.forEach(g => { m[String(g._id)] = g })
      return m
    },
    parentOf () {
      const m = {}
      this.goods.forEach(g => {
        ;(g.children || []).forEach(cid => { m[String(cid)] = String(g._id) })
      })
      return m
    },
    rootCategories () {
      return this.goods.filter(g => g.isRoot)
    },
    breadcrumb () {
      const cur = this.categoryById[this.activeCategory]
      if (!cur) return []
      const path = []
      const seen = {}
      let node = cur
      while (node && !seen[String(node._id)]) {
        seen[String(node._id)] = true
        path.unshift(node)
        const pid = this.parentOf[String(node._id)]
        node = pid ? this.categoryById[pid] : null
      }
      return path
    },
    categoryPills () {
      return this.rootCategories
    },
    activeTopCategoryId () {
      const cur = this.categoryById[this.activeCategory]
      if (!cur) return ''
      if (cur.isRoot) return String(cur._id)
      const pid = this.parentOf[String(cur._id)]
      return pid ? String(pid) : String(cur._id)
    },
    subCategoryPills () {
      const cur = this.categoryById[this.activeCategory]
      if (!cur) return []
      const raw = (cur.children || []).map(id => this.categoryById[id]).filter(Boolean)
      return this.applyCategoryOrder(raw)
    },
    categoryOrdered () {
      return this.applyCategoryOrder(this.categoryPills)
    },
    catCols () {
      const c = this.catBtnSettings || {}
      const cols = c.cols > 0 ? c.cols : 4
      return Math.max(1, Math.min(12, cols))
    },
    catRows () {
      const c = this.catBtnSettings || {}
      return c.rows > 0 ? c.rows : 0
    },
    catPageSize () {
      return this.catCols * (this.catRows > 0 ? this.catRows : 1)
    },
    catPageGroups () {
      const list = this.categoryOrdered
      if (this.catRows <= 0) return [list]
      const pageSize = Math.max(1, this.catPageSize - 2)
      const pages = []
      const auto = []
      list.forEach(item => {
        const p = item._page || 0
        if (p > 0) {
          while (pages.length < p) pages.push([])
          pages[p - 1].push(item)
        } else {
          auto.push(item)
        }
      })
      auto.forEach(item => {
        let placed = false
        for (let i = 0; i < pages.length; i++) {
          if (pages[i].length < pageSize) { pages[i].push(item); placed = true; break }
        }
        if (!placed) pages.push([item])
      })
      return pages.filter(p => p.length)
    },
    catTotalPages () {
      return Math.max(1, this.catPageGroups.length)
    },
    catPageItems () {
      return this.catPageGroups[this.catPage] || []
    },
    catGridCells () {
      const pills = this.catPageItems
      if (this.catRows <= 0 || this.catTotalPages <= 1) return pills.map((p, i) => ({ type: 'pill', pill: p, k: i }))
      const size = this.catPageSize
      const cells = new Array(size).fill(null)
      cells[size - 2] = { type: 'prev' }
      cells[size - 1] = { type: 'next' }
      let pi = 0
      for (let i = 0; i < size; i++) {
        if (cells[i] === null && pi < pills.length) cells[i] = { type: 'pill', pill: pills[pi++] }
      }
      return cells.map((c, i) => Object.assign({ k: i }, c || { type: 'empty' }))
    },
    hotFoods () {
      const all = []
      this.goods.forEach(g => (g.foods || []).forEach(f => { if (f.onSale > 0 && !f.soldOut) all.push(f) }))
      return all.sort((a, b) => b.onSale - a.onSale).slice(0, 12)
    },
    activeFoods () {
      if (this.activeCategory === '__hot__') return this.hotFoods
      if (this.activeCategory === '__combo__') return []
      const g = this.categoryById[this.activeCategory]
      return g ? (g.foods || []) : []
    },
    activeItems () {
      if (this.activeCategory === '__hot__') {
        return (this.hotFoods || []).map(f => Object.assign({}, f, { _itemType: 'commodity' }))
      }
      if (this.activeCategory === '__combo__') return []
      const g = this.categoryById[this.activeCategory]
      if (!g) return []
      let list
      const items = g.items || []
      if (items.length) {
        list = items.map(it => {
          if (it._itemType === 'category') {
            const full = this.categoryById[String(it._id)]
            return full ? Object.assign({}, full, { _itemType: 'category' }) : it
          }
          return it
        })
      } else {
        list = []
        ;(this.subCategoryPills || []).forEach(c => list.push(Object.assign({}, c, { _itemType: 'category' })))
        ;(g.foods || []).forEach(f => list.push(f))
      }
      if (this.breadcrumb.length > 1) {
        list.unshift({ _id: '__back__', _itemType: 'back', name: '返回' })
      }
      return list
    },
    cart () { return this.carts[this.cartKey] || [] },
    cancelEditSentItems () {
      return this.cart
        .map((item, index) => ({ ...item, index }))
        .filter(item => item.sent)
        .map(item => {
          const unit = item.unitPrice != null ? item.unitPrice : this.calcUnit(item)
          return {
            ...item,
            _modsText: this.modNames(item.mods).join('、'),
            _unitPrice: unit,
            _subtotal: Math.round(unit * (item.count || 1) * 100) / 100
          }
        })
    },
    selectedTableLabel () {
      if (!this.selectedTable) return '—'
      const t = this.tables.find(x => String(x.no) === String(this.selectedTable))
      return t ? this.tableLabel(t) : this.selectedTable
    },
    cartKey () { return this.isDineIn ? this.selectedTable : (this.isDelivery ? 'delivery' : 'takeaway') },
    matchingRuleCombos () {
      const rules = (this.matchingRules || []).filter(r => r.enabled !== false)
      if (!rules.length) return []
      const flat = []
      ;(this.goods || []).forEach(cat => {
        ;(cat.foods || []).forEach(f => {
          if (f._isModCode || f._isModCategory) return
          if ((f._isCombo || f.isCombo) && !f.mainGroupId) return
          flat.push(f)
        })
      })
      if (!flat.length) return []
      const groupPriceMap = {}
      ;(this.bundleGroups || []).forEach(g => { groupPriceMap[String(g._id)] = Number(g.price) || 0 })
      const out = []
      rules.forEach(r => {
        const groupIds = (r.bundleGroupIds || []).map(String)
        const addonPrice = Number(r.addonPrice) || 0
        // 跟餐價模型：主食保留原價，跟餐改收特別跟餐價。
        // bundle 數學上 combo.price=0，主食 upgradePrice=原價、跟餐 upgradePrice=跟餐價，
        // 所以撞餐後總價 = 主食原價 + 跟餐價。
        const triggerItems = flat
          .filter(f => this.matchingRuleTriggerMatches(f, r))
          .map(f => ({ commodityId: f._id, name: f.name, price: f.price, upgradePrice: Number(f.price) || 0 }))
        let addonItems
        if (groupIds.length) {
          // 撞跟餐組別，跟餐價取自組別
          addonItems = flat
            .filter(f => f.bundleGroupId && groupIds.includes(String(f.bundleGroupId)))
            .map(f => ({ commodityId: f._id, name: f.name, price: f.price, upgradePrice: groupPriceMap[String(f.bundleGroupId)] || 0 }))
        } else {
          // 未選跟餐組別：任意跟餐，跟餐價用 addonPrice（套餐/改碼不參與跟餐側）
          addonItems = flat
            .filter(f => !f._isCombo && !f.isCombo)
            .map(f => ({ commodityId: f._id, name: f.name, price: f.price, upgradePrice: addonPrice }))
        }
        if (!triggerItems.length || !addonItems.length) return
        out.push({
          _id: 'mrule_' + r._id,
          name: r.name,
          price: 0,
          type: 'select',
          autoBundle: true,
          bundlePriority: r.priority || 0,
          effectiveTime: r.effectiveTime,
          departmentSplit: [],
          showItems: true,
          _matchingRule: true,
          groups: [
            { name: '主食', min: 1, max: 1, groupPrice: 0, items: triggerItems },
            { name: '跟餐', min: 1, max: 1, groupPrice: 0, items: addonItems }
          ]
        })
      })
      return out
    },
    bundleCombos () {
      return (this.combos || []).concat(this.matchingRuleCombos)
    },
    bundlePlan () {
      if (!this.bundleEnabled) return { bundles: [], bundledIndexes: [], totalSavings: 0 }
      const unsent = this.cart.filter(i => !i.sent)
      const base = computeBundles(unsent, this.bundleCombos, { bundleEnabled: true, bundleRule: this.bundleRule })
      const sentAddons = this.computeSentAddonBundles(unsent, base.bundledIndexes)
      const sentMains = this.computeSentMainBundles(unsent, base.bundledIndexes)
      const bundles = base.bundles.concat(sentAddons.bundles, sentMains.bundles)
      if (!bundles.length) return base
      return {
        bundles,
        bundledIndexes: [...new Set(base.bundledIndexes.concat(sentAddons.bundledIndexes, sentMains.bundledIndexes))],
        totalSavings: Math.round((base.totalSavings + sentAddons.totalSavings + sentMains.totalSavings) * 100) / 100
      }
    },
    bundleOn () {
      return this.bundleEnabled && this.bundleApplied && this.bundlePlan.bundles.length > 0
    },
    bundleSavings () {
      return this.bundleOn ? this.bundlePlan.totalSavings : 0
    },
    // 跟餐價規則：記錄「跟餐品項」在購物車中的 index → { qty: 已捆綁數量, price: 跟餐價 }
    // 用於未送單前讓飲品在購物車直接顯示跟餐價（例如 $0），而非原價。
    bundlePriceOverride () {
      const map = {}
      if (!this.bundleOn) return map
      const cartIndexOf = {}
      let ui = 0
      this.cart.forEach((item, ci) => { if (!item.sent) { cartIndexOf[ui] = ci; ui++ } })
      ;(this.bundlePlan.bundles || []).forEach(b => {
        const combo = (this.bundleCombos || []).find(c => String(c._id) === String(b.comboId))
        if (!combo || !combo._matchingRule) return
        if (b._sentAddon) {
          // 已送單跟餐（方案B）：主食保留原價，跟餐（已送飲品）顯示跟餐價
          const addon = b.addon
          if (!addon || addon.cartIndex === undefined) return
          const entry = map[addon.cartIndex] || (map[addon.cartIndex] = { qty: 0, price: addon.price })
          entry.qty += 1
          return
        }
        ;(b.items || []).forEach(x => {
          if (x.gi === 0) return
          const ci = cartIndexOf[x.index]
          if (ci === undefined) return
          const group = (combo.groups || [])[x.gi]
          const comboItem = (group && group.items) ? group.items[x.ii] : null
          const upgrade = (x.upgradePrice !== undefined && x.upgradePrice !== null)
            ? Number(x.upgradePrice) || 0
            : Number(comboItem && comboItem.upgradePrice) || 0
          const entry = map[ci] || (map[ci] = { qty: 0, price: upgrade })
          entry.qty += (x.qty || 1)
        })
      })
      return map
    },
    totalPrice () { return Math.max(0, Math.round((this.cart.reduce((sum, i) => sum + i.subtotal, 0) - this.bundleSavings) * 100) / 100) },
    serviceChargeAmount () {
      if (!this.serviceChargeEnabled) return 0
      const base = this.serviceChargePreDiscount
        ? this.totalPrice
        : Math.max(0, this.totalPrice - (this.orderDiscount || 0))
      return Math.round(base * (this.serviceChargeRate || 0) / 100 * 100) / 100
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
    discountedPreview () {
      return Math.max(0, Math.round((this.totalPrice - (this.wholeDiscountDialog.amount || 0)) * 100) / 100)
    },
    boardCardWidthEff () {
      return this.boardCardWidth || 200
    },
    boardGridColsEff () {
      if (this.boardGridCols > 0) return this.boardGridCols
      const cw = this.boardCardWidthEff
      const gap = this.boardGap || 0
      const avail = (this.windowW || window.innerWidth || 1024) - (this.sidebarWidth || 130) - 32
      if (avail <= 0) return 4
      return Math.max(1, Math.floor((avail + gap) / (cw + gap)))
    },
    boardZones () {
      const set = []
      this.tables.forEach(t => {
        const z = t.zone || '未分區'
        if (set.indexOf(z) < 0) set.push(z)
      })
      return set
    },
    boardContentSize () {
      const cw = this.boardCardWidthEff
      const ch = this.boardCardHeight || 110
      let maxX = 0
      let maxY = 0
      this.boardTables.forEach((t, i) => {
        const p = this.tablePos(t, i)
        if (p.x + cw > maxX) maxX = p.x + cw
        if (p.y + ch > maxY) maxY = p.y + ch
      })
      return { w: maxX, h: maxY }
    },
    boardScale () {
      if (this.layoutMode) return 1
      const { w, h } = this.boardContentSize
      if (!w || !h) return 1
      const availW = this.floorW || ((this.windowW || window.innerWidth || 1024) - (this.sidebarWidth || 130) - 48)
      const availH = this.floorH || ((this.windowH || window.innerHeight || 768) - 72 - 48)
      if (availW <= 0 || availH <= 0) return 1
      const scale = Math.min(availW / w, availH / h)
      if (scale >= 1) return 1
      return Math.max(0.15, scale)
    },
    boardBoxStyle () {
      const { w, h } = this.boardContentSize
      const scale = this.boardScale
      return {
        position: 'relative',
        width: Math.max(w * scale, 1) + 'px',
        height: Math.max(h * scale, 1) + 'px'
      }
    },
    boardScaleStyle () {
      const { w, h } = this.boardContentSize
      const scale = this.boardScale
      return {
        width: w + 'px',
        height: h + 'px',
        transform: 'scale(' + scale + ')',
        transformOrigin: '0 0'
      }
    },
    boardTables () {
      const z = this.activeBoardZone || this.boardZones[0]
      let filtered = this.tables.filter(t => (this.boardZoneFilter === 'all' || (t.zone || '未分區') === this.boardZoneFilter) && (!z || this.boardZoneFilter !== 'all' || (t.zone || '未分區') === z))
      if (this.shareTableEnabled) {
        filtered = filtered.filter(t => !t.shareSuffix && !this.isZTable(t))
      } else {
        const main = filtered.filter(t => !t.shareSuffix)
        const subs = filtered.filter(t => t.shareSuffix)
        const grouped = []
        main.forEach(m => {
          grouped.push(m)
          const linkSubs = subs.filter(s => String(s.physicalNo) === String(m.no))
          linkSubs.forEach(s => grouped.push(s))
        })
        const unlinked = subs.filter(s => !main.some(m => String(m.no) === String(s.physicalNo)))
        unlinked.forEach(s => grouped.push(s))
        filtered = grouped
      }
      return filtered
    },
    batchPrintRows () {
      return this.boardTables
        .filter(t => this.boardStatus(t.no) !== '空枱')
        .map(t => ({
          no: t.no,
          label: this.tableLabel(t),
          status: this.boardStatus(t.no),
          amount: this.tableAmount(t.no),
          disabled: this.bpDisabled(t)
        }))
    },
    tableRows () {
      return this.tables.filter(t => !t.shareSuffix).map(t => {
        const orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(t.no))
        const hasItems = orders.some(o => o.order && o.order.length)
        let order = orders[0]
        let amount = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0)
        let status = orders.some(o => o.source === 'extension') ? '使用中' : ((order && hasItems) ? (order.relisted ? '退單' : (orders.some(o => o.printed) ? '已印單' : '用餐中')) : '空枱')
        // 已付款：無未結訂單，但今日已有結帳單，改取今日結帳單的編號/人數/開台時間/消費
        if (status === '空枱') {
          const settled = this.settledTodayOrders.filter(o => String(o.deskNo) === String(t.no))
          if (settled.length) {
            status = '已付款'
            order = settled[0]
            amount = settled.reduce((sum, o) => sum + (o.totalPrice || 0), 0)
          }
        }
        return this.buildTableRow(t, order, status, amount)
      })
    },
    tableListRows () {
      // 每枱未結狀態列 + 今日每筆已付款訂單各一列（已付款不因枱上有未結單而被蓋住）
      let rows = []
      this.tableRows.forEach(r => {
        const no = r.table ? r.table.no : r.no
        const settled = this.settledTodayOrders.filter(o => String(o.deskNo) === String(no))
        if (r.status !== '已付款') rows.push(r)
        settled.forEach(o => rows.push(this.buildTableRow(r.table, o, '已付款', o.totalPrice || 0)))
      })
      // 外賣枱/外賣浮動單（無實體枱）：未結 + 今日已付款各一列
      const floatingZones = ['外賣枱', '外賣']
      const isFloating = o => floatingZones.indexOf(o.zone) >= 0 && !this.tables.some(t => String(t.no) === String(o.deskNo))
      this.unfinishedOrders.filter(isFloating).forEach(o => {
        if (!o.order || !o.order.length) return
        rows.push(this.buildFloatingRow(o, o.relisted ? '退單' : (o.printed ? '已印單' : '用餐中'), o.totalPrice || 0))
      })
      this.settledTodayOrders.filter(isFloating).forEach(o => {
        rows.push(this.buildFloatingRow(o, '已付款', o.totalPrice || 0))
      })
      rows = rows.filter(r => (this.tableListStatus === 'all' || (this.tableListStatus === 'free' && r.status === '空枱') || (this.tableListStatus === 'qr' && r.status === '使用中') || (this.tableListStatus === 'active' && r.status === '用餐中') || (this.tableListStatus === 'printed' && r.status === '已印單') || (this.tableListStatus === 'settled' && r.status === '已付款')) && (this.tableListZone === 'all' || r.zone === this.tableListZone))
      const kw = this.tableListKeyword.trim().toLowerCase()
      if (kw) rows = rows.filter(r => r.label.toString().toLowerCase().indexOf(kw) >= 0)
      const orderKw = this.tableListOrderNo.trim().replace(/\s+/g, '').toLowerCase()
      if (orderKw) rows = rows.filter(r => String(r.orderNo || '').toLowerCase().replace(/\s+/g, '').indexOf(orderKw) >= 0)
      const pluKw = this.tableListPluNo.trim().toLowerCase()
      if (pluKw) {
        const pluId = this.pluMap[pluKw]
        rows = rows.filter(r => {
          const orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(r.table.no))
          return orders.some(o => (o.order || []).some(it => {
            const id = String(it._id || it.commodityId || '')
            return (pluId && id === pluId) || String(it.plu || '').toLowerCase().indexOf(pluKw) >= 0 || id.toLowerCase().indexOf(pluKw) >= 0
          }))
        })
      }
      if (this.tableListSort === 'amount') rows.sort((a, b) => parseFloat(b.amount.replace('$', '')) - parseFloat(a.amount.replace('$', '')))
      else if (this.tableListSort === 'time') rows.sort((a, b) => a.openTime.localeCompare(b.openTime))
      else rows.sort((a, b) => String(a.table.no).localeCompare(String(b.table.no)))
      return rows
    },
    tableSearchRows () {
      const kw = this.tableSearchKeyword.trim().toLowerCase()
      const pluId = kw ? this.pluMap[kw] : null
      return this.tableRows.filter(r => {
        if (this.tableSearchStatus !== 'all') {
          const ok = (this.tableSearchStatus === 'free' && r.status === '空枱') || (this.tableSearchStatus === 'qr' && r.status === '使用中') || (this.tableSearchStatus === 'active' && r.status === '用餐中') || (this.tableSearchStatus === 'printed' && r.status === '已印單') || (this.tableSearchStatus === 'settled' && r.status === '已付款')
          if (!ok) return false
        }
        if (!kw) return true
        if (r.label.toString().toLowerCase().indexOf(kw) >= 0 || r.zone.toLowerCase().indexOf(kw) >= 0 || r.waiter.toLowerCase().indexOf(kw) >= 0) return true
        const orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(r.table.no))
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
      if (this.viewingSettledOrder) {
        if (this.isDineIn && String(this.viewingSettledOrder.deskNo) === String(this.selectedTable)) {
          return this.viewingSettledOrder
        }
        if (!this.isDineIn && this.viewingSettledOrder.zone === this.selectedZone) {
          return this.viewingSettledOrder
        }
      }
      if (!this.isDineIn) return this.viewingFloatingOrder || null
      return this.unfinishedOrders.find(o => String(o.deskNo) === String(this.selectedTable)) || null
    },
    orderNoDisplay () {
      if (this.currentOrder && this.currentOrder.orderNo) return this.currentOrder.orderNo
      return this.pendingOrderNo || '—'
    },
    viewingSettled () {
      return !!this.viewingSettledOrder
    },
    splitLeftItems () {
      const order = this.currentOrder ? (this.currentOrder.order || []) : []
      return order
        .map((item, i) => ({ item, i, remain: (item.count || 1) - (this.splitMoves[i] || 0) }))
        .filter(x => x.remain > 0)
    },
    splitRightItems () {
      const order = this.currentOrder ? (this.currentOrder.order || []) : []
      return Object.keys(this.splitMoves)
        .map(i => Number(i))
        .filter(i => order[i] && (this.splitMoves[i] || 0) > 0)
        .map(i => ({ item: order[i], i, count: Math.min(this.splitMoves[i], order[i].count || 1) }))
        .filter(x => x.count > 0)
    },
    splitLeftTotal () {
      return Math.round(this.splitLeftItems.reduce((s, x) => s + this.itemLineTotal(x.item, x.remain), 0) * 100) / 100
    },
    splitRightTotal () {
      return Math.round(this.splitRightItems.reduce((s, x) => s + this.itemLineTotal(x.item, x.count), 0) * 100) / 100
    },
    configuredButtons () {
      const raw = (this.buttonOrder && this.buttonOrder.length) ? this.buttonOrder.slice() : DEFAULT_BUTTON_ORDER.slice()
      // 補齊 DEFAULT_BUTTON_ORDER 中未存在的新功能鍵（避免後台已存的 buttonOrder 少了新鍵）
      const have = {}
      raw.forEach(e => { const id = typeof e === 'string' ? e : (e.id || this.funcCodeToBtnId[e.funcCode] || ''); if (id) have[id] = true })
      DEFAULT_BUTTON_ORDER.forEach(id => { if (!have[id]) raw.push(id) })
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
        const x = Number(entry.x) || 0
        const y = Number(entry.y) || 0
        return { id, colorFrom: entry.colorFrom || entry.color || '', colorTo: entry.colorTo || '', textColor: entry.textColor || '', funcCode: entry.funcCode || '', visible: vis, fontSize: fs, width: w, height: h, x, y, label: entry.label || meta.label, type: meta.type, dineIn: meta.dineIn }
      }).filter(b => b && b.visible && (!b.dineIn || this.isDineIn) && MANAGER_FUNC_IDS.indexOf(b.id) < 0)
        .filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i)
    },
    buttonRows () {
      const rows = []
      const cols = this.posDockPerRow || 8
      for (let i = 0; i < this.layoutButtons.length; i += cols) {
        rows.push(this.layoutButtons.slice(i, i + cols))
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
    dockAllRows () {
      const rows = []
      const cols = this.posDockPerRow || 8
      for (let i = 0; i < this.dockButtons.length; i += cols) {
        rows.push(this.dockButtons.slice(i, i + cols))
      }
      return rows
    },
    dockRows () {
      const all = this.dockAllRows
      const rpp = this.posDockRowsPerPage || 0
      if (rpp <= 0) return all
      const start = this.dockPage * rpp
      return all.slice(start, start + rpp)
    },
    dockTotalPages () {
      const all = this.dockAllRows
      const rpp = this.posDockRowsPerPage || 0
      if (rpp <= 0) return 1
      return Math.max(1, Math.ceil(all.length / rpp))
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
      const rpp = Number(this.posDockRowsPerPage) || 0
      const minH = (h || (rpp > 0 ? rpp * 44 + 4 : 0))
      const st = {}
      if (h) st.height = h + 'px'
      if (minH) st.minHeight = minH + 'px'
      return st
    },
    dockRowGridStyle () {
      const cols = this.posDockPerRow || 8
      return { gridTemplateColumns: 'repeat(' + cols + ', minmax(0, 1fr))' }
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
    // 分類按鈕 & 貨品按鈕尺寸（後台可設）
    foodColsEff () {
      const food = this.foodBtnSettings || {}
      if (food.cols > 0) return food.cols
      const w = this.foodZoneW || 0
      if (w < 360) return 3
      return Math.max(3, Math.min(8, Math.floor(w / 130)))
    },
    // 固定格數模式：每行貨品數與顯示行數都 >0 時啟用（末兩格固定為上頁/下頁，不捲動）
    foodFixedMode () {
      const food = this.foodBtnSettings || {}
      return food.cols > 0 && food.rows > 0
    },
    catGridStyle () {
      const cat = this.catBtnSettings || {}
      const w = cat.width > 0 ? cat.width : 0
      return w > 0 ? { gridTemplateColumns: 'repeat(auto-fill, ' + w + 'px)' } : {}
    },
    foodVars () {
      const cat = this.catBtnSettings || {}
      const food = this.foodBtnSettings || {}
      const vars = {
        '--cat-fs': (cat.fontSize || 13) + 'px',
        '--cat-h': (cat.height || 40) + 'px',
        '--cat-radius': (cat.shape === 'card' ? '10px' : '999px'),
        '--cat-pad': (cat.padding != null ? cat.padding : 20) + 'px',
        '--cat-pad-y': (cat.paddingY != null ? cat.paddingY : 0) + 'px',
        '--cat-gap-x': (cat.gapX != null ? cat.gapX : 10) + 'px',
        '--cat-gap-y': (cat.gapY != null ? cat.gapY : 10) + 'px',
        '--cat-cols': this.catCols,
        '--food-fs': (food.fontSize || 25) + 'px',
        '--food-minh': (food.minHeight || 88) + 'px',
        '--food-img': (food.imageSize || 40) + 'px',
        '--food-pad-x': (food.paddingX != null ? food.paddingX : 3) + 'px',
        '--food-pad-y': (food.paddingY != null ? food.paddingY : 6) + 'px',
        '--food-gap-x': (food.gapX != null ? food.gapX : 6) + 'px',
        '--food-gap-y': (food.gapY != null ? food.gapY : 6) + 'px',
        '--food-cols': this.foodColsEff
      }
      if (food.height > 0) vars['--food-h'] = food.height + 'px'
      return vars
    },
    foodGridStyle () {
      const food = this.foodBtnSettings || {}
      const style = {}
      if (food.width > 0) style.gridTemplateColumns = 'repeat(auto-fill, ' + food.width + 'px)'
      if (this.foodFixedMode) {
        style.gridTemplateRows = 'repeat(' + this.foodRowsEff + ', minmax(0, 1fr))'
        style.overflow = 'hidden'
      } else if (this.foodRowsEff > 0 && this.foodTotalPages > 1) {
        style.overflow = 'hidden'
      }
      return style
    },
    foodBtnH () {
      if (this.foodBtnHReal > 0) return this.foodBtnHReal
      const food = this.foodBtnSettings || {}
      return food.height > 0 ? food.height : (food.minHeight || 88)
    },
    foodGapY () {
      const food = this.foodBtnSettings || {}
      return food.gapY != null ? food.gapY : 6
    },
    foodRowsEff () {
      const food = this.foodBtnSettings || {}
      if (food.rows > 0) return food.rows
      const H = this.foodZoneH || 0
      if (H <= 0) return 0
      const avail = H - 4
      if (avail <= 0) return 0
      return Math.max(1, Math.floor((avail + this.foodGapY) / (this.foodBtnH + this.foodGapY)))
    },
    foodPageSize () {
      return this.foodColsEff * (this.foodRowsEff > 0 ? this.foodRowsEff : 1)
    },
    foodSourceList () {
      if (this.activeCategory === '__combo__') {
        return (this.combos || []).map(c => Object.assign({}, c, { _itemType: 'combo' }))
      }
      return this.activeItems || []
    },
    foodPageGroups () {
      const list = this.foodSourceList
      if (this.foodRowsEff <= 0) return [list]
      const pageSize = Math.max(1, this.foodPageSize - 2)
      const pages = []
      list.forEach((item, i) => {
        const p = Math.floor(i / pageSize)
        if (!pages[p]) pages[p] = []
        pages[p].push(item)
      })
      return pages.filter(p => p.length)
    },
    foodTotalPages () {
      return Math.max(1, this.foodPageGroups.length)
    },
    foodPageItems () {
      return this.foodPageGroups[this.foodPage] || []
    },
    foodGridCells () {
      const items = this.foodPageItems
      if (this.foodRowsEff <= 0 || (!this.foodFixedMode && this.foodTotalPages <= 1)) {
        return items.map((it, i) => ({ type: 'item', item: it, k: i }))
      }
      const size = this.foodPageSize
      const cells = new Array(size).fill(null)
      cells[size - 2] = { type: 'prev' }
      cells[size - 1] = { type: 'next' }
      let pi = 0
      for (let i = 0; i < size; i++) {
        if (cells[i] === null && pi < items.length) cells[i] = { type: 'item', item: items[pi++] }
      }
      return cells.map((c, i) => Object.assign({ k: i }, c || { type: 'empty' }))
    },
    modGroups () {
      const groups = {}
      const idx = this.itemDialog && this.itemDialog.index
      const ci = this.itemDialog && this.itemDialog.contentIndex
      const forceCat = this.itemDialog && this.itemDialog.category
      const catMap = {}
      this.modCodeCategories.forEach(c => { catMap[c.name] = c })
      // 從「改碼類別」按鈕進入：只顯示該類別改碼（多選），無需依賴品項已設定的 modCategories
      if (forceCat) {
        this.modCodeList.filter(m => m.category === forceCat).forEach(m => {
          const c = m.category || '其他'
          if (!groups[c]) groups[c] = []
          groups[c].push(m)
        })
        return Object.keys(groups).map(k => ({ name: k, items: groups[k], minSelect: (catMap[k] && catMap[k].minSelect) || 0, maxSelect: (catMap[k] && catMap[k].maxSelect) || 0 }))
      }
      // 依目前編輯品項的改碼類別過濾；商品未設定改碼則不顯示任何改碼群組
      const item = idx != null ? this.cart[idx] : null
      let cats = []
      if (item && ci != null && item.contents && item.contents[ci]) {
        // 套餐內容品項：優先使用已固化的改碼類別，查不到才反查貨品
        const c = item.contents[ci]
        cats = (c.modCategories && c.modCategories.length) ? c.modCategories : ((this.commodityFood(c.commodityId || c._id) || {}).modCategories || [])
      } else {
        cats = item && item.modCategories ? item.modCategories : []
      }
      if (!cats.length) return []
      const set = {}
      cats.forEach(c => { set[c] = true })
      this.modCodeList.filter(m => set[m.category]).forEach(m => {
        const c = m.category || '其他'
        if (!groups[c]) groups[c] = []
        groups[c].push(m)
      })
      return Object.keys(groups).map(k => ({ name: k, items: groups[k], minSelect: (catMap[k] && catMap[k].minSelect) || 0, maxSelect: (catMap[k] && catMap[k].maxSelect) || 0 }))
    }
  },
  watch: {
    boardMode (v, old) {
      // 離開「查看單據」時清空搜尋框，避免下次進來還記住舊的篩選字
      if (old === 'list' && v !== 'list') {
        this.tableListKeyword = ''
        this.tableListOrderNo = ''
        this.tableListPluNo = ''
      }
    },
    dockButtons () {
      this.dockPage = 0
    },
    cartKey () {
      this.bundleApplied = this.bundleMode !== 'manual'
    },
    view (v) {
      if (v === 'order') this.$nextTick(() => { this.setupFoodObserver() })
      else if (v === 'board') this.$nextTick(() => this.setupFloorObserver())
    },
    loggedIn (v) {
      if (v) this.$nextTick(() => this.setupFloorObserver())
    },
    orderLayout () {
      this.$nextTick(() => { this.setupFoodObserver() })
    },
    goods (list) {
      this.ensureActiveCategory()
    },
    categoryPills () {
      this.catPage = 0
    },
    categoryOrder () {
      this.catPage = 0
    },
    activeCategory () {
      this.foodPage = 0
    },
    foodZoneH () {
      this.foodPage = 0
    },
    foodSourceList () {
      this.$nextTick(() => this.measureFoodBtnH())
    },
    showFoodImages () {
      this.$nextTick(() => this.measureFoodBtnH())
    },
    foodBtnSettings () {
      this.$nextTick(() => this.measureFoodBtnH())
    }
  },
  methods: {
    // 撞餐規則主食側判定：主菜組別(triggerGroupIds)，空=任意主食
    matchingRuleTriggerMatches (f, r) {
      const trigGroups = (r.triggerGroupIds || []).map(String)
      if (trigGroups.length) {
        const gid = f && f.mainGroupId ? String(f.mainGroupId) : ''
        return !!gid && trigGroups.includes(gid)
      }
      return true
    },
    // 已送單跟餐 + 未送單主食：主食後加也能撞餐（跟餐已出，方案B：主食永不變，跟餐改跟餐價）
    computeSentAddonBundles (unsent, baseBundledIndexes) {
      const result = { bundles: [], bundledIndexes: [], totalSavings: 0 }
      const rules = (this.matchingRules || []).filter(r => r.enabled !== false)
      const sent = this.cart.map((f, ci) => ({ f, ci })).filter(({ f }) => f.sent)
      if (!rules.length || !sent.length) return result
      const groupPriceMap = {}
      ;(this.bundleGroups || []).forEach(g => { groupPriceMap[String(g._id)] = Number(g.price) || 0 })
      // 每條未送主食的可用份數（base 已用整條排除）
      const triggerRemaining = {}
      const baseUsed = new Set((baseBundledIndexes || []).map(String))
      unsent.forEach((f, idx) => {
        triggerRemaining[idx] = baseUsed.has(String(idx)) ? 0 : Math.max(1, Math.floor(Number(f.count) || 1))
      })
      // 每條已送飲品的可用份數（已享跟餐價者排除）
      const addonRemaining = {}
      sent.forEach(({ f, ci }) => {
        addonRemaining[ci] = f.bundlePrice ? 0 : Math.max(1, Math.floor(Number(f.count) || 1))
      })
      const newTriggers = new Set()
      const bundles = []
      let totalSavings = 0
      rules.forEach(r => {
        const groupIds = (r.bundleGroupIds || []).map(String)
        const addonPrice = Number(r.addonPrice) || 0

        // 本規則可用的主食單位（依數量展開）
        const triggerUnits = []
        unsent.forEach((f, idx) => {
          const rem = triggerRemaining[idx] || 0
          if (!rem) return
          if (!this.matchingRuleTriggerMatches(f, r)) return
          for (let k = 0; k < rem; k++) triggerUnits.push(idx)
        })
        // 本規則可用的飲品單位（依數量展開）
        const addonUnits = []
        sent.forEach(({ f, ci }) => {
          const rem = addonRemaining[ci] || 0
          if (!rem) return
          const match = groupIds.length
            ? (f.bundleGroupId && groupIds.includes(String(f.bundleGroupId)))
            : true
          if (!match) return
          for (let k = 0; k < rem; k++) addonUnits.push(ci)
        })

        // 嚴格一配一：每個已送飲品只配一個未送主食（依數量展開）
        let ai = 0
        triggerUnits.forEach(idx => {
          if (ai >= addonUnits.length) return
          const aCi = addonUnits[ai++]
          const a = this.cart[aCi]
          const upgrade = groupIds.length ? (groupPriceMap[String(a.bundleGroupId)] || 0) : addonPrice
          const savings = Math.round(((Number(a.price) || 0) - upgrade) * 100) / 100
          if (savings <= 0) return
          bundles.push({
            comboId: 'mrule_' + r._id,
            comboName: r.name || '',
            price: 0,
            original: savings,
            savings,
            _sentAddon: true,
            addon: { _orderNo: a._orderNo, _orderIdx: a._orderIdx, price: upgrade, cartIndex: aCi },
            items: [{ index: idx, gi: 0, ii: 0, commodityId: unsent[idx]._id, name: unsent[idx].name, upgradePrice: 0, qty: 1 }]
          })
          triggerRemaining[idx]--
          addonRemaining[aCi]--
          newTriggers.add(String(idx))
          totalSavings += savings
        })
      })
      result.bundles = bundles
      result.bundledIndexes = [...newTriggers].map(i => Number(i))
      result.totalSavings = Math.round(totalSavings * 100) / 100
      return result
    },
    // 已送單主食 + 未送單飲品（方案B）：飲品後加也能撞餐（主食已出，飲品改跟餐價）
    computeSentMainBundles (unsent, baseBundledIndexes) {
      const result = { bundles: [], bundledIndexes: [], totalSavings: 0 }
      const rules = (this.matchingRules || []).filter(r => r.enabled !== false)
      if (!rules.length || !unsent.length) return result
      const sent = this.cart.map((f, ci) => ({ f, ci })).filter(({ f }) => f.sent)
      if (!sent.length) return result
      const groupPriceMap = {}
      ;(this.bundleGroups || []).forEach(g => { groupPriceMap[String(g._id)] = Number(g.price) || 0 })
      // 每條已送主食的可用份數（依數量展開）；已享跟餐價的飲品(bundlePrice)不是主食，不能算入主食配額
      const triggerRemaining = {}
      sent.forEach(({ f, ci }) => {
        if (f.bundlePrice) return
        triggerRemaining[ci] = Math.max(1, Math.floor(Number(f.count) || 1))
      })
      // 已送單且已享跟餐價的飲品（bundlePrice=true）會吃掉等量主食配額（全局一配一）
      let pairedSentAddonUnits = 0
      sent.forEach(({ f }) => {
        if (f.bundlePrice) pairedSentAddonUnits += Math.max(1, Math.floor(Number(f.count) || 1))
      })
      // 剩餘可用的主食份數（扣除已配對飲品）
      let freeTriggerUnits = 0
      Object.keys(triggerRemaining).forEach(ci => { freeTriggerUnits += triggerRemaining[ci] })
      freeTriggerUnits = Math.max(0, freeTriggerUnits - pairedSentAddonUnits)
      // 每條未送飲品的可用份數（base 已用整條排除）
      const addonRemaining = {}
      const baseUsed = new Set((baseBundledIndexes || []).map(String))
      unsent.forEach((f, idx) => {
        addonRemaining[idx] = baseUsed.has(String(idx)) ? 0 : Math.max(1, Math.floor(Number(f.count) || 1))
      })
      const newAddons = new Set()
      const bundles = []
      let totalSavings = 0
      rules.forEach(r => {
        if (freeTriggerUnits <= 0) return
        const groupIds = (r.bundleGroupIds || []).map(String)
        const addonPrice = Number(r.addonPrice) || 0

        // 本規則可用的主食單位（依數量展開）
        const triggerUnits = []
        sent.forEach(({ f, ci }) => {
          const rem = triggerRemaining[ci] || 0
          if (!rem) return
          if (!this.matchingRuleTriggerMatches(f, r)) return
          for (let k = 0; k < rem; k++) triggerUnits.push(ci)
        })
        // 本規則可用的飲品單位（依數量展開）
        const addonUnits = []
        unsent.forEach((f, idx) => {
          const rem = addonRemaining[idx] || 0
          if (!rem) return
          const match = groupIds.length
            ? (f.bundleGroupId && groupIds.includes(String(f.bundleGroupId)))
            : true
          if (!match) return
          for (let k = 0; k < rem; k++) addonUnits.push(idx)
        })

        let ai = 0
        triggerUnits.forEach(ci => {
          if (freeTriggerUnits <= 0) return
          if (ai >= addonUnits.length) return
          const aIdx = addonUnits[ai++]
          const a = unsent[aIdx]
          const upgrade = groupIds.length ? (groupPriceMap[String(a.bundleGroupId)] || 0) : addonPrice
          const savings = Math.round(((Number(a.price) || 0) - upgrade) * 100) / 100
          if (savings <= 0) return
          bundles.push({
            comboId: 'mrule_' + r._id,
            comboName: r.name || '',
            price: 0,
            original: savings,
            savings,
            _sentMain: true,
            items: [{ index: aIdx, gi: 1, ii: 0, commodityId: a._id, name: a.name, upgradePrice: upgrade, qty: 1 }]
          })
          triggerRemaining[ci]--
          addonRemaining[aIdx]--
          freeTriggerUnits--
          newAddons.add(String(aIdx))
          totalSavings += savings
        })
      })
      result.bundles = bundles
      result.bundledIndexes = [...newAddons].map(i => Number(i))
      result.totalSavings = Math.round(totalSavings * 100) / 100
      return result
    },
    setupFoodObserver () {
      if (typeof ResizeObserver === 'undefined') return
      if (this._foodObserver) { this._foodObserver.disconnect(); this._foodObserver = null }
      const el = document.querySelector('.food-grid')
      if (!el) return
      this.foodZoneW = Math.round(el.clientWidth)
      this.foodZoneH = Math.round(el.clientHeight)
      this._foodObserver = new ResizeObserver(entries => {
        const e = entries && entries[0]
        if (e && e.contentRect) {
          this.foodZoneW = Math.round(e.contentRect.width)
          this.foodZoneH = Math.round(e.contentRect.height)
        }
      })
      this._foodObserver.observe(el)
      this.$nextTick(() => this.measureFoodBtnH())
    },
    measureFoodBtnH () {
      // 固定格數模式下行數由 foodBtnSettings.rows 決定，無需量測按鈕高度（避免強制重排造成卡頓）
      if (this.foodFixedMode) return
      const btns = document.querySelectorAll('.food-grid .food-btn')
      let h = 0
      btns.forEach(b => { const oh = b.offsetHeight; if (oh > h) h = oh })
      if (h > 0) this.foodBtnHReal = h
    },
    setupFloorObserver () {
      if (typeof ResizeObserver === 'undefined') return
      if (this._floorObserver) { this._floorObserver.disconnect(); this._floorObserver = null }
      const el = this.$refs.floorCanvas || document.querySelector('.floor-canvas')
      if (!el) return
      this._floorObserver = new ResizeObserver(entries => {
        const e = entries && entries[0]
        if (e && e.contentRect) {
          this.floorW = Math.round(e.contentRect.width)
          this.floorH = Math.round(e.contentRect.height)
        }
      })
      this._floorObserver.observe(el)
    },
    dockPrev () {
      if (this.dockPage > 0) this.dockPage--
    },
    dockNext () {
      if (this.dockPage < this.dockTotalPages - 1) this.dockPage++
    },
    catPrev () {
      if (this.catPage > 0) this.catPage--
    },
    catNext () {
      if (this.catPage < this.catTotalPages - 1) this.catPage++
    },
    foodPrev () {
      if (this.foodPage > 0) {
        this.foodPage--
        this.resetFoodScroll()
      }
    },
    foodNext () {
      if (this.foodPage < this.foodTotalPages - 1) {
        this.foodPage++
        this.resetFoodScroll()
      }
    },
    resetFoodScroll () {
      const wrap = this.$refs.foodGrids
      if (wrap) wrap.scrollTop = 0
      const grid = wrap && wrap.querySelector('.food-grid')
      if (grid) grid.scrollTop = 0
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
    },
    openClockOut () {
      this.clockDialog = { show: true, mode: 'out', openingCash: '', closingCash: '', remark: '', staffNo: '', loading: false }
    },
    async openConnSettings () {
      this.connDialog = { show: true, host: '127.0.0.1', port: 3000, pgConn: '', stationId: '', saving: false }
      // 瀏覽器：以目前連線主機/連接埠與已選分機作為初始值
      if (!window.appConfig) {
        this.connDialog.host = window.location.hostname || '127.0.0.1'
        this.connDialog.port = window.location.port || 3000
        this.connDialog.stationId = this.selectedTerminal || localStorage.getItem('posTerminal') || ''
        return
      }
      try {
        const cfg = await window.appConfig.get()
        this.connDialog.host = cfg.host || cfg.ip || '127.0.0.1'
        this.connDialog.port = cfg.port || 3000
        this.connDialog.pgConn = cfg.pgConn || ''
        this.connDialog.stationId = cfg.stationId || cfg.terminalCode || ''
      } catch (e) { /* 忽略，保留預設值 */ }
    },
    async saveConnSettings () {
      const host = String(this.connDialog.host || '').trim() || '127.0.0.1'
      const port = Number(this.connDialog.port) || 3000
      const stationId = String(this.connDialog.stationId || '').trim()
      // 瀏覽器：存分機編號到 localStorage，並重新導向到目標主機/埠套用
      if (!window.appConfig) {
        if (stationId) localStorage.setItem('posTerminal', stationId)
        else localStorage.removeItem('posTerminal')
        const scheme = window.location.protocol || 'http:'
        window.location.href = `${scheme}//${host}:${port}/pos`
        return
      }
      this.connDialog.saving = true
      try {
        const pgConn = String(this.connDialog.pgConn || '').trim()
        const patch = { host, port, stationId }
        if (pgConn) patch.pgConn = pgConn
        await window.appConfig.set(patch)
        // 主程序會在寫入後自動重載視窗套用
      } catch (e) {
        this.$message.error('儲存失敗：' + (e && e.message ? e.message : e))
        this.connDialog.saving = false
      }
    },
    async loadTerminals () {
      // 連線設定的分機編號（桌面版 app-config.json）：優先於上次選擇，僅次於 URL 參數
      let cfgStation = ''
      if (window.appConfig) {
        try {
          const cfg = await window.appConfig.get()
          cfgStation = cfg.stationId || cfg.terminalCode || ''
        } catch (e) { /* 忽略 */ }
      }
      // 從 URL 參數獲取 terminalCode（如 /pos?terminal=POS-01）
      const urlParams = new URLSearchParams(window.location.search)
      const urlTerminal = urlParams.get('terminal') || ''
      this.$axios.get('/api/posterminal/enabled').then(res => {
        this.terminals = (res.data || []).filter(t => t.enabled)
        // 優先使用 URL 參數的 terminalCode
        if (urlTerminal && this.terminals.some(t => t.code === urlTerminal)) {
          this.selectedTerminal = urlTerminal
          localStorage.setItem('posTerminal', urlTerminal)
        } else if (cfgStation && this.terminals.some(t => t.code === cfgStation)) {
          // 使用連線設定指定的分機編號
          this.selectedTerminal = cfgStation
          localStorage.setItem('posTerminal', cfgStation)
        } else {
          // 否則恢復上次選擇的收銀機
          const saved = localStorage.getItem('posTerminal')
          if (saved && this.terminals.some(t => t.code === saved)) {
            this.selectedTerminal = saved
          } else if (this.terminals.length > 0) {
            // 無已選紀錄時預設使用第一台收銀機，確保單號使用前綴 + 流水號而非長時間戳
            this.selectedTerminal = this.terminals[0].code
            localStorage.setItem('posTerminal', this.selectedTerminal)
          }
        }
        this.emitRegisterTerminal()
      }).catch(() => { this.terminals = [] })
    },
    emitRegisterTerminal () {
      if (!this.selectedTerminal) return
      this.$getSocket().then(s => {
        if (s && s.connected) {
          s.emit('registerTerminal', this.selectedTerminal)
        }
      })
    },
    loadTables () {
      if (!this.loggedIn) return Promise.resolve()
      return this.$axios.get('/api/table/all').then(res => {
        this.tables = (res.data || []).map(t => Object.assign({ x: null, y: null }, t))
        if (!this.activeBoardZone && this.boardZones.length) this.activeBoardZone = this.boardZones[0]
        return this.loadUnfinished().then(() => this.loadSettledToday())
      }).catch(err => { console.log(err); return Promise.resolve() })
    },
    loadUnfinished () {
      if (!this.loggedIn) return Promise.resolve()
      return this.$axios.get('/api/order/unfinished').then(res => {
        this.unfinishedOrders = res.data || []
      }).catch(err => { console.log(err); return Promise.resolve() })
    },
    loadSettledToday () {
      if (!this.loggedIn) return Promise.resolve()
      return this.$axios.get('/api/order/settledToday').then(res => {
        this.settledTodayOrders = res.data || []
      }).catch(() => { this.settledTodayOrders = [] })
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
      }).catch(() => { this.zones = [{ name: '堂食' }, { name: '外賣枱' }, { name: '外帶' }, { name: '外賣' }] })
    },
    loadMenu () {
      const mode = this.selectedZone || '堂食'
      Promise.all([
        this.$axios.get('/api/commodity/menu', { params: { mode, channel: 'pos' } }),
        this.$axios.get('/api/combo/menu', { params: { channel: 'pos' } }),
        this.$axios.get('/api/matchingrule/list'),
        this.$axios.get('/api/bundlegroup/list')
      ]).then(([foodRes, comboRes, ruleRes, bundleGroupRes]) => {
        this.goods = foodRes.data || []
        this.combos = comboRes.data || []
        this.matchingRules = ruleRes.data || []
        this.bundleGroups = bundleGroupRes.data || []
        this.ensureActiveCategory()
      }).catch(err => console.log(err))
    },
    ensureActiveCategory () {
      const list = this.goods || []
      if (!list.length) return
      if (this.activeCategory && this.categoryById[this.activeCategory]) return
      const firstRoot = list.find(g => g.isRoot) || list[0]
      this.activeCategory = firstRoot ? String(firstRoot._id) : ''
    },
    commodityFood (id) {
      if (!id) return null
      const key = String(id)
      let found = null
      ;(this.goods || []).forEach(cat => (cat.foods || []).forEach(f => {
        if (found) return
        if (!f._isCombo && !f._isModCode && !f._isModCategory && f._id && String(f._id) === key) found = f
      }))
      return found
    },
    enrichComboModifiers (combo) {
      if (!combo) return combo
      const comboCopy = Object.assign({}, combo)
      comboCopy.groups = (combo.groups || []).map(g => {
        const gCopy = Object.assign({}, g)
        gCopy.items = (g.items || []).map(it => {
          const itCopy = Object.assign({}, it)
          const food = this.commodityFood(it.commodityId || it._id)
          const cats = (itCopy.modCategories && itCopy.modCategories.length) ? itCopy.modCategories : ((food && food.modCategories) || [])
          itCopy.modCategories = cats
          // 依改碼類別分組，帶入該類別已有的 minSelect/maxSelect（同步重用改碼類別設定），供點餐端提示與限制
          const catMap = {}
          this.modCodeCategories.forEach(c => { catMap[c.name] = c })
          itCopy.modGroups = cats
            .map(catName => {
              const cat = catMap[catName]
              const modPool = (this.modCodeListAll && this.modCodeListAll.length) ? this.modCodeListAll : this.modCodeList
              return {
                name: catName,
                minSelect: (cat && cat.minSelect) || 0,
                maxSelect: (cat && cat.maxSelect) || 0,
                mods: modPool
                  .filter(m => m.category === catName)
                  .map(m => ({ modCodeId: String(m._id), name: m.name, price: m.price || 0, station: m.station || '', soldOut: !!m.soldOut }))
              }
            })
            .filter(g => g.mods.length)
          // 保留既有 flat modifiers（其他端/舊邏輯仍使用）
          if (!itCopy.modifiers || !itCopy.modifiers.length) {
            if (cats.length) {
              itCopy.modifiers = this.modCodeList
                .filter(m => cats.indexOf(m.category) >= 0)
                .map(m => ({ modCodeId: String(m._id), name: m.name, price: m.price || 0, station: m.station || '' }))
            }
          }
          return itCopy
        })
        return gCopy
      })
      return comboCopy
    },
    mainDishCombo (food) {
      const fid = String((food && food._id) || '')
      if (!fid) return null
      return (this.combos || []).find(c => !c.soldOut && c.autoPopup !== false && isEffectiveNow(c.effectiveTime) && (c.mainDishes || []).some(m => String(m.commodityId || '') === fid))
    },
    openComboPicker (combo, mainDish) {
      combo = (combo && combo._comboData) ? combo._comboData : combo
      if (combo.soldOut) { this.$message({ type: 'warning', message: '此套餐已售罄' }); return }
      this.syncItemEditLeft()
      combo = this.enrichComboModifiers(combo)
      const skipPick = combo.showItems === false
      const selections = {}
      ;(combo.groups || []).forEach((group, index) => {
        const defaults = (skipPick || group.fixed)
          ? (group.items || []).map((it, i) => (it.soldOut ? -1 : i)).filter(i => i >= 0)
          : []
        this.$set(selections, index, defaults)
      })
      this.comboDialog = { show: !skipPick, combo, selections, mods: {}, skipPick, editIndex: -1, mainDish: mainDish || null, mainDishAddon: !!mainDish }
      if (skipPick) this.confirmCombo()
    },
    comboMods (gi, selIdx) {
      const key = gi + ':' + selIdx
      return (this.comboDialog.mods && this.comboDialog.mods[key]) || []
    },
    confirmCombo () {
      const combo = this.comboDialog.combo
      if (!combo) return
      const editIndex = this.comboDialog.editIndex
      if (editIndex < 0 && this.viewingSettled) { this.$message({ type: 'warning', message: '已結賬單唯讀，如需修改請使用「反結賬」' }); return }
      const contents = []
      const snapshotGroups = []
      let extraTotal = 0
      for (let gi = 0; gi < (combo.groups || []).length; gi++) {
        const group = combo.groups[gi]
        const indexes = (this.comboDialog.selections[gi] || []).filter(ii => {
          const it = group.items[ii]
          return it && !it.soldOut
        })
        if (!this.comboDialog.skipPick && !group.fixed && (indexes.length < (group.min || 0) || indexes.length > (group.max || 1))) {
          this.$message({ type: 'warning', message: `請在「${group.name}」選擇 ${(group.min || 0)} 至 ${(group.max || 1)} 項` })
          return
        }
        const snapshotItems = []
        let modInvalid = false
        indexes.forEach(ii => {
          if (modInvalid) return
          const item = group.items[ii]
          if (!item) return
          // Modifier Master：選中品項的改碼（走蔥/加蛋/轉凍飲 +$3）
          const chosenMods = this.comboMods(gi, ii)
          // 驗證改碼類別最少/最多可選（同步改碼類別 minSelect/maxSelect）
          const itemModGroups = item.modGroups || []
          for (const mg of itemModGroups) {
            const min = mg.minSelect || 0
            const max = mg.maxSelect || 0
            if (!min && !max) continue
            const cnt = chosenMods.filter(x => x && (mg.mods || []).some(mm => (mm.modCodeId || mm.name) === (x.id || x.name))).length
            if (min > 0 && cnt < min) {
              this.$message({ type: 'warning', message: `「${item.name}」改碼類別「${mg.name}」最少需選 ${min} 項` })
              modInvalid = true
              return
            }
            if (max > 0 && cnt > max) {
              this.$message({ type: 'warning', message: `「${item.name}」改碼類別「${mg.name}」最多可選 ${max} 項` })
              modInvalid = true
              return
            }
          }
          const itemFood = this.commodityFood(item.commodityId || item._id)
          const itemCats = (item.modCategories && item.modCategories.length) ? item.modCategories : ((itemFood && itemFood.modCategories) || [])
          // 檔口路由：套餐分組未指定 station 時，改用底層貨品的 station/stations，避免全部落到「通用」→ 第一個廚房檔口
          const contentStation = group.station || (itemFood && itemFood.station) || ''
          const contentStations = (itemFood && itemFood.stations && itemFood.stations.length) ? itemFood.stations : (contentStation ? [contentStation] : [])
          extraTotal += (item.upgradePrice || 0) + chosenMods.reduce((s, m) => s + (m && m.price ? Number(m.price) : 0), 0)
          snapshotItems.push({ commodityId: item.commodityId || '', name: item.name, price: item.price || 0, upgradePrice: item.upgradePrice || 0, modifiers: (item.modifiers || []).slice(), substitutes: (item.substitutes || []).slice(), modCategories: (itemCats || []).slice(), itemIndex: ii })
          contents.push({ _id: item.commodityId || '', commodityId: item.commodityId || '', name: item.name, price: (item.price || 0) + (item.upgradePrice || 0), upgradePrice: item.upgradePrice || 0, count: 1, station: contentStation, stations: contentStations, mods: chosenMods, modCategories: (itemCats || []).slice(), gi, ii })
        })
        if (modInvalid) return
        if (indexes.length > 0 && Number(group.groupPrice) > 0) extraTotal += Number(group.groupPrice)
        snapshotGroups.push({ name: group.name, station: group.station || '', min: group.min || 0, max: group.max || 1, allowRepeat: !!group.allowRepeat, fixed: !!group.fixed, groupPrice: Number(group.groupPrice) || 0, items: snapshotItems })
      }
      const mainDish = this.comboDialog.mainDish || null
      const isAddon = !!this.comboDialog.mainDishAddon
      const basePrice = isAddon ? 0 : (Number(combo.price) || 0)
      const item = { _id: combo._id, name: combo.name, price: Math.round((basePrice + extraTotal) * 100) / 100, count: 1, mods: [], discount: 1, free: false, customPrice: 0, contents, comboId: combo._id, comboName: combo.name, comboSnapshot: { type: combo.type, price: basePrice, groups: snapshotGroups }, departmentSplit: (combo.departmentSplit || []).slice(), showItems: combo.showItems !== false, noPrintComboName: !!combo.noPrintComboName, sent: false, _mainDishAddon: isAddon, mainGroupId: combo.mainGroupId || '', code: combo.code || '' }
      if (editIndex >= 0) {
        const orig = this.cart[editIndex]
        if (orig) {
          item.count = orig.count || 1
          item.discount = orig.discount || 1
          item.free = !!orig.free
          item.customPrice = orig.customPrice || 0
          item.dishStatus = orig.dishStatus || ''
          item.sent = !!orig.sent
          item.addTime = orig.addTime || null
          item._comboLinkId = orig._comboLinkId
        }
        this.refreshItem(item)
        const cart = this.cart.slice()
        cart[editIndex] = item
        this.$set(this.carts, this.cartKey, cart)
        this.selectedContentKey = ''
        this.selectedCartIndex = editIndex
      } else if (mainDish) {
        // 永富式主食自動彈出：主食保留為獨立貨品行（跟餐價 = combo.price），跟餐加配另起一行
        const linkId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
        const mainItem = { _id: mainDish._id, name: mainDish.name, name2: mainDish.name2 || '', price: Number(combo.price) || 0, count: 1, mods: [], discount: 1, free: false, customPrice: 0, station: mainDish.station, stations: mainDish.stations, category: mainDish.category || '', categoryId: mainDish.categoryId || '', categoryName: mainDish.categoryName || mainDish.category || '', categoryCode: mainDish.categoryCode || '', department: mainDish.department || '', plu: mainDish.plu || '', code: mainDish.code || '', modCategories: mainDish.modCategories || [], jumpSpecIndex: mainDish.jumpSpecIndex || 0, jumpSpecName: mainDish.jumpSpecName || '', mandatory: !!mainDish.mandatory, addTime: null, sent: false, _comboLinkId: linkId }
        item._comboLinkId = linkId
        this.refreshItem(mainItem)
        this.refreshItem(item)
        const cart = this.cart
        this.$set(this.carts, this.cartKey, cart.concat(mainItem, item))
        this.selectedContentKey = ''
        this.selectedCartIndex = cart.length
      } else {
        this.refreshItem(item)
        const cart = this.cart
        this.$set(this.carts, this.cartKey, cart.concat(item))
        this.selectedContentKey = ''
        this.selectedCartIndex = cart.length
      }
      this.comboDialog.show = false
    },
    openComboEdit (index) {
      const item = this.cart[index]
      if (!item || !item.comboId) return
      if (item.sent) {
        this.$message({ type: 'warning', message: '已落單套餐內容不能修改' })
        return
      }
      this.syncItemEditLeft()
      let combo = (this.combos || []).find(c => String(c._id) === String(item.comboId))
      if (combo) {
        combo = this.enrichComboModifiers(combo)
      } else {
        const snap = item.comboSnapshot || {}
        combo = {
          _id: item.comboId,
          name: item.name,
          price: item.price,
          type: snap.type || 'select',
          showItems: item.showItems !== false,
          departmentSplit: (item.departmentSplit || []).slice(),
          groups: (snap.groups || []).map(g => ({
            name: g.name,
            min: g.min || 0,
            max: g.max || 1,
            allowRepeat: !!g.allowRepeat,
            fixed: !!g.fixed,
            station: g.station || '',
            groupPrice: Number(g.groupPrice) || 0,
            items: (g.items || []).map(si => ({ commodityId: si.commodityId || '', name: si.name, price: si.price || 0, upgradePrice: si.upgradePrice || 0, modifiers: si.modifiers || [], substitutes: si.substitutes || [], modCategories: si.modCategories || [] }))
          }))
        }
      }
      const selections = {}
      const mods = {}
      ;(combo.groups || []).forEach((g, gi) => { this.$set(selections, gi, []) })
      ;(item.contents || []).forEach(c => {
        const gi = c.gi != null ? c.gi : 0
        let ii = c.ii != null ? c.ii : -1
        const group = combo.groups && combo.groups[gi]
        if (!group || !group.items[ii]) {
          ii = group && group.items ? group.items.findIndex(it => (it.commodityId && String(it.commodityId) === String(c.commodityId)) || it.name === c.name) : -1
        }
        if (ii >= 0) {
          selections[gi].push(ii)
          if ((c.mods || []).length) this.$set(mods, gi + ':' + ii, (c.mods || []).slice())
        }
      })
      this.comboDialog = { show: true, combo, selections, mods, skipPick: false, editIndex: index, mainDish: null, mainDishAddon: !!item._mainDishAddon }
    },
    loadModCodes () {
      this.$axios.get('/api/modcode/list', { params: { channel: 'pos' } }).then(res => { this.modCodeList = res.data || [] }).catch(() => { this.modCodeList = [] })
      this.$axios.get('/api/modcode/list', { params: { channel: 'pos', includeSoldOut: '1' } }).then(res => { this.modCodeListAll = res.data || [] }).catch(() => { this.modCodeListAll = [] })
      this.loadModCategories()
    },
    loadModCategories () {
      this.$axios.get('/api/modcode/categories').then(res => { this.modCodeCategories = res.data || [] }).catch(() => { this.modCodeCategories = [] })
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
        this.serviceChargePreDiscount = d.serviceChargePreDiscount !== false
        this.roundingMode = d.roundingMode || 'none'
        this.reprintMinLevel = d.reprintMinLevel == null ? 3 : d.reprintMinLevel
        this.modCodeUIMode = d.modCodeUIMode === 'B' ? 'B' : 'A'
        this.teaChargesRequired = !!d.teaChargesRequired
        this.requiredCategoryId = d.requiredCategoryId || ''
        this.teaSeatSyncPax = !!d.teaSeatSyncPax
        this.servingNewItemsOnly = !!d.servingNewItemsOnly
        this.bundleEnabled = !!d.bundleEnabled
        this.bundleMode = d.bundleMode === 'manual' || d.bundleMode === 'both' ? d.bundleMode : 'auto'
        this.directPayMode = !!d.directPayMode
        this.bundleRule = d.bundleRule === 'priority' ? 'priority' : 'bestPrice'
        this.bundleApplied = this.bundleMode !== 'manual'
        this.shareTableEnabled = !!d.shareTableEnabled
        this.showFoodImages = d.showFoodImages !== false
        this.gestureEnabled = d.gestureEnabled !== false
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
        // 分市時間主檔（報表同步）
        this.posSlots = Array.isArray(d.slots) ? d.slots.filter(s => s && s.name) : []
        // 自訂 POS 字型
        this.posFontFamily = d.posFontFamily || ''
        this.posFontUrl = d.posFontUrl || ''
        this.applyPosFont()
        const pbs = d.posBtnSettings || {}
        if (pbs.fontSize) this.posBtnFontSize = pbs.fontSize
        if (pbs.width) this.posBtnWidth = pbs.width
        if (pbs.height) this.posBtnHeight = pbs.height
        if (pbs.rowsPerPage != null) this.posDockRowsPerPage = pbs.rowsPerPage
        if (pbs.perRow != null) this.posDockPerRow = pbs.perRow
        const dn = d.dockNav || {}
        this.dockNav.fontSize = dn.fontSize || 18
        this.dockNav.width = dn.width || 100
        this.dockNav.height = dn.height || 40
        this.dockNav.bgColor = dn.bgColor || '#409eff'
        this.dockNav.textColor = dn.textColor || '#ffffff'
        this.dockNav.pageNumFontSize = dn.pageNumFontSize || 12
        this.dockNav.gap = dn.gap != null ? dn.gap : 6
        const cbs = d.catBtnSettings || {}
        this.catBtnSettings = { fontSize: cbs.fontSize || 13, width: cbs.width != null ? cbs.width : 0, height: cbs.height || 40, padding: cbs.padding != null ? cbs.padding : 20, paddingY: cbs.paddingY != null ? cbs.paddingY : 0, gapX: cbs.gapX != null ? cbs.gapX : 10, gapY: cbs.gapY != null ? cbs.gapY : 10, cols: cbs.cols > 0 ? cbs.cols : 4, rows: cbs.rows != null ? cbs.rows : 6, shape: cbs.shape || 'pill' }
        this.categoryOrder = Array.isArray(d.categoryOrder) ? d.categoryOrder : []
        const fbs = d.foodBtnSettings || {}
        this.foodBtnSettings = { cols: fbs.cols != null ? fbs.cols : 0, rows: fbs.rows != null ? fbs.rows : 0, fontSize: fbs.fontSize || 25, width: fbs.width != null ? fbs.width : 0, height: fbs.height != null ? fbs.height : 0, minHeight: fbs.minHeight || 88, imageSize: fbs.imageSize || 40, paddingX: fbs.paddingX != null ? fbs.paddingX : 3, paddingY: fbs.paddingY != null ? fbs.paddingY : 6, gapX: fbs.gapX != null ? fbs.gapX : 6, gapY: fbs.gapY != null ? fbs.gapY : 6, showPlu: fbs.showPlu !== false, showPrice: fbs.showPrice !== false, showStock: fbs.showStock !== false }
        this.managerMenu = Array.isArray(d.managerMenu) ? d.managerMenu : []
        this.discountOptions = Array.isArray(d.discountOptions) ? d.discountOptions : []
        const cts = d.calledTagStyle || {}
        this.calledTagStyle = { color: cts.color || '#ea580c', background: cts.background || '#ffedd5', border: cts.border || '#fed7aa' }
        const bs = d.badgeStyle || {}
        this.badgeStyle = {
          transfer: { fontSize: (bs.transfer && bs.transfer.fontSize) || 13, color: (bs.transfer && bs.transfer.color) || '#ffffff', background: (bs.transfer && bs.transfer.background) || '#e6a23c', visible: (bs.transfer && bs.transfer.visible !== false) },
          merge: { fontSize: (bs.merge && bs.merge.fontSize) || 13, color: (bs.merge && bs.merge.color) || '#ffffff', background: (bs.merge && bs.merge.background) || '#67c23a', visible: (bs.merge && bs.merge.visible !== false) },
          split: { fontSize: (bs.split && bs.split.fontSize) || 13, color: (bs.split && bs.split.color) || '#ffffff', background: (bs.split && bs.split.background) || '#409eff', visible: (bs.split && bs.split.visible !== false) },
          chase: { fontSize: (bs.chase && bs.chase.fontSize) || 13, color: (bs.chase && bs.chase.color) || '#ffffff', background: (bs.chase && bs.chase.background) || '#f56c6c', visible: (bs.chase && bs.chase.visible !== false) }
        }
        const bl = d.boardLayout || {}
        this.boardCardHeight = bl.cardHeight || 110
        this.boardCardWidth = bl.cardWidth || 0
        this.boardGridCols = bl.gridCols || 0
        this.boardGridRows = bl.gridRows || 0
        this.boardGap = bl.gap !== undefined ? bl.gap : 10
        const cd = d.cardDisplay || {}
        const cdDefault = { seats: { show: true, fontSize: 12, position: 'top-left' }, dot: { show: true, fontSize: 9, position: 'top-right' }, tableNo: { show: true, fontSize: 42, position: 'center' }, amount: { show: true, fontSize: 17, position: 'below-no' }, status: { show: true, fontSize: 12, position: 'below-amount' }, duration: { show: true, fontSize: 11, position: 'bottom' } }
        for (const k of Object.keys(cdDefault)) {
          this.cardDisplay[k] = { show: cd[k] ? cd[k].show !== false : true, fontSize: (cd[k] && cd[k].fontSize) || cdDefault[k].fontSize, position: (cd[k] && cd[k].position) || cdDefault[k].position }
        }
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
      this.$axios.get('/api/hold/holds')
        .then(res => { this.holdList = res.data || [] })
        .catch(() => { this.holdList = [] })
    },
    tablePos (t, i) {
      if (t.x !== null && t.x !== undefined && t.y !== null && t.y !== undefined) return { x: t.x, y: t.y }
      const cw = this.boardCardWidthEff
      const ch = this.boardCardHeight || 110
      const gap = this.boardGap || 0
      const cols = this.boardGridColsEff
      if (t.shareSuffix && t.physicalNo) {
        const parent = this.tables.find(p => String(p.no) === String(t.physicalNo))
        if (parent) {
          const pi = this.boardTables.indexOf(parent)
          if (pi >= 0) {
            const pp = { x: (pi % cols) * (cw + gap), y: Math.floor(pi / cols) * (ch + gap) }
            const idx = (this.tables.filter(s => String(s.physicalNo) === String(t.physicalNo) && s.shareSuffix)).indexOf(t)
            return { x: pp.x + cw + gap, y: pp.y + idx * (Math.floor(ch * 0.7) + gap) }
          }
        }
      }
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
        return
      }
      if (this.releaseTableMode) this.startTablePress(t)
    },
    onBoardMouseUp () {
      if (this.releaseTableMode) this.cancelTablePress()
    },
    onBoardTouchStart (t) {
      if (this.layoutMode || !this.releaseTableMode) return
      this.startTablePress(t)
    },
    onBoardTouchEnd () {
      if (this.releaseTableMode) this.cancelTablePress()
    },
    onBoardTouchMove () {
      if (this.releaseTableMode) this.cancelTablePress()
    },
    startTablePress (t) {
      this.cancelTablePress()
      if (this.boardStatus(t.no) !== '使用中') return
      this.tablePressTimer = setTimeout(() => this.confirmReleaseTable(t.no), 2000)
    },
    cancelTablePress () {
      if (this.tablePressTimer) {
        clearTimeout(this.tablePressTimer)
        this.tablePressTimer = null
      }
    },
    toggleReleaseTableMode () {
      this.releaseTableMode = !this.releaseTableMode
      this.cancelTablePress()
      if (this.releaseTableMode) {
        this.$message({ type: 'warning', message: '已進入解除枱號狀態模式：長按「使用中」枱號 2 秒以解除，再按一次功能鍵退出' })
      }
    },
    confirmReleaseTable (no) {
      this.cancelTablePress()
      this.$confirm(`是否解除枱號 ${no} 的使用中狀態？解除後會還原該枱之前的枱號狀況（不刪除訂單）。`, '解除枱號狀態', { type: 'warning', confirmButtonText: '確認解除', cancelButtonText: '取消' })
        .then(async () => {
          try {
            const res = await this.$axios.post('/api/order/releaseTable', { deskNo: no })
            this.$message({ type: 'success', message: res.data })
            this.releaseTableMode = false
            this.loadUnfinished()
          } catch (err) {
            this.$message({ type: 'error', message: err.response ? err.response.data : '解除失敗' })
          }
        })
        .catch(() => {})
    },
    toggleCopyOrderMode () {
      this.copyOrderMode = !this.copyOrderMode
      this.copyOrderSource = null
      if (this.copyOrderMode) {
        this.$message({ type: 'warning', message: '已進入複印單據模式：請先按來源枱（要複印的枱），再按目標枱（要複印到的枱）；再按一次功能鍵退出' })
      }
    },
    handleCopyOrderTable (t) {
      const no = String(t.no)
      if (!this.copyOrderSource) {
        const hasOrder = this.unfinishedOrders.some(o => String(o.deskNo) === no && o.order && o.order.length)
        if (!hasOrder) {
          this.$message({ type: 'warning', message: `枱 ${no} 沒有可複印的未結訂單` })
          return
        }
        this.$confirm(`是否複印枱 ${no} 的單據？`, '複印單據', { type: 'info', confirmButtonText: '確認複印', cancelButtonText: '取消' })
          .then(() => {
            this.copyOrderSource = no
            this.$message({ type: 'info', message: `已選取來源枱 ${no}，請按目標枱（要複印到的枱）` })
          })
          .catch(() => {})
        return
      }
      if (no === this.copyOrderSource) {
        this.$message({ type: 'warning', message: '目標枱不能與來源枱相同' })
        return
      }
      this.doCopyOrder(this.copyOrderSource, no)
    },
    doCopyOrder (from, to) {
      this.$axios.post('/api/order/copyOrder', { from, to })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.copyOrderMode = false
          this.copyOrderSource = null
          this.loadUnfinished()
          this.backToBoard()
        })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '複印單據失敗' }))
    },
    onBoardClick (t) {
      if (this.layoutMode) return
      if (this.releaseTableMode) return
      if (this.copyOrderMode) { this.handleCopyOrderTable(t); return }
      if (this.shareTableEnabled) {
        const hasOrder = this.unfinishedOrders.some(o => this.physicalNos(t.no).indexOf(String(o.deskNo)) >= 0 && o.order && o.order.length)
        if (hasOrder) {
          const subTables = this.tables
            .filter(tb => String(tb.physicalNo) === String(t.no) && tb.shareSuffix)
            .map(st => ({ no: st.no, name: st.name, status: this.boardStatus(st.no), badges: this.tableBadges(st.no) }))
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
    onBoardContextMenu (t, e) {
      if (this.layoutMode) return
      e.preventDefault()
      this.tableContextMenu = { show: true, x: e.clientX, y: e.clientY, deskNo: t.no }
    },
    closeTableContextMenu () { this.tableContextMenu.show = false },
    ctxEnterTable () {
      const no = this.tableContextMenu.deskNo
      this.tableContextMenu.show = false
      this.enterTable(no)
    },
    async ctxForceUnlock () {
      const no = this.tableContextMenu.deskNo
      this.tableContextMenu.show = false
      try {
        await this.$confirm(`確定要強制解鎖枱號 ${no}？此操作會刪除該枱所有未結訂單，無法復原！`, '強制解鎖', { type: 'warning', confirmButtonText: '確認解鎖', cancelButtonText: '取消' })
      } catch (e) { return }
      try {
        const res = await this.$axios.post('/api/order/forceUnlock', { deskNo: no })
        this.$message({ type: 'success', message: res.data })
        this.loadUnfinished()
      } catch (err) {
        this.$message({ type: 'error', message: err.response ? err.response.data : '解鎖失敗' })
      }
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
          if (t.shareSuffix) return
          const p = this.tablePos(t, i)
          tables.push({ _id: t._id, x: t.x === null || t.x === undefined ? p.x : t.x, y: t.y === null || t.y === undefined ? p.y : t.y })
        })
      })
      this.$axios.post('/api/table/layout', { tables })
        .then(res => { this.$message({ type: 'success', message: res.data }); this.layoutMode = false; this.loadTables() })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '儲存失敗' }))
    },
    physicalNos (no) {
      // 搭枱模式：主枱卡片需連同子枱訂單一起判斷（狀態/金額/進入）
      if (!this.shareTableEnabled) return [String(no)]
      return [String(no)].concat(this.physicalNoMap[String(no)] || [])
    },
    lockOrderOf (no) {
      const nos = this.physicalNos(no)
      return this.unfinishedOrders.find(o => nos.indexOf(String(o.deskNo)) >= 0 && o.source === 'extension')
    },
    isStaleLock (lockOrder) {
      // 鎖定超過 TTL（與後端 LOCK_TTL_MS 一致，30 分鐘）視為呆鎖，允許其他工作站接管
      if (!lockOrder || !lockOrder.lockedAt) return false
      const ttl = 30 * 60 * 1000
      return Date.now() - new Date(lockOrder.lockedAt).getTime() > ttl
    },
    boardClass (no) {
      if (no === this.selectedTable) return 'board-active'
      if (this.lockOrderOf(no)) return 'board-qr'
      const nos = this.physicalNos(no)
      const orders = this.unfinishedOrders.filter(o => nos.indexOf(String(o.deskNo)) >= 0 && o.order && o.order.length)
      if (orders.length) {
        if (orders.some(o => o.relisted)) return 'board-relisted'
        if (orders.some(o => o.source === 'extension')) return 'board-qr'
        if (orders.some(o => o.printed)) return 'board-printed'
        return 'board-busy'
      }
      return 'board-free'
    },
    boardStatus (no) {
      if (no === this.selectedTable) return '使用中'
      if (this.lockOrderOf(no)) return '使用中'
      const nos = this.physicalNos(no)
      const orders = this.unfinishedOrders.filter(o => nos.indexOf(String(o.deskNo)) >= 0 && o.order && o.order.length)
      if (orders.length) {
        if (orders.some(o => o.relisted)) return '退單'
        if (orders.some(o => o.source === 'extension')) return '使用中'
        if (orders.some(o => o.printed)) return '已印單'
        return '用餐中'
      }
      return '空枱'
    },
    tableAmount (no) {
      const nos = this.physicalNos(no)
      return this.unfinishedOrders.filter(o => nos.indexOf(String(o.deskNo)) >= 0).reduce((sum, o) => sum + (o.totalPrice || 0), 0)
    },
    tableDuration (no) {
      const order = (this.orderMap[String(no)] || []).find(o => String(o.deskNo) === String(no))
      return order && order.date ? this.durationText(order.date) : ''
    },
    hasOrder (no) {
      return (this.orderMap[String(no)] || []).some(o => o.order && o.order.length)
    },
    isTransferred (no) {
      return (this.orderMap[String(no)] || []).some(o => o.transferredFrom && (!o.fromAction || o.fromAction === 'transfer'))
    },
    transferInfo (no) {
      const o = (this.orderMap[String(no)] || []).find(o => o.transferredFrom)
      if (!o) return ''
      return '從 ' + o.transferredFrom + ' 號枱轉入'
    },
    isMerged (no) {
      return (this.orderMap[String(no)] || []).some(o => o.fromAction === 'merge')
    },
    mergeInfo (no) {
      const o = (this.orderMap[String(no)] || []).find(o => o.fromAction === 'merge')
      if (!o) return ''
      return '從 ' + (o.transferredFrom || o.deskNo) + ' 號枱併入'
    },
    isSplit (no) {
      return (this.orderMap[String(no)] || []).some(o => o.fromAction === 'split')
    },
    splitInfo (no) {
      const o = (this.orderMap[String(no)] || []).find(o => o.fromAction === 'split')
      if (!o) return ''
      return '從 ' + (o.transferredFrom || o.deskNo) + ' 號枱分出'
    },
    isChased (no) {
      return (this.orderMap[String(no)] || []).some(o => o.chasedAt)
    },
    chasedInfo (no) {
      const o = (this.orderMap[String(no)] || []).find(o => o.chasedAt)
      if (!o) return ''
      const t = new Date(o.chasedAt)
      return '追單時間：' + t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0')
    },
    tableBadges (no) {
      const bs = this.badgeStyle || {}
      const badges = []
      if (bs.transfer && bs.transfer.visible !== false && this.isTransferred(no)) {
        badges.push({ key: 'transfer', text: '轉', tip: this.transferInfo(no), fontSize: bs.transfer.fontSize || 13, color: bs.transfer.color || '#ffffff', background: bs.transfer.background || '#e6a23c' })
      }
      if (bs.merge && bs.merge.visible !== false && this.isMerged(no)) {
        badges.push({ key: 'merge', text: '合', tip: this.mergeInfo(no), fontSize: bs.merge.fontSize || 13, color: bs.merge.color || '#ffffff', background: bs.merge.background || '#67c23a' })
      }
      if (bs.split && bs.split.visible !== false && this.isSplit(no)) {
        badges.push({ key: 'split', text: '分', tip: this.splitInfo(no), fontSize: bs.split.fontSize || 13, color: bs.split.color || '#ffffff', background: bs.split.background || '#409eff' })
      }
      if (bs.chase && bs.chase.visible !== false && this.isChased(no)) {
        badges.push({ key: 'chase', text: '追', tip: this.chasedInfo(no), fontSize: bs.chase.fontSize || 13, color: bs.chase.color || '#ffffff', background: bs.chase.background || '#f56c6c' })
      }
      return badges
    },
    tableLabel (t) {
      // 搭枱子枱顯示名稱（如 23A），退款虛擬枱顯示名稱（如 5Z），其餘顯示數字
      if (t.shareSuffix) return t.name || String(t.no)
      if (t.name && /^\d+Z$/.test(t.name)) return t.name
      return t.no
    },
    buildTableRow (t, order, status, amount) {
      return {
        table: t,
        label: this.tableLabel(t),
        zone: t.zone || '未分區',
        orderNo: order && order.orderNo ? order.orderNo : '-',
        status,
        statusType: status === '空枱' ? 'success' : (status === '退單' ? 'info' : (status === '用餐中' ? 'success' : 'warning')),
        seats: order && order.pax ? order.pax : (order ? t.seats : '-'),
        openTime: order && order.date ? this.formatTime(new Date(order.date)) : '-',
        duration: order && order.date ? this.durationText(order.date) : '-',
        amount: amount ? '$' + amount : '-',
        waiter: order && order.waiter ? order.waiter : '-',
        printer: order && order.printer ? order.printer : '-',
        cashier: order && order.cashier ? order.cashier : '-',
        _id: order && order._id ? order._id : '',
        totalPrice: order && order.totalPrice != null ? order.totalPrice : 0,
        payMethod: order && order.payMethod ? order.payMethod : ''
      }
    },
    buildFloatingRow (order, status, amount) {
      const t = { no: order.zone || '外賣', name: '', shareSuffix: '', zone: order.zone || '外賣' }
      const row = this.buildTableRow(t, order, status, amount)
      row.floating = true
      return row
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
      const lockOrder = this.lockOrderOf(no)
      // 同一工作站可重新進入自己鎖定的枱；鎖已過期（呆鎖）時也允許接管。
      // 頁面重整/斷線會留下呆鎖（extension 單未解鎖），若連鎖定者本機都被擋，就再也無法進入該枱。
      const ownLock = lockOrder && this.selectedTerminal && String(lockOrder.terminalCode || '') === String(this.selectedTerminal)
      const staleLock = this.isStaleLock(lockOrder)
      if (lockOrder && !ownLock && !staleLock) {
        const terminal = lockOrder.terminalCode || ''
        const msg = terminal ? `此枱由分機 ${terminal} 使用中，完成訂單後才可使用` : '此枱由分機使用中，完成訂單後才可使用'
        this.$message({ type: 'warning', message: msg })
        return
      }
      this.viewingSettledOrder = null
      this.viewingFloatingOrder = null
      this.pendingOrderNo = null
      this.selectedTable = no
      this.selectedZone = '堂食'
      this.view = 'order'
      this.ensureActiveCategory()
      this.onTableChange()
      // 該枱已有未結單時，載入接續點餐（保留尚未送出的品項）
      const current = this.carts[no] || []
      const orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(no))
      if (!current.length || orders.length) {
        this.rebuildTableCart(no)
        if (orders.length) this.$message({ type: 'info', message: `已載入枱號 ${no} 的未結單（${orders.length} 筆）` })
      }
      this.lockTable(no)
    },
    lockTable (no) {
      if (!no) return Promise.resolve()
      return this.$axios.post('/api/order/lockTable', { deskNo: String(no), terminalCode: this.selectedTerminal }).catch(() => {})
    },
    unlockTable (no) {
      if (!no) return Promise.resolve()
      return this.$axios.post('/api/order/unlockTable', { deskNo: String(no) }).catch(() => {})
    },
    toCartItem (item, orderNo, idx) {
      const ni = {
        _id: item._id || item.name,
        name: item.name,
        name2: item.name2 || '',
        price: item.price || 0,
        count: item.count || 1,
        mods: item.mods || [],
        discount: item.discount || 1,
        free: !!item.free,
        customPrice: item.customPrice || 0,
        station: item.station,
        stations: item.stations,
        category: item.category || '',
        categoryId: item.categoryId || '',
        categoryName: item.categoryName || item.category || '',
        categoryCode: item.categoryCode || '',
        bundleGroupId: item.bundleGroupId || '',
        mainGroupId: item.mainGroupId || '',
        bundlePrice: !!item.bundlePrice,
        plu: item.plu || '',
        code: item.code || '',
        jumpSpecIndex: item.jumpSpecIndex || 0,
        jumpSpecName: item.jumpSpecName || '',
        mandatory: !!item.mandatory,
        addTime: item.addTime || null,
        contents: item.contents || [],
        comboId: item.comboId,
        comboName: item.comboName,
        comboSnapshot: item.comboSnapshot,
        noPrintComboName: !!item.noPrintComboName,
        departmentSplit: item.departmentSplit || [],
        showItems: item.showItems !== false,
        dishStatus: item.dishStatus || '',
        _orderNo: orderNo,
        _orderIdx: idx,
        sent: true
      }
      this.refreshItem(ni)
      return ni
    },
    rebuildTableCart (no) {
      const current = this.carts[no] || []
      const unsent = current.filter(i => !i.sent)
      const orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(no))
      const sent = []
      orders.forEach(o => {
        (o.order || []).forEach((item, idx) => {
          if (item.voidStatus === 1) return
          sent.push(this.toCartItem(item, o.orderNo, idx))
        })
      })
      const next = sent.concat(unsent)
      this.$set(this.carts, no, next)
      return next
    },
    syncOpenTableCart () {
      if (!this.loggedIn || !this.selectedTable || this.view !== 'order' || !this.isDineIn) return
      const no = this.selectedTable
      const current = this.carts[no] || []
      // 剛送單、本地已標 sent 但尚未取回 _orderNo 的品項：暫不重建，避免被尚未更新的 unfinishedOrders 覆蓋
      if (current.some(i => i.sent && !i._orderNo)) return
      const orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(no))
      const sent = []
      orders.forEach(o => (o.order || []).forEach((item, idx) => {
        if (item.voidStatus === 1) return
        sent.push(this.toCartItem(item, o.orderNo, idx))
      }))
      const sig = arr => arr.map(i => `${String(i._orderNo || '')}|${String(i._orderIdx ?? '')}|${i.name}|${i.count}|${i.dishStatus || ''}`).join(';;')
      if (sig(current.filter(i => i.sent)) === sig(sent)) return
      this.rebuildTableCart(no)
    },
    openSettledOrder (row) {
      if (!this.canModifySettled()) return
      const orderNo = row.orderNo && row.orderNo !== '-' ? row.orderNo : ''
      const order = this.settledTodayOrders.find(o => String(o.orderNo) === String(orderNo))
      if (!order) {
        this.$message({ type: 'warning', message: '找不到該已付款訂單' })
        return
      }
      // 外賣/外賣枱浮動單：以 zone 進入，而非堂食枱號
      if (row.floating) {
        const zone = order.zone === '外賣' ? '外賣' : '外賣枱'
        this.selectedZone = zone
        this.selectedTable = null
        this.viewingSettledOrder = order
        this.viewingFloatingOrder = null
        this.pendingOrderNo = null
        this.view = 'order'
        this.ensureActiveCategory()
        const key = zone === '外賣' ? 'delivery' : 'takeaway'
        const cart = []
        ;(order.order || []).forEach((item, idx) => {
          if (item.voidStatus === 1) return
          cart.push(this.toCartItem(item, order.orderNo, idx))
        })
        this.$set(this.carts, key, cart)
        this.$message({ type: 'info', message: `已載入已付款訂單 ${order.orderNo}` })
        return
      }
      const no = row.table ? row.table.no : row.no
      this.selectedTable = no
      this.selectedZone = '堂食'
      this.viewingSettledOrder = order
      this.viewingFloatingOrder = null
      this.pendingOrderNo = null
      this.view = 'order'
      this.ensureActiveCategory()
      this.onTableChange()
      const cart = []
      ;(order.order || []).forEach((item, idx) => {
        if (item.voidStatus === 1) return
        cart.push(this.toCartItem(item, order.orderNo, idx))
      })
      this.$set(this.carts, no, cart)
      this.$message({ type: 'info', message: `已載入已付款訂單 ${order.orderNo}` })
    },
    enterTakeaway () {
      this.viewingSettledOrder = null
      this.viewingFloatingOrder = null
      this.pendingOrderNo = null
      this.selectedZone = '外賣枱'
      this.view = 'order'
      this.ensureActiveCategory()
      if (!this.carts.takeaway) this.$set(this.carts, 'takeaway', [])
      if (!this.carts.takeaway.length) this.reserveOrderNo('外賣枱')
    },
    enterDelivery () {
      this.viewingSettledOrder = null
      this.viewingFloatingOrder = null
      this.pendingOrderNo = null
      this.selectedZone = '外賣'
      this.view = 'order'
      this.ensureActiveCategory()
      if (!this.carts.delivery) this.$set(this.carts, 'delivery', [])
      if (!this.carts.delivery.length) this.reserveOrderNo('外賣')
    },
    enterFloatingOrder (row) {
      const zone = row.zone === '外賣' ? '外賣' : '外賣枱'
      this.viewingSettledOrder = null
      this.viewingFloatingOrder = null
      this.pendingOrderNo = null
      this.selectedZone = zone
      this.selectedTable = null
      this.view = 'order'
      this.ensureActiveCategory()
      const key = zone === '外賣' ? 'delivery' : 'takeaway'
      if (!this.carts[key]) this.$set(this.carts, key, [])
      const order = this.unfinishedOrders.find(o => String(o._id) === String(row._id))
      if (!order) {
        this.$message({ type: 'warning', message: '找不到該訂單' })
        return
      }
      const cart = []
      ;(order.order || []).forEach((item, idx) => {
        if (item.voidStatus === 1) return
        cart.push(this.toCartItem(item, order.orderNo, idx))
      })
      this.$set(this.carts, key, cart)
      this.viewingFloatingOrder = order
      this.$message({ type: 'info', message: `已載入${zone}訂單 ${order.orderNo}` })
    },
    reserveOrderNo (zone) {
      return this.$axios.post('/api/order/previewNo', { terminalCode: this.selectedTerminal, zone })
        .then(res => { this.pendingOrderNo = res.data.orderNo })
        .catch(() => {})
    },
    backToBoard () {
      const hasUnsent = this.cart.some(i => !i.sent)
      if (hasUnsent) {
        this.$confirm('購物車內有未送單貨品，是否繼續？', '返回枱號', {
          type: 'warning',
          customClass: 'back-to-board-alert',
          confirmButtonText: '是',
          cancelButtonText: '否'
        }).then(() => {
          this.clearNewItems()
          this.doBackToBoard()
        }).catch(() => {})
        return
      }
      this.doBackToBoard()
    },
    doBackToBoard () {
      const deskNo = this.selectedTable
      this.viewingSettledOrder = null
      this.viewingFloatingOrder = null
      this.pendingOrderNo = null
      this.view = 'board'
      this.selectedTable = null
      if (deskNo) this.unlockTable(deskNo)
      this.loadUnfinished()
      this.loadSettledToday()
    },
    logout () {
      const deskNo = this.selectedTable
      this.viewingSettledOrder = null
      this.viewingFloatingOrder = null
      this.pendingOrderNo = null
      localStorage.removeItem('orderTk')
      this.loggedIn = false
      this.loginNo = ''
      this.loginPassword = ''
      this.loginActive = 'no'
      this.view = 'board'
      this.selectedTable = null
      this.carts = {}
      if (deskNo) this.unlockTable(deskNo)
    },
    enterFullscreen () {
      try {
        const el = document.documentElement
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen
        if (req) {
          const p = req.call(el)
          if (p && p.catch) p.catch(() => {})
        }
      } catch (e) {}
    },
    toggleFullscreen () {
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen
          if (exit) exit.call(document)
        } else {
          this.enterFullscreen()
        }
      } catch (e) {}
    },
    leaveApp () {
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {})
        }
        window.open('', '_self')
        window.close()
      } catch (e) {
        console.error(e)
      }
      setTimeout(() => {
        this.$message({ type: 'info', message: '請手動關閉瀏覽器視窗以離開 POS' })
      }, 500)
    },
    toggleLoginActive () {
      this.loginActive = this.loginActive === 'no' ? 'password' : 'no'
    },
    onLoginKeypadInput (v) {
      if (this.loginActive === 'no') {
        this.loginNo = v
      } else {
        this.loginPassword = v
      }
    },
    onLoginKeypadConfirm () {
      if (this.loginActive === 'no') {
        if (!this.loginNo.trim()) {
          this.$message({ type: 'warning', message: '請先輸入員工編號' })
          return
        }
        this.loginActive = 'password'
      } else {
        this.login()
      }
    },
    onTableChange () {
      const t = this.tables.find(x => String(x.no) === String(this.selectedTable))
      if (t) {
        const order = this.currentOrder
        this.pax = (order && order.pax) ? order.pax : (t.seats || this.pax)
      }
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
    modsExtraOf (item) {
      return (item.mods || []).reduce((sum, m) => sum + (typeof m === 'object' && m && m.price ? Number(m.price) || 0 : 0), 0)
    },
    // 跟餐價規則：未送單前，跟餐品項顯示的單價（跟餐價 + 改碼加價）
    displayUnitPrice (item, index) {
      const o = this.bundlePriceOverride[index]
      if (o && o.qty >= (item.count || 1)) {
        return Math.round((o.price + this.modsExtraOf(item)) * (item.discount || 1) * 100) / 100
      }
      return item.unitPrice
    },
    // 跟餐價規則：未送單前，跟餐品項顯示的小計（已捆綁數量按跟餐價，其餘按原價）
    displaySubtotal (item, index) {
      const o = this.bundlePriceOverride[index]
      if (!o) return item.subtotal
      const total = item.count || 1
      const bundled = Math.min(o.qty, total)
      const remaining = total - bundled
      const modsExtra = this.modsExtraOf(item)
      const unitBundle = Math.round((o.price + modsExtra) * (item.discount || 1) * 100) / 100
      const unitFull = item.unitPrice
      return Math.round((bundled * unitBundle + remaining * unitFull) * 100) / 100
    },
    itemStationLabel (item) {
      const arr = (item.stations && item.stations.length) ? item.stations : (item.station ? [item.station] : [])
      return arr.join('/')
    },
    jumpSpecLabel (item) {
      const idx = Number(item.jumpSpecIndex) || 0
      if (!idx) return ''
      return `價格${idx}`
    },
    fmtTime (t) {
      if (!t) return ''
      const d = new Date(t)
      if (isNaN(d.getTime())) return ''
      const pad = n => String(n).padStart(2, '0')
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`
    },
    detailLine (item) {
      const parts = []
      if (this.waiter) parts.push('員工：' + this.waiter)
      if (item.addTime) parts.push('入單時間：' + this.fmtTime(item.addTime))
      const st = this.itemStationLabel(item)
      if (st) parts.push('印表機：' + st)
      if (item.code) parts.push('貨品編號：' + item.code)
      if (item.price != null) {
        const priceLabel = this.jumpSpecLabel(item) || '價格'
        parts.push(priceLabel + '：$' + item.price)
      }
      const cat = item.categoryName || item.category
      if (cat) parts.push('分類：' + cat + (item.categoryCode ? '(' + item.categoryCode + ')' : ''))
      return parts.join('　')
    },
    toggleShowDetail () {
      this.showDetail = !this.showDetail
      this.$message({ type: 'success', message: this.showDetail ? '已顯示品項明細' : '已隱藏品項明細' })
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
    canModifySettled () {
      if ((this.staffInfo.permissionLevel || 1) >= 3) return true
      this.$message({ type: 'warning', message: '你沒有修改已結賬單的權限（需要經理以上）' })
      return false
    },
    canSkipManagerAuth (perm) {
      return (this.staffInfo.permissionLevel || 1) >= 3 || (this.staffInfo.permissions || []).indexOf(perm) >= 0
    },
    openPluPad () {
      this.pluDialog = { show: true, value: this.pluInput || '' }
    },
    confirmPlu () {
      const code = (this.pluDialog.value || '').trim()
      if (!code) return
      this.pluInput = code
      this.pluDialog.value = ''
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
      // 2) 套餐編號（CODE）精確匹配
      if (!found) {
        found = (this.combos || []).find(c => !c.soldOut && String(c.code || '') === code)
        if (found) {
          this.pluInput = ''
          this.openComboPicker(found)
          return
        }
      }
      // 3) 簡碼/名稱模糊搜尋：名稱包含關鍵字的第一個可點品項
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
    handleHardwarePluKeydown (e) {
      if (!this.loggedIn || (this.view !== 'order' && this.view !== 'board')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return
      if (this.pluDialog.show) return
      if (document.querySelector('.v-modal')) return

      if (e.key === 'Enter' || e.key === '+') {
        e.preventDefault()
        const buf = this.scanBuffer
        // 掃描槍特徵：末字元與 Enter 間隔極短（<100ms），人工手按較慢
        const isScan = this.scanLastTs > 0 && (Date.now() - this.scanLastTs) <= 100
        this.scanBuffer = ''
        this.scanLastTs = 0
        if (isScan) {
          const desk = this.parseTableBarcode(buf)
          if (desk !== null) {
            this.pluInput = ''
            this.jumpToTableByScan(desk)
            return
          }
        }
        if (this.view === 'order' && (this.pluInput || '').trim()) this.addByPlu()
        else this.pluInput = ''
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        this.pluInput = ''
        this.scanBuffer = ''
        return
      }
      if (e.key === 'Backspace' || e.key === '-') {
        e.preventDefault()
        this.pluInput = (this.pluInput || '').slice(0, -1)
        this.scanBuffer = ''
        return
      }
      if (e.key === '.') {
        e.preventDefault()
        this.pluInput = ''
        this.scanBuffer = ''
        return
      }
      if (e.key && e.key.length === 1) {
        // 條碼掃描器快速連續輸入（含英數字）：追蹤掃描緩衝，供 Enter 時判斷跳枱
        const now = Date.now()
        if (now - this.scanLastTs > 120) this.scanBuffer = ''
        this.scanBuffer += e.key
        this.scanLastTs = now
        if (this.view === 'order' && /^[0-9]$/.test(e.key)) {
          e.preventDefault()
          this.pluInput = (this.pluInput || '') + e.key
        }
      }
    },
    parseTableBarcode (buf) {
      const s = String(buf || '').trim()
      if (!s) return null
      // 條碼內容即純台號（如 5、10、A1），僅當值匹配現有台號時視為掃枱跳號
      if (this.tables.some(t => String(t.no) === s)) return s
      return null
    },
    jumpToTableByScan (desk) {
      const no = String(desk)
      if (!this.tables.some(t => String(t.no) === no)) {
        this.$message({ type: 'warning', message: `找不到枱號 ${no}` })
        return
      }
      if (String(this.selectedTable) === no && this.view === 'order') {
        this.$message({ type: 'info', message: `已在枱號 ${no}` })
        return
      }
      this.enterTable(no)
    },
    addFood (food) {
      if (this.viewingSettled) { this.$message({ type: 'warning', message: '已結賬單唯讀，如需修改請使用「反結賬」' }); return }
      if (food._isModCode) {
        if (food.soldOut) { this.$message({ type: 'warning', message: '此改碼已沽清' }); return }
        this.addModToSelectedItem(food); return
      }
      if (food._isModCategory) { this.openModCatFoodDialog(food); return }
      if (food.soldOut) { this.$message({ type: 'warning', message: '此品項已沽清' }); return }
      if (food.openPrice) {
        this.openPriceDialog = { show: true, food }
        return
      }
      const mainCombo = this.mainDishCombo(food)
      if (mainCombo) {
        this.openComboPicker(mainCombo, food)
        return
      }
      const beforeBundles = this.bundlePlan.bundles.length
      const cart = this.cart
      const useQty = 1
      const exist = cart.find(i => i._id === food._id && !(i.mods && i.mods.length) && !i.free && i.discount === 1 && !i.customPrice && !i.sent)
      if (exist) {
        exist.count += useQty
        this.refreshItem(exist)
        this.$set(this.carts, this.cartKey, cart.slice())
        this.selectedContentKey = ''
        this.selectedCartIndex = cart.indexOf(exist)
      } else {
        const item = { _id: food._id, name: food.name, name2: food.name2 || '', price: food.price, count: useQty, mods: [], discount: 1, free: false, customPrice: 0, station: food.station, stations: food.stations, category: food.category || '', categoryId: food.categoryId || '', bundleGroupId: food.bundleGroupId || '', mainGroupId: food.mainGroupId || '', categoryName: food.categoryName || food.category || '', categoryCode: food.categoryCode || '', department: food.department || '', plu: food.plu || '', code: food.code || '', modCategories: food.modCategories || [], jumpSpecIndex: food.jumpSpecIndex || 0, jumpSpecName: food.jumpSpecName || '', mandatory: !!food.mandatory, addTime: null, sent: false }
        this.refreshItem(item)
        this.$set(this.carts, this.cartKey, cart.concat(item))
        this.selectedContentKey = ''
        this.selectedCartIndex = cart.length
        this.autoOpenMandatoryMods(cart.length)
      }
      this.autoDetectBundle(beforeBundles)
      this.scrollOrderList('bottom')
      this.sideBuffer = ''
    },
    confirmOpenPrice ({ name, price }) {
      if (this.viewingSettled) { this.$message({ type: 'warning', message: '已結賬單唯讀，如需修改請使用「反結賬」' }); return }
      const food = this.openPriceDialog.food || {}
      const cart = this.cart
      const item = { _id: food._id, name, price: food.price || 0, count: 1, mods: [], discount: 1, free: false, customPrice: price, station: food.station, stations: food.stations, category: food.category || '', categoryId: food.categoryId || '', bundleGroupId: food.bundleGroupId || '', mainGroupId: food.mainGroupId || '', categoryName: food.categoryName || food.category || '', categoryCode: food.categoryCode || '', department: food.department || '', plu: food.plu || '', code: food.code || '', modCategories: food.modCategories || [], jumpSpecIndex: food.jumpSpecIndex || 0, jumpSpecName: food.jumpSpecName || '', mandatory: !!food.mandatory, addTime: null, sent: false }
      this.refreshItem(item)
      this.$set(this.carts, this.cartKey, cart.concat(item))
      this.selectedContentKey = ''
      this.selectedCartIndex = cart.length
      this.autoOpenMandatoryMods(cart.length)
      this.scrollOrderList('bottom')
      this.sideBuffer = ''
    },
    addModToSelectedItem (food) {
      // 選取目標：僅在沒有整列選取（selectedCartIndex < 0）時，才採用套餐內容品項（selectedContentKey）
      let idx = this.selectedCartIndex
      let ci = null
      if (idx < 0 && this.selectedContentKey) {
        const parts = String(this.selectedContentKey).split(':')
        idx = parseInt(parts[0], 10)
        ci = parts.length > 1 ? parseInt(parts[1], 10) : null
      }
      const item = idx >= 0 ? this.cart[idx] : null
      if (!item) {
        this.$message({ type: 'warning', message: '請先點選要加改碼的品項' })
        return
      }
      if (item.sent) {
        this.$message({ type: 'warning', message: '已落單品項不能加改碼' })
        return
      }
      const modObj = { id: food._id, name: food.name, price: food.price || 0, station: food.station || '' }
      const newCart = this.cart.slice()
      const newItem = Object.assign({}, newCart[idx])
      if (ci != null && newItem.contents && newItem.contents[ci]) {
        // 套餐內容品項：加到該品項的 mods，並重算套餐價
        const newContents = newItem.contents.slice()
        const c = newContents[ci]
        const cMods = (c.mods || []).slice()
        if (cMods.some(x => x && (x.id || x.name) === food._id)) {
          this.$message({ type: 'info', message: '此改碼已加入' })
          return
        }
        cMods.push(modObj)
        newContents[ci] = Object.assign({}, c, { mods: cMods })
        newItem.contents = newContents
        this.recalcComboPrice(newItem)
      } else {
        const mods = (newItem.mods || []).slice()
        if (mods.some(x => x && (x.id || x.name) === food._id)) {
          this.$message({ type: 'info', message: '此改碼已加入' })
          return
        }
        mods.push(modObj)
        newItem.mods = mods
      }
      this.refreshItem(newItem)
      newCart[idx] = newItem
      this.$set(this.carts, this.cartKey, newCart)
      this.sideBuffer = ''
    },
    openModCatFoodDialog (food) {
      // 依 PosSetting.modCodeUIMode 切換顯示方式：
      // 方案 A＝列表多選（highlight 已選 + 完成）；方案 B＝品項編輯 Chip 介面（只顯示該類別改碼）
      if (this.modCodeUIMode === 'B') {
        this.openModCatFoodDialogB(food)
        return
      }
      this.syncItemEditLeft()
      const items = this.modCodeList.filter(m => m.category === food.name)
      this.modCatFoodDialog = { show: true, name: food.name, items, selected: [] }
    },
    openModCatFoodDialogB (food) {
      let idx = this.selectedCartIndex
      let ci = null
      if (idx < 0 && this.selectedContentKey) {
        const parts = String(this.selectedContentKey).split(':')
        idx = parseInt(parts[0], 10)
        ci = parts.length > 1 ? parseInt(parts[1], 10) : null
      }
      const item = idx >= 0 ? this.cart[idx] : null
      if (!item) { this.$message({ type: 'warning', message: '請先點選要加改碼的品項' }); return }
      if (item.sent) { this.$message({ type: 'warning', message: '已落單品項不能加改碼' }); return }
      this.syncItemEditLeft()
      if (ci != null && item.contents && item.contents[ci]) {
        const c = item.contents[ci]
        this._itemEditOriginalMods = ((c && c.mods) || []).slice()
        this.itemDialog = { show: true, index: idx, contentIndex: ci, mods: (c.mods || []).slice(), customMod: '', category: food.name }
      } else {
        this._itemEditOriginalMods = ((item && item.mods) || []).slice()
        this.itemDialog = { show: true, index: idx, mods: (item.mods || []).slice(), customMod: '', category: food.name }
      }
    },
    isModCatSelected (m) {
      return (this.modCatFoodDialog.selected || []).some(x => String(x._id) === String(m._id))
    },
    toggleModCatFoodItem (m) {
      const sel = (this.modCatFoodDialog.selected || []).slice()
      const idx = sel.findIndex(x => String(x._id) === String(m._id))
      if (idx >= 0) sel.splice(idx, 1)
      else sel.push(m)
      this.modCatFoodDialog.selected = sel
    },
    confirmModCatFood () {
      const sel = this.modCatFoodDialog.selected || []
      sel.forEach(m => this.addModToSelectedItem({ _id: m._id, name: m.name, price: m.price || 0, station: m.station || '' }))
      this.modCatFoodDialog.show = false
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
      if (id === 'takeaway' && this.boardMode === 'grid' && this.boardZoneFilter === '外賣枱') return 'active'
      if (id === 'dineIn' && this.boardMode === 'grid' && this.boardZoneFilter === '堂食') return 'active'
      if (id === 'delivery' && this.view === 'order' && this.selectedZone === '外賣') return 'active'
      return ''
    },
    sbIcon (id) {
      const icons = { grid: 'el-icon-menu', takeaway: 'el-icon-shopping-bag-2', dineIn: 'el-icon-office-building', delivery: 'el-icon-truck', list: 'el-icon-tickets', search: 'el-icon-search', history: 'el-icon-time', refresh: 'el-icon-refresh', addTable: 'el-icon-plus', batchPrint: 'el-icon-printer', report: 'el-icon-data-analysis', settings: 'el-icon-setting' }
      return icons[id] || 'el-icon-more'
    },
    sbClick (id) {
      if (id === 'grid') { this.boardMode = 'grid'; return }
      if (id === 'takeaway') { this.boardZoneFilter = '外賣枱'; return }
      if (id === 'dineIn') { this.boardZoneFilter = '堂食'; return }
      if (id === 'delivery') { this.enterDelivery(); return }
      if (id === 'list') { this.boardMode = 'list'; this.tableListZone = '堂食'; return }
      if (id === 'search') { this.openTableSearch(); return }
      if (id === 'history') { this.openHistory(); return }
      if (id === 'refresh') { this.refreshBoard(); return }
      if (id === 'addTable') { this.boardAction('addTable'); return }
      if (id === 'batchPrint') { this.boardAction('print'); return }
      if (id === 'report') { this.boardAction('report'); return }
      if (id === 'settings') { this.openSoldOut(); return }
      if (BUTTON_META[id]) { this.runAction(id) }
    },
    refreshBoard () {
      this.loadTables()
      this.$message({ type: 'success', message: '枱況已更新' })
    },
    reloadPos () {
      this.loadTerminals()
      this.loadShopName()
      this.loadZones()
      this.loadMenu()
      this.loadModCodes()
      this.loadPosSetting()
      this.loadAmounts()
      this.loadHolds()
      this.loadShiftStatus()
      this.loadTables()
      this.$message({ type: 'success', message: 'POS 已重新整理' })
    },
    durationText (date) {
      const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000))
      return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`
    },
    onTableRowClick (row) {
      if (row.status === '已付款') {
        this.openSettledOrder(row)
        return
      }
      if (row.floating) {
        this.enterFloatingOrder(row)
        return
      }
      this.enterTable(row.table ? row.table.no : row.no)
    },
    tableRowClass ({ row }) {
      if (row.status === '使用中') return 'table-row-qr'
      if (row.status === '用餐中') return 'table-row-busy'
      if (row.status === '退單') return 'table-row-relisted'
      if (row.status === '已印單') return 'table-row-printed'
      if (row.status === '已付款') return 'table-row-settled'
      return 'table-row-free'
    },
    openSoldOut () {
      const list = []
      const seen = new Set()
      this.goods.forEach(g => {
        (g.foods || []).forEach(f => {
          if (!f.soldOut) return
          const key = String(f._id)
          if (seen.has(key)) return
          seen.add(key)
          list.push({ _id: f._id, plu: f.plu || f.code || '', code: f.code || '', name: f.name, soldOut: true, stock: f.stock === undefined || f.stock === null ? -1 : f.stock, _isCombo: !!f._isCombo, _isModCode: !!f._isModCode })
        })
      })
      this.soldOutDialog = { show: true, keyword: '', list, showItemPicker: false, pickerKeyword: '' }
    },
    isSoldOutable (food) {
      if (!food) return false
      return !!food._isCombo || !!food._isModCode || food._itemType === 'commodity'
    },
    foodClick (food) {
      if (this.foodPressed) { this.foodPressed = false; return }
      if (food._isCombo) this.openComboPicker(food)
      else this.addFood(food)
    },
    startFoodPress (food, e) {
      if (!this.isSoldOutable(food)) return
      this.foodPressed = false
      this.cancelFoodPress()
      const pos = (e.touches && e.touches.length) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }
      this.foodPressTimer = setTimeout(() => {
        this.foodPressed = true
        this.foodSoldOutMenu = { show: true, x: pos.x, y: pos.y, item: food }
        // 自動清除長按旗標，避免影響後續點擊
        setTimeout(() => { this.foodPressed = false }, 800)
      }, 600)
    },
    cancelFoodPress () {
      if (this.foodPressTimer) {
        clearTimeout(this.foodPressTimer)
        this.foodPressTimer = null
      }
    },
    closeFoodSoldOutMenu () {
      this.foodSoldOutMenu.show = false
      this.foodPressed = false
    },
    doFoodSoldOut (item, soldOut) {
      this.foodSoldOutMenu.show = false
      const label = item._isCombo ? '套餐' : (item._isModCode ? '改碼' : '貨品')
      this.$confirm(`是否將${label}「${item.name}」${soldOut ? '沽清' : '重售'}？`, soldOut ? '沽清' : '重售', { type: 'warning', confirmButtonText: soldOut ? '確認沽清' : '確認重售', cancelButtonText: '取消' })
        .then(() => this.submitFoodSoldOut(item, soldOut))
        .catch(() => {})
    },
    submitFoodSoldOut (item, soldOut) {
      let url = '/api/commodity/soldout'
      if (item._isCombo) url = '/api/combo/soldout'
      else if (item._isModCode) url = '/api/modcode/soldout'
      this.$axios.post(url, { _id: item._id, soldOut })
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.$set(item, 'soldOut', soldOut)
          this.syncSoldOutList(item, soldOut)
          this.loadMenu()
          if (item._isModCode) this.loadModCodes()
        })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '更新失敗' }))
    },
    syncSoldOutList (item, soldOut) {
      const list = this.soldOutDialog.list || []
      const found = list.find(x => String(x._id) === String(item._id))
      if (soldOut) {
        if (!found) {
          list.push({ _id: item._id, plu: item.plu || item.code || '', code: item.code || '', name: item.name, soldOut: true, stock: item.stock === undefined || item.stock === null ? -1 : item.stock, _isCombo: !!item._isCombo, _isModCode: !!item._isModCode })
        } else {
          found.soldOut = true
        }
      } else if (found) {
        found.soldOut = false
      }
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
      if (nextItem.count <= 0) {
        const linkId = nextItem._comboLinkId
        nextCart.splice(index, 1)
        // 主食與跟餐連動：刪除其中一行時一併刪除連動的另一行
        if (linkId) {
          for (let i = nextCart.length - 1; i >= 0; i--) {
            if (nextCart[i]._comboLinkId === linkId) nextCart.splice(i, 1)
          }
        }
      } else {
        this.refreshItem(nextItem)
      }
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
    findSentOrderItem (item) {
      const order = this.unfinishedOrders.find(o => String(o.orderNo) === String(item._orderNo))
      if (!order) return null
      let idx = item._orderIdx != null ? Number(item._orderIdx) : -1
      if (idx < 0 || idx >= (order.order || []).length) {
        idx = (order.order || []).findIndex(it => it.name === item.name)
      }
      if (idx < 0) return null
      return { order, idx }
    },
    applyPosFont () {
      const DEFAULT_STACK = '-apple-system, BlinkMacSystemFont, "PingFang TC", "PingFang SC", "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Microsoft JhengHei", "Arial", sans-serif'
      if (this._posFontStyle) {
        this._posFontStyle.remove()
        this._posFontStyle = null
      }
      if (this._posFontOverride) {
        this._posFontOverride.remove()
        this._posFontOverride = null
      }
      let family = ''
      if (this.posFontUrl) {
        const customName = (this.posFontFamily || 'PosCustomFont').replace(/'/g, '')
        const style = document.createElement('style')
        style.id = 'pos-custom-font'
        style.textContent = `@font-face{font-family:'${customName}';src:url('${this.posFontUrl}');font-weight:100 900;font-display:swap;}`
        document.head.appendChild(style)
        this._posFontStyle = style
        family = `'${customName}', ` + DEFAULT_STACK
      } else if (this.posFontFamily) {
        family = "'" + this.posFontFamily.replace(/'/g, '') + "', " + DEFAULT_STACK
      } else {
        family = DEFAULT_STACK
      }
      // reset.css 用 !important 固定了 .el-button / .el-input 的字型，需以更高優先權覆寫才能讓自訂字型套用到功能按鈕
      const ov = document.createElement('style')
      ov.id = 'pos-font-override'
      ov.textContent = `#pos, #pos .el-button, #pos .el-input__inner, #pos .el-select .el-input__inner, #pos .el-textarea__inner { font-family: ${family} !important; }`
      document.head.appendChild(ov)
      this._posFontOverride = ov
      this.posFontStack = family
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
    btnPosStyle (b) {
      const x = Number(b.x) || 0
      const y = Number(b.y) || 0
      if (!x && !y) return {}
      return { position: 'absolute', left: x + 'px', top: y + 'px', zIndex: 30, width: 'auto', height: 'auto', margin: '0' }
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
      const rpp = Number(this.posDockRowsPerPage) || 0
      if (h) return { minHeight: h + 'px' }
      if (rpp > 0) return { minHeight: (rpp * 44 + 4) + 'px' }
      return {}
    },
    padPress (n) {
      if (this.selectedCartIndex >= 0 && this.cart[this.selectedCartIndex]) {
        const num = parseInt(n, 10)
        if (num > 0) {
          const item = this.cart[this.selectedCartIndex]
          if (item.sent && !this.hasPermission('order.changeSentQty')) {
            this.$message({ type: 'warning', message: '你沒有修改已落單品項數量的權限' })
            return
          }
          const nextCart = this.cart.slice()
          nextCart[this.selectedCartIndex] = Object.assign({}, nextCart[this.selectedCartIndex], { count: num })
          this.refreshItem(nextCart[this.selectedCartIndex])
          this.$set(this.carts, this.cartKey, nextCart)
        }
      } else {
        this.sideBuffer = n
      }
    },
    selectCartItem (index) {
      const tapped = this.cart[index]
      if (tapped) {
        console.log('[POS] 點擊購物車項目', {
          index,
          name: tapped.name,
          price: tapped.price,
          count: tapped.count,
          sent: tapped.sent,
          _id: tapped._id,
          bundleGroupId: tapped.bundleGroupId,
          bundlePrice: tapped.bundlePrice,
          categoryId: tapped.categoryId
        })
      }
      if (this.pendingItemDiscount) {
        this.toggleDiscountSelect(index)
        return
      }
      this.selectedContentKey = ''
      this.selectedCartIndex = this.selectedCartIndex === index ? -1 : index
    },
    onRowClick (index) {
      if (!this.gestureEnabled) return
      if (this.rowClickIndex !== index) {
        this.rowClickIndex = index
        this.rowClickCount = 0
      }
      this.rowClickCount++
      if (this.rowClickTimer) clearTimeout(this.rowClickTimer)
      this.rowClickTimer = setTimeout(() => {
        const count = this.rowClickCount
        const idx = this.rowClickIndex
        this.rowClickCount = 0
        this.rowClickIndex = -1
        this.rowClickTimer = null
        if (count === 2) {
          this.cancelItemBySelect(idx)
        } else if (count >= 3) {
          this.cancelAll()
        }
      }, 400)
    },
    sideQtyPad () {
      if (this.selectedCartIndex >= 0 && this.cart[this.selectedCartIndex]) {
        const item = this.cart[this.selectedCartIndex]
        if (item.sent && !this.hasPermission('order.changeSentQty')) {
          this.$message({ type: 'warning', message: '你沒有修改已落單品項數量的權限' })
          return
        }
        this.qtyPanel = { show: true, index: this.selectedCartIndex, value: String(item.count) }
      } else {
        this.$message({ type: 'warning', message: '請先點選清單中的菜品' })
      }
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
      const v = (this.tableKeypad.value || '').trim()
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
    openListKeypad (field) {
      const map = {
        keyword: { title: '輸入枱號', value: this.tableListKeyword, letters: true },
        orderNo: { title: '輸入單號', value: this.tableListOrderNo, letters: false },
        pluNo: { title: '輸入貨品編號', value: this.tableListPluNo, letters: false }
      }
      const cfg = map[field] || { title: '輸入', value: '', letters: false }
      this.listKeypad = { show: true, field, value: cfg.value, title: cfg.title, letters: cfg.letters }
    },
    confirmListKeypad () {
      const field = this.listKeypad.field
      const v = (this.listKeypad.value || '').trim()
      if (field === 'keyword') this.tableListKeyword = v
      else if (field === 'orderNo') { this.tableListOrderNo = v; this.hintIfPastOrder(v) } else if (field === 'pluNo') this.tableListPluNo = v
      this.listKeypad.show = false
    },
    findTableOrderByNo (tableNo, orderKw) {
      const kw = String(orderKw || '').trim().replace(/\s+/g, '').toLowerCase()
      if (!kw) return null
      return this.unfinishedOrders.concat(this.settledTodayOrders)
        .find(o => String(o.deskNo) === String(tableNo) && o.orderNo && String(o.orderNo).toLowerCase().indexOf(kw) >= 0) || null
    },
    hintIfPastOrder (orderNo) {
      const kw = String(orderNo || '').trim().replace(/\s+/g, '').toLowerCase()
      if (!kw) return
      const matchedToday = this.tables.some(t => this.findTableOrderByNo(t.no, kw))
      if (matchedToday) return
      this.$axios.get('/api/order/findByNo', { params: { orderNo: kw } })
        .then(res => {
          const d = res.data || {}
          if (d.found) {
            this.$message({ type: 'info', message: '此單據為往日單據（枱 ' + (d.deskNo || '-') + '），請到「往日單據」尋找' })
          } else {
            this.$message({ type: 'warning', message: '找不到該單據' })
          }
        })
        .catch(() => {})
    },
    confirmQty () {
      const item = this.cart[this.qtyDialog.index]
      if (!item) { this.qtyDialog.show = false; return }
      if (item.sent && !this.hasPermission('order.changeSentQty')) {
        this.$message({ type: 'warning', message: '你沒有修改已落單品項數量的權限' })
        this.qtyDialog.show = false
        return
      }
      const n = parseFloat(this.qtyDialog.value)
      if (!n || n <= 0) { this.$message({ type: 'warning', message: '請輸入有效數量' }); return }
      const newCart = this.cart.slice()
      const newIdx = Object.assign({}, newCart[this.qtyDialog.index])
      newIdx.count = n
      this.refreshItem(newIdx)
      newCart[this.qtyDialog.index] = newIdx
      this.$set(this.carts, this.cartKey, newCart)
      this.qtyDialog.show = false
    },
    selectQuickQty (q) {
      const idx = this.qtyPanel.index
      const item = this.cart[idx]
      if (!item) { this.qtyPanel.show = false; return }
      if (item.sent && !this.hasPermission('order.changeSentQty')) {
        this.$message({ type: 'warning', message: '你沒有修改已落單品項數量的權限' })
        this.qtyPanel.show = false
        return
      }
      const newCart = this.cart.slice()
      const newIdx = Object.assign({}, newCart[idx], { count: q })
      this.refreshItem(newIdx)
      newCart[idx] = newIdx
      this.$set(this.carts, this.cartKey, newCart)
      this.qtyPanel.show = false
      this.$message({ type: 'success', message: item.name + ' 數量改為 ' + q })
    },
    confirmQtyKeypad () {
      const idx = this.qtyPanel.index
      const item = this.cart[idx]
      if (!item) { this.qtyPanel.show = false; return }
      if (item.sent && !this.hasPermission('order.changeSentQty')) {
        this.$message({ type: 'warning', message: '你沒有修改已落單品項數量的權限' })
        this.qtyPanel.show = false
        return
      }
      const n = parseFloat(this.qtyPanel.value)
      if (!n || n <= 0) {
        this.$message({ type: 'warning', message: '數量必須大於 0' })
        return
      }
      const newCart = this.cart.slice()
      newCart[idx] = Object.assign({}, newCart[idx], { count: n })
      this.refreshItem(newCart[idx])
      this.$set(this.carts, this.cartKey, newCart)
      this.qtyPanel = { show: false, index: null, value: '' }
      this.$message({ type: 'success', message: item.name + ' 數量改為 ' + n })
    },
    openItemDialog (index) {
      const item = this.cart[index]
      this.syncItemEditLeft()
      this._itemEditOriginalMods = ((item && item.mods) || []).slice()
      this.itemDialog = { show: true, index, mods: (item.mods || []).slice(), customMod: '' }
    },
    syncItemEditLeft () {
      const el = this.$refs.foodZone || document.querySelector('.food-zone, .right-panel')
      if (el) document.documentElement.style.setProperty('--item-edit-left', Math.round(el.getBoundingClientRect().left) + 'px')
    },
    editItemMods (index) {
      const item = this.cart[index]
      if (item && item.sent) {
        this.$message({ type: 'warning', message: '已落單品項不能加改碼' })
        return
      }
      this.openItemDialog(index)
    },
    removeItemMod (index, mi) {
      const item = this.cart[index]
      if (!item) return
      if (item.sent) {
        this.$message({ type: 'warning', message: '已落單品項不能改改碼' })
        return
      }
      const newCart = this.cart.slice()
      const newItem = Object.assign({}, item)
      const mods = (item.mods || []).slice()
      mods.splice(mi, 1)
      newItem.mods = mods
      this.refreshItem(newItem)
      newCart[index] = newItem
      this.$set(this.carts, this.cartKey, newCart)
    },
    onNameClick (index) {
      const item = this.cart[index]
      if (this.pendingItemDiscount) {
        this.toggleDiscountSelect(index)
        return
      }
      if (item && item.comboId) {
        this.selectCartItem(index)
        return
      }
      this.editItemMods(index)
    },
    openComboItemDialog (index, ci) {
      const item = this.cart[index]
      const c = item && item.contents && item.contents[ci]
      if (!c) return
      if (item.sent) {
        this.$message({ type: 'warning', message: '已落單套餐貨品不能加改碼' })
        return
      }
      this.selectedCartIndex = -1
      this.selectedContentKey = index + ':' + ci
      if (!this.itemModAvailable(index, ci)) return
      this.syncItemEditLeft()
      this._itemEditOriginalMods = ((c && c.mods) || []).slice()
      this.itemDialog = { show: true, index, contentIndex: ci, mods: (c.mods || []).slice(), customMod: '' }
    },
    itemModAvailable (index, ci) {
      const item = this.cart[index]
      if (!item) return false
      let cats = []
      if (ci != null && item.contents && item.contents[ci]) {
        const c = item.contents[ci]
        cats = (c.modCategories && c.modCategories.length) ? c.modCategories : ((this.commodityFood(c.commodityId || c._id) || {}).modCategories || [])
      } else {
        cats = (item && item.modCategories) ? item.modCategories : []
      }
      if (!cats.length) return false
      const set = {}
      cats.forEach(c => { set[c] = true })
      return this.modCodeList.some(m => set[m.category])
    },
    hasMandatoryModCategory (item) {
      const cats = (item && item.modCategories) || []
      if (!cats.length) return false
      const items = this.modCodeList.filter(m => cats.indexOf(m.category) >= 0)
      if (!items.length) return false
      return this.modCodeCategories.some(c => {
        if (!c.mandatory || cats.indexOf(c.name) < 0) return false
        // 有指定貨品時，只有這些貨品會自動彈出
        if (Array.isArray(c.commodityIds) && c.commodityIds.length) {
          return c.commodityIds.some(id => String(id) === String(item._id))
        }
        return true
      })
    },
    autoOpenMandatoryMods (index) {
      const item = this.cart[index]
      if (this.hasMandatoryModCategory(item)) this.openItemDialog(index)
    },
    modNames (mods) {
      return (mods || []).map(m => {
        if (typeof m === 'string') return m
        if (!m) return ''
        return m.name || ''
      }).filter(Boolean)
    },
    applyCategoryOrder (list) {
      const raw = list || []
      const cfg = Array.isArray(this.categoryOrder) ? this.categoryOrder : []
      if (!cfg.length) return raw
      const seen = {}
      const out = []
      cfg.forEach(c => {
        const item = raw.find(x => String(x._id) === String(c.id))
        if (item && c.visible !== false) {
          seen[String(item._id)] = true
          const copy = Object.assign({}, item)
          if (c.label) copy.name = c.label
          copy._page = c.page > 0 ? c.page : 0
          copy._fs = Number(c.fontSize) || 0
          copy._w = Number(c.width) || 0
          copy._h = Number(c.height) || 0
          out.push(copy)
        }
      })
      raw.forEach(item => {
        if (!seen[String(item._id)]) out.push(item)
      })
      return out
    },
    openCategory (c) {
      if (!c) return
      this.activeCategory = String(c._id)
    },
    goUpCategory () {
      const cur = this.categoryById[this.activeCategory]
      if (!cur) { this.activeCategory = ''; return }
      const pid = this.parentOf[String(cur._id)]
      this.activeCategory = pid ? String(pid) : ''
    },
    slotBadge (c) {
      return c && c.slotActive ? c.slotName : ''
    },
    catPillStyle (c) {
      const cat = this.catBtnSettings || {}
      const fs = (c && c._fs > 0) ? c._fs : (cat.fontSize || 13)
      const h = (c && c._h > 0) ? c._h : (cat.height || 40)
      const maxSpan = Math.max(1, this.catCols || 4)
      const span = (c && c._w > 0) ? Math.max(1, Math.min(maxSpan, Math.floor(c._w))) : 1
      const size = {
        fontSize: fs + 'px',
        height: h + 'px',
        lineHeight: h + 'px'
      }
      if (span > 1) size.gridColumn = 'span ' + span
      const colorFrom = c && c.colorFrom
      const colorTo = c && c.colorTo
      if (colorFrom && colorTo) {
        return Object.assign(size, {
          background: `linear-gradient(145deg, #fff, ${colorFrom})`,
          borderColor: colorTo,
          color: '#1e293b',
          boxShadow: `0 1px 4px ${colorTo}40`
        })
      }
      return Object.assign(size, {
        background: 'linear-gradient(145deg, #f8fbff, #dbe7f5)',
        borderColor: '#b9cde5',
        color: '#334155',
        boxShadow: '0 1px 4px rgba(31,55,88,.08)'
      })
    },
    catTileStyle (c) {
      const colorFrom = c && c.colorFrom
      const colorTo = c && c.colorTo
      const textColor = (c && c.textColor) || '#ffffff'
      if (colorFrom && colorTo) {
        return {
          background: `linear-gradient(145deg, ${colorFrom}, ${colorTo})`,
          borderColor: colorTo,
          color: textColor
        }
      }
      return {
        background: 'linear-gradient(145deg, #64748b, #475569)',
        borderColor: '#475569',
        color: '#ffffff'
      }
    },
    foodBtnStyle () {
      const g = this.categoryById[this.activeCategory]
      const colorFrom = g && g.colorFrom
      const colorTo = g && g.colorTo
      if (!colorFrom || !colorTo) return {}
      return {
        background: `linear-gradient(145deg, #fff, ${colorFrom})`,
        borderColor: colorTo,
        boxShadow: `0 1px 3px ${colorTo}20`
      }
    },
    recalcComboPrice (item) {
      const base = item.comboSnapshot && item.comboSnapshot.price != null ? Number(item.comboSnapshot.price) : 0
      let extra = 0
      const entered = {}
      ;(item.contents || []).forEach(c => {
        extra += Number(c.upgradePrice || 0)
        extra += (c.mods || []).reduce((s, m) => s + (m && m.price ? Number(m.price) : 0), 0)
        if (c.gi != null) entered[c.gi] = true
      })
      const groups = (item.comboSnapshot && item.comboSnapshot.groups) || []
      groups.forEach((g, gi) => {
        if (entered[gi] && Number(g.groupPrice) > 0) extra += Number(g.groupPrice)
      })
      item.price = Math.round((base + extra) * 100) / 100
    },
    applyItemMods (mods) {
      const newCart = this.cart.slice()
      const item = newCart[this.itemDialog.index]
      const ci = this.itemDialog.contentIndex
      if (item) {
        const newItem = Object.assign({}, item)
        if (ci != null && newItem.contents && newItem.contents[ci]) {
          const newContents = newItem.contents.slice()
          newContents[ci] = Object.assign({}, newContents[ci], { mods: (mods || []).slice() })
          newItem.contents = newContents
          this.recalcComboPrice(newItem)
        } else {
          newItem.mods = (mods || []).slice()
        }
        this.refreshItem(newItem)
        newCart[this.itemDialog.index] = newItem
      }
      this.$set(this.carts, this.cartKey, newCart)
    },
    previewItemMods (mods) {
      this.applyItemMods(mods)
    },
    confirmItemDialog (mods) {
      this.applyItemMods(mods)
      this.itemDialog.show = false
    },
    onCancelItemDialog () {
      this.applyItemMods(this._itemEditOriginalMods || [])
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
    clearWholeDiscount () {
      this.orderDiscount = 0
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
      this.discountSelectedIndexes = []
      this.itemDiscountDialog.show = false
      this.$message({ type: 'info', message: '請點選要套用折扣的品項' })
    },
    clearItemDiscount () {
      this.pendingItemDiscount = null
      this.discountSelectedIndexes = []
      this.itemDiscountDialog = { show: false, pct: 0, amount: 0, free: false }
      this.$message({ type: 'info', message: '已取消項目折扣' })
    },
    toggleDiscountSelect (index) {
      const set = new Set(this.discountSelectedIndexes)
      if (set.has(index)) set.delete(index)
      else set.add(index)
      this.discountSelectedIndexes = Array.from(set)
    },
    applyDiscountToSelected () {
      if (!this.pendingItemDiscount) return
      if (!this.discountSelectedIndexes.length) {
        this.$message({ type: 'warning', message: '請先點選要套用折扣的品項' })
        return
      }
      this.discountSelectedIndexes.forEach(index => this.applyItemDiscount(index))
      this.discountSelectedIndexes = []
      this.pendingItemDiscount = null
      this.$message({ type: 'success', message: '已套用折扣' })
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
    cancelItemDiscount (index) {
      const item = this.cart[index]
      if (!item) return
      item.discount = 1
      item.free = false
      item.customPrice = 0
      this.refreshItem(item)
      this.$message({ type: 'success', message: '已取消品項折扣' })
    },
    checkMandatory () {
      if (!this.teaChargesRequired) return true
      const has = (this.cart || []).some(i => i.mandatory)
      if (has) return true
      if (this.requiredCategoryId) this.activeCategory = String(this.requiredCategoryId)
      this.$alert('<div class="mandatory-big">未入茶芥</div>', '提示', {
        dangerouslyUseHTMLString: true,
        customClass: 'mandatory-alert',
        confirmButtonText: '退出',
        showClose: false,
        closeOnClickModal: false,
        closeOnPressEscape: true
      }).catch(() => {})
      setTimeout(() => this.$msgbox.close(), 2000)
      return false
    },
    syncPaxFromTeaSeat () {
      if (!this.teaSeatSyncPax) return
      const teaSeat = (this.cart || []).filter(i => i.mandatory).reduce((sum, i) => sum + (i.count || 0), 0)
      if (teaSeat > 0 && teaSeat !== this.pax) {
        this.pax = teaSeat
        const order = this.currentOrder
        if (order && order._id) {
          this.$axios.post('/api/order/pax', { _id: order._id, pax: teaSeat }).then(() => {
            this.$set(order, 'pax', teaSeat)
          }).catch(() => {})
        }
      }
    },
    openPay () {
      if (!this.cart.length) { this.$message({ type: 'warning', message: '請先點餐' }); return }
      if (!this.checkMandatory()) return
      this.syncPaxFromTeaSeat()
      const defaultMethod = this.payMethods.length ? this.payMethods[0].value : '現金'
      this.payDialog = { show: true, method: defaultMethod, cashStr: '0', change: 0, invoiceNo: '', tip: 0 }
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
    confirmPay () {
      if (this.isCashMethod) {
        let cash = Number(this.payDialog.cashStr || 0)
        if (cash <= 0) cash = this.grandTotal
        if (cash < this.grandTotal) {
          this.$message({ type: 'warning', message: '實收金額不足' }); return
        }
        this.payDialog.cashStr = String(cash)
        this.payDialog.change = Math.round((cash - this.grandTotal) * 100) / 100
      }
      const newItems = this.cart.filter(i => !i.sent)
      const submitItems = this.bundleOn ? this.buildBundleSubmitItems(newItems, this.bundlePlan) : newItems
      const newTotal = Math.max(0, Math.round(submitItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100)
      const submitNew = () => {
        if (!submitItems.length) return Promise.resolve()
        const order = this.mapOrderItems(submitItems)
        return this.$axios.post('/api/order/submit', { deskNo: this.isDineIn ? this.selectedTable : 0, order, remark: this.orderRemark, totalPrice: newTotal, zone: this.selectedZone, source: 'pos', waiter: this.staffInfo.name || this.waiter, terminalCode: this.selectedTerminal, pax: this.pax })
      }
      submitNew()
        .then(() => this.repriceSentAddons(this.bundlePlan.bundles))
        .then(() => this.$axios.get('/api/order/unfinished'))
        .then(r => {
          const os = (r.data || []).filter(o => this.isDineIn ? String(o.deskNo) === String(this.selectedTable) : o.zone === this.selectedZone)
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
          const rounding = Math.round((this.grandTotal - finalTotal) * 100) / 100
          const finishPayload = {
            _id: latest._id,
            totalPrice: finalTotal,
            rounding,
            serviceCharge: this.serviceChargeAmount,
            discount,
            pax: this.pax,
            waiter: this.staffInfo.name || this.waiter,
            cashier: this.staffInfo.name || this.waiter,
            payMethod,
            tip: Math.round((Number(this.payDialog.tip) || 0) * 100) / 100,
            terminalCode: this.selectedTerminal
          }
          return this.$axios.post('/api/order/finish', finishPayload).then(() => {
            return this.$axios.post('/api/order/print', { _id: latest._id, type: 'receipt', invoiceNo, payMethod, printer: this.staffInfo.name || this.waiter, terminalCode: this.selectedTerminal }).catch(() => {})
          }).then(() => latest.orderNo)
        })
        .then(() => {
          const change = (this.isCashMethod && this.payDialog.change > 0) ? `，找零 $${this.payDialog.change}` : ''
          this.$message({ type: 'success', message: `收款完成${change}，收據編號 ${String(this.payDialog.invoiceNo).replace(/^INV-/, '')}` })
          this.payDialog.show = false
          this.clearCart()
          return this.loadUnfinished().then(() => this.loadSettledToday())
        })
        .then(() => {
          this.view = 'board'
          this.selectedTable = null
        })
        .catch(e => { if (e.message !== 'no order') this.$message({ type: 'error', message: '結帳失敗' }) })
    },
    quickCashCheckout () {
      if (!this.cart.length) { this.$message({ type: 'warning', message: '請先點餐' }); return }
      if (!this.checkMandatory()) return
      this.syncPaxFromTeaSeat()
      const defaultMethod = this.payMethods.find(m => /現金|cash/i.test(m.value))
      const payMethodName = defaultMethod ? defaultMethod.value : '現金'
      const newItems = this.cart.filter(i => !i.sent)
      const submitItems = this.bundleOn ? this.buildBundleSubmitItems(newItems, this.bundlePlan) : newItems
      const newTotal = Math.max(0, Math.round(submitItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100)
      const submitNew = () => {
        if (!submitItems.length) return Promise.resolve()
        const order = this.mapOrderItems(submitItems)
        return this.$axios.post('/api/order/submit', {
          deskNo: this.isDineIn ? this.selectedTable : 0,
          order,
          remark: this.orderRemark,
          totalPrice: newTotal,
          zone: this.selectedZone,
          source: 'pos',
          waiter: this.staffInfo.name || this.waiter,
          terminalCode: this.selectedTerminal
        })
      }
      submitNew()
        .then(() => this.repriceSentAddons(this.bundlePlan.bundles))
        .then(() => this.$axios.get('/api/order/unfinished'))
        .then(r => {
          const os = (r.data || []).filter(o => this.isDineIn ? String(o.deskNo) === String(this.selectedTable) : o.zone === this.selectedZone)
          return os.length ? os[0] : null
        })
        .then(latest => {
          if (!latest) throw new Error('no order')
          const invoiceNo = 'INV-' + latest.orderNo
          const discount = Math.round((this.orderDiscount || 0) * 100) / 100
          const discounted = Math.round((latest.totalPrice - discount) * 100) / 100
          const finalTotal = Math.round((discounted + this.serviceChargeAmount) * 100) / 100
          const rounding = Math.round((this.grandTotal - finalTotal) * 100) / 100
          return this.$axios.post('/api/order/finish', {
            _id: latest._id,
            totalPrice: finalTotal,
            rounding,
            serviceCharge: this.serviceChargeAmount,
            discount,
            pax: this.pax,
            waiter: this.staffInfo.name || this.waiter,
            cashier: this.staffInfo.name || this.waiter,
            payMethod: payMethodName,
            terminalCode: this.selectedTerminal
          }).then(() => this.$axios.post('/api/order/print', {
            _id: latest._id,
            type: 'receipt',
            invoiceNo,
            payMethod: payMethodName,
            printer: this.staffInfo.name || this.waiter,
            terminalCode: this.selectedTerminal
          }).catch(() => {})).then(() => latest.orderNo)
        })
        .then(orderNo => {
          this.$message({ type: 'success', message: `現金結帳成功，訂單 ${orderNo}` })
          this.clearCart()
          return this.loadUnfinished().then(() => this.loadSettledToday())
        })
        .then(() => { this.view = 'board'; this.selectedTable = null })
        .catch(e => { if (e.message !== 'no order') this.$message({ type: 'error', message: '現金結帳失敗' }) })
    },
    openMerge () {
      this.splitMoves = {}
      this.splitLeftSel = []
      this.splitRightSel = []
      this.tableDialog = { show: true, mode: 'merge', title: '合拼枱', fromTable: null, toTable: null, padValue: '' }
    },
    openSplit () {
      this.splitMoves = {}
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
      const order = this.currentOrder ? (this.currentOrder.order || []) : []
      this.splitLeftSel.forEach(i => {
        if (!order[i]) return
        this.$set(this.splitMoves, i, order[i].count || 1)
      })
      this.splitLeftSel = []
    },
    moveLeft () {
      this.splitRightSel.forEach(i => {
        this.$delete(this.splitMoves, i)
      })
      this.splitRightSel = []
    },
    moveAllRight () {
      const order = this.currentOrder ? (this.currentOrder.order || []) : []
      order.forEach((item, i) => {
        this.$set(this.splitMoves, i, item.count || 1)
      })
      this.splitLeftSel = []
    },
    incSplitQty (i) {
      const order = this.currentOrder ? (this.currentOrder.order || []) : []
      if (!order[i]) return
      const max = order[i].count || 1
      const cur = this.splitMoves[i] || 0
      this.$set(this.splitMoves, i, Math.min(cur + 1, max))
    },
    decSplitQty (i) {
      const cur = this.splitMoves[i] || 0
      if (cur <= 1) this.$delete(this.splitMoves, i)
      else this.$set(this.splitMoves, i, cur - 1)
    },
    unitPrice (item) {
      if (item.free) return 0
      const base = item.customPrice > 0 ? item.customPrice : (item.price || 0)
      return Math.round(base * (item.discount || 1) * 100) / 100
    },
    itemLineTotal (item, count) {
      return Math.round(this.unitPrice(item) * (count || 0) * 100) / 100
    },
    onPadInput (which, v) {
      if (which === 'transfer') {
        this.transferDialog.padValue = v
        this.transferDialog.toTable = v === '' ? null : v
      } else {
        this.tableDialog.padValue = v
        if (this.tableDialog.mode === 'merge') this.tableDialog.fromTable = v === '' ? null : v
        else this.tableDialog.toTable = v === '' ? null : v
      }
    },
    tableExists (no) {
      return this.tables.some(t => String(t.no) === String(no))
    },
    reloadCurrentCart () {
      const no = this.selectedTable
      const unsent = (this.carts[no] || []).filter(i => !i.sent)
      const items = []
      this.unfinishedOrders.filter(o => String(o.deskNo) === String(no)).forEach(o => {
        (o.order || []).forEach(item => {
          const ni = {
            _id: item._id || item.name,
            name: item.name,
            name2: item.name2 || '',
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
        this.$axios.post('/api/order/transfer', { from: this.selectedTable, to, action: 'merge' })
          .then(() => this.loadTables())
          .catch(() => {})
        this.tableDialog.show = false
        this.backToBoard()
      } else {
        const to = this.tableDialog.toTable
        const moves = Object.keys(this.splitMoves).map(i => ({ i: Number(i), count: this.splitMoves[i] }))
        if (to === null || to === undefined) { this.$message({ type: 'warning', message: '請輸入目標枱號' }); return }
        if (!this.tableExists(to)) { this.$message({ type: 'warning', message: `枱號 ${to} 不存在` }); return }
        if (to === this.selectedTable) { this.$message({ type: 'warning', message: '不能分單到目前枱號' }); return }
        if (!moves.length) { this.$message({ type: 'warning', message: '請先將品項移到新枱' }); return }
        this.$axios.post('/api/order/split', { from: this.selectedTable, to, moves })
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
      this.addTableDialog.no = v === '' ? null : v
    },
    confirmAddTable () {
      const no = this.addTableDialog.no
      if (!no) { this.$message({ type: 'warning', message: '請輸入枱號' }); return }
      if (this.tables.some(t => String(t.no) === String(no))) { this.$message({ type: 'warning', message: `枱號 ${no} 已存在` }); return }
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
      this.$axios.post('/api/hold/hold', {
        zone: this.selectedZone,
        deskNo: this.isDineIn ? this.selectedTable : '',
        items: JSON.parse(JSON.stringify(unsent)),
        remark: this.orderRemark,
        terminalCode: this.selectedTerminal
      })
        .then(() => {
          // 移除已掛單的未送品項
          const remaining = this.cart.filter(i => i.sent)
          this.$set(this.carts, this.cartKey, remaining)
          this.orderRemark = ''
          this.loadHolds()
          this.$message({ type: 'success', message: '已掛單，可稍後叫回' })
        })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '掛單失敗' }))
    },
    openHold () {
      this.loadHolds()
      this.holdDialog.show = true
    },
    recallHold (index) {
      const h = this.holdList[index]
      if (!h) return
      this.$axios.post('/api/hold/recall', { id: h._id, terminalCode: this.selectedTerminal })
        .then(() => this.applyRecalledHold(h))
        .catch(err => {
          this.loadHolds()
          this.$message({ type: 'warning', message: err.response ? err.response.data : '叫回失敗' })
        })
    },
    applyRecalledHold (h) {
      // 若目標枱/單別不同，切換過去
      if (h.deskNo) {
        this.selectedZone = '堂食'
        this.selectedTable = h.deskNo
        this.onTableChange()
        this.lockTable(h.deskNo)
      } else {
        this.selectedZone = h.zone
        const key = this.isDelivery ? 'delivery' : 'takeaway'
        if (!this.carts[key]) this.$set(this.carts, key, [])
      }
      const target = this.cart
      ;(h.items || []).forEach(item => {
        const exist = target.find(i => i.name === item.name && JSON.stringify(i.mods || []) === JSON.stringify(item.mods || []))
        if (exist) exist.count += item.count
        else target.push(JSON.parse(JSON.stringify(item)))
      })
      if (h.remark) this.orderRemark = h.remark
      this.loadHolds()
      this.holdDialog.show = false
      this.view = 'order'
      this.$message({ type: 'success', message: '已叫回掛單' })
    },
    delHold (index) {
      const h = this.holdList[index]
      if (!h) return
      this.$axios.post('/api/hold/delete', { id: h._id })
        .then(() => {
          this.holdList.splice(index, 1)
          this.$message({ type: 'success', message: '已刪除掛單' })
        })
        .catch(err => {
          this.loadHolds()
          this.$message({ type: 'error', message: err.response ? err.response.data : '刪除失敗' })
        })
    },
    formatTime (d) {
      if (!d) return '--'
      const t = new Date(d)
      const p = n => (n < 10 ? '0' + n : '' + n)
      return `${p(t.getHours())}:${p(t.getMinutes())}`
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
      this.reportDialog = { show: true, type: 'cashier', scope: 'all', dateRange: [td, td], slot: 'all', result: null, selecting: null, dateMode: 'today', mode: 'entry', printing: false, department: 'all', category: 'all', pluFrom: '', pluTo: '', detail: 'detail' }
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
      const isClosed = this.dayReportDialog.result && this.dayReportDialog.result.status === 'closed'
      const msg = isClosed ? '本營業日已結算過，再次結算將覆蓋上次結算數據，確定要繼續嗎？' : '確定要進行每日結算？'
      this.$confirm(msg, '每日結算確認', { type: 'warning' }).then(() => {
        this.dayReportDialog.loading = true
        this.$axios.post('/api/businessday/close', {
          startingCash: Number(this.dayReportDialog.startingCash) || 0,
          countedCash: Number(this.dayReportDialog.countedCash) || 0,
          remark: this.dayReportDialog.remark,
          staffName: this.staffInfo.name || '',
          staffNo: this.staffInfo.no || ''
        }).then(res => {
          this.$message({ type: 'success', message: res.data.message || '每日結算成功！' })
          this.loadBizDayStatus()
          this.dayReportDialog.show = false
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
      if (b.id === 'releaseTable' && this.releaseTableMode) return '解除枱號中…'
      if (b.id === 'copyOrder' && this.copyOrderMode) return '複印單據中…'
      if (b.id === 'bundle' && this.bundleOn) return `撞餐 -$${this.bundleSavings.toFixed(2)}`
      return b.label
    },
    btnType (b) {
      if (b.id === 'itemDiscount' && this.pendingItemDiscount) return 'warning'
      if (b.id === 'releaseTable' && this.releaseTableMode) return 'danger'
      if (b.id === 'copyOrder' && this.copyOrderMode) return 'warning'
      if (b.id === 'bundle' && this.bundleOn) return 'success'
      return b.type || ''
    },
    btnDisabled (b) {
      if (b.id !== 'print') return false
      // 印單包含送單：購物車有未送出品項時，即使該枱尚無未結訂單也可按印單（會先送單）
      if (this.cart.some(i => !i.sent)) return false
      const deskNo = this.isDineIn ? this.selectedTable : 0
      const orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(deskNo))
      if (!orders.length) return true
      // 達到 reprintMinLevel 等級以上可重複印單；以下只可印一次
      if ((this.staffInfo.permissionLevel || 1) >= this.reprintMinLevel) return false
      return !!orders[0].printed
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
      return !this.unfinishedOrders.some(o => String(o.deskNo) === String(t.no) && !o.printed)
    },
    confirmBatchPrint () {
      const selected = this.boardTables.filter(t => this.batchChecked[t.no])
      if (!selected.length) { this.$message({ type: 'warning', message: '請至少勾選一張枱' }); return }
      const pending = selected
        .map(t => this.unfinishedOrders.find(o => String(o.deskNo) === String(t.no) && !o.printed))
        .filter(Boolean)
      if (!pending.length) { this.$message({ type: 'warning', message: '所選枱台沒有可列印的未印訂單' }); return }
      Promise.all(pending.map(o =>
        this.$axios.post('/api/order/print', { _id: o._id, type: 'print', printer: this.staffInfo.name || this.waiter, terminalCode: this.selectedTerminal })
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
        case 'copyOrder': this.toggleCopyOrderMode(); break
        case 'hold': this.holdOrder(); break
        case 'recall': this.openHold(); break
        case 'print': this.directPayActive ? this.openPay() : this.printTicket('print'); break
        case 'chase': this.showChaseDialog(); break
        case 'serving': this.directPayActive ? this.openPay() : this.serveTicket(); break
        case 'qrcode': this.printTicket('qrcode'); break
        case 'printTableQr': this.printTableQr(); break
        case 'wholeDiscount': this.openWholeDiscount(); break
        case 'itemDiscount': this.openItemDiscount(); break
        case 'clear': this.clearNewItems(); break
        case 'submit': this.submitOrder(); break
        case 'send': this.directPayActive ? this.openPay() : this.sendOrder(); break
        case 'checkout': this.openPay(); break
        case 'cashCheckout': this.quickCashCheckout(); break
        case 'soldout': this.openSoldOut(); break
        case 'refund': this.openUnsettleAuth(); break
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
        case 'login': this.login(); break
        case 'logoutBtn': this.logout(); break
        case 'changePwd': this.openChangePwd(); break
        case 'dayReport': this.openDayReport(); break
        case 'changePay':
          if (this.viewingSettled && this.viewingSettledOrder) {
            this.openChangePay(this.viewingSettledOrder)
          } else {
            this.openChangePayList()
          }
          break
        case 'releaseTable': this.toggleReleaseTableMode(); break
        case 'leaveApp': this.leaveApp(); break
        case 'paidOut': this.openCashMove('paidOut'); break
        case 'received': this.openCashMove('received'); break
        case 'changePrice': this.openChangePrice(); break
        case 'showDetail': this.toggleShowDetail(); break
        case 'refreshPos': this.reloadPos(); break
        case 'pantry': this.openPantryMessage(); break
        case 'deptSplit': this.openDeptSplit(); break
        case 'centralCheckout': this.printTicket('print', undefined, true); break
        case 'bundle': this.toggleBundle(); break
      }
    },
    toggleBundle () {
      if (!this.bundleEnabled) { this.$message({ type: 'warning', message: '撞餐功能未開啟，請到後台 POS 設定開啟' }); return }
      if (!this.bundlePlan.bundles.length) { this.$message({ type: 'info', message: '目前沒有可撞餐的品項組合' }); return }
      this.bundleApplied = !this.bundleApplied
      if (this.bundleApplied) {
        this.$message({ type: 'success', message: `已撞餐，節省 $${this.bundlePlan.totalSavings.toFixed(2)}` })
      } else {
        this.$message({ type: 'info', message: '已取消撞餐' })
      }
    },
    autoDetectBundle (prevCount) {
      if (!this.bundleEnabled || this.bundleMode === 'manual') return
      const plan = computeBundles(this.cart.filter(i => !i.sent), this.bundleCombos, { bundleEnabled: true, bundleRule: this.bundleRule })
      if (plan.bundles.length > prevCount) {
        this.bundleApplied = true
        this.$message({ type: 'info', message: `已自動撞餐，共省 $${plan.totalSavings.toFixed(2)}` })
      }
    },
    buildBundleSubmitItems (newItems, plan) {
      if (!plan || !plan.bundles.length) return newItems
      const out = []
      const consumed = {}
      ;(plan.bundles || []).forEach(b => {
        const combo = (this.bundleCombos || []).find(c => String(c._id) === String(b.comboId))
        if (!combo) return
        if (combo._matchingRule) {
          ;(this.buildMatchingRuleSubmitItems(combo, b, newItems) || []).forEach(it => out.push(it))
        } else {
          const item = this.buildComboItemFromBundle(combo, b, newItems)
          if (item) out.push(item)
        }
        ;(b.items || []).forEach(x => { consumed[x.index] = (consumed[x.index] || 0) + (x.qty || 1) })
      })
      ;(newItems || []).forEach((it, index) => {
        const used = consumed[index] || 0
        const total = it.count || 1
        const remaining = total - used
        if (remaining <= 0) return
        if (remaining === total) out.push(it)
        else {
          const copy = Object.assign({}, it, { count: remaining })
          this.refreshItem(copy)
          out.push(copy)
        }
      })
      const merged = this.mergeSameItems(out)
      console.log('[POS] buildBundleSubmitItems', {
        bundleOn: this.bundleOn,
        bundleCount: (plan && plan.bundles) ? plan.bundles.length : 0,
        newItems: newItems.map(i => ({ n: i.name, c: i.count, id: String(i._id || '').slice(-6), p: i.price, bp: !!i.bundlePrice, bg: String(i.bundleGroupId || '').slice(-6) })),
        out: out.map(i => ({ n: i.name, c: i.count, id: String(i._id || '').slice(-6), p: i.price, bp: !!i.bundlePrice, bg: String(i.bundleGroupId || '').slice(-6) })),
        merged: merged.map(i => ({ n: i.name, c: i.count, id: String(i._id || '').slice(-6), p: i.price, bp: !!i.bundlePrice, bg: String(i.bundleGroupId || '').slice(-6) }))
      })
      return merged
    },
    // 合併相同品項（同 _id、無改碼、無套餐內容、同單價/跟餐價）為一列，避免撞餐拆成多列
    mergeSameItems (items) {
      const out = []
      const indexByKey = {}
      items.forEach(it => {
        const hasMods = it.mods && it.mods.length
        const hasContents = it.contents && it.contents.length
        if (hasMods || hasContents) { out.push(it); return }
        const key = [
          String(it._id || ''),
          Number(it.price) || 0,
          it.bundlePrice ? '1' : '0',
          String(it.bundleGroupId || ''),
          Number(it.customPrice) || 0,
          it.free ? '1' : '0',
          Number(it.discount) || 1
        ].join('|')
        const idx = indexByKey[key]
        if (idx === undefined) {
          indexByKey[key] = out.length
          out.push(Object.assign({}, it, { count: it.count || 1 }))
        } else {
          out[idx].count = (out[idx].count || 0) + (it.count || 1)
          this.refreshItem(out[idx])
        }
      })
      return out
    },
    buildMatchingRuleSubmitItems (combo, bundle, newItems) {
      const out = []
      ;(bundle.items || []).forEach(x => {
        const src = newItems[x.index]
        if (!src) return
        const group = (combo.groups || [])[x.gi]
        const comboItem = (group && group.items) ? group.items[x.ii] : null
        const upgrade = (x.upgradePrice !== undefined && x.upgradePrice !== null)
          ? Number(x.upgradePrice) || 0
          : Number(comboItem && comboItem.upgradePrice) || 0
        const copy = Object.assign({}, src, { count: x.qty || 1 })
        if (x.gi !== 0) {
          // 跟餐：改收跟餐價（主食保留原價）；記下原價供分單時復原
          copy.bundleOrigPrice = Number(src.price) || 0
          copy.price = upgrade
          copy.customPrice = 0
          copy.bundlePrice = true
        } else {
          // 主食：標記為撞餐主食，供分單時一配一對照
          copy.bundleMain = true
        }
        this.refreshItem(copy)
        out.push(copy)
      })
      return out
    },
    buildComboItemFromBundle (combo, bundle, newItems) {
      const contents = []
      const snapshotGroups = []
      const isMatchingRule = !!combo._matchingRule
      let extraTotal = 0
      ;(combo.groups || []).forEach((group, gi) => {
        const snapshotItems = []
        ;(bundle.items || []).forEach(x => {
          if (x.gi !== gi) return
          const src = newItems[x.index]
          if (!src) return
          const comboItem = (group.items || [])[x.ii]
          const upgrade = Number(comboItem && comboItem.upgradePrice) || 0
          const srcPrice = Number(src.price) || 0
          const mods = (src.mods || []).slice()
          const modsExtra = mods.reduce((s, m) => s + (m && m.price ? Number(m.price) : 0), 0)
          const qty = x.qty || 1
          for (let q = 0; q < qty; q++) {
            extraTotal += upgrade + modsExtra
            let contentPrice = srcPrice + upgrade
            let priceText = upgrade > 0 ? '+$' + upgrade : '$0'
            if (isMatchingRule) {
              contentPrice = gi === 0 ? srcPrice : upgrade
              priceText = gi === 0 ? ('$' + srcPrice) : ('跟餐價 $' + upgrade)
            }
            snapshotItems.push({ commodityId: src._id || '', name: src.name, price: srcPrice, upgradePrice: upgrade, modifiers: ((comboItem && comboItem.modifiers) || []).slice(), substitutes: ((comboItem && comboItem.substitutes) || []).slice(), modCategories: (src.modCategories || []).slice(), itemIndex: x.ii })
            contents.push({ _id: src._id || '', commodityId: src._id || '', name: src.name, price: contentPrice, upgradePrice: upgrade, priceText, count: 1, station: src.station || '', stations: src.stations || [], mods, modCategories: (src.modCategories || []).slice(), gi, ii: x.ii })
          }
        })
        if (snapshotItems.length) {
          if (Number(group.groupPrice) > 0) extraTotal += Number(group.groupPrice)
          snapshotGroups.push({ name: group.name, station: group.station || '', min: group.min || 0, max: group.max || 1, allowRepeat: !!group.allowRepeat, fixed: !!group.fixed, groupPrice: Number(group.groupPrice) || 0, items: snapshotItems })
        }
      })
      const item = {
        _id: combo._id,
        name: combo.name,
        price: Math.round(((combo.price || 0) + extraTotal) * 100) / 100,
        count: 1,
        mods: [],
        discount: 1,
        free: false,
        customPrice: 0,
        contents,
        comboId: combo._id,
        comboName: combo.name,
        comboSnapshot: { type: combo.type, price: combo.price, groups: snapshotGroups },
        noPrintComboName: !!combo.noPrintComboName,
        departmentSplit: (combo.departmentSplit || []).slice(),
        showItems: combo.showItems !== false,
        sent: false
      }
      this.refreshItem(item)
      return item
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
    printTableQr () {
      if (!this.isDineIn || !this.selectedTable) {
        this.$message({ type: 'warning', message: '請先選擇枱號' })
        return
      }
      this.$axios.post('/api/order/tableQr/print', { deskNo: String(this.selectedTable), terminalCode: this.selectedTerminal })
        .then(() => {
          this.$message({ type: 'success', message: '點餐碼已列印（結帳後才失效）' })
        })
        .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '印點餐碼失敗' }) })
    },
    openCashMove (type) {
      this.cashMoveDialog = { show: true, type, amount: '', reason: '', loading: false }
    },
    loadDepartments () {
      return this.$axios.get('/api/department/list').then(res => {
        this.departments = (res.data || []).filter(d => d.active !== false && d.showInSplit !== false)
      }).catch(() => { this.departments = [] })
    },
    openDeptSplit () {
      const combos = this.cart
        .map((item, i) => ({ key: i, item, name: item.name, count: item.count || 1, lineTotal: this.itemLineTotal(item, item.count || 1) }))
        .filter(c => c.item && c.item.comboId)
      if (!combos.length) {
        this.$message({ type: 'warning', message: '目前點餐單內沒有套餐可分帳' })
        return
      }
      if (!this.departments.length) {
        this.$message({ type: 'warning', message: '尚未設定部門，請先到後台新增部門' })
        return
      }
      this.deptSplitDialog = { show: true, title: '大單分帳（點餐單）', source: 'cart', orderNo: '', combos }
    },
    openDeptSplitOrder (row) {
      if (!this.canModifySettled()) return
      const order = this.settledTodayOrders.find(o => o.orderNo === row.orderNo || o._id === row._id)
      if (!order) {
        this.$message({ type: 'warning', message: '找不到該單據資料' })
        return
      }
      const combos = (order.order || [])
        .map((item, i) => ({ key: i, item, name: item.name, count: item.count || 1, lineTotal: this.itemLineTotal(item, item.count || 1) }))
        .filter(c => c.item && c.item.comboId)
      if (!combos.length) {
        this.$message({ type: 'warning', message: '該單據內沒有套餐可分帳' })
        return
      }
      this.deptSplitDialog = { show: true, title: '大單分帳（' + (order.orderNo || '') + '）', source: 'order', orderNo: order.orderNo, combos }
    },
    confirmDeptSplit (payload) {
      const dialog = this.deptSplitDialog
      if (dialog.source === 'order') {
        this.$axios.post('/api/order/setDeptSplit', { orderNo: dialog.orderNo, itemIndex: payload.key, departmentSplit: payload.departmentSplit })
          .then(res => {
            this.$message({ type: 'success', message: res.data || '部門分帳已儲存' })
            this.loadSettledToday()
          })
          .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '部門分帳失敗' }))
        return
      }
      const item = this.cart[payload.key]
      if (!item) return
      this.$set(item, 'departmentSplit', payload.departmentSplit)
      if (item._orderNo && item._orderIdx != null) {
        this.$axios.post('/api/order/setDeptSplit', { orderNo: item._orderNo, itemIndex: item._orderIdx, departmentSplit: payload.departmentSplit })
          .then(res => this.$message({ type: 'success', message: res.data || '部門分帳已儲存' }))
          .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '部門分帳失敗' }))
      } else {
        this.$message({ type: 'success', message: '部門分帳已設定（送單時一併儲存）' })
      }
    },
    openPantryMessage () {
      this.pantryDialog = { show: true, message: '', loading: false }
    },
    sendPantryMessage () {
      const message = (this.pantryDialog.message || '').trim()
      if (!message) {
        this.$message({ type: 'warning', message: '請輸入訊息內容' })
        return
      }
      const deskNo = this.isDineIn ? this.selectedTable : 0
      const orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(deskNo))
      const latest = orders[0]
      this.pantryDialog.loading = true
      this.$axios.post('/api/printer/pantryMessage', {
        message,
        deskNo: this.isDineIn ? this.selectedTable : '',
        orderNo: latest ? latest.orderNo : '',
        waiter: this.staffInfo.name || this.waiter || ''
      }).then(res => {
        this.pantryDialog.show = false
        this.$message({ type: 'success', message: res.data || '班地厘訊息已發送！' })
      }).catch(err => {
        this.$message({ type: 'error', message: (err.response && err.response.data) || '班地厘訊息發送失敗' })
      }).finally(() => { this.pantryDialog.loading = false })
    },
    confirmCashMove () {
      const type = this.cashMoveDialog.type
      const label = type === 'paidOut' ? '代支' : '代收'
      const amount = parseFloat(this.cashMoveDialog.amount)
      if (isNaN(amount) || amount <= 0) {
        this.$message({ type: 'warning', message: '請輸入有效金額' })
        return
      }
      this.cashMoveDialog.loading = true
      this.$axios.post(type === 'paidOut' ? '/api/businessday/paidOut' : '/api/businessday/received', {
        amount: Math.round(amount * 100) / 100,
        reason: (this.cashMoveDialog.reason || '').trim(),
        staffNo: this.staffInfo.no || '',
        staffName: this.staffInfo.name || ''
      }).then(res => {
        this.cashMoveDialog.show = false
        this.$message({ type: 'success', message: (res.data && res.data.message) || (label + '成功') })
        this.openDrawerAfterCash()
      }).catch(err => {
        this.$message({ type: 'error', message: (err.response && err.response.data) || (label + '失敗') })
      }).finally(() => { this.cashMoveDialog.loading = false })
    },
    openDrawerAfterCash () {
      if (!this.selectedTerminal) return
      this.$axios.post('/api/printer/openDrawer', { terminalCode: this.selectedTerminal }).catch(() => {})
    },
    openChangePrice () {
      const idx = this.selectedCartIndex
      if (idx < 0 || !this.cart[idx]) {
        this.$message({ type: 'warning', message: '請先點選清單中的品項' })
        return
      }
      const item = this.cart[idx]
      if (item.sent) {
        this.$message({ type: 'warning', message: '已落單品項不可更改價格' })
        return
      }
      const cur = item.customPrice > 0 ? item.customPrice : (item.price || 0)
      this.priceDialog = { show: true, index: idx, value: String(cur) }
    },
    confirmPrice () {
      const idx = this.priceDialog.index
      if (idx < 0 || !this.cart[idx]) { this.priceDialog.show = false; return }
      const val = parseFloat(this.priceDialog.value)
      if (isNaN(val) || val <= 0) {
        this.$message({ type: 'warning', message: '請輸入有效價格' })
        return
      }
      const nextCart = this.cart.slice()
      const item = Object.assign({}, nextCart[idx], { customPrice: Math.round(val * 100) / 100 })
      this.refreshItem(item)
      nextCart[idx] = item
      this.$set(this.carts, this.cartKey, nextCart)
      this.priceDialog.show = false
      this.$message({ type: 'success', message: '價格已更改' })
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
      const latest = this.settledTodayOrders[0]
      const label = latest ? (latest.orderNo || ('枱 ' + latest.deskNo)) : ''
      const msg = label ? ('確定要重印最近一筆結帳單據（' + label + '）？') : '確定要重印最近一筆結帳單據？'
      this.$confirm(msg, '重印單據', { type: 'warning' }).then(() => {
        this.$axios.post('/api/order/reprint', {})
          .then(res => { this.$message({ type: 'success', message: res.data || '重印成功' }) })
          .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '重印失敗' }) })
      }).catch(() => {})
    },
    scrollOrder (dir) {
      const el = this.$refs.orderList
      if (el) el.scrollBy({ top: dir * 200, behavior: 'smooth' })
    },
    openCallDish () {
      const items = (this.cart || [])
        .map((it, idx) => Object.assign({}, it, { _idx: idx }))
        .filter(it => !it.sent && it.dishStatus !== 'called' && it.dishStatus !== 'served')
      if (!items.length) { this.$message({ type: 'info', message: '沒有可叫起的品項' }); return }
      this.callDishDialog = { show: true, items, checked: [], loading: false }
    },
    submitCallDish () {
      let count = 0
      ;(this.callDishDialog.checked || []).forEach(i => {
        const entry = this.callDishDialog.items[i]
        if (!entry) return
        const cartItem = this.cart[entry._idx]
        if (!cartItem) return
        this.$set(cartItem, 'dishStatus', 'called')
        ;(cartItem.contents || []).forEach(c => {
          if (c.dishStatus !== 'served') this.$set(c, 'dishStatus', 'called')
        })
        count++
      })
      if (!count) { this.callDishDialog.show = false; return }
      this.callDishDialog.show = false
      this.callDishDialog.loading = true
      // 叫起後立即送單：未叫起的品項會列印到廚房，叫起品項只存單不列印
      this.submitUnsent(true).then(ok => {
        if (ok) this.$message({ type: 'success', message: '已叫起 ' + count + ' 道（暫緩出單）' })
      }).finally(() => { this.callDishDialog.loading = false })
    },
    openServeDish () {
      const items = []
      ;(this.cart || []).forEach((it, cartIdx) => {
        if (!it.sent || it.dishStatus !== 'called') return
        if (it.contents && it.contents.length) {
          it.contents.forEach((c, ci) => {
            if (c.dishStatus === 'served') return
            items.push(Object.assign({}, c, { _kind: 'content', _cartIdx: cartIdx, _idx: it._orderIdx, _ci: ci, _orderNo: it._orderNo, _comboName: it.name, count: it.count || 1 }))
          })
        } else {
          items.push(Object.assign({}, it, { _kind: 'item', _cartIdx: cartIdx, _idx: it._orderIdx, _orderNo: it._orderNo }))
        }
      })
      if (!items.length) { this.$message({ type: 'info', message: '沒有已叫起的品項' }); return }
      this.serveDishDialog = { show: true, deskNo: this.selectedTable, items, checked: [], loading: false }
    },
    showChaseDialog () {
      const order = this.currentOrder
      if (!order) { this.$message({ type: 'info', message: '該枱沒有未結訂單' }); return }
      const items = (order.order || []).map((it, idx) => ({ ...it, _idx: idx })).filter(it => it.voidStatus !== 1 && it.dishStatus !== 'served')
      if (!items.length) { this.$message({ type: 'info', message: '沒有可追單的品項' }); return }
      this.chaseDialog = { show: true, deskNo: order.deskNo, items, checked: [], loading: false }
    },
    confirmChase () {
      const realIndexes = this.chaseDialog.checked.map(i => this.chaseDialog.items[i]._idx)
      const order = this.currentOrder
      if (order && order.chasedAt) {
        const t = new Date(order.chasedAt)
        const lastTime = t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0')
        this.chaseDialog.show = false
        this.chaseConfirmDialog = { show: true, deskNo: this.chaseDialog.deskNo, indexes: realIndexes, lastChaseTime: lastTime, loading: false }
        return
      }
      this.doChase(this.chaseDialog.deskNo, realIndexes, 'chaseDialog')
    },
    confirmChaseAgain () {
      this.doChase(this.chaseConfirmDialog.deskNo, this.chaseConfirmDialog.indexes, 'chaseConfirmDialog')
    },
    doChase (deskNo, indexes, loadingKey) {
      this[loadingKey].loading = true
      this.$axios.post('/api/order/chase', { deskNo, indexes })
        .then(res => {
          this.$message({ type: 'success', message: res.data || '追單成功，已列印到後廚' })
          this.chaseDialog.show = false
          this.chaseConfirmDialog.show = false
          this.loadUnfinished()
        })
        .catch(err => { this.$message({ type: 'error', message: (err.response && err.response.data) || '追單失敗' }) })
        .finally(() => { this[loadingKey].loading = false })
    },
    submitServeDish () {
      this.serveDishDialog.loading = true
      const entries = (this.serveDishDialog.checked || [])
        .map(i => this.serveDishDialog.items[i])
        .filter(Boolean)
      const groups = {}
      entries.forEach(entry => {
        const key = entry._orderNo || ('desk:' + this.serveDishDialog.deskNo)
        if (!groups[key]) {
          groups[key] = { orderNo: entry._orderNo || '', deskNo: this.serveDishDialog.deskNo, indexes: [], contents: [] }
        }
        if (entry._kind === 'content') groups[key].contents.push({ idx: entry._idx, ci: entry._ci })
        else groups[key].indexes.push(entry._idx)
      })
      const orders = Object.keys(groups).map(k => groups[k])
      this.$axios.post('/api/order/serveDish', { orders })
        .then(res => {
          this.$message({ type: 'success', message: res.data || '起菜成功，已列印到後廚' })
          this.serveDishDialog.show = false
          entries.forEach(entry => {
            const cartItem = this.cart[entry._cartIdx]
            if (!cartItem) return
            if (entry._kind === 'content') {
              if (cartItem.contents && cartItem.contents[entry._ci]) {
                this.$set(cartItem.contents[entry._ci], 'dishStatus', 'served')
              }
              if (cartItem.contents && cartItem.contents.every(c => c.dishStatus === 'served')) {
                this.$set(cartItem, 'dishStatus', 'served')
              }
            } else {
              this.$set(cartItem, 'dishStatus', 'served')
            }
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
    openUnsettleAuth () {
      if (!this.hasPermission('payment.refund')) {
        this.$message({ type: 'warning', message: '你沒有反結賬權限' })
        return
      }
      this.loadSettledToday().then(() => {
        const current = this.viewingSettledOrder
        this.unsettleAuth = {
          show: true,
          no: '',
          password: '',
          orderNo: current ? (current.orderNo || '') : '',
          loading: false,
          order: current || null
        }
      })
    },
    openRefund () {
      this.refundDialog = { show: true, activeTab: 'void', finished: [] }
      this.loadUnfinished()
      this.$axios.post('/api/order/finished', { index: 1, size: 200 })
        .then(res => { this.refundDialog.finished = (res.data && res.data.result) || [] })
        .catch(() => { this.refundDialog.finished = [] })
    },
    openChangePayList () {
      this.refundDialog = { show: true, activeTab: 'refund', finished: [] }
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
      this.$confirm(this.refundConfirmText(order))
        .then(_ => this.$axios.post('/api/order/refund', { _id: order._id, reason: '' }))
        .then(res => {
          this.$message({ type: 'success', message: res.data })
          this.openRefund()
          this.loadTables()
        })
        .catch(err => { if (err !== 'cancel' && err !== 'close') this.$message({ type: 'error', message: err.response ? err.response.data : '退款失敗' }) })
    },
    promptUnsettle (order) {
      if (!this.hasPermission('payment.refund')) {
        this.$message({ type: 'warning', message: '你沒有反結賬權限' })
        return
      }
      this.unsettleAuth = { show: true, no: '', password: '', orderNo: order.orderNo || '', loading: false, order }
    },
    unsettleLogin () {
      const no = (this.unsettleAuth.no || '').trim()
      if (!no || !this.unsettleAuth.password) {
        this.$message({ type: 'warning', message: '請輸入經理編號與密碼' })
        return
      }
      let targetOrder = this.unsettleAuth.order
      if (!targetOrder) {
        const orderNo = (this.unsettleAuth.orderNo || '').trim()
        if (!orderNo) {
          this.$message({ type: 'warning', message: '請輸入單號' })
          return
        }
        targetOrder = this.settledTodayOrders.find(o => String(o.orderNo) === String(orderNo))
        if (!targetOrder) {
          this.$message({ type: 'error', message: '找不到該已付款訂單' })
          return
        }
      }
      this.unsettleAuth.loading = true
      this.$axios.post('/api/staff/login', { no, password: this.unsettleAuth.password })
        .then(res => {
          if ((res.data.permissionLevel || 1) < 3) {
            this.$message({ type: 'error', message: '需要經理（等級3）以上權限' })
            this.unsettleAuth.loading = false
            return
          }
          const managerToken = res.data.token
          const originalDeskNo = targetOrder.table ? targetOrder.table.no : targetOrder.deskNo
          return this.$axios.post('/api/order/refund', { _id: targetOrder._id, reason: '' }, { headers: { Authorization: managerToken } })
            .then(r => {
              this.unsettleAuth = { show: false, no: '', password: '', orderNo: '', loading: false, order: null }
              this.$message({ type: 'success', message: r.data })
              return this.loadTables().then(() => this.loadSettledToday())
            })
            .then(() => {
              const ref = this.unfinishedOrders.find(o => String(o._id) === String(targetOrder._id))
              const deskNo = ref ? String(ref.deskNo) : String(originalDeskNo)
              this.boardMode = 'grid'
              this.enterTable(deskNo)
            })
        })
        .catch(err => {
          this.unsettleAuth.loading = false
          this.$message({ type: 'error', message: err.response ? err.response.data : '反結賬失敗' })
        })
    },
    refundConfirmText (order) {
      const occupied = this.unfinishedOrders.some(o => String(o.deskNo) === String(order.deskNo))
      if (occupied) return `枱號 ${order.deskNo} 佔用中，將它轉為 Z 枱。確認退款訂單 ${order.orderNo}，金額 $${order.totalPrice} 嗎？`
      return `確認退款訂單 ${order.orderNo}，金額 $${order.totalPrice} 嗎？`
    },
    isZTable (t) {
      return !!(t && t.name && /^\d+Z$/.test(t.name))
    },
    openChangePay (order) {
      if (!this.canModifySettled()) return
      this.changePayDialog = { show: true, orderId: order._id, orderNo: order.orderNo, totalPrice: order.totalPrice, payMethod: order.payMethod || '現金' }
    },
    confirmChangePay () {
      this.$axios.post('/api/order/changePayment', { _id: this.changePayDialog.orderId, payMethod: this.changePayDialog.payMethod })
        .then(() => this.$axios.post('/api/order/print', { _id: this.changePayDialog.orderId, type: 'receipt', invoiceNo: 'INV-' + this.changePayDialog.orderNo, payMethod: this.changePayDialog.payMethod, printer: this.staffInfo.name || this.waiter, terminalCode: this.selectedTerminal }).catch(() => {}))
        .then(() => {
          this.$message({ type: 'success', message: '付款已更改並重印' })
          this.changePayDialog.show = false
          this.openRefund()
        })
        .catch(err => this.$message({ type: 'error', message: err.response ? err.response.data : '更改付款失敗' }))
    },
    printTicket (type, deskNoOverride, central, newCount) {
      if (type === 'print') {
        if (!this.checkMandatory()) return
        this.syncPaxFromTeaSeat()
        // 印單包含送單：購物車有未送出品項時，先送單（自動印廚房單），再印印單小票
        if (this.cart.some(i => !i.sent)) {
          this.submitUnsent(true, false).then(ok => {
            if (ok) this.doPrintTicket(type, deskNoOverride, central, newCount)
          })
          return
        }
      }
      this.doPrintTicket(type, deskNoOverride, central, newCount)
    },
    doPrintTicket (type, deskNoOverride, central, newCount) {
      const deskNo = deskNoOverride !== undefined ? deskNoOverride : (this.isDineIn ? this.selectedTable : 0)
      let orders = this.unfinishedOrders.filter(o => String(o.deskNo) === String(deskNo))
      // 上菜紙：無未結訂單時，也允許對今日已結帳／已送單的訂單列印
      if (!orders.length && type === 'serving') {
        orders = this.settledTodayOrders.filter(o => String(o.deskNo) === String(deskNo))
      }
      if (!orders.length) {
        this.$message({ type: 'warning', message: '該枱無未結訂單可打印' })
        return
      }
      const latest = orders[0]
      if (type === 'print' && latest.printed && (this.staffInfo.permissionLevel || 1) < this.reprintMinLevel) {
        this.$message({ type: 'warning', message: '此枱已印單，不能重複打印（權限不足）' })
        return
      }
      const body = { _id: latest._id, type, printer: this.staffInfo.name || this.waiter, terminalCode: this.selectedTerminal, central: !!central }
      if (type === 'serving' && newCount > 0) body.newCount = newCount
      this.$axios.post('/api/order/print', body)
        .then(res => {
          if (type === 'print') this.$set(latest, 'printed', true)
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
      this.pendingOrderNo = null
    },
    cancelItemFromBtn () {
      const idx = this.selectedCartIndex
      if (idx >= 0 && this.cart[idx]) {
        const item = this.cart[idx]
        if (!item.sent) {
          // 未送單品項：直接取消，不用再問
          const nextCart = this.cart.slice()
          nextCart.splice(idx, 1)
          this.$set(this.carts, this.cartKey, nextCart)
          // 藍色選框向上移：選取上一項（首項則選新首項），清空則 -1
          this.selectedCartIndex = idx > 0 ? idx - 1 : (nextCart.length ? 0 : -1)
          this.selectedContentKey = ''
          this.$message({ type: 'success', message: '已取消品項' })
          return
        }
        // 已送單品項：進入退菜編輯模式（直接修改左邊單據，可加減／多重選擇）
        this.enterCancelEdit(idx)
        return
      }
      // 未點選品項：列出所有已送品項供批量取消
      const sentItems = this.cart.map((item, i) => ({ ...item, index: i })).filter(item => item.sent)
      if (!sentItems.length) {
        this.$message({ type: 'warning', message: '沒有已送廚房的品項' })
        return
      }
      this.enterCancelEdit()
    },
    enterCancelEdit (preSelectIndex = null) {
      const selected = {}
      if (preSelectIndex != null && this.cart[preSelectIndex] && this.cart[preSelectIndex].sent) {
        selected[preSelectIndex] = 1
      }
      this.cancelEditMode = {
        active: true,
        selected,
        reasons: [],
        managerNo: this.staffInfo.no || '',
        managerPwd: '',
        needsManager: !this.canSkipManagerAuth('order.voidItem'),
        loading: false
      }
      this.selectedCartIndex = preSelectIndex != null ? preSelectIndex : -1
    },
    exitCancelEdit () {
      this.cancelEditMode = { active: false, selected: {}, reasons: [], managerNo: '', managerPwd: '', needsManager: false, loading: false }
    },
    confirmCancelEdit () {
      const em = this.cancelEditMode
      const selected = Object.keys(em.selected || {})
        .map(k => {
          const idx = Number(k)
          const item = this.cart[idx]
          return { ...item, index: idx, cancelQty: em.selected[k] || 0 }
        })
        .filter(i => i && i.cancelQty > 0)
      if (!selected.length) {
        this.$message({ type: 'warning', message: '請先選擇要取消的數量' })
        return
      }
      if (!em.reasons || !em.reasons.length) {
        this.$message({ type: 'warning', message: '請至少選擇一個取消原因' })
        return
      }
      const reason = em.reasons.join('、')
      const run = () => this.applyBatchCancels(selected, reason)
        .then(() => {
          this.exitCancelEdit()
          this.$message({ type: 'success', message: '已取消所選品項' })
          return this.loadUnfinished()
        })
        .catch(() => {
          em.loading = false
          this.$message({ type: 'error', message: '取消品項失敗' })
        })
      if (em.needsManager) {
        if (!em.managerNo || !em.managerPwd) {
          this.$message({ type: 'warning', message: '請輸入經理編號與密碼' })
          return
        }
        em.loading = true
        this.$axios.post('/api/staff/login', { no: em.managerNo, password: em.managerPwd })
          .then(res => {
            if ((res.data.permissionLevel || 1) < 3) {
              em.loading = false
              this.$message({ type: 'error', message: '需要經理（等級3）以上權限' })
              return
            }
            return run()
          })
          .catch(() => {
            em.loading = false
            this.$message({ type: 'error', message: '經理驗證失敗' })
          })
        return
      }
      em.loading = true
      run()
    },
    openCancelItemDialog (sentItems) {
      const needsManager = !this.canSkipManagerAuth('order.voidItem')
      this.cancelItemDialog = {
        show: true,
        list: sentItems.map(item => {
          const unit = item.unitPrice != null ? item.unitPrice : this.calcUnit(item)
          return {
            ...item,
            cancelQty: 1,
            _modsText: this.modNames(item.mods).join('、'),
            _unitPrice: unit,
            _subtotal: Math.round(unit * (item.count || 1) * 100) / 100
          }
        }),
        reasons: [],
        managerNo: this.staffInfo.no || '',
        managerPwd: '',
        needsManager,
        loading: false
      }
    },
    confirmCancelItems () {
      const d = this.cancelItemDialog
      const selected = (d.list || []).filter(i => (i.cancelQty || 0) > 0)
      if (!selected.length) {
        this.$message({ type: 'warning', message: '請先選擇要取消的數量' })
        return
      }
      if (!d.reasons || !d.reasons.length) {
        this.$message({ type: 'warning', message: '請至少選擇一個取消原因' })
        return
      }
      const reason = d.reasons.join('、')
      const run = () => this.applyBatchCancels(selected, reason)
        .then(() => {
          d.show = false
          this.$message({ type: 'success', message: '已取消所選品項' })
          return this.loadUnfinished()
        })
        .catch(() => this.$message({ type: 'error', message: '取消品項失敗' }))
      if (d.needsManager) {
        if (!d.managerNo || !d.managerPwd) {
          this.$message({ type: 'warning', message: '請輸入經理編號與密碼' })
          return
        }
        d.loading = true
        this.$axios.post('/api/staff/login', { no: d.managerNo, password: d.managerPwd })
          .then(res => {
            if ((res.data.permissionLevel || 1) < 3) {
              d.loading = false
              this.$message({ type: 'error', message: '需要經理（等級3）以上權限' })
              return
            }
            return run().then(() => { d.loading = false }).catch(() => { d.loading = false })
          })
          .catch(() => {
            d.loading = false
            this.$message({ type: 'error', message: '經理驗證失敗' })
          })
        return
      }
      d.loading = true
      run().then(() => { d.loading = false }).catch(() => { d.loading = false })
    },
    confirmCancelBatchSent () {
      const { managerNo, managerPwd, reasons, batchItems } = this.cancelDialog
      if (!reasons || !reasons.length) { this.$message({ type: 'warning', message: '請至少選擇一個取消原因' }); return }
      const reason = reasons.join('、')
      if (this.canSkipManagerAuth('order.voidItem')) {
        this.applyBatchCancels(batchItems, reason)
          .then(() => {
            this.cancelDialog.show = false
            this.$message({ type: 'success', message: '已取消所選品項' })
            return this.loadUnfinished()
          })
          .catch(() => this.$message({ type: 'error', message: '取消品項失敗' }))
        return
      }
      if (!managerNo || !managerPwd) { this.$message({ type: 'warning', message: '請輸入經理編號與密碼' }); return }
      this.cancelDialog.loading = true
      this.$axios.post('/api/staff/login', { no: managerNo, password: managerPwd })
        .then(res => {
          if ((res.data.permissionLevel || 1) < 3) {
            this.$message({ type: 'error', message: '需要經理（等級3）以上權限' })
            this.cancelDialog.loading = false
            return
          }
          return this.applyBatchCancels(batchItems, reason)
            .then(() => {
              this.cancelDialog.show = false
              this.cancelDialog.loading = false
              this.$message({ type: 'success', message: '已取消所選品項' })
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
    applyBatchCancels (batchItems, reason) {
      const groups = {}
      batchItems.forEach(it => {
        const target = this.findSentOrderItem(it)
        if (!target) return
        const key = String(target.order._id)
        if (!groups[key]) groups[key] = { order: target.order, items: [] }
        groups[key].items.push({ target, item: it, cancelQty: (it.cancelQty || 0) })
      })
      const jobs = Object.keys(groups).map(async key => {
        const g = groups[key]
        // 依訂單內索引由大到小逐筆退菜：避免 splice 後較小索引錯位，且逐筆 await 避免並發讀寫競態
        const sorted = g.items.slice().sort((a, b) => b.target.idx - a.target.idx)
        const printItems = []
        for (const entry of sorted) {
          const payload = { _id: g.order._id, index: entry.target.idx, reason }
          if (entry.cancelQty > 0) payload.qty = entry.cancelQty
          await this.$axios.post('/api/order/voidItem', payload).catch(() => {})
          printItems.push({ name: entry.item.name, count: entry.cancelQty > 0 ? entry.cancelQty : (entry.item.count || 1) })
        }
        await this.$axios.post('/api/order/printCancelItems', {
          _id: g.order._id,
          items: printItems,
          reason,
          printer: this.staffInfo.name || this.waiter,
          terminalCode: this.selectedTerminal || ''
        }).catch(() => {})
      })
      return Promise.all(jobs).then(() => this.updateCartAfterBatchCancel(batchItems))
    },
    updateCartAfterBatchCancel (batchItems) {
      const nextCart = this.cart.slice()
      const sorted = batchItems.slice().sort((a, b) => b.index - a.index)
      sorted.forEach(it => {
        const idx = it.index
        if (idx < 0 || idx >= nextCart.length) return
        const cur = nextCart[idx]
        const cq = it.cancelQty || 0
        if (cq > 0 && (cur.count || 1) > cq) {
          const ni = Object.assign({}, cur, { count: (cur.count || 1) - cq })
          this.refreshItem(ni)
          nextCart[idx] = ni
        } else {
          nextCart.splice(idx, 1)
        }
      })
      this.$set(this.carts, this.cartKey, nextCart)
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
        this.openCancelItemDialog([{ ...item, index, cancelQty: 1 }])
      }
    },
    confirmCancel () {
      if (this.cancelDialog.index === -1) this.confirmCancelAllSent()
      else if (this.cancelDialog.batchItems) this.confirmCancelBatchSent()
      else this.confirmCancelSentItem()
    },
    confirmCancelSentItem () {
      const { managerNo, managerPwd, reasons, qty } = this.cancelDialog
      const index = this.cancelDialog.index
      const item = this.cart[index]
      if (!item || !item.sent) return
      if (!reasons || !reasons.length) { this.$message({ type: 'warning', message: '請至少選擇一個取消原因' }); return }
      const reason = reasons.join('、')
      const cancelQty = Math.floor(Number(qty) || 0)
      if (this.canSkipManagerAuth('order.voidItem')) {
        this.doCancelSentItem(item, reason, cancelQty)
        return
      }
      if (!managerNo || !managerPwd) { this.$message({ type: 'warning', message: '請輸入經理編號與密碼' }); return }
      this.cancelDialog.loading = true
      this.$axios.post('/api/staff/login', { no: managerNo, password: managerPwd })
        .then(res => {
          if ((res.data.permissionLevel || 1) < 3) {
            this.$message({ type: 'error', message: '需要經理（等級3）以上權限' })
            this.cancelDialog.loading = false
            return
          }
          this.doCancelSentItem(item, reason, cancelQty)
        })
        .catch(() => {
          this.cancelDialog.loading = false
          this.$message({ type: 'error', message: '經理驗證失敗' })
        })
    },
    doCancelSentItem (item, reason, cancelQty) {
      this.cancelDialog.loading = true
      const index = this.cancelDialog.index
      const target = this.findSentOrderItem(item)
      if (!target) {
        this.$message({ type: 'warning', message: '找不到該品項在訂單中的位置' })
        this.cancelDialog.loading = false
        return
      }
      const payload = { _id: target.order._id, index: target.idx, reason }
      if (cancelQty > 0) payload.qty = cancelQty
      this.$axios.post('/api/order/voidItem', payload)
        .then(() => {
          return this.$axios.post('/api/order/printCancelItems', {
            _id: target.order._id,
            items: [{ name: item.name, count: cancelQty > 0 ? cancelQty : (item.count || 1) }],
            reason,
            printer: this.staffInfo.name || this.waiter,
            terminalCode: this.selectedTerminal || ''
          }).catch(() => {})
        })
        .then(() => {
          const nextCart = this.cart.slice()
          if (cancelQty > 0 && (item.count || 1) > cancelQty) {
            const ni = Object.assign({}, nextCart[index])
            ni.count = (ni.count || 1) - cancelQty
            this.refreshItem(ni)
            nextCart[index] = ni
          } else {
            nextCart.splice(index, 1)
          }
          this.$set(this.carts, this.cartKey, nextCart)
          this.cancelDialog.show = false
          this.cancelDialog.loading = false
          this.$message({ type: 'success', message: cancelQty > 0 ? '已取消部分品項' : '已取消已落單品項' })
          return this.loadUnfinished()
        })
        .catch(() => {
          this.cancelDialog.loading = false
          this.$message({ type: 'error', message: '取消品項失敗' })
        })
    },
    cancelAll () {
      if (!this.cart.length) { this.$message({ type: 'warning', message: '購物車為空' }); return }
      const hasSent = this.cart.some(i => i.sent)
      if (hasSent) {
        this.cancelDialog = { show: true, index: -1, isSent: true, managerNo: this.staffInfo.no || '', managerPwd: '', reason: '', reasons: [], loading: false }
      } else {
        this.$confirm('確認清空所有未下單品項嗎？', '整單取消', { type: 'warning' })
          .then(() => {
            this.clearCart()
            this.$message({ type: 'success', message: '已清空購物車' })
          }).catch(() => {})
      }
    },
    confirmCancelAllSent () {
      const { managerNo, managerPwd, reasons } = this.cancelDialog
      if (!reasons || !reasons.length) { this.$message({ type: 'warning', message: '請至少選擇一個取消原因' }); return }
      const reason = reasons.join('、')
      if (this.canSkipManagerAuth('order.cancel')) {
        this.doCancelAllSent(reason)
        return
      }
      if (!managerNo || !managerPwd) { this.$message({ type: 'warning', message: '請輸入經理編號與密碼' }); return }
      this.cancelDialog.loading = true
      this.$axios.post('/api/staff/login', { no: managerNo, password: managerPwd })
        .then(res => {
          if ((res.data.permissionLevel || 1) < 3) {
            this.$message({ type: 'error', message: '需要經理（等級3）以上權限' })
            this.cancelDialog.loading = false
            return
          }
          this.doCancelAllSent(reason)
        })
        .catch(() => {
          this.cancelDialog.loading = false
          this.$message({ type: 'error', message: '經理驗證失敗' })
        })
    },
    doCancelAllSent (reason) {
      this.cancelDialog.loading = true
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
    },
    onSwipeStart (index, e) {
      if (!this.gestureEnabled) return
      this.swipeIndex = index
      this.swipeStartX = e.touches[0].clientX
      this.swipeStartY = e.touches[0].clientY
      this.swipeDelta = 0
      this.swipeLocked = false
    },
    onSwipeMove (index, e) {
      if (!this.gestureEnabled) return
      if (this.swipeIndex !== index) return
      const dx = e.touches[0].clientX - this.swipeStartX
      const dy = e.touches[0].clientY - this.swipeStartY
      if (!this.swipeLocked && (Math.abs(dy) > Math.abs(dx))) {
        this.swipeLocked = true
      }
      if (this.swipeLocked) return
      if (Math.abs(dx) > Math.abs(dy)) e.preventDefault()
      this.swipeDelta = Math.max(-80, Math.min(80, dx))
    },
    onSwipeEnd (index, e) {
      if (!this.gestureEnabled) return
      if (this.swipeIndex !== index) return
      const wasLocked = this.swipeLocked
      const delta = this.swipeDelta
      this.swipeIndex = -1
      this.swipeDelta = 0
      if (wasLocked) return
      if (delta < -40) {
        this.showDetail = true
      } else if (delta > 40) {
        this.showDetail = false
      }
    },
    mapOrderItems (items) {
      return items.map(i => ({
        _id: i._id,
        name: i.name,
        name2: i.name2 || '',
        price: i.price,
        count: i.count,
        station: i.station,
        stations: i.stations,
        category: i.category || '',
        categoryName: i.categoryName || '',
        categoryCode: i.categoryCode || '',
        plu: i.plu || '',
        code: i.code || '',
        categoryId: i.categoryId || '',
        bundleGroupId: i.bundleGroupId || '',
        mainGroupId: i.mainGroupId || '',
        mods: i.mods || [],
        discount: i.discount,
        free: i.free,
        customPrice: i.customPrice,
        bundlePrice: !!i.bundlePrice,
        mandatory: !!i.mandatory,
        contents: i.contents,
        comboId: i.comboId,
        comboName: i.comboName,
        comboSnapshot: i.comboSnapshot,
        noPrintComboName: !!i.noPrintComboName,
        departmentSplit: i.departmentSplit || [],
        showItems: i.showItems !== false,
        dishStatus: i.dishStatus || ''
      }))
    },
    // 跟餐價回寫：撞餐規則下，已送單的跟餐（飲品）在主食後加送單時，於後端改成跟餐價
    repriceSentAddons (bundles) {
      if (!this.bundleOn) return Promise.resolve()
      const tasks = []
      ;(bundles || []).forEach(b => {
        if (!b._sentAddon || !b.addon) return
        const order = this.unfinishedOrders.find(o => String(o.orderNo) === String(b.addon._orderNo))
        if (!order) return
        tasks.push(this.$axios.post('/api/order/repriceItem', {
          _id: order._id,
          index: Number(b.addon._orderIdx),
          price: b.addon.price
        }).catch(() => {}))
      })
      if (!tasks.length) return Promise.resolve()
      return Promise.all(tasks)
    },
    submitUnsent (print, navigate = true) {
      const newItems = this.cart.filter(i => !i.sent)
      if (!newItems.length) {
        if (print && navigate) this.backToBoard()
        else if (!print) this.$message({ type: 'warning', message: '沒有新加的菜品，請先點餐' })
        return Promise.resolve(true)
      }
      const submitItems = this.bundleOn ? this.buildBundleSubmitItems(newItems, this.bundlePlan) : newItems
      const newTotal = Math.max(0, Math.round(submitItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100)
      const payload = {
        deskNo: this.isDineIn ? this.selectedTable : 0,
        order: this.mapOrderItems(submitItems),
        remark: this.orderRemark,
        totalPrice: newTotal,
        zone: this.selectedZone,
        source: 'pos',
        print,
        printed: false,
        waiter: this.staffInfo.name || this.waiter,
        terminalCode: this.selectedTerminal,
        pax: this.pax
      }
      return this.$axios.post('/api/order/submit', payload)
        .then(() => this.repriceSentAddons(this.bundlePlan.bundles))
        .then(() => {
          this.$message({ type: 'success', message: print ? '送單成功，已發送打印機' : '下單成功' })
          const now = new Date()
          const updatedCart = this.cart.map(i => i.sent ? i : Object.assign({}, i, { sent: true, addTime: now }))
          this.$set(this.carts, this.cartKey, updatedCart)
          return this.loadUnfinished()
        })
        .then(() => {
          // 外賣/外賣枱浮動單：送單後把 currentOrder 指向剛建立的訂單，讓單據編號持續顯示
          if (!this.isDineIn) {
            const created = this.pendingOrderNo ? this.unfinishedOrders.find(o => String(o.orderNo) === String(this.pendingOrderNo)) : null
            this.viewingFloatingOrder = created || null
            this.pendingOrderNo = null
          }
          if (navigate) {
            const deskNo = this.selectedTable
            this.view = 'board'
            this.selectedTable = null
            if (deskNo) this.unlockTable(deskNo)
            this.loadMenu()
          }
          return true
        })
        .catch(() => {
          this.$message({ type: 'error', message: print ? '送單失敗' : '下單失敗' })
          return false
        })
    },
    doSubmit (print) {
      return this.submitUnsent(print)
    },
    serveTicket () {
      const deskNo = this.isDineIn ? this.selectedTable : 0
      const newItems = this.cart.filter(i => !i.sent)
      const newCount = this.servingNewItemsOnly ? newItems.length : 0
      return this.submitUnsent(true, false)
        .then(ok => {
          if (!ok) return false
          this.printTicket('serving', deskNo, false, newCount)
          this.backToBoard()
          return true
        })
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
    },
    showFailoverNotice (payload) {
      const p = payload || {}
      this.failoverNotice = {
        show: true,
        from: p.from || '',
        to: p.to || '',
        deskNo: p.deskNo || '',
        orderNo: p.orderNo || ''
      }
      if (this.failoverTimer) clearTimeout(this.failoverTimer)
      this.failoverTimer = setTimeout(() => {
        this.failoverNotice.show = false
      }, 8000)
    },
    showPrintBlockedNotice (payload) {
      const p = payload || {}
      this.blockedNotice = {
        show: true,
        station: p.station || '',
        reason: p.reason || '未送出',
        deskNo: p.deskNo || '',
        orderNo: p.orderNo || ''
      }
      if (this.blockedTimer) clearTimeout(this.blockedTimer)
      this.blockedTimer = setTimeout(() => {
        this.blockedNotice.show = false
      }, 8000)
    },
    updateWindowSize () {
      const sw = window.innerWidth || 0
      const sh = window.innerHeight || 0
      this.screenW = sw
      this.screenH = sh
      const scale = Math.max(sh / 1080, this.minPosScale) || 1
      this.windowW = Math.round(sw / scale)
      this.windowH = Math.round(sh / scale)
    }
  },
  sockets: {
    connect () {
      this.emitRegisterTerminal()
    },
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
      this.loadUnfinished().then(() => this.syncOpenTableCart())
    },
    zoneChanged () {
      this.loadZones()
    },
    modcodeChanged () {
      this.loadModCodes()
    },
    holdChanged () {
      this.loadHolds()
    },
    printerFailover (payload) {
      this.showFailoverNotice(payload)
    },
    printBlocked (payload) {
      this.showPrintBlockedNotice(payload)
    }
  },
  created () {
    this.updateWindowSize()
    window.addEventListener('resize', this.updateWindowSize)
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
    this.loadDepartments()
    document.addEventListener('keydown', this.handleHardwarePluKeydown)
  },
  mounted () {
    this.setupFoodObserver()
    this.$nextTick(() => this.setupFloorObserver())
  },
  beforeDestroy () {
    if (this.timeTimer) clearInterval(this.timeTimer)
    if (this.failoverTimer) clearTimeout(this.failoverTimer)
    if (this.blockedTimer) clearTimeout(this.blockedTimer)
    window.removeEventListener('resize', this.updateWindowSize)
    document.removeEventListener('keydown', this.handleHardwarePluKeydown)
    if (this._foodObserver) { this._foodObserver.disconnect(); this._foodObserver = null }
    if (this._floorObserver) { this._floorObserver.disconnect(); this._floorObserver = null }
    if (this._posFontStyle) { this._posFontStyle.remove(); this._posFontStyle = null }
    if (this._posFontOverride) { this._posFontOverride.remove(); this._posFontOverride = null }
    this.stopQtyHold()
  }
}
</script>

<style scoped>
.pos-viewport{ width: 100%; height: 100%; overflow: hidden; position: relative; background: #f3f6fb; }
.failover-banner{ position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 9999; background: rgba(0,0,0,0.88); border: 3px solid #ff4d4f; border-radius: 14px; padding: 12px 30px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.35); pointer-events: none; white-space: nowrap; }
.blocked-banner{ top: 104px; }
.failover-title{ font-size: 16px; font-weight: 700; color: #ffd04d; letter-spacing: 2px; }
.failover-main{ font-size: 42px; font-weight: 800; line-height: 1.25; animation: failover-flash 0.6s infinite alternate; }
.failover-sub{ font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 2px; }
@keyframes failover-flash{ from{ color: #ff4d4f; } to{ color: #ffd04d; } }
.failover-enter-active, .failover-leave-active{ transition: opacity .3s; }
.failover-enter, .failover-leave-to{ opacity: 0; }
#pos{ display: flex; flex-direction: column; height: 100%; background: #f3f6fb; color: #1f2937; font-family: -apple-system, BlinkMacSystemFont, "PingFang TC", "PingFang SC", "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Microsoft JhengHei", "Arial", sans-serif; margin: 0; padding: 0; }
.login-view{ flex: 1; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #e9f0f7 0%, #dbe6f1 50%, #eef3f8 100%); position: relative; overflow: hidden; }
.login-view::before{ content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(64,158,255,.06) 0%, transparent 60%); animation: loginBgPulse 8s ease-in-out infinite; }
@keyframes loginBgPulse{ 0%, 100%{ transform: scale(1); } 50%{ transform: scale(1.1); } }
.login-card{ width: 380px; max-width: 94vw; background: #fff; border: 1px solid #e5ecf4; border-radius: 22px; padding: 20px 22px; box-shadow: 0 24px 70px rgba(23,43,77,.18); position: relative; z-index: 1; }
.login-topbar{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; min-height: 24px; }
.login-terminal{ display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #5b7696; background: #eef3f8; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
.login-terminal-empty{ min-width: 10px; }
.login-clock{ display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #1f3a5f; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
.login-topbar-right{ display: inline-flex; align-items: center; gap: 10px; }
.login-conn-setting{ display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; color: #5b7696; cursor: pointer; font-size: 18px; transition: all .15s; }
.login-conn-setting:hover{ background: #eef3f8; color: #1f3a5f; }
.login-brand{ text-align: center; margin-bottom: 16px; }
.login-icon{ width: 64px; height: 64px; margin: 0 auto 10px; background: linear-gradient(135deg, #409eff 0%, #2c6fb5 100%); border-radius: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(64,158,255,.35); }
.login-icon i{ font-size: 32px; color: #fff; }
.login-title{ font-size: 24px; font-weight: 800; color: #1f2937; margin-bottom: 4px; letter-spacing: -0.5px; }
.login-subtitle{ font-size: 13px; color: #909399; letter-spacing: 1px; }
.login-display{ margin-bottom: 14px; }
.login-steps{ display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 10px; }
.login-step{ display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #8496ad; cursor: pointer; padding: 4px 10px; border-radius: 999px; transition: all .15s; }
.login-step-no{ width: 18px; height: 18px; border-radius: 50%; background: #eef3f8; color: #8496ad; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; transition: all .15s; }
.login-step.active{ color: #1f3a5f; background: rgba(64,158,255,.12); }
.login-step.active .login-step-no{ background: #409eff; color: #fff; }
.login-step.done{ color: #67c23a; }
.login-step.done .login-step-no{ background: rgba(103,194,58,.18); color: #67c23a; }
.login-step-arrow{ color: #c0ccdb; font-size: 14px; }
.login-screen{ position: relative; height: 74px; border-radius: 14px; background: linear-gradient(180deg, #f2f7fc, #e6eef7); border: 1px solid #d7e3ef; box-shadow: inset 0 2px 6px rgba(0,0,0,.04); padding: 10px 16px; display: flex; flex-direction: column; justify-content: center; overflow: hidden; cursor: pointer; }
.login-screen::after{ content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 0%, rgba(64,158,255,.05) 100%); pointer-events: none; }
.login-screen-label{ font-size: 11px; font-weight: 700; color: #8496ad; letter-spacing: 2px; margin-bottom: 2px; }
.login-screen-value{ font-size: 26px; font-weight: 800; color: #1f3a5f; letter-spacing: 2px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.login-screen-value::after{ content: ''; display: inline-block; width: 2px; height: 1em; margin-left: 4px; vertical-align: -2px; background: #409eff; animation: loginCursorBlink 1s steps(2, start) infinite; }
.login-screen.mask .login-screen-value{ letter-spacing: 8px; }
@keyframes loginCursorBlink{ 0%, 49%{ opacity: 1; } 50%, 100%{ opacity: 0; } }
.login-keypad{ display: flex; justify-content: center; margin-bottom: 14px; }
.login-actions{ display: flex; gap: 12px; }
.login-actions .shift-btn{ flex: 1; height: 42px; font-size: 13px; font-weight: 600; border-radius: 10px; }
.login-actions .shift-btn i{ margin-right: 4px; }
.terminal-badge{ display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #a8b8d0; background: rgba(255,255,255,.12); padding: 3px 10px; border-radius: 12px; white-space: nowrap; }
.staff-name{ font-size: 13px; color: #d8e4f2; margin-right: 8px; }
/* 枱況圖視圖 */
.board-view{ flex: 1; min-height: 0; display: flex; flex-direction: column; background: #f3f6fb; }
.board-header{ display: flex; align-items: center; min-height: 72px; padding: 0 24px; background: linear-gradient(135deg,#172b4d,#254f7d); color: #fff; }
.board-heading{ display:flex; align-items:center; gap:16px; }.board-title{ font-size: 21px; font-weight: 700; letter-spacing: 1px; }.board-legend{ display:inline-flex; align-items:center; gap:12px; margin-left:8px; }.board-legend .legend{ color:#d8e4f2; font-size:13px; }.board-subtitle{ font-size: 12px; color: #b9c9dc; }
.board-right{ margin-left: auto; display: flex; align-items: center; gap: 10px; }.board-right .el-button{ border-radius: 7px; }.board-right .el-button--success.is-plain,.board-right .el-button--danger.is-plain{ background: rgba(255,255,255,.08); }
.current-time{ color: #d8e4f2; font-size: 13px; white-space: nowrap; }.header-time{ color: #a8b8d0; font-size: 13px; }
.legend{ font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.dot{ display: inline-block; width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 3px rgba(148,163,184,.12); }
.dot.free{ background: #409eff; }
.dot.busy{ background: #67c23a; }
.dot.printed{ background: #e6a23c; }
.dot.settled{ background: #67c23a; }
.dot.relisted{ background: #9c27b0; }
.dot.qr{ background: #f56c6c; }
.board-zone-tabs{ display: flex; align-items: center; gap: 6px; padding: 10px 20px 0; background: #f5f6f8; }
.zone-tab{ padding: 6px 18px; border-radius: 16px 16px 0 0; font-size: 14px; color: #606266; background: #e9edf2; cursor: pointer; }
.zone-tab.active{ background: #1f2d3d; color: #fff; font-weight: bold; }
.zone-tab-right{ margin-left: auto; display: flex; gap: 8px; }
.floor-canvas{ flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; padding: 16px; background: radial-gradient(circle at 20% 10%,#fff 0,#f3f6fb 52%); }
.floor-box{ position: relative; }
.floor-inner{ position: relative; transform-origin: 0 0; }
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
.bottom-bar{ display: flex; align-items: center; justify-content: flex-end; padding: 14px 20px; background: linear-gradient(180deg, #1e293b, #0f172a); flex: 0 0 auto; border-top: 1px solid rgba(148,163,184,.12); box-shadow: 0 -4px 16px rgba(15,23,42,.15); position: relative; }
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
.side-keypad{ flex: 8 1 0; width: 100%; display: flex; flex-direction: column; background: rgba(255,255,255,.12); border-radius: 12px; padding: 5px 4px; }
.pad-col{ display:flex; flex-direction:column; flex:1; gap:2px; }
.pad-key{ flex:1; min-height:0; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,.94); color:#3a4164; font-size:15px; font-weight:800; border-radius:10px; cursor:pointer; user-select:none; transition:all .1s; box-shadow:0 2px 4px rgba(0,0,0,.06); }
.pad-key-digit{ font-size:37px; }
.pad-key:hover{ background:#fff; box-shadow:0 3px 8px rgba(0,0,0,.12); }
.pad-key:active{ transform:scale(.94); background:#e0ecff; }
.side-nav > .side-item.pad-btn{ width: 100%; margin-top: 5px; padding: 0; min-height: 0; font-size: 24px; font-weight: 800; flex: 1 1 0; display: flex; align-items: center; justify-content: center; }
.order-main{ flex: 1; display: flex; flex-direction: column; min-width: 0; }
.top-bar{ display: flex; align-items: center; gap: 18px; padding: 12px 8px; background: #fff; border-bottom: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(36,61,91,.05); }
.order-body{ flex: 1; display: flex; min-height: 0; }
.food-zone{ flex: 1; display: flex; flex-direction: column; min-width: 0; background: #fff; border-radius: 0; overflow: hidden; box-shadow: none; border: none; margin: 0; }.food-top-row{ padding: 4px 0 0; margin-bottom: 0; border-bottom: 1px solid var(--pos-head-from, #6a73c8); }
.food-grids{ padding: 0 0 10px; }
.food-column{ flex: 1; display: flex; flex-direction: column; min-width: 0; }
.food-grids{ flex: 1; display: flex; flex-direction: column; overflow-y: auto; margin-top: 0; padding-bottom: 2px; }
.order-ticket{ flex: 0 0 36%; max-width: 480px; min-width: 380px; margin: 0; display: flex; flex-direction: column; background: #fff; border-radius: 0; overflow: hidden; box-shadow: 0 8px 24px rgba(36,61,91,.10); border: 1px solid #e6e9f5; }
.ot-head{ display: flex; justify-content: space-between; align-items: center; padding: 10px 8px; background: linear-gradient(135deg, var(--pos-head-from, #6a73c8), var(--pos-head-to, #8f96d8)); color: #fff; font-size: 16px; font-weight: 800; cursor: grab; user-select: none; gap: 10px; }
.ot-head:active{ cursor: grabbing; }
.ot-head-left{ display: flex; flex-direction: row; align-items: center; gap: 8px; }
.ot-sub{ font-size: 13px; font-weight: 600; background: rgba(255,255,255,.22); padding: 2px 10px; border-radius: 12px; }
.ot-controls{ display: flex; gap: 8px; align-items: center; }
.ot-sep{ width: 1px; height: 28px; background: rgba(255,255,255,.3); flex-shrink: 0; }
.head-back{ background: rgba(255,255,255,.22); color: #fff; border-color: transparent; flex-shrink: 0; font-size: 13px; font-weight: 700; padding: 7px 14px; border-radius: 8px; }
.head-back:hover{ background: rgba(255,255,255,.34); color: #fff; }
.ot-controls .el-input__inner{ background: rgba(255,255,255,.95); border-color: transparent; color: #1f2937; font-weight: 600; font-size: 14px; height: 32px; line-height: 32px; border-radius: 6px; }
.ot-controls .el-input-number .el-input__inner{ text-align: center; }
.ot-field{ display: flex; flex-direction: column; align-items: stretch; gap: 3px; }
.ot-cap{ font-size: 11px; font-weight: 700; color: rgba(255,255,255,.92); letter-spacing: 1px; text-align: center; }
.ot-big-num{ display: flex; align-items: baseline; justify-content: center; gap: 2px; background: rgba(255,255,255,.95); color: #1f2937; font-size: 28px; font-weight: 900; padding: 4px 12px; border-radius: 8px; cursor: pointer; min-width: 60px; max-width: 100%; overflow: hidden; white-space: nowrap; text-align: center; line-height: 1.2; transition: all .15s; }
.ot-big-num:hover{ background: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,.6); }
.ot-big-num:active{ transform: scale(.95); }
.ot-big-unit{ font-size: 13px; font-weight: 600; color: #64748b; }
.ot-edit-icon{ font-size: 12px; color: #94a3b8; margin-left: 2px; }
.ot-staff-tag{ display: inline-flex; align-items: center; gap: 4px; background: rgba(255,255,255,.22); padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; flex-shrink: 0; }
.ot-takeaway-label{ background: rgba(255,255,255,.95); color: #e6a23c; }
.classic-num{ background: #fff; border-color: #e2e8f0; }
.classic-num:hover{ box-shadow: 0 0 0 2px #93c5fd; }
.classic-staff{ background: #f1f5f9; color: #475569; }
.classic-sub{ background: #e0e7ff; color: #4338ca; }
/* 頂欄重新編排：返回枱號/項目取消（左欄）＋模式/項目明細（左二欄）＋單據編號跨三欄＋枱號/入單員工/人數 */
.ot-grid{ display: grid; grid-template-columns: auto auto minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: 1fr 1fr; gap: 6px; width: 100%; align-items: stretch; }
.ot-back,
.ot-cancel-item,
.ot-item-detail{ align-self: stretch; height: 100%; display: inline-flex; align-items: center; white-space: nowrap; margin-left: 0; }
.ot-back,
.ot-cancel-item{ min-width: 96px; min-height: 44px; padding: 0 16px; justify-content: center; gap: 6px; }
.ot-back{ grid-row: 1; grid-column: 1; }
.ot-cancel-item{ grid-row: 2; grid-column: 1; background: rgba(239, 68, 68, .72); border-color: transparent; }
.ot-cancel-item:hover{ background: rgba(239, 68, 68, .9); color: #fff; }
.ot-item-detail{ grid-row: 2; grid-column: 2; min-height: 44px; justify-content: flex-start; }
.ot-cell{ display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 2px; min-width: 0; }
.ot-mode-cell{ grid-row: 1; grid-column: 2; }
.ot-orderno-cell{ grid-row: 1; grid-column: 3 / 6; }
.ot-table-cell{ grid-row: 2; grid-column: 3; }
.ot-staff-cell{ grid-row: 2; grid-column: 4; }
.ot-pax-cell{ grid-row: 2; grid-column: 5; }
.ot-table-cell .ot-big-num,
.ot-pax-cell .ot-big-num,
.ot-staff-cell .ot-big-num{ min-width: 0; padding: 4px 8px; min-height: 42px; align-items: center; }
.ot-mode-label{ cursor: default; }
.ot-order-no{ font-size: 16px; letter-spacing: .5px; cursor: default; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 42px; align-items: center; }
.ot-staff-name{ font-size: 15px; font-weight: 800; cursor: default; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 42px; align-items: center; }
.classic-grid .head-back{ background: #1f2d3d; color: #fff; }
.classic-grid .head-back:hover{ background: #334155; color: #fff; }
.classic-grid .ot-cap{ color: #606266; }
.classic-grid .ot-big-num{ background: #fff; border: 1px solid #e2e8f0; }
.classic-grid .ot-big-num:hover{ box-shadow: 0 0 0 2px #93c5fd; }
.food-top-row{ display: flex; align-items: center; gap: 8px; margin-bottom: 0; }
.food-top-row .cat-wrap{ flex: 1; margin-bottom: 0; min-width: 0; padding: 0; }
.back-mini{ flex-shrink: 0; }
.order-ticket .order-list{ flex: 1; }
.order-ticket .order-footer{ border-top: 1px solid #e2e8f0; }
.action-dock{ display: flex; gap: 0; padding: 0; border-top: 1px solid #e2e8f0; }
.dock-left{ flex: 1; border-radius: 0; padding: 0; background: linear-gradient(135deg, var(--pos-dock-from, #7b84c9), var(--pos-dock-to, #9097d6)); min-width: 0; }
.dock-left .bb-rows{ align-items: stretch; }
.dock-left .bb-rows{ width: 100%; }
.dock-left .bb-row{ display: grid; gap: 4px; width: 100%; }
.dock-left .bb-row .el-button{ width: 100% !important; min-width: 0 !important; max-width: 100%; height: 40px; margin: 0; padding: 0 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.dock-left .btn-wrap{ min-width: 0; width: 100%; }
.dock-left .el-button{ background: rgba(255,255,255,.94); border-color: rgba(255,255,255,.9); color: #1e293b; }
.dock-left .el-button:hover{ background: #fff; }
.dock-left{ position: relative; }
.dock-page-nav{ display: flex; flex-direction: column; align-items: center; gap: 2px; justify-content: center; padding: 2px 0; margin: 0 2px; width: fit-content; }
.dock-page-btn{ border: none; border-radius: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; font-weight: 700; line-height: 1; padding: 0; }
.dock-page-btn:hover:not(:disabled){ opacity: .85; transform: scale(1.08); }
.dock-page-btn:disabled{ opacity: .3; cursor: not-allowed; }
.dock-page-num{ font-weight: 600; }
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
.or-name-served{ color: #f56c6c !important; }
.tag-free{ margin-left: 6px; font-size: 11px; color: #fff; background: #67c23a; padding: 1px 5px; border-radius: 3px; }
.tag-disc{ margin-left: 6px; font-size: 11px; color: #e6a23c; border: 1px solid #e6a23c; padding: 0 4px; border-radius: 3px; }
.tag-cancel{ cursor: pointer; }
.tag-cancel:hover{ opacity: .65; }
.tag-called{ margin-left: 6px; font-size: 10px; padding: 0 4px; border-radius: 3px; font-weight: 600; }
.tag-served{ margin-left: 6px; font-size: 10px; padding: 0 4px; border-radius: 3px; font-weight: 600; color: #16a34a; background: #dcfce7; border: 1px solid #bbf7d0; }
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
.or-qty-locked{ cursor: default; color: #94a3b8; }
.or-qty-locked:active{ transform: none; background: transparent; }
.or-delete{ position:absolute; right:0; top:0; bottom:0; width:64px; display:flex; align-items:center; justify-content:center; background:#f56c6c; color:#fff; font-size:22px; cursor:pointer; border-radius:0 10px 10px 0; z-index:2; opacity:0; transition: opacity .15s ease; pointer-events: none; }
.order-row-selected{ background: #ecf5ff !important; border-color: #409eff !important; box-shadow: 0 0 0 2px rgba(64,158,255,.25) !important; }
.order-row-swiped .or-delete{ opacity:1; pointer-events: auto; }
.or-remark{ font-size: 12px; color: #f01414; margin-top: 4px; padding-left: 20px; cursor: pointer; }
.remark-label{ color: #e6a23c; }
.mod-tag{ display: inline-block; margin: 0 6px 4px 0; padding: 1px 8px; border-radius: 10px; background: #fef0f0; border: 1px solid #f56c6c; color: #f01414; line-height: 1.6; cursor: pointer; }
.mod-tag-x{ display: inline-block; margin-left: 6px; padding: 0 4px; color: #f01414; font-weight: 700; border-radius: 50%; }
.mod-tag-x:hover{ color: #fff; background: #f56c6c; }
.or-detail{ font-size: 14px; font-weight: 600; color: #e11d48; margin-top: 4px; padding-left: 20px; line-height: 1.5; }
.or-combo-items{ margin-top: 2px; padding-left: 20px; line-height: 1.5; cursor: pointer; }
.combo-item-line{ font-size: 18px; color: #606266; line-height: 1.5; cursor: pointer; }
.combo-item-line-selected{ background: #ecf5ff; box-shadow: 0 0 0 2px #409eff; border-radius: 4px; }
.combo-item-price{ color: #909399; font-size: 16px; margin-left: 2px; }
.combo-mod-text{ color: #f01414; font-size: 16px; }
.combo-edit-link{ font-size: 12px; color: #409eff; margin-top: 2px; }
.empty{ color: #c0c4cc; text-align: center; padding: 40px 0; }
.order-footer{ padding: 10px 16px 14px; border-top: 1px solid #e2e8f0; background: #fff; margin-top: auto; }
.total{ text-align: right; font-size: 17px; margin-bottom: 0; display: flex; align-items: baseline; justify-content: flex-end; gap: 8px; border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 2px; }
.total-num{ color: #dc2626; font-weight: 800; font-size: 30px; }
.total-row{ display: flex; justify-content: space-between; align-items: center; font-size: 15px; color: #475569; margin-bottom: 6px; }
.total-row.right{ justify-content: flex-end; }
.sc-row{ display: flex; align-items: center; gap: 6px; font-size: 13px; }
.sc-amount{ color: #e6a23c; font-weight: bold; }
.right-panel{ flex: 1; display: flex; flex-direction: column; padding: 12px; background: #f8fafc; }
.right-panel .cat-wrap{ margin: 0 -12px 6px; padding: 0 12px 10px; border-bottom: 1px solid var(--pos-head-from, #6a73c8); }
.cat-bar{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px; max-width: 420px; }
.cat-bar .el-button{ font-size: 16px; font-weight: 700; padding: 13px 0; border-radius: 12px; margin: 0; }
.cat-bar .el-button{ margin: 0; border-radius: 8px; font-weight: 600; }
.cat-wrap{ position: relative; display: flex; align-items: center; margin-bottom: 4px; flex-shrink: 0; min-width: 0; }
.cat-wrap .cat-scroll{ flex: 1; min-width: 0; margin-bottom: 0; }
.cat-back{ width: 52px; height: var(--cat-h, 40px); flex-shrink: 0; border: 1.5px solid #dce5f0; border-radius: 12px; background: #fff; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; padding: 0; transition: all .15s; }
.cat-back:hover{ border-color: #93c5fd; color: #2563eb; background: #ecf5ff; }
.cat-scroll{ display: grid; grid-template-columns: repeat(var(--cat-cols, 4), minmax(0, 1fr)); grid-auto-rows: var(--cat-h, 40px); gap: var(--cat-gap-y, 10px) var(--cat-gap-x, 10px); margin-bottom: 4px; padding: 4px 0; flex-shrink: 0; }
.cat-pill{ height: var(--cat-h, 40px); line-height: var(--cat-h, 40px); padding: var(--cat-pad-y, 0) var(--cat-pad, 20px); border-radius: var(--cat-radius, 999px); border: 1.5px solid #dce5f0; background: #fff; color: #475569; font-size: var(--cat-fs, 13px); font-weight: 600; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; transition: all .2s cubic-bezier(.4,0,.2,1); -webkit-tap-highlight-color: transparent; user-select: none; box-shadow: 0 1px 4px rgba(31,55,88,.06); }
.cat-page-cell{ display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 700; background: #eef4fb; border: 1.5px dashed #b9cde5; color: #475569; cursor: pointer; }
.cat-page-cell:hover{ border-color: #93c5fd; color: #2563eb; background: #ecf5ff; }
.cat-page-cell:active{ transform: scale(0.95); }
.cat-page-disabled{ opacity: .35; cursor: not-allowed; pointer-events: none; }
.cat-empty-cell{ visibility: hidden; transition: none; }
.sub-cat-row{ display: flex; flex-wrap: wrap; gap: 8px; padding: 0 4px 6px; flex-shrink: 0; }
.crumb-row{ display:flex; align-items:center; gap:6px; padding:0 4px 6px; flex-shrink:0; }
.crumb-path{ display:flex; align-items:center; gap:4px; min-width:0; overflow-x:auto; flex-wrap:wrap; }
.crumb-seg{ display:inline-flex; align-items:center; gap:4px; }
.crumb-sep{ color:#94a3b8; font-size:14px; font-weight:700; user-select:none; }
.crumb-item{ padding:0 10px; height:26px; line-height:26px; border-radius:999px; background:#eef2f7; color:#475569; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; user-select:none; transition:all .15s; }
.crumb-item:hover{ background:#dbeafe; color:#2563eb; }
.crumb-item.crumb-cur{ background:linear-gradient(135deg,#1f2d3d,#254f7d); color:#fff; font-weight:800; }
.pill-slot{ display: inline-block; margin-left: 8px; padding: 0 7px; border-radius: 9px; background: #f56c6c; color: #fff; font-size: 11px; line-height: 18px; vertical-align: 2px; }
.cat-pill:hover{ border-color: #93c5fd; color: #2563eb; box-shadow: 0 3px 10px rgba(59,130,246,.12); transform: translateY(-1px); }
.cat-pill:active{ transform: scale(0.95); }
.cat-pill.active{ background: linear-gradient(135deg, #1f2d3d, #254f7d); border-color: #254f7d; color: #fff; box-shadow: 0 4px 16px rgba(23,43,77,.45); transform: scale(1.2); font-weight: 900; }
.food-grid{ flex: 1; overflow-y: auto; overflow-x: hidden; display: grid; grid-template-columns: repeat(var(--food-cols, 6), minmax(0, 1fr)); grid-auto-rows: auto; gap: var(--food-gap-y, 6px) var(--food-gap-x, 6px); align-content: start; padding: 2px 0; }
.food-grid.food-grid-fix{ grid-template-columns: repeat(var(--food-cols, 6), minmax(0, 1fr)); }
.food-grid-paged{ align-content: stretch; }
.food-grid-paged .food-wrap{ display: flex; min-height: 0; }
.food-grid-paged .food-btn{ flex: 1; width: 100%; min-height: 0; }
.food-grid-paged .food-img{ flex-shrink: 1; min-height: 0; }
.food-grid-paged .food-text{ flex-shrink: 1; min-height: 0; overflow: hidden; }
.food-btn{ position: relative; min-height: var(--food-h, var(--food-minh, 88px)); border: 1.5px solid rgba(148,163,184,.25); border-radius: 10px; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: transform .2s cubic-bezier(.4,0,.2,1), box-shadow .2s cubic-bezier(.4,0,.2,1); -webkit-tap-highlight-color: transparent; padding: var(--food-pad-y, 6px) var(--food-pad-x, 3px); overflow: hidden; box-shadow: 0 2px 8px rgba(36,61,91,.06); }
.food-btn:active{ transform: scale(.97); box-shadow: 0 1px 4px rgba(64,158,255,.15); }
.food-btn:hover{ transform: translateY(-6px) scale(1.02); box-shadow: 0 16px 32px rgba(36,61,91,.18); border-color: rgba(64,158,255,.4); z-index: 2; }
.food-btn.food-soldout{ background: #f5f7fa; box-shadow: none; }
.food-btn.food-soldout .food-text,
.food-btn.food-soldout .food-img{ opacity: 0.35; }
.food-soldout-cross{ position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-size: 64px; font-weight: 900; color: #f01414; line-height: 1; pointer-events: none; text-shadow: 0 2px 6px rgba(0,0,0,.12); z-index: 1; }
.food-btn.cat-tile{ justify-content: center; }
.food-btn.cat-tile:hover{ border-color: rgba(255,255,255,.6); }
.cat-tile-name{ color: inherit; }
.cat-tile-arrow{ position: absolute; right: 10px; bottom: 8px; font-size: 16px; opacity: .85; display: flex; align-items: center; justify-content: center; }
.food-btn.cat-back-tile{ justify-content: center; background: linear-gradient(145deg, #f8fbff, #e8eef6); border: 1.5px dashed #b9cde5; color: #475569; }
.food-btn.cat-back-tile:hover{ border-color: #93c5fd; color: #2563eb; background: #ecf5ff; }
.food-btn.food-page-cell{ display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 700; background: #eef4fb; border: 1.5px dashed #b9cde5; color: #475569; cursor: pointer; }
.food-btn.food-page-cell:hover{ transform: none; border-color: #93c5fd; color: #2563eb; background: #ecf5ff; box-shadow: 0 4px 12px rgba(59,130,246,.12); }
.food-btn.food-page-cell:active{ transform: scale(0.95); }
.food-page-disabled{ opacity: .35; cursor: not-allowed; pointer-events: none; }
.food-empty-cell{ visibility: hidden; transition: none; }
.cat-back-tile-name{ color: inherit; font-weight: 800; display: flex; align-items: center; gap: 4px; }
.food-img{ width: var(--food-img, 40px); height: var(--food-img, 40px); object-fit: cover; border-radius: 10px; margin-bottom: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.08); border: 1px solid #f0f2f5; }
.food-no-img .food-name{ font-size: var(--food-fs, 25px); }
.food-no-img .food-price{ font-size: var(--food-fs, 25px); }
.food-text{ display: flex; flex-direction: column; align-items: center; gap: 2px; }
.food-soldout-tag{ margin-left: 4px; font-size: 11px; color: #fff; background: #909399; padding: 1px 6px; border-radius: 4px; vertical-align: middle; }
.food-mod-badge{ margin-left: 4px; font-size: 11px; color: #fff; background: #9b59b6; padding: 1px 6px; border-radius: 4px; vertical-align: middle; font-weight: 600; }
.modcat-food-list{ display: flex; flex-wrap: wrap; gap: 10px; padding: 4px; }
.modcat-food-item{ display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: 1px solid #dcdfe6; border-radius: 8px; cursor: pointer; font-size: 20px; color: #303133; background: #f8fafc; }
.modcat-food-item:active{ transform: scale(.97); border-color: #e6a23c; color: #e6a23c; }
.modcat-food-item.active{ border-color: #e6a23c; color: #e6a23c; background: rgba(230,162,60,.08); }
.modcat-food-name{ font-weight: 600; }
.modcat-food-price{ color: #ef4444; font-weight: 700; }
.modcat-food-empty{ padding: 24px; text-align: center; color: #909399; font-size: 18px; }
.food-name{ font-size: var(--food-fs, 25px); font-weight: 700; color: #1e293b; text-align: center; line-height: 1.3; }
.food-plu{ font-size: 12px; color: #94a3b8; font-weight: 700; letter-spacing: .5px; margin-bottom: 2px; text-align: center; }
.food-price{ font-size: var(--food-fs, 25px); color: #ef4444; margin-top: 2px; font-weight: 800; letter-spacing: .3px; }
.food-stock{ font-size: 11px; color: #e6a23c; margin-top: 1px; font-weight: 600; }
.pay-total{ text-align: center; font-size: 16px; }
.pay-num{ color: #f01414; font-weight: bold; font-size: 28px; }
.pay-change{ color: #67c23a; font-weight: bold; font-size: 20px; }
.disc-row{ display: flex; align-items: center; gap: 4px; }
.disc-amount{ color: #e6a23c; font-weight: bold; }
.disc-mode-bar{ display: flex; align-items: center; gap: 8px; padding: 6px 16px; font-size: 13px; color: #b8860b; background: #fdf6ec; border-bottom: 1px dashed #e6a23c; }
.disc-mode-bar span{ flex: 1; }
.settled-mode-bar{ display: flex; align-items: center; gap: 8px; padding: 6px 16px; font-size: 13px; color: #c0392b; background: #fdecea; border-bottom: 1px dashed #e74c3c; }
.settled-mode-bar span{ flex: 1; font-weight: 600; }
.report-cards{ display: flex; gap: 12px; }
.report-card{ flex: 1; text-align: center; border: 1px solid #e4e7ed; border-radius: 8px; padding: 16px 8px; }
.rc-num{ font-size: 26px; font-weight: bold; color: #409eff; }
.rc-label{ font-size: 13px; color: #909399; margin-top: 4px; }
.order-scroll-bar{ display:flex; justify-content:center; gap:4px; padding:4px 0; border-top:1px solid #f0f2f5; background:#f8fafc; flex-shrink:0; }
.order-scroll-bar .el-button{ padding:4px 8px; }
.qty-num{ cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.qty-num:hover{ background: #ecf5ff; color: #409eff; }
.pay-cash-row{ display: flex; align-items: center; gap: 10px; }
.pay-cash-val{ font-size: 24px; font-weight: bold; color: #409eff; min-width: 90px; text-align: right; }
.bc-badge-group{ position: absolute; top: 6px; right: 6px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; z-index: 3; }
.bc-badge{ text-align: center; border-radius: 50%; font-weight: 700; }
.board-toolbar-wrap{ display:none; }
.board-body{ display:flex; flex:1; overflow:hidden; }
.board-sidebar-right{ display:flex; flex-direction:column; align-items:center; gap:4px; padding:10px 12px; background:linear-gradient(180deg,#ffffff,#f7faff); border-left:2px solid #e8edf5; box-shadow:-4px 0 16px rgba(31,55,88,.06); min-width:120px; width:130px; z-index:2; min-height:0; overflow-y:auto; }
.board-sidebar-right .sb-btn{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; width:100%; padding:8px 6px; border:none; border-radius:10px; background:#f0f4f9; color:#475569; font-size:inherit; font-weight:600; cursor:pointer; transition:all .2s ease; line-height:1.3; flex:1 1 0; min-height:0; overflow:hidden; }
.board-sidebar-right .sb-btn i{ font-size:18px; }
.board-sidebar-right .sb-btn:hover{ background:#e0eaff; color:#2563eb; transform:translateY(-1px); box-shadow:0 4px 12px rgba(37,99,235,.12); }
.board-sidebar-right .sb-btn.active{ background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; box-shadow:0 4px 16px rgba(37,99,235,.3); }
.board-sidebar-right .sb-btn.accent{ background:linear-gradient(135deg,#10b981,#059669); color:#fff; }
.board-sidebar-right .sb-btn.accent:hover{ background:linear-gradient(135deg,#059669,#047857); box-shadow:0 4px 16px rgba(16,185,129,.3); }
.board-sidebar-right .sb-btn.zone-btn{ background:linear-gradient(135deg,#fef3c7,#fde68a); color:#92400e; border:1px solid #fcd34d; }
.board-sidebar-right .sb-btn.zone-btn:hover{ background:linear-gradient(135deg,#fde68a,#fbbf24); color:#78350f; box-shadow:0 4px 12px rgba(251,191,36,.25); transform:translateY(-1px); }
.board-sidebar-right .sb-btn.zone-btn.active{ background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; border-color:#d97706; box-shadow:0 4px 16px rgba(245,158,11,.35); }
.board-sidebar-right .sb-btn.bottom{ flex:0 0 auto; min-height:auto; overflow:visible; background:#f8f9fb; color:#64748b; }
.board-sidebar-right .sb-btn.bottom:hover{ background:#e2e8f0; color:#334155; }
.sidebar-zone-right{ display:flex; flex-direction:column; align-items:center; gap:4px; width:100%; padding:4px 0; }
.sidebar-zone-right .zone-label-right{ font-size:11px; color:#64748b; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
.sidebar-zone-right .el-radio-group{ display:flex; flex-direction:column; width:100%; }
.sidebar-zone-right .el-radio-button{ width:100%; }
.sidebar-zone-right .el-radio-button__inner{ width:100%; text-align:center; border-radius:8px!important; font-size:12px; font-weight:600; padding:6px 4px; border-left:none!important; }
.board-main{ flex:1; overflow:hidden; display:flex; min-width:0; }
.board-main-list{ flex-direction: column; }
.board-main-list .table-list-view{ flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.board-fullpage{ position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 40; }
.board-main-list .list-hero,.board-main-list .list-filter-row,.board-main-list .list-topbar{ flex: 0 0 auto; }
.list-table-wrap{ flex: 1; min-height: 0; }
.board-toolbar{ display:none; }
.toolbar-left,.toolbar-side,.toolbar-zone-inline,.toolbar-divider{ display:none; }
.board-filter-bar{ display:none; }
.board-footer{ display:none; }
.table-list-view,.table-search-view{ flex:1; overflow:auto; padding:18px 24px 24px; background:#f3f6fb; }
.list-topbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.list-title{ display:inline-flex; align-items:center; gap:10px; font-size:20px; font-weight:800; color:#1e293b; }
.list-title i{ display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#3b82f6,#2563eb); color:#fff; font-size:18px; box-shadow:0 6px 16px rgba(37,99,235,.28); }
.list-close{ display:flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:50%; background:#ef4444; color:#fff; font-size:16px; line-height:1; cursor:pointer; transition:all .15s; }
.list-close:hover{ background:#dc2626; transform:scale(1.1); }
.list-close:active{ transform:scale(.95); }
.list-hero{ display:flex; align-items:center; min-height:58px; margin-bottom:14px; padding:0 18px; border:1px solid #dfe8f3; border-radius:10px; background:linear-gradient(135deg,#fff,#f7fbff); box-shadow:0 3px 12px rgba(36,61,91,.05); }
.list-hero-stats{ display:flex; align-items:center; flex-wrap:wrap; gap:24px; flex:1; }
.stat-item{ display:inline-flex; align-items:center; gap:8px; color:#526277; font-size:13px; font-weight:600; white-space:nowrap; }
.stat-item .dot{ width:8px; height:8px; box-shadow:none; }
.list-leave{ margin-left:auto; cursor:pointer; color:#f56c6c; font-size:18px; font-weight:800; display:inline-flex; align-items:center; gap:6px; padding:6px 16px; border:1px solid #f56c6c; border-radius:8px; transition:all .12s; }
.list-leave:hover{ background:#f56c6c; color:#fff; }
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
.sb-printed{ color:#b8860b; background:#fff8e1; }
.sb-settled{ color:#2e7d32; background:#e8f5e9; }
.list-amount{ color:#dc2626; font-weight:800; }
.list-enter-btn{ color:#fff; background:#2878c7; font-weight:600; border:none; padding:4px 12px; border-radius:6px; cursor:pointer; transition:all .15s; }.list-enter-btn:hover{ background:#1d6ab5; box-shadow:0 2px 6px rgba(40,120,199,.3); }
.table-row-qr td{ background:#fffafa !important; }
.table-row-busy td{ background:#fbfefb !important; }
.table-row-relisted td{ background:#fdfaff !important; }
.table-row-printed td{ background:#fffaf0 !important; }
.table-row-free td{ background:#fcfdff !important; }
.table-row-settled td{ background:#f0faf0 !important; }
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
.combo-btn{ padding: 8px; text-align: center; }
.combo-img{ width: 42px; height: 42px; object-fit: cover; border-radius: 5px; margin-bottom: 3px; }
@media (max-width: 1200px){
  .left-panel{ flex: 0 0 42%; }
  .ot-grid{ gap: 4px; }
  .ot-big-num{ font-size: 22px; padding: 4px 8px; min-width: 0; }
  .ot-cap{ font-size: 10px; letter-spacing: .5px; }
  .head-back{ padding: 6px 10px; font-size: 12px; }
}
@media (max-width: 900px){
  .cat-bar{ grid-template-columns: repeat(2, 1fr); max-width: 340px; }
  .board-card{ height: 130px; }
  .bc-no{ font-size: 30px; }
  .left-panel{ flex: 0 0 100%; }
  .right-panel{ flex: 0 0 100%; }
  .main{ flex-direction: column; }
}
@media (max-width: 600px){
  .cat-bar{ grid-template-columns: repeat(2, 1fr); max-width: 300px; }
}
</style>
<style>
.split-table-dialog{ display: flex; flex-direction: column; overflow: hidden; height: 100vh; }
.split-table-dialog .el-dialog__body{ flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding: 16px; }
.split-layout{ flex: 1; min-height: 0; display: flex; gap: 16px; }
.split-main{ flex: 1; min-height: 0; display: flex; flex-direction: column; }
.split-side{ width: 380px; flex-shrink: 0; display: flex; flex-direction: column; border-left: 1px solid #e4e7ed; padding-left: 16px; }
.split-target{ display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #f5f7fa; border-radius: 8px; margin-bottom: 12px; }
.split-target-label{ font-size: 14px; color: #606266; }
.split-target-no{ font-size: 22px; font-weight: 800; color: #409eff; }
.split-table-dialog .split-panels{ flex: 1; min-height: 0; }
.split-table-dialog .split-list{ max-height: none; flex: 1; min-height: 0; }
.split-table-dialog .split-main .split-toolbar .el-button{ font-size: 15px; }
.split-table-dialog .split-main .split-title{ font-size: 16px; }
.split-table-dialog .split-main .split-item{ font-size: 15px; padding: 6px 8px; }
.split-table-dialog .split-main .split-item-sub{ font-size: 14px; }
.split-table-dialog .split-main .split-step-btn{ width: 26px; height: 26px; line-height: 22px; font-size: 15px; }
.split-table-dialog .split-main .split-step-val{ min-width: 20px; font-size: 15px; }
.split-table-dialog .split-main .split-arrows .el-button{ width: 32px; height: 32px; font-size: 16px; }
.table-op-dialog .el-dialog__title{ color:#f56c6c; font-weight:700; }
.pos-dialog .el-dialog__headerbtn .el-dialog__close{ color:#f56c6c; font-size:24px; font-weight:700; }
.pos-dialog .el-dialog__headerbtn:hover .el-dialog__close{ color:#f56c6c; }
.el-dialog.modcat-food-dialog{ position: absolute; top: 0; bottom: 0; left: var(--item-edit-left, 60px); right: 0; margin: 0; width: auto; display: flex; flex-direction: column; overflow: hidden; }
.el-dialog.modcat-food-dialog .el-dialog__header{ padding-bottom: 0; }
.el-dialog.modcat-food-dialog .el-dialog__body{ flex: 1; min-height: 0; overflow: auto; padding-top: 4px; }
.mandatory-alert{ width:720px; border-radius:20px; }
.mandatory-alert .el-message-box__title{ font-size:30px; font-weight:800; color:#f56c6c; }
.mandatory-alert .el-message-box__message{ padding:28px 0; }
.mandatory-big{ font-size:120px; font-weight:900; color:#f56c6c; line-height:1.15; letter-spacing:10px; text-align:center; }
.mandatory-alert .el-message-box__btns .el-button{ font-size:24px; padding:14px 44px; border-radius:12px; background:#f56c6c; border-color:#f56c6c; color:#fff; }
.mandatory-alert .el-message-box__btns .el-button:hover{ background:#e64545; border-color:#e64545; color:#fff; }
.back-to-board-alert{ width:480px; border-radius:18px; padding:8px; box-shadow:0 12px 40px rgba(0,0,0,.28); overflow:hidden; }
.back-to-board-alert .el-message-box__header{ padding:22px 24px 0; }
.back-to-board-alert .el-message-box__title{ font-size:22px; font-weight:800; color:#f56c6c; letter-spacing:1px; }
.back-to-board-alert .el-message-box__content{ padding:18px 24px 4px; }
.back-to-board-alert .el-message-box__message{ font-size:18px; color:#1f2937; line-height:1.6; }
.back-to-board-alert .el-message-box__message p{ margin:0; }
.back-to-board-alert .el-message-box__status.el-icon-warning{ font-size:30px !important; top:50%; transform:translateY(-50%); }
.back-to-board-alert .el-message-box__btns{ padding:8px 24px 22px; }
.back-to-board-alert .el-message-box__btns .el-button{ font-size:17px; padding:11px 32px; border-radius:12px; font-weight:700; }
.back-to-board-alert .el-message-box__btns .el-button--primary{ background:linear-gradient(135deg,#f56c6c,#e64545); border-color:#e64545; }
.back-to-board-alert .el-message-box__btns .el-button--primary:hover{ background:linear-gradient(135deg,#e64545,#d13838); border-color:#d13838; color:#fff; }
.back-to-board-alert .el-message-box__btns .el-button--default{ background:#f1f5f9; border-color:#e2e8f0; color:#475569; }
.back-to-board-alert .el-message-box__btns .el-button--default:hover{ background:#e2e8f0; border-color:#cbd5e1; color:#1e293b; }
.plu-drawer .el-drawer__body{ display:flex; flex-direction:column; }
.plu-drawer .number-pad{ flex:1; width:100%; }
.plu-fn-keys{ display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-top:12px; }
.plu-fn-key{ height:54px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800; color:#fff; cursor:pointer; user-select:none; transition:all .12s; box-shadow:0 3px 10px rgba(0,0,0,.12); }
.plu-fn-key:hover{ transform:translateY(-1px); box-shadow:0 5px 16px rgba(0,0,0,.2); }
.plu-fn-key:active{ transform:scale(.95); box-shadow:0 1px 2px rgba(0,0,0,.1); }
.plu-fn-add{ background:linear-gradient(135deg, #409eff, #337ecc); }
.plu-fn-send{ background:linear-gradient(135deg, #67c23a, #529b2e); }
.plu-fn-serving{ background:linear-gradient(135deg, #e6a23c, #cf9236); }
.plu-fn-exit{ width:100%; height:64px; margin-top:12px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:900; letter-spacing:6px; color:#fff; cursor:pointer; user-select:none; background:linear-gradient(135deg, #f56c6c, #e64545); box-shadow:0 4px 14px rgba(245,108,108,.4); transition:all .12s; }
.plu-fn-exit:hover{ transform:translateY(-1px); box-shadow:0 6px 20px rgba(245,108,108,.55); }
.plu-fn-exit:active{ transform:scale(.97); box-shadow:0 2px 6px rgba(245,108,108,.35); }
.hw-plu-hint{ position:fixed; top:14px; left:50%; transform:translateX(-50%); z-index:3000; display:flex; align-items:center; gap:10px; background:rgba(31,42,63,.95); color:#fff; padding:10px 18px; border-radius:14px; box-shadow:0 8px 30px rgba(0,0,0,.35); font-size:16px; }
.hw-plu-label{ color:#94a3b8; letter-spacing:2px; font-weight:600; }
.hw-plu-value{ font-size:28px; font-weight:900; letter-spacing:2px; color:#ffd04d; }
.hw-plu-help{ color:#cbd5e1; font-size:12px; }
.share-table-dialog{ border-radius:14px; }
.share-table-dialog .el-dialog__header{ display:none; }
.share-table-dialog .el-dialog__body{ padding:20px; }
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

/* === 結帳面板 Eats365 風格 === */
.pay-overlay{ position:fixed; top:0; left:0; right:0; bottom:0; z-index:3000; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; animation: fadeIn .2s; }
@keyframes fadeIn{ from{opacity:0} to{opacity:1} }
.pay-panel{ display:flex; width:94vw; max-width:1300px; height:90vh; max-height:820px; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,.3); }

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
.pay-sum-num{ color:#f01414; font-size:28px; font-weight:800; }

/* 右側：付款操作區 */
.pay-right{ flex:1; display:flex; flex-direction:column; padding:18px 24px; }
.pay-right-header{ margin-bottom:14px; }
.pay-pr-title{ font-size:18px; font-weight:700; color:#303133; }

/* 付款方式按鈕網格 */
.pay-method-grid{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:18px; }
.pay-method-btn{ display:flex; flex-direction:column; align-items:center; justify-content:center; padding:14px 8px; border:2px solid #e5eaf2; border-radius:12px; cursor:pointer; transition:all .15s; background:#fff; }
.pay-method-btn:hover{ border-color:#c0c4cc; background:#f5f7fa; }
.pay-method-btn.active{ border-color:#409eff; background:#ecf5ff; box-shadow:0 0 0 1px #409eff; }
.pay-method-icon{ font-size:26px; color:#606266; margin-bottom:4px; }
.pay-method-btn.active .pay-method-icon{ color:#409eff; }
.pay-method-label{ font-size:15px; font-weight:600; color:#303133; }
.pay-method-btn.active .pay-method-label{ color:#409eff; }

/* 現金專區 */
.pay-cash-section{ flex:1; min-height:0; display:flex; flex-direction:column; overflow-y:auto; }
.pay-cash-display{ text-align:center; margin-bottom:10px; }
.pay-cash-label{ font-size:15px; color:#909399; margin-bottom:4px; }
.pay-cash-amount{ font-size:44px; font-weight:800; color:#303133; letter-spacing:1px; }

/* 快速金額按鈕 */
.pay-quick-row{ display:flex; gap:8px; margin-bottom:12px; }
.pay-quick-btn{ flex:1; text-align:center; padding:14px; border:1.5px solid #dcdfe6; border-radius:10px; font-size:17px; font-weight:700; color:#303133; cursor:pointer; transition:all .15s; background:#fff; }
.pay-quick-btn:hover{ border-color:#409eff; color:#409eff; background:#f5faff; }

/* 數字鍵盤 */
.pay-numpad{ display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:10px; }
.pay-np-key{ text-align:center; padding:14px; border:1px solid #e5eaf2; border-radius:10px; font-size:22px; font-weight:600; color:#303133; cursor:pointer; transition:all .1s; background:#fff; user-select:none; }
.pay-np-key:active{ background:#ecf5ff; border-color:#409eff; transform:scale(.96); }
.pay-np-del{ color:#f56c6c; }

/* 找零 */
.pay-change-row{ text-align:center; padding:8px; font-size:14px; font-weight:700; color:#67c23a; background:#f0f9eb; border-radius:8px; margin-bottom:8px; }
.pay-change-val{ font-size:20px; margin-left:6px; }
.pay-change-neg{ color:#f56c6c; background:#fef0f0; }

/* 非現金提示 */
.pay-noncash-hint{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#909399; font-size:14px; }
.pay-noncash-icon{ font-size:48px; color:#67c23a; margin-bottom:12px; }

/* 小費（僅信用卡） */
.pay-tip-section{ margin-bottom:14px; padding:14px; border:1.5px solid #e5eaf2; border-radius:12px; background:#fafbfd; }
.pay-tip-row{ display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.pay-tip-label{ font-size:15px; font-weight:700; color:#303133; white-space:nowrap; }
.pay-tip-input-wrap{ flex:1; display:flex; align-items:center; border:1.5px solid #dcdfe6; border-radius:8px; padding:0 10px; background:#fff; }
.pay-tip-dollar{ font-size:18px; font-weight:700; color:#909399; margin-right:6px; }
.pay-tip-input{ flex:1; border:none; outline:none; padding:10px 0; font-size:18px; font-weight:700; color:#303133; background:transparent; }

/* 操作按鈕 */
.pay-actions{ display:flex; gap:12px; margin-top:auto; padding-top:14px; border-top:1px solid #e5eaf2; }
.pay-btn-cancel{ flex:1; text-align:center; padding:14px; border:1.5px solid #dcdfe6; border-radius:10px; font-size:15px; font-weight:600; color:#606266; cursor:pointer; transition:all .15s; }
.pay-btn-cancel:hover{ border-color:#f56c6c; color:#f56c6c; }
.pay-btn-confirm{ flex:2; text-align:center; padding:14px; border:none; border-radius:10px; font-size:16px; font-weight:700; color:#fff; background:linear-gradient(135deg,#409eff,#2878c7); cursor:pointer; transition:all .15s; box-shadow:0 4px 14px rgba(64,158,255,.35); }
.pay-btn-confirm:hover{ background:linear-gradient(135deg,#66b1ff,#409eff); transform:translateY(-1px); }
.pay-btn-confirm.disabled{ opacity:.45; pointer-events:none; }

/* 右鍵管理選單 */
.table-context-menu{ position:fixed; z-index:9999; background:#fff; border-radius:8px; box-shadow:0 4px 20px rgba(0,0,0,.18); padding:6px 0; min-width:180px; }
.ctx-menu-item{ padding:10px 18px; font-size:14px; color:#303133; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background .15s; }
.ctx-menu-item:hover{ background:#ecf5ff; }
.ctx-menu-item i{ font-size:16px; }
.ctx-danger{ color:#f56c6c; }
.ctx-danger:hover{ background:#fef0f0; }
.ctx-disabled{ color:#c0c4cc; cursor:default; pointer-events:none; }
</style>
