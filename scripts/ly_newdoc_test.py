# -*- coding: utf-8 -*-
"""
ly_newdoc_test.py — 凌越「進貨/進退/入庫/出庫單」（0000AO/AP/B6/B7）串接測試工具

搭配 docs/凌越-進貨出入庫單-匯出入API.md 使用。放到「凌越整合代理」資料夾
（或 D:\\Work\\lystk_tool）跑，依賴同資料夾／LYSTK_DIR 的 lystk.py。

測試順序（照這個走，前兩步零風險）：

  1. probe    — 印 API 版本 + 五個函式的 WSDL 簽名（確認凌越版本認得 LyDataIn/Out/Del）
       py ly_newdoc_test.py probe

  2. read     — 用 LyDataOut 讀四個新單別（唯讀，不動任何資料）
       py ly_newdoc_test.py read 松富              # 近 7 天、四單別各查一次
       py ly_newdoc_test.py read 松富 --kind 進貨 --days 30
       py ly_newdoc_test.py read 00 --kind 0000B6 --start 2026-07-01 --end 2026-07-31

  3. write-test — 寫「一張」測試單（備註【API測試請刪除】）→ 回查 → 自動刪除。
     B6/B7 預設「不過帳」（imode 位 12 = 0，不動庫存）；--post 才過帳。
     --keep 保留不刪，自己進凌越畫面人工核對後手動刪。
       py ly_newdoc_test.py write-test 入庫 --company 松富 --ctno <廠商或客戶編號> ^
          --skno <料號> --whno FN005 --unit KG --keep
       py ly_newdoc_test.py write-test 進貨 --company 松富 --ctno <廠商編號> --skno <料號>

  ⚠ 文件不一致待實測：SD_UNIT_FG 在 AO/B6 文件寫 F/T、AP/B7 寫 0/1。
    本工具照各檔文件預設；被拒時用 --unitfg 換另一種寫法再試一次。
"""
import sys
import os
import argparse
import datetime
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# 與其他代理腳本相同的載入慣例：同資料夾優先，其次 LYSTK_DIR
_HERE = os.path.dirname(os.path.abspath(__file__))
_LYSTK_DIR = os.environ.get("LYSTK_DIR", r"D:\Work\lystk_tool")
for _p in (_HERE, _LYSTK_DIR):
    if _p and _p not in sys.path:
        sys.path.insert(0, _p)

import lystk  # noqa: E402

NEW_KINDS = {
    "0000AO": "進貨單",
    "0000AP": "進貨退回單",
    "0000B6": "入庫單",
    "0000B7": "出庫單",
}
# 讓 lystk 的 resolver 認得新單別（monkey-patch，不改 lystk 本體）
lystk.IDAKD.update(NEW_KINDS)
lystk._KIND_TO_IDAKD.update({v: k for k, v in NEW_KINDS.items()})
lystk._KIND_TO_IDAKD.update({
    "進貨": "0000AO", "進貨單": "0000AO",
    "進退": "0000AP", "進貨退回": "0000AP",
    "入庫": "0000B6", "出庫": "0000B7",
})
lystk._FIELD_PREFIX.update({k: "SP" for k in NEW_KINDS})

TEST_MARK = "【API測試請刪除】"

_IN_ERRS = {"-1": "SQL 連接失敗", "-2": "寫入失敗", "-3": "金鑰失效(>30秒)",
            "-4": "金鑰不合法", "-5": "無權限", "-7": "lydatatemp 檔不存在",
            "-8": "系統在做重整", "-9": "元件與 AP 版本不符"}
_OUT_ERRS = {"-1": "SQL 連接失敗", "-2": "讀取失敗", "-3": "金鑰失效",
             "-4": "金鑰不合法", "-5": "無權限", "-7": "lydatatemp 檔不存在"}
_DEL_ERRS = {"-1": "SQL 連接失敗", "-2": "寫入失敗", "-3": "金鑰失效",
             "-4": "金鑰不合法", "-5": "此檔不可刪除"}


