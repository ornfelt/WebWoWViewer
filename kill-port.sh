#!/usr/bin/env bash
# Show which process listens on the WebWoWViewer dev server port (8888 by default) and offer to kill it.
#
# Usage: ./kill-port.sh [port]

port="${1:-8888}"

if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
    echo "Invalid port: '$port'" >&2
    exit 2
fi

# The ids of the processes listening on the port, one per line (lsof, else ss, else fuser)
find_pids() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null
    elif command -v ss >/dev/null 2>&1; then
        ss -Hltnp "sport = :$port" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2
    elif command -v fuser >/dev/null 2>&1; then
        fuser -n tcp "$port" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$'
    else
        echo "Need lsof, ss or fuser to find the process on a port" >&2
        exit 2
    fi
}

mapfile -t pids < <(find_pids | sort -un)

if (( ${#pids[@]} == 0 )); then
    # ss / lsof only show the owner of another user's process to root
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
        echo "Port $port is in use, but its process is not visible (owned by another user? try sudo)."
        exit 1
    fi
    echo "Port $port is free."
    exit 0
fi

echo "Port $port is in use by:"
for pid in "${pids[@]}"; do
    echo
    echo "  PID:     $pid"
    echo "  Name:    $(ps -o comm= -p "$pid" 2>/dev/null)"
    echo "  User:    $(ps -o user= -p "$pid" 2>/dev/null)"
    echo "  Started: $(ps -o lstart= -p "$pid" 2>/dev/null)"
    echo "  Command: $(ps -o args= -p "$pid" 2>/dev/null)"
    # node rewrites its command line to the process title (e.g. just "webpack"), so also show the binary and directory
    if [[ -r "/proc/$pid/exe" || -L "/proc/$pid/exe" ]]; then
        exe="$(readlink "/proc/$pid/exe" 2>/dev/null)"
        cwd="$(readlink "/proc/$pid/cwd" 2>/dev/null)"
        [[ -n "$exe" ]] && echo "  Exe:     $exe"
        [[ -n "$cwd" ]] && echo "  Dir:     $cwd"
    fi
    ppid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    if [[ -n "$ppid" && "$ppid" != "1" ]]; then
        echo "  Parent:  $ppid $(ps -o args= -p "$ppid" 2>/dev/null)"
    fi
done
echo

read -r -p "Kill it? [y/N] " answer
case "${answer,,}" in
    y|yes) ;;
    *) echo "Not killed."; exit 0 ;;
esac

status=0
for pid in "${pids[@]}"; do
    if ! kill "$pid" 2>/dev/null; then
        echo "Could not kill $pid (owned by another user? try sudo)." >&2
        status=1
        continue
    fi
    # give it 5 seconds to exit, then force it
    for _ in {1..50}; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.1
    done
    if kill -0 "$pid" 2>/dev/null; then
        echo "$pid did not exit, sending SIGKILL."
        kill -9 "$pid" 2>/dev/null
    fi
    echo "Killed $pid."
done
exit $status
