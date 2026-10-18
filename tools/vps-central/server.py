#!/usr/bin/env python3
# orderSYS 中央備份儀表板：列出各分店 (branch_* DB) 的舖頭名稱與菜單。
# 唯讀查詢 PG；提供「匯出菜單 JSON」與「匯出完整 DB（JSON / .dump）」並顯示最後備份日期。
import os
import re
import json
import glob
import subprocess
import html
import datetime
import time
import pwd
import grp
import hmac
import hashlib
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

PG_HOST = "127.0.0.1"
PG_PORT = "5432"
PG_USER = "ordersys"
PG_PASSWORD = "ordersys"
PORT = int(os.environ.get("PORT", "888"))
BACKUP_ROOT = "/backups"
# 分店內建上傳（方案 C）的共享金鑰；未設定時停用上傳端點
UPLOAD_KEY = os.environ.get("UPLOAD_KEY", "")

# 後台管理（方案 A：分店 SSH 金鑰 / add-branch）共享金鑰；未設定時停用後台
ADMIN_KEY = os.environ.get("ADMIN_KEY", "")
AUTH_KEYS = "/backups/.ssh/authorized_keys"
INDEX_DB = "/backups/.index/index.sqlite3"
COOKIE_NAME = "ordersys_admin"
COOKIE_TTL = 7 * 86400
PUBKEY_RE = re.compile(r"^ssh-(ed25519|rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/=]+(?:\s+.*)?$")

DB_RE = re.compile(r"^branch_[A-Za-z0-9_-]+$")
BRANCH_RE = re.compile(r"^[A-Za-z0-9_-]+$")
DUMP_FILENAME_RE = re.compile(r"^ordersys_\d{8}_\d{6}_\d+\.dump$")
MENU_TABLES = ["categories", "categoryitems", "commodities", "combos", "modcodes", "modcodecategories"]


def _sign(*parts):
    m = hmac.new(ADMIN_KEY.encode("utf-8"), digestmod=hashlib.sha256)
    for p in parts:
        m.update(str(p).encode("utf-8"))
    return m.hexdigest()


def _new_admin_token():
    exp = int(time.time()) + COOKIE_TTL
    return "%d.%s" % (exp, _sign("admin", exp))


def _verify_admin_token(tok):
    if not tok:
        return False
    try:
        exp_s, sig = tok.rsplit(".", 1)
        exp = int(exp_s)
    except (ValueError, AttributeError):
        return False
    if exp < int(time.time()):
        return False
    return hmac.compare_digest(sig, _sign("admin", exp))


def _get_cookie(handler, name):
    raw = handler.headers.get("Cookie", "")
    for part in raw.split(";"):
        part = part.strip()
        if part.startswith(name + "="):
            return part[len(name) + 1:]
    return ""


def _is_admin(handler):
    return bool(ADMIN_KEY) and _verify_admin_token(_get_cookie(handler, COOKIE_NAME))


def _set_admin_cookie(handler):
    tok = _new_admin_token()
    handler.send_header("Set-Cookie", "%s=%s; HttpOnly; SameSite=Lax; Path=/; Max-Age=%d" % (COOKIE_NAME, tok, COOKIE_TTL))


def _clear_admin_cookie(handler):
    handler.send_header("Set-Cookie", "%s=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" % COOKIE_NAME)


def q(db, sql, timeout=120):
    """執行 psql 查詢，回傳 (rows, err)。rows 為 list[list[str]]。"""
    env = dict(os.environ, PGPASSWORD=PG_PASSWORD)
    r = subprocess.run(
        ["psql", "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", db,
         "-t", "-A", "-F", "\t", "-c", sql],
        capture_output=True, text=True, env=env, timeout=timeout,
    )
    if r.returncode != 0:
        return None, r.stderr.strip()
    rows = []
    for line in r.stdout.splitlines():
        if line == "":
            continue
        rows.append(line.split("\t"))
    return rows, None


def esc(v):
    return html.escape(str(v) if v is not None else "")


def branch_dir(db):
    return db[len("branch_"):]


HK_TZ = datetime.timezone(datetime.timedelta(hours=8))


