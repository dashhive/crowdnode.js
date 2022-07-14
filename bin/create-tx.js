#!/usr/bin/env node
"use strict";

let Fs = require("fs").promises;

let Dash = require("../lib/dash.js");
let Insight = require("../lib/insight.js");

async function main() {
  let insightBaseUrl =
    process.env.INSIGHT_BASE_URL || "https://insight.dash.org";
  let insightApi = Insight.create({ baseUrl: insightBaseUrl });
  let dashApi = Dash.create({ insightApi: insightApi });

  let wiffilename = process.argv[2] || "";
  if (!wiffilename) {
    console.error(`Usage: pay ./source.wif ./targets.csv ./change.b58c`);
    process.exit(1);
    return;
  }
  let wif = await Fs.readFile(wiffilename, "utf8");
  wif = wif.trim();

  let payfilename = process.argv[3] || "";
  if (!payfilename) {
    console.error(`Usage: pay ./source.wif ./targets.csv ./change.b58c`);
    process.exit(1);
    return;
  }
  let paymentsCsv = await Fs.readFile(payfilename, "utf8");
  paymentsCsv = paymentsCsv.trim();
  /** @type {Array<{ address: String, satoshis: Number }>} */
  //@ts-ignore
  let payments = paymentsCsv
    .split(/\n/)
    .map(function (line) {
      line = line.trim();
      if (!line) {
        return null;
      }

      if (
        line.startsWith("#") ||
        line.startsWith("//") ||
        line.startsWith("-") ||
        line.startsWith('"') ||
        line.startsWith("'")
      ) {
        return null;
      }

      let parts = line.split(",");
      let addr = parts[0] || "";
      let amount = Dash.toDuff(parts[1] || "");

      if (!addr.startsWith("X")) {
        console.error(`unknown address: ${addr}`);
        process.exit(1);
        return null;
      }

      if (isNaN(amount) || !amount) {
        console.error(`unknown amount: ${amount}`);
        return null;
      }

      return {
        address: addr,
        satoshis: amount,
      };
    })
    .filter(Boolean);

  let changefilename = process.argv[4] || "";
  if (!changefilename) {
    console.error(`Usage: pay ./source.wif ./targets.csv ./change.b58c`);
    process.exit(1);
    return;
  }
  let changeAddr = await Fs.readFile(changefilename, "utf8");
  changeAddr = changeAddr.trim();

  let tx = await dashApi.createPayments(wif, payments, changeAddr);
  console.info('Transaction:');
  console.info(tx.serialize());

  if (!process.argv.includes("--send")) {
    return;
  }

  console.info('Instant Send...');
  await insightApi.instantSend(tx.serialize());
  console.info('Done');
}

// Run
main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
  process.exit(1);
});
