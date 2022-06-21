"use strict";

let request = require("./request.js");

let CrowdNode = module.exports;

const DUFFS = 100000000;

let Dash = require("./dash.js");
let Dashcore = require("@dashevo/dashcore-lib");
let Insight = require("./insight.js");
let Ws = require("./ws.js");

CrowdNode._insightBaseUrl = "";
// TODO don't require these shims
CrowdNode._insightApi = Insight.create({ baseUrl: "" });
CrowdNode._dashApi = Dash.create({ insightApi: CrowdNode._insightApi });

CrowdNode.main = {
  baseUrl: "https://app.crowdnode.io",
  hotwallet: "",
};

CrowdNode.test = {
  baseUrl: "https://test.crowdnode.io",
  hotwallet: "",
};

CrowdNode._baseUrl = CrowdNode.main.baseUrl;

CrowdNode.offset = 20000;
CrowdNode.duffs = 100000000;
CrowdNode.depositMinimum = 10000;
CrowdNode.stakeMinimum = toDuff(0.5);

/**
 * @type {Record<String, Number>}
 */
CrowdNode.requests = {
  acceptTerms: 65536,
  offset: 20000,
  signupForApi: 131072,
  toggleInstantPayout: 4096,
  withdrawMin: 1,
  withdrawMax: 1000,
};

/**
 * @type {Record<Number, String>}
 */
CrowdNode._responses = {
  2: "PleaseAcceptTerms",
  4: "WelcomeToCrowdNodeBlockChainAPI",
  8: "DepositReceived",
  16: "WithdrawalQueued",
  32: "WithdrawalFailed", // Most likely too small amount requested for withdrawal.
  64: "AutoWithdrawalEnabled",
  128: "AutoWithdrawalDisabled",
};
/**
 * @type {Record<String, Number>}
 */
CrowdNode.responses = {
  PleaseAcceptTerms: 2,
  WelcomeToCrowdNodeBlockChainAPI: 4,
  DepositReceived: 8,
  WithdrawalQueued: 16,
  WithdrawalFailed: 32,
  AutoWithdrawalEnabled: 64,
  AutoWithdrawalDisabled: 128,
};

/**
 * @param {Object} opts
 * @param {String} opts.baseUrl
 * @param {String} opts.insightBaseUrl
 */
CrowdNode.init = async function ({ baseUrl, insightBaseUrl }) {
  // TODO use API
  // See https://github.com/dashhive/crowdnode.js/issues/3

  CrowdNode._baseUrl = baseUrl;

  //hotwallet in Mainnet is XjbaGWaGnvEtuQAUoBgDxJWe8ZNv45upG2
  CrowdNode.main.hotwallet = await request({
    // TODO https://app.crowdnode.io/odata/apifundings/HotWallet
    url: "https://knowledge.crowdnode.io/en/articles/5963880-blockchain-api-guide",
  }).then(createAddrParser("hotwallet in Main"));

  //hotwallet in Test is yMY5bqWcknGy5xYBHSsh2xvHZiJsRucjuy
  CrowdNode.test.hotwallet = await request({
    // TODO https://test.crowdnode.io/odata/apifundings/HotWallet
    url: "https://knowledge.crowdnode.io/en/articles/5963880-blockchain-api-guide",
  }).then(createAddrParser("hotwallet in Test"));

  CrowdNode._insightBaseUrl = insightBaseUrl;
  CrowdNode._insightApi = Insight.create({
    baseUrl: insightBaseUrl,
  });
  CrowdNode._dashApi = Dash.create({ insightApi: CrowdNode._insightApi });
};

/**
 * @param {String} signupAddr
 * @param {String} hotwallet
 */
CrowdNode.status = async function (signupAddr, hotwallet) {
  let maxPages = 10;
  let data = await CrowdNode._insightApi.getTxs(signupAddr, maxPages);
  let status = {
    signup: 0,
    accept: 0,
    deposit: 0,
  };

  data.txs.forEach(function (tx) {
    // all inputs (utxos) must come from hotwallet
    let fromHotwallet = tx.vin.every(function (vin) {
      return vin.addr === hotwallet;
    });
    if (!fromHotwallet) {
      return;
    }

    // must have one output matching the "welcome" value to the signupAddr
    tx.vout.forEach(function (vout) {
      if (vout.scriptPubKey.addresses[0] !== signupAddr) {
        return;
      }
      let amount = Math.round(parseFloat(vout.value) * DUFFS);
      let msg = amount - CrowdNode.offset;

      if (CrowdNode.responses.DepositReceived === msg) {
        status.deposit = tx.time;
        status.signup = status.signup || 1;
        status.accept = status.accept || 1;
        return;
      }

      if (CrowdNode.responses.WelcomeToCrowdNodeBlockChainAPI === msg) {
        status.signup = status.signup || 1;
        status.accept = tx.time || 1;
        return;
      }

      if (CrowdNode.responses.PleaseAcceptTerms === msg) {
        status.signup = tx.time;
        return;
      }
    });
  });

  if (!status.signup) {
    return null;
  }
  return status;
};

