# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

orderSYS is a lightweight restaurant POS (Point of Sale) ordering system for small-to-medium restaurants. It includes:
- **POS Frontend** (`/pos`): Table status, ordering, printing, checkout
- **Admin Backend** (`/admin`): Management for commodities, categories, tables, staff, printers
- **QR Ordering** (`/index/:id`): Customer self-service ordering via QR codes
- **Electronic Menu** (`/emenu/:id`): Wall-screen digital menu board
- **Self-service Kiosk** (`/kiosk`): Customer ordering + payment (八達通/行動支付 only, zero payment-gateway integration)
- **Self-service Payment Kiosk** (`/paykiosk`): Payment-only machine (order number or barcode scan → 八達通/行動支付)
- **Queue System** (`/queue`, `/queue/kiosk`): HK-style 排隊叫號 (取票 + 顯示屏 + 語音叫號)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 2 + Vue Router + Vuex + Element UI + Axios |
| Backend | Node.js + Express + Passport (JWT) + DAL (`db/model.js`) |
| Database | PostgreSQL |
| Realtime | Socket.IO |
| Printing | ESC/POS thermal printers (TCP :9100) via `plugins/Printer.js`; BullMQ + Redis 出單佇列 (`plugins/printQueue.js`) |

## Development Commands

```bash
# Backend
node server.js                    # Start backend (port 3000)

# Frontend
cd client
npm run serve                     # Dev server with hot-reload (port 8080)
npm run build                     # Production build to client/dist/
npm run lint                      # ESLint check

# Production
cd client && npm run build && cd ..
node server.js                    # Serves static files from client/dist/
```

## Architecture

### Backend (`server.js`)
- Express server listening on `0.0.0.0:3000`; the HTTP listener starts only after the database connects
- Runs versioned DB migrations (`db/migrate.js` → `db/migrations/`) on startup before the HTTP listener starts — see Database Migrations
- Seeds default `Amount` payment methods (現金/信用卡/行動支付/八達通) and pay types (堂食/外賣自取) on startup
- Serves static files from `./public` and `./client/dist`
- SPA history fallback for all routes

### Database Migrations
- Versioned migration runner in `db/migrate.js`; runs on startup before the HTTP listener starts, tracked by a `schema_migrations` table so each migration runs exactly once
- Migration files live in `db/migrations/`, named `{version}_{name}.{sql|js}` (e.g. `001_add_orders_locked_at.sql`, `002_backfill_commodity_category_id.sql`); applied in order of the numeric `version` prefix
- `.sql` files run as raw SQL; `.js` files export an `up(client)` function (or the module itself) for data migrations
- Each migration is wrapped in a transaction; on failure it rolls back and the server aborts startup
- Standard flow for a new column: 1) add `db/migrations/00N_xxx.sql` (idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), 2) add the field to the model's `makeModel(...)` fields, 3) bump version + ship

### Authentication & Authorization
- **Admin users**: `models/User.js` — JWT token stored in `localStorage.orderTk`
- **Staff (POS)**: `models/Staff.js` — Separate JWT with `kind: 'staff'` claim
- Passport strategy in `config/passport.js` handles both token types (Bearer token from `Authorization` header); admin vs. staff resolved by the `kind` claim
- Permission checks live in `middleware/auth.js`: `requireAdmin` (admin `users` only) and `requireLevel(n)` (admin accounts count as level 4; staff use `permissionLevel`, falling back to the `role` text)

