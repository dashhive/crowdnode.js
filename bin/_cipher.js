"use strict";

let Crypto = require("crypto");

let Cipher = module.exports;

const ALG = "aes-128-cbc";
const IV_SIZE = 16;

/**
 * @param {String} passphrase - what the human entered
 * @param {String} shadow - encrypted, hashed, key-expanded passphrase
 */
Cipher.checkPassphrase = async function (passphrase, shadow) {
  let key128 = await Cipher.deriveKey(passphrase);
  let cipher = Cipher.create(key128);

  let plainShadow;
  try {
    plainShadow = cipher.decrypt(shadow);
  } catch (e) {
    //@ts-ignore
    let msg = e.message;
    if (!msg.includes("decrypt")) {
      throw e;
    }
    return false;
  }

  let untrustedShadow = Crypto.createHash("sha512")
    .update(key128)
    .digest("base64");
  return Cipher.secureCompare(plainShadow, untrustedShadow);
};

/**
 * @param {String} passphrase - what the human entered
 */
Cipher.shadowPassphrase = async function (passphrase) {
  let key128 = await Cipher.deriveKey(passphrase);
  let plainShadow = Crypto.createHash("sha512").update(key128).digest("base64");
  let cipher = Cipher.create(key128);
  let shadow = cipher.encrypt(plainShadow);

  return shadow;
};

/**
 * @param {String} passphrase
 */
Cipher.deriveKey = async function (passphrase) {
  // See https://crypto.stackexchange.com/a/6557
  // and https://nodejs.org/api/crypto.html#cryptohkdfdigest-ikm-salt-info-keylen-callback
  const DIGEST = "sha512";
  const SALT = Buffer.from("crowdnode-cli", "utf8");
  // 'info' is a string describing a sub-context
  const INFO = Buffer.from("staking-keys", "utf8");
  const SIZE = 16;

  let ikm = Buffer.from(passphrase, "utf8");
  let key128 = await new Promise(function (resolve, reject) {
    //@ts-ignore
    Crypto.hkdf(DIGEST, ikm, SALT, INFO, SIZE, function (err, key128) {
      if (err) {
        reject(err);
        return;
      }
      resolve(Buffer.from(key128));
    });
  });

  return key128;
};

/**
 * @param {String} shadow
 * @param {Buffer} key128
 */
Cipher.checkShadow = function (shadow, key128) {
  let untrustedShadow = Crypto.createHash("sha512")
    .update(key128)
    .digest("base64");
  return Cipher.secureCompare(shadow, untrustedShadow);
};

/**
 * @param {String} a
 * @param {String} b
 */
Cipher.secureCompare = function (a, b) {
  if (!a && !b) {
    throw new Error("[secure compare] reference string should not be empty");
  }

  if (a.length !== b.length) {
    return false;
  }

  return Crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

/**
 * @param {Buffer} key128
 */
Cipher.create = function (key128) {
  //let sharedSecret = Buffer.from(key128, "base64");

  let cipher = {};

  /**
   * @param {String} plaintext
   */
  cipher.encrypt = function (plaintext) {
    let initializationVector = Crypto.randomBytes(IV_SIZE); // IV is always 16-bytes
    let encrypted = "";

    let _cipher = Crypto.createCipheriv(ALG, key128, initializationVector);
    encrypted += _cipher.update(plaintext, "utf8", "base64");
    encrypted += _cipher.final("base64");

    return (
      toWeb64(initializationVector.toString("base64")) +
      ":" +
      toWeb64(encrypted) +
      ":" +
      // as a backup
      toWeb64(initializationVector.toString("base64"))
    );
  };

  /**
   * @param {String} parts
   */
  cipher.decrypt = function (parts) {
    let [initializationVector, encrypted, initializationVectorBak] =
      parts.split(":");
    let plaintext = "";
    if (initializationVector !== initializationVectorBak) {
      console.error("corrupt (but possibly recoverable) initialization vector");
    }

    let iv = Buffer.from(initializationVector, "base64");
    let _cipher = Crypto.createDecipheriv(ALG, key128, iv);
    plaintext += _cipher.update(encrypted, "base64", "utf8");
    plaintext += _cipher.final("utf8");

    return plaintext;
  };

  return cipher;
};

/**
 * @param {String} x
 */
function toWeb64(x) {
  return x.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
