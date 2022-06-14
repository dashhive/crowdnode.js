#!/bin/bash
set -e
set -u

curl 'https://knowledge.crowdnode.io/en/articles/5963880-blockchain-api-guide' |
    sd '>' '\n' |
    sd '<' '\n' |
    grep '\<https://app\.crowdnode\.io' |
    grep -v 'href=' |
    sd -s '[YOUR_ADDRESS]' '${pub}' |
    sd -s '[ADDRESS]' '${pub}'
