# NETFORGE — IP, DNS & Network Workbench

NETFORGE is a local-first, zero-dependency web workbench for IP, DNS, network diagnostics, web security, MAC address, and internet speed utilities.

## Features

- **All-in-One IP Check**: Public IPv4/IPv6 detection, ISP/ASN lookup, approximate geolocation with OpenStreetMap preview, reverse DNS (PTR), and optional local ICMP ping.
- **IP Tools**: IPv4/IPv6 lookup, subnet/CIDR calculator, IP range calculator, IP validator, private/public checker, WHOIS/ASN/ISP lookup.
- **DNS & Network**: DNS lookup (A, AAAA, MX, TXT, NS, CNAME, PTR), DNS propagation checker, HTTP header/status/response checkers, SSL certificate & expiration checker, port availability, latency, and ping.
- **Web & Security**: HTTP security headers checker, URL parser/encoder/decoder, Base64, Hash generator (SHA-256/384/512), Password entropy checker, JWT decoder, JSON formatter/validator, HTML entity encoder/decoder, User-Agent parser.
- **MAC Address Tools**: MAC validator, formatter, random MAC generator, and OUI vendor lookup.
- **Internet Speed Test**: Browser-based HTTP latency, download, and upload speed measurement via Cloudflare.
- **Script Library**: Downloadable standalone Python (`.py`, Python 3.13 compatible) and PowerShell (`.ps1`) utilities.
- **Multi-language UI**: English, Hungarian, German, and Spanish (`language.js`).

## Running Locally

### Option 1: Full local server with ICMP Ping (`netforge_local.py`)
Requires Python 3.10+ (tested on Python 3.13):

```bash
python netforge_local.py
```

### Option 2: Static file server
```bash
python -m http.server 8096
```
Then open `http://localhost:8096/` in your browser.