def build_imode(idakd, post=False):
    """依文件內定值組 30 位 imode（轉入用）。B6/B7 位12 過帳：測試預設 0＝不過帳。"""
    m = ["0"] * 30
    if idakd == "0000AO":
        m[8] = "1"   # 位9：廠商不存在不回填基本資料（內定=1）
    if idakd in ("0000B6", "0000B7"):
        m[9] = "1"   # 位10：二聯式發票不使用彙加註記（內定=1）
        m[11] = "1" if post else "0"  # 位12：過帳（內定=1，測試強制 0 除非 --post）
    return "".join(m)


# ------------------------------------------------------------
#  SOAP 呼叫
# ------------------------------------------------------------

def _get(resp, key, default=None):
    try:
        return resp[key]
    except Exception:
        return default


def lydataout(icpno, idakd, where, whval, limit=0, want_tmpnm=False):
    """回傳 (title_rows, detail_rows, itotrec)；want_tmpnm=True 時多回 itmpnm。唯讀。

    limit>0＝分頁模式，會在 lystemp 建暫存物件並回傳 itmpnm——可用來探測
    lystemp 是否正常（LyDataIn 的 GetRsByXml 也依賴同一個 lystemp 資料庫）。
    """
    client = lystk.get_client()
    resp = client.service.LyDataOut(
        ikye=lystk.fresh_key(), icpno=icpno, idakd=idakd,
        ifld="", idetfields="",
        irwhere=where, iwhval=whval,
        irec=int(limit), imode=" " * 30,
        iorder="order by SP_NO", idtorder="",
        iswhere="", isifld="",
        Isecgroup="", iseckindfg="", iseckind="",
        Isecorder="", Isecrec=0,
    )
    rc = str(_get(resp, "LyDataOutResult"))
    if rc != "0":
        raise RuntimeError(f"LyDataOut({idakd}) 失敗: {_OUT_ERRS.get(rc, '')} (code={rc})")
    xml = _get(resp, "ixmlda")
    tot = _get(resp, "itotrec")
    titles, details = [], []
    if xml:
        root = ET.fromstring(str(xml))
        for node, bucket in ((".//LYDATATITLE", titles), (".//LYDATADETAIL", details)):
            for t in root.findall(node):
                bucket.append({c.tag: (c.text or "").strip() for c in t})
    if want_tmpnm:
        return titles, details, tot, _get(resp, "itmpnm", "")
    return titles, details, tot


def lydatain(icpno, idakd, xml, imode):
    """回傳 (rc, ireno)。zeep 對 out 參數的處理不確定 → ireno 先帶再退。"""
    client = lystk.get_client()
    kwargs = dict(ikye=lystk.fresh_key(), icpno=icpno, idakd=idakd,
                  irset=xml, imode=imode, ichkmuno="", ichkmode="")
    try:
        resp = client.service.LyDataIn(ireno="", **kwargs)
    except TypeError:
        resp = client.service.LyDataIn(**kwargs)
    rc = str(_get(resp, "LyDataInResult", resp))
    ireno = _get(resp, "ireno", "")
    return rc, ireno


def lydatadel(icpno, idakd, no):
    """LyDataDel：成功回 null（不是 0）。"""
    client = lystk.get_client()
    resp = client.service.LyDataDel(
        ikye=lystk.fresh_key(), icpno=icpno, idakd=idakd,
        ino=no, imode="0" * 30, ichkmuno="",
    )
    rc = _get(resp, "LyDataDelResult", resp)
    return rc


# ------------------------------------------------------------
#  指令：probe（零風險）
# ------------------------------------------------------------

def cmd_probe(_args):
    client = lystk.get_client()
    print(f"API 版本: {client.service.LyGetERPApiVer()}")
    print()
    wanted = {"LyGetPassKey", "LyDataIn", "LyDataOut", "LyDataPage", "LyDataDel"}
    for svc in client.wsdl.services.values():
        for port in svc.ports.values():
            ops = getattr(port.binding, "_operations", {})
            for name in sorted(ops):
                if name in wanted:
                    try:
                        sig = ops[name].input.signature()
                    except Exception as e:
                        sig = f"(無法取得簽名: {e})"
                    print(f"{name}:\n  {sig}\n")
    print("→ 若 LyDataIn/LyDataDel 都有列出，代表元件版本支援寫入與刪除。")
    return 0


