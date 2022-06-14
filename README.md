# CrowdNode Node.js SDK

CrowdNode allows you to become a partial MNO - staking Dash to earn interest,
participate in voting, etc.

The CrowdNode Node.js SDK enables you to build Web-based flows and
cross-platform CLI tools to privately manage staking using CrowdNode's KYC-free
Blockchain API.

# Install

## Node.js

You must have [node.js](https://webinstall.dev/node) installed:

```bash
# Mac, Linux
curl https://webinstall.dev/node | bash
export PATH="${HOME}/.local/opt/node:$PATH"
```

```pwsh
# Windows
curl.exe -A MS https://webinstall.dev/node | powershell
PATH %USERPROFILE%\.local\opt\node;%PATH%
```

## CrowdNode SDK

```bash
npm install --save crowdnode@v1
```

# API

The SDK also provides Type Hinting via JSDoc (compatible with TypeScript / tsc
without any transpiling).

## QuickStart

The CrowdNode SDK uses Dashcore to create raw transactions and broadcasts them
as Instant Send via the Dash Insight API. It uses Dash Insight WebSockets to
listen for responses from the CrowdNode hotwallet.

A simple CrowdNode application may look like this:

```js
"use strict";

let Fs = require("fs").promises;
let CrowdNode = require("crowdnode");

async function main() {
  let keyfile = process.argv[2];

  // a wallet pre-loaded with about Đ0.001
  let wif = await Fs.readFile(keyfile, "utf8");
  wif = wif.trim();

  // Initializes API info, such as hotwallets
  await CrowdNode.init({ insightBaseUrl: "https://insight.dash.org/" });

  let hotwallet = CrowdNode.main.hotwallet;
  await CrowdNode.signup(wif, hotwallet);
  await CrowdNode.accept(wif, hotwallet);
  await CrowdNode.deposit(wif, hotwallet);

  console.info("Congrats! You're staking!");
}

main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
  process.exit(1);
});
```

There are also a number of utility functions which are not exposed as public
APIs, but which you could learn from in [crowdnode-cli](/bin/crowdnode.js).

## Constants

```js
CrowdNode.offset = 20000;
CrowdNode.duffs = 100000000;
CrowdNode.depositMinimum = 10000;

CrowdNode.requests = {
  acceptTerms: 65536,
  offset: 20000,
  signupForApi: 131072,
  toggleInstantPayout: 4096,
  withdrawMin: 1,
  withdrawMax: 1000,
};

CrowdNode.responses = {
  PleaseAcceptTerms: 2,
  WelcomeToCrowdNodeBlockChainAPI: 4,
  DepositReceived: 8,
  WithdrawalQueued: 16,
  WithdrawalFailed: 32,
  AutoWithdrawalEnabled: 64,
  AutoWithdrawalDisabled: 128,
};
```

## Usage

### Manage Stake

```js
await CrowdNode.init({ insightBaseUrl: "https://insight.dash.org" });

CrowdNode.main.baseUrl; // "https://app.crowdnode.io"
CrowdNode.main.hotwallet; // "XjbaGWaGnvEtuQAUoBgDxJWe8ZNv45upG2"

await CrowdNode.status(pubAddress, hotwallet);
/*
 * {
 *   signup: 0, // seconds since unix epoch
 *   accept: 0,
 *   deposit: 0,
 * }
 */

await CrowdNode.signup(wif, hotwallet);
/** @type SocketPayment
 * {
 *   "address": "Xj00000000000000000000000000000000",
 *   "satoshis": 20002, // PleaseAcceptTerms
 *   "timestamp": 1655634136000,
 *   "txid": "xxxx...",
 *   "txlock": true
 * }
 */

await CrowdNode.accept(wif, hotwallet);
/** @type SocketPayment
 * {
 *   "address": "Xj00000000000000000000000000000000",
 *   "satoshis": 20004, // WelcomeToCrowdNodeBlockChainAPI
 *   "timestamp": 1655634138000,
 *   "txid": "xxxx...",
 *   "txlock": true
 * }
 */

await CrowdNode.deposit(wif, hotwallet, (amount = 0));
/** @type SocketPayment
 * {
 *   "address": "Xj00000000000000000000000000000000",
 *   "satoshis": 20008, // DepositReceived
 *   "timestamp": 1655634142000,
 *   "txid": "xxxx...",
 *   "txlock": true
 * }
 */

await CrowdNode.withdrawal(wif, hotwallet, permil);
/** @type SocketPayment
 * {
 *   "address": "Xj00000000000000000000000000000000",
 *   "satoshis": 20016, // WithdrawalQueued
 *   "timestamp": 1657634142000,
 *   "txid": "xxxx...",
 *   "txlock": true
 * }
 */
```

### HTTP RPC

```js
await CrowdNode.http.GetBalance(pubAddr);
/** @type CrowdNodeBalance
 * {
 *   "DashAddress": "Xj00000000000000000000000000000000",
 *   "TotalBalance": 0.01292824,
 *   "TotalActiveBalance": 0,
 *   "TotalDividend": 0,
 *   "UpdatedOn": "2022-06-19T08:06:19.11",
 *   "UpdateOnUnixTime": 1655625979
 * }
 */

await CrowdNode.http.GetFunds(pubAddr);
await CrowdNode.http.GetFundsFrom(pubAddr, secondsSinceEpoch);
/*
 *  [
 *    {
 *      "FundingType": 1,
 *      "Amount": 0.00810218,
 *      "Time": 1655553336,
 *      "TimeReceived": 1655553336,
 *      "TxId": "e5a...",
 *      "Status": 32,
 *      "Comment": null,
 *      "TimeUTC": "2022-06-18T11:55:36",
 *      "Id": 3641556,
 *      "UpdatedOn": "2022-06-18T12:04:15.1233333"
 *    }
 *  ]
 */

await CrowdNode.http.IsAddressInUse(pubAddr);
/**
 * {
 *   "inUse": true,
 *   "DashAddress": "Xj00000000000000000000000000000000"
 * }
 */
```

### Messages (Voting, etc)

```js
await CrowdNode.http.GetMessages(pubAddr);
/**
 * []
 */

await CrowdNode.http.SetEmail(wif, email, sig);
await CrowdNode.http.Vote(wif, gobjectHash, vote, sig);
await CrowdNode.http.SetReferral(wif, referralId, sig);
```

```js
await CrowdNode.http.FundsOpen(pub);
/* ${baseUrl}/FundsOpen/${pub} */

await CrowdNode.http.VotingOpen(pub);
/* ${baseUrl}/VotingOpen/${pub} */
```

# CLI Documentation

See <https://github.com/dashhive/crowdnode.js/tree/main/cli>.

# Official CrowdNode Docs

<https://knowledge.crowdnode.io/en/articles/5963880-blockchain-api-guide>
