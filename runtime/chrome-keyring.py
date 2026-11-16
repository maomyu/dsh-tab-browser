import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time

import dbus


SOCKET = '/tmp/dsh-chrome-keyring.sock'
SESSION_ADDRESS = '/tmp/dsh-chrome-session-bus'
MAX_PASSWORD = 1024


def unlock(password, bus_address):
    if not password or len(password) > MAX_PASSWORD:
        return False
    bus = dbus.bus.BusConnection(bus_address)
    try:
        service = bus.get_object('org.freedesktop.secrets', '/org/freedesktop/secrets', introspect=False)
        secret_service = dbus.Interface(service, 'org.freedesktop.Secret.Service')
        collection = secret_service.ReadAlias(dbus.String('default'), timeout=3)
        if collection == '/':
            return False
        _, session = secret_service.OpenSession(dbus.String('plain'), dbus.String('', variant_level=1), timeout=3)
        try:
            internal = dbus.Interface(service, 'org.gnome.keyring.InternalUnsupportedGuiltRiddenInterface')
            secret = dbus.Struct((session, dbus.ByteArray(b''), dbus.ByteArray(password), dbus.String('text/plain')),
                                 signature='oayays')
            internal.UnlockWithMasterPassword(collection, secret, timeout=3)
            return True
        finally:
            proxy = bus.get_object('org.freedesktop.secrets', session, introspect=False)
            proxy.Close(dbus_interface='org.freedesktop.Secret.Session', timeout=3)
    finally:
        bus.close()


def check_password(password):
    source = Path.home() / '.local/share/keyrings'
    if not source.is_dir():
        return False
    with tempfile.TemporaryDirectory() as directory:
        target = Path(directory) / 'keyrings'
        target.mkdir(mode=0o700)
        for file in source.iterdir():
            if not file.is_symlink() and file.is_file() and (file.suffix == '.keyring' or file.name == 'default'):
                shutil.copyfile(file, target / file.name)
                (target / file.name).chmod(0o600)

        # A running keyring may already be unlocked. Test the password against
        # a fresh daemon so an incorrect password never locks the live browser.
        env = {**os.environ, 'XDG_DATA_HOME': directory, 'XDG_RUNTIME_DIR': directory}
        env.pop('GNOME_KEYRING_CONTROL', None)
        result = subprocess.run(
            ['dbus-run-session', '--', 'sh', '-c',
             'gnome-keyring-daemon --start --components=secrets >/dev/null && exec python3 "$1" check',
             'dsh-keyring', __file__],
            input=password, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=12,
        )
        return result.returncode == 0


def serve_startup():
    with socket.socket(socket.AF_UNIX) as server:
        server.bind(SOCKET)
        server.listen(1)
        server.settimeout(16)
        try:
            connection, _ = server.accept()
            with connection, connection.makefile('rb') as source:
                connection.settimeout(4)
                password = source.read(MAX_PASSWORD + 1)
                try:
                    success = unlock(password, os.environ['DBUS_SESSION_BUS_ADDRESS'])
                except dbus.DBusException:
                    success = False
                connection.sendall(b'ok\n' if success else b'error\n')
        finally:
            Path(SOCKET).unlink(missing_ok=True)


def main(action):
    if action == 'startup':
        serve_startup()
        return True
    password = sys.stdin.buffer.read(MAX_PASSWORD + 1)
    if not password or len(password) > MAX_PASSWORD:
        return False
    if action == 'send':
        with socket.socket(socket.AF_UNIX) as connection:
            connection.settimeout(13)
            deadline = time.monotonic() + 8
            while True:
                try:
                    connection.connect(SOCKET)
                    break
                except (FileNotFoundError, ConnectionRefusedError):
                    if time.monotonic() >= deadline:
                        return False
                    time.sleep(0.2)
            connection.sendall(password)
            connection.shutdown(socket.SHUT_WR)
            with connection.makefile('rb') as response:
                return response.readline(16) == b'ok\n'
    if action == 'verify':
        return check_password(password)
    if action == 'current':
        return unlock(password, Path(SESSION_ADDRESS).read_text().strip())
    if action == 'check':
        return unlock(password, os.environ['DBUS_SESSION_BUS_ADDRESS'])
    return False


try:
    success = main(sys.argv[1])
except (dbus.DBusException, OSError, subprocess.SubprocessError):
    success = False
sys.exit(0 if success else 1)
