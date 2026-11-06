// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Fills a DEMO deployment with sample people, posts and backings so the app isn't empty.
///         Throwaway wallets are derived from SEED_SALT (testnet only, they hold nothing of value)
///         and funded with gas and Test USDC by the broadcasting account (the deployer).
///         SEED_IMAGE_BASE (e.g. https://your-site.vercel.app/demo) adds pictures to the demo posts.
///         Run with --slow so funding lands before the derived wallets transact.
contract Seed is Script {
    uint256 constant SECP_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function run() external {
        string memory dep = vm.readFile(string.concat("../web/src/deployments/", vm.toString(block.chainid), ".json"));
        require(vm.parseJsonBool(dep, ".demo"), "Seed only runs on demo deployments");
        Backing backing = Backing(vm.parseJsonAddress(dep, ".backing"));
        MockUSDC usdc = MockUSDC(vm.parseJsonAddress(dep, ".usdc"));
        bytes32 salt = keccak256(abi.encode(vm.envOr("SEED_SALT", string("backing-demo")), block.chainid));
        uint256 gas = vm.envOr("SEED_GAS_WEI", uint256(0.0004 ether));
        string memory img = vm.envOr("SEED_IMAGE_BASE", string(""));

        string[4] memory users = ["nocturnebeats", "graveyardshift", "the3amdev", "moonlitpixels"];
        string[4] memory bases = ["nocturne.base.eth", "graveyard.base.eth", "3amdev.base.eth", "moonlit.base.eth"];
        string[4] memory bios = [
            "Lo-fi for people who work while the city sleeps. New mix every Friday night.",
            "A weekly webcomic about night-shift nurses, cabbies and bakers.",
            "Building open-source tools live on Base, midnight to 3am WAT.",
            "Pixel art of empty streets and neon signs. Prints for backers."
        ];
        string[4] memory posts = [
            "New mix is up: two hours of slow tape loops for whoever is still awake. Made it in one sitting after my shift.",
            "Episode 14 is live. Ada finally clocks out of the 24h pharmacy and catches the last bus home.",
            "Shipped the whole backend tonight, midnight to 3am. Base deploys are so cheap I stopped counting. Streaming the next one.",
            "Finished the Lagos night-market series: neon, rain, empty streets. Prints next week for everyone backing the work."
        ];
        string[3] memory fanNames = ["ada_reads", "tunde_nights", "zee_builds"];

        uint256[4] memory ck;
        uint256[6] memory fk;
        for (uint256 i; i < 4; i++) ck[i] = uint256(keccak256(abi.encode(salt, "creator", i))) % SECP_N;
        for (uint256 i; i < 6; i++) fk[i] = uint256(keccak256(abi.encode(salt, "fan", i))) % SECP_N;

        vm.startBroadcast();
        for (uint256 i; i < 4; i++) payable(vm.addr(ck[i])).transfer(gas);
        for (uint256 i; i < 6; i++) {
            payable(vm.addr(fk[i])).transfer(gas);
            usdc.mint(vm.addr(fk[i]), 5_000e6);
        }
        vm.stopBroadcast();

        for (uint256 i; i < 4; i++) {
            if (backing.hasProfile(vm.addr(ck[i]))) continue;
            vm.startBroadcast(ck[i]);
            backing.saveProfile(Backing.Profile({username: users[i], baseName: bases[i], avatar: "", bio: bios[i], link: ""}));
            string memory picture = bytes(img).length > 0 ? string.concat(img, "/night-", vm.toString(i), ".webp") : "";
            backing.post(posts[i], picture);
            vm.stopBroadcast();
        }
        // three of the fans have profiles too, so backer lists show names
        for (uint256 i; i < 3; i++) {
            if (backing.hasProfile(vm.addr(fk[i]))) continue;
            vm.startBroadcast(fk[i]);
            backing.saveProfile(Backing.Profile({username: fanNames[i], baseName: "", avatar: "", bio: "Here for the night-shift crew.", link: ""}));
            vm.stopBroadcast();
        }

        uint256[6] memory amounts = [uint256(2_500e6), 1_200e6, 800e6, 400e6, 150e6, 50e6];
        for (uint256 i; i < 6; i++) {
            // fans 3-5 arrived through fan 0's invite link
            address ref = i >= 3 ? vm.addr(fk[0]) : address(0);
            vm.startBroadcast(fk[i]);
            usdc.approve(address(backing), type(uint256).max);
            backing.back(vm.addr(ck[i % 4]), amounts[i], ref);
            if (i < 3) backing.back(vm.addr(ck[(i + 1) % 4]), amounts[i] / 2, address(0));
            vm.stopBroadcast();
        }
        console2.log("Seeded 4 creators, 3 fan profiles, 4 posts and 9 backings");
    }
}
