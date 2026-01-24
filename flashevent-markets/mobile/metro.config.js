const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add polyfills for WalletConnect and ethers.js
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('crypto-browserify'),
  stream: require.resolve('readable-stream'),
  buffer: require.resolve('buffer/'),
  events: require.resolve('events/'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  os: require.resolve('os-browserify/browser'),
  path: require.resolve('path-browserify'),
  vm: require.resolve('vm-browserify'),
};

// Ensure unstable_enablePackageExports is enabled for proper module resolution
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