def fmt_hk(epoch):
    return datetime.datetime.fromtimestamp(epoch, tz=HK_TZ).strftime("%Y-%m-%d %H:%M")


def dump_filename_ts(filename):
    m = re.match(r"^ordersys_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})", filename or "")
    if not m:
        return ""
    y, mo, d, h, mi, s = m.groups()
    return "%s-%s-%s %s:%s" % (y, mo, d, h, mi)


def latest_dump_info(db):
    """回傳該分店最新 .dump 的 (檔名, 上傳時間字串 HKT)。無檔則 ('', '')。"""
    d = os.path.join(BACKUP_ROOT, branch_dir(db))
    files = sorted(glob.glob(os.path.join(d, "ordersys_*.dump")), key=os.path.getmtime, reverse=True)
    if not files:
        return "", ""
    path = files[0]
    ts = fmt_hk(os.path.getmtime(path))
    return os.path.basename(path), ts


def latest_dump_filename_ts(db):
    """回傳最新 .dump 檔名內嵌的備份時間（分店本機時間）。無檔則空字串。"""
    d = os.path.join(BACKUP_ROOT, branch_dir(db))
    files = sorted(glob.glob(os.path.join(d, "ordersys_*.dump")), key=os.path.getmtime, reverse=True)
    if not files:
        return ""
    return dump_filename_ts(os.path.basename(files[0]))


def page(title, body):
    return (
        "<!DOCTYPE html><html lang='zh-Hant'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>" + esc(title) + "</title>"
        "<style>"
        "body{font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif;margin:24px;color:#222}"
        "h1{font-size:22px;border-bottom:2px solid #1e5bb5;padding-bottom:8px}"
        "h2{font-size:18px;margin:24px 0 8px}"
        "a{color:#1e5bb5;text-decoration:none} a:hover{text-decoration:underline}"
        "table{border-collapse:collapse;width:100%;font-size:14px;margin-top:8px}"
        "th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}"
        "th{background:#f2f5fa}"
        "tr:nth-child(even){background:#fafbfd}"
        ".shop{margin:8px 0 0;color:#555}"
        ".count{font-size:12px;color:#888}"
        ".back{margin-bottom:12px;display:inline-block}"
        ".btn{display:inline-block;padding:5px 12px;margin:2px 6px 2px 0;border:1px solid #1e5bb5;border-radius:4px;color:#1e5bb5;font-size:13px}"
        ".btn:hover{background:#1e5bb5;color:#fff}"
        ".date{font-size:12px;color:#888;white-space:nowrap}"
        "</style></head><body>" + body + "</body></html>"
    )


