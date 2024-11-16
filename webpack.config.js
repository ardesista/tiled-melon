const path = require("path");

module.exports = {
  entry: "./src/index.js",
  target: "web",
  mode: "production",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "tiled-melon.js",
  },
};
