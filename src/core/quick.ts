/**
 * Ready-to-use functions that powers up your Markdown editor
 *
 * @internal Part of HyperMD core.
 *
 * You shall NOT import this file; please import "core" instead
 */

import CodeMirror from "codemirror"
import { cm_t } from "./type"

/**
 * Initialize an editor from a <textarea>
 * Calling `CodeMirror.fromTextArea` with recommended HyperMD options
 *
 * @see CodeMirror.fromTextArea
 *
 * @param {HTMLTextAreaElement} textArea
 * @param {object} [config]
 * @returns {cm_t}
 */
export function fromTextArea(textArea: HTMLTextAreaElement, config: object): cm_t {
  var final_config: CodeMirror.EditorConfiguration = {
    lineNumbers: true,
    lineWrapping: true,
    theme: "hypermd-light",
    mode: "text/x-hypermd",
    tabSize: 4, // CommonMark specifies tab as 4 spaces

    foldGutter: true,
    gutters: [
      "CodeMirror-linenumbers",
      "CodeMirror-foldgutter",
      "HyperMD-goback"  // (addon: click) 'back' button for footnotes
    ],
    extraKeys: {
      "Enter": "newlineAndIndentContinueMarkdownList"
    },

    hmdInsertFile: {
      byDrop: true,
      byPaste: true
    },

    // (addon) cursor-debounce
    // cheap mouse could make unexpected selection. use this to fix.
    hmdCursorDebounce: true,

    // (addon) hover
    // (dependencies) addon/readlink
    hmdHover: true,

    // (addon) click
    // (dependencies) addon/readlink
    // click to follow links and footnotes
    hmdClick: true,

    // (addon) fold
    // turn images and links into what you want to see
    hmdFold: {
      image: true,
      link: true,
      math: true, // (addon) fold-math
    },

    // (addon) fold-math
    // Tex Formular Rendering. Both `$` and `$$` are supported
    // See src/addon/fold-math.ts, or read the document to learn more
    hmdFoldMath: {
      // renderer: HyperMD.FoldMath.StupidRenderer
    },

    // (addon) paste
    // copy and paste HTML content
    // NOTE: only works when `turndown` is loaded before HyperMD
    hmdPaste: true,

    // (addon) hide-token
    // hide/show Markdown tokens like `**`
    hmdHideToken: true,

    // (addon) mode-loader
    // auto load mode to highlight code blocks
    // by providing a URL prefix, pointing to your CodeMirror
    // - http://cdn.xxxxx.com/codemirror/v4.xx/
    // - ./node_modules/codemirror/              <- relative to webpage's URL
    // using require.js? do it like this :
    hmdLoadModeFrom: "~codemirror/",

    // (addon) table-align
    // adjust table separators' margin, making table columns aligned
    hmdTableAlign: true,
  }

  if (typeof config === 'object') {
    for (var key in config) {
      if (config.hasOwnProperty(key)) {
        final_config[key] = config[key]
      }
    }
  }

  var cm = CodeMirror.fromTextArea(textArea, final_config) as any as cm_t

  return cm
}

/**
 * Turn HyperMD editor into to a normal editor
 *
 * Disable HyperMD visual effects.
 * Interactive addons like click or paste are not affected.
 *
 * @param {cm_t} editor Created by **HyperMD.fromTextArea**
 * @param {string} [theme]
 */
export function switchToNormal(editor: cm_t, theme?: string) {
  editor.setOption('theme', theme || "default")
  editor.setOption('hmdFold', false)  // unfold all folded parts
  editor.setOption('hmdHideToken', false) // stop hiding tokens
  editor.setOption('hmdTableAlign', false)  // stop aligining table columns
}

/**
 * Revert what `HyperMD.switchToNormal` does
 *
 * @param {cm_t} editor Created by **HyperMD.fromTextArea**
 * @param {string} [theme]
 */
export function switchToHyperMD(editor: cm_t, theme: string) {
  editor.setOption('theme', theme || 'hypermd-light')
  editor.setOption('hmdFold', true)
  editor.setOption('hmdHideToken', true)
  editor.setOption('hmdTableAlign', true)
}