### API Routes (`routes/api/`)
- `/api/users` — Admin user auth & CRUD
- `/api/staff` — POS staff auth & CRUD
- `/api/commodity`, `/api/category` — Product management
- `/api/order` — Order creation, checkout, void, refund, transfer/split/copy (複印單據)
- `/api/table`, `/api/zone` — Table & zone management
- `/api/printer`, `/api/possetting`, `/api/posterminal` — Printer config, POS button config, POS terminals
- `/api/combo`, `/api/modcode` — Combos & modification codes
- `/api/matchingrule` — 撞餐規則 (independent cross-item price-matching rule table) CRUD + public `/list`
- `/api/print` — Bull Board 監控會話 (`POST /queueui-session`，供 PrintMonitor 內嵌 iframe 免 Basic Auth)
- `/api/statistic` (implemented in `statisticData.js`) — Reports & analytics
- `/api/qrsetting`, `/api/qrcode` — QR ordering config & code generation
- `/api/shop`, `/api/init` — Shop profile & first-run setup
- `/api/amount`, `/api/businessday`, `/api/clock` — Payment/order types; business-day settlement (`current`, `dayReport`, `close` — blocks when unsettled orders exist, `list`); staff shift clock-in/out
- `/api/emenu` — Electronic menu settings (singleton)
- `/api/kiosk` — Self-service kiosk/payment-machine settings + public order lookup/pay
- `/api/queue` — HK-style queue/number-calling (叫號) system (tickets, state, calling)
- `/api/systemmaint` — Admin-only: full DB `backup`/`importdb`, menu `exportmenu`/`importmenu` (categories/categoryitems/commodities/combos/modcodes/modcodecategories), ISM XML import `importism` (宏軟 POS `department.xml`/`item.xml`/etc → categories/commodities/departments, with commodity `department` populated from `dept_id`; `lookup_header.xml`/`lookup_details.xml` → 改碼類別 + 改碼, mapping `lookup_header.compulsory='1'` → `ModCodeCategory.mandatory` 自動彈出), and `clearbusinessdata` (orders/businessdays/clockrecords/chartsdata)

### Frontend (`client/src/`)
- Vue 2 with Vue Router (history mode)
- Vuex store for auth state only (`isAuthenticated`, `user`)
- Axios interceptors: auto-attach JWT, handle 401 redirects
- Socket.IO integration for real-time order notifications
- Route guard (`client/src/router/index.js`): `/login`, `/init*`, `/index/*`, `/pos`, `/emenu/*`, `/kiosk`, `/paykiosk`, and `/queue*` are public; other `/admin/*` routes require `localStorage.orderTk`

### Initialization Flow
- First-run setup at `/init/admin`: create admin account → set shop info → `/init/complete`
- `server.js` seeds default payment methods and pay types on startup (see Backend section)

