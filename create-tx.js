#!/usr/bin/env node

"use strict";

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.secret" });

let privKey = process.env.PRIVATE_KEY;

let Fs = require("fs").promises;

let Dashcore = require("@dashevo/dashcore-lib");
let request = require("./lib/request.js");

let baseUrl = `https://insight.dash.org/insight-api`;

function help() {
  console.info(``);
  console.info(`Usage:`);
  console.info(`        create-tx [key-file] <change> <address:amount,>`);
  console.info(``);
  console.info(`Example:`);
  console.info(`        create-tx ./key.wif XkY...w6C Xkz...aDf:1000`);
  console.info(``);
}

async function main() {
  if (["help", "--help", "-h"].includes(process.argv[2])) {
    help();
    process.exit(0);
    return;
  }

  let args = process.argv.slice(2);
  if (!privKey) {
    let keyFile = args.shift();
    // TODO error handling
    privKey = await Fs.readFile(keyFile, "ascii").trim();
  }

  let changeAddr = args.shift();
  let payments = args.map(function (payment) {
    let parts = payment.split(":");
    if (2 !== parts.length) {
      help();
      process.exit(1);
      return;
    }
    return {
      address: parts[0],
      // TODO check for bad input (i.e. decimal)
      satoshis: parseInt(parts[1], 10),
    };
  });

  // TODO check validity
  if (!payments.length) {
    help();
    process.exit(1);
    return;
  }

  let pk = new Dashcore.PrivateKey(privKey);
  let pub = pk.toPublicKey().toAddress().toString();

  /** @type InsightUtxo */
  let utxoUrl = `${baseUrl}/addr/${pub}/utxo`;
  let utxoResp = await request({ url: utxoUrl, json: true });

  /** @type Array<Utxo> */
  let utxos = [];

  await utxoResp.body.reduce(async function (promise, utxo) {
    await promise;

    let txUrl = `${baseUrl}/tx/${utxo.txid}`;
    let txResp = await request({ url: txUrl, json: true });
    let data = txResp.body;

    // TODO the ideal would be the smallest amount that is greater than the required amount

    let utxoIndex = -1;
    data.vout.some(function (vout, index) {
      if (!vout.scriptPubKey?.addresses?.includes(utxo.address)) {
        return false;
      }

      let satoshis = parseInt(vout.value[0] + vout.value.slice(2), 10);
      if (utxo.satoshis !== satoshis) {
        return false;
      }

      utxoIndex = index;
      return true;
    });

    utxos.push({
      txId: utxo.txid,
      outputIndex: utxoIndex,
      address: utxo.address,
      script: utxo.scriptPubKey,
      satoshis: utxo.satoshis,
    });
  }, Promise.resolve());

  let tx = new Dashcore.Transaction().from(utxos);
  tx.change(changeAddr);
  payments.forEach(async function (payment) {
    tx.to(payment.address, payment.satoshis);
  });
  tx.sign(pk);

  // TODO get the *real* fee
  console.warn('Fee:', tx.getFee());
  console.info(tx.serialize());
}

main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
});
