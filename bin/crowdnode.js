#!/usr/bin/env node
"use strict";
/*jshint maxcomplexity:25 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.secret" });

let pkg = require("../package.json");

let Fs = require("fs").promises;

let CrowdNode = require("../lib/crowdnode.js");
let Dash = require("../lib/dash.js");
let Insight = require("../lib/insight.js");
let Qr = require("../lib/qr.js");
let Ws = require("../lib/ws.js");

let Dashcore = require("@dashevo/dashcore-lib");

const DUFFS = 100000000;
let qrWidth = 2 + 67 + 2;
// Sign Up Fees:
//   0.00236608 // required for signup
//   0.00002000 // TX fee estimate
//   0.00238608 // minimum recommended amount
// Target:
//   0.01000000
let signupFees =
  CrowdNode.requests.signupForApi +
  CrowdNode.requests.acceptTerms +
  2 * CrowdNode.requests.offset;
let feeEstimate = 2 * 1000;

let signupTotal = signupFees + feeEstimate;

function showQr(signupAddr, amount = 0) {
  let signupUri = `dash://${signupAddr}`;
  if (amount) {
    signupUri += `?amount=${amount}`;
  }

  let signupQr = Qr.ascii(signupUri, { indent: 4 });
  let addrPad = Math.ceil((qrWidth - signupUri.length) / 2);

  console.info(signupQr);
  console.info();
  console.info(" ".repeat(addrPad) + signupUri);
}

function showVersion() {
  console.info(`${pkg.name} v${pkg.version} - ${pkg.description}`);
  console.info();
}

function showHelp() {
  showVersion();

  console.info("Usage:");
  console.info("    crowdnode help");
  console.info("    crowdnode status ./privkey.wif");
  console.info("    crowdnode signup ./privkey.wif");
  console.info("    crowdnode accept ./privkey.wif");
  console.info("    crowdnode deposit ./privkey.wif [amount] [--no-reserve]");
  console.info(
    "    crowdnode withdrawal ./privkey.wif <permil> # 1-1000 (1.0-100.0%)",
  );
  console.info("");

  console.info("Helpful Extras:");
  console.info("    crowdnode generate [./privkey.wif]");
  console.info("    crowdnode balance ./privkey.wif");
  console.info("    crowdnode transfer ./source.wif <key-file-or-pub-addr>");
  console.info("");

  console.info("CrowdNode HTTP RPC:");
  console.info("    crowdnode http FundsOpen <addr>");
  console.info("    crowdnode http VotingOpen <addr>");
  console.info("    crowdnode http GetFunds <addr>");
  console.info("    crowdnode http GetFundsFrom <addr> <seconds-since-epoch>");
  console.info("    crowdnode http GetBalance <addr>");
  console.info("    crowdnode http GetMessages <addr>");
  console.info("    crowdnode http IsAddressInUse <addr>");
  // TODO create signature rather than requiring it
  console.info("    crowdnode http SetEmail ./privkey.wif <email> <signature>");
  console.info("    crowdnode http Vote ./privkey.wif <gobject-hash> ");
  console.info("        <Yes|No|Abstain|Delegate|DoNothing> <signature>");
  console.info(
    "    crowdnode http SetReferral ./privkey.wif <referral-id> <signature>",
  );
  console.info("");
}

function removeItem(arr, item) {
  let index = arr.indexOf(item);
  if (index >= 0) {
    return arr.splice(index, 1)[0];
  }
  return null;
}

async function main() {
  // Usage:
  //    crowdnode <subcommand> [flags] <privkey> [options]
  // Example:
  //    crowdnode withdrawal --unconfirmed ./Xxxxpubaddr.wif 1000

  let args = process.argv.slice(2);

  // flags
  let forceConfirm = removeItem(args, "--unconfirmed");
  let noReserve = removeItem(args, "--no-reserve");

  let subcommand = args.shift();

  if (!subcommand || ["--help", "-h", "help"].includes(subcommand)) {
    showHelp();
    process.exit(0);
    return;
  }

  if (["--version", "-V", "version"].includes(subcommand)) {
    showVersion();
    process.exit(0);
    return;
  }

  if ("generate" === subcommand) {
    await generate(args.shift());
    return;
  }

  let rpc = "";
  if ("http" === subcommand) {
    rpc = args.shift();
  }

  if ("http" === subcommand) {
    let keyfile = args.shift();
    let pub = await wifFileToAddr(keyfile);

    // ex: http <rpc>(<pub>, ...)
    args.unshift(pub);
    let hasRpc = rpc in CrowdNode.http;
    if (!hasRpc) {
      console.error(`Unrecognized rpc command ${rpc}`);
      console.error();
      showHelp();
      process.exit(1);
    }
    let result = await CrowdNode.http[rpc].apply(null, args);
    if ("string" === typeof result) {
      console.info(result);
    } else {
      console.info(JSON.stringify(result, null, 2));
    }
    return;
  }

  let keyfile = args.shift();
  let privKey;
  if (keyfile) {
    privKey = await Fs.readFile(keyfile, "utf8");
    privKey = privKey.trim();
  } else {
    privKey = process.env.PRIVATE_KEY;
  }
  if (!privKey) {
    // TODO generate private key?
    console.error();
    console.error(
      `Error: you must provide either the WIF key file path or PRIVATE_KEY in .env`,
    );
    console.error();
    process.exit(1);
  }

  let insightBaseUrl =
    process.env.INSIGHT_BASE_URL || "https://insight.dash.org";
  let insightApi = Insight.create({ baseUrl: insightBaseUrl });
  let dashApi = Dash.create({ insightApi: insightApi });

  let pk = new Dashcore.PrivateKey(privKey);
  let pub = pk.toPublicKey().toAddress().toString();

  // deposit if balance is over 100,000 (0.00100000)
  process.stdout.write("Checking balance... ");
  let balanceInfo = await dashApi.getInstantBalance(pub);
  console.info(`${balanceInfo.balanceSat} (${balanceInfo.balance})`);
  /*
  let balanceInfo = await insightApi.getBalance(pub);
  if (balanceInfo.unconfirmedBalanceSat || balanceInfo.unconfirmedAppearances) {
    if (!forceConfirm) {
      console.error(
        `Error: This address has pending transactions. Please try again in 1-2 minutes or use --unconfirmed.`,
      );
      console.error(balanceInfo);
      if ("status" !== subcommand) {
        process.exit(1);
        return;
      }
    }
  }
  */

  let state = {
    balanceInfo: balanceInfo,
    dashApi: dashApi,
    forceConfirm: forceConfirm,
    hotwallet: "",
    insightBaseUrl: insightBaseUrl,
    insightApi: insightApi,
    noReserve: noReserve,
    privKey: privKey,
    pub: pub,

    // status
    status: {
      signup: 0,
      accept: 0,
      deposit: 0,
    },
    signup: "❌",
    accept: "❌",
    deposit: "❌",
  };

  if ("balance" === subcommand) {
    await balance(args, state);
    process.exit(0);
    return;
  }

  // helper for debugging
  if ("transfer" === subcommand) {
    await transfer(args, state);
    return;
  }

  process.stdout.write("Checking CrowdNode API... ");
  await CrowdNode.init({
    baseUrl: "https://app.crowdnode.io",
    insightBaseUrl,
    insightApi: insightApi,
  });
  state.hotwallet = CrowdNode.main.hotwallet;
  console.info(`hotwallet is ${state.hotwallet}`);

  state.status = await CrowdNode.status(pub, state.hotwallet);
  if (state.status?.signup) {
    state.signup = "✅";
  }
  if (state.status?.accept) {
    state.accept = "✅";
  }
  if (state.status?.deposit) {
    state.deposit = "✅";
  }

  if ("status" === subcommand) {
    await status(args, state);
    return;
  }

  if ("signup" === subcommand) {
    await signup(args, state);
    return;
  }

  if ("accept" === subcommand) {
    await accept(args, state);
    return;
  }

  if ("deposit" === subcommand) {
    await deposit(args, state);
    return;
  }

  if ("withdrawal" === subcommand) {
    await withdrawal(args, state);
    return;
  }

  console.error(`Unrecognized subcommand ${subcommand}`);
  console.error();
  showHelp();
  process.exit(1);
}

