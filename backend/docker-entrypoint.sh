#!/bin/sh
# Make the certificate store writable for the `node` user (platform volumes mount as root), then drop privileges.
set -e
mkdir -p "${DATA_DIR:-/data}"
chown -R node:node "${DATA_DIR:-/data}"
exec su-exec node "$@"
