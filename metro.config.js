const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for resolving additional file types
config.resolver.sourceExts.push('cjs');

// Enable better caching and performance
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Optimize transformer for better performance
config.transformer = {
  ...config.transformer,
  // Enable experimental import/export transformations
  unstable_allowRequireContext: true,
};

// Optimize serialization for production builds
config.serializer = {
  ...config.serializer,
};

// Ignore unnecessary files for faster builds
config.resolver.blockList = [
  /node_modules\/.*\/__(tests?|spec)__\/.*/,
  /\.git\/.*/,
  /\.DS_Store/,
  /Thumbs\.db/,
  /node_modules\/\.jsx-ast-utils-.*/,
  /node_modules\/\.react-native-gesture-handler-.*/,
  /node_modules\/\.react-native-reanimated-.*/,
  /node_modules\/\.object-inspect-.*/,
];

module.exports = config;
