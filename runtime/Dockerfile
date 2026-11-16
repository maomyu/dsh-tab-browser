FROM debian:trixie-slim

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl dbus-x11 fonts-noto-cjk gcr gnome-keyring \
      netcat-openbsd openbox procps python3-minimal tigervnc-standalone-server x11-utils xauth; \
    curl -fsSL https://dl.google.com/linux/linux_signing_key.pub -o /usr/share/keyrings/google-chrome.asc; \
    printf '%s\n' 'deb [signed-by=/usr/share/keyrings/google-chrome.asc] https://dl.google.com/linux/chrome/deb/ stable main' \
      > /etc/apt/sources.list.d/google-chrome.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends google-chrome-stable; \
    rm -rf /var/lib/apt/lists/*; \
    useradd --create-home --uid 1000 chrome; \
    install -d -o chrome -g chrome -m 0700 /home/chrome/.config /home/chrome/.local/share

RUN install -d -m 1777 /tmp/.X11-unix && rm -f /etc/machine-id \
    && ln -s /home/chrome/.local/share/dsh-machine-id /etc/machine-id
COPY --chmod=755 start-chrome.sh /usr/local/bin/start-chrome
COPY chrome-cookie-pipe.py /usr/local/bin/chrome-cookie-pipe.py
USER chrome
ENV HOME=/home/chrome DISPLAY=:19 LANG=C.UTF-8
ENTRYPOINT ["/usr/local/bin/start-chrome"]
