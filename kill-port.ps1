# Show which process listens on the WebWoWViewer dev server port (8888 by default) and offer to kill it.
#
# Usage: .\kill-port.ps1 [port]

param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8888
)

# The ids of the processes listening on the port (Get-NetTCPConnection, else netstat)
function Find-ListeningPids([int]$Port) {
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique)
    }
    # netstat -ano: "  TCP    0.0.0.0:8888    0.0.0.0:0    LISTENING    1234"
    return @(netstat -ano -p TCP | ForEach-Object {
        $cols = $_.Trim() -split '\s+'
        if ($cols.Count -ge 5 -and $cols[3] -eq 'LISTENING' -and $cols[1] -match ":$Port$") { [int]$cols[4] }
    } | Select-Object -Unique)
}

$pids = @(Find-ListeningPids $Port | Where-Object { $_ -gt 0 })

if ($pids.Count -eq 0) {
    Write-Host "Port $Port is free."
    exit 0
}

Write-Host "Port $Port is in use by:"
foreach ($id in $pids) {
    $proc = Get-Process -Id $id -ErrorAction SilentlyContinue
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $id" -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "  PID:         $id"
    if ($proc) {
        Write-Host "  Name:        $($proc.ProcessName)"
        if ($proc.Description) { Write-Host "  Description: $($proc.Description)" }
        # StartTime / Path need access to the process; they are empty for another user's process without admin rights
        if ($proc.StartTime) { Write-Host "  Started:     $($proc.StartTime)" }
        if ($proc.Path) { Write-Host "  Path:        $($proc.Path)" }
    } else {
        Write-Host "  (process details not available)"
    }
    if ($cim) {
        if ($cim.CommandLine) { Write-Host "  Command:     $($cim.CommandLine)" }
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId = $($cim.ParentProcessId)" -ErrorAction SilentlyContinue
        if ($parent) { Write-Host "  Parent:      $($parent.ProcessId) $($parent.Name)" }
    }
}
Write-Host ""

$answer = Read-Host "Kill it? [y/N]"
if ($answer.Trim().ToLower() -notin @('y', 'yes')) {
    Write-Host "Not killed."
    exit 0
}

$status = 0
foreach ($id in $pids) {
    try {
        Stop-Process -Id $id -Force -ErrorAction Stop
        Write-Host "Killed $id."
    } catch {
        Write-Host "Could not kill ${id}: $($_.Exception.Message) (run as administrator?)" -ForegroundColor Red
        $status = 1
    }
}
exit $status
