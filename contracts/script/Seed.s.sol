// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Fills a DEMO deployment with sample creators and backers so the app isn't empty.
///         Creates throwaway wallets derived from SEED_SALT (testnet only, they hold nothing of
///         value), funds them with a little gas and Test USDC from the broadcasting account (which
///         must be the deployer, the Test USDC minter), registers demo creators and backs them.
///         Run with --slow so funding lands before the derived wallets transact.
contract Seed is Script {
    function run() external {
        string memory dep = vm.readFile(string.concat("../web/src/deployments/", vm.toString(block.chainid), ".json"));
        require(vm.parseJsonBool(dep, ".demo"), "Seed only runs on demo deployments");
        Backing backing = Backing(vm.parseJsonAddress(dep, ".backing"));
        MockUSDC usdc = MockUSDC(vm.parseJsonAddress(dep, ".usdc"));

        bytes32 salt = keccak256(abi.encode(vm.envOr("SEED_SALT", string("backing-demo")), block.chainid));
        uint256 gas = vm.envOr("SEED_GAS_WEI", uint256(0.0003 ether));

        string[4] memory names = ["Nocturne Beats", "Graveyard Shift Comics", "3AM Dev Streams", "Moonlit Pixels"];
        string[4] memory bios = [
            "Lo-fi for people who work while the city sleeps. (demo profile)",
            "A weekly webcomic about night-shift nurses, cabbies and bakers. (demo profile)",
            "Building open-source tools live, midnight to 3am WAT. (demo profile)",
            "Pixel art of empty streets and neon signs. (demo profile)"
        ];
        string[4] memory handles = ["nocturnebeats", "graveyardshift", "3amdev", "moonlitpixels"];

        uint256[4] memory ck;
        uint256[6] memory fk;
        for (uint256 i; i < 4; i++) ck[i] = uint256(keccak256(abi.encode(salt, "creator", i))) % SECP_N;
        for (uint256 i; i < 6; i++) fk[i] = uint256(keccak256(abi.encode(salt, "fan", i))) % SECP_N;

        vm.startBroadcast();
        for (uint256 i; i < 4; i++) {
            if (!backing.isCreator(vm.addr(ck[i]))) payable(vm.addr(ck[i])).transfer(gas);
        }
        for (uint256 i; i < 6; i++) {
            payable(vm.addr(fk[i])).transfer(gas);
            usdc.mint(vm.addr(fk[i]), 5_000e6);
        }
        vm.stopBroadcast();

        for (uint256 i; i < 4; i++) {
            if (backing.isCreator(vm.addr(ck[i]))) continue;
            vm.startBroadcast(ck[i]);
            backing.registerCreator(names[i], bios[i], "", handles[i], 0);
            vm.stopBroadcast();
        }

        // fan i backs a spread of creators with different amounts
        uint256[6] memory amounts = [uint256(2_500e6), 1_200e6, 800e6, 400e6, 150e6, 50e6];
        string[6] memory notes = [
            "Your sets carry my night shifts at the bakery",
            "",
            "Rent is due and this costs me nothing. Easy yes",
            "",
            "First backing. Keep drawing those streets",
            ""
        ];
        for (uint256 i; i < 6; i++) {
            vm.startBroadcast(fk[i]);
            usdc.approve(address(backing), type(uint256).max);
            backing.back(vm.addr(ck[i % 4]), amounts[i], bytes20(0), notes[i]);
            if (i < 3) backing.back(vm.addr(ck[(i + 1) % 4]), amounts[i] / 2, bytes20(0), "");
            vm.stopBroadcast();
        }
        string[4] memory updates = [
            "New mix is up: two hours of slow tape loops for whoever is still awake",
            "Episode 14 is live. Ada finally finishes her shift at the 24h pharmacy",
            "Streaming tonight from 00:00 WAT, fixing the indexer bug live",
            "Finished the Lagos night market series. Prints next week"
        ];
        for (uint256 i; i < 4; i++) {
            vm.startBroadcast(ck[i]);
            backing.post(updates[i], "");
            vm.stopBroadcast();
        }
        console2.log("Seeded 4 demo creators, 6 demo backers and 4 updates");
    }

    uint256 constant SECP_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
}
