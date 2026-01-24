// ================================================
// CRITICAL: Polyfills must be imported FIRST - order matters!
// ================================================

// 1. Our custom polyfills (Buffer, process, crypto, window, self)
// This MUST come first before any other imports
import './polyfill';

// 2. React Native crypto polyfill (overrides our basic crypto.getRandomValues with secure version)
import 'react-native-get-random-values';

// 3. URL polyfill for WalletConnect
import 'react-native-url-polyfill/auto';

// 4. WalletConnect React Native compatibility layer - MUST come before modal
import '@walletconnect/react-native-compat';

// 5. Ethers.js shims
import '@ethersproject/shims';

// ================================================
// Now import the rest of the app
// ================================================

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