### Key Models
- **Order**: Contains `order` array (items), `state` (0=unfinished/open, 1=settled/closed), `source` (`pos`/`qr`/`extension`/`kiosk`), `printed` (sent to kitchen), `voidStatus`, payment fields, and `businessDayId`/`shiftId` refs
- **Commodity**: Has `categoryId` (_id 字串 ref), `station`/`stations` (printer routing), `department` (部門, string populated from ISM `item.xml` `dept_id` on import and used for report aggregation), `plu` (PLU code), `showOnPos`/`showOnQr` (channel visibility), `stock`/`soldOut` for inventory-based sold-out, plus `mainGroupId`/`bundleGroupId` (主菜組別/跟餐組別 _id 字串 refs for 撞餐規則)
- **PosSetting** (singleton): POS layout/theme (`orderLayout`/`orderTheme`/`panels`, `freeLayoutEdit` design mode), per-button permissions (`btnPerms` + `buttonOrder`, defaults in `DEFAULT_BTN_PERMS`), `managerMenu` (經理功能選單 — manager-login-gated funcCodes; default `18`/`17`/`44`/`43` where `44` is 複印單據), `serviceChargeRate`/`roundingMode`, time-slot jump-price rules (`jumpPriceRules`, `publicHolidays`) and 分市時間 `slots` (report grouping), `businessDayCutoff` (cross-midnight day boundary), and order-number prefixes (`dineInPrefix`/`takeawayPrefix`)
- **Staff**: `permissionLevel` field determines POS permission (1=waiter, 2=cashier, 3=manager, 4=admin); `no` is the login ID; admin `User` accounts are treated as level 4
- **AuditLog**: records sensitive admin/POS actions for traceability
- **ClockRecord**: staff shift clock-in/out records
- **BusinessDay**: financial-day tracking keyed by `date` (YYYY-MM-DD, derived from `businessDayCutoff`); `status` (open/closed), `startingCash`/`countedCash`, `paidOuts`/`receiveds` arrays (代支/代收, via `POST /api/businessday/paidOut` and `/received`), and a `snapshot` of the day's totals (incl. `paidOutTotal`/`receivedTotal`) written at settlement (`POST /api/businessday/close`). Orders reference it via `businessDayId`; `shiftId` is a dangling ref (no Shift model exists yet)
- **Shop, Table, Zone, Printer, PosTerminal, Amount, QrSetting**: shop profile, table/zone layout, printer config, terminal identifiers, seedable payment/order types, and QR-ordering display toggles
- **ModCode / ModCodeCategory**: customization modifiers (走蔥/加辣/加價) with `price`, `specs` (價格1～價格10 multi-price; 價格1 is the base, 「填滿」 copies it into 2–10), `station` (print routing), `mandatory`, `maxSelect`, and POS `quickKey`; grouped under mod-code categories (admin page `ModCode.vue` uses a split layout — left category list, right filtered mod codes; deleting a category is blocked while it still has mod codes). `ModCodeCategory` has `mandatory` (自動彈出) — when true, POS auto-opens the mod dialog on adding an item whose `modCategories` includes that category; set from ISM `lookup_header.compulsory='1'` during `importism` and editable in the category add/edit dialog
- **Combo**: combo meals — `type` `select` (選單式合菜) / `fixed` (固定式桌菜), with `groups` of min/max-selectable items, each item supporting `modifiers` and `substitutes`. Also carries 撞餐 fields: `mainDishes` (主食綁定，點擊自動帶出跟餐), `autoPopup`, `autoBundle` (`false`=不參與 / `true`=強制 / 未設=依類型), `bundlePriority`, `mainGroupId` (主菜組別 `MainGroup._id`，撞餐規則主食側記認；套餐也可當主食側參與撞餐，見 `isBundlableItem`), `effectiveTime` (撞餐時段), and `noPrintComboName` (不列印套餐名 — 後廚/服務票種拆成子品項獨立打印，收據/印單小票仍保留套餐名)
- **Category**: recursive tree of menu categories (`parentId` nesting, `no` sibling sort, `rootOrder` top-level POS order); per-category `department`, `serviceModes`, `channels` (pos/qr), `effectiveTime` (POS/QR scheduling), `slots` (time-slot grouping), `colorFrom`/`colorTo`/`textColor` (tab gradient), and `modCategories` (array of `ModCodeCategory.name`, managed via the category UI). Deleting a category is guarded against orphaned children/items; sibling reorder uses `POST /api/category/swapOrder`. The admin page (`Category.vue`) has a right-panel tab switch 內容 / **POS 預覽** — the POS preview renders a POS register mock (top-level gradient pills → drill-down child tiles → food list) derived from `parentId` + `GET /api/category/:id/items`, filtered to POS-channel + `active` categories, mirroring `catPillStyle`/`catTileStyle` in the POS `Index.vue` (no backend changes)
- **CategoryItem**: ordered membership linking a category to child `category`/`combo`/`commodity` entries (`targetType`) with `sortOrder`; auto-created/moved on commodity add/edit via `ensureCategoryItem()` in `routes/api/commodity.js` and removed on delete — the POS menu only shows commodities that have a `CategoryItem` record
- **Department**: 部門管理 (kitchen/水吧/燒味/點心…); `name` (required), `code`, `sort`, `active`; commodities link via a plain-string `department` field (not an _id 字串 ref); seeded from ISM `department.xml` on `importism`
- **KioskSetting** (singleton): self-service kiosk/payment-machine settings — `paymentMethods` (default 八達通/行動支付), `fpsQrImage`, `showImages`, `terminalCode`, `dineIn`, `takeaway`, `payByOrderNo`
- **MenuSetting** (singleton): electronic menu (電子Menu) wall-screen settings
- **QueueSetting** (singleton): HK-style queue config — `enabled`/`voiceEnabled`, `title`/`subtitle`, and `categories` (prefix/label/minPax/maxPax/color; default A=1-2人, B=3-4人, C=5人以上)
- **QueueTicket**: per-day queue tickets keyed by `date`; `category` + `number` → `ticketNo` (e.g. `A001`), `pax`, `status` (`waiting`/`called`/`seated`/`skipped`/`cancelled`), `calledAt`/`seatedAt`
- **MainGroup / BundleGroup**: 主菜組別 / 跟餐組別 (撞餐規則用的分組) — each a simple `name` (required) list; commodities link via `Commodity.mainGroupId` / `Commodity.bundleGroupId`, and combos can also be 主食側 via `Combo.mainGroupId` (套餐也可當主菜參與撞餐規則)
- **MatchingRule**: 撞餐規則獨立規則表 (cross-item price matching without defining a combo) — `name`, `enabled`, `priority`, `triggerGroupIds` (主菜組別，空=任意主食), `bundleGroupIds` (跟餐組別，空=任意跟餐，跟餐價取自 `addonPrice`), `addonPrice` (跟餐價 — 撞餐時跟餐的加購價，主食保留原價), `effectiveTime`. POS and QR each convert rules into virtual combos (`matchingRuleCombos`; 主食 `upgradePrice=item.price`、跟餐 `upgradePrice=addonPrice` 或組別價、`combo.price=0`，即總價=主食原價+跟餐價) and feed `computeBundles`

