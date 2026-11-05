// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";

/// @notice Deploys Backing.
///   MODE=demo (default): deploys Test USDC + a demo yield vault with accelerated APR, then Backing.
///                        Use on local Anvil and Base Sepolia.
///   MODE=live:           wires Backing to an existing ERC-4626 USDC vault (VAULT=0x...).
///                        Refuses to deploy unless vault.asset() == USDC and the vault holds assets.
/// Writes addresses to ../web/src/deployments/<chainId>.json for the frontend.
contract Deploy is Script {
    address constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external {
        string memory mode = vm.envOr("MODE", string("demo"));
        bool live = keccak256(bytes(mode)) == keccak256("live");

        address usdc;
        address vault;
        bool isDemo;
        uint64 epoch;

        vm.startBroadcast();
        if (live) {
            vault = vm.envAddress("VAULT");
            usdc = vm.envOr("USDC", BASE_USDC);
            require(IERC4626(vault).asset() == usdc, "VAULT asset is not USDC");
            require(IERC4626(vault).totalAssets() > 0, "VAULT looks empty");
            epoch = uint64(vm.envOr("EPOCH_SECONDS", uint256(1 days)));
        } else {
            isDemo = true;
            MockUSDC m = new MockUSDC();
            // 3650% APR (10%/day) so income visibly ticks up in a live demo.
            MockYieldVault v = new MockYieldVault(m, vm.envOr("DEMO_APR_BPS", uint256(365_000)));
            m.setMinter(address(v), true);
            // Seed the demo vault so it's never empty (blocks the empty-vault donation trick).
            m.mint(msg.sender, 1_000e6);
            m.approve(address(v), 1_000e6);
            v.deposit(1_000e6, address(0xdead));
            usdc = address(m);
            vault = address(v);
            epoch = uint64(vm.envOr("EPOCH_SECONDS", uint256(2 minutes)));
        }
        Backing backing = new Backing(IERC4626(vault), epoch, 1e6);
        vm.stopBroadcast();

        console2.log("Backing:", address(backing));
        console2.log("USDC:   ", usdc);
        console2.log("Vault:  ", vault);

        string memory k = "deployment";
        vm.serializeAddress(k, "backing", address(backing));
        vm.serializeAddress(k, "usdc", usdc);
        vm.serializeAddress(k, "vault", vault);
        vm.serializeBool(k, "demo", isDemo);
        vm.serializeUint(k, "epochSeconds", epoch);
        string memory json = vm.serializeUint(k, "chainId", block.chainid);
        string memory path = string.concat("../web/src/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("Wrote", path);
    }
}