// Subcommands

async function generate(name) {
  let pk = new Dashcore.PrivateKey();

  let pub = pk.toAddress().toString();
  let wif = pk.toWIF();

  let filepath = `./${pub}.wif`;
  let note = "";
  if (name) {
    filepath = name;
    note = `\n(for pubkey address ${pub})`;
  }

  let err = await Fs.access(filepath).catch(Object);
  if (!err) {
    // TODO show QR anyway
    //wif = await Fs.readFile(filepath, 'utf8')
    //showQr(pub, 0.01);
    console.info(`'${filepath}' already exists (will not overwrite)`);
    process.exit(0);
    return;
  }

  await Fs.writeFile(filepath, wif, "utf8").then(function () {
    console.info(``);
    console.info(
      `Use the QR Code below to load a test deposit of Đ0.01 onto your staking key.`,
    );
    console.info(``);
    showQr(pub, 0.01);
    console.info(``);
    console.info(
      `Use the QR Code above to load a test deposit of Đ0.01 onto your staking key.`,
    );
    console.info(``);
    console.info(`Generated ${filepath} ${note}`);
  });
  process.exit(0);
}

async function balance(args, state) {
  console.info(state.balanceInfo);
  process.exit(0);
  return;
}

async function transfer(args, state) {
  let newAddr = await wifFileToAddr(process.argv[4]);
  let amount = parseInt(process.argv[5] || 0, 10);
  let tx;
  if (amount) {
    tx = await state.dashApi.createPayment(state.privKey, newAddr, amount);
  } else {
    tx = await state.dashApi.createBalanceTransfer(state.privKey, newAddr);
  }
  if (amount) {
    console.info(`Transferring ${amount} to ${newAddr}...`);
  } else {
    console.info(`Transferring balance to ${newAddr}...`);
  }
  await state.insightApi.instantSend(tx);
  console.info(`Queued...`);
  setTimeout(function () {
    // TODO take a cleaner approach
    // (waitForVout needs a reasonable timeout)
    console.error(`Error: Transfer did not complete.`);
    if (state.forceConfirm) {
      console.error(`(using --unconfirmed may lead to rejected double spends)`);
    }
    process.exit(1);
  }, 30 * 1000);
  await Ws.waitForVout(state.insightBaseUrl, newAddr, 0);
  console.info(`Accepted!`);
  process.exit(0);
  return;
}

