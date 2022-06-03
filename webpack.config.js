// ref. https://ics.media/entry/16329/
module.exports = {
  mode: 'development',

  entry: './src/quantumSketch.ts',

  output: {
        filename: "main.js",
        path: `${__dirname}/${"docs"}`,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
      },
    ],
  },
  resolve: {
    extensions: [
      '.ts', '.js'
    ],
  },
};