### POS Frontend (`client/src/views/pos/Index.vue`)
- Main POS container (table status grid, ordering panel, cart, checkout flow); dialogs/panels are extracted into `client/src/components/pos/` (e.g. `PayDialog`, `ComboDialog`, `TableDialog`, `TransferDialog`, `BatchPrintDialog`)
- Table operations: merge, split, transfer, add/release tables; hold/recall (掛單/叫回); sold-out settings with inventory-based auto-sold-out
- 複印單據 (copy order) is a manager-menu function (`POST /api/order/copyOrder`, funcCode `44`, not shown in the main dock — see `MANAGER_FUNC_IDS` in `Index.vue`): select source table → confirm → select target table, deep-copies items with `sent` reset
- Function buttons are driven by `BUTTON_META` + `DEFAULT_BUTTON_ORDER` (main dock) and `resolvedManagerMenu` (manager menu); `buttonOrder`/`managerMenu` are saved per-store in `PosSetting`
- Cash-move function keys 代支 (`paidOut`, funcCode `45`) / 代收 (`received`, funcCode `46`) use `CashMoveDialog` and record into `BusinessDay.paidOuts`/`receiveds` via `POST /api/businessday/paidOut` & `/received`; 更改價格 (`changePrice`, funcCode `47`) sets `customPrice` on a cart item
- All POS `el-dialog`s use `append-to-body`; shared class `pos-dialog` styles the red, larger top-right close X, and `table-op-dialog` makes the dialog title red (both defined in the non-scoped `<style>` block of `Index.vue`)
- Sent items in the cart keep showing a read-only quantity + subtotal (unit price also in the ticket view); a re-added same item opens a new line marked 「新」
- Communicates with backend via REST API and Socket.IO
- Mod-code category `mandatory` (自動彈出): when adding a cart item whose `modCategories` contains a mandatory category, `addFood`/`confirmOpenPrice` call `autoOpenMandatoryMods()` → `openItemDialog()` to auto-open the mod selection (mod codes/categories are loaded via `/api/modcode/list?channel=pos` and `/api/modcode/categories`)
- 撞餐 (bundle): pure logic in `client/src/utils/bundle.js` (`computeBundles`, `isBundlableItem`, `isBundlableCombo`, `isEffectiveNow`). POS loads combos + matching rules in `loadMenu`; `bundlePlan`/`bundleOn`/`bundleSavings` subtract savings from `totalPrice`, `autoDetectBundle` auto-applies on cart change (`bundleMode` auto/both), `toggleBundle` is the manual key (funcCode `bundle`). At submit, `buildBundleSubmitItems` converts regular-combo matched singles into synthetic combo items, but matching-rule bundles (`_matchingRule`) are split via `buildMatchingRuleSubmitItems` into separate lines — 主食 keeps original price, 跟餐 is re-priced to `addonPrice` — so the receipt shows 主食原價 + 飲品跟餐價 as separate lines (no rule-name wrapper). Global on/off/mode/rule from `PosSetting` (`bundleEnabled`/`bundleMode`/`bundleRule`). 撞餐規則: `matchingRuleCombos` computed builds virtual combos from `MatchingRule` (組別-based，主菜組別×跟餐組別) merged into `bundleCombos`. Admin pages: `Bundle.vue` (撞餐設定), `MatchingRule.vue` (撞餐規則), `MainGroup.vue`/`BundleGroup.vue` (主菜/跟餐組別) under 菜譜管理
- QR ordering also applies 跟餐價: `Commodities.vue` loads `/api/matchingrule/list`, builds `matchingRuleCombos`/`bundlePlan`/`effectiveOrder` (re-pricing 跟餐 to `addonPrice` + mods) and passes `effectiveOrder` to `ShopCart.vue`, which uses it for `totalPrice` and the submitted order
- QR 套餐印單檔口與 POS 一致: `ComboPicker.vue` 提交時每個子品項都帶 `commodityId`/`_id`，後端 `routes/api/order.js` 的 `enrichDept` 藉此解析 `station`（否則空 station 會跳飛到「通用」檔口）；`　· ` 改碼子行若無 station 會繼承父品項的 station

