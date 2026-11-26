#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""NETFORGE All-in-One Network & OSINT CLI Suite (Python 3.13, Standard Library Only)."""

import hashlib
import ipaddress
import json
import os
import platform
import random
import socket
import ssl
import subprocess
import sys
import time
import urllib.parse
import urllib.request


class C:
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    BOLD = "\033[1m"
    END = "\033[0m"


def clear():
    os.system("cls" if platform.system() == "Windows" else "clear")


def header():
    print(f"{C.CYAN}{'=' * 62}")
    print(f"{C.BOLD}   NETFORGE — ALL-IN-ONE CLI CHECKER (Python 3.13){C.END}")
    print(f"{C.CYAN}{'=' * 62}{C.END}\n")


def fetch_json(url: str, timeout: int = 8) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "NETFORGE-CLI/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", errors="replace"))


def resolve_ip(host: str):
    try:
        ipaddress.ip_address(host)
        return host, socket.AF_INET6 if ":" in host else socket.AF_INET
    except ValueError:
        pass
    try:
        info = socket.getaddrinfo(host, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for fam, _, _, _, sa in info:
            if fam == socket.AF_INET:
                return sa[0], fam
        if info:
            return info[0][4][0], info[0][0]
    except socket.gaierror:
        pass
    return None, None


def tool_my_ip():
    host = socket.gethostname()
    print(f"{C.GREEN}[+]{C.END} Hostname: {host}")
    try:
        print(f"{C.GREEN}[+]{C.END} Local IPv4: {socket.gethostbyname(host)}")
    except Exception:
        pass
    try:
        data = fetch_json("https://ipwho.is/")
        print(f"{C.GREEN}[+]{C.END} Public IP : {C.BOLD}{data.get('ip')}{C.END}")
        print(f"{C.GREEN}[+]{C.END} Location  : {data.get('city')}, {data.get('country')} ({data.get('country_code')})")
        conn = data.get("connection") or {}
        print(f"{C.GREEN}[+]{C.END} ISP / ASN : {conn.get('isp')} (AS{conn.get('asn')})")
    except Exception as e:
        print(f"{C.RED}[-]{C.END} Public IP lookup failed: {e}")


def tool_ip_lookup():
    target = input("IP or domain: ").strip()
    if not target:
        return
    ip, fam = resolve_ip(target)
    if not ip:
        print(f"{C.RED}[-]{C.END} Could not resolve {target}")
        return
    print(f"{C.GREEN}[+]{C.END} Resolved: {ip} ({'IPv6' if fam == socket.AF_INET6 else 'IPv4'})")
    try:
        d = fetch_json(f"https://ipwho.is/{urllib.parse.quote(ip)}")
        conn = d.get("connection") or {}
        print(f"  Country : {d.get('country')} ({d.get('country_code')})")
        print(f"  City    : {d.get('city')}")
        print(f"  ISP     : {conn.get('isp')}")
        print(f"  ASN     : {conn.get('asn')}")
    except Exception as e:
        print(f"{C.RED}[-]{C.END} Lookup error: {e}")


def tool_dns():
    domain = input("Domain: ").strip()
    if not domain:
        return
    for rtype in ("A", "AAAA", "MX", "TXT", "NS"):
        try:
            d = fetch_json(f"https://dns.google/resolve?name={urllib.parse.quote(domain)}&type={rtype}")
            ans = [x.get("data") for x in d.get("Answer", [])]
            print(f"{C.GREEN}[{rtype}]{C.END} {', '.join(ans) if ans else '—'}")
        except Exception as e:
            print(f"{C.RED}[{rtype}]{C.END} Error: {e}")


def tool_reverse_dns():
    ip = input("IP address: ").strip()
    if not ip:
        return
    try:
        host, _, _ = socket.gethostbyaddr(ip)
        print(f"{C.GREEN}[PTR]{C.END} {ip} -> {host}")
    except Exception as e:
        print(f"{C.RED}[-]{C.END} No PTR record: {e}")


def tool_ports():
    target = input("IP or domain: ").strip()
    ip, fam = resolve_ip(target)
    if not ip:
        print(f"{C.RED}[-]{C.END} Resolve failed.")
        return
    for p in (21, 22, 25, 53, 80, 110, 443, 3306, 8080):
        with socket.socket(fam, socket.SOCK_STREAM) as s:
            s.settimeout(0.8)
            ok = s.connect_ex((ip, p)) == 0
            print(f"  Port {p:5d}: {C.GREEN}OPEN{C.END}" if ok else f"  Port {p:5d}: {C.RED}CLOSED{C.END}")


def tool_ping():
    target = input("IP or domain: ").strip()
    if not target:
        return
    _, fam = resolve_ip(target)
    is_win = platform.system().lower() == "windows"
    cmd = ["ping", "-6" if fam == socket.AF_INET6 else "-4", "-n" if is_win else "-c", "4", target]
    subprocess.run(cmd)


def tool_traceroute():
    target = input("IP or domain: ").strip()
    if not target:
        return
    _, fam = resolve_ip(target)
    is_win = platform.system().lower() == "windows"
    cmd = ["tracert" if is_win else "traceroute"]
    if fam == socket.AF_INET6:
        cmd.append("-6")
    cmd.append(target)
    subprocess.run(cmd)


def tool_subnet():
    cidr = input("CIDR (e.g. 192.168.1.0/24): ").strip()
    try:
        net = ipaddress.ip_network(cidr, strict=False)
        print(f"  Network   : {net.network_address}/{net.prefixlen}")
        print(f"  Netmask   : {net.netmask}")
        print(f"  Broadcast : {net.broadcast_address}")
        print(f"  Addresses : {net.num_addresses}")
    except Exception as e:
        print(f"{C.RED}[-]{C.END} Invalid CIDR: {e}")


def tool_http():
    url = input("URL (e.g. https://example.com): ").strip()
    if not url:
        return
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "NETFORGE-CLI"})
        t0 = time.perf_counter()
        with urllib.request.urlopen(req, timeout=8) as r:
            ms = round((time.perf_counter() - t0) * 1000)
            print(f"{C.GREEN}[{r.status}]{C.END} {ms} ms")
            for k, v in r.headers.items():
                print(f"  {k}: {v}")
    except Exception as e:
        print(f"{C.RED}[-]{C.END} HTTP error: {e}")


