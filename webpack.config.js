const path = require('path');
const webpack = require("webpack");

module.exports = {
    stats: {
        children: true,
    },
    mode: 'development',
    devtool: 'source-map',
    context: __dirname,
    entry: "./js/application/angular/app_wowjs.js", // Simplified entry point

    output: {
        path: path.resolve(__dirname, 'build'),
        filename: "[name].js",
        publicPath: '/build/',
    },

    resolve: {
        extensions: ['.js', '.jsx', '.glsl'],
        modules: [
            path.resolve('./js/application/angular'),
            path.resolve('./glsl/'),
            'node_modules' // Ensure 'node_modules' is correctly listed for package resolution
        ],
    },

    module: {
        rules: [
            {
                test: /\.js?$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                },
                exclude: [/node_modules/]
            },
            {
                test: /\.scss$/,
                use: [
                    "style-loader", // Injects CSS into the DOM
                    "css-loader", // Translates CSS into CommonJS
                    "resolve-url-loader", // Resolves relative paths in url() statements
                    {
                        loader: "sass-loader", // Compiles Sass to CSS
                        options: {
                            sourceMap: true, // Required for resolve-url-loader to resolve URLs
                        },
                    },
                ],
            },
            {
                test: /\.(woff|woff2|eot|ttf|svg)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'fonts/', // Customize this path based on your build output directory
                        },
                    },
                ],
            },
            {
                test: /\.glsl$/,
                use: 'raw-loader'
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader', // Adds CSS to the DOM by injecting a `<style>` tag
                    'css-loader' // Interprets `@import` and `url()` like `import/require()` and will resolve them
                ]
            }
        ],
    },

    devServer: {
        static: '.',
        compress: true,
        port: 8888,
    },
};