### Self-service Kiosk (`client/src/views/kiosk/Index.vue`)
- Customer-facing ordering + payment state machine (`home`/`table`/`lookup`/`order`/`pay`/`done`)
- Dine-in passes `deskNo` (table string) + `zone: '堂食'`; takeaway passes `deskNo: 0` + `zone: '外賣'`
- Submits with `source: 'kiosk'`; `POST /api/order/submit` returns JSON `{ orderNo, totalPrice, isAdd }` (kiosk only; POS/QR still get the string response)
- Kiosk orders auto-print kitchen-only (like QR); `POST /api/kiosk/pay` marks the order settled (`state=1`) + `payMethod` and prints a receipt
- Reuses `CommodityDetail` and `ComboPicker` components from the QR ordering flow

### Self-service Payment Kiosk (`client/src/views/paykiosk/Index.vue`)
- Payment-only machine: order-number input (auto-focused for barcode scanners, Enter triggers lookup) + on-screen numeric keypad → order summary → 八達通/行動支付 buttons → `POST /api/kiosk/pay`
- Reuses the same public `/api/kiosk/order/:orderNo` and `/api/kiosk/pay` endpoints as the full kiosk

### Electronic Menu (`client/src/views/emenu/Index.vue`)
- Wall-screen digital menu board driven by `/api/emenu/setting` and menu endpoints

### Queue System (叫號系統)
- HK-style 排隊叫號 with party-size categories (default A=1-2人, B=3-4人, C=5人以上); ticket numbers like `A001`
- Frontend views: `/queue` (顯示屏 `Display.vue`), `/queue/kiosk` (自助取票機 `Ticket.vue`), `/admin/queue` (後台控制 `Queue.vue`)
- Public API: `GET /api/queue/setting`, `GET /api/queue/state`, `POST /api/queue/take`; JWT-protected: `POST /setting`, `POST /callNext`, `POST /recall`, `POST /updateStatus`, `GET /history`
- Realtime: emits Socket.IO `queueChanged` event; display/control panels refresh via the `sockets` mixin
- Voice calling on the display screen via `window.speechSynthesis` (`zh-HK`); `voiceEnabled` toggle in settings

