-- 初始建表：依 models/*.js（makeModel）與手寫 Zone.js 生成
-- 由 db/model.js 暴露的 table/cols/types 元資料自動產生

CREATE TABLE IF NOT EXISTS amounts (
  _id text PRIMARY KEY,
  key text,
  value text,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS auditlogs (
  _id text PRIMARY KEY,
  staff_no text,
  staff_name text,
  action text,
  action_label text,
  desk_no text,
  order_no text,
  detail text,
  amount numeric,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS bundlegroups (
  _id text PRIMARY KEY,
  name text,
  price numeric,
  sort integer,
  active boolean,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS businessdays (
  _id text PRIMARY KEY,
  date text,
  open_time timestamptz,
  close_time timestamptz,
  status text,
  starting_cash numeric,
  counted_cash numeric,
  close_remark text,
  close_seq integer,
  paid_outs jsonb,
  takeaway_seq integer,
  receiveds jsonb,
  snapshot jsonb,
  close_history jsonb,
  opened_by text,
  closed_by text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS categories (
  _id text PRIMARY KEY,
  code text,
  cname text,
  describe text,
  department text,
  sort_no integer,
  active boolean,
  service_modes jsonb,
  channels jsonb,
  effective_time jsonb,
  slots jsonb,
  commodity_order jsonb,
  mod_categories jsonb,
  color_from text,
  color_to text,
  text_color text,
  parent_id text,
  root_order integer,
  report_group text
);

CREATE TABLE IF NOT EXISTS categoryitems (
  _id text PRIMARY KEY,
  category_id text,
  target_id text,
  target_type text,
  sort_order integer,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS chartsdatas (
  _id text PRIMARY KEY,
  date text,
  order_count integer,
  income numeric
);

CREATE TABLE IF NOT EXISTS clockrecords (
  _id text PRIMARY KEY,
  staff_no text,
  staff_name text,
  terminal_code text,
  clock_in_time timestamptz,
  clock_out_time timestamptz,
  status text,
  remark text,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS combos (
  _id text PRIMARY KEY,
  name text,
  qr_name text,
  code text,
  img text,
  describe text,
  category text,
  department text,
  price numeric,
  type text,
  course_control boolean,
  groups jsonb,
  department_split jsonb,
  main_dishes jsonb,
  auto_popup boolean,
  no_print_combo_name boolean,
  auto_bundle boolean,
  bundle_priority integer,
  effective_time jsonb,
  show_items boolean,
  show_fixed_names boolean,
  sold_out boolean,
  show_on_pos boolean,
  show_on_qr boolean,
  main_group_id text,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS commodities (
  _id text PRIMARY KEY,
  img text,
  name text,
  name2 text,
  describe text,
  category text,
  category_id text,
  price numeric,
  is_discount boolean,
  on_sale integer,
  sold_out boolean,
  sold_out_date text,
  stock integer,
  specs jsonb,
  station text,
  stations jsonb,
  mod_categories jsonb,
  department text,
  code text,
  plu text,
  show_on_pos boolean,
  show_on_qr boolean,
  open_price boolean,
  mandatory boolean,
  bundle_group_id text,
  main_group_id text,
  non_business boolean
);

CREATE TABLE IF NOT EXISTS departments (
  _id text PRIMARY KEY,
  name text,
  code text,
  sort integer,
  active boolean,
  show_in_split boolean,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS holds (
  _id text PRIMARY KEY,
  label text,
  zone text,
  desk_no text,
  items jsonb,
  remark text,
  terminal_code text,
  staff_no text,
  staff_name text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS inits (
  _id text PRIMARY KEY,
  admin boolean,
  shop boolean
);

CREATE TABLE IF NOT EXISTS kiosksettings (
  _id text PRIMARY KEY,
  payment_methods jsonb,
  fps_qr_image text,
  show_images boolean,
  terminal_code text,
  dine_in boolean,
  takeaway boolean,
  pay_by_order_no boolean,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS maingroups (
  _id text PRIMARY KEY,
  name text,
  sort integer,
  active boolean,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS matchingrules (
  _id text PRIMARY KEY,
  name text,
  enabled boolean,
  priority integer,
  trigger_group_ids jsonb,
  bundle_group_ids jsonb,
  addon_price numeric,
  effective_time jsonb,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS menusettings (
  _id text PRIMARY KEY,
  show_images boolean,
  show_price boolean,
  show_describe boolean,
  show_sold_out boolean,
  auto_rotate boolean,
  rotate_interval integer,
  columns integer,
  font_scale numeric,
  category_ids jsonb,
  theme_color text,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS modcodes (
  _id text PRIMARY KEY,
  name text,
  code text,
  category text,
  sort integer,
  price numeric,
  specs jsonb,
  channels jsonb,
  mandatory boolean,
  max_select integer,
  station text,
  sold_out boolean,
  quick_key text,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS modcodecategories (
  _id text PRIMARY KEY,
  name text,
  code text,
  mandatory boolean,
  min_select integer,
  max_select integer,
  commodity_ids jsonb,
  sort integer,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS orders (
  _id text PRIMARY KEY,
  order_no text,
  shop_id text,
  desk_no text,
  order_items jsonb,
  remark text,
  zone text,
  source text,
  total_price numeric,
  service_charge numeric,
  discount numeric,
  tax numeric,
  rounding numeric,
  pax integer,
  printer text,
  waiter text,
  cashier text,
  pay_method text,
  tip numeric,
  settled integer,
  subtotal_amount numeric,
  table_type integer,
  subtype integer,
  close_id text,
  tran_type integer,
  void_status integer,
  void_reason text,
  void_reason_code text,
  void_type integer,
  void_date timestamptz,
  void_by text,
  refund_reason text,
  refund_date timestamptz,
  payment_cancel_at timestamptz,
  relisted boolean,
  unsettled_at timestamptz,
  unsettled_by text,
  unsettle_count integer,
  printed boolean,
  reprint_count integer,
  reprint_by text,
  transferred_from text,
  from_action text,
  chased_at timestamptz,
  terminal_code text,
  locked_at timestamptz,
  order_seq text,
  qr_token text,
  takeaway_no text,
  state integer,
  settled_at timestamptz,
  business_day_id text,
  shift_id text,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS possettings (
  _id text PRIMARY KEY,
  service_charge_enabled boolean,
  service_charge_rate numeric,
  service_charge_pre_discount boolean,
  rounding_mode text,
  show_food_images boolean,
  order_layout text,
  order_theme text,
  show_side_nav boolean,
  ticket_side text,
  free_layout_edit boolean,
  slots jsonb,
  button_order jsonb,
  btn_perms jsonb,
  ticket_width integer,
  dock_height integer,
  side_nav_width integer,
  dock_min_h integer,
  panels jsonb,
  btn_pos jsonb,
  btn_colors jsonb,
  panel_colors jsonb,
  panel_opacity jsonb,
  panel_radius jsonb,
  panel_z_index jsonb,
  side_nav_cols integer,
  global_font_size integer,
  pos_font_family text,
  pos_font_url text,
  pos_btn_settings jsonb,
  cat_btn_settings jsonb,
  food_btn_settings jsonb,
  dock_nav jsonb,
  sidebar_settings jsonb,
  sidebar_buttons jsonb,
  hidden_btns jsonb,
  called_tag_style jsonb,
  badge_style jsonb,
  manager_menu jsonb,
  board_layout jsonb,
  card_display jsonb,
  share_table_enabled boolean,
  gesture_enabled boolean,
  dine_in_prefix text,
  takeaway_table_prefix text,
  takeaway_prefix text,
  takeaway_table_from text,
  takeaway_table_to text,
  side_qty_mode text,
  mod_code_ui_mode text,
  reprint_min_level integer,
  dine_in_print_copies integer,
  takeaway_print_copies integer,
  sold_out_daily_reset boolean,
  business_day_cutoff text,
  failover_notify boolean,
  failover_timeout integer,
  public_holidays jsonb,
  tea_charges_required boolean,
  required_category_id text,
  tea_seat_sync_pax boolean,
  serving_new_items_only boolean,
  direct_pay_mode boolean,
  combo_name_once boolean,
  bundle_enabled boolean,
  bundle_mode text,
  bundle_rule text,
  cancel_item_print jsonb,
  cancel_all_print jsonb,
  category_order jsonb,
  qr_category_order jsonb,
  jump_price_enabled boolean,
  jump_price_rules jsonb,
  discount_options jsonb,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS posterminals (
  _id text PRIMARY KEY,
  code text,
  name text,
  location text,
  type text,
  enabled boolean,
  order_prefix text,
  order_seq integer,
  printer_ip text,
  printer_port integer,
  cash_drawer boolean,
  receipt jsonb,
  serving jsonb,
  print jsonb,
  max_permission_level integer,
  allowed_functions jsonb,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS printers (
  _id text PRIMARY KEY,
  shop_name text,
  phone text,
  address text,
  footer text,
  logo text,
  logo_enabled_all boolean,
  logo_enabled boolean,
  logo_enabled_serving boolean,
  logo_enabled_print boolean,
  logo_enabled_qrcode boolean,
  format jsonb,
  format_dot jsonb,
  charset text,
  auto_print boolean,
  image_print boolean,
  image_weight integer,
  thermal_font text,
  dot_image_print boolean,
  dot_image_size integer,
  dot_image_font text,
  dot_image_weight integer,
  name text,
  type text,
  ip text,
  port integer,
  paper_width integer,
  copies integer,
  cash_drawer boolean,
  printers jsonb,
  ticket_targets jsonb,
  zones jsonb,
  central_print jsonb,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS qrcodes (
  _id text PRIMARY KEY,
  url text,
  no integer
);

CREATE TABLE IF NOT EXISTS qrsettings (
  _id text PRIMARY KEY,
  show_images boolean,
  show_describe boolean,
  show_stock boolean,
  show_mod_prices boolean,
  show_sold_out_items boolean,
  show_notice boolean,
  show_detail boolean,
  show_discount boolean,
  theme text,
  font_scale numeric,
  base_url text,
  welcome_image text,
  show_specs boolean,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS queuesettings (
  _id text PRIMARY KEY,
  enabled boolean,
  voice_enabled boolean,
  title text,
  subtitle text,
  categories jsonb,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS queuetickets (
  _id text PRIMARY KEY,
  date text,
  category text,
  number integer,
  ticket_no text,
  pax integer,
  status text,
  called_at timestamptz,
  seated_at timestamptz,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS shops (
  _id text PRIMARY KEY,
  shop_code text,
  shop_name text,
  shop_intro text,
  shop_notice text,
  shop_img text
);

CREATE TABLE IF NOT EXISTS staffs (
  _id text PRIMARY KEY,
  name text,
  no text,
  role text,
  permission_level integer,
  permissions jsonb,
  default_terminal text,
  password text,
  enabled boolean,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS tables (
  _id text PRIMARY KEY,
  no text,
  name text,
  seats integer,
  zone text,
  x numeric,
  y numeric,
  enabled boolean,
  physical_no text,
  share_suffix text,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS terminallicenses (
  _id text PRIMARY KEY,
  code text,
  key text,
  activated_at timestamptz
);

CREATE TABLE IF NOT EXISTS users (
  _id text PRIMARY KEY,
  username text,
  password text,
  email text,
  avatar text,
  date timestamptz
);

CREATE TABLE IF NOT EXISTS zones (
  _id text PRIMARY KEY,
  name text,
  sort integer,
  date timestamptz
);
