// polyfill.js - Must be imported FIRST before any other imports
// CRITICAL: This file sets up polyfills required by WalletConnect and ethers.js

import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

// ============================================
// SELF/WINDOW POLYFILL - MUST BE FIRST
// WalletConnect requires self and window to exist
// ============================================
global.self = global;
global.window = global;

console.log('🔧 Starting polyfill setup...');

// ============================================
// BUFFER POLYFILL
// ============================================
global.Buffer = Buffer;
global.window.Buffer = Buffer;

// ============================================
// PROCESS POLYFILL
// ============================================
if (typeof global.process === 'undefined') {
  global.process = require('process');
} else {
  const bProcess = require('process');
  for (const p in bProcess) {
    if (!(p in global.process)) {
      global.process[p] = bProcess[p];
    }
  }
}

// Ensure process.env exists
global.process.env = global.process.env || {};

// Polyfill process.browser
global.process.browser = true;

// ============================================
// EVENT EMITTER POLYFILL
// ============================================
global.EventEmitter = EventEmitter;

// ============================================
// CRYPTO POLYFILL - CRITICAL FOR WALLETCONNECT
// ============================================
// Initialize crypto object
if (!global.crypto) {
  global.crypto = {};
}

// getRandomValues - WalletConnect requires this
// Note: react-native-get-random-values will override this with a secure implementation
if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = function(array) {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  };
}

// randomUUID - Required by WalletConnect for session IDs
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Sync window.crypto with global.crypto
global.window.crypto = global.crypto;

// ============================================
// TEXT ENCODER/DECODER POLYFILL
// ============================================
if (!global.TextEncoder) {
  try {
    const { TextEncoder, TextDecoder } = require('text-encoding');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
    global.window.TextEncoder = TextEncoder;
    global.window.TextDecoder = TextDecoder;
  } catch (e) {
    console.warn('text-encoding not available:', e.message);
  }
}

// ============================================
// LOCATION POLYFILL
// ============================================
if (!global.location) {
  global.location = {
    protocol: 'https:',
    host: 'localhost',
    hostname: 'localhost',
    port: '',
    pathname: '/',
    search: '',
    hash: '',
    origin: 'https://localhost',
    href: 'https://localhost/',
  };
}
global.window.location = global.location;

// ============================================
// NAVIGATOR POLYFILL - Required for some web3 libs
// ============================================
if (!global.navigator) {
  global.navigator = {
    product: 'ReactNative',
    userAgent: 'ReactNative',
  };
}

// ============================================
// CONSOLE POLYFILL
// ============================================
const noop = () => {};
console.debug = console.debug || noop;

// ============================================
// ATOB/BTOA POLYFILL - Required for base64
// ============================================
if (!global.atob) {
  global.atob = (input) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = input.replace(/=+$/, '');
    let output = '';
    
    for (let bc = 0, bs = 0, buffer, i = 0; 
         (buffer = str.charAt(i++));
         ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
           ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6))
           : 0
    ) {
      buffer = chars.indexOf(buffer);
    }
    
    return output;
  };
}

if (!global.btoa) {
  global.btoa = (input) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = input;
    let output = '';
    
    for (let block = 0, charCode, i = 0, map = chars;
         str.charAt(i | 0) || (map = '=', i % 1);
         output += map.charAt(63 & block >> 8 - i % 1 * 8)
    ) {
      charCode = str.charCodeAt(i += 3/4);
      block = block << 8 | charCode;
    }
    
    return output;
  };
}

// Sync to window
global.window.atob = global.atob;
global.window.btoa = global.btoa;

// ============================================
// LOCALSTORAGE POLYFILL - Required by WalletConnect
// ============================================
if (!global.localStorage) {
  const storage = {};
  global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = String(value); },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { Object.keys(storage).forEach(key => delete storage[key]); },
    key: (index) => Object.keys(storage)[index] || null,
    get length() { return Object.keys(storage).length; }
  };
}
global.window.localStorage = global.localStorage;

// ============================================
// SESSIONSTORAGE POLYFILL
// ============================================
if (!global.sessionStorage) {
  const storage = {};
  global.sessionStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, value) => { storage[key] = String(value); },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { Object.keys(storage).forEach(key => delete storage[key]); },
    key: (index) => Object.keys(storage)[index] || null,
    get length() { return Object.keys(storage).length; }
  };
}
global.window.sessionStorage = global.sessionStorage;

console.log('✅ Polyfills loaded successfully');
console.log('   - self:', typeof self !== 'undefined' ? '✓' : '✗');
console.log('   - window:', typeof window !== 'undefined' ? '✓' : '✗');
console.log('   - crypto:', typeof crypto !== 'undefined' ? '✓' : '✗');
console.log('   - Buffer:', typeof Buffer !== 'undefined' ? '✓' : '✗');
console.log('   - localStorage:', typeof localStorage !== 'undefined' ? '✓' : '✗');