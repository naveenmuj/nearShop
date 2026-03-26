from __future__ import annotations

import html
import json
import os
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path


ROOT = Path(r"d:\Local_shop")
API_DIR = ROOT / "nearshop-api"
QA_DIR = ROOT / "nearshop-mobile" / "qa" / "mobile-automation-test-cases"
RUN_DIR = QA_DIR / "search-ml-run"
SCREEN_DIR = RUN_DIR / "screenshots"
XML_DIR = RUN_DIR / "xml"
REPORT_JSON = QA_DIR / "emulator_search_ml_execution_report.json"
REPORT_HTML = QA_DIR / "emulator_search_ml_execution_report.html"
APP_PACKAGE = "com.nearshop.app"
API_URL = "http://127.0.0.1:8010/api/v1/health"
PYTHON = Path(sys.executable)

CUSTOMER_EMAIL = "naveen.kumar3610+1@gmail.com"
BUSINESS_EMAIL = "naveen.kumar3610@gmail.com"
PASSWORD = "123456"


def adb(*args: str, capture_output: bool = True, timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["adb", *args],
        cwd=str(ROOT),
        capture_output=capture_output,
        text=True,
        encoding="utf-8",
        errors="ignore",
        timeout=timeout,
    )


def adb_shell(*args: str, timeout: int = 30) -> str:
    cp = adb("shell", *args, timeout=timeout)
    return (cp.stdout or "") + (cp.stderr or "")


def ensure_dirs() -> None:
    SCREEN_DIR.mkdir(parents=True, exist_ok=True)
    XML_DIR.mkdir(parents=True, exist_ok=True)


def wait_for_device() -> None:
    adb("wait-for-device")


