// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Fills a DEMO deployment with sample creators, posts, comments and backers so the app
///         isn't empty. Throwaway wallets are derived from SEED_SALT (testnet only, they hold
///         nothing of value) and funded with a little gas and Test USDC by the broadcasting
///         account, which must be the deployer (the Test USDC minter).
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
        // Optional: a public image base URL for demo post pictures (e.g. your Vercel site + /demo)
        string memory img = vm.envOr("SEED_IMAGE_BASE", string(""));

        string[4] memory names = ["Nocturne Beats", "Graveyard Shift Comics", "3AM Dev Streams", "Moonlit Pixels"];
        string[4] memory bios = [
            "Lo-fi for people who work while the city sleeps. Demo profile",
            "A weekly webcomic about night-shift nurses, cabbies and bakers. Demo profile",
            "Building open-source tools live, midnight to 3am WAT. Demo profile",
            "Pixel art of empty streets and neon signs. Demo profile"
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

        uint256[4] memory firstPost;
        for (uint256 i; i < 4; i++) {
            if (backing.isCreator(vm.addr(ck[i]))) continue;
            vm.startBroadcast(ck[i]);
            backing.registerCreator(
                Backing.Profile({name: names[i], bio: bios[i], avatar: "", banner: "", handle: handles[i], fid: 0, x: handles[i], xPost: ""})
            );
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
            string memory picture = bytes(img).length > 0 ? string.concat(img, "/night-", vm.toString(i), ".webp") : "";
            firstPost[i] = backing.post(updates[i], "", picture);
            vm.stopBroadcast();
        }

        // fan i backs a spread of creators with different amounts, terms and notes
        uint256[6] memory amounts = [uint256(2_500e6), 1_200e6, 800e6, 400e6, 150e6, 50e6];
        uint64[6] memory durations = [uint64(0), 30 days, 0, 7 days, 0, 1 days];
        bool[6] memory locks = [false, true, false, false, false, false];
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
            backing.back(
                vm.addr(ck[i % 4]),
                amounts[i],
                Backing.BackOptions({duration: durations[i], lock: locks[i], cast: bytes20(0), post: firstPost[i % 4], note: notes[i]})
            );
            if (i < 3) {
                backing.back(
                    vm.addr(ck[(i + 1) % 4]),
                    amounts[i] / 2,
                    Backing.BackOptions({duration: 0, lock: false, cast: bytes20(0), post: 0, note: ""})
                );
            }
            vm.stopBroadcast();
        }

        string[4] memory comments = ["On repeat since midnight", "Ada deserves a raise", "Saw the fix land, nice", "The neon one is my favourite"];
        for (uint256 i; i < 4; i++) {
            vm.startBroadcast(fk[(i + 2) % 6]);
            backing.comment(firstPost[i], comments[i]);
            vm.stopBroadcast();
        }
        console2.log("Seeded 4 creators, 4 posts, 4 comments and 9 backings");
    }
}
