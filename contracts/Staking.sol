// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import {ABDKMath64x64} from "./ABDKMath64x64.sol";

/// Amount Must Be Positive
error AmountMustBePositive();

/// Staking amount less then minimum value.
/// @param amount staking amount.
/// @param minimum minimum value.
error LowStakingAmount(uint256 amount, uint256 minimum);

/// Insufficient balance for transfer. Needed `required` but only `available` available.
/// @param available balance available.
/// @param required requested amount to transfer.
error InsufficientBalance(uint256 available, uint256 required);

/// Reward too small.
error RewardTooSmall();

/// Already claimed.
error AlreadyClaimed();

/// Already claimed.
error AlreadyUnstaked();

/// Already started.
error AlreadyStarted();

/// Stake not found.
error StakeNotFound();

/// Not yet started.
error NotYetStarted();

/// Not yet matured.
error NotYetMatured();

/// Invalid duration.
error InvalidDuration();

/// Insufficient reward pool.
error InsufficientRewardPool(uint256 available, uint256 required);

/// Invalid constructor value.
error InvalidConstructorValue(string msg);

/// Invalid periods value.
error InvalidPeriods(string msg);

/// Only Timelock.
error OnlyTimelockAccess();

/**
 * @title Staking
 * @dev A contract that allows users to stake ERC20 tokens and receive rewards based on their NFT holdings
 */