def tool_ssl():
    domain = input("Domain: ").strip()
    if not domain:
        return
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((domain, 443), timeout=6) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as ssock:
                cert = ssock.getpeercert()
                issuer = dict(x[0] for x in cert.get("issuer", []))
                print(f"{C.GREEN}[+]{C.END} Issuer : {issuer.get('organizationName', issuer)}")
                print(f"{C.GREEN}[+]{C.END} Expires: {cert.get('notAfter')}")
    except Exception as e:
        print(f"{C.RED}[-]{C.END} SSL error: {e}")


def tool_whois():
    domain = input("Domain: ").strip()
    if not domain:
        return
    try:
        with socket.create_connection(("whois.iana.org", 43), timeout=6) as s:
            s.sendall((domain + "\r\n").encode())
            chunks = []
            while data := s.recv(4096):
                chunks.append(data)
            print(b"".join(chunks).decode(errors="replace"))
    except Exception as e:
        print(f"{C.RED}[-]{C.END} WHOIS error: {e}")


def tool_hash():
    text = input("Text to hash (SHA-256): ")
    print(f"{C.GREEN}[SHA-256]{C.END} {hashlib.sha256(text.encode('utf-8')).hexdigest()}")


def tool_random_ip():
    for _ in range(5):
        print(f"  {random.randint(1, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}")


def tool_website_analyser():
    raw = input("URL or domain (e.g. https://example.com): ").strip()
    if not raw:
        return
    url = raw if raw.startswith(("http://", "https://")) else "https://" + raw
    host = urllib.parse.urlparse(url).hostname or raw
    print(f"\n{C.CYAN}--- WEBSITE ANALYSER: {host} ---{C.END}")
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "NETFORGE-CLI"})
        t0 = time.perf_counter()
        with urllib.request.urlopen(req, timeout=8) as r:
            ms = round((time.perf_counter() - t0) * 1000)
            print(f"{C.GREEN}[HTTP]{C.END} Status: {r.status} ({ms} ms)")
            for h in ("Strict-Transport-Security", "Content-Security-Policy", "X-Frame-Options"):
                print(f"  {h}: {'Present' if r.headers.get(h) else 'Missing'}")
    except Exception as e:
        print(f"{C.RED}[HTTP]{C.END} {e}")
    for rtype in ("A", "AAAA", "MX"):
        try:
            d = fetch_json(f"https://dns.google/resolve?name={urllib.parse.quote(host)}&type={rtype}")
            ans = [x.get("data") for x in d.get("Answer", [])]
            print(f"{C.GREEN}[{rtype}]{C.END} {', '.join(ans) if ans else '—'}")
        except Exception:
            pass


TOOLS = {
    "1": ("My IP & Network Info", tool_my_ip),
    "2": ("IP / Domain Geolocation Lookup", tool_ip_lookup),
    "3": ("DNS Records (A, AAAA, MX, TXT, NS)", tool_dns),
    "4": ("Reverse DNS (PTR)", tool_reverse_dns),
    "5": ("Fast Port Scanner", tool_ports),
    "6": ("Ping Test (IPv4/IPv6)", tool_ping),
    "7": ("Traceroute (IPv4/IPv6)", tool_traceroute),
    "8": ("Subnet / CIDR Calculator", tool_subnet),
    "9": ("HTTP Headers & Status", tool_http),
    "10": ("SSL Certificate Checker", tool_ssl),
    "11": ("WHOIS Domain Lookup", tool_whois),
    "12": ("SHA-256 Hash Generator", tool_hash),
    "13": ("Random Public IPv4 Generator", tool_random_ip),
    "14": ("Website Analyser (HTTP + DNS)", tool_website_analyser),
}


def main():
    while True:
        try:
            clear()
            header()
            for k, (label, _) in TOOLS.items():
                print(f"  [{k:>2}] {label}")
            print("  [ 0] Exit")
            choice = input(f"\n{C.BOLD}Select [0-13]: {C.END}").strip()
            if choice == "0":
                print("Goodbye!")
                break
            if choice in TOOLS:
                print()
                TOOLS[choice][1]()
            else:
                print(f"{C.RED}Invalid choice.{C.END}")
            input(f"\n{C.YELLOW}Press Enter to continue...{C.END}")
        except KeyboardInterrupt:
            print("\nGoodbye!")
            break


if __name__ == "__main__":
    main()
