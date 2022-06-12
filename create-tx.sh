#!/bin/bash
set -e
set -u

# See https://knowledge.crowdnode.io/en/articles/5963880-blockchain-api-guide
MSG_SIGNUP=$((131072 + 20000 + 1000))
MSG_AGREE=$((65536 + 20000 + 1000))

#SOURCE_ADDRESS=

node create-tx.js \
    "${SOURCE_ADDRESS}" \
    "${SOURCE_ADDRESS}:${MSG_SIGNUP}" \
    "${SOURCE_ADDRESS}:${MSG_AGREE}" \
    > rawtx.hex
