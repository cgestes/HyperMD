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
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('codemirror'), require('../core')) :
  typeof define === 'function' && define.amd ? define(['exports', 'codemirror', '../core'], factory) :
  (factory((global.HyperMD = global.HyperMD || {}, global.HyperMD.TableAlign = {}),global.CodeMirror,global.HyperMD));
}(this, (function (exports,CodeMirror,core) { 'use strict';

  CodeMirror = CodeMirror && CodeMirror.hasOwnProperty('default') ? CodeMirror['default'] : CodeMirror;

  // HyperMD, copyright (c) by laobubu
  var defaultOption = {
      enabled: false
  };
  var OptionName = "hmdTableAlign";
  CodeMirror.defineOption(OptionName, defaultOption, function (cm, newVal) {
      var enabled = !!newVal;
      if (!enabled || typeof newVal === "boolean") {
          newVal = { enabled: enabled };
      }
      var newCfg = core.Addon.migrateOption(newVal, defaultOption);
      ///// apply config
      var inst = getAddon(cm);
      inst.ff_enable.setBool(newCfg.enabled);
      ///// write new values into cm
      for (var k in defaultOption)
          { inst[k] = newCfg[k]; }
  });
  //#endregion
  /********************************************************************************** */
  //#region Addon Class
  var AddonAlias = "tableAlign";
  var TableAlign = function(cm) {
      var this$1 = this;

      this.cm = cm;
      this.styleEl = document.createElement("style");
      /**
       * Remeasure visible columns, update CSS style to make columns aligned
       *
       * (This is a debounced function)
       */
      this.updateStyle = core.debounce(function () {
          if (!this$1.enabled)
              { return; }
          var cm = this$1.cm;
          var measures = this$1.measure();
          var css = this$1.makeCSS(measures);
          if (css === this$1._lastCSS)
              { return; }
          this$1.styleEl.textContent = this$1._lastCSS = css;
          setTimeout(function () { return core.updateCursorDisplay(cm); }, 50);
      }, 100);
      /** CodeMirror renderLine event handler */
      this._procLine = function (cm, line, el) {
          if (!el.querySelector('.cm-hmd-table-sep'))
              { return; }
          var lineSpan = el.firstElementChild;
          var lineSpanChildren = Array.prototype.slice.call(lineSpan.childNodes, 0);
          var columnIdx = 0;
          var columnSpan = this$1.makeColumn(columnIdx);
          var columnContentSpan = columnSpan.firstElementChild;
          for (var i = 0, list = lineSpanChildren; i < list.length; i += 1) {
              var el$1 = list[i];

              if (el$1.nodeType === Node.ELEMENT_NODE && /cm-hmd-table-sep/.test(el$1.className)) {
                  // found a "|", and a column is finished
                  columnIdx++;
                  columnSpan.appendChild(columnContentSpan);
                  lineSpan.appendChild(columnSpan);
                  lineSpan.appendChild(el$1);
                  columnSpan = this$1.makeColumn(columnIdx);
                  columnContentSpan = columnSpan.firstElementChild;
              }
              else {
                  columnContentSpan.appendChild(el$1);
              }
          }
          columnSpan.appendChild(columnContentSpan);
          lineSpan.appendChild(columnSpan);
      };
      this.ff_enable = new core.FlipFlop(
      /* ON  */ function () {
          cm.on("renderLine", this$1._procLine);
          cm.on("update", this$1.updateStyle);
          cm.refresh();
          document.head.appendChild(this$1.styleEl);
      }, 
      /* OFF */ function () {
          cm.off("renderLine", this$1._procLine);
          cm.off("update", this$1.updateStyle);
          document.head.removeChild(this$1.styleEl);
      });
  };
  /**
   * create a <span> container as column,
   * note that put content into column.firstElementChild
   */
  TableAlign.prototype.makeColumn = function (index) {
      var span = document.createElement("span");
      span.className = "hmd-table-column hmd-table-column-" + index;
      span.setAttribute("data-column", "" + index);
      var span2 = document.createElement("span");
      span2.className = "hmd-table-column-content";
      span2.setAttribute("data-column", "" + index);
      span.appendChild(span2);
      return span;
  };
  /** Measure all visible tables and columns */
  TableAlign.prototype.measure = function () {
      var cm = this.cm;
      var lineDiv = cm.display.lineDiv; // contains every <pre> line
      var contentSpans = lineDiv.querySelectorAll(".hmd-table-column-content");
      /** every table's every column's width in px */
      var ans = {};
      for (var i = 0; i < contentSpans.length; i++) {
          var contentSpan = contentSpans[i];
          var column = contentSpan.parentElement;
          var line = column.parentElement.parentElement;
          var tableID = line.className.match(/HyperMD-table_(\S+)/)[1];
          var columnIdx = ~~column.getAttribute("data-column");
          var width = contentSpan.offsetWidth + 1; // +1 because browsers turn 311.3 into 312
          if (!(tableID in ans))
              { ans[tableID] = []; }
          var columnWidths = ans[tableID];
          while (columnWidths.length <= columnIdx)
              { columnWidths.push(0); }
          if (columnWidths[columnIdx] < width)
              { columnWidths[columnIdx] = width; }
      }
      return ans;
  };
  /** Generate CSS */
  TableAlign.prototype.makeCSS = function (measures) {
      var rules = [];
      for (var tableID in measures) {
          var columnWidths = measures[tableID];
          var rulePrefix = "pre.HyperMD-table-row.HyperMD-table_" + tableID + " .hmd-table-column-";
          for (var columnIdx = 0; columnIdx < columnWidths.length; columnIdx++) {
              var width = columnWidths[columnIdx];
              rules.push(("" + rulePrefix + columnIdx + " { min-width: " + width + "px }"));
          }
      }
      return rules.join("\n");
  };
  //#endregion
  /** ADDON GETTER (Singleton Pattern): a editor can have only one MyAddon instance */
  var getAddon = core.Addon.Getter(AddonAlias, TableAlign, defaultOption);

  exports.defaultOption = defaultOption;
  exports.TableAlign = TableAlign;
  exports.getAddon = getAddon;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
