<# NETFORGE All-in-One Network CLI Suite (PowerShell 5.1+ / 7+) #>
$ErrorActionPreference = 'Stop'

function Show-Banner {
    Clear-Host
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host "   NETFORGE - ALL-IN-ONE CLI CHECKER (PowerShell)" -ForegroundColor White
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Invoke-MyIp {
    Write-Host "[+] Hostname: $env:COMPUTERNAME" -ForegroundColor Green
    Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' } |
        Select-Object InterfaceAlias, IPAddress | Format-Table -AutoSize
    try {
        $pub = Invoke-RestMethod -Uri "https://ipwho.is/" -TimeoutSec 8
        Write-Host "[+] Public IP : $($pub.ip)" -ForegroundColor Green
        Write-Host "[+] Location  : $($pub.city), $($pub.country)" -ForegroundColor Green
        Write-Host "[+] ISP / ASN : $($pub.connection.isp) (AS$($pub.connection.asn))" -ForegroundColor Green
    } catch {
        Write-Host "[-] Public IP lookup failed: $_" -ForegroundColor Red
    }
}

function Invoke-IpLookup {
    $t = Read-Host "IP or domain"
    if (-not $t) { return }
    try {
        $d = Invoke-RestMethod -Uri "https://ipwho.is/$t" -TimeoutSec 8
        $d | Select-Object ip, country, city, @{N='isp';E={$_.connection.isp}}, @{N='asn';E={$_.connection.asn}} | Format-List
    } catch {
        Write-Host "[-] Lookup error: $_" -ForegroundColor Red
    }
}

function Invoke-DnsLookup {
    $d = Read-Host "Domain"
    if (-not $d) { return }
    foreach ($type in @('A', 'AAAA', 'MX', 'TXT', 'NS')) {
        try {
            Resolve-DnsName -Name $d -Type $type -ErrorAction Stop | Format-Table Name, Type, TTL, IPAddress, NameExchange, Strings -AutoSize
        } catch {
            Write-Host "[$type] No records" -ForegroundColor DarkGray
        }
    }
}

function Invoke-PortScan {
    $t = Read-Host "IP or domain"
    if (-not $t) { return }
    foreach ($p in @(21, 22, 25, 53, 80, 110, 443, 3306, 8080)) {
        $res = Test-NetConnection -ComputerName $t -Port $p -WarningAction SilentlyContinue
        if ($res.TcpTestSucceeded) {
            Write-Host "  Port ${p}: OPEN" -ForegroundColor Green
        } else {
            Write-Host "  Port ${p}: CLOSED" -ForegroundColor Red
        }
    }
}

function Invoke-PingTool {
    $t = Read-Host "IP or domain"
    if ($t) { Test-Connection $t -Count 4 }
}

function Invoke-TraceTool {
    $t = Read-Host "IP or domain"
    if ($t) { Test-NetConnection -TraceRoute -ComputerName $t }
}

function Invoke-HttpCheck {
    $u = Read-Host "URL (e.g. https://example.com)"
    if (-not $u) { return }
    if ($u -notmatch '^https?://') { $u = "https://$u" }
    try {
        $r = Invoke-WebRequest -Uri $u -Method Head -TimeoutSec 8
        Write-Host "[$($r.StatusCode)] $($r.StatusDescription)" -ForegroundColor Green
        $r.Headers.GetEnumerator() | Format-Table -AutoSize
    } catch {
        Write-Host "[-] HTTP error: $_" -ForegroundColor Red
    }
}

function Invoke-Netstat {
    Get-NetTCPConnection | Select-Object -First 30 LocalAddress, LocalPort, RemoteAddress, RemotePort, State | Format-Table -AutoSize
}

while ($true) {
    Show-Banner
    Write-Host "  [ 1] My IP & Network Info"
    Write-Host "  [ 2] IP / Domain Geolocation Lookup"
    Write-Host "  [ 3] DNS Records (A, AAAA, MX, TXT, NS)"
    Write-Host "  [ 4] Fast Port Scanner"
    Write-Host "  [ 5] Ping Test"
    Write-Host "  [ 6] Traceroute"
    Write-Host "  [ 7] HTTP Headers & Status"
    Write-Host "  [ 8] Active TCP Connections (Netstat)"
    Write-Host "  [ 0] Exit"
    $c = Read-Host "`nSelect [0-8]"
    switch ($c) {
        '1' { Invoke-MyIp }
        '2' { Invoke-IpLookup }
        '3' { Invoke-DnsLookup }
        '4' { Invoke-PortScan }
        '5' { Invoke-PingTool }
        '6' { Invoke-TraceTool }
        '7' { Invoke-HttpCheck }
        '8' { Invoke-Netstat }
        '0' { exit 0 }
        default { Write-Host "Invalid choice." -ForegroundColor Red }
    }
    Read-Host "`nPress Enter to continue"
}
