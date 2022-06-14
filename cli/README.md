# CrowdNode CLI

CrowdNode allows you to become a partial MNO - staking Dash to earn interest,
participate in voting, etc.

This cross-platform CrowdNode CLI enables you to privately manage your stake via
their KYC-free Blockchain CLI.

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

## CrowdNode CLI

```bash
npm install --location=global crowdnode-cli@v1
```

```bash
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
   crowdnode generate ./privkey.wif
   ```
   (and put a backup in a safe place)
1. Send a (tiny) Sign Up payment (Đ0.00151072)
   ```bash
   crowdnode signup ./privkey.wif
   ```
2. Accept the Terms of Use via payment (Đ0.00085536)
   ```bash
   crowdnode accept ./privkey.wif
   ```
3. Deposit your stake
   ```bash
   crowdnode deposit ./privkey.wif
   ```

## All Commmands

```bash
Usage:
    crowdnode help
    crowdnode status ./privkey.wif
    crowdnode signup ./privkey.wif
    crowdnode accept ./privkey.wif
    crowdnode deposit ./privkey.wif [amount] [--no-reserve]
    crowdnode withdrawal ./privkey.wif <permil> # 1-1000 (1.0-100.0%)

Helpful Extras:
    crowdnode generate [./privkey.wif]
    crowdnode balance ./privkey.wif
    crowdnode transfer ./source.wif <key-file-or-pub-addr>

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

| Term          | Description                                                   |
| ------------- | ------------------------------------------------------------- |
| addr          | your Dash address (Base58Check-encoded Pay-to-PubKey Address) |
| amount        | the integer value of "Duffs" (Đ/100000000)                    |
| permil        | 1/1000, 1‰, or 0.1% - between 1 and 1000 (0.1% to 100.0%)     |
| ./privkey.wif | the file path to your staking key in WIF (Base58Check) format |

# JS API Documentation

See <https://github.com/dashhive/crowdnode.js>.

# Official CrowdNode Docs

<https://knowledge.crowdnode.io/en/articles/5963880-blockchain-api-guide>
