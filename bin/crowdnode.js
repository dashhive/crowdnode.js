#!/usr/bin/env node
"use strict";
/*jshint maxcomplexity:25 */

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.secret" });

let HOME = process.env.HOME || "";

//@ts-ignore
let pkg = require("../package.json");

let Fs = require("fs").promises;
let Path = require("path");

let Cipher = require("./_cipher.js");
let CrowdNode = require("../lib/crowdnode.js");
let Dash = require("../lib/dash.js");
let Insight = require("../lib/insight.js");
let Prompt = require("./_prompt.js");
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
let signupOnly = CrowdNode.requests.signupForApi + CrowdNode.requests.offset;
let acceptOnly = CrowdNode.requests.acceptTerms + CrowdNode.requests.offset;
let signupFees = signupOnly + acceptOnly;
let feeEstimate = 500;
let signupTotal = signupFees + 2 * feeEstimate;

//let paths = {};
let configdir = `.config/crowdnode`;
let keysDir = Path.join(HOME, `${configdir}/keys`);
let keysDirRel = `~/${configdir}/keys`;
let shadowPath = Path.join(HOME, `${configdir}/shadow`);
let defaultWifPath = Path.join(HOME, `${configdir}/default`);

function showVersion() {
  console.info(`${pkg.name} v${pkg.version} - ${pkg.description}`);
  console.info();
}

