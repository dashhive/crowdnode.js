# CrowdNode CLI

CrowdNode allows you to become a partial MNO - staking Dash to earn interest,
participate in voting, etc.

This cross-platform CrowdNode CLI enables you to privately manage your stake via
their KYC-free Blockchain CLI.

# Install

## Node.js

You must have [node.js](https://webinstall.dev/node) installed:

### Mac & Linux

```bash
curl https://webinstall.dev/node | bash
export PATH="${HOME}/.local/opt/node:$PATH"
```

### Windows

```pwsh
curl.exe -A MS https://webinstall.dev/node | powershell
PATH %USERPROFILE%\.local\opt\node;%PATH%
```

## CrowdNode CLI

```bash
# Install to system, globally
npm install --location=global crowdnode-cli@v1
```

Or

```bash
# Run without installing
npx crowdnode-cli@v1
```

# CLI Usage

CrowdNode staking is managed with a **permanent staking key**.

The Dash you stake **can NOT be retrieved** without this key!

## QuickStart

You can use an existing key, or generate a new one just for CrowdNode. \
(I recommend printing a Paper Wallet (WIF QR) and sticking it in your safe)

You can preload your staking key with the amount you wish to stake, or deposit
when prompted via

- QR Code
- Dash URL
- or Payment Address

You will be given these options whenever the existing balance is low.

0. Generate a **permanent** staking key (just one):
   ```bash
   crowdnode generate
   ```
   (and put a backup in a safe place)
1. Send a (tiny) Sign Up payment (Đ0.00151072)
   ```bash
   crowdnode signup
   ```
2. Accept the Terms of Use via payment (Đ0.00085536)
   ```bash
   crowdnode accept
   ```
3. Deposit your stake (in DASH)
   ```bash
   crowdnode deposit 0.01
   ```

## All Commmands

```bash
Usage:
    crowdnode help
    crowdnode status [keyfile-or-addr]
    crowdnode signup [keyfile-or-addr]
    crowdnode accept [keyfile-or-addr]
    crowdnode deposit [keyfile-or-addr] [dash-amount] [--no-reserve]
    crowdnode withdrawal [keyfile-or-addr] <percent> # 1.0-100.0 (steps by 0.1)

Helpful Extras:
    crowdnode balance [keyfile-or-addr]
    crowdnode load [keyfile-or-addr] [dash-amount]
    crowdnode transfer <from-keyfile-or-addr> <to-keyfile-or-addr> [dash-amount]

Key Management & Encryption:
    crowdnode generate [./privkey.wif] [--plain-text]
    crowdnode list
    crowdnode use <addr>            # set as default key
    crowdnode passphrase            # set or rotate passphrase
    crowdnode import <keyfile>      # copy and encrypt key
    crowdnode encrypt               # encrypt all keys
    crowdnode decrypt               # decrypt all keys
    crowdnode delete <addr>         # delete key (must have 0 balance)

CrowdNode HTTP RPC:
    crowdnode http FundsOpen <addr>
    crowdnode http VotingOpen <addr>
    crowdnode http GetFunds <addr>
    crowdnode http GetFundsFrom <addr> <seconds-since-epoch>
    crowdnode http GetBalance <addr>
    crowdnode http GetMessages <addr>
    crowdnode http IsAddressInUse <addr>
    crowdnode http SetEmail ./privkey.wif <email> <signature>
    crowdnode http Vote ./privkey.wif <gobject-hash>
        <Yes|No|Abstain|Delegate|DoNothing> <signature>
    crowdnode http SetReferral ./privkey.wif <referral-id> <signature>
```

## Glossary

| Term          | Description                                                          |
| ------------- | -------------------------------------------------------------------- |
| addr          | your Dash address (Base58Check-encoded Pay-to-PubKey Address)        |
| ./privkey.wif | the file path to your staking key in WIF (Base58Check) format        |
| signature     | generated with [dashmsg](https://webinstall.dev/dashmsg) or dash-cli |

# JS API Documentation

See <https://github.com/dashhive/crowdnode.js>.

# Official CrowdNode Docs

<https://knowledge.crowdnode.io/en/articles/5963880-blockchain-api-guide>
