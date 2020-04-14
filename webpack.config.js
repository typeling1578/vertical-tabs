/* global __dirname:true */
/* global module:true */

const path = require("path");

const CopyPlugin = require("copy-webpack-plugin");
const cssnano = require("cssnano")({ preset: "default" });
const postcss = require("postcss");

module.exports = (env, argv) => {
  return {
    entry: {
      background: "./src/background/background.js",
      sidebar: "./src/sidebar/sidebar.js",
      options: "./src/options/options.js",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name]/[name].js",
    },
    plugins: [
      new CopyPlugin([
        {
          from: "node_modules/photon-colors/photon-colors.css",
          to: "sidebar/",
        },
        {
          from: "**",
          to: ".",
          context: "src/",
          ignore: ["*.js"],
          transform: (content, path) =>
            argv.mode === "production" ? minify(content, path) : content,
        },
      ]),
    ],
  };
};

async function minify(content, path) {
  content = content.toString();
  if (path.endsWith(".json")) {
    const o = JSON.parse(content);

    // remove fields that are unneeded for running the extension in locales
    if (path.indexOf("/_locales/") !== 1) {
      delete o["extensionsLongDescription"];
      if (path.indexOf("/en/") !== -1) {
        for (const elem of Object.values(o)) {
          delete elem["description"];
        }
      }
    }

    return JSON.stringify(o);
  } else if (path.endsWith(".html") || path.endsWith(".svg")) {
    if (path.endsWith(".svg")) {
      content = content.split("-->", 2).slice(-1)[0];
    }
    return content
      .split(/\s/)
      .filter((elem) => elem !== "")
      .join(" ")
      .replace(/> </g, "><")
      .replace(/ \//g, "/");
  } else if (path.endsWith(".css")) {
    const result = await postcss([cssnano]).process(content, { from: path });
    return result.css;
  }
}
