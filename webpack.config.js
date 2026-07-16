const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const {EsbuildPlugin} = require("esbuild-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const ZipPlugin = require("zip-webpack-plugin");

module.exports = (_env, argv) => {
    const production = argv.mode === "production";
    const outputPrefix = production ? "dist/" : "";
    const plugins = [
        new MiniCssExtractPlugin({filename: `${outputPrefix}index.css`}),
    ];

    if (production) {
        plugins.push(
            new webpack.BannerPlugin({
                banner: () => fs.readFileSync("LICENSE", "utf8"),
            }),
        );
        plugins.push(
            new CopyPlugin({
                patterns: [
                    {from: "icon.png", to: "./dist/"},
                    {from: "preview.png", to: "./dist/"},
                    {from: "README*.md", to: "./dist/"},
                    {from: "CHANGELOG.md", to: "./dist/"},
                    {from: "LICENSE", to: "./dist/"},
                    {from: "plugin.json", to: "./dist/"},
                    {from: "src/i18n/", to: "./dist/i18n/"},
                ],
            }),
        );
        plugins.push(
            new ZipPlugin({
                filename: "package.zip",
                algorithm: "gzip",
                include: [/dist/],
                pathMapper: (assetPath) => assetPath.replace("dist/", ""),
            }),
        );
    } else {
        plugins.push(
            new CopyPlugin({
                patterns: [{from: "src/i18n/", to: "./i18n/"}],
            }),
        );
    }

    return {
        mode: argv.mode || "development",
        watch: !production,
        devtool: production ? false : "eval-source-map",
        entry: {
            [production ? "dist/index" : "index"]: "./src/index.ts",
        },
        output: {
            filename: "[name].js",
            path: path.resolve(__dirname),
            library: {type: "commonjs2"},
        },
        externals: {
            siyuan: "siyuan",
        },
        optimization: {
            minimize: production,
            minimizer: [new EsbuildPlugin()],
        },
        resolve: {
            extensions: [".ts", ".scss", ".js", ".json"],
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [{loader: "esbuild-loader", options: {target: "es2022"}}],
                },
                {
                    test: /\.scss$/,
                    include: [path.resolve(__dirname, "src")],
                    use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
                },
            ],
        },
        plugins,
    };
};
