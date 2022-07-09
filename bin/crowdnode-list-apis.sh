#!/bin/bash
set -e
set -u

curl 'https://knowledge.crowdnode.io/en/articles/5963880-blockchain-api-guide' |
    tr '>' '\n' |
    tr '<' '\n' |
    grep 'https://app.crowdnode.io' |
    grep -v 'href=' |
    sed 's/\[YOUR_ADDRESS\]/${pub}/' |
    sed 's/\[ADDRESS\]/${pub}/'
