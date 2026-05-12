module.exports = function (api) {
  api.cache(true);
  
  return {
    presets: [
      ['babel-preset-expo', { 
        jsxImportSource: 'react',
        lazyImports: true,
        unstable_transformProfile: 'hermes-stable'
      }]
    ],
    plugins: [
      // Optimize React Native performance
      ['@babel/plugin-transform-runtime', {
        helpers: true,
        regenerator: false
      }],
      // Required for react-native-reanimated (must be last)
      'react-native-reanimated/plugin',
    ],
    env: {
      production: {
        plugins: [
          // Remove console.log in production
          'transform-remove-console'
        ]
      }
    }
  };
};
