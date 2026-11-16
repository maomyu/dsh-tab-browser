import json
import os
import select
import signal
import socket
import subprocess
import sys
import time


SOCKET_PATH = '/tmp/dsh-chrome-cookie-import.sock'
MAX_REQUEST = 128 * 1024


def import_cookies(connection, chrome_input, chrome_output, command_id):
    connection.settimeout(5)
    with connection.makefile('rb') as incoming:
        payload = incoming.readline(MAX_REQUEST + 2)
    if not payload.endswith(b'\n') or len(payload) > MAX_REQUEST + 1:
        return False
    cookies = json.loads(payload)
    if not isinstance(cookies, list) or not cookies or len(cookies) > 200:
        return False

    message = {'id': command_id, 'method': 'Storage.setCookies', 'params': {'cookies': cookies}}
    chrome_input.write(json.dumps(message).encode() + b'\0')
    chrome_input.flush()
    deadline = time.monotonic() + 20
    pending = b''
    while time.monotonic() < deadline:
        ready, _, _ = select.select([chrome_output], [], [], max(0, deadline - time.monotonic()))
        if not ready:
            return False
        chunk = os.read(chrome_output, 65536)
        if not chunk:
            return False
        parts = (pending + chunk).split(b'\0')
        pending = parts.pop()
        for part in parts:
            response = json.loads(part)
            if response.get('id') == command_id:
                return 'result' in response
    return False


def main():
    chrome_read, bridge_write = os.pipe()
    bridge_read, chrome_write = os.pipe()
    # Chrome reads CDP messages on fd 3 and writes replies on fd 4.
    shell = 'exec google-chrome-stable --remote-debugging-pipe "$@" 3<&' + str(chrome_read) + ' 4>&' + str(chrome_write)
    chrome = subprocess.Popen(['/bin/bash', '-c', shell, 'chrome', *sys.argv[1:]],
                              pass_fds=(chrome_read, chrome_write))
    os.close(chrome_read)
    os.close(chrome_write)
    signal.signal(signal.SIGTERM, lambda *_: chrome.terminate())
    try:
        with socket.socket(socket.AF_UNIX) as server, os.fdopen(bridge_write, 'wb') as chrome_input:
            server.bind(SOCKET_PATH)
            server.listen(1)
            server.settimeout(0.5)
            command_id = 0
            while chrome.poll() is None:
                try:
                    connection, _ = server.accept()
                except TimeoutError:
                    continue
                with connection:
                    command_id += 1
                    try:
                        ok = import_cookies(connection, chrome_input, bridge_read, command_id)
                    except (OSError, ValueError):
                        ok = False
                    try:
                        connection.sendall(b'ok\n' if ok else b'error\n')
                    except OSError:
                        pass
    finally:
        os.close(bridge_read)
        if chrome.poll() is None:
            chrome.terminate()
        chrome.wait()
        if os.path.exists(SOCKET_PATH):
            os.unlink(SOCKET_PATH)


if sys.argv[1:] == ['--import']:
    with socket.socket(socket.AF_UNIX) as connection:
        connection.settimeout(26)
        connection.connect(SOCKET_PATH)
        connection.sendall(sys.stdin.buffer.read(MAX_REQUEST + 2))
        connection.shutdown(socket.SHUT_WR)
        with connection.makefile('rb') as reply:
            sys.stdout.buffer.write(reply.readline(32))
else:
    main()
