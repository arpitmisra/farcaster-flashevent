// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MarketFactory.sol";

contract DeployScript is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy MarketFactory with treasury address
        MarketFactory factory = new MarketFactory(treasury);
        console.log("MarketFactory deployed at:", address(factory));
        console.log("Treasury set to:", treasury);
        console.log("Owner set to:", factory.owner());

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Monad Testnet");
        console.log("MARKET_FACTORY_ADDRESS=", address(factory));
    }
}