### Printer System (`plugins/Printer.js`)
- ESC/POS protocol for **network printers only** (raw TCP socket to `ip:9100` via `net.connect`; no OS driver needed). **USB is not currently supported.**
- Supports both thermal (感熱) and dot-matrix/impact (針式, e.g. Epson TM-U220) printers; each station printer has a `tech` field (`thermal` default / `dot`), plus `model` (型號預設: `tmt88`/`xp80ts`/`tmu220`/`''`) and `dpi` (180/203). The admin UI auto-fills `tech`/`dpi`/`paperWidth` when a model is selected (e.g. XP-80TS → thermal/203dpi/80mm)
- `initPrinter()` forces `tech === 'dot'` printers into **text mode** (built-in Chinese font) and ignores the global `imagePrint` setting, because dot-matrix printers do not support the `GS v 0` raster command
- Supports 58mm and 80mm paper widths (reference: 180dpi Epson TM-T88VI → 80mm=512px / 58mm=360px; `pixelWidth(paperWidth, dpi)` scales per-printer `dpi`, e.g. 203dpi XP-80TS → 80mm=576px)
- Chinese charset selectable per printer via `charset`: Big5 (default), GBK/GB2312, GB18030, UTF-8
- `imagePrint` mode (thermal only) renders text server-side (Noto Sans TC, `fonts/NotoSansTC.ttf`) to a bitmap and sends `GS v 0`, for printers without a built-in Chinese font; `imageWeight` controls stroke weight (600 → 1px stroke, 800 → 2px stroke, for bolder/fainter print heads)
- Cash drawer kick (`ESC p`) on cashier/terminal printers via `cashDrawer` / `openDrawerByTerminal`
- Routes print jobs by station/role (`resolvePrinter` matches `name` → `role` → `location`, falls back to `kitchen`); ticket types: kitchen / serving / print / receipt / qrcode / chase, with per-zone (堂食/外賣) long/short kitchen mode (`dineInMode`/`takeawayMode`)
- `buildReceipt` (customer receipt) renders per-item unit price/subtotal via `receiptUnitPrice`; kitchen/serving/expeditor tickets intentionally omit prices
- 營業報表 80mm 列印：`buildReportTicket(setting, report)` renders a fixed-80mm text ticket (label + right-aligned 金額/數量/平均, section titles, bold rows, `折扣` rows from `sections`), printed via `POST /api/printer/printReport` (resolves the receipt/cashier printer with `resolveTicketPrinter(setting, 'receipt')`, forces 80mm, and prints with `escpos.print()` direct like `/test`). The POS `ReportDialog.vue` sends `{ title, subtitle, sections, rows, printTime, operator }` to this endpoint instead of `window.print()`
- **多台打印機注意事項**：每台網絡打印機須有獨立 IP（多台共用同一 IP 會在並發連線時互相超時）。`print()` 內部已實作**按 `ip:port` 的 FIFO 打印佇列**（集中式 spooler：同一 IP 嚴格串行、印完即釋放），並用 `client.end(data, cb)` 等資料 flush 完成才 resolve（不依賴對端 close），加上超時 8s（`printer.timeout` 可覆寫）與自動重試 1 次（應對打印伺服器空閒喚醒）。所有打印一律走 `printWithFailover(...)`（主機 → `fallbackTo` 備援機 → 第一台 `role=kitchen` 通用機），切勿 fire-and-forget 並發連線（`/serveDish` 曾漏 `await` 導致起菜時燒味/小食超時）。
- kitchen 檔口票、receipt/serving/qrcode、傳菜總台/預結單（`expeditor`/`zone`）與印單小票（`print`）均已走 `printWithFailover` 備援跳飛；僅 `routes/api/printer.js` 的測試打印 `/test`、`/testFallback` 與營業報表 `/printReport` 仍用 `escpos.print()` 直連，以正確反映單機狀態。
- **BullMQ 出單佇列**：`plugins/printQueue.js` 以 BullMQ + Redis 實作出單微服務——每台打印機獨立 Queue（concurrency=1）嚴格串行、任務持久化於 Redis、失敗指數退避重試、attempts 耗盡後跳飛備援機；Redis 連線異常時降級回 in-memory FIFO 不漏單。`printQueue.enqueuePrint(setting, printer, data, meta)`（未設 `REDIS_URL` 時沿用既有 in-memory FIFO + 跳飛；需同步結果傳 `{ wait: true }`）。後台 `PrintMonitor.vue`（`/admin/printmonitor`）內嵌 Bull Board（`/admin/queues/`）監控佇列，經 `POST /api/print/queueui-session` 建立會話 cookie 免 Basic Auth。