async function status(args, state) {
  console.info();
  console.info(`API Actions Complete for ${state.pub}:`);
  console.info(`    ${state.signup} SignUpForApi`);
  console.info(`    ${state.accept} AcceptTerms`);
  console.info(`    ${state.deposit} DepositReceived`);
  console.info();
  process.exit(0);
  return;
}

async function signup(args, state) {
  if (state.status?.signup) {
    console.info(
      `${state.pub} is already signed up. Here's the account status:`,
    );
    console.info(`    ${state.signup} SignUpForApi`);
    console.info(`    ${state.accept} AcceptTerms`);
    console.info(`    ${state.deposit} DepositReceived`);
    process.exit(0);
    return;
  }

  let hasEnough = state.balanceInfo.balanceSat > signupTotal;
  if (!hasEnough) {
    await collectSignupFees(state.insightBaseUrl, state.pub);
  }
  console.info("Requesting account...");
  await CrowdNode.signup(state.privKey, state.hotwallet);
  state.signup = "✅";
  console.info(`    ${signup} SignUpForApi`);
  console.info(`    ${accept} AcceptTerms`);
  process.exit(0);
  return;
}

async function accept(args, state) {
  if (state.status?.accept) {
    console.info(
      `${state.pub} is already signed up. Here's the account status:`,
    );
    console.info(`    ${state.signup} SignUpForApi`);
    console.info(`    ${state.accept} AcceptTerms`);
    console.info(`    ${state.deposit} DepositReceived`);
    process.exit(0);
    return;
  }
  let hasEnough = state.balanceInfo.balanceSat > signupTotal;
  if (!hasEnough) {
    await collectSignupFees(state.insightBaseUrl, state.pub);
  }
  console.info("Accepting terms...");
  await CrowdNode.accept(state.privKey, state.hotwallet);
  state.accept = "✅";
  console.info(`    ${state.signup} SignUpForApi`);
  console.info(`    ${state.accept} AcceptTerms`);
  console.info(`    ${state.deposit} DepositReceived`);
  process.exit(0);
  return;
}

