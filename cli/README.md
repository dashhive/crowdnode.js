# CrowdNode CLI

[CrowdNode](https://crowdnode.io/) allows you to become a partial MNO - staking
Dash to earn interest, participate in voting, etc.

This cross-platform CrowdNode CLI enables you to privately manage your stake via
their KYC-free Blockchain API.

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

- Generate a new staking key, or Import from an existing wallet
- Load the key with Dash
- Sign up & Accept the CrowdNode's Terms
- Deposit
- Withdrawal and Transfer at any time

Note: I recommend printing a Paper Wallet (WIF QR) and putting it your safe.

0. Generate or Import a **permanent** staking key:
   ```bash
   # Generate a new key in your CrowdNode CLI wallet:
   crowdnode generate
   ```
   Or
   ```bash
   # Save a key from dash-cli or Dash Core's Debug Console to a file for import:
   #    walletpassphrase "YOUR PASSHRASE" 300
   #    dumprivkey XxYOURxADDRESSx
   #
   # Import to the CrowdNode CLI wallet:
   crowdnode import ./your-key-file.wif.txt
   ```
1. Load the amount of Dash you wish to stake, plus a little extra for fees:
   ```bash
   crowdnode load 0.503
   ```
   (you can load a balance via **QR Code**, Dash URL, and Payment Address)
2. Send the Sign Up request and the [CrowdNode Terms of Service](https://crowdnode.io/terms/):
   ```bash
   # Sign Up sends Đ0.00151072 to create your account
   crowdnode signup
   
   # Accept sends Đ0.00085536 to accept terms and enable deposits
   crowdnode accept
   ```
3. Deposit a test stake (in DASH)
   ```bash
   # Create a test deposit:
   crowdnode deposit 0.01
   
   # Stake the remaining balance:
   crowdnode deposit
   
   # Load and stake another Đ10:
   crowdnode deposit 10.0
   ```
   Note: CrowdNode requires a minimum stake of Đ0.5 to earn interest.

You can withdrawal from 1.0% to 100.0% of your stake at any time, and transfer to an address in another wallet:

```bash
# Withdrawal 5.0%
crowdnode withdrawal 5.0

# Transfer your balance
crowdnode transfer XxYOURxOTHERxADDRESSx 5.0
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
