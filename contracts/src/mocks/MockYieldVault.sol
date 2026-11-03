// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// @notice Test-only ERC-4626 vault that earns a fixed APR by minting MockUSDC to itself.
///         The APR is deliberately high on testnet so creator income visibly ticks up in a
///         demo. It stands in for a Morpho/Moonwell vault and is never used on mainnet.
contract MockYieldVault is ERC4626 {
    uint256 public aprBps; // 10_000 = 100% APR
    uint256 public lastDrip;
    address public immutable owner;

    event AprUpdated(uint256 aprBps);

    constructor(MockUSDC usdc, uint256 aprBps_)
        ERC20("Demo Yield Vault tUSDC", "dyvUSDC")
        ERC4626(IERC20(address(usdc)))
    {
        owner = msg.sender;
        aprBps = aprBps_;
        lastDrip = block.timestamp;
    }

    function setApr(uint256 aprBps_) external {
        require(msg.sender == owner, "owner");
        _drip();
        aprBps = aprBps_;
        emit AprUpdated(aprBps_);
    }

    function pendingDrip() public view returns (uint256) {
        uint256 bal = IERC20(asset()).balanceOf(address(this));
        return (bal * aprBps * (block.timestamp - lastDrip)) / (365 days * 10_000);
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + pendingDrip();
    }

    function drip() external {
        _drip();
    }

    function _drip() internal {
        uint256 amount = pendingDrip();
        lastDrip = block.timestamp;
        if (amount > 0) MockUSDC(asset()).mint(address(this), amount);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        _drip();
        super._deposit(caller, receiver, assets, shares);
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
    {
        _drip();
        super._withdraw(caller, receiver, owner_, assets, shares);
    }
}
