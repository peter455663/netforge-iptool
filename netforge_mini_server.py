#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""NETFORGE Mini Localhost Server (Python 3.13, Standard Library Only).
Hosts a compact, dark-themed NETFORGE web UI on http://127.0.0.1:8090
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import socket
import urllib.parse
import urllib.request

HOST = "127.0.0.1"
PORT = 8090

HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NETFORGE Mini — Localhost</title>
<style>
  :root{--bg:#0b0f0d;--panel:#121816;--line:#27322d;--text:#e8eee9;--muted:#86948c;--green:#b7f36b}
  body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 system-ui,sans-serif;padding:28px}
  .wrap{max-width:860px;margin:0 auto}
  h1{margin:0 0 6px;font-size:24px} .sub{color:var(--muted);margin:0 0 20px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:18px;margin-bottom:16px}
  .row{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}
  input,select{background:#0d1210;color:var(--text);border:1px solid var(--line);border-radius:6px;padding:9px 12px;flex:1;min-width:200px}
  button{background:var(--green);color:#11170f;border:0;border-radius:6px;padding:9px 16px;font-weight:700;cursor:pointer}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-top:12px}
  .kv{border:1px solid var(--line);border-radius:6px;padding:10px;background:#0f1512}
  .kv span{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px}
  .kv strong{font-size:13px;word-break:break-word}
</style>
</head>
<body>
<div class="wrap">
  <h1>NETFORGE Mini</h1>
  <p class="sub">Compact localhost edition · Python 3.13</p>
  <div class="card">
    <div class="row">
      <select id="mode">
        <option value="ip">All-in-One IP Check</option>
        <option value="dns">DNS Lookup (A / AAAA / MX)</option>
      </select>
      <input id="q" placeholder="IP or domain (leave blank for your IP)">
      <button onclick="run()">Run →</button>
    </div>
    <div id="out" class="grid"></div>
  </div>
</div>
<script>
async function run(){
  const mode=document.getElementById('mode').value, q=document.getElementById('q').value.trim();
  const out=document.getElementById('out'); out.innerHTML='Loading...';
  const r=await fetch('/api/check?mode='+encodeURIComponent(mode)+'&q='+encodeURIComponent(q));
  const d=await r.json();
  out.innerHTML=Object.entries(d).map(([k,v])=>`<div class="kv"><span>${k}</span><strong>${typeof v==='object'?JSON.stringify(v):v}</strong></div>`).join('');
}
</script>
</body>
</html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/":
            body = HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/check":
            qs = urllib.parse.parse_qs(parsed.query)
            mode = qs.get("mode", ["ip"])[0]
            q = qs.get("q", [""])[0].strip()
            try:
                if mode == "dns":
                    target = q or "example.com"
                    url = f"https://dns.google/resolve?name={urllib.parse.quote(target)}&type=A"
                    with urllib.request.urlopen(url, timeout=8) as r:
                        raw = json.loads(r.read().decode())
                    res = {"domain": target, "records": [x.get("data") for x in raw.get("Answer", [])] or ["None"]}
                else:
                    url = f"https://ipwho.is/{urllib.parse.quote(q)}"
                    with urllib.request.urlopen(url, timeout=8) as r:
                        raw = json.loads(r.read().decode())
                    res = {
                        "ip": raw.get("ip", "—"),
                        "country": raw.get("country", "—"),
                        "city": raw.get("city", "—"),
                        "isp": (raw.get("connection") or {}).get("isp", "—"),
                        "asn": (raw.get("connection") or {}).get("asn", "—"),
                    }
            except Exception as e:
                res = {"error": str(e)}
            body = json.dumps(res).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    print(f"NETFORGE Mini running at http://{HOST}:{PORT}/ (Ctrl+C to stop)")
    HTTPServer((HOST, PORT), Handler).serve_forever()