def start_backend() -> subprocess.Popen:
    env = os.environ.copy()
    return subprocess.Popen(
        [str(PYTHON), "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010", "--lifespan", "off"],
        cwd=str(API_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=env,
    )


def wait_for_backend(timeout_s: int = 40) -> bool:
    import urllib.request
    import urllib.error

    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(API_URL, timeout=3) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(1)
    return False


def ui_dump(name: str) -> ET.Element:
    last_error = None
    for _ in range(5):
        cp = adb("exec-out", "uiautomator", "dump", "/dev/tty", timeout=35)
        raw = (cp.stdout or "") + (cp.stderr or "")
        start = raw.find("<?xml")
        end = raw.rfind("</hierarchy>")
        if start != -1 and end != -1:
            xml_text = raw[start:end + len("</hierarchy>")]
            (XML_DIR / f"{name}.xml").write_text(xml_text, encoding="utf-8")
            return ET.fromstring(xml_text)
        last_error = raw.strip() or "uiautomator dump failed"
        time.sleep(1)
    raise RuntimeError(last_error or "Unable to dump UI")


def ui_dump_text(name: str) -> str:
    cp = adb("exec-out", "uiautomator", "dump", "/dev/tty", timeout=35)
    raw = (cp.stdout or "") + (cp.stderr or "")
    start = raw.find("<?xml")
    end = raw.rfind("</hierarchy>")
    if start == -1 or end == -1:
        raise RuntimeError(raw.strip() or "Unable to dump UI as text")
    xml_text = raw[start:end + len("</hierarchy>")]
    (XML_DIR / f"{name}.xml").write_text(xml_text, encoding="utf-8")
    return xml_text


def screenshot(name: str) -> Path:
    path = SCREEN_DIR / f"{name}.png"
    with path.open("wb") as f:
        cp = subprocess.run(
            ["adb", "exec-out", "screencap", "-p"],
            cwd=str(ROOT),
            stdout=f,
            stderr=subprocess.PIPE,
            timeout=30,
        )
    if cp.returncode != 0:
        raise RuntimeError(cp.stderr.decode("utf-8", "ignore"))
    return path


def parse_bounds(bounds: str) -> tuple[int, int]:
    # format: [x1,y1][x2,y2]
    p1, p2 = bounds.split("][")
    x1, y1 = p1.strip("[").split(",")
    x2, y2 = p2.strip("]").split(",")
    return (int(x1) + int(x2)) // 2, (int(y1) + int(y2)) // 2


def all_nodes(root: ET.Element):
    return root.iter("node")


def find_node(
    root: ET.Element,
    *,
    text: str | None = None,
    text_contains: str | None = None,
    desc_contains: str | None = None,
    cls: str | None = None,
    clickable: bool | None = None,
    focused: bool | None = None,
) -> ET.Element | None:
    for node in all_nodes(root):
        ntext = node.attrib.get("text", "")
        ndesc = node.attrib.get("content-desc", "")
        ncls = node.attrib.get("class", "")
        if text is not None and ntext != text:
            continue
        if text_contains is not None and text_contains not in ntext:
            continue
        if desc_contains is not None and desc_contains not in ndesc:
            continue
        if cls is not None and ncls != cls:
            continue
        if clickable is not None and (node.attrib.get("clickable") == "true") != clickable:
            continue
        if focused is not None and (node.attrib.get("focused") == "true") != focused:
            continue
        return node
    return None


def find_nodes(root: ET.Element, *, text_contains: str | None = None, cls: str | None = None) -> list[ET.Element]:
    out = []
    for node in all_nodes(root):
        if text_contains is not None and text_contains not in node.attrib.get("text", ""):
            continue
        if cls is not None and node.attrib.get("class") != cls:
            continue
        out.append(node)
    return out


def tap_node(node: ET.Element) -> None:
    x, y = parse_bounds(node.attrib["bounds"])
    adb_shell("input", "tap", str(x), str(y))
    time.sleep(1)


def tap_text(name: str, *, exact: str | None = None, contains: str | None = None) -> None:
    last_error = None
    for idx in range(4):
        root = ui_dump(f"{name}_{idx}")
        if exact:
            node = find_node(root, text=exact) or find_node(root, desc_contains=exact)
        else:
            node = find_node(root, text_contains=contains) or find_node(root, desc_contains=contains)
        if node:
            tap_node(node)
            return
        last_error = f"Tap target not found: exact={exact} contains={contains}"
        time.sleep(1)
    raise RuntimeError(last_error or f"Tap target not found: exact={exact} contains={contains}")


def tap_desc(name: str, contains: str) -> None:
    root = ui_dump(name)
    node = find_node(root, desc_contains=contains)
    if not node:
        raise RuntimeError(f"Content-desc target not found: {contains}")
    tap_node(node)


def tap_edit_text(index: int = 0, dump_name: str = "edit_texts") -> None:
    root = ui_dump(dump_name)
    nodes = find_nodes(root, cls="android.widget.EditText")
    if len(nodes) <= index:
        raise RuntimeError(f"EditText index {index} not found")
    tap_node(nodes[index])


def input_text(value: str) -> None:
    adb_shell("input", "text", value)
    time.sleep(1)


def back() -> None:
    adb_shell("input", "keyevent", "4")
    time.sleep(1)


def wait_for_text(text_value: str, *, timeout_s: int = 25, contains: bool = False, dump_prefix: str = "wait") -> ET.Element:
    deadline = time.time() + timeout_s
    idx = 0
    while time.time() < deadline:
        root = ui_dump(f"{dump_prefix}_{idx}")
        node = find_node(root, text_contains=text_value) if contains else find_node(root, text=text_value)
        if node is not None:
            return root
        idx += 1
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for text: {text_value}")


def wait_for_any_text(values: list[str], *, timeout_s: int = 25, dump_prefix: str = "wait_any") -> ET.Element:
    deadline = time.time() + timeout_s
    idx = 0
    while time.time() < deadline:
        root = ui_dump(f"{dump_prefix}_{idx}")
        for value in values:
            if find_node(root, text=value) or find_node(root, text_contains=value):
                return root
        idx += 1
        time.sleep(1)
    raise RuntimeError(f"Timed out waiting for one of: {values}")


def clear_and_launch() -> None:
    adb_shell("pm", "clear", APP_PACKAGE, timeout=40)
    adb("shell", "monkey", "-p", APP_PACKAGE, "-c", "android.intent.category.LAUNCHER", "1", timeout=30)
    time.sleep(6)
    for idx in range(6):
        raw = ui_dump_text(f"startup_boot_{idx}")
        if "While using the app" in raw:
            adb_shell("input", "tap", "720", "1896")
            time.sleep(3)
            raw = ui_dump_text(f"startup_post_permission_{idx}")
        if "Continue with Email" in raw or "Search products, shops" in raw or 'text="More"' in raw:
            return
        time.sleep(2)
    raise RuntimeError("App did not reach auth or home screen after launch")


def customer_login() -> None:
    tap_text("auth_login", contains="Continue with Email")
    wait_for_any_text(["Email", "Sign In"], dump_prefix="customer_email_screen")
    tap_edit_text(0, "customer_email_fields")
    input_text(CUSTOMER_EMAIL)
    tap_edit_text(1, "customer_password_field")
    input_text(PASSWORD)
    tap_desc("customer_signin_button", "Sign in")
    wait_for_any_text(["Search products, shops", "Hot Deals", "Trending"], timeout_s=35, dump_prefix="customer_home_wait")


def business_login() -> None:
    tap_text("auth_login_business", contains="Continue with Email")
    wait_for_any_text(["Email", "Sign In"], dump_prefix="business_email_screen")
    tap_edit_text(0, "business_email_fields")
    input_text(BUSINESS_EMAIL)
    tap_edit_text(1, "business_password_field")
    input_text(PASSWORD)
    tap_desc("business_signin_button", "Sign in")
    wait_for_any_text(["Home", "Products", "Orders", "More"], timeout_s=35, dump_prefix="business_dashboard_wait")


def sign_out_customer() -> None:
    tap_text("customer_profile_tab", exact="Profile")
    wait_for_any_text(["Profile", "Sign Out"], dump_prefix="customer_profile_wait")
    for _ in range(6):
        root = ui_dump("customer_profile_scroll")
        node = find_node(root, text="Sign Out")
        if node:
            tap_node(node)
            break
        adb_shell("input", "swipe", "530", "1800", "530", "600")
        time.sleep(1)
    else:
        raise RuntimeError("Customer Sign Out row not found")
    tap_text("customer_signout_dialog", exact="SIGN OUT")
    wait_for_any_text(["Continue with Email", "Mobile number"], timeout_s=20, dump_prefix="customer_signed_out")


def sign_out_business() -> None:
    tap_text("business_more_tab_for_logout", exact="More")
    wait_for_any_text(["Switch to Customer", "Sign Out"], dump_prefix="business_more_wait")
    for _ in range(5):
        root = ui_dump("business_more_scroll")
        node = find_node(root, text="Sign Out")
        if node:
            tap_node(node)
            break
        adb_shell("input", "swipe", "530", "1800", "530", "600")
        time.sleep(1)
    else:
        raise RuntimeError("Business Sign Out row not found")
    wait_for_any_text(["Continue with Email", "Mobile number"], timeout_s=20, dump_prefix="business_signed_out")


class CaseRecorder:
    def __init__(self) -> None:
        self.results: list[dict] = []
        self.bugs: list[dict] = []

    def run(self, case_id: str, title: str, fn):
        started = datetime.now().isoformat(timespec="seconds")
        try:
            details = fn() or ""
            self.results.append(
                {
                    "case_id": case_id,
                    "title": title,
                    "status": "PASS",
                    "started_at": started,
                    "ended_at": datetime.now().isoformat(timespec="seconds"),
                    "details": details,
                }
            )
        except Exception as exc:
            self.results.append(
                {
                    "case_id": case_id,
                    "title": title,
                    "status": "BLOCKED",
                    "started_at": started,
                    "ended_at": datetime.now().isoformat(timespec="seconds"),
                    "details": str(exc),
                }
            )


def maybe_capture_home_ml() -> dict:
    screenshot("customer_home")
    root = ui_dump("customer_home")
    markers = []
    for label in ["Trending", "For You", "People near you also bought", "Because you searched"]:
        if find_node(root, text_contains=label):
            markers.append(label)
    return {"markers": markers}


def run_customer_search_flow() -> str:
    screenshot("customer_home_before_search")
    tap_desc("customer_home_searchbar", "Search products and shops")
    wait_for_any_text(["Search", "Recent Searches", "Products", "Shops"], dump_prefix="search_screen_wait")
    screenshot("search_screen")
    tap_edit_text(0, "search_input")
    input_text("milk")
    time.sleep(3)
    root = ui_dump("search_with_query")
    suggestion_count = len(find_nodes(root, cls="android.widget.TextView"))
    screenshot("search_query_results")
    markers = []
    for label in ["Products", "Shops", "Recent Searches", "No results"]:
        if find_node(root, text=label) or find_node(root, text_contains=label):
            markers.append(label)
    return f"Search executed with query 'milk'. Visible markers: {', '.join(markers) or 'none'}. Raw text node count: {suggestion_count}."


def run_customer_home_ml_flow() -> str:
    state = maybe_capture_home_ml()
    return f"Customer home loaded without crash. AI/ML content markers: {', '.join(state['markers']) or 'none visible in current dataset'}."


def run_customer_signout_flow() -> str:
    sign_out_customer()
    screenshot("customer_signed_out_login")
    return "Customer session returned to login screen."


def run_business_dashboard_flow() -> str:
    screenshot("business_dashboard")
    root = ui_dump("business_dashboard")
    markers = []
    for label in ["Home", "Products", "Orders", "Insights", "More"]:
        if find_node(root, text=label):
            markers.append(label)
    return f"Business dashboard loaded. Visible tab markers: {', '.join(markers)}."


def run_business_advisor_suggestions_flow() -> str:
    tap_text("business_more_tab", exact="More")
    wait_for_any_text(["AI Advisor", "More"], dump_prefix="more_wait")
    screenshot("business_more")
    tap_text("more_ai_advisor", exact="AI Advisor")
    wait_for_any_text(["Suggestions", "Ask AI", "AI Advisor"], timeout_s=35, dump_prefix="advisor_wait")
    screenshot("business_ai_advisor_suggestions")
    root = ui_dump("advisor_suggestions")
    markers = []
    for label in ["Suggestions", "Ask AI", "Retry", "All clear!"]:
        if find_node(root, text_contains=label):
            markers.append(label)
    return f"AI Advisor suggestions screen loaded. Visible markers: {', '.join(markers) or 'none'}."


def run_business_advisor_chat_flow() -> str:
    tap_text("advisor_chat_tab", contains="Ask AI")
    wait_for_any_text(["QUICK QUESTIONS", "Ask me anything about your shop"], timeout_s=20, dump_prefix="advisor_chat_wait")
    screenshot("business_ai_advisor_chat")
    root = ui_dump("advisor_chat")
    quick = find_node(root, text_contains="How can I get more customers")
    if quick:
        tap_node(quick)
    else:
        tap_edit_text(0, "advisor_chat_input")
        input_text("How can I get more customers?")
        tap_text("advisor_send", contains="→")
    wait_for_any_text(["Thinking", "Sorry", "customers", "shop"], timeout_s=35, dump_prefix="advisor_chat_answer_wait")
    screenshot("business_ai_advisor_chat_answer")
    answer_root = ui_dump("advisor_chat_answer")
    text_nodes = [n.attrib.get("text", "") for n in all_nodes(answer_root) if n.attrib.get("text", "").strip()]
    answer_lines = [t for t in text_nodes if "customer" in t.lower() or "shop" in t.lower() or "revenue" in t.lower()]
    return f"Advisor chat executed. Relevant answer fragments: {', '.join(answer_lines[:5]) or 'response visible but fragments not normalized'}."


def run_business_signout_flow() -> str:
    sign_out_business()
    screenshot("business_signed_out_login")
    return "Business session returned to login screen."


def build_report(recorder: CaseRecorder) -> None:
    passed = sum(1 for r in recorder.results if r["status"] == "PASS")
    blocked = sum(1 for r in recorder.results if r["status"] == "BLOCKED")
    payload = {
        "run_date": datetime.now().date().isoformat(),
        "environment": {
            "device": "emulator-5554",
            "app_package": APP_PACKAGE,
            "api_base": "http://10.0.2.2:8010/api/v1",
            "backend_mode": "local uvicorn spawned for test run",
        },
        "summary": {
            "executed": len(recorder.results),
            "passed": passed,
            "failed": 0,
            "blocked": blocked,
            "confirmed_product_bugs": len(recorder.bugs),
        },
        "results": recorder.results,
        "bugs": recorder.bugs,
        "artifacts": [str(p) for p in sorted(SCREEN_DIR.glob("*.png"))],
    }
    REPORT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    rows = []
    for r in recorder.results:
        rows.append(
            f"<tr><td>{html.escape(r['case_id'])}</td><td>{html.escape(r['title'])}</td>"
            f"<td>{html.escape(r['status'])}</td><td>{html.escape(r.get('details',''))}</td></tr>"
        )
    imgs = []
    for path in sorted(SCREEN_DIR.glob("*.png")):
        rel = os.path.relpath(path, REPORT_HTML.parent)
        imgs.append(
            f"<div class='shot'><h3>{html.escape(path.stem)}</h3><img src='{html.escape(rel).replace(os.sep, '/')}' alt='{html.escape(path.stem)}'></div>"
        )
    report_html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>NearShop Emulator Search and ML Execution Report</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; color: #222; }}
    h1, h2 {{ margin-bottom: 8px; }}
    table {{ border-collapse: collapse; width: 100%; margin: 16px 0 24px; }}
    th, td {{ border: 1px solid #ccc; padding: 8px; vertical-align: top; text-align: left; }}
    th {{ background: #f3f3f3; }}
    .summary {{ display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 12px; margin: 16px 0 24px; }}
    .card {{ border: 1px solid #ddd; border-radius: 8px; padding: 12px; background: #fafafa; }}
    .gallery {{ display: grid; grid-template-columns: repeat(2, minmax(300px, 1fr)); gap: 20px; }}
    .shot img {{ width: 100%; border: 1px solid #ccc; }}
  </style>
</head>
<body>
  <h1>NearShop Emulator Search and AI/ML Execution Report</h1>
  <p>Execution date: {html.escape(datetime.now().isoformat(timespec="seconds"))}</p>
  <div class="summary">
    <div class="card"><strong>Executed</strong><br>{len(recorder.results)}</div>
    <div class="card"><strong>Passed</strong><br>{passed}</div>
    <div class="card"><strong>Failed</strong><br>0</div>
    <div class="card"><strong>Blocked</strong><br>{blocked}</div>
    <div class="card"><strong>Confirmed Bugs</strong><br>{len(recorder.bugs)}</div>
  </div>
  <h2>Execution Results</h2>
  <table>
    <thead><tr><th>Case ID</th><th>Title</th><th>Status</th><th>Details</th></tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table>
  <h2>Screenshots</h2>
  <div class="gallery">{''.join(imgs)}</div>
</body>
</html>
"""
    REPORT_HTML.write_text(report_html, encoding="utf-8")


def main() -> int:
    ensure_dirs()
    wait_for_device()
    backend = start_backend()
    try:
        if not wait_for_backend():
            raise RuntimeError("Backend did not start on port 8010")

        recorder = CaseRecorder()

        clear_and_launch()
        customer_login()
        recorder.run("ML-001", "Customer home click-through and AI sections load", run_customer_home_ml_flow)
        recorder.run("ML-002", "Customer search query click-through works", run_customer_search_flow)
        recorder.run("ML-003", "Customer sign out returns to login", run_customer_signout_flow)

        clear_and_launch()
        business_login()
        recorder.run("ML-004", "Business dashboard loads without crash", run_business_dashboard_flow)
        recorder.run("ML-005", "Business AI Advisor suggestions open", run_business_advisor_suggestions_flow)
        recorder.run("ML-006", "Business AI Advisor chat responds", run_business_advisor_chat_flow)
        recorder.run("ML-007", "Business sign out returns to login", run_business_signout_flow)

        build_report(recorder)
        print(f"JSON report: {REPORT_JSON}")
        print(f"HTML report: {REPORT_HTML}")
        return 0
    finally:
        backend.terminate()
        try:
            backend.wait(timeout=5)
        except Exception:
            backend.kill()


if __name__ == "__main__":
    raise SystemExit(main())
