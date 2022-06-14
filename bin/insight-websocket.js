#!/usr/bin/env node

"use strict";

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.secret" });

//let Https = require("https");

// only needed for insight APIs hosted behind an AWS load balancer
let Cookies = require("../lib/cookies.js");
let Ws = require("../lib/ws.js");

let baseUrl = `https://insight.dash.org`;

function help() {
  console.info(``);
  console.info(`Usage:`);
  //console.info(`        insight-websocket [eventname1,eventname2,]`);
  console.info(`        insight-websocket # listens for 'inv' events`);
  console.info(``);
  /*
  console.info(`Example:`);
  console.info(`        insight-websocket inv,addresstxid`);
  console.info(``);
  */

  // TODO Ws.waitForVout()
}

async function main() {
  // ex: inv,dashd/addresstxid
  let eventnames = (process.argv[2] || "inv").split(",");

  if (["help", "--help", "-h"].includes(eventnames[0])) {
    help();
    process.exit(0);
    return;
  }

  // TODO check validity
  if (!eventnames.length) {
    help();
    process.exit(1);
    return;
  }

  // TODO pass eventnames
  let ws = Ws.create({
    baseUrl: baseUrl,
    cookieStore: Cookies,
    debug: true,
  });

  await ws.init();
}

main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
});
