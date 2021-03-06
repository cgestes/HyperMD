import { writeFileSync } from 'fs'
import * as path from 'path'
import buble from 'rollup-plugin-buble'
import typescript from 'rollup-plugin-typescript2'
import { uglify } from 'rollup-plugin-uglify'

const makeComponents = process.argv.includes("--no-components") === false
const watchMode = process.argv.includes("-w")
const makeAi1 = process.argv.includes("--with-ai1") || !watchMode

const srcDir = path.join(__dirname, "src")

const banner = `
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
`.trim()

/**
 * an alternative to `path.relative`
 * 0. works well on Windows
 * 1. never use backslash \
 * 2. return "./" if empty
 * 3. always ends with "/"
 */
function relativePath(srcdir, dstdir) {
  // NodeJS maybe have bugs on Windows, with drive letters
  // substr() is a workaround
  // https://github.com/nodejs/node/issues/17413
  if (/win/i.test(process.platform) && /^[a-zA-Z]\:/.test(srcdir)) {
    srcdir = srcdir.substr(3)
    dstdir = dstdir.substr(3)
  }

  var reldir = path.relative(srcdir, dstdir)
  if (!reldir) reldir = "./"
  else reldir = reldir.replace(/\\/g, '/') + "/"

  return reldir
}

/** HyperMD components */
const components = {
  "mode/hypermd": null, // exported nothing
  "addon/insert-file": "InsertFile",
  "addon/read-link": "ReadLink",
  "addon/hover": "Hover",
  "addon/click": "Click",
  "addon/paste": "Paste",
  "addon/fold": "Fold",
  "addon/fold-math": "FoldMath",
  "addon/table-align": "TableAlign",
  "addon/mode-loader": "ModeLoader",
  "addon/hide-token": "HideToken",
  "addon/cursor-debounce": "CursorDebounce",
}

/** Third-party libs */
var globalNamesReal = {
  codemirror: "CodeMirror",
  marked: "marked",
  mathjax: "MathJax", // not always avaliable though
  hypermd: "HyperMD",
  HyperMD: "HyperMD",
}

var globalNames = new Proxy(globalNamesReal, {
  get(target, name) {
    var ans = globalNamesReal[name]
    if (!ans) {
      if (!/node_modules/.test(name) && path.isAbsolute(name)) {
        // Are you trying to import "HyperMD.XXX" ?
        var moduleDir = path.dirname(name)
        var moduleName = path.basename(name)

        var moduleExpr = relativePath(srcDir, moduleDir) + moduleName
        var HyperMDAlias = components[moduleExpr]

        if (HyperMDAlias) ans = "HyperMD." + HyperMDAlias
        else if (/\/core$/.test(moduleExpr)) ans = "HyperMD"
        else console.log(
          "[WARN] " + name + " is not exported to global HyperMD namespace.\n" +
          "       which shall be defined in rollup.config.js, 'HyperMD components' part"
        )
      }
    }
    return ans
  }
})

const external_tester = id_or_FilePath => {
  return id_or_FilePath in globalNames || !/^[\.\/]|^\w\:|\.ts$/.test(id_or_FilePath)
}

/**
 * rollup.js messes up the module path.
 * here we do it right.
 *
 * @param {string} sourcePath importer file fullPath
 * @param {string} id         importee file fullPath
 * @returns {string} relative path that works in output code
 */
const fix_core_path_in_single_file = function (sourcePath, id) {
  if (!path.isAbsolute(id)) return id // external libs

  var srcdir = path.dirname(sourcePath)
  var dstdir = path.dirname(id)
  var reldir = relativePath(srcdir, dstdir)

  var tmp = reldir + path.basename(id)

  if (/core\//.test(tmp)) {
    // core.ts exports everything of core/*.ts
    // so all you need is just importing one `core`
    console.log("[WARN] You shall import 'core' instead of 'core/*' in " + sourcePath)
    tmp = tmp.replace(/core\/.+$/, 'core')
  }

  return tmp
}

const the_plugins = [
  typescript(),
  buble({
    namedFunctionExpressions: false,
    transforms: {
      dangerousForOf: true,   // simplify `for (let i=0;i...)` to `for (let it of arr)`
    }
  })
]

var configs = [
  // Core
  {
    input: "./src/core.ts",
    external: external_tester,
    output: {
      file: './core.js',
      format: 'umd',
      name: "HyperMD",
      globals: globalNames,
      banner,
    },
    plugins: the_plugins
  },
]

var ai1_imports = []
var ai1_exports = []

// compile every addon

for (const id in components) {
  const inputFullPath = path.resolve("./src/" + id + ".ts")
  var configItem = {
    input: "./src/" + id + ".ts",
    external: req_id => (req_id.indexOf(id) === -1),  // everything is external except itself!
    output: {
      file: "./" + id + ".js",
      format: "umd",
      paths: fix_core_path_in_single_file,
      globals: globalNames,
      paths: id => fix_core_path_in_single_file(inputFullPath, id),
      banner,
    },
    plugins: the_plugins
  }

  const export_as = components[id]
  if (export_as) {
    configItem.output.name = "HyperMD." + export_as
    ai1_exports.push(export_as)
    ai1_imports.push(`import * as ${export_as} from "./${id}"`)
  } else {
    ai1_imports.push(`import "./${id}"`)
  }

  if (makeComponents) configs.push(configItem)
}

// generate all-in-one bundle file

writeFileSync("./src/ai1.ts", `// All in one HyperMD bundle!
//
// **DO NOT EDIT!** This file is generated by rollup.config.js
//

export * from "./core"

${ai1_imports.join("\n")}

${ai1_exports.length ? ("export { " + ai1_exports.join(", ") + " }") : ("// No more exports")}
`)

// if not watch mode, build the all-in-one bundle

if (makeAi1) {
  var the_plugins2 = the_plugins.slice()
  the_plugins2.splice(1, 0, uglify({
    output: {
      comments: /^!/,
    },
  }))
  configs.push({
    input: "./src/ai1.ts",
    external: external_tester,
    output: {
      file: './lib/hypermd_ai1.js',
      format: 'umd',
      name: "HyperMD",
      globals: globalNames,
      banner,
    },
    plugins: the_plugins2
  })
}

export default configs