# ------------------------------------------------------------
#  指令：read（唯讀）
# ------------------------------------------------------------

def cmd_read(args):
    icpno = lystk.resolve_icpno(args.company)
    kinds = [lystk.resolve_idakd(args.kind)] if args.kind else list(NEW_KINDS)
    end = lystk.resolve_date(args.end) if args.end else datetime.date.today()
    start = lystk.resolve_date(args.start) if args.start else end - datetime.timedelta(days=args.days)
    where = "SP_DATE between '@v1@' and '@v2@'"
    whval = f"{start:%Y-%m-%d} @#1#@ {end:%Y-%m-%d} 23:59:59"
    print(f"公司 {icpno}（{lystk.COMPANIES.get(icpno, '?')}）  期間 {start} ~ {end}\n")
    failed = 0
    for kd in kinds:
        name = NEW_KINDS.get(kd, kd)
        try:
            if args.limit:
                titles, details, tot, tmpnm = lydataout(
                    icpno, kd, where, whval, limit=args.limit, want_tmpnm=True)
            else:
                titles, details, tot = lydataout(icpno, kd, where, whval)
                tmpnm = None
        except Exception as e:
            failed += 1
            print(f"[{kd} {name}] ❌ {e}")
            continue
        print(f"[{kd} {name}] 抬頭 {len(titles)} 筆、明細 {len(details)} 筆（itotrec={tot}）")
        if args.limit:
            # 分頁會在 lystemp 建暫存物件——有拿到檔名＝lystemp 可正常建立暫存
            print(f"    分頁暫存檔名 itmpnm={tmpnm!r}"
                  + ("  ✅ lystemp 可建暫存" if tmpnm else "  ⚠ 沒拿到暫存檔名"))
            if tmpnm:
                try:
                    client = lystk.get_client()
                    rc = client.service.LyDataPage(
                        ikye=lystk.fresh_key(), icpno=icpno, idakd=kd,
                        itykd="1", itmpnm=str(tmpnm), ipageno=0)
                    print(f"    清除暫存 LyDataPage(itykd=1) rc={_get(rc, 'LyDataPageResult', rc)}")
                except Exception as e:
                    print(f"    ⚠ 清除暫存失敗: {e}")
        for t in titles[: args.show]:
            print(f"    {t.get('SP_NO','')}  {t.get('SP_DATE','')[:10]}  "
                  f"{t.get('SP_CTNO','')} {t.get('SP_CTNAME','')}  合計={t.get('SP_TOT','')}")
        for d in details[: args.show]:
            print(f"      └ {d.get('SD_NO','')}#{d.get('SD_SEQ','')}  {d.get('SD_SKNO','')} "
                  f"{d.get('SD_NAME','')}  數量={d.get('SD_QTY','')}  倉={d.get('SD_WHNO','')}")
        print()
    if failed:
        print(f"⚠ {failed} 個單別查詢失敗（版本不支援或無權限，見上方錯誤碼）")
    return 1 if failed else 0


# ------------------------------------------------------------
#  指令：write-test（寫一張 → 回查 → 刪）
# ------------------------------------------------------------

def _build_xml(header, details):
    def block(tag, fields):
        parts = [f"<{tag}>"]
        for k, v in fields.items():
            if v is None:
                continue
            v = str(v)
            if k in ("SP_REM", "SD_REM"):
                parts.append(f"<{k}><![CDATA[{v}]]></{k}>")
            else:
                parts.append(f"<{k}>{escape(v)}</{k}>")
        parts.append(f"</{tag}>")
        return "".join(parts)

    body = block("LYDATATITLE", header) + "".join(block("LYDATADETAIL", d) for d in details)
    return f'<?xml version="1.0" standalone="yes"?><DocumentElement>{body}</DocumentElement>'


