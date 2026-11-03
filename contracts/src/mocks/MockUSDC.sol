// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only USDC (6 decimals) with a public faucet. Never deploy to mainnet.
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1_000e6;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    address public immutable owner;
    mapping(address => bool) public minters;
    mapping(address => uint256) public lastFaucet;

    error NotMinter();
    error FaucetCooldown(uint256 nextAt);

    constructor() ERC20("Test USDC", "tUSDC") {
        owner = msg.sender;
        minters[msg.sender] = true;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function setMinter(address account, bool allowed) external {
        if (msg.sender != owner) revert NotMinter();
        minters[account] = allowed;
    }

    function mint(address to, uint256 amount) external {
        if (!minters[msg.sender]) revert NotMinter();
        _mint(to, amount);
    }

    /// @notice Anyone can grab 1,000 tUSDC once per hour.
    function faucet() external {
        uint256 next = lastFaucet[msg.sender] + FAUCET_COOLDOWN;
        if (lastFaucet[msg.sender] != 0 && block.timestamp < next) revert FaucetCooldown(next);
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