/**
 * @param {String} wif
 * @param {String} hotwallet
 */
CrowdNode.signup = async function (wif, hotwallet) {
  // Send Request Message
  let pk = new Dashcore.PrivateKey(wif);
  let msg = CrowdNode.offset + CrowdNode.requests.signupForApi;
  let changeAddr = pk.toPublicKey().toAddress().toString();
  let tx = await CrowdNode._dashApi.createPayment(
    wif,
    hotwallet,
    msg,
    changeAddr,
  );
  await CrowdNode._insightApi.instantSend(tx.serialize());

  let reply = CrowdNode.offset + CrowdNode.responses.PleaseAcceptTerms;
  return await Ws.waitForVout(CrowdNode._insightBaseUrl, changeAddr, reply);
};

/**
 * @param {String} wif
 * @param {String} hotwallet
 */
CrowdNode.accept = async function (wif, hotwallet) {
  // Send Request Message
  let pk = new Dashcore.PrivateKey(wif);
  let msg = CrowdNode.offset + CrowdNode.requests.acceptTerms;
  let changeAddr = pk.toPublicKey().toAddress().toString();
  let tx = await CrowdNode._dashApi.createPayment(
    wif,
    hotwallet,
    msg,
    changeAddr,
  );
  await CrowdNode._insightApi.instantSend(tx.serialize());

  let reply =
    CrowdNode.offset + CrowdNode.responses.WelcomeToCrowdNodeBlockChainAPI;
  return await Ws.waitForVout(CrowdNode._insightBaseUrl, changeAddr, reply);
};

/**
 * @param {String} wif
 * @param {String} hotwallet
 * @param {Number} amount - Duffs (1/100000000 Dash)
 */
CrowdNode.deposit = async function (wif, hotwallet, amount) {
  // Send Request Message
  let pk = new Dashcore.PrivateKey(wif);
  let changeAddr = pk.toPublicKey().toAddress().toString();

  // TODO reserve a balance
  let tx;
  if (amount) {
    tx = await CrowdNode._dashApi.createPayment(
      wif,
      hotwallet,
      amount,
      changeAddr,
    );
  } else {
    tx = await CrowdNode._dashApi.createBalanceTransfer(wif, hotwallet);
  }
  await CrowdNode._insightApi.instantSend(tx.serialize());

  let reply = CrowdNode.offset + CrowdNode.responses.DepositReceived;
  return await Ws.waitForVout(CrowdNode._insightBaseUrl, changeAddr, reply);
};

/**
 * @param {String} wif
 * @param {String} hotwallet
 * @param {Number} permil - 1/1000 (1/10 of a percent) 500 permille = 50.0 percent
 */
CrowdNode.withdrawal = async function (wif, hotwallet, permil) {
  let valid = permil > 0 && permil <= 1000;
  valid = valid && Math.round(permil) === permil;
  if (!valid) {
    throw new Error(`'permil' must be between 1 and 1000, not '${permil}'`);
  }

  // Send Request Message
  let pk = new Dashcore.PrivateKey(wif);
  let msg = CrowdNode.offset + permil;
  let changeAddr = pk.toPublicKey().toAddress().toString();
  let tx = await CrowdNode._dashApi.createPayment(
    wif,
    hotwallet,
    msg,
    changeAddr,
  );
  await CrowdNode._insightApi.instantSend(tx.serialize());

  // Listen for Response
  let mempoolTx = {
    address: "",
    api: "",
    at: 0,
    txid: "",
    satoshis: 0,
    txlock: false,
  };
  return await Ws.listen(CrowdNode._insightBaseUrl, findResponse);

  /**
   * @param {String} evname
   * @param {InsightSocketEventData} data
   */
  function findResponse(evname, data) {
    if (!["tx", "txlock"].includes(evname)) {
      return;
    }

    let now = Date.now();
    if (mempoolTx.at) {
      // don't wait longer than 3s for a txlock
      if (now - mempoolTx.at > 3000) {
        return mempoolTx;
      }
    }

    let result;
    // TODO should fetch tx and match hotwallet as vin
    data.vout.some(function (vout) {
      return Object.keys(vout).some(function (addr) {
        if (addr !== changeAddr) {
          return false;
        }

        let duffs = vout[addr];
        let msg = duffs - CrowdNode.offset;
        let api = CrowdNode._responses[msg];
        if (!api) {
          // the withdrawal often happens before the queued message
          console.warn(`  => received '${duffs}' (${evname})`);
          return false;
        }

        let newTx = {
          address: addr,
          api: api.toString(),
          at: now,
          txid: data.txid,
          satoshis: duffs,
          txlock: data.txlock,
        };

        if ("txlock" !== evname) {
          // wait up to 3s for a txlock
          if (!mempoolTx) {
            mempoolTx = newTx;
          }
          return false;
        }

        result = newTx;
        return true;
      });
    });

    return result;
  }
};

// See ./bin/crowdnode-list-apis.sh
CrowdNode.http = {};

/**
 * @param {String} baseUrl
 * @param {String} pub
 */
CrowdNode.http.FundsOpen = async function (pub) {
  return `Open <${CrowdNode._baseUrl}/FundsOpen/${pub}> in your browser.`;
};

/**
 * @param {String} baseUrl
 * @param {String} pub
 */
CrowdNode.http.VotingOpen = async function (pub) {
  return `Open <${CrowdNode._baseUrl}/VotingOpen/${pub}> in your browser.`;
};

/**
 * @param {String} baseUrl
 * @param {String} pub
 */
CrowdNode.http.GetFunds = createApi(
  `/odata/apifundings/GetFunds(address='{1}')`,
);

/**
 * @param {String} baseUrl
 * @param {String} pub
 * @param {String} secondsSinceEpoch
 */
CrowdNode.http.GetFundsFrom = createApi(
  `/odata/apifundings/GetFundsFrom(address='{1}',fromUnixTime={2})`,
);

/**
 * @param {String} baseUrl
 * @param {String} pub
 * @returns {CrowdNodeBalance}
 */
CrowdNode.http.GetBalance = createApi(
  `/odata/apifundings/GetBalance(address='{1}')`,
);

/**
 * @param {String} baseUrl
 * @param {String} pub
 */
CrowdNode.http.GetMessages = createApi(
  `/odata/apimessages/GetMessages(address='{1}')`,
);

/**
 * @param {String} baseUrl
 * @param {String} pub
 */
CrowdNode.http.IsAddressInUse = createApi(
  `/odata/apiaddresses/IsAddressInUse(address='{1}')`,
);

/**
 * Set Email Address: messagetype=1
 * @param {String} baseUrl
 * @param {String} pub - pay to pubkey base58check address
 * @param {String} email
 * @param {String} signature
 */
CrowdNode.http.SetEmail = createApi(
  `/odata/apimessages/SendMessage(address='{1}',message='{2}',signature='{3}',messagetype=1)`,
);

/**
 * Vote on Governance Objects: messagetype=2
 * @param {String} baseUrl
 * @param {String} pub - pay to pubkey base58check address
 * @param {String} gobject-hash
 * @param {String} choice - Yes|No|Abstain|Delegate|DoNothing
 * @param {String} signature
 */
CrowdNode.http.Vote = createApi(
  `/odata/apimessages/SendMessage(address='{1}',message='{2},{3}',signature={4}',messagetype=2)`,
);

/**
 * Set Referral: messagetype=3
 * @param {String} baseUrl
 * @param {String} pub - pay to pubkey base58check address
 * @param {String} referralId
 * @param {String} signature
 */
CrowdNode.http.SetReferral = createApi(
  `/odata/apimessages/SendMessage(address='{1}',message='{2}',signature='{3}',messagetype=3)`,
);

/**
 * @param {String} tmplUrl
 */
function createApi(tmplUrl) {
  /**
   * @param {Array<String>} arguments - typically just 'pub', unless SendMessage
   */
  return async function () {
    /** @type Array<String> */
    //@ts-ignore - arguments
    let args = [].slice.call(arguments, 0);

    // ex:
    let url = `${CrowdNode._baseUrl}${tmplUrl}`;
    args.forEach(function (arg, i) {
      let n = i + 1;
      url = url.replace(new RegExp(`\\{${n}\\}`, "g"), arg);
    });

    let resp = await request({
      // TODO https://app.crowdnode.io/odata/apifundings/HotWallet
      method: "GET",
      url: url,
      json: true,
    });
    if (!resp.ok) {
      let err = new Error(
        `http error: ${resp.statusCode} ${resp.body.message}`,
      );
      //@ts-ignore
      err.response = resp.toJSON();
      throw err;
    }

    return resp.body;
  };
}

/**
 * @param {String} prefix
 */
function createAddrParser(prefix) {
  /**
   * @param {import('http').IncomingMessage} resp
   */
  return function (resp) {
    //@ts-ignore
    let html = resp.body;
    return parseAddr(prefix, html);
  };
}

/**
 * @param {String} prefix
 * @param {String} html
 */
function parseAddr(prefix, html) {
  // TODO escape prefix
  // TODO restrict to true base58 (not base62)
  let addrRe = new RegExp(prefix + "[^X]+\\b([Xy][a-z0-9]{33})\\b", "i");

  let m = html.match(addrRe);
  if (!m) {
    throw new Error("could not find hotwallet address");
  }

  let hotwallet = m[1];
  return hotwallet;
}

if (require.main === module) {
  (async function main() {
    //@ts-ignore
    await CrowdNode.init({
      //@ts-ignore
      baseUrl: CrowdNode.main.baseUrl,
      insightBaseUrl: "https://insight.dash.org",
    });
    console.info(CrowdNode);
  })().catch(function (err) {
    console.error(err);
  });
}

function toDuff(dash) {
  return Math.round(parseFloat(dash) * DUFFS);
}
