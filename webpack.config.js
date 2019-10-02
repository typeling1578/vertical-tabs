/* global __dirname:true */
/* global module:true */

module.exports = {
  entry: "./src/sidebar/index.js",
  output: {
    filename: "sidebar.bundle.js",
    path: `${__dirname}/src/sidebar/dist`,
  },
};
