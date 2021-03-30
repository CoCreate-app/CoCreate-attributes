<<<<<<< HEAD
const path = require("path")
const TerserPlugin = require("terser-webpack-plugin")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
let isProduction = process.env.NODE_ENV === "production"
const { CleanWebpackPlugin } = require("clean-webpack-plugin")
const HtmlWebpackPlugin = require("html-webpack-plugin")

module.exports = {
  entry: {
    "CoCreate-attributes": "./src/index.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: isProduction ? "[name].min.js" : "[name][hash].js",
=======
// Webpack uses this to work with directories
const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

let isProduction = process.env.NODE_ENV === "production";

// This is main configuration object.
// Here you write different options and tell Webpack what to do
module.exports = {
  // Path to your entry point. From this file Webpack will begin his work
  entry: {
    "CoCreate-attributes": "./src/CoCreate-attributes.js",
  },

  // Path and filename of your result bundle.
  // Webpack will bundle all JavaScript into this file
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: isProduction ? "[name].min.js" : "[name].js",
>>>>>>> b6b6a6528824694693e0a4cc70aa1e5bc57aded5
    libraryTarget: "umd",
    libraryExport: "default",
    library: ["CoCreate", "attributes"],
    globalObject: "this",
    // publicPath: 'https://server.cocreate.app/CoCreateJS/dist/'
  },

  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
      filename: "[name].css",
    }),

    new HtmlWebpackPlugin({
      template: "./src/index.html",
    }),
  ],
  // Default mode for Webpack is production.
  // Depending on mode Webpack will apply different things
  // on final bundle. For now we don't need production's JavaScript
  // minifying and other thing so let's set mode to development
  mode: isProduction ? "production" : "development",
  module: {
    rules: [
      {
<<<<<<< HEAD
        test: /.js$/,
=======
        test: /\.js$/,
>>>>>>> b6b6a6528824694693e0a4cc70aa1e5bc57aded5
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          options: {
            plugins: ["@babel/plugin-transform-modules-commonjs"],
          },
        },
      },
<<<<<<< HEAD
      {
        test: /.css$/i,
        use: [
          { loader: "style-loader", options: { injectType: "linkTag" } },
          "file-loader",
        ],
      },
=======
>>>>>>> b6b6a6528824694693e0a4cc70aa1e5bc57aded5
    ],
  },

  // add source map
  ...(isProduction ? {} : { devtool: "eval-source-map" }),

<<<<<<< HEAD
=======
  // add uglifyJs

>>>>>>> b6b6a6528824694693e0a4cc70aa1e5bc57aded5
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: true,
        // cache: true,
        parallel: true,
        // sourceMap: true, // Must be set to true if using source-maps in production
        terserOptions: {
          // https://github.com/webpack-contrib/terser-webpack-plugin#terseroptions
          // extractComments: 'all',
          compress: {
            drop_console: true,
          },
        },
      }),
    ],
<<<<<<< HEAD
    splitChunks: {
      chunks: "all",
      minSize: 200,
      // maxSize: 99999,
      //minChunks: 1,
    },
  },
}
=======
  },
};
>>>>>>> b6b6a6528824694693e0a4cc70aa1e5bc57aded5