contract Staking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // The ERC20 token contract
    IERC20 public immutable tokenContract;

    // The ERC721 NFT contract
    IERC721Enumerable public immutable nftContract;

    // The maximum, halving, additional rates
    // 0 - maxRate
    // 1 - halvingRate
    // 2 - additionalRate
    // 3 - maxAdditionalRate
    uint256[] public rates;

    // Staking start and halving periods
    // 0 - start
    // 1 - halving
    uint256[] public periods;

    // Available staking durations
    uint8[] public durations;

    // Coefficients to calc user rate
    uint256[] public balanceBounds;
    uint256[] public coefficientsMultiplier;
    uint256[] public coefficientsLimiter;

    // The minimum staking amount
    uint256 public minStakeAmount;

    // The total staked amount
    uint256 public totalStaked;

    // The total locked balance
    uint256 public lockedBalance;

    // The total staked amount
    uint256 public totalWeight;

    TimelockController public timeLock;

    // A struct to store the staking information of a user
    struct Staker {
        uint256 stakeAmount; // The amount of tokens staked by the user
        uint256 rewardAmount; // The amount of tokens rewarded to the user
        uint256 weightAmount; // The amount of tokens weight to the user
        uint256 startTime; // The timestamp when the user started staking
        bool claimed; // A flag to indicate if the user has claimed the reward
        bool unstaked; // A flag to indicate if the user has unstaked
        uint8 duration; // The duration of the staking period in weeks
    }

    // A mapping from user address to their staking information
    mapping(address => Staker[]) public stakers;

    // An event to log when a user stakes tokens
    event Staked(address indexed staker, uint256 stakeAmount);

    // An event to log when a user claims the reward
    event Claimed(address indexed staker, uint256 rewardAmount);

    // An event to log when a user unstakes tokens
    event Unstaked(address indexed staker, uint256 unstakeAmount);

    // An event to log when a user restakes tokens
    event Restaked(address indexed staker, uint256 stakeAmount);

    // An event to log when the periods changes
    event ChangePeriods(uint256[] _per);

    /**
     * @dev The constructor function that sets the token contracts and the max reward rate
     */
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
    ) Ownable(initialOwner) {
        if (durations_.length != coefficientsLimiter_.length)
            revert InvalidConstructorValue(
                "Lengths of durations and coefficientsLimiter are not same"
            );
        if (balanceBounds_.length != coefficientsMultiplier_.length - 1)
            revert InvalidConstructorValue("Invalid balanceBounds length");
        if (durations_.length == 0)
            revert InvalidConstructorValue("Invalid durations length");
        if (periods_.length != 2)
            revert InvalidPeriods("Invalid periods length");

        tokenContract = tokenContract_;
        nftContract = nftContract_;
        minStakeAmount = minStakeAmount_;
        rates = rates_;
        periods.push(block.timestamp + periods_[0]);
        periods.push(block.timestamp + periods_[1]);
        durations = durations_;
        balanceBounds = balanceBounds_;
        coefficientsMultiplier = coefficientsMultiplier_;
        coefficientsLimiter = coefficientsLimiter_;
        timeLock = timeLock_;
    }

    modifier validDuration(uint8 duration) {
        bool durationExists = false;
        for (uint8 i = 0; i < durations.length; ) {
            if (durations[i] == duration) {
                durationExists = true;
                break;
            }
            unchecked {
                i++;
            }
        }
        if (!durationExists) revert InvalidDuration();
        _;
    }

    modifier onlyTimeLock() {
        if (msg.sender != address(timeLock)) revert OnlyTimelockAccess();
        _;
    }

    /**
     * @dev The function that allows users to stake tokens
     * @param stakeAmount The amount of tokens to stake
     * @param duration The duration of the staking period in weeks
     */
    function stake(
        uint256 stakeAmount,
        uint8 duration
    ) public whenNotPaused nonReentrant validDuration(duration) {
        if (block.timestamp <= periods[0]) revert NotYetStarted();
        if (stakeAmount <= 0) revert AmountMustBePositive();
        if (stakeAmount < minStakeAmount)
            revert LowStakingAmount(stakeAmount, minStakeAmount);
        if (tokenContract.balanceOf(msg.sender) < stakeAmount)
            revert InsufficientBalance(
                tokenContract.balanceOf(msg.sender),
                stakeAmount
            );

        bool withNFT = hasNFT(msg.sender);
        uint256 weightAmount = _calcWeight(stakeAmount, duration, withNFT);
        uint256 rewardAmount = _calcReward(stakeAmount, weightAmount, duration, withNFT);

        if (rewardAmount == 0) revert RewardTooSmall();

        uint256 contractBalance = tokenContract.balanceOf(address(this));
        if (contractBalance < lockedBalance + rewardAmount)
            revert InsufficientRewardPool(
                contractBalance,
                lockedBalance + rewardAmount
            );

        tokenContract.safeTransferFrom(msg.sender, address(this), stakeAmount);

        totalStaked += stakeAmount;
        lockedBalance += stakeAmount + rewardAmount;
        totalWeight += weightAmount;

        Staker memory newStaker = Staker(
            stakeAmount,
            rewardAmount,
            weightAmount,
            block.timestamp,
            false,
            false,
            duration
        );
        stakers[msg.sender].push(newStaker);

        emit Staked(msg.sender, stakeAmount);
    }

    /**
     * @dev The function that allows users to restake tokens
     * @param index_ The index of completed stake
     * @param duration The duration of the staking period in weeks
     */
    function restake(
        uint256 index_,
        uint8 duration
    ) public whenNotPaused nonReentrant validDuration(duration) {
        Staker[] storage stakes = stakers[msg.sender];
        if (stakes.length < index_ + 1) revert StakeNotFound();
        if (stakes[index_].unstaked) revert AlreadyUnstaked();
        if (
            block.timestamp <
            stakes[index_].startTime + stakes[index_].duration * 1 weeks
        ) revert NotYetMatured();

        uint256 unstakedAmount = stakes[index_].stakeAmount;
        uint256 claimedAmount = stakes[index_].rewardAmount;

        uint256 stakedAmount = unstakedAmount + claimedAmount;
        if (stakedAmount <= 0) revert AmountMustBePositive();
        if (stakedAmount < minStakeAmount)
            revert LowStakingAmount(stakedAmount, minStakeAmount);

        bool withNFT = hasNFT(msg.sender);
        uint256 weightAmount = _calcWeight(stakedAmount, duration, withNFT);
        uint256 rewardAmount = _calcReward(
            stakedAmount,
            weightAmount,
            duration,
            withNFT
        );

        if (rewardAmount == 0) revert RewardTooSmall();

        uint256 contractBalance = tokenContract.balanceOf(address(this));
        if (contractBalance < lockedBalance + rewardAmount)
            revert InsufficientRewardPool(
                contractBalance,
                lockedBalance + rewardAmount
            );

        totalWeight -= stakes[index_].weightAmount;
        totalStaked -= unstakedAmount;

        stakes[index_].stakeAmount = 0;
        stakes[index_].rewardAmount = 0;
        stakes[index_].claimed = true;
        stakes[index_].unstaked = true;

        totalWeight += weightAmount;
        lockedBalance += rewardAmount;
        totalStaked += stakedAmount;

        Staker memory newStaker = Staker(
            stakedAmount,
            rewardAmount,
            weightAmount,
            block.timestamp,
            false,
            false,
            duration
        );
        stakers[msg.sender].push(newStaker);

        emit Restaked(msg.sender, stakedAmount);
    }

    /**
     * @dev The function that allows users to unstake
     * @param index_ User stake index
     */
    function unstake(uint256 index_) external whenNotPaused nonReentrant {
        Staker[] storage stakes = stakers[msg.sender];
        if (stakes.length < index_ + 1) revert StakeNotFound();
        if (stakes[index_].unstaked) revert AlreadyUnstaked();
        if (
            block.timestamp <
            stakes[index_].startTime + stakes[index_].duration * 1 weeks
        ) revert NotYetMatured();
        stakes[index_].unstaked = true;
        uint256 unstakedAmount = stakes[index_].stakeAmount;

        uint256 contractBalance = tokenContract.balanceOf(address(this));
        if (contractBalance < lockedBalance)
            revert InsufficientRewardPool(contractBalance, lockedBalance);

        totalStaked -= unstakedAmount;
        lockedBalance -= unstakedAmount;
        totalWeight -= stakes[index_].weightAmount;

        stakes[index_].stakeAmount = 0;

        tokenContract.safeTransfer(msg.sender, unstakedAmount);
        emit Unstaked(msg.sender, unstakedAmount);
    }

    /**
     * @dev The function that allows users to claim the reward
     * @param index_ User stake index
     */
    function claimReward(uint256 index_) external whenNotPaused nonReentrant {
        Staker[] storage stakes = stakers[msg.sender];
        if (stakes.length < index_ + 1) revert StakeNotFound();
        if (stakes[index_].claimed) revert AlreadyClaimed();
        if (
            block.timestamp <
            stakes[index_].startTime + stakes[index_].duration * 1 weeks
        ) revert NotYetMatured();

        uint256 claimedAmount = stakes[index_].rewardAmount;

        // Check if the contract has enough balance to cover the reward
        uint256 contractBalance = tokenContract.balanceOf(address(this));
        if (contractBalance < lockedBalance)
            revert InsufficientRewardPool(contractBalance, lockedBalance);

        lockedBalance -= claimedAmount;

        stakes[index_].claimed = true;
        stakes[index_].rewardAmount = 0;

        tokenContract.safeTransfer(msg.sender, claimedAmount);
        emit Claimed(msg.sender, claimedAmount);
    }

    /**
     * @dev The function that returns staker by address
     * @param addr Staker address
     * @return Staker stakes
     */
    function getStaker(address addr) public view returns (Staker[] memory) {
        return stakers[addr];
    }

    /**
     * @dev The function that checks if a user owns any NFT
     * @param user The address of the user
     * @return True if the user owns any NFT, false otherwise
     */
    function hasNFT(address user) public view returns (bool) {
        uint256 balance = nftContract.balanceOf(user);
        return balance > 0;
    }

    /**
     * @dev The function that returns current max rate
     */
    function getMaxRate() public view returns (uint256) {
        return block.timestamp < periods[1] ? rates[0] : rates[1];
    }

    /**
     * @dev The function that calculates the reward amount for a user based on their stake amount and NFT status
     * @param stakeAmount The amount of tokens staked by the user
     * @param weightAmount The user  calculated weight
     * @param duration The user stake duration
     * @return The reward amount for the user
     */
    function _calcReward(
        uint256 stakeAmount,
        uint256 weightAmount,
        uint8 duration,
        bool hasNFT_
    ) internal view returns (uint256) {
        uint256 diff = _calcRateDiff(stakeAmount, weightAmount, duration);
        uint256 limiter = _getCoefficientLimiter(duration);
        uint256 adds = diff / rates[2];
        adds = adds > 100 * rates[3] ? 100 * rates[3] : adds;
        if(hasNFT_) adds += 100 * rates[3];
        uint256 yearApr = 100 * (getMaxRate() - limiter) + adds;
        uint256 finalApr = (duration * yearApr) / 52;

        return (finalApr * stakeAmount) / 10000;
    }

    /**
     * @dev The function that calculates difference between max rate and calculated
     * @param stakeAmount The amount of tokens staked by the user
     * @param weightAmount The user  calculated weight
     * @param duration The user stake duration
     * @return The rate difference
     */
    function _calcRateDiff(
        uint256 stakeAmount,
        uint256 weightAmount,
        uint8 duration
    ) internal view returns (uint256) {
        uint256 calculatedReward = (stakeAmount * weightAmount) /
            (weightAmount + totalWeight);
        uint256 apr = (10000 * calculatedReward * duration) /
            (52 * stakeAmount);
        uint256 maxRate_ = getMaxRate();

        if (apr < 100 * maxRate_) return 0;

        return apr - (100 * maxRate_);
    }

    /**
     * @dev The function that calculates user weight
     * @param stakeAmount The amount of tokens staked by the user
     * @param duration The user stake duration
     * @param hasNFT_ The flag owns of nft
     * @return The weight amount for the user
     */
    function _calcWeight(
        uint256 stakeAmount,
        uint8 duration,
        bool hasNFT_
    ) internal view returns (uint256) {
        uint256 multiplier = _getCoefficientMultiplier(stakeAmount);
        uint8 nftMultiplier = hasNFT_ ? 11 : 10;
        uint256 durationPow = _pow065(duration);
        uint256 durationMultiplier = 100 + (50 * durationPow) / 100;

        return
            (stakeAmount * multiplier * nftMultiplier * (durationMultiplier)) /
            100000;
    }

    /**
     * @dev The function that calculates ** 0.65
     * @param x Number
     * @return Number ** 0.65
     */
    function _pow065(uint256 x) internal pure returns (uint256) {
        int128 x128 = ABDKMath64x64.fromUInt(x);
        return
            ABDKMath64x64.mulu(
                ABDKMath64x64.exp((ABDKMath64x64.ln(x128) * 65) / 100),
                100
            );
    }

    /**
     * @dev The function that calculates multiplier coefficient by stake amount
     * @param stakeAmount The amount of tokens staked by the user
     * @return The multiplier coefficient
     */
    function _getCoefficientMultiplier(
        uint256 stakeAmount
    ) internal view returns (uint256) {
        uint256 length = balanceBounds.length;
        for (uint256 i = 0; i < length; ) {
            uint256 balanceBound = balanceBounds[i];
            uint256 coefficientMultiplier = coefficientsMultiplier[i];

            if (balanceBound > stakeAmount) {
                return coefficientMultiplier;
            }

            unchecked {
                i++;
            }
        }

        return coefficientsMultiplier[coefficientsMultiplier.length - 1];
    }

    /**
     * @dev The function that calculates limiter coefficient by duration
     * @param duration The duration
     * @return The limiter coefficient
     */
    function _getCoefficientLimiter(
        uint256 duration
    ) internal view returns (uint256) {
        uint256 length = durations.length;
        for (uint256 i = 0; i < length; ) {
            uint256 dur = durations[i];
            uint256 coefficientLimiter = coefficientsLimiter[i];

            if (dur >= duration) {
                return coefficientLimiter;
            }

            unchecked {
                i++;
            }
        }

        return coefficientsLimiter[coefficientsLimiter.length - 1];
    }

    /**
     * @dev The function that allows the owner to pause the staking contract
     */
    function pause() external onlyTimeLock {
        _pause();
    }

    /**
     * @dev The function that allows the owner to unpause the staking contract
     */
    function unpause() external onlyTimeLock {
        _unpause();
    }

    function changePeriods(uint256[] calldata _per) external onlyTimeLock {
        if (_per.length < 2) revert InvalidPeriods("Invalid periods length");
        if (block.timestamp >= periods[0]) revert AlreadyStarted();
        periods[0] = block.timestamp + _per[0];
        periods[1] = block.timestamp + _per[1];
        emit ChangePeriods(_per);
    }

    function schedulePause() external onlyOwner {
        bytes memory data = abi.encodeWithSignature("pause()");
        timeLock.schedule(
            address(this),
            0,
            data,
            bytes32(0),
            bytes32(0),
            timeLock.getMinDelay()
        );
    }

    function scheduleUnpause() external onlyOwner {
        bytes memory data = abi.encodeWithSignature("unpause()");
        timeLock.schedule(
            address(this),
            0,
            data,
            bytes32(0),
            bytes32(0),
            timeLock.getMinDelay()
        );
    }


    function scheduleChangePeriods(uint256[] calldata periods_) external onlyOwner {
        bytes memory data = abi.encodeWithSignature(
            "changePeriods(uint256[])",
            periods_);
        timeLock.schedule(
            address(this),
            0,
            data,
            bytes32(0),
            bytes32(0),
            timeLock.getMinDelay()
        );
    }

    function executeChangePeriods(uint256[] calldata periods_) external {
        bytes memory data = abi.encodeWithSignature(
            "changePeriods(uint256[])",
            periods_);
        timeLock.execute(address(this), 0, data, bytes32(0), bytes32(0));
    }

    function executePause() external {
        bytes memory data = abi.encodeWithSignature("pause()");
        timeLock.execute(address(this), 0, data, bytes32(0), bytes32(0));
    }

    function executeUnpause() external {
        bytes memory data = abi.encodeWithSignature("unpause()");
        timeLock.execute(address(this), 0, data, bytes32(0), bytes32(0));
    }
}