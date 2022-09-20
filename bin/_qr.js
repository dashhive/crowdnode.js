"use strict";

let Qr = module.exports;

let Fs = require("fs").promises;

let QrCode = require("qrcode-svg");

/**
 * @typedef QrOpts
 * @property {String} [background]
 * @property {String} [color]
 * @property {String} [ecl]
 * @property {Number} [height]
 * @property {Number} [indent]
 * @property {Number} [padding]
 * @property {"mini" | "micro"} [size]
 * @property {Number} [width]
 */

/**
 * @param {String} data
 * @param {QrOpts} opts
 */
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

/**
 * @typedef {Object.<String, String>} BlockMap
 */

/**
 * Encoded as top-left, top-right, bottom-left, bottom-right
 * @type {Object.<"mini" | "micro", BlockMap>}
 */
let charMaps = {
  micro: {
    0b0000: " ",
    0b0001: "▗",
    0b0010: "▖",
    0b0011: "▄",
    0b0100: "▝",
    0b0101: "▐",
    0b0110: "▞",
    0b0111: "▟",
    0b1000: "▘",
    0b1001: "▚",
    0b1010: "▌",
    0b1011: "▙",
    0b1100: "▀",
    0b1101: "▜",
    0b1110: "▛",
    0b1111: "█",
  },
  mini: {
    0b0000: "  ",
    0b0001: " ▄",
    0b0010: "▄ ",
    0b0011: "▄▄",
    0b0100: " ▀",
    0b0101: " █",
    0b0110: "▄▀",
    0b0111: "▄█",
    0b1000: "▀ ",
    0b1001: "▀▄",
    0b1010: "█ ",
    0b1011: "█▄",
    0b1100: "▀▀",
    0b1101: "▀█",
    0b1110: "█▀",
    0b1111: "██",
  },
};

/**
 * @param {String} data
 * @param {QrOpts} opts
 */
Qr.quadAscii = function (data, opts) {
  let charMap = charMaps[opts.size || "mini"];
  let qrcode = Qr._create(data, opts);
  let indent = opts?.indent ?? 4;
  let modules = qrcode.qrcode.modules;

  let ascii = ``.padStart(indent - 1, " ");
  let length = modules.length;
  for (let y = 0; y < length; y += 2) {
    for (let x = 0; x < length; x += 2) {
      let count = 0;
      // qr codes can be odd numbers
      if (x >= length) {
        ascii += charMap[count];
        continue;
      }
      if (modules[x][y]) {
        count += 8;
      }
      if (modules[x][y + 1]) {
        count += 2;
      }

      if (x + 1 >= length) {
        ascii += charMap[count];
        continue;
      }
      if (modules[x + 1][y]) {
        count += 4;
      }
      if (modules[x + 1][y + 1]) {
        count += 1;
      }
      ascii += charMap[count];
    }
    ascii += `\n`.padEnd(indent, " ");
  }
  return ascii.replace(/\s+$/, "");
};

/**
 * @param {String} data
 * @param {QrOpts} opts
 */
Qr.ascii = function (data, opts) {
  if (opts.size) {
    return Qr.quadAscii(data, opts);
  }

  let qrcode = Qr._create(data, opts);
  let indent = opts?.indent ?? 4;
  let modules = qrcode.qrcode.modules;

  let ascii = ``.padStart(indent - 1, " ");
  let length = modules.length;
  for (let y = 0; y < length; y += 1) {
    for (let x = 0; x < length; x += 1) {
      let block = "  ";
      if (modules[x][y]) {
        block = "██";
      }
      ascii += block;
    }
    ascii += `\n`.padEnd(indent, " ");
  }
  return ascii;
};

/**
 * @param {String} data
 * @param {QrOpts} opts
 */
Qr.svg = function (data, opts) {
  let qrcode = Qr._create(data, opts);
  return qrcode.svg();
};

/**
 * @param {String} filepath
 * @param {String} data
 * @param {QrOpts} opts
 */
Qr.save = async function (filepath, data, opts) {
  let qrcode = Qr.svg(data, opts);
  await Fs.writeFile(filepath, qrcode, "utf8");
};
