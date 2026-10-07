#!/bin/sh
port="${PORT:-4000}"
curl -sf -o /dev/null "http://127.0.0.1:${port}/" || exit 1