def cmd_write_test(args):
    idakd = lystk.resolve_idakd(args.kind)
    if idakd not in NEW_KINDS:
        print(f"[ERROR] 本工具只測新單別 {list(NEW_KINDS)}，收到 {idakd}")
        return 1
    icpno = lystk.resolve_icpno(args.company)

    # 必填檢查（依 docs/凌越-進貨出入庫單-匯出入API.md 各單別必填欄）
    if idakd in ("0000AP", "0000B6", "0000B7") and not args.unit:
        print(f"[ERROR] {NEW_KINDS[idakd]} 明細 SD_UNIT 必填，請帶 --unit（例：--unit KG）")
        return 1
    if idakd in ("0000B6", "0000B7") and not args.whno:
        print(f"[ERROR] {NEW_KINDS[idakd]} 明細 SD_WHNO 必填，請帶 --whno（凌越倉號，例：--whno FN005）")
        return 1

    now = datetime.datetime.now()
    d = f"{now:%Y/%m/%d}"
    spno = f"APITEST{now:%Y%m%d%H%M%S}"  # 21 字元 < 22 上限，好搜好刪

    header = {"SP_DATE": d, "SP_NO": spno, "SP_CTNO": args.ctno,
              "SP_REM": f"{TEST_MARK} ly_newdoc_test write-test"}
    if idakd in ("0000AO", "0000AP"):
        header["SP_QKCUST"] = args.qkcust or args.ctno  # AO/AP 抬頭必填

    detail = {"SD_DATE": d, "SD_NO": spno, "SD_CTNO": args.ctno,
              "SD_SKNO": args.skno, "SD_QTY": args.qty, "SD_SEQ": 1}
    if args.unit:
        detail["SD_UNIT"] = args.unit
    if args.whno:
        detail["SD_WHNO"] = args.whno
    # SD_UNIT_FG 文件寫法不一致：AO/B6=F/T、AP/B7=0/1（--unitfg 可覆寫實測）
    default_unitfg = {"0000AO": None, "0000AP": "0", "0000B6": "F", "0000B7": "0"}[idakd]
    unitfg = args.unitfg or default_unitfg
    if unitfg is not None:
        detail["SD_UNIT_FG"] = unitfg
        detail["SD_RQTY"] = 1  # 基本單位固定 1
    if idakd == "0000B6":
        detail["SD_ADJUST_FG"] = "0"  # B6 必填：非加工入庫
    # 單價刻意不送 → 凌越自動帶價（送 0 會強制蓋 0）

    xml = _build_xml(header, [detail])
    imode = build_imode(idakd, post=args.post)

    print(f"單別 {idakd} {NEW_KINDS[idakd]}  公司 {icpno}  測試單號 {spno}")
    print(f"imode = {imode}" + ("（位12=1 會過帳動庫存！）" if args.post else "（不過帳）"))
    if args.dry_run:
        print("\n--dry-run，只印 XML 不寫入：\n")
        print(xml)
        return 0

    rc, ireno = lydatain(icpno, idakd, xml, imode)
    if rc != "0":
        print(f"❌ LyDataIn 失敗: {_IN_ERRS.get(rc, '')} (code={rc})")
        if unitfg is not None:
            other = {"F": "1", "T": "1", "0": "F", "1": "F"}.get(str(unitfg), "F")
            print(f"   提示：可試 --unitfg {other}（SD_UNIT_FG 文件寫法不一致）")
        return 1
    print(f"✅ 寫入成功  ireno={ireno!r}")

    # 回查驗證
    titles, details, _tot = lydataout(icpno, idakd, "SP_NO='@v1@'", spno)
    if titles:
        t = titles[0]
        print(f"✅ 回查到單：{t.get('SP_NO')}  {t.get('SP_DATE','')[:10]}  "
              f"{t.get('SP_CTNO')} {t.get('SP_CTNAME','')}")
        for dd in details:
            print(f"   └ #{dd.get('SD_SEQ')}  {dd.get('SD_SKNO')} {dd.get('SD_NAME','')}  "
                  f"數量={dd.get('SD_QTY')}  單價={dd.get('SD_PRICE','')}  倉={dd.get('SD_WHNO','')}")
    else:
        print("⚠ 寫入回 0 但回查不到——檢查公司別/單別畫面是否勾「含未審核」（通用方法說明 §4 坑 1）")

    if args.keep:
        print(f"\n--keep：測試單 {spno} 保留，請進凌越人工核對後手動刪除"
              f"（或跑：py ly_newdoc_test.py delete {args.kind} --company {icpno} --no {spno}）")
        return 0

    rc = lydatadel(icpno, idakd, spno)
    ok = rc is None or str(rc).strip().lower() in ("", "none", "null")
    print(f"{'✅ 已刪除測試單' if ok else '❌ 刪除失敗'}  LyDataDel 回傳={rc!r}（null=成功）")
    if not ok:
        print(f"   {_DEL_ERRS.get(str(rc), '')}；請進凌越手動刪 {spno}")
    return 0 if ok else 1


