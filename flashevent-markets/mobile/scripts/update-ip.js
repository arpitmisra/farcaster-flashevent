const fs = require('fs');
const os = require('os');
const path = require('path');

function getLocalExternalIp() {
  const interfaces = os.networkInterfaces();
  
  // 1. Priority: Look specifically for "Wi-Fi"
  for (const name of Object.keys(interfaces)) {
    if (name.toLowerCase().includes('wi-fi')) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`🎯 Found Wi-Fi Adapter: ${name}`);
          return iface.address;
        }
      }
    }
  }

  // 2. Fallback: If no Wi-Fi, just take the first non-internal IPv4
  // (This handles cases where you might use Ethernet or a Hotspot)
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Exclude typical Virtual IPs (like 172.x WSL) if possible, 
        // but for now, just logging it.
        console.log(`⚠️ No "Wi-Fi" found, using adapter: ${name}`);
        return iface.address;
      }
    }
  }
  
  return '127.0.0.1'; 
}

const myIp = getLocalExternalIp();
const envPath = path.join(__dirname, '..', '.env');

console.log(`📡 Detected Local IP: ${myIp}`);

// Read .env
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch (err) {
  envContent = '';
}

// Replace IP
const newEnvContent = envContent
  .replace(/EXPO_PUBLIC_API_URL=http:\/\/[\d\.]+:3001/g, `EXPO_PUBLIC_API_URL=http://${myIp}:3001`)
  .replace(/EXPO_PUBLIC_FRAMES_URL=http:\/\/[\d\.]+:3002/g, `EXPO_PUBLIC_FRAMES_URL=http://${myIp}:3002`);

// Save
fs.writeFileSync(envPath, newEnvContent);
console.log(`✅ Updated .env with IP: ${myIp}`);