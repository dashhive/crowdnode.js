"use strict";

let Qr = module.exports;

let Fs = require("fs").promises;

let QrCode = require("qrcode-svg");

Qr._create = function (data, opts) {
  return new QrCode({
    content: data,
    padding: opts?.padding || 4,
    width: opts?.width || 256,
    height: opts?.height || 256,
    color: opts?.color || "#000000",
    background: opts?.background || "#ffffff",
    ecl: opts?.ecl || "M",
  });
};

Qr.ascii = function (data, opts) {
  let qrcode = Qr._create(data, opts);
  let indent = opts?.indent ?? 4;
  var modules = qrcode.qrcode.modules;

  let ascii = ``.padStart(indent - 1, ' ');
  let length = modules.length;
  for (let y = 0; y < length; y += 1) {
    for (let x = 0; x < length; x += 1) {
      let block = "  ";
      if (modules[x][y]) {
        block = "██";
      }
      ascii += block;
    }
    ascii += `\n`.padEnd(indent, ' ');
  }
  return ascii;
};

Qr.svg = function (data, opts) {
  let qrcode = Qr._create(data, opts);
  return qrcode.svg();
};

Qr.save = async function (filepath, data, opts) {
  let qrcode = Qr.svg(data, opts);
  await Fs.writeFile(filepath, qrcode, "utf8");
};