function showHelp() {
  showVersion();

  console.info("Usage:");
  console.info("    crowdnode help");
  console.info("    crowdnode status [keyfile-or-addr]");
  console.info("    crowdnode signup [keyfile-or-addr]");
  console.info("    crowdnode accept [keyfile-or-addr]");
  console.info(
    "    crowdnode deposit [keyfile-or-addr] [dash-amount] [--no-reserve]",
  );
  console.info(
    "    crowdnode withdrawal [keyfile-or-addr] <percent> # 1.0-100.0 (steps by 0.1)",
  );
  console.info("");

  console.info("Helpful Extras:");
  console.info("    crowdnode balance [keyfile-or-addr]"); // addr
  console.info("    crowdnode load [keyfile-or-addr] [dash-amount]"); // addr
  console.info(
    "    crowdnode transfer <from-keyfile-or-addr> <to-keyfile-or-addr> [dash-amount]",
  ); // custom
  console.info("");

  console.info("Key Management & Encryption:");
  console.info("    crowdnode generate [./privkey.wif]");
  console.info("    crowdnode encrypt"); // TODO allow encrypting one-by-one?
  console.info("    crowdnode list");
  console.info("    crowdnode use <addr>");
  console.info("    crowdnode import <keyfile>");
  //console.info("    crowdnode import <(dash-cli dumpprivkey <addr>)"); // TODO
  //console.info("    crowdnode export <addr> <keyfile>"); // TODO
  console.info("    crowdnode passphrase # set or change passphrase");
  console.info("    crowdnode decrypt"); // TODO allow decrypting one-by-one?
  console.info("    crowdnode delete <addr>");
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

let cmds = {};

async function main() {
  /*jshint maxcomplexity:40 */
  /*jshint maxstatements:500 */

  // Usage:
  //    crowdnode <subcommand> [flags] <privkey> [options]
  // Example:
  //    crowdnode withdrawal ./Xxxxpubaddr.wif 100.0

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

  //
  //
  // find addr by name or by file or by string
  await Fs.mkdir(keysDir, {
    recursive: true,
  });

  let defaultAddr = await Fs.readFile(defaultWifPath, "utf8").catch(
    emptyStringOnErrEnoent,
  );
  defaultAddr = defaultAddr.trim();

  let insightBaseUrl =
    process.env.INSIGHT_BASE_URL || "https://insight.dash.org";
  let insightApi = Insight.create({ baseUrl: insightBaseUrl });
  let dashApi = Dash.create({ insightApi: insightApi });

  if ("list" === subcommand) {
    await listKeys({ dashApi }, args);
    return;
  }

  if ("generate" === subcommand) {
    await generateKey({ defaultKey: defaultAddr }, args);
    return;
  }

  if ("passphrase" === subcommand) {
    await setPassphrase({}, args);
    return;
  }

  if ("import" === subcommand) {
    importKey(null, args);
    return;
  }

  if ("encrypt" === subcommand) {
    let addr = args.shift() || "";
    if (!addr) {
      encryptAll(null);
      return;
    }

    let keypath = await findWif(addr);
    if (!keypath) {
      console.error(`no managed key matches '${addr}'`);
      process.exit(1);
      return;
    }
    let key = await maybeReadKeyFileRaw(keypath);
    if (!key) {
      throw new Error("impossible error");
    }
    encryptAll([key]);
    return;
  }

  if ("decrypt" === subcommand) {
    let addr = args.shift() || "";
    if (!addr) {
      decryptAll(null);
      return;
    }
    let keypath = await findWif(addr);
    if (!keypath) {
      console.error(`no managed key matches '${addr}'`);
      process.exit(1);
      return;
    }
    let key = await maybeReadKeyFileRaw(keypath);
    if (!key) {
      throw new Error("impossible error");
    }
    decryptAll([key]);
    return;
  }

  // use or select or default... ?
  if ("use" === subcommand) {
    await setDefault(null, args);
    return;
  }

  // helper for debugging
  if ("transfer" === subcommand) {
    await transferBalance(
      { dashApi, defaultAddr, forceConfirm, insightBaseUrl, insightApi },
      args,
    );
    return;
  }

  let rpc = "";
  if ("http" === subcommand) {
    rpc = args.shift() || "";
    if (!rpc) {
      showHelp();
      process.exit(1);
      return;
    }

    let [addr] = await mustGetAddr({ defaultAddr }, args);

    await initCrowdNode(insightBaseUrl);
    // ex: http <rpc>(<pub>, ...)
    args.unshift(addr);
    let hasRpc = rpc in CrowdNode.http;
    if (!hasRpc) {
      console.error(`Unrecognized rpc command ${rpc}`);
      console.error();
      showHelp();
      process.exit(1);
    }
    //@ts-ignore - TODO use `switch` or make Record Type
    let result = await CrowdNode.http[rpc].apply(null, args);
    console.info(``);
    console.info(`${rpc} ${addr}:`);
    if ("string" === typeof result) {
      console.info(result);
    } else {
      console.info(JSON.stringify(result, null, 2));
    }
    return;
  }

  if ("load" === subcommand) {
    await loadAddr({ defaultAddr, insightBaseUrl }, args);
    return;
  }

  // keeping rm for backwards compat
  if ("rm" === subcommand || "delete" === subcommand) {
    await initCrowdNode(insightBaseUrl);
    await removeKey({ defaultAddr, dashApi, insightBaseUrl }, args);
    return;
  }

  if ("balance" === subcommand) {
    await getBalance({ dashApi, defaultAddr }, args);
    process.exit(0);
    return;
  }

  if ("status" === subcommand) {
    await getStatus({ dashApi, defaultAddr, insightBaseUrl }, args);
    return;
  }

  if ("signup" === subcommand) {
    await sendSignup({ dashApi, defaultAddr, insightBaseUrl }, args);
    return;
  }

  if ("accept" === subcommand) {
    await acceptTerms({ dashApi, defaultAddr, insightBaseUrl }, args);
    return;
  }

  if ("deposit" === subcommand) {
    await depositDash(
      { dashApi, defaultAddr, insightBaseUrl, noReserve },
      args,
    );
    return;
  }

  if ("withdrawal" === subcommand) {
    await withdrawalDash({ dashApi, defaultAddr, insightBaseUrl }, args);
    return;
  }

  console.error(`Unrecognized subcommand ${subcommand}`);
  console.error();
  showHelp();
  process.exit(1);
}

/**
 * @param {String} insightBaseUrl
 */
async function initCrowdNode(insightBaseUrl) {
  process.stdout.write("Checking CrowdNode API... ");
  await CrowdNode.init({
    baseUrl: "https://app.crowdnode.io",
    insightBaseUrl,
  });
  console.info(`(hotwallet ${CrowdNode.main.hotwallet})`);
}

/**
 * @param {String} addr - Base58Check pubKeyHash address
 * @param {Number} duffs - 1/100000000 of a DASH
 */
function showQr(addr, duffs = 0) {
  let dashUri = `dash://${addr}`;
  if (duffs) {
    dashUri += `?amount=${duffs}`;
  }

  let dashQr = Qr.ascii(dashUri, { indent: 4 });
  let addrPad = Math.ceil((qrWidth - dashUri.length) / 2);

  console.info(dashQr);
  console.info();
  console.info(" ".repeat(addrPad) + dashUri);
}

/**
 * @param {Array<any>} arr
 * @param {any} item
 */
function removeItem(arr, item) {
  let index = arr.indexOf(item);
  if (index >= 0) {
    return arr.splice(index, 1)[0];
  }
  return null;
}

/**
 * @param {Object} opts
 * @param {String} opts.addr
 * @param {String} opts.hotwallet
 */
async function getCrowdNodeStatus({ addr, hotwallet }) {
  let state = {
    signup: "❌",
    accept: "❌",
    deposit: "❌",
    status: {
      signup: 0,
      accept: 0,
      deposit: 0,
    },
  };

  //@ts-ignore - TODO why warnings?
  state.status = await CrowdNode.status(addr, hotwallet);
  if (state.status?.signup) {
    state.signup = "✅";
  }
  if (state.status?.accept) {
    state.accept = "✅";
  }
  if (state.status?.deposit) {
    state.deposit = "✅";
  }
  return state;
}

/**
 * @param {Object} opts
 * @param {String} opts.addr
 * @param {any} opts.dashApi - TODO
 */
async function checkBalance({ addr, dashApi }) {
  // deposit if balance is over 100,000 (0.00100000)
  process.stdout.write("Checking balance... ");
  let balanceInfo = await dashApi.getInstantBalance(addr);
  let balanceDash = toDash(balanceInfo.balanceSat);
  console.info(`${balanceInfo.balanceSat} (Đ${balanceDash})`);
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
  return balanceInfo;
}

/**
 * @param {Object} opts
 * @param {String} opts.defaultAddr
 * @param {Array<String>} args
 * @returns {Promise<[String, String]>}
 */
async function mustGetAddr({ defaultAddr }, args) {
  let name = args.shift() ?? "";
  if (34 === name.length) {
    // looks like addr already
    // TODO make function for addr-lookin' check
    return [name, name];
  }

  let addr = await maybeReadKeyPaths(name, { wif: false });
  if (addr) {
    if (34 === addr.length) {
      return [addr, name];
    }
    //let pk = new Dashcore.PrivateKey(wif);
    //let addr = pk.toAddress().toString();
    return [addr, name];
  }

  let isNum = !isNaN(parseFloat(name));
  if (isNum) {
    args.unshift(name);
    name = "";
  }

  if (name) {
    console.error();
    console.error(`could not read '${name}' in ./ or match in ${keysDirRel}/.`);
    console.error();
    process.exit(1);
    return ["", name];
  }

  addr = await mustGetDefaultWif(defaultAddr, { wif: false });

  // TODO we don't need defaultAddr, right? because it could be old?
  return [addr, addr];
}

/**
 * @param {Object} opts
 * @param {String} opts.defaultAddr
 * @param {Array<String>} args
 */
async function mustGetWif({ defaultAddr }, args) {
  let name = args.shift() ?? "";

  let wif = await maybeReadKeyPaths(name, { wif: true });
  if (wif) {
    return wif;
  }

  let isNum = !isNaN(parseFloat(name));
  if (isNum) {
    args.unshift(name);
    name = "";
  }

  if (name) {
    console.error();
    console.error(
      `'${name}' does not match a staking key in ./ or ${keysDirRel}/`,
    );
    console.error();
    process.exit(1);
    return "";
  }

  wif = await mustGetDefaultWif(defaultAddr);

  return wif;
}

/**
 * @param {String} name
 * @param {Object} opts
 * @param {Boolean} opts.wif
 * @returns {Promise<String>} - wif
 */
async function maybeReadKeyPaths(name, opts) {
  let privKey = "";

  // prefix match in .../keys/
  let wifname = await findWif(name);
  if (!wifname) {
    return "";
  }

  if (false === opts.wif) {
    return wifname.slice(0, -".wif".length);
  }

  let filepath = Path.join(keysDir, wifname);
  privKey = await maybeReadKeyFile(filepath);
  if (!privKey) {
    // local in ./
    privKey = await maybeReadKeyFile(name);
  }

  return privKey;
}

/**
 * @param {String} defaultAddr
 * @param {Object} [opts]
 * @param {Boolean} opts.wif
 */
async function mustGetDefaultWif(defaultAddr, opts) {
  let defaultWif = "";
  if (defaultAddr) {
    let keyfile = Path.join(keysDir, `${defaultAddr}.wif`);
    let raw = await maybeReadKeyFileRaw(keyfile, opts);
    // misnomering wif here a bit
    defaultWif = raw?.wif || raw?.addr || "";
  }
  if (defaultWif) {
    console.info(`selected default staking key ${defaultAddr}`);
    return defaultWif;
  }

  console.error();
  console.error(`Error: no default staking key selected.`);
  console.error();
  console.error(`Select a different address:`);
  console.error(`    crowdnode list`);
  console.error(`    crowdnode use <addr>`);
  console.error(``);
  console.error(`Or create a new staking key:`);
  console.error(`    crowdnode generate`);
  console.error();
  process.exit(1);
  return "";
}

// Subcommands

/**
 * @param {Object} psuedoState
 * @param {String} psuedoState.defaultKey - addr name of default key
 * @param {Array<String>} args
 */
async function generateKey({ defaultKey }, args) {
  let name = args.shift();
  //@ts-ignore - TODO submit JSDoc PR for Dashcore
  let pk = new Dashcore.PrivateKey();

  let addr = pk.toAddress().toString();
  let plainWif = pk.toWIF();

  let wif = await maybeEncrypt(plainWif);

  let filename = `~/${configdir}/keys/${addr}.wif`;
  let filepath = Path.join(`${keysDir}/${addr}.wif`);
  let note = "";
  if (name) {
    filename = name;
    filepath = name;
    note = `\n(for pubkey address ${addr})`;
    let err = await Fs.access(filepath).catch(Object);
    if (!err) {
      console.info(`'${filepath}' already exists (will not overwrite)`);
      process.exit(0);
      return;
    }
  }

  await Fs.writeFile(filepath, wif, "utf8");
  if (!name && !defaultKey) {
    await Fs.writeFile(defaultWifPath, addr, "utf8");
  }

  console.info(``);
  console.info(`Generated ${filename} ${note}`);
  console.info(``);
  process.exit(0);
  return;
}

/**
 * @param {Object} state
 * @param {Boolean} [state._askPreviousPassphrase] - don't ask for passphrase again
 * @param {Array<String>} args
 */
async function setPassphrase({ _askPreviousPassphrase }, args) {
  let date = getFsDateString();

  // get the old passphrase
  if (false !== _askPreviousPassphrase) {
    await cmds.getPassphrase(null, []);
  }

  // get the new passphrase
  let newPassphrase;
  for (;;) {
    newPassphrase = await Prompt.prompt("Enter (new) passphrase: ", {
      mask: true,
    });
    newPassphrase = newPassphrase.trim();

    let _newPassphrase = await Prompt.prompt("Enter passphrase again: ", {
      mask: true,
    });
    _newPassphrase = _newPassphrase.trim();

    let match = Cipher.secureCompare(newPassphrase, _newPassphrase);
    if (match) {
      break;
    }

    console.error("passphrases do not match");
  }
  let curShadow = await Fs.readFile(shadowPath, "utf8").catch(
    emptyStringOnErrEnoent,
  );

  let newShadow = await Cipher.shadowPassphrase(newPassphrase);
  await Fs.writeFile(shadowPath, newShadow, "utf8");

  let rawKeys = await readAllKeys();
  let encAddrs = rawKeys
    .map(function (raw) {
      if (raw.encrypted) {
        return raw.addr;
      }
    })
    .filter(Boolean);

  // backup all currently encrypted files
  //@ts-ignore
  if (encAddrs.length) {
    let filepath = Path.join(HOME, `${configdir}/keys.${date}.bak`);
    console.info(``);
    console.info(`Backing up previous (encrypted) keys:`);
    encAddrs.unshift(curShadow);
    await Fs.writeFile(filepath, encAddrs.join("\n") + "\n", "utf8");
    console.info(`  ~/${configdir}/keys.${date}.bak`);
    console.info(``);
  }
  cmds._setPassphrase(newPassphrase);

  await encryptAll(rawKeys, { rotateKey: true });

  return newPassphrase;
}

/**
 * Import and Encrypt
 * @param {Null} _
 * @param {Array<String>} args
 */
async function importKey(_, args) {
  let keypath = args.shift() || "";
  let key = await maybeReadKeyFileRaw(keypath);
  if (!key?.wif) {
    console.error(`no key found for '${keypath}'`);
    process.exit(1);
    return;
  }

  let encWif = await maybeEncrypt(key.wif);
  let icon = "💾";
  if (encWif.includes(":")) {
    icon = "🔐";
  }
  let date = getFsDateString();

  await safeSave(
    Path.join(keysDir, `${key.addr}.wif`),
    encWif,
    Path.join(keysDir, `${key.addr}.${date}.bak`),
  );

  console.info(`${icon} Imported ${keysDirRel}/${key.addr}.wif`);
  console.info(``);
}

/**
 * Encrypt ALL-the-things!
 * @param {Object} [opts]
 * @param {Boolean} opts.rotateKey
 * @param {Array<RawKey>?} rawKeys
 */
async function encryptAll(rawKeys, opts) {
  if (!rawKeys) {
    rawKeys = await readAllKeys();
  }
  let date = getFsDateString();

  console.info(`Encrypting...`);
  console.info(``);
  await rawKeys.reduce(async function (promise, key) {
    await promise;

    if (key.encrypted && !opts?.rotateKey) {
      console.info(`🙈 ${key.addr} [already encrypted]`);
      return;
    }
    let encWif = await maybeEncrypt(key.wif);
    await safeSave(
      Path.join(keysDir, `${key.addr}.wif`),
      encWif,
      Path.join(keysDir, `${key.addr}.${date}.bak`),
    );
    console.info(`🔑 ${key.addr}`);
  }, Promise.resolve());
  console.info(``);
  console.info(`Done 🔐`);
  console.info(``);
}

/**
 * Decrypt ALL-the-things!
 * @param {Array<RawKey>?} rawKeys
 */
async function decryptAll(rawKeys) {
  if (!rawKeys) {
    rawKeys = await readAllKeys();
  }
  let date = getFsDateString();

  console.info(``);
  console.info(`Decrypting...`);
  console.info(``);
  await rawKeys.reduce(async function (promise, key) {
    await promise;

    if (!key.encrypted) {
      console.info(`📖 ${key.addr} [already decrypted]`);
      return;
    }
    await safeSave(
      Path.join(keysDir, `${key.addr}.wif`),
      key.wif,
      Path.join(keysDir, `${key.addr}.${date}.bak`),
    );
    console.info(`🔓 ${key.addr}`);
  }, Promise.resolve());
  console.info(``);
  console.info(`Done ✅`);
  console.info(``);
}

function getFsDateString() {
  // YYYY-MM-DD_hh-mm_ss
  let date = new Date()
    .toISOString()
    .replace(/:/g, ".")
    .replace(/T/, "_")
    .replace(/\.\d{3}.*/, "");
  return date;
}

/**
 * @param {String} filepath
 * @param {String} wif
 * @param {String} bakpath
 */
async function safeSave(filepath, wif, bakpath) {
  let tmpPath = `${bakpath}.tmp`;
  await Fs.writeFile(tmpPath, wif, "utf8");
  let err = await Fs.access(filepath).catch(Object);
  if (!err) {
    await Fs.rename(filepath, bakpath);
  }
  await Fs.rename(tmpPath, filepath);
  if (!err) {
    await Fs.unlink(bakpath);
  }
}

/**
 * @param {Null} psuedoState
 * @param {Array<String>} args
 */
cmds.getPassphrase = async function (psuedoState, args) {
  // Three possible states:
  //   1. no shadow file yet (ask to set one)
  //   2. empty shadow file (initialized, but not set - don't ask to set one)
  //   3. encrypted shadow file (initialized, requires passphrase)
  let needsInit = false;
  let shadow = await Fs.readFile(shadowPath, "utf8").catch(function (err) {
    if ("ENOENT" === err.code) {
      needsInit = true;
      return;
    }
    throw err;
  });

  // State 1: not initialized, what does the user want?
  if (needsInit) {
    for (;;) {
      let no = await Prompt.prompt(
        "Would you like to set an encryption passphrase? [Y/n]: ",
      );

      // Set a passphrase and create shadow file
      if (!no || ["yes", "y"].includes(no.toLowerCase())) {
        let passphrase = await setPassphrase(
          { _askPreviousPassphrase: false },
          args,
        );
        cmds._setPassphrase(passphrase);
        return passphrase;
      }

      // ask user again
      if (!["no", "n"].includes(no.toLowerCase())) {
        continue;
      }

      // No passphrase, create empty shadow file
      await Fs.writeFile(shadowPath, "", "utf8");
      return "";
    }
  }

  // State 2: shadow already initialized to empty
  // (user doesn't want a passphrase)
  if (!shadow) {
    cmds._setPassphrase("");
    return "";
  }

  // State 3: passphrase & shadow already in use
  for (;;) {
    let passphrase = await Prompt.prompt("Enter (current) passphrase: ", {
      mask: true,
    });
    passphrase = passphrase.trim();
    if (!passphrase || "q" === passphrase) {
      console.error("cancel: no passphrase");
      process.exit(1);
      return;
    }

    let match = await Cipher.checkPassphrase(passphrase, shadow);
    if (match) {
      cmds._setPassphrase(passphrase);
      console.info(``);
      return passphrase;
    }

    console.error("incorrect passphrase");
  }

  throw new Error("SANITY FAIL: unreachable return");
};

cmds._getPassphrase = function () {
  return "";
};

/**
 * @param {String} passphrase
 */
cmds._setPassphrase = function (passphrase) {
  // Look Ma! A private variable!
  cmds._getPassphrase = function () {
    return passphrase;
  };
};

/**
 * @typedef {Object} RawKey
 * @property {String} addr
 * @property {Boolean} encrypted
 * @property {String} wif
 */

/**
 * @throws
 */
async function readAllKeys() {
  let wifnames = await listManagedKeynames();

  /** @type Array<RawKey> */
  let keys = [];
  await wifnames.reduce(async function (promise, wifname) {
    await promise;

    let keypath = Path.join(keysDir, wifname);
    let key = await maybeReadKeyFileRaw(keypath);
    if (!key?.wif) {
      return;
    }

    if (`${key.addr}.wif` !== wifname) {
      throw new Error(
        `computed pubkey '${key.addr}' of WIF does not match filename '${keypath}'`,
      );
    }

    keys.push(key);
  }, Promise.resolve());

  return keys;
}

/**
 * @param {String} filepath
 * @param {Object} [opts]
 * @param {Boolean} opts.wif
 * @returns {Promise<String>}
 */
async function maybeReadKeyFile(filepath, opts) {
  let key = await maybeReadKeyFileRaw(filepath, opts);
  if (false === opts?.wif) {
    return key?.addr || "";
  }
  return key?.wif || "";
}

/**
 * @param {String} filepath
 * @param {Object} [opts]
 * @param {Boolean} opts.wif
 * @returns {Promise<RawKey?>}
 */
async function maybeReadKeyFileRaw(filepath, opts) {
  let privKey = await Fs.readFile(filepath, "utf8").catch(
    emptyStringOnErrEnoent,
  );
  privKey = privKey.trim();
  if (!privKey) {
    return null;
  }

  let encrypted = false;
  if (privKey.includes(":")) {
    encrypted = true;
    try {
      if (false !== opts?.wif) {
        privKey = await decrypt(privKey);
      }
    } catch (err) {
      //@ts-ignore
      console.error(err.message);
      console.error(`passphrase does not match for key ${filepath}`);
      process.exit(1);
    }
  }
  if (false === opts?.wif) {
    return {
      addr: Path.basename(filepath, ".wif"),
      encrypted: encrypted,
      wif: "",
    };
  }

  let pk = new Dashcore.PrivateKey(privKey);
  let pub = pk.toAddress().toString();

  return {
    addr: pub,
    encrypted: encrypted,
    wif: privKey,
  };
}

/**
 * @param {String} encWif
 */
async function decrypt(encWif) {
  let passphrase = cmds._getPassphrase();
  if (!passphrase) {
    passphrase = await cmds.getPassphrase(null, []);
  }
  let key128 = await Cipher.deriveKey(passphrase);
  let cipher = Cipher.create(key128);

  return cipher.decrypt(encWif);
}

/**
 * @param {String} plainWif
 */
async function maybeEncrypt(plainWif) {
  let passphrase = cmds._getPassphrase();
  if (!passphrase) {
    passphrase = await cmds.getPassphrase(null, []);
  }
  if (!passphrase) {
    return plainWif;
  }

  let key128 = await Cipher.deriveKey(passphrase);
  let cipher = Cipher.create(key128);
  return cipher.encrypt(plainWif);
}

/**
 * @param {Null} _
 * @param {Array<String>} args
 */
async function setDefault(_, args) {
  let addr = args.shift() || "";

  let keyname = await findWif(addr);
  if (!keyname) {
    console.error(`no key matches '${addr}'`);
    process.exit(1);
    return;
  }

  let filepath = Path.join(keysDir, keyname);
  let wif = await maybeReadKeyFile(filepath);
  let pk = new Dashcore.PrivateKey(wif);
  let pub = pk.toAddress().toString();

  console.info("set", defaultWifPath, pub);
  await Fs.writeFile(defaultWifPath, pub, "utf8");
}

// TODO option to specify config dir

/**
 * @param {Object} opts
 * @param {any} opts.dashApi - TODO
 * @param {Array<String>} args
 */
async function listKeys({ dashApi }, args) {
  let wifnames = await listManagedKeynames();

  /**
   * @type Array<{ node: String, error: Error }>
   */
  let warns = [];
  console.info(``);
  console.info(`Staking keys: (in ${keysDirRel}/)`);
  console.info(``);
  if (!wifnames.length) {
    console.info(`    (none)`);
  }
  await wifnames.reduce(async function (promise, wifname) {
    await promise;

    let wifpath = Path.join(keysDir, wifname);
    let addr = await maybeReadKeyFile(wifpath, { wif: false }).catch(function (
      err,
    ) {
      warns.push({ node: wifname, error: err });
      return "";
    });
    if (!addr) {
      return;
    }

    /*
    let pk = new Dashcore.PrivateKey(wif);
    let pub = pk.toAddress().toString();
    if (`${pub}.wif` !== wifname) {
      // sanity check
      warns.push({
        node: wifname,
        error: new Error(
          `computed pubkey '${pub}' of WIF does not match filename '${wifname}'`,
        ),
      });
      return;
    }
    */

    process.stdout.write(`  🪙  ${addr}: `);
    let balanceInfo = await dashApi.getInstantBalance(addr);
    let balanceDash = toDash(balanceInfo.balanceSat);
    console.info(`${balanceInfo.balanceSat} (Đ${balanceDash})`);
  }, Promise.resolve());
  console.info(``);

  if (warns.length) {
    console.warn(`Warnings:`);
    warns.forEach(function (warn) {
      console.warn(`${warn.node}: ${warn.error.message}`);
    });
    console.warn(``);
  }
}

/**
 * @param {String} name - ex: Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.wif.enc
 */
function isNamedLikeKey(name) {
  // TODO distinguish with .enc extension?
  let hasGoodLength = 34 + 4 === name.length || 34 + 4 + 4 === name.length;
  let knownExt = name.endsWith(".wif") || name.endsWith(".wif.enc");
  let isTmp = name.startsWith(".") || name.startsWith("_");
  return hasGoodLength && knownExt && !isTmp;
}

/**
 * @param {Object} opts
 * @param {any} opts.dashApi - TODO
 * @param {String} opts.defaultAddr
 * @param {String} opts.insightBaseUrl
 * @param {Array<String>} args
 */
async function removeKey({ dashApi, defaultAddr, insightBaseUrl }, args) {
  let [addr, name] = await mustGetAddr({ defaultAddr }, args);
  let balanceInfo = await dashApi.getInstantBalance(addr);

  let balanceDash = toDash(balanceInfo.balanceSat);
  if (balanceInfo.balanceSat) {
    console.error(``);
    console.error(`Error: ${addr}`);
    console.error(
      `    still has a balance of ${balanceInfo.balanceSat} (Đ${balanceDash})`,
    );
    console.error(`    (transfer to another address before deleting)`);
    console.error(``);
    process.exit(1);
    return;
  }

  await initCrowdNode(insightBaseUrl);
  let crowdNodeBalance = await CrowdNode.http.GetBalance(addr);
  if (!crowdNodeBalance) {
    // may be janky if not registered
    crowdNodeBalance = {};
  }
  if (!crowdNodeBalance.TotalBalance) {
    //console.log('DEBUG', crowdNodeBalance);
    crowdNodeBalance.TotalBalance = 0;
  }
  let crowdNodeDash = toDash(crowdNodeBalance.TotalBalance);
  if (crowdNodeBalance.TotalBalance) {
    console.error(``);
    console.error(`Error: ${addr}`);
    console.error(
      `    still staking ${crowdNodeBalance.TotalBalance} (Đ${crowdNodeDash}) on CrowdNode`,
    );
    console.error(
      `    (withdrawal 100.0 and transfer to another address before deleting)`,
    );
    console.error(``);
    process.exit(1);
    return;
  }

  let wifname = await findWif(addr);
  let filepath = Path.join(keysDir, wifname);
  let wif = await maybeReadKeyPaths(name, { wif: true });

  await Fs.unlink(filepath).catch(function (err) {
    console.error(`could not remove ${filepath}: ${err.message}`);
    process.exit(1);
  });

  let wifnames = await listManagedKeynames();
  console.info(``);
  console.info(`No balances found. Removing ${filepath}.`);
  console.info(``);
  console.info(`Backup (just in case):`);
  console.info(`    ${wif}`);
  console.info(``);
  if (!wifnames.length) {
    console.info(`No keys left.`);
    console.info(``);
  } else {
    let newAddr = wifnames[0];
    console.info(`Selected ${newAddr} as new default staking key.`);
    await Fs.writeFile(defaultWifPath, addr.replace(".wif", ""), "utf8");
    console.info(``);
  }
}

/**
 * @param {String} pre
 */
async function findWif(pre) {
  if (!pre) {
    return "";
  }

  let names = await listManagedKeynames();
  names = names.filter(function (name) {
    return name.startsWith(pre);
  });

  if (!names.length) {
    return "";
  }

  if (names.length > 1) {
    console.error(`'${pre}' is ambiguous:`, names.join(", "));
    process.exit(1);
    return "";
  }

  return names[0];
}

async function listManagedKeynames() {
  let nodes = await Fs.readdir(keysDir);

  return nodes.filter(isNamedLikeKey);
}

/**
 * @param {Object} opts
 * @param {String} opts.defaultAddr
 * @param {String} opts.insightBaseUrl
 * @param {Array<String>} args
 */
async function loadAddr({ defaultAddr, insightBaseUrl }, args) {
  let [addr] = await mustGetAddr({ defaultAddr }, args);

  let desiredAmountDash = parseFloat(args.shift() || "0");
  let desiredAmountDuff = Math.round(desiredAmountDash * DUFFS);
  let effectiveDuff = desiredAmountDuff;
  let effectiveDash = "";
  if (!effectiveDuff) {
    effectiveDuff = CrowdNode.stakeMinimum + signupTotal + feeEstimate;
    effectiveDash = toDash(effectiveDuff);
    // Round to the nearest mDash
    // ex: 0.50238108 => 0.50300000
    effectiveDuff = toDuff(
      (Math.ceil(parseFloat(effectiveDash) * 1000) / 1000).toString(),
    );
    effectiveDash = toDash(effectiveDuff);
  }

  console.info(``);
  showQr(addr, effectiveDuff);
  console.info(``);
  console.info(
    `Use the QR Code above to load ${effectiveDuff} (Đ${effectiveDash}) onto your staking key.`,
  );
  console.info(``);
  console.info(`(waiting...)`);
  console.info(``);
  let payment = await Ws.waitForVout(insightBaseUrl, addr, 0);
  console.info(`Received ${payment.satoshis}`);
  process.exit(0);
}

/**
 * @param {Object} opts
 * @param {String} opts.defaultAddr
 * @param {any} opts.dashApi - TODO
 * @param {Array<String>} args
 */
async function getBalance({ dashApi, defaultAddr }, args) {
  let [addr] = await mustGetAddr({ defaultAddr }, args);
  let balanceInfo = await checkBalance({ addr, dashApi });
  console.info(balanceInfo);
  process.exit(0);
  return;
}

/**
 * @param {Object} opts
 * @param {any} opts.dashApi - TODO
 * @param {String} opts.defaultAddr
 * @param {Boolean} opts.forceConfirm
 * @param {String} opts.insightBaseUrl
 * @param {any} opts.insightApi
 * @param {Array<String>} args
 */
// ex: node ./bin/crowdnode.js transfer ./priv.wif 'pub' 0.01
async function transferBalance(
  { dashApi, defaultAddr, forceConfirm, insightBaseUrl, insightApi },
  args,
) {
  let wif = await mustGetWif({ defaultAddr }, args);

  let keyname = args.shift() || "";
  let newAddr = await wifFileToAddr(keyname);
  let dashAmount = parseFloat(args.shift() || "0");
  let duffAmount = Math.round(dashAmount * DUFFS);
  let tx;
  if (duffAmount) {
    tx = await dashApi.createPayment(wif, newAddr, duffAmount);
  } else {
    tx = await dashApi.createBalanceTransfer(wif, newAddr);
  }
  if (duffAmount) {
    let dashAmountStr = toDash(duffAmount);
    console.info(
      `Transferring ${duffAmount} (Đ${dashAmountStr}) to ${newAddr}...`,
    );
  } else {
    console.info(`Transferring balance to ${newAddr}...`);
  }
  await insightApi.instantSend(tx);
  console.info(`Queued...`);
  setTimeout(function () {
    // TODO take a cleaner approach
    // (waitForVout needs a reasonable timeout)
    console.error(`Error: Transfer did not complete.`);
    if (forceConfirm) {
      console.error(`(using --unconfirmed may lead to rejected double spends)`);
    }
    process.exit(1);
  }, 30 * 1000);
  await Ws.waitForVout(insightBaseUrl, newAddr, 0);
  console.info(`Accepted!`);
  process.exit(0);
  return;
}

/**
 * @param {Object} opts
 * @param {any} opts.dashApi - TODO
 * @param {String} opts.defaultAddr
 * @param {String} opts.insightBaseUrl
 * @param {Array<String>} args
 */
async function getStatus({ dashApi, defaultAddr, insightBaseUrl }, args) {
  let [addr] = await mustGetAddr({ defaultAddr }, args);
  await initCrowdNode(insightBaseUrl);
  let hotwallet = CrowdNode.main.hotwallet;
  let state = await getCrowdNodeStatus({ addr, hotwallet });

  console.info();
  console.info(`API Actions Complete for ${addr}:`);
  console.info(`    ${state.signup} SignUpForApi`);
  console.info(`    ${state.accept} AcceptTerms`);
  console.info(`    ${state.deposit} DepositReceived`);
  console.info();
  let crowdNodeBalance = await CrowdNode.http.GetBalance(addr);
  // may be unregistered / undefined
  /*
   * {
   *   '@odata.context': 'https://app.crowdnode.io/odata/$metadata#Edm.String',
   *   value: 'Address not found.'
   * }
   */
  if (!crowdNodeBalance.TotalBalance) {
    crowdNodeBalance.TotalBalance = 0;
  }
  let crowdNodeDash = toDash(crowdNodeBalance.TotalBalance);
  console.info(
    `CrowdNode Stake: ${crowdNodeBalance.TotalBalance} (Đ${crowdNodeDash})`,
  );
  console.info();
  process.exit(0);
  return;
}

/**
 * @param {Object} opts
 * @param {any} opts.dashApi - TODO
 * @param {String} opts.defaultAddr
 * @param {String} opts.insightBaseUrl
 * @param {Array<String>} args
 */
async function sendSignup({ dashApi, defaultAddr, insightBaseUrl }, args) {
  let [addr, name] = await mustGetAddr({ defaultAddr }, args);
  await initCrowdNode(insightBaseUrl);
  let hotwallet = CrowdNode.main.hotwallet;
  let state = await getCrowdNodeStatus({ addr, hotwallet });
  let balanceInfo = await checkBalance({ addr, dashApi });

  if (state.status?.signup) {
    console.info(`${addr} is already signed up. Here's the account status:`);
    console.info(`    ${state.signup} SignUpForApi`);
    console.info(`    ${state.accept} AcceptTerms`);
    console.info(`    ${state.deposit} DepositReceived`);
    process.exit(0);
    return;
  }

  let hasEnough = balanceInfo.balanceSat > signupOnly + feeEstimate;
  if (!hasEnough) {
    await collectSignupFees(insightBaseUrl, addr);
  }

  let wif = await maybeReadKeyPaths(name, { wif: true });

  console.info("Requesting account...");
  await CrowdNode.signup(wif, hotwallet);
  state.signup = "✅";
  console.info(`    ${state.signup} SignUpForApi`);
  console.info(`    ${state.accept} AcceptTerms`);
  process.exit(0);
  return;
}

/**
 * @param {Object} opts
 * @param {any} opts.dashApi - TODO
 * @param {String} opts.defaultAddr
 * @param {String} opts.insightBaseUrl
 * @param {Array<String>} args
 */
async function acceptTerms({ dashApi, defaultAddr, insightBaseUrl }, args) {
  let [addr, name] = await mustGetAddr({ defaultAddr }, args);

  await initCrowdNode(insightBaseUrl);
  let hotwallet = CrowdNode.main.hotwallet;
  let state = await getCrowdNodeStatus({ addr, hotwallet });
  let balanceInfo = await dashApi.getInstantBalance(addr);

  if (!state.status?.signup) {
    console.info(`${addr} is not signed up yet. Here's the account status:`);
    console.info(`    ${state.signup} SignUpForApi`);
    console.info(`    ${state.accept} AcceptTerms`);
    process.exit(1);
    return;
  }

  if (state.status?.accept) {
    console.info(`${addr} is already signed up. Here's the account status:`);
    console.info(`    ${state.signup} SignUpForApi`);
    console.info(`    ${state.accept} AcceptTerms`);
    console.info(`    ${state.deposit} DepositReceived`);
    process.exit(0);
    return;
  }
  let hasEnough = balanceInfo.balanceSat > acceptOnly + feeEstimate;
  if (!hasEnough) {
    await collectSignupFees(insightBaseUrl, addr);
  }

  let wif = await maybeReadKeyPaths(name, { wif: true });

  console.info("Accepting terms...");
  await CrowdNode.accept(wif, hotwallet);
  state.accept = "✅";
  console.info(`    ${state.signup} SignUpForApi`);
  console.info(`    ${state.accept} AcceptTerms`);
  console.info(`    ${state.deposit} DepositReceived`);
  process.exit(0);
  return;
}

/**
 * @param {Object} opts
 * @param {any} opts.dashApi - TODO
 * @param {String} opts.defaultAddr
 * @param {String} opts.insightBaseUrl
 * @param {Boolean} opts.noReserve
 * @param {Array<String>} args
 */
async function depositDash(
  { dashApi, defaultAddr, insightBaseUrl, noReserve },
  args,
) {
  let [addr, name] = await mustGetAddr({ defaultAddr }, args);
  await initCrowdNode(insightBaseUrl);
  let hotwallet = CrowdNode.main.hotwallet;
  let state = await getCrowdNodeStatus({ addr, hotwallet });
  let balanceInfo = await dashApi.getInstantBalance(addr);

  if (!state.status?.accept) {
    console.error(`no account for address ${addr}`);
    process.exit(1);
    return;
  }

  // this would allow for at least 2 withdrawals costing (21000 + 1000)
  let reserve = 50000;
  let reserveDash = toDash(reserve);
  if (!noReserve) {
    console.info(
      `reserving ${reserve} (Đ${reserveDash}) for withdrawals (--no-reserve to disable)`,
    );
  } else {
    reserve = 0;
  }

  // TODO if unconfirmed, check utxos instead

  // deposit what the user asks, or all that we have,
  // or all that the user deposits - but at least 2x the reserve
  let desiredAmountDash = parseFloat(args.shift() || "0");
  let desiredAmountDuff = Math.round(desiredAmountDash * DUFFS);
  let effectiveAmount = desiredAmountDuff;
  if (!effectiveAmount) {
    effectiveAmount = balanceInfo.balanceSat - reserve;
  }
  let needed = Math.max(reserve * 2, effectiveAmount + reserve);

  if (balanceInfo.balanceSat < needed) {
    let ask = 0;
    if (desiredAmountDuff) {
      ask = desiredAmountDuff + reserve + -balanceInfo.balanceSat;
    }
    await collectDeposit(insightBaseUrl, addr, ask);
    balanceInfo = await dashApi.getInstantBalance(addr);
    if (balanceInfo.balanceSat < needed) {
      let balanceDash = toDash(balanceInfo.balanceSat);
      console.error(
        `Balance is still too small: ${balanceInfo.balanceSat} (Đ${balanceDash})`,
      );
      process.exit(1);
      return;
    }
  }
  if (!desiredAmountDuff) {
    effectiveAmount = balanceInfo.balanceSat - reserve;
  }

  let effectiveDash = toDash(effectiveAmount);
  console.info(
    `Initiating deposit of ${effectiveAmount} (Đ${effectiveDash})...`,
  );

  let wif = await maybeReadKeyPaths(name, { wif: true });

  await CrowdNode.deposit(wif, hotwallet, effectiveAmount);
  state.deposit = "✅";
  console.info(`    ${state.deposit} DepositReceived`);
  process.exit(0);
  return;
}

/**
 * @param {Object} opts
 * @param {any} opts.dashApi - TODO
 * @param {String} opts.defaultAddr
 * @param {String} opts.insightBaseUrl
 * @param {Array<String>} args
 */
async function withdrawalDash({ dashApi, defaultAddr, insightBaseUrl }, args) {
  let [addr] = await mustGetAddr({ defaultAddr }, args);
  await initCrowdNode(insightBaseUrl);
  let hotwallet = CrowdNode.main.hotwallet;
  let state = await getCrowdNodeStatus({ addr, hotwallet });

  if (!state.status?.accept) {
    console.error(`no account for address ${addr}`);
    process.exit(1);
    return;
  }

  let percentStr = args.shift() || "100.0";
  // pass: .1 0.1, 1, 1.0, 10, 10.0, 100, 100.0
  // fail: 1000, 10.00
  if (!/^1?\d?\d?(\.\d)?$/.test(percentStr)) {
    console.error("Error: withdrawal percent must be between 0.1 and 100.0");
    process.exit(1);
  }
  let percent = parseFloat(percentStr);

  let permil = Math.round(percent * 10);
  if (permil <= 0 || permil > 1000) {
    console.error("Error: withdrawal percent must be between 0.1 and 100.0");
    process.exit(1);
  }

  let realPercentStr = (permil / 10).toFixed(1);
  console.info(`Initiating withdrawal of ${realPercentStr}...`);

  let wifname = await findWif(addr);
  let filepath = Path.join(keysDir, wifname);
  let wif = await maybeReadKeyFile(filepath);
  let paid = await CrowdNode.withdrawal(wif, hotwallet, permil);
  //let paidFloat = (paid.satoshis / DUFFS).toFixed(8);
  //let paidInt = paid.satoshis.toString().padStart(9, "0");
  console.info(`API Response: ${paid.api}`);
  process.exit(0);
  return;
}

// Helpers

/**
 * Convert prefix, addr, keyname, or filepath to pub addr
 * @param {String} name
 * @throws
 */
async function wifFileToAddr(name) {
  if (34 === name.length) {
    // actually payment addr
    return name;
  }

  let privKey = "";

  let wifname = await findWif(name);
  if (wifname) {
    let filepath = Path.join(keysDir, wifname);
    privKey = await maybeReadKeyFile(filepath);
  }
  if (!privKey) {
    privKey = await maybeReadKeyFile(name);
  }
  if (!privKey) {
    throw new Error("bad file path or address");
  }

  let pk = new Dashcore.PrivateKey(privKey);
  let pub = pk.toPublicKey().toAddress().toString();
  return pub;
}

/**
 * @param {String} insightBaseUrl
 * @param {String} addr
 */
async function collectSignupFees(insightBaseUrl, addr) {
  console.info(``);
  showQr(addr);

  let signupTotalDash = toDash(signupTotal);
  let signupMsg = `Please send >= ${signupTotal} (Đ${signupTotalDash}) to Sign Up to CrowdNode`;
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
  let payment = await Ws.waitForVout(insightBaseUrl, addr, 0);
  console.info(`Received ${payment.satoshis}`);
}

/**
 * @param {String} insightBaseUrl
 * @param {String} addr
 * @param {Number} duffAmount
 */
async function collectDeposit(insightBaseUrl, addr, duffAmount) {
  console.info(``);
  showQr(addr, duffAmount);

  let depositMsg = `Please send what you wish to deposit to ${addr}`;
  if (duffAmount) {
    let dashAmount = toDash(duffAmount);
    depositMsg = `Please deposit ${duffAmount} (Đ${dashAmount}) to ${addr}`;
  }

  let msgPad = Math.ceil((qrWidth - depositMsg.length) / 2);
  msgPad = Math.max(0, msgPad);

  console.info();
  console.info(" ".repeat(msgPad) + depositMsg);
  console.info();

  console.info("");
  console.info("(waiting...)");
  console.info("");
  let payment = await Ws.waitForVout(insightBaseUrl, addr, 0);
  console.info(`Received ${payment.satoshis}`);
}

/**
 * @param {Error & { code: String }} err
 * @throws
 */
function emptyStringOnErrEnoent(err) {
  if ("ENOENT" !== err.code) {
    throw err;
  }
  return "";
}

/**
 * @param {Number} duffs - ex: 00000000
 */
function toDash(duffs) {
  return (duffs / DUFFS).toFixed(8);
}

/**
 * @param {String} dash - ex: 0.00000000
 */
function toDuff(dash) {
  return Math.round(parseFloat(dash) * DUFFS);
}

// Run

main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
  process.exit(1);
});
