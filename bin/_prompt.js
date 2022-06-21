"use strict";

let Prompt = module.exports;

/**
 * @param {String} query
 * @param {Object} [options]
 * @param {Array<String>} [options.choices]
 * @param {Boolean} [options.mask]
 */
Prompt.prompt = async function (query, options) {
  let Readline = require("readline");

  let completer;
  if (options?.choices) {
    /**
     * @param {String} line
     */
    completer = function (line) {
      let completions = options.choices || [];
      let hits = completions.filter(function (c) {
        return c.startsWith(line);
      });
      if (!hits.length) {
        hits = completions;
      }
      return [hits, line];
    };
  }

  let rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer,
  });

  if (options?.mask) {
    //@ts-ignore
    rl.input.on("keypress", function (_char, _modifiers) {
      // _char = "e"
      // _modifiers = { sequence: 'e', name: 'e', ctrl: false, meta: false, shift: false }
      let len = rl.line.length;
      // place cursor at the beginning of the prompt
      //@ts-ignore
      Readline.moveCursor(rl.output, -len, 0);
      // clear right of the cursor / prompt
      //@ts-ignore
      Readline.clearLine(rl.output, 1);
      // mask with "*"
      //@ts-ignore
      rl.output.write("*".repeat(len));
    });
  }

  let answer = await new Promise(function (resolve) {
    return rl.question(query ?? "", resolve);
  });

  // TODO what if we need control over closing?
  // ex: Promise.race([getPrompt, getFsEvent, getSocketEvent]);
  rl.close();
  return answer;
};
