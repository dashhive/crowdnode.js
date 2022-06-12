#!/usr/bin/env node

"use strict";

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.secret" });

let request = require("./lib/request.js");

let baseUrl = `https://insight.dash.org/insight-api`;

function help() {
  console.info(``);
  console.info(`Usage:`);
  console.info(`        get-utxos <address>`);
  console.info(``);
  console.info(`Example:`);
  console.info(`        get-utxos XkY4rkHb7BzaG9qMUwD7REgAJgSZVysw6C`);
  console.info(``);
}

async function main() {
  let addr = process.argv[2];

  if (["help", "--help", "-h"].includes(addr)) {
    help();
    process.exit(0);
    return;
  }

  // TODO check validity
  if (!addr) {
    help();
    process.exit(1);
    return;
  }

  let url = `${baseUrl}/addr/${addr}/utxo`;
  let resp = await request({ url, json: true });
  let out = JSON.stringify(resp.body, null, 2);
  console.info(out);
}

main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
});
