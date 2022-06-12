#!/bin/bash
set -e
set -u

my_rawtx="$(cat ./rawtx.hex)"
curl -X POST https://insight.dash.org/insight-api-dash/tx/sendix \
    --data-urlencode "rawtx=${my_rawtx}"