def list_tables(db):
    rows, err = q(db, "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
    if rows is None:
        return None, err
    return [r[0] for r in rows], None


def raw_q(db, sql, timeout=120):
    """執行 psql 查詢並原樣回傳 stdout（供單欄 JSON 使用，避免 splitlines 誤切 JSONB 內含換行）。"""
    env = dict(os.environ, PGPASSWORD=PG_PASSWORD)
    r = subprocess.run(
        ["psql", "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", db,
         "-t", "-A", "-c", sql],
        capture_output=True, text=True, env=env, timeout=timeout,
    )
    if r.returncode != 0:
        return None, r.stderr.strip()
    return r.stdout.strip(), None


def json_table(db, table):
    out, err = raw_q(db, "SELECT COALESCE(json_agg(t)::text, '[]') FROM %s t;" % table)
    if out is None:
        raise RuntimeError(err)
    return json.loads(out)


def export_menu_json(db):
    data = {}
    for t in MENU_TABLES:
        data[t] = json_table(db, t)
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def export_db_json(db):
    tables, err = list_tables(db)
    if tables is None:
        raise RuntimeError(err)
    data = {}
    for t in tables:
        data[t] = json_table(db, t)
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def render_dashboard():
    rows, err = q("postgres", "SELECT datname FROM pg_database WHERE datname LIKE 'branch\\_%' ORDER BY datname;")
    if rows is None:
        return page("錯誤", "<h1>錯誤</h1><pre>" + esc(err) + "</pre>")

    existing_dbs = set(r[0] for r in rows)
    registered = _list_registered_branches()

    # 合併：已註冊分店（含尚未上傳資料者）＋ 已還原的 branch_* 資料庫
    order = []
    seen = set()
    for b in registered:
        bid = b["branch_id"]
        if bid and bid not in seen:
            seen.add(bid)
            order.append(bid)
    for db in existing_dbs:
        bid = db[len("branch_"):]
        if bid and bid not in seen:
            seen.add(bid)
            order.append(bid)
    order.sort()

    if not order:
        body = "<h1>分店菜單儀表板</h1><p>尚無分店。</p>"
        return page("分店菜單儀表板", body)

    trs = ""
    for bid in order:
        db = "branch_" + bid
        has_db = db in existing_dbs
        if has_db:
            shop_rows, _ = q(db, "SELECT shop_name FROM shops LIMIT 1;")
            shop = shop_rows[0][0] if shop_rows and shop_rows[0] else ""
            cnt_rows, _ = q(db, "SELECT (SELECT count(*) FROM commodities),(SELECT count(*) FROM categories),(SELECT count(*) FROM combos),(SELECT count(*) FROM modcodes);")
            c = cnt_rows[0] if cnt_rows and cnt_rows[0] else ["0", "0", "0", "0"]
            name_cell = "<a href='/branch/" + esc(db) + "'>" + esc(db) + "</a>"
            ops = ("<a class='btn' href='/branch/" + esc(db) + "/export/menu'>匯出 Menu</a>"
                   "<a class='btn' href='/branch/" + esc(db) + "/export/db'>匯出 DB</a>"
                   "<a class='btn' href='/branch/" + esc(db) + "/export/dump'>.dump</a>")
        else:
            shop = "尚未有資料"
            c = ["—", "—", "—", "—"]
            name_cell = esc(db)
            ops = "—"
        backup_ts = latest_dump_filename_ts(db)
        _, upload_ts = latest_dump_info(db)
        trs += (
            "<tr><td>" + name_cell + "</td>"
            "<td>" + esc(shop) + "</td>"
            "<td class='count'>" + esc(c[0]) + "</td>"
            "<td class='count'>" + esc(c[1]) + "</td>"
            "<td class='count'>" + esc(c[2]) + "</td>"
            "<td class='count'>" + esc(c[3]) + "</td>"
            "<td class='date'>" + esc(backup_ts or "—") + "</td>"
            "<td class='date'>" + esc(upload_ts or "—") + "</td>"
            "<td>" + ops + "</td></tr>"
        )
    body = (
        "<h1>分店菜單儀表板</h1>"
        "<table><tr><th>分店</th><th>舖頭名稱</th><th>菜色</th><th>分類</th><th>套餐</th><th>改碼</th><th>最後備份</th><th>上傳日期時間</th><th>操作</th></tr>"
        + trs + "</table>"
    )
    return page("分店菜單儀表板", body)


def render_branch(db):
    if not DB_RE.match(db):
        return page("錯誤", "<h1>無效的分店</h1>")

    shop_rows, _ = q(db, "SELECT COALESCE(shop_code,''),COALESCE(shop_name,''),COALESCE(shop_intro,''),COALESCE(shop_notice,'') FROM shops LIMIT 1;")
    shop = shop_rows[0] if shop_rows and shop_rows[0] else ["", "", "", ""]
    dump_name, last_ts = latest_dump_info(db)

    def table(title, cols, sql):
        rows, err = q(db, sql)
        head = "".join("<th>" + esc(x) + "</th>" for x in cols)
        if rows is None:
            return "<h2>" + esc(title) + "</h2><pre>" + esc(err) + "</pre>"
        trs = "".join(
            "<tr>" + "".join("<td>" + esc(x) + "</td>" for x in row) + "</tr>"
            for row in rows
        )
        return "<h2>" + esc(title) + "（" + str(len(rows)) + "）</h2><table><tr>" + head + "</tr>" + trs + "</table>"

    ops = (
        "<a class='btn' href='/branch/" + esc(db) + "/export/menu'>匯出 Menu</a>"
        "<a class='btn' href='/branch/" + esc(db) + "/export/db'>匯出 DB（JSON）</a>"
        "<a class='btn' href='/branch/" + esc(db) + "/export/dump'>下載 .dump</a>"
    )
    body = (
        "<a class='back' href='/'>← 回分店列表</a>"
        "<h1>" + esc(db) + "</h1>"
        "<div class='shop'>舖頭名稱：<b>" + esc(shop[1]) + "</b>"
        "　地址/簡介：" + esc(shop[2]) + "</div>"
        "<div class='date'>最後備份：" + esc(last_ts or '—') + (("（" + esc(dump_name) + "）") if dump_name else "") + "</div>"
        "<div>" + ops + "</div>"
    )
    body += table("分類", ["名稱", "部門", "代碼"], "SELECT cname, department, code FROM categories ORDER BY root_order NULLS LAST, sort_no NULLS LAST;")
    body += table("菜色", ["名稱", "價格", "部門", "PLU", "代碼"], "SELECT name, price, department, plu, code FROM commodities ORDER BY name;")
    body += table("套餐", ["名稱", "價格", "類型", "部門"], "SELECT name, price, type, department FROM combos ORDER BY name;")
    body += table("改碼", ["名稱", "價格", "類別"], "SELECT name, price, category FROM modcodes ORDER BY name;")
    return page(db, body)


def chown_posbackup(path):
    try:
        uid = pwd.getpwnam("posbackup").pw_uid
        gid = grp.getgrnam("posbackup").gr_gid
        os.chown(path, uid, gid)
    except Exception:
        pass


def _read_authorized_keys():
    try:
        with open(AUTH_KEYS, "r", encoding="utf-8") as f:
            return f.read().splitlines()
    except FileNotFoundError:
        return []


def _write_authorized_keys(lines):
    data = "".join(l + "\n" for l in lines if l.strip())
    with open(AUTH_KEYS, "w", encoding="utf-8") as f:
        f.write(data)
    os.chmod(AUTH_KEYS, 0o600)
    chown_posbackup(AUTH_KEYS)


def _list_branches():
    result = []
    for l in _read_authorized_keys():
        l = l.strip()
        if not l:
            continue
        m = re.search(r'command="rrsync[^"]*/backups/([^"/]+)"', l)
        if not m:
            continue
        result.append({"branch_id": m.group(1), "comment": l[m.end():].strip()})
    return result


def _known_branch_ids():
    """回傳已註冊分店 ID 集合（sqlite branches 表；讀取失敗或為空時回退到 authorized_keys）。"""
    ids = set()
    try:
        con = sqlite3.connect(INDEX_DB)
        rows = con.execute("SELECT branch_id FROM branches;").fetchall()
        con.close()
        ids = set(r[0] for r in rows if r and r[0])
    except Exception:
        ids = set()
    if not ids:
        ids = set(b["branch_id"] for b in _list_branches())
    return ids


def _list_registered_branches():
    """回傳已註冊分店清單（sqlite branches 表，含 name/last_seen；失敗時回退 authorized_keys）。"""
    try:
        con = sqlite3.connect(INDEX_DB)
        rows = con.execute("SELECT branch_id, name, last_seen FROM branches ORDER BY branch_id;").fetchall()
        con.close()
        result = [{"branch_id": r[0], "name": r[1] or "", "last_seen": r[2] or ""} for r in rows if r and r[0]]
        if result:
            return result
    except Exception:
        pass
    return [{"branch_id": b["branch_id"], "name": "", "last_seen": ""} for b in _list_branches()]


def _key_material(pubkey):
    parts = pubkey.split()
    return " ".join(parts[:2]) if len(parts) >= 2 else pubkey


def add_branch(branch, pubkey):
    if not BRANCH_RE.match(branch):
        raise ValueError("分店 ID 格式無效（限 A-Za-z0-9_-）")
    pubkey = pubkey.strip()
    if not PUBKEY_RE.match(pubkey):
        raise ValueError("SSH 公鑰格式無效")
    d = os.path.join(BACKUP_ROOT, branch)
    os.makedirs(d, exist_ok=True)
    os.chmod(d, 0o750)
    chown_posbackup(d)
    new_line = ('command="rrsync -wo /backups/%s",no-port-forwarding,no-pty,no-agent-forwarding,no-X11-forwarding %s'
                % (branch, pubkey))
    key_mat = _key_material(pubkey)
    # 同一把公鑰只保留一列（避免既有的無 forced-command 裸鑰列搶先配對）
    lines = [l for l in _read_authorized_keys() if key_mat not in l]
    lines.append(new_line)
    _write_authorized_keys(lines)
    try:
        con = sqlite3.connect(INDEX_DB)
        con.execute("INSERT INTO branches(branch_id) VALUES(?) ON CONFLICT(branch_id) DO NOTHING;", (branch,))
        con.commit()
        con.close()
    except Exception:
        pass


def revoke_branch(branch):
    if not BRANCH_RE.match(branch):
        raise ValueError("分店 ID 格式無效")
    pat = re.compile(r'command="rrsync[^"]*/backups/%s"' % re.escape(branch))
    lines = [l for l in _read_authorized_keys() if not pat.search(l)]
    _write_authorized_keys(lines)
    try:
        con = sqlite3.connect(INDEX_DB)
        con.execute("DELETE FROM branches WHERE branch_id=?;", (branch,))
        con.commit()
        con.close()
    except Exception:
        pass


def render_admin_login(msg=""):
    body = (
        "<h1>中央備份後台管理</h1>"
        "<form method='post' action='/api/admin/login'>"
        "<p>管理金鑰：<input type='password' name='key' style='width:260px'></p>"
        "<p><button type='submit'>登入</button></p>"
        "</form>"
    )
    if msg:
        body += "<p style='color:#c00'>" + esc(msg) + "</p>"
    return page("後台管理", body)


def render_admin_page(msg="", err=""):
    branches = _list_branches()
    rows = "".join(
        "<tr><td>" + esc(b["branch_id"]) + "</td>"
        "<td>" + esc(b["comment"]) + "</td>"
        "<td><form method='post' action='/api/admin/revoke-branch' style='display:inline'>"
        "<input type='hidden' name='branch' value='" + esc(b["branch_id"]) + "'>"
        "<button type='submit'>撤銷</button></form></td></tr>"
        for b in branches
    )
    body = (
        "<h1>中央備份後台管理</h1>"
        "<a class='btn' href='/admin/logout'>登出</a>"
        "<h2>新增 / 更新分店</h2>"
        "<form method='post' action='/api/admin/add-branch'>"
        "<p>分店 ID：<input name='branch' placeholder='hifi360' style='width:200px'></p>"
        "<p>SSH 公鑰：<br><textarea name='pubkey' rows='3' cols='64' placeholder='ssh-ed25519 AAAA...'></textarea></p>"
        "<p><button type='submit'>儲存</button></p>"
        "</form>"
        "<h2>已授權分店（" + str(len(branches)) + "）</h2>"
        "<table><tr><th>分店 ID</th><th>備註</th><th>操作</th></tr>" + rows + "</table>"
    )
    if msg:
        body += "<p style='color:#060'>" + esc(msg) + "</p>"
    if err:
        body += "<p style='color:#c00'>" + esc(err) + "</p>"
    return page("後台管理", body)


class Handler(BaseHTTPRequestHandler):
    def _send_bytes(self, body, content_type, disposition=None):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        if disposition:
            self.send_header("Content-Disposition", disposition)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, body):
        self._send_bytes(body, "text/html; charset=utf-8")

    def _send_text(self, code, msg):
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        body = msg.encode("utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _export_json(self, db, tables, filename):
        try:
            if tables is None:
                tables, err = list_tables(db)
                if tables is None:
                    self._send_text(500, err)
                    return
            data = {}
            for t in tables:
                data[t] = json_table(db, t)
            body = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        except Exception as e:
            self._send_text(500, str(e))
            return
        self._send_bytes(body, "application/json; charset=utf-8", 'attachment; filename="%s"' % filename)

    def _export_dump(self, db):
        files = sorted(glob.glob(os.path.join(BACKUP_ROOT, branch_dir(db), "ordersys_*.dump")), key=os.path.getmtime, reverse=True)
        if not files:
            self._send_text(404, "No dump found")
            return
        path = files[0]
        with open(path, "rb") as f:
            body = f.read()
        self._send_bytes(body, "application/octet-stream", 'attachment; filename="%s"' % os.path.basename(path))

    def _read_post_form(self):
        try:
            length = int(self.headers.get("Content-Length", "0") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8", "replace")
        return {k: (v[0] if v else "") for k, v in parse_qs(raw, keep_blank_values=True).items()}

    def _handle_admin_login(self):
        if not ADMIN_KEY:
            self._send_text(403, "admin disabled")
            return
        form = self._read_post_form()
        if form.get("key", "") == ADMIN_KEY:
            self.send_response(302)
            _set_admin_cookie(self)
            self.send_header("Location", "/admin")
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            self._send_html(render_admin_login("金鑰錯誤"))

    def _handle_admin_add_branch(self):
        if not _is_admin(self):
            self._send_text(403, "forbidden")
            return
        form = self._read_post_form()
        branch = form.get("branch", "").strip()
        pubkey = form.get("pubkey", "").strip()
        try:
            add_branch(branch, pubkey)
        except Exception as e:
            self._send_html(render_admin_page(err=str(e)))
            return
        self._send_html(render_admin_page(msg="已儲存分店 " + branch))

    def _handle_admin_revoke(self):
        if not _is_admin(self):
            self._send_text(403, "forbidden")
            return
        form = self._read_post_form()
        branch = form.get("branch", "").strip()
        try:
            revoke_branch(branch)
        except Exception as e:
            self._send_html(render_admin_page(err=str(e)))
            return
        self._send_html(render_admin_page(msg="已撤銷分店 " + branch))

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            self._send_html(render_dashboard())
        elif path.startswith("/branch/"):
            rest = path[len("/branch/"):]
            parts = rest.split("/")
            db = parts[0]
            sub = "/" + "/".join(parts[1:]) if len(parts) > 1 else ""
            if sub == "/export/menu":
                self._export_json(db, MENU_TABLES, "menu_%s_%s.json" % (db, datetime.datetime.now().strftime("%Y%m%d_%H%M%S")))
            elif sub == "/export/db":
                self._export_json(db, None, "db_%s_%s.json" % (db, datetime.datetime.now().strftime("%Y%m%d_%H%M%S")))
            elif sub == "/export/dump":
                self._export_dump(db)
            else:
                self._send_html(render_branch(db))
        elif path == "/admin":
            if not _is_admin(self):
                self._send_html(render_admin_login())
            else:
                self._send_html(render_admin_page())
        elif path == "/admin/logout":
            self.send_response(302)
            _clear_admin_cookie(self)
            self.send_header("Location", "/admin")
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            self._send_text(404, "Not Found")

    def do_POST(self):
        path = self.path.split("?")[0]
        if path == "/api/admin/login":
            self._handle_admin_login()
            return
        if path == "/api/admin/add-branch":
            self._handle_admin_add_branch()
            return
        if path == "/api/admin/revoke-branch":
            self._handle_admin_revoke()
            return
        if path != "/api/upload":
            self._send_text(404, "Not Found")
            return
        if not UPLOAD_KEY:
            self._send_text(403, "upload disabled")
            return
        key = self.headers.get("X-Upload-Key", "")
        branch = self.headers.get("X-Branch-Id", "")
        filename = self.headers.get("X-Filename", "")
        if key != UPLOAD_KEY:
            self._send_text(403, "bad key")
            return
        if not BRANCH_RE.match(branch):
            self._send_text(400, "bad branch id")
            return
        if branch not in _known_branch_ids():
            self._send_text(403, "unknown branch id")
            return
        if not DUMP_FILENAME_RE.match(filename):
            self._send_text(400, "bad filename")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_text(400, "bad content-length")
            return
        if length <= 0:
            self._send_text(400, "empty body")
            return
        d = os.path.join(BACKUP_ROOT, branch)
        os.makedirs(d, exist_ok=True)
        dest = os.path.join(d, filename)
        written = 0
        with open(dest, "wb") as f:
            while written < length:
                chunk = self.rfile.read(min(65536, length - written))
                if not chunk:
                    break
                f.write(chunk)
                written += len(chunk)
        chown_posbackup(dest)
        self._send_text(200, "ok")

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("central dashboard listening on 0.0.0.0:" + str(PORT))
    srv.serve_forever()
