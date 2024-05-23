// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Staking} from "../Staking.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

contract TestStaking is Staking {
    constructor(
        address initialOwner,
        IERC20 tokenContract_,
        IERC721Enumerable nftContract_,
        uint256 minStakeAmount_,
        uint256[] memory rates_,
        uint256[] memory periods_,
        uint8[] memory durations_,
        uint256[] memory balanceBounds_,
        uint256[] memory coefficientsMultiplier_,
        uint256[] memory coefficientsLimiter_,
        TimelockController timeLock_
    )
        Staking(
            initialOwner,
            tokenContract_,
            nftContract_,
            minStakeAmount_,
            rates_,
            periods_,
            durations_,
            balanceBounds_,
            coefficientsMultiplier_,
            coefficientsLimiter_,
            timeLock_
        )
    {}

    function pow065(uint256 x) public pure returns (uint256) {
        return _pow065(x);
    }

    function getCoefficientMultiplier(
        uint256 stakeAmount
    ) public view returns (uint256) {
        return _getCoefficientMultiplier(stakeAmount);
    }

    function getCoefficientLimiter(
        uint256 stakeAmount
    ) public view returns (uint256) {
        return _getCoefficientLimiter(stakeAmount);
    }

    function calcWeight(
        uint256 stakeAmount,
        uint8 duration,
        bool hasNFT_
    ) public view returns (uint256) {
        return _calcWeight(stakeAmount, duration, hasNFT_);
    }

    function calcReward(
        uint256 stakeAmount,
        uint256 weightAmount,
        uint8 duration
    ) public view returns (uint256) {
        return _calcReward(stakeAmount, weightAmount, duration);
    }

    function calcRateDiff(
        uint256 stakeAmount,
        uint256 weightAmount,
        uint8 duration
    ) public view returns (uint256) {
        return _calcRateDiff(stakeAmount, weightAmount, duration);
    }
}
