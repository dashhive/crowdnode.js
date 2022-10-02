(function (exports) {
  "use strict";

  let baseUrl = "https://insight.dash.org";

  async function main() {
    let CrowdNode = exports.CrowdNode || require("crowdnode");

    //@ts-ignore
    await CrowdNode.init({
      //@ts-ignore
      baseUrl: CrowdNode.main.baseUrl,
      insightBaseUrl: baseUrl,
    });
    console.info(CrowdNode);
  }

  main().catch(function (err) {
    console.error(err);
  });
})(("undefined" !== typeof module && module.exports) || window);