def cmd_delete(args):
    idakd = lystk.resolve_idakd(args.kind)
    icpno = lystk.resolve_icpno(args.company)
    if not args.no.startswith("APITEST") and not args.force:
        print("[ERROR] 安全鎖：只刪 APITEST 開頭的測試單；真要刪正式單請加 --force")
        return 1
    rc = lydatadel(icpno, idakd, args.no)
    ok = rc is None or str(rc).strip().lower() in ("", "none", "null")
    print(f"{'✅ 已刪除' if ok else '❌ 刪除失敗'} {args.no}  回傳={rc!r}（null=成功）"
          + ("" if ok else f"  {_DEL_ERRS.get(str(rc), '')}"))
    return 0 if ok else 1


# ------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("probe", help="印 API 版本與五函式 WSDL 簽名（零風險）")

    r = sub.add_parser("read", help="LyDataOut 讀四個新單別（唯讀）")
    r.add_argument("company", help="公司：00/01/02/03 或 松富/龍港/松揚/松成")
    r.add_argument("--kind", help="只查一種：進貨/進退/入庫/出庫 或 0000AO 等；不帶＝四種都查")
    r.add_argument("--days", type=int, default=7, help="近 N 天（預設 7）")
    r.add_argument("--start"); r.add_argument("--end")
    r.add_argument("--show", type=int, default=5, help="每單別最多列出幾筆（預設 5）")
    r.add_argument("--limit", type=int, default=0,
                   help="每頁筆數 >0＝分頁模式，會在 lystemp 建暫存並印 itmpnm"
                        "（用來探測 lystemp 是否正常；仍是唯讀）")

    w = sub.add_parser("write-test", help="寫一張測試單→回查→刪（--keep 保留）")
    w.add_argument("kind", help="進貨/進退/入庫/出庫 或 0000AO/AP/B6/B7")
    w.add_argument("--company", required=True)
    w.add_argument("--ctno", required=True, help="廠商/客戶編號（凌越主檔要存在）")
    w.add_argument("--skno", required=True, help="料號（凌越貨品主檔）")
    w.add_argument("--qty", type=float, default=1)
    w.add_argument("--unit", help="單位（AP/B6/B7 必填，例 KG）")
    w.add_argument("--whno", help="凌越倉號（B6/B7 必填，例 FN005）")
    w.add_argument("--qkcust", help="請款對象（AO/AP 抬頭必填；不帶＝用 --ctno）")
    w.add_argument("--unitfg", help="覆寫 SD_UNIT_FG 寫法（F/T 或 0/1，實測用）")
    w.add_argument("--post", action="store_true", help="B6/B7 過帳（動庫存！首測不要帶）")
    w.add_argument("--keep", action="store_true", help="不自動刪，留給人工核對")
    w.add_argument("--dry-run", action="store_true", help="只印 XML 不寫入")

    dl = sub.add_parser("delete", help="刪測試單（預設只允許 APITEST 開頭）")
    dl.add_argument("kind"); dl.add_argument("--company", required=True)
    dl.add_argument("--no", required=True, help="單號")
    dl.add_argument("--force", action="store_true")

    args = ap.parse_args()
    fn = {"probe": cmd_probe, "read": cmd_read,
          "write-test": cmd_write_test, "delete": cmd_delete}[args.cmd]
    try:
        return fn(args)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
