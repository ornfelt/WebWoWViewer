const path = require('path');
const webpack = require("webpack");

module.exports = {
    stats: {
        children: true, // Show detailed information about child compilations
    },
    mode: 'development', // Or 'production'
    devtool: 'source-map',

    context: __dirname,

    entry: ['bootstrap-loader', "./js/application/angular/app_wowjs.js"],
    //entry: "./js/application/angular/app_wowjs.js",

    output: {
        path: path.resolve(__dirname, 'build'),
        filename: "[name].js",
        //library: "[name]"
    },

    resolve: {
        extensions: ['.js', '.jsx','.glsl'],
        modules: [
            path.resolve('./js/application/angular'),
            path.resolve('./glsl/'),
            path.resolve('./js/lib/bower'),
            'node_modules'
        ]
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
                exclude: [/node_modules/, /zip.js/, /text-encoding/]
            },
            {
                test: /\.css$/,
                use: 'null-loader',
            },

            //{
            //    test: /\.scss$/,
            //    use: [
            //        "style-loader",
            //        "css-loader",
            //        {
            //            loader: "resolve-url-loader",
            //            options: {
            //                attempts: 1,
            //            },
            //        },
            //        {
            //            loader: "sass-loader",
            //            options: {
            //                sourceMap: true, // Required for resolve-url-loader to work correctly
            //            },
            //        },
            //    ],
            //},

            {
                test: /-worker\.js$/,
                use: { loader: 'worker-loader' }
            },

            {
                test: /\.glsl$/,
                use: 'raw-loader'
            },
            {
                test: /\.glsl$/,
                use: 'glslify-loader'
            },
            //{ 
            //    test: /\.css$/, 
            //    use: ["style-loader", "css-loader"] 
            //},
            //{
            //    test: /\.scss$/,
            //    use: ["style-loader", "css-loader", "sass-loader"]
            //},
            //{ 
            //    test: /\.(woff|woff2)$/,   
            //    use: "url-loader?limit=10000&mimetype=application/font-woff" 
            //},
            //{ 
            //    test: /\.ttf$/,    
            //    use: "file-loader" 
            //},
            //{ 
            //    test: /\.eot$/,    
            //    use: "file-loader" 
            //},
            //{ 
            //    test: /\.svg$/,    
            //    use: "file-loader" 
            //}
        ]
    },

    plugins: [
        // Use the DefinePlugin or EnvironmentPlugin if you need to define environment variables
    ],

    devServer: {
        static: '.',
        compress: true,
        port: 8888
    }
};
