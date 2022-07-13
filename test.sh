#!/bin/bash
set -e
set -u

if [[ ! -e 'source-key.wif' ]]; then
    echo "Please run 'crowdnode generate ./source-key.wif' and load it with Đ0.01 to start"
    exit 1
fi

./bin/crowdnode.js generate ./staking-key.wif
(
    set -e
    set -u
    sleep 0.5
    ./bin/crowdnode.js transfer source-key.wif ./staking-key.wif 0.00256000
) &
./bin/crowdnode.js signup ./staking-key.wif
./bin/crowdnode.js accept ./staking-key.wif
(
    set -e
    set -u
    sleep 0.5
    ./bin/crowdnode.js transfer source-key.wif ./staking-key.wif
) &
./bin/crowdnode.js deposit ./staking-key.wif
./bin/crowdnode.js withdraw ./staking-key.wif 100.0
./bin/crowdnode.js balance ./staking-key.wif
./bin/crowdnode.js transfer ./staking-key.wif ./source-key.wif
