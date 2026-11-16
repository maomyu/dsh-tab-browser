#!/bin/sh
set -eu

umask 077
if [ "${1-}" != '--session' ]; then
  dbus-uuidgen --ensure="$HOME/.local/share/dsh-machine-id"
  exec dbus-run-session -- "$0" --session "$@"
fi
export XDG_RUNTIME_DIR="$(mktemp -d)"
export XAUTHORITY="$XDG_RUNTIME_DIR/Xauthority"
xauth -f "$XAUTHORITY" add "$DISPLAY" MIT-MAGIC-COOKIE-1 "$(mcookie)"
Xtigervnc "$DISPLAY" -geometry 1366x900 -depth 24 -auth "$XAUTHORITY" \
  -interface 127.0.0.1 -localhost yes -rfbport 5900 -SecurityTypes None -AlwaysShared -nolisten tcp &
xserver=$!
desktop=''
browser=''
cleanup() {
  if [ -n "$browser" ]; then kill -TERM "$browser" 2>/dev/null || true; wait "$browser" || true; fi
  if [ -n "$desktop" ]; then kill -TERM "$desktop" 2>/dev/null || true; fi
  kill -TERM "$xserver" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' INT TERM

for attempt in $(seq 1 50); do
  if xdpyinfo >/dev/null 2>&1; then break; fi
  kill -0 "$xserver"
  sleep .1
done
xdpyinfo >/dev/null
openbox --sm-disable &
desktop=$!
dbus-update-activation-environment DISPLAY XAUTHORITY XDG_RUNTIME_DIR
gnome-keyring-daemon --start --components=secrets >/dev/null
printf '%s\n' "$DBUS_SESSION_BUS_ADDRESS" > /tmp/dsh-chrome-session-bus
if [ "${2-}" = '--unlock-keyring' ]; then
  python3 /usr/local/bin/chrome-keyring.py startup || true
fi
profile="$HOME/.config/dsh-google-chrome"
old_profile="$HOME/.config/google-chrome"
if [ ! -e "$profile" ] && [ -d "$old_profile" ] && [ ! -L "$old_profile" ]; then
  mv "$old_profile" "$profile"
  ln -s "$profile" "$old_profile"
fi
python3 /usr/local/bin/chrome-cookie-pipe.py --user-data-dir="$profile" \
  --ozone-platform=x11 --password-store=gnome-libsecret \
  --no-first-run --no-default-browser-check --start-maximized --lang=zh-CN &
browser=$!
wait "$browser"
