/**
 * x402 Diagnostics - Debug Helper
 * Use this to identify payer/recipient issues
 */

import x402Service from '../services/x402Service';
import config from '../config';

export const x402Diagnostics = {
  /**
   * Check if pre-auth has correct payer/recipient
   */
  async checkPreAuth() {
    const status = x402Service.getPreAuthStatus();
    
    console.log('\n' + '='.repeat(70));
    console.log('🔍 X402 PRE-AUTHORIZATION DIAGNOSTIC');
    console.log('='.repeat(70));
    
    if (!status.authorized) {
      console.log('❌ No valid pre-authorization found');
      console.log('   Reason:', status.reason);
      return { valid: false, reason: status.reason };
    }
    
    const preAuth = x402Service.preAuth;
    if (!preAuth) {
      console.log('❌ Pre-auth data is null');
      return { valid: false, reason: 'No pre-auth data' };
    }
    
    console.log('\n✅ Pre-authorization found:');
    console.log('   Payer:', preAuth.payer);
    console.log('   Recipient:', preAuth.recipient);
    console.log('   Max Amount:', preAuth.maxAmount);
    console.log('   Valid Until:', new Date(preAuth.validUntil * 1000).toISOString());
    
    // Check if they're the same
    const payerLower = preAuth.payer.toLowerCase();
    const recipientLower = preAuth.recipient.toLowerCase();
    
    if (payerLower === recipientLower) {
      console.log('\n❌ CRITICAL: Payer and recipient are the SAME!');
      console.log('   Both:', preAuth.payer);
      console.log('\n   This means payments would go from your account to your account.');
      console.log('   This is WRONG! You need two different addresses:');
      console.log('   - Payer: Your personal wallet');
      console.log('   - Recipient: Backend treasury wallet');
      return { valid: false, reason: 'Payer and recipient are identical' };
    }
    
    console.log('\n✅ Payer and recipient are different ✓');
    console.log('\n' + '='.repeat(70) + '\n');
    
    return { 
      valid: true, 
      payer: preAuth.payer, 
      recipient: preAuth.recipient 
    };
  },
  
  /**
   * Check configuration
   */
  checkConfig() {
    console.log('\n' + '='.repeat(70));
    console.log('⚙️ X402 CONFIGURATION');
    console.log('='.repeat(70));
    console.log('X402_RECIPIENT:', config.X402_RECIPIENT);
    console.log('X402_SPENDING_LIMIT:', config.X402_SPENDING_LIMIT);
    console.log('='.repeat(70) + '\n');
    
    return {
      recipient: config.X402_RECIPIENT,
      limit: config.X402_SPENDING_LIMIT,
    };
  },
  
  /**
   * Full diagnostic report
   */
  async generateReport() {
    console.log('\n\n');
    console.log('╔' + '═'.repeat(68) + '╗');
    console.log('║' + ' '.repeat(15) + '🔧 X402 FULL DIAGNOSTIC REPORT' + ' '.repeat(23) + '║');
    console.log('╚' + '═'.repeat(68) + '╝\n');
    
    // Check config
    const config_check = this.checkConfig();
    
    // Check pre-auth
    const preauth_check = await this.checkPreAuth();
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log('───────────────────────────────────────────────────────────────────');
    
    if (!preauth_check.valid) {
      console.log('❌ Pre-authorization has ISSUES:');
      console.log('   ', preauth_check.reason);
      console.log('\n💡 SOLUTION:');
      console.log('   1. Check your X402_RECIPIENT configuration');
      console.log('   2. Make sure you have TWO different wallets:');
      console.log('      - Your personal wallet (PAYER)');
      console.log('      - Backend treasury wallet (RECIPIENT)');
      console.log('   3. Revoke current authorization (if any)');
      console.log('   4. Sign a new pre-authorization');
    } else {
      console.log('✅ Pre-authorization is VALID');
      console.log('✅ Payer and recipient are different');
      console.log('\n💳 Details:');
      console.log('   Payer (you):', preauth_check.payer);
      console.log('   Recipient (treasury):', preauth_check.recipient);
    }
    
    console.log('\n' + '═'.repeat(70) + '\n');
    
    return {
      config: config_check,
      preauth: preauth_check,
      timestamp: new Date().toISOString(),
    };
  },
  
  /**
   * Quick test - log what would be signed
   */
  logSigningData() {
    const preAuth = x402Service.preAuth;
    
    if (!preAuth) {
      console.log('❌ No pre-authorization to log');
      return;
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📝 WHAT WOULD BE SIGNED');
    console.log('='.repeat(70));
    console.log(JSON.stringify({
      payer: preAuth.payer,
      recipient: preAuth.recipient,
      maxAmount: preAuth.maxAmount,
      chainId: preAuth.chainId,
      validUntil: preAuth.validUntil,
      nonce: preAuth.nonce,
    }, null, 2));
    console.log('='.repeat(70) + '\n');
  },
};

export default x402Diagnostics;
