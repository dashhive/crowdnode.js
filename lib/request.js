"use strict";

//@ts-ignore
let pkg = require("../package.json");

// provide a standards-compliant user-agent
module.exports = require("@root/request").defaults({
  userAgent: `${pkg.name}/${pkg.version}`,
});
