# Firewall Guard elevated broker.
# Started once (via UAC) by the app when the user enables managed blocking.
# Polls backend\data\broker\queue\*.json commands, executes them elevated, writes .ack results.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot      # project root (script lives in scripts\)
$base = Join-Path $root 'backend\data\broker'
$queue = Join-Path $base 'queue'
$acks = Join-Path $base 'acks'
$heartbeat = Join-Path $base 'heartbeat.json'
New-Item -ItemType Directory -Force -Path $queue, $acks | Out-Null
$started = (Get-Date).ToString('o')
$version = 1

function Write-Heartbeat {
    try {
        @{ ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); pid = $PID; started = $started; version = $version } |
            ConvertTo-Json -Compress | Set-Content -LiteralPath $heartbeat -Encoding UTF8
    } catch { }
}

function Set-AckResult($id, $obj) {
    try {
        $obj.id = $id
        $obj | ConvertTo-Json -Depth 6 -Compress | Set-Content -LiteralPath (Join-Path $acks ($id + '.ack.json')) -Encoding UTF8
    } catch { }
}

while ($true) {
    Write-Heartbeat
    $commands = Get-ChildItem -LiteralPath $queue -Filter '*.cmd.json' -ErrorAction SilentlyContinue | Sort-Object Name
    foreach ($c in $commands) {
        try { $cmd = Get-Content -LiteralPath $c.FullName -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $cmd = $null }
        if (-not $cmd -or -not $cmd.id) { Remove-Item -LiteralPath $c.FullName -Force -ErrorAction SilentlyContinue; continue }
        $out = @{ status = 'unknown'; detail = @(); created = @(); failed = @() }
        try {
            switch ($cmd.op) {
                'firewall-batch' {
                    $out.status = 'ok'
                    foreach ($r in @($cmd.payload.add)) {
                        $name = [string]$r.name
                        try {
                            Invoke-Expression -Command ([string]$r.command) | Out-Null
                            $chk = Get-NetFirewallRule -DisplayName ('FGF-') -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq $name }
                            if (-not $chk) { throw 'verify failed (rule not found)' }
                            $out.created += $name
                        } catch { $out.failed += ($name + '|' + $_.Exception.Message) }
                    }
                    foreach ($n in @($cmd.payload.remove)) {
                        try {
                            $r0 = Get-NetFirewallRule -DisplayName ([string]$n) -ErrorAction Stop
                            $r0 | Remove-NetFirewallRule -ErrorAction Stop
                            if (Get-NetFirewallRule -DisplayName ([string]$n) -ErrorAction SilentlyContinue) { throw 'still exists' }
                            $out.created += ([string]$n)   # succeeded set for diff clarity
                        } catch { $out.failed += (([string]$n) + '|' + $_.Exception.Message) }
                    }
                    $out.detail = @{ created = $out.created.Count; failed = $out.failed.Count }
                }
                'audit-enable' {
                    foreach ($sc in @('Filtering Platform Packet Drop','Filtering Platform Connection')) {
                        $p = Start-Process -FilePath 'auditpol.exe' -ArgumentList @('/set', "/subcategory:$sc", '/success:enable') -Wait -PassThru -WindowStyle Hidden
                        if ($p.ExitCode -eq 0) { $out.created += ("audit:" + $sc) } else { $out.failed += ('audit:' + $sc) }
                    }
                    wevtutil sl Microsoft-Windows-DNS-Client/Operational /e:true 2>$null | Out-Null
                    $out.status = 'ok'
                }
                'capture-start' {
                    $etl = [string]$cmd.payload.etl
                    logman delete FGFNetCapture 2>$null | Out-Null
                    $args = @('create','trace','FGFNetCapture','-o', $etl, '-p', 'Microsoft-Windows-Kernel-Network', '0xffffffff', '-nb', '32', '128', '-mode', 'Circular', '-ets')
                    $p = Start-Process -FilePath 'logman.exe' -ArgumentList $args -Wait -PassThru -WindowStyle Hidden
                    if ($p.ExitCode -eq 0) { $out.status = 'ok' } else { $out.status = 'failed'; $out.error = 'logman exit ' + $p.ExitCode }
                }
                'capture-stop' {
                    logman stop FGFNetCapture -ets 2>$null | Out-Null
                    logman delete FGFNetCapture 2>$null | Out-Null
                    $out.status = 'ok'
                }
                default { $out.status = 'ignored'; $out.error = 'unknown op ' + $cmd.op }
            }
        } catch {
            $out.status = 'failed'; $out.error = $_.Exception.Message
        }
        Set-AckResult ([string]$cmd.id) $out
        Remove-Item -LiteralPath $c.FullName -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 1500
}
