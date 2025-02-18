// webpack.config.js
const path = require("path");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
//const nodeExternals = require('webpack-node-externals');
module.exports = {
  entry: "./index.mjs", // entry point for your application
  output: {
    filename: "session-cache.js", // output bundle file
    path: path.resolve(__dirname, "dist"), // output path
    clean: true, // cleans old files in dist on rebuild
  },
  module: {
    rules: [
      {
        test: /\.css$/i, // loader for CSS files
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.(js|jsx)$/, // loader for JS and JSX files
        exclude: /node_modules/,
        use: {
          loader: "babel-loader", // transpile modern JavaScript for compatibility
          options: {
            presets: ["@babel/preset-env"],
            plugins:[
              "@babel/plugin-transform-arrow-functions",
              "@babel/plugin-transform-block-scoping"
              ]
          },
        },
      },
    ],
  },
  devtool: "source-map", // helps with debugging by providing source maps
  mode: "development", // set mode to 'production' for optimized builds
  plugins: [new NodePolyfillPlugin()],
  //  externals: [nodeExternals()]
};
