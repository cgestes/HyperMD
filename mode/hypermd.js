/*!
 * HyperMD, copyright (c) by laobubu
 * Distributed under an MIT license: http://laobubu.net/HyperMD/LICENSE
 *
 * Break the Wall between writing and preview, in a Markdown Editor.
 *
 * HyperMD makes Markdown editor on web WYSIWYG, based on CodeMirror
 *
 * Homepage: http://laobubu.net/HyperMD/
 * Issues: https://github.com/laobubu/HyperMD/issues
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('codemirror'), require('codemirror/mode/markdown/markdown'), require('codemirror/addon/mode/overlay')) :
  typeof define === 'function' && define.amd ? define(['codemirror', 'codemirror/mode/markdown/markdown', 'codemirror/addon/mode/overlay'], factory) :
  (factory(global.CodeMirror));
}(this, (function (CodeMirror) { 'use strict';

  CodeMirror = CodeMirror && CodeMirror.hasOwnProperty('default') ? CodeMirror['default'] : CodeMirror;

  // CodeMirror, copyright (c) by laobubu
  var possibleTokenChars = "`\\[]()<>_*~$|^@:!#+\""; // chars that could form a token (like "**" or "`")
  var meanlessCharsRE = new RegExp("^[^\\" + possibleTokenChars.split("").join("\\") + "\\s]+"); // RegExp that match one or more meanless chars
  var listRE = /^\s*(?:[*\-+]|[0-9]+([.)]))\s+/; // this regex is from CodeMirror's sourcecode
  var tableTitleSepRE = /^\s*\|?(?:\s*\:?\s*\-+\s*\:?\s*\|)*\s*\:?\s*\-+\s*\:?\s*\|?\s*$/; // find  |:-----:|:-----:| line
  var urlRE = /^((?:(?:aaas?|about|acap|adiumxtra|af[ps]|aim|apt|attachment|aw|beshare|bitcoin|bolo|callto|cap|chrome(?:-extension)?|cid|coap|com-eventbrite-attendee|content|crid|cvs|data|dav|dict|dlna-(?:playcontainer|playsingle)|dns|doi|dtn|dvb|ed2k|facetime|feed|file|finger|fish|ftp|geo|gg|git|gizmoproject|go|gopher|gtalk|h323|hcp|https?|iax|icap|icon|im|imap|info|ipn|ipp|irc[6s]?|iris(?:\.beep|\.lwz|\.xpc|\.xpcs)?|itms|jar|javascript|jms|keyparc|lastfm|ldaps?|magnet|mailto|maps|market|message|mid|mms|ms-help|msnim|msrps?|mtqp|mumble|mupdate|mvn|news|nfs|nih?|nntp|notes|oid|opaquelocktoken|palm|paparazzi|platform|pop|pres|proxy|psyc|query|res(?:ource)?|rmi|rsync|rtmp|rtsp|secondlife|service|session|sftp|sgn|shttp|sieve|sips?|skype|sm[bs]|snmp|soap\.beeps?|soldat|spotify|ssh|steam|svn|tag|teamspeak|tel(?:net)?|tftp|things|thismessage|tip|tn3270|tv|udp|unreal|urn|ut2004|vemmi|ventrilo|view-source|webcal|wss?|wtai|wyciwyg|xcon(?:-userid)?|xfire|xmlrpc\.beeps?|xmpp|xri|ymsgr|z39\.50[rs]?):(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]|\([^\s()<>]*\))+(?:\([^\s()<>]*\)|[^\s`*!()\[\]{};:'".,<>?«»“”‘’]))/i; // from CodeMirror/mode/gfm
  var url2RE = /^\.{0,2}\/[^\>\s]+/;
  /** these styles only need 1 bit to record the status */
  var nstyleStandalone = [
      1 /* DEL */,
      2 /* EM */,
      4 /* STRONG */,
      8 ];
  /** style strings */
  var HMDStyles = {};
  HMDStyles[8 /* ESCAPE */] = "hmd-escape ";
  HMDStyles[256 /* LINK */] = "hmd-link ";
  HMDStyles[512 /* LINK_URL */] = "hmd-link-url ";
  HMDStyles[768 /* LINK_URL_S */] = "hmd-link-url hmd-link-url-s ";
  HMDStyles[1024 /* BARELINK */] = "hmd-barelink ";
  HMDStyles[1280 /* FOOTREF */] = "hmd-barelink hmd-footref ";
  HMDStyles[1536 /* FOOTREF_BEGIN */] = "hmd-barelink hmd-footref hmd-footref-lead ";
  HMDStyles[1792 /* FOOTNOTE_NAME */] = "hmd-footnote line-HyperMD-footnote ";
  HMDStyles[2048 /* FOOTNOTE_URL */] = "hmd-footnote-url ";
  HMDStyles[2304 /* URL_A */] = "url ";
  CodeMirror.defineMode("hypermd", function (config, modeConfig) {
      function startState() {
          return {
              atBeginning: true,
              quoteLevel: 0,
              nstyle: 0,
              table: null,
              tableCol: 0,
              tableRow: 0,
              inside: 0 /* nothing */,
              listSpaceStack: [],
              // NOTICE: listSpaceStack[0] could be 0, (eg. ordered list, or " - "'s leading space is missing)
              //         if meet the situation, do not return any token, otherwise CodeMirror would crash
              prevLineIsEmpty: false,
              extra: null,
          };
      }
      var hypermdOverlay = {
          startState: startState,
          copyState: function(s) {
              return {
                  // structure of `s` is defined in startState; do a deep copy for it
                  atBeginning: s.atBeginning,
                  quoteLevel: s.quoteLevel,
                  nstyle: s.nstyle,
                  table: s.table,
                  tableCol: s.tableCol,
                  tableRow: s.tableRow,
                  inside: s.inside,
                  listSpaceStack: s.listSpaceStack && s.listSpaceStack.slice(),
                  prevLineIsEmpty: s.prevLineIsEmpty,
                  extra: s.extra
              };
          },
          blankLine: function(s) {
              s.atBeginning = true;
              s.prevLineIsEmpty = true;
              s.quoteLevel = 0;
              s.listSpaceStack = [];
              s.table = null;
              s.tableCol = 0;
              s.tableRow = 0;
              s.nstyle = 0;
              if (s.inside === 3 /* codeFence */)
                  { return "line-HyperMD-codeblock line-background-HyperMD-codeblock-bg"; }
              return null;
          },
          token: function(stream, state) {
              state.combineTokens = null;
              var start = stream.pos;
              var tmp;
              switch (state.inside) {
                  case 1 /* math */:
                      if ((start === 0 || stream.string.charAt(start - 1) !== "\\") &&
                          stream.match(state.extra)) {
                          state.inside = 0 /* nothing */;
                          return "formatting formatting-math formatting-math-end math math-" + state.extra.length;
                      }
                      if (!stream.match(/^(?:[^\$\\]+|\\.)+/))
                          { stream.next(); } // skip chars that can't be "$" or "$$"
                      return "math math-" + state.extra.length;
                  case 3 /* codeFence */:
                      state.combineTokens = true;
                      if (start === 0 && stream.match(/^```\s*$/)) {
                          // reach the end of CodeFence
                          state.inside = 0 /* nothing */;
                          return "line-HyperMD-codeblock line-background-HyperMD-codeblock-bg line-HyperMD-codeblock-end";
                      }
                      stream.skipToEnd();
                      return "line-HyperMD-codeblock line-background-HyperMD-codeblock-bg";
              }
              //////////////////////////////////////////////////////////////////
              /// start process one raw line
              if (start === 0) {
                  // Now we are at the beginning of current line
                  state.atBeginning = true;
                  if (state.table) {
                      state.tableCol = 0;
                      state.tableRow++;
                      if (state.tableRow === 1 && tableTitleSepRE.test(stream.string)) {
                          // this line is  |:-----:|:-----:|
                          // HyperMD must handle it, otherwise CodeMirror will treat `:---:` as emoji
                          state.inside = 4 /* tableTitleSep */;
                      }
                      else {
                          state.inside = null;
                      }
                  }
                  var indentation = stream.indentation();
                  /**
                   * ```c++
                   * ^we are here (if !insideCodeFence)
                   *
                   * ```
                   * ^or here (if insideCodeFence)
                   */
                  if (stream.match(/^```/)) { // toggle state for codefence
                      state.combineTokens = true;
                      state.inside = 3 /* codeFence */;
                      return "line-HyperMD-codeblock line-background-HyperMD-codeblock-bg line-HyperMD-codeblock-begin";
                  }
                  //FIXME: tranditional code block is buggy and shall be deprecated!
                  /**
                   * this is a tranditional code block
                   *
                   *     #include <stdio.h>
                   * ^we are here and we can see lots of space
                   *
                   * note that we can't detect the program's language, so, no need to set `state.combineTokens = true`
                   */
                  if (state.listSpaceStack.length === 0 && indentation >= 4) {
                      stream.skipToEnd();
                      return "line-HyperMD-codeblock line-background-HyperMD-codeblock-indented-bg";
                  }
                  /**
                   * StdHeader
                   * -----------
                   * ^we are here
                   *
                   * Note: since we can't go back and modify header title text's style
                   *       the only remedy is writing some CSS rules, targeting .hmd-stdheader-line
                   */
                  if (/^(?:-{3,}|={3,})$/.test(stream.string) && !state.prevLineIsEmpty) {
                      var _hlevel = ((stream.string.charAt(0) == '=') ? 1 : 2);
                      stream.skipToEnd();
                      return 'formatting line-HyperMD-header-line line-HyperMD-header-line-' + _hlevel;
                  }
                  // since now prevLineIsEmpty is useless
                  // this is not blankLine function, so this line is not empty. mark it for the next line
                  state.prevLineIsEmpty = false;
                  /**
                   * > > blockquote! we are at the beginning !
                   * ^we are here
                   *
                   * When a style is prefixed by "line-" , CodeMirror will call addLineClass
                   */
                  if (stream.match(/^\>\s*/)) {
                      var quoteLevel = 1;
                      while (stream.match(/^\s*\>\s*/))
                          { quoteLevel++; }
                      state.quoteLevel = quoteLevel;
                      return ("formatting formatting-quote formatting-quote-" + quoteLevel +
                          " quote quote-" + quoteLevel +
                          " line-HyperMD-quote line-HyperMD-quote-" + quoteLevel);
                  }
                  else if (state.quoteLevel) {
                      /**
                       * > block support such
                       *   syntax
                       * ^ we are here.
                       *
                       */
                      stream.next();
                      state.combineTokens = true;
                      return "line-HyperMD-quote line-HyperMD-quote-" + state.quoteLevel;
                  }
                  /**
                   * ## Header
                   * ^we are here
                   *
                   */
                  if (stream.match(/^(#+)(?:\s|$)/)) {
                      state.combineTokens = true;
                      return "line-HyperMD-header line-HyperMD-header-" + stream.string.match(/^#+/)[0].length;
                  }
                  /**
                   * this is a list
                   *
                   * Note: list checking must be the last step of `if (start === 0) { ... }` ; it doesn't jump out this function
                   */
                  if (state.listSpaceStack.length !== 0 || stream.match(listRE, false)) {
                      // rebuild state.listSpaceStack
                      var zero_leading = state.listSpaceStack[0] === 0;
                      for (var i = zero_leading ? 1 : 0; i < state.listSpaceStack.length; i++) {
                          if (indentation > 0)
                              { indentation -= state.listSpaceStack[i]; }
                          else {
                              state.listSpaceStack.splice(i);
                              break;
                          }
                      }
                      if (indentation > 0) {
                          // new nested level
                          state.listSpaceStack.push(indentation);
                      }
                      // for situations like ordered list whose beginning char is not a space
                      if (state.listSpaceStack.length === 0) {
                          state.listSpaceStack.push(0);
                      }
                      // finished listSpaceStack, now we shall get into it and treat every indent(spaces) as a token
                      state.inside = 2 /* listSpace */;
                      state.extra = 0;
                  }
              }
              // following `if (state.listSpaceStack.length !== 0 || stream.match(listRE, false))` 's status
              if (state.inside === 2 /* listSpace */) {
                  var listLevel = state.listSpaceStack.length;
                  var firstMet = state.extra === 0;
                  var ans = "";
                  if (firstMet && state.listSpaceStack[0] === 0) {
                      if (listLevel === 1) {
                          // oops, this is level-1 list without indentation!
                          // do some dirty job to add HyperMD styles
                          state.inside = null;
                          state.extra = null;
                          state.combineTokens = true;
                          if (!stream.match(listRE))
                              { stream.next(); }
                          return "line-HyperMD-list-line line-HyperMD-list-line-1";
                      }
                      // skip this virtual token. see listSpaceStack's comment above
                      state.extra++;
                      ans += "hmd-list-indent-virtual ";
                  }
                  var indent_to_eat = state.listSpaceStack[state.extra];
                  var corrupted = false;
                  while (indent_to_eat > 0) {
                      var next_ch = stream.next();
                      if (next_ch === "\t")
                          { indent_to_eat -= 4; }
                      else if (next_ch === " ")
                          { indent_to_eat -= 1; }
                      else {
                          // FIXME: User made a corrupted indent. How to solve?
                          state.inside = null;
                          state.extra = null;
                          corrupted = true;
                          break;
                      }
                  }
                  //FIXME: deal with indent_to_eat < 0
                  ans += "hmd-list-indent hmd-list-indent-" + (state.extra + 1);
                  if (firstMet)
                      { ans += " line-HyperMD-list-line line-HyperMD-list-line-" + listLevel; }
                  if (corrupted)
                      { ans += " hmd-list-indent-corrupted"; }
                  if (++state.extra >= listLevel) {
                      // this is the last indenting space, going to exit "listSpace" status
                      state.inside = null;
                      state.extra = null;
                  }
                  state.combineTokens = true;
                  return ans;
              }
              //////////////////////////////////////////////////////////////////
              /// now list bullets and quote indents are gone. Enter the content.
              var atBeginning = state.atBeginning; // whether is at beginning (ignoreing `#`, `>` and list bullets)
              if (atBeginning && /\S/.test(stream.peek()))
                  { state.atBeginning = false; }
              // then just normal inline stuffs
              // usually we just add some extra styles to CodeMirror's result
              state.combineTokens = true;
              switch (state.inside) {
                  case 4 /* tableTitleSep */:
                      /// tableTitleSep line doesn't need any styling
                      state.combineTokens = false;
                      var ans = "";
                      if (stream.match(/^(?:\:\s*)?-+(?:\s*\:)?/)) {
                          ans += "hmd-table-title-dash line-HyperMD-table-row line-HyperMD-table-rowsep ";
                      }
                      else if (stream.eat("|")) {
                          if (state.tableCol === 0) {
                              ans += "line-HyperMD-table_" + state.table + " ";
                              ans += "line-HyperMD-table-row line-HyperMD-table-row-" + state.tableRow + " ";
                          }
                          ans += "hmd-table-sep hmd-table-sep-" + state.tableCol;
                          state.tableCol++;
                      }
                      else {
                          stream.eatWhile(/^[^\|\-\:]+/) || stream.next();
                      }
                      return ans;
              }
              /// inline code
              if (stream.match(/^`[^`]*`?/)) {
                  return null; // inline code are ignored by hypermd
              }
              /// inline math
              tmp = stream.match(/^\${1,2}/);
              if (tmp && (tmp[0] === '$$' || // `$$` may span lines
                  /[^\\]\$/.test(stream.string.substr(start + 1)) // `$` can't. there must be another `$` after current one
              )) {
                  state.inside = 1 /* math */;
                  state.extra = tmp[0];
                  state.combineTokens = false;
                  return "formatting formatting-math formatting-math-begin math math-" + state.extra.length; // inline code are ignored by hypermd
              }
              ////////////////////////////////////////////////////////////////////////////////////////
              /// possible table
              /// NOTE: only the pipe chars whose nstyle === 0 can construct a table
              ///       no need to worry about nstyle stuff
              var canMakeTable = state.nstyle === 0 && !state.listSpaceStack.length && !state.inside;
              if (canMakeTable && stream.eat('|')) {
                  var ans = "";
                  if (!state.table) {
                      if (!/^\s*\|/.test(stream.string) && !tableTitleSepRE.test(stream.lookAhead(1))) {
                          // a leading pipe char (|) or an extra |:-----:|:-----:| line
                          // is required, but not found, thus we can't establish a table
                          return null;
                      }
                      // this is a new table!
                      state.table = "T" + stream.lineOracle.line;
                      state.tableRow = 0;
                      ans += "line-HyperMD-table-title ";
                      if (tableTitleSepRE.test(stream.lookAhead(1))) {
                          // a |:-----:|:----:| line exists
                          ans += "line-HyperMD-table-title-has_rowsep ";
                      }
                  }
                  if (state.tableCol === 0) {
                      ans += "line-HyperMD-table_" + state.table + " ";
                      ans += "line-HyperMD-table-row line-HyperMD-table-row-" + state.tableRow + " ";
                  }
                  ans += "hmd-table-sep hmd-table-sep-" + state.tableCol + " ";
                  state.tableCol++;
                  return ans;
              }
              ///////////////////////////////////////////////////////////////////
              // now process mixable (non-exclusive) styles
              var nstyle = state.nstyle;
              var ns_link = nstyle & 65280 /* _link_mask */;
              var ans = "";
              // initialize style string by `nstyle`
              for (var i$1 = 0, list = nstyleStandalone; i$1 < list.length; i$1 += 1)
                  {
                  var s = list[i$1];

                  if (nstyle & s)
                      { ans += HMDStyles[s] || "";
              } }
              if (ns_link)
                  { ans += HMDStyles[ns_link] || ""; }
              ///////////////////////////////////////////////////////////////////
              // Update nstyle if needed
              //
              // NOTE:
              // 0. when activating a nstyle (usually `state.nstyle |= xxx`),
              //    do not forget `ans += HMDStyles[xxx]`
              // 1. once nstyle changes, no matter activating or de-activating,
              //    you MUST `return ans` immediately!
              { /// LINK related
                  var new_ns_link = null;
                  if (ns_link === 0) {
                      // try to find a beginning
                      if (stream.match(/^\[((?:[^\]\\\`]|\\.|\`[^\`]*\`)+)\]/, false)) {
                          // found! now decide `ns_link`
                          stream.next();
                          if (atBeginning && stream.match(/^(?:[^\]]+)\]\:/, false)) {
                              // found a beginning of footnote
                              new_ns_link = 1792 /* FOOTNOTE_NAME */;
                          }
                          else if (stream.match(/^(?:[^\]]+)\](?:[^\[\(]|$)/, false)) {
                              // find a bare link
                              if (stream.peek() === '^') {
                                  // a [bare link] could be a [^footref]
                                  new_ns_link = 1536 /* FOOTREF_BEGIN */;
                              }
                              else {
                                  new_ns_link = 1024 /* BARELINK */;
                              }
                          }
                          else {
                              // find a normal link text
                              new_ns_link = 256 /* LINK */;
                          }
                      }
                      else if (tmp = stream.match(/^\<([^\>]+)\>/, false)) {
                          if (urlRE.test(tmp[1]) || url2RE.test(tmp[1])) {
                              // found <http://laobubu.github.io/> or <./xxx.html>
                              stream.next(); // eat "<"
                              ans += "formatting formatting-url ";
                              new_ns_link = 2304 /* URL_A */;
                          }
                      }
                      if (new_ns_link !== null) {
                          // apply changes and prevent further HyperMD parsing work
                          state.nstyle |= new_ns_link;
                          ans += HMDStyles[new_ns_link];
                          return ans;
                      }
                  }
                  else {
                      // current is inside a link. check if we shall change status
                      // making any change to `ns_link` will prevent further HyperMD parsing work
                      switch (ns_link) {
                          case 1536 /* FOOTREF_BEGIN */:
                              // caught the "^"
                              new_ns_link = 1280 /* FOOTREF */;
                              stream.next();
                              break;
                          case 1280 /* FOOTREF */:
                          case 1024 /* BARELINK */:
                              if (stream.eat(']'))
                                  { new_ns_link = 0; }
                              break;
                          case 1792 /* FOOTNOTE_NAME */:
                              if (stream.match(']:')) {
                                  new_ns_link = 0;
                                  var mat = stream.match(/^\s*(\S+)/, false);
                                  if (mat && (urlRE.test(mat[1]) || url2RE.test(mat[1])))
                                      { new_ns_link = 2048 /* FOOTNOTE_URL */; }
                              }
                              break;
                          case 2048 /* FOOTNOTE_URL */:
                              stream.match(/^\s*\S+/) || stream.next();
                              new_ns_link = 0;
                              break;
                          case 256 /* LINK */:
                              // entering LINK_URL status because the next char must be ( or [
                              if (stream.eat(']')) {
                                  if (stream.peek() === '[')
                                      { new_ns_link = 768 /* LINK_URL_S */; }
                                  else
                                      { new_ns_link = 512 /* LINK_URL */; }
                              }
                              break;
                          case 512 /* LINK_URL */:
                          case 768 /* LINK_URL_S */:
                              var rightParentheses = (ns_link === 768 /* LINK_URL_S */) ? ']' : ')';
                              if (stream.match(/^"(?:[^"\\]|\\.)*"/)) {
                                  // skip quoted stuff (could contains parentheses )
                                  // note: escaped char is handled in `ESCAPE related` part
                                  return ans; // URL part doesnot need further styling
                              }
                              else if (stream.eat(rightParentheses)) {
                                  // find the tail
                                  new_ns_link = 0;
                              }
                              else {
                                  // just skip meanless chars
                                  if (!stream.match(/^[^\]\)\\]+|^\\./))
                                      { stream.next(); }
                                  return ans; // URL part doesnot need further styling
                              }
                              break;
                          case 2304 /* URL_A */:
                              if (stream.eat(">")) {
                                  // find the tail
                                  ans += "formatting formatting-url ";
                                  new_ns_link = 0;
                              }
                              else {
                                  stream.match(urlRE) || stream.match(url2RE) || stream.next();
                                  return ans; // URL part doesnot need further styling
                              }
                              break;
                      }
                      if (new_ns_link !== null) {
                          // apply changes and prevent further HyperMD parsing work
                          state.nstyle = state.nstyle & ~65280 /* _link_mask */ | new_ns_link;
                          return ans;
                      }
                  }
              }
              { /// ESCAPE related
                  if (nstyle & 8 /* ESCAPE */) {
                      stream.next();
                      state.nstyle -= 8 /* ESCAPE */;
                      return ans;
                  }
                  /// entering escape?
                  if (stream.match(/^\\(?=.)/)) {
                      // found the backslash
                      state.nstyle |= 8 /* ESCAPE */;
                      ans += HMDStyles[8 /* ESCAPE */];
                      ans += "hmd-escape-backslash ";
                      return ans;
                  }
              }
              if ((state.nstyle & 255 /* _style_mask */) !== 0 || !/\w/.test(stream.string.charAt(stream.pos - 1))) {
                  /// DEL, EM, STRONG etc. simple styles
                  // since these styles are not coverd by HMDStyles,
                  // we can do it simplier: change nstyle and return immediatly
                  if (stream.match("**")) {
                      state.nstyle ^= 4 /* STRONG */;
                      return ans;
                  }
                  if (stream.match("__")) {
                      state.nstyle ^= 4 /* STRONG */;
                      return ans;
                  }
                  if (stream.eat("*")) {
                      state.nstyle ^= 2 /* EM */;
                      return ans;
                  }
                  if (stream.eat("_")) {
                      state.nstyle ^= 2 /* EM */;
                      return ans;
                  }
                  if (stream.match("~~")) {
                      state.nstyle ^= 1 /* DEL */;
                      return ans;
                  }
              }
              ///////////////////////////////////////////////////////////////////
              // Finally, if nothing changed, move on
              if (stream.match(urlRE))
                  { ans += "url "; }
              else if (!stream.match(meanlessCharsRE))
                  { stream.next(); }
              return (ans.length !== 0 ? ans : null);
          }
      };
      var markdownConfig = {
          name: "markdown",
          highlightFormatting: true,
          taskLists: true,
          strikethrough: true,
          emoji: true,
          tokenTypeOverrides: {
              hr: "line-HyperMD-hr hr",
              // HyperMD needs to know the level of header/indent. using tokenTypeOverrides is not enough
              // header: "line-HyperMD-header header",
              // quote: "line-HyperMD-quote quote",
              list1: "list-1",
              list2: "list-2",
              list3: "list-3",
              code: "inline-code",
              gitHubSpice: false
          },
      };
      for (var attr in modeConfig) {
          markdownConfig[attr] = modeConfig[attr];
      }
      markdownConfig["name"] = "markdown"; // must be this
      var finalMode = CodeMirror.overlayMode(CodeMirror.getMode(config, markdownConfig), hypermdOverlay);
      // // now deal with indent method
      // var baseIndent = finalMode.indent;
      // finalMode.indent = function (state, textAfter) {
      //   console.log("INDENT", arguments)
      //   return baseIndent ? baseIndent(state, textAfter) : CodeMirror.Pass
      // }
      return finalMode;
  }, "markdown");
  CodeMirror.defineMIME("text/x-hypermd", "hypermd");

})));