async function deposit(args, state) {
  if (!state.status?.accept) {
    console.error(`no account for address ${state.pub}`);
    process.exit(1);
    return;
  }

  // this would allow for at least 2 withdrawals costing (21000 + 1000)
  let reserve = 50000;
  let reserveDash = (reserve / DUFFS).toFixed(8);
  if (!state.noReserve) {
    console.info(
      `reserving ${reserve} (${reserveDash}) for withdrawals (--no-reserve to disable)`,
    );
  } else {
    reserve = 0;
  }

  // TODO if unconfirmed, check utxos instead

  // deposit what the user asks, or all that we have,
  // or all that the user deposits - but at least 2x the reserve
  let desiredAmount = parseInt(args.shift() || 0, 10);
  let effectiveAmount = desiredAmount;
  if (!effectiveAmount) {
    effectiveAmount = state.balanceInfo.balanceSat - reserve;
  }
  let needed = Math.max(reserve * 2, effectiveAmount + reserve);

  if (state.balanceInfo.balanceSat < needed) {
    let ask = 0;
    if (desiredAmount) {
      ask = desiredAmount + reserve + -state.balanceInfo.balanceSat;
    }
    await collectDeposit(state.insightBaseUrl, state.pub, ask);
    state.balanceInfo = await state.dashApi.getInstantBalance(state.pub);
    if (state.balanceInfo.balanceSat < needed) {
      console.error(
        `Balance is still too small: ${state.balanceInfo.balanceSat}`,
      );
      process.exit(1);
      return;
    }
  }
  if (!desiredAmount) {
    effectiveAmount = state.balanceInfo.balanceSat - reserve;
  }

  console.info(`(holding ${reserve} in reserve for API calls)`);
  console.info(`Initiating deposit of ${effectiveAmount}...`);
  await CrowdNode.deposit(state.privKey, state.hotwallet, effectiveAmount);
  state.deposit = "✅";
  console.info(`    ${state.deposit} DepositReceived`);
  process.exit(0);
  return;
}

async function withdrawal(args, state) {
  if (!state.status?.accept) {
    console.error(`no account for address ${state.pub}`);
    process.exit(1);
    return;
  }

  let amount = parseInt(args.shift() || 1000, 10);

  console.info("Initiating withdrawal...");
  let paid = await CrowdNode.withdrawal(state.privKey, state.hotwallet, amount);
  //let paidFloat = (paid.satoshis / DUFFS).toFixed(8);
  //let paidInt = paid.satoshis.toString().padStart(9, "0");
  console.info(`API Response: ${paid.api}`);
  process.exit(0);
  return;
}

/*
async function stake(args, state) {
  // TODO
  return;
}
*/

// Helpers

async function wifFileToAddr(keyfile) {
  let privKey = keyfile;

  let err = await Fs.access(keyfile).catch(Object);
  if (!err) {
    privKey = await Fs.readFile(keyfile, "utf8");
    privKey = privKey.trim();
  }

  if (34 === privKey.length) {
    // actually payment addr
    return privKey;
  }

  if (52 === privKey.length) {
    let pk = new Dashcore.PrivateKey(privKey);
    let pub = pk.toPublicKey().toAddress().toString();
    return pub;
  }

  throw new Error("bad file path or address");
}

async function collectSignupFees(insightBaseUrl, pub) {
  showQr(pub);

  let signupTotalDash = (signupTotal / DUFFS).toFixed(8);
  let signupMsg = `Please send >= ${signupTotal} (${signupTotalDash}) to Sign Up to CrowdNode`;
  let msgPad = Math.ceil((qrWidth - signupMsg.length) / 2);
  let subMsg = "(plus whatever you'd like to deposit)";
  let subMsgPad = Math.ceil((qrWidth - subMsg.length) / 2);

  console.info();
  console.info(" ".repeat(msgPad) + signupMsg);
  console.info(" ".repeat(subMsgPad) + subMsg);
  console.info();

  console.info("");
  console.info("(waiting...)");
  console.info("");
  let payment = await Ws.waitForVout(insightBaseUrl, pub, 0);
  console.info(`Received ${payment.satoshis}`);
}

async function collectDeposit(insightBaseUrl, pub, amount) {
  showQr(pub, amount);

  let depositMsg = `Please send what you wish to deposit to ${pub}`;
  if (amount) {
    let depositDash = (amount / DUFFS).toFixed(8);
    depositMsg = `Please deposit ${amount} (${depositDash}) to ${pub}`;
  }

  let msgPad = Math.ceil((qrWidth - depositMsg.length) / 2);
  msgPad = Math.max(0, msgPad);

  console.info();
  console.info(" ".repeat(msgPad) + depositMsg);
  console.info();

  console.info("");
  console.info("(waiting...)");
  console.info("");
  let payment = await Ws.waitForVout(insightBaseUrl, pub, 0);
  console.info(`Received ${payment.satoshis}`);
}

// Run

main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
  process.exit(1);
});