### License (授權)
- Offline signed license keys (`ORDERSYS.<payload>.<HMAC-SHA256>`) in `utils/license.js`; payload fields: `mid` (machine ID), `exp` (expiry, omit for perpetual), `customer`, `edition`, `features`
- `tools/license-cli.js` CLI: `machineid` (print machine ID) and `generate` (create a key; requires `LICENSE_SECRET`)
- Env vars: `LICENSE_SECRET` (signing key, required in production), `LICENSE_KEY` (or a `license.key` file), `MACHINE_ID` (override auto-detected machine ID — recommended for Docker), `LICENSE_ENFORCE=1` (block all `/api` when invalid/expired)
- Public `/api/license/status` endpoint + startup log; validity reasons: `NO_LICENSE` / `MALFORMED` / `SIGNATURE_MISMATCH` / `MACHINE_MISMATCH` / `EXPIRED`
- **Feature gating (`features`) is not yet enforced — deferred.** Only validity/expiry/machine binding are checked so far.

## Configuration

- `config/config.js`: PostgreSQL 連線字串 `pgConn` (default `postgres://ordersys:ordersys@127.0.0.1:5432/ordersys`, override with `PG_CONN`), JWT secret (override with `JWT_SECRET`; required in `production`, dev fallback `0x3E5-dev-only`), Redis 連線 `redisURL` (`REDIS_URL`), 可寫資料目錄 `publicDir` (`PUBLIC_DIR`)
- `client/vue.config.js`: Dev server proxy for `/api`, `/goods`, `/shop` to backend (includes WebSocket proxy)
- `client/src/main.js`: Socket.IO connection URL (uses `window.location.protocol` + `window.location.hostname:3000`)
- Font: Noto Sans TC (思源黑體) is self-hosted at `client/public/fonts/` (variable woff2, 105 files, 6 weights 400–900); loaded via `client/public/fonts/noto-sans-tc.css` linked in `client/public/index.html`. The font stack in `client/public/css/reset.css` and `client/src/views/pos/Index.vue` (`#pos`) is Apple fonts (macOS) → `Noto Sans TC` (Windows/Linux) → `Microsoft JhengHei` → `Arial` → `sans-serif`.

## Permission Levels

| Level | Role | Capabilities |
|-------|------|--------------|
| 1 | Waiter | Basic ordering, send orders, print |
| 2 | Cashier | Checkout, discounts, sold-out settings |
| 3 | Manager | Merge tables, split bills, transfer, reports, staff permissions |
| 4 | Admin | Full POS access |

## Docker Deployment

Multi-stage build (`Dockerfile`): stage 1 builds Vue frontend, stage 2 runs Node.js backend serving `client/dist/`. Source code is baked into the image, so code changes require a rebuild.

```bash
docker compose up -d --build  # Rebuild + start app (port 3000) + PostgreSQL (port 5432) + Redis (port 6379)
docker compose down
```

Direct (non-Docker) install instructions for Windows/Linux/macOS (PM2/systemd, PostgreSQL) are in `DEPLOY.md`.

## Notes

- No test suite currently configured (`npm test` exits with error)
- Chinese (Traditional) is the primary UI language
- POS frontend runs without authentication (staff login handled within the POS interface)
- Order state: `state` 0 (unfinished/open) → 1 (settled/closed); "sent to kitchen" is tracked by the `printed` boolean, not a `state` value
- Socket.IO broadcasts `checkOrder` and `playAudio` events on new order submission (via the `submitOrder` client event); other data-change events include `menuChanged`, `tableUpdate`, `tableLayoutChanged`, `zoneChanged`, `posSettingChanged`, `queueChanged`, and `modcodeChanged` (mod codes/categories — emitted from `routes/api/modcode.js` on add/update/del/reorder so POS reloads its mod list and 自動彈出 state)
- `PosSetting` supports amount-rounding modes for the payable total: 不取整 / 四舍五入 / 始終進位 / 始終抹零
- Minimum browser: Chrome 109+ / Edge 109+ / Firefox 115 ESR+ (needs woff2 + variable-font support); Internet Explorer 11 is unsupported. Windows 7 is EOL and its last browsers (Chrome/Edge 109, Firefox 115 ESR) no longer receive security updates — see `DEPLOY.md`.
