/* global __dirname:true */
/* global module:true */

const path = require("path");

module.exports = {
  entry: {
    background: "./src/background/background.js",
    sidebar: "./src/sidebar/index.js",
    options: "./src/options/options.js",
  },
  output: {
    path: path.resolve(__dirname, "src"),
    filename: "dist/[name].bundle.js",
  },
};
