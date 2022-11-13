"use strict";

let Fs = require("fs").promises;

let Qr = require("./_qr.js");

/**
 * @param {String} filepath
 * @param {String} data
 * @param {import('./_qr.js').QrOpts} opts
 */
async function save(filepath, data, opts) {
  let qrcode = Qr.svg(data, opts);
  await Fs.writeFile(filepath, qrcode, "utf8");
}

//@ts-ignore
Qr.save = save;

module.exports = Qr;
