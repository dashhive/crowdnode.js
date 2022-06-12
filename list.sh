#!/bin/bash
set -e
set -u

#SOURCE_ADDRESS=

echo "Messages:"
curl $'https://app.crowdnode.io/odata/apimessages/GetMessages(address=\''"${SOURCE_ADDRESS}"$'\')' \
    --compressed | jq

echo "Balance:"
curl $'https://app.crowdnode.io/odata/apifundings/GetBalance(address=\''"${SOURCE_ADDRESS}"$'\')' \
    --compressed | jq

echo "Funds:"
curl $'https://app.crowdnode.io/odata/apifundings/GetFunds(address=\''"${SOURCE_ADDRESS}"$'\')' \
    --compressed | jq
