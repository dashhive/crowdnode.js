#!/bin/bash
set -e
set -u

# See https://knowledge.crowdnode.io/en/articles/5963880-blockchain-api-guide
MSG_SIGNUP=$((131072 + 20000))
MSG_AGREE=$((65536 + 20000))
MSG_DEPOSIT=$((100000 + 20000))

#CHANGE=
HOTWALLET=XjbaGWaGnvEtuQAUoBgDxJWe8ZNv45upG2

node create-tx.js \
    "${CHANGE}" \
    "${HOTWALLET}":${MSG_SIGNUP} \
    > rawtx.hex
bash send-tx.sh
sleep 180

node create-tx.js \
    "${CHANGE}" \
    "${HOTWALLET}":${MSG_AGREE} \
    > rawtx.hex
bash send-tx.sh
sleep 30

node create-tx.js \
    "${CHANGE}" \
    "${HOTWALLET}":${MSG_DEPOSIT} \
    > rawtx.hex
bash send-tx.sh
