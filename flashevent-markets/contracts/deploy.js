/**
 * Deploy MarketFactory Contract to Monad Testnet
 * Run: node deploy.js
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = 'https://monad-testnet.g.alchemy.com/v2/f6Q2jX1N6pG4yztkh_TK5';
const CHAIN_ID = 10143;
const DEPLOYER_PRIVATE_KEY = '1da8f75988eb8848cd78e38745570bce54766613e5b963dce3fc5d12d6fbf4d7';
const TREASURY_ADDRESS = '0xBb689Fd2A92b6EB905e56C3726Bf090fA2D3a6a4';

async function main() {
    console.log('🚀 Starting MarketFactory Deployment to Monad Testnet...\n');

    // Load compiled artifacts
    const marketFactoryArtifact = JSON.parse(
        fs.readFileSync(path.join(__dirname, 'out/MarketFactory.sol/MarketFactory.json'), 'utf8')
    );

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

    console.log('📍 Deployer Address:', wallet.address);
    console.log('📍 Treasury Address:', TREASURY_ADDRESS);
    console.log('📍 Chain ID:', CHAIN_ID);
    console.log('📍 RPC URL:', RPC_URL);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Deployer Balance:', ethers.formatEther(balance), 'MON\n');

    if (balance === 0n) {
        console.error('❌ Error: Deployer has no balance. Please fund the wallet first.');
        console.log('   Get testnet MON from: https://faucet.monad.xyz/');
        process.exit(1);
    }

    // Deploy MarketFactory
    console.log('📦 Deploying MarketFactory...');
    
    const MarketFactory = new ethers.ContractFactory(
        marketFactoryArtifact.abi,
        marketFactoryArtifact.bytecode.object,
        wallet
    );

    const marketFactory = await MarketFactory.deploy(TREASURY_ADDRESS);
    console.log('⏳ Transaction sent:', marketFactory.deploymentTransaction().hash);

    // Wait for deployment
    await marketFactory.waitForDeployment();
    const factoryAddress = await marketFactory.getAddress();

    console.log('\n✅ MarketFactory deployed successfully!');
    console.log('📍 Contract Address:', factoryAddress);

    // Set protocol fee (250 bps = 2.5%) - already default, but confirm
    console.log('\n⚙️  Setting default protocol fee to 250 bps (2.5%)...');
    const setFeeTx = await marketFactory.setDefaultProtocolFee(250);
    await setFeeTx.wait();
    console.log('✅ Protocol fee set!');

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 DEPLOYMENT SUMMARY');
    console.log('='.repeat(60));
    console.log('Network:           Monad Testnet (Chain ID: 10143)');
    console.log('MarketFactory:     ' + factoryAddress);
    console.log('Treasury:          ' + TREASURY_ADDRESS);
    console.log('Owner:             ' + wallet.address);
    console.log('Protocol Fee:      250 bps (2.5%)');
    console.log('='.repeat(60));

    // Save deployment info
    const deploymentInfo = {
        network: 'monad-testnet',
        chainId: CHAIN_ID,
        deployedAt: new Date().toISOString(),
        contracts: {
            MarketFactory: factoryAddress
        },
        treasury: TREASURY_ADDRESS,
        owner: wallet.address
    };

    fs.writeFileSync(
        path.join(__dirname, 'deployment.json'),
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log('\n💾 Deployment info saved to deployment.json');

    // Print config for mobile app
    console.log('\n📱 UPDATE mobile/src/config/contracts.js WITH:');
    console.log('='.repeat(60));
    console.log(`MARKET_FACTORY: '${factoryAddress}'`);
    console.log('='.repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    });
