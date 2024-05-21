import { use, expect } from 'chai';
import BigNumber from "bignumber.js";
import chaiBignumber from "chai-bignumber";
use(chaiBignumber(BigNumber));
import { ethers, network } from 'hardhat';
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers';
import {
  TestStaking, MockERC20Token, MockERC721Token,
} from '../typechain-types';
import { MaxUint256 } from 'ethers';
import { CONFIG } from '../scripts/arguments';
const { test: DEPLOY_CONFIG} = CONFIG;

const ERC20_TOKEN_BALANCE = 1e8;
const STAKING_TOKEN_BALANCE = 1e7;

describe("Staking contract", function () {
  async function deploy() {
    const [owner, user] = await ethers.getSigners();

    const ercFactory = await ethers.getContractFactory('MockERC20Token');
    const tokenERC20: MockERC20Token = await ercFactory.deploy('Token', 'TKN', ERC20_TOKEN_BALANCE);
    await tokenERC20.waitForDeployment();

    const nftFactory = await ethers.getContractFactory('MockERC721Token');
    const nft: MockERC721Token = await nftFactory.deploy();
    await nft.waitForDeployment();

    const factory = await ethers.getContractFactory('TestStaking');

    const {
      minStakeAmount,
      rates,
      periods,
      durations,
      balanceBounds,
      coefficientsMultiplier,
      coefficientsLimiter
    } = DEPLOY_CONFIG;

    const staking: TestStaking = await factory.deploy(
      owner,
      tokenERC20.target,
      nft.target,
      minStakeAmount,
      rates,
      periods,
      durations,
      balanceBounds,
      coefficientsMultiplier,
      coefficientsLimiter
    );
    await staking.waitForDeployment();

    // send tokens to Staking contract to pay reward
    await tokenERC20.approve(owner, MaxUint256);
    await tokenERC20.transfer(staking.target, STAKING_TOKEN_BALANCE);

    return {
      staking,
      tokenERC20,
      nft,
      owner,
      user
    };
  }

  describe("Stake", function () {
    it("Should stake tokens and emit event", async function () {
      const { staking, tokenERC20, owner } = await loadFixture(deploy);
      await tokenERC20.approve(staking.target, MaxUint256);
      const stakeAmount = 2e4;
      const constrDuration = 26;
      await staking.stake(stakeAmount, constrDuration);

      await mine(10);

      const staker = await staking.getStaker(owner.address);
      const [[staked, reward, weight, _, claimed, unstaked, duration]] = staker;
      expect(staked).to.equal(stakeAmount);
      expect(reward).to.equal(4450);
      expect(weight).to.equal(124630);
      expect(claimed).to.be.false;
      expect(unstaked).to.be.false;
      expect(duration).to.equal(constrDuration);

      await expect(staking.stake(stakeAmount, constrDuration)).to.emit(staking, "Staked").withArgs(owner, stakeAmount);
    });

    it("Should change max rate after halving", async function () {
      const { staking } = await loadFixture(deploy);
      
      const maxRate = await staking.getMaxRate();
      expect(maxRate).to.equal(DEPLOY_CONFIG.rates[0]);
      await mine(DEPLOY_CONFIG.periods[1], {
        interval: 1
      });

      const halvingRate = await staking.getMaxRate();
      expect(halvingRate).to.equal(DEPLOY_CONFIG.rates[1]);
    });

    it("Should revert error LowStakingAmount", async function () {
      const { staking } = await loadFixture(deploy);
      const stakeAmount = 1;
      const constrDuration = 16;

      await expect(staking.stake(stakeAmount, constrDuration)).to.be.revertedWithCustomError(staking, 'LowStakingAmount');
    });

    it("Should revert error AmountMustBePositive", async function () {
      const { staking } = await loadFixture(deploy);
      const stakeAmount = 0;
      const constrDuration = 16;

      await expect(staking.stake(stakeAmount, constrDuration)).to.be.revertedWithCustomError(staking, 'AmountMustBePositive');
    });

    it("Should revert error InsufficientBalance", async function () {
      const { staking, tokenERC20, owner, user } = await loadFixture(deploy);
      const stakeAmount = 1e5;
      const constrDuration = 16;
      await tokenERC20.transferFrom(owner.address, user.address, stakeAmount);
      await tokenERC20.connect(user).approve(staking.target, stakeAmount);

      await expect(staking.connect(user).stake(stakeAmount + 1, constrDuration)).to.be.revertedWithCustomError(staking, 'InsufficientBalance');
    });

    it("Should revert error InvalidDuration", async function () {
      const { staking } = await loadFixture(deploy);
      const stakeAmount = 1e5;
      const constrDuration = 1;

      await expect(staking.stake(stakeAmount, constrDuration)).to.be.revertedWithCustomError(staking, 'InvalidDuration');
    });
  });

  describe("Claim", function () {
    it("Should claim reward and emit event", async function () {
      const { staking, tokenERC20, owner } = await loadFixture(deploy);
      await tokenERC20.approve(staking.target, MaxUint256);
      const stakeAmount = 2e4;
      const constrDuration = 26;
      await staking.stake(stakeAmount, constrDuration);

      // wait duration time
      await mine(7 * constrDuration, {
        interval: 24 * 60 * 60000
      });

      const reward = 4450;
      const claimAmount = reward;

      const balanceBefore =  (await tokenERC20.balanceOf(owner)).toString();

      // claim reward
      await expect(staking.claimReward(0)).to.emit(staking, "Claimed").withArgs(owner, claimAmount);

      // check balance after reward
      const balanceAfter = (await tokenERC20.balanceOf(owner)).toString();
      const expectedBalance = new BigNumber(balanceBefore).plus(claimAmount);
      expect(balanceAfter).to.be.bignumber.equal(expectedBalance);

      // trying claim twice
      await expect(staking.claimReward(0)).to.be.revertedWithCustomError(staking, 'AlreadyClaimed');
    });

    it("Should unstake and emit event", async function () {
      const { staking, tokenERC20, owner } = await loadFixture(deploy);
      await tokenERC20.approve(staking.target, MaxUint256);
      const stakeAmount = 2e4;
      const constrDuration = 26;
      await staking.stake(stakeAmount, constrDuration);

      // wait duration time
      await mine(7 * constrDuration, {
        interval: 24 * 60 * 60000
      });

      const claimAmount = stakeAmount;

      const balanceBefore =  (await tokenERC20.balanceOf(owner)).toString();

      // unstake
      await expect(staking.unstake(0)).to.emit(staking, "Unstaked").withArgs(owner, claimAmount);

      // check balance after unstake
      const balanceAfter = (await tokenERC20.balanceOf(owner)).toString();
      const expectedBalance = new BigNumber(balanceBefore).plus(claimAmount);
      expect(balanceAfter).to.be.bignumber.equal(expectedBalance);

      // trying claim twice
      await expect(staking.unstake(0)).to.be.revertedWithCustomError(staking, 'AlreadyUnstaked');
    });

    it("Should restake and emit event", async function () {
      const { staking, tokenERC20, owner } = await loadFixture(deploy);
      await tokenERC20.approve(staking.target, MaxUint256);
      const stakeAmount = 2e4;
      const constrDuration = 26;
      await staking.stake(stakeAmount, constrDuration);

      // wait duration time
      await mine(7 * constrDuration, {
        interval: 24 * 60 * 60000
      });

      const reward = 4450;

      const totalStaked = await staking.totalStaked()
      expect(totalStaked).to.equal(stakeAmount);

      // restake
      await expect(staking.restake(0, constrDuration)).to.emit(staking, "Restaked").withArgs(owner, stakeAmount + reward);

      const totalStakedAfterRestake = await staking.totalStaked()
      expect(totalStakedAfterRestake).to.equal(stakeAmount + reward);

      const staker = await staking.getStaker(owner.address);
      expect(staker.length).to.equal(2);

      const [
        __, 
        [newstaked, newreward, newweight, _, claimed, unstaked, duration]
      ] = staker;

      expect(newstaked).to.equal(stakeAmount + reward);
      expect(newreward).to.equal(1679);
      expect(newweight).to.equal(152360);
      expect(claimed).to.be.false;
      expect(unstaked).to.be.false;
      expect(duration).to.equal(constrDuration);

      // trying unstake restaked
      await expect(staking.unstake(0)).to.be.revertedWithCustomError(staking, 'AlreadyUnstaked');
      await expect(staking.claimReward(0)).to.be.revertedWithCustomError(staking, 'AlreadyClaimed');
    });

    it("Should revert error StakeNotFound", async function () {
      const { staking } = await loadFixture(deploy);
      await expect(staking.claimReward(0)).to.be.revertedWithCustomError(staking, 'StakeNotFound');
    });

    it("Should revert error NotYetMatured on unstake", async function () {
      const { staking, tokenERC20 } = await loadFixture(deploy);
      await tokenERC20.approve(staking.target, MaxUint256);
      const stakeAmount = 1e5;
      const constrDuration = 16;

      await staking.stake(stakeAmount, constrDuration);
      await mine(10);

      await expect(staking.claimReward(0)).to.be.revertedWithCustomError(staking, 'NotYetMatured');
    });

    it("Should revert error NotYetMatured on restake", async function () {
      const { staking, tokenERC20 } = await loadFixture(deploy);
      await tokenERC20.approve(staking.target, MaxUint256);
      const stakeAmount = 1e5;
      const constrDuration = 16;

      await staking.stake(stakeAmount, constrDuration);
      await mine(10);

      await expect(staking.restake(0, constrDuration)).to.be.revertedWithCustomError(staking, 'NotYetMatured');
    });

    it("Should revert error InsufficientRewardPool", async function () {
      const { staking, tokenERC20 } = await loadFixture(deploy);
      const stakeAmount = 1e7;
      const constrDuration = 16;
      const reward1 = 1328000;
      const reward2 = 1300000;
      await tokenERC20.approve(staking.target, MaxUint256);

      await staking.stake(stakeAmount, constrDuration)
      let lockedBalance = await staking.lockedBalance();
      expect(await staking.totalStaked()).to.equal(stakeAmount);
      expect(lockedBalance).to.equal(stakeAmount + reward1);

      await staking.stake(stakeAmount, constrDuration)
      lockedBalance = await staking.lockedBalance()
      expect(await staking.totalStaked()).to.equal(2*stakeAmount);
      expect(lockedBalance).to.equal(2*stakeAmount + reward1 + reward2);

      const balance = await tokenERC20.balanceOf(staking.target)

      expect(balance).to.equal(STAKING_TOKEN_BALANCE + 2*stakeAmount);

      const freeBalance = +(balance - lockedBalance).toString()
      expect(freeBalance).to.equal(STAKING_TOKEN_BALANCE - reward1 - reward2);

      // calc big reward and try to stake
      const stakeMaxAmount = ERC20_TOKEN_BALANCE;
      const duration = 26;
      const hasNft = false;
      const weight = (await staking.calcWeight(stakeMaxAmount, duration, hasNft)).toString();
      const reward = (await staking.calcReward(stakeMaxAmount, weight, duration)).toString();

      expect(+reward).to.be.greaterThan(freeBalance);

      await expect(staking.stake(stakeMaxAmount, constrDuration)).to.be.revertedWithCustomError(staking, 'InsufficientRewardPool');
    });
  });

  describe("Calculation", function () {
    it("Should calc pow065", async function () {
      const { staking } = await loadFixture(deploy);
      const duration = 16; // 16 ** 0.65 = 6,06 (toFixed(2))
      const result = await staking.pow065(duration);

      expect(result).to.equal(606);
    });

    it("Should get coefficient multiplier", async function () {
      const { staking } = await loadFixture(deploy);
      const stakeAmount = 1e4;
      const stakeAmount1 = 2e4;
      const stakeAmount2 = 1e9;
      const result = await staking.getCoefficientMultiplier(stakeAmount);
      const result1 = await staking.getCoefficientMultiplier(stakeAmount1);
      const result2 = await staking.getCoefficientMultiplier(stakeAmount2);

      expect(result).to.equal(DEPLOY_CONFIG.coefficientsMultiplier[0]);
      expect(result1).to.equal(DEPLOY_CONFIG.coefficientsMultiplier[1]);
      expect(result2).to.equal(DEPLOY_CONFIG.coefficientsMultiplier[3]);
    });

    it("Should get coefficient limiter", async function () {
      const { staking } = await loadFixture(deploy);
      const stakeAmount = 1e4;
      const stakeAmount1 = 1e9;
      const result = await staking.getCoefficientLimiter(stakeAmount);
      const result1 = await staking.getCoefficientLimiter(stakeAmount1);

      expect(result).to.equal(DEPLOY_CONFIG.coefficientsLimiter[0]);
      expect(result1).to.equal(DEPLOY_CONFIG.coefficientsLimiter[DEPLOY_CONFIG.coefficientsLimiter.length - 1]);
    });

    it("Should calc weight", async function () {
      const { staking } = await loadFixture(deploy);
      const stakeAmount = 2e4;
      const duration = 16;
      const result = await staking.calcWeight(stakeAmount, duration, false);
      const resultNft = await staking.calcWeight(stakeAmount, duration, true);

      const durationPow = (duration ** 0.65).toFixed(2);
      const calculated = Math.round(stakeAmount * 1 * 1.1 * (1 + 0.5 * + durationPow));
      const calculatedNft = Math.round(stakeAmount * 1.1 * 1.1 * (1 + 0.5 * + durationPow));

      expect(durationPow).to.equal('6.06');
      expect(result).to.equal(calculated);
      expect(resultNft).to.equal(calculatedNft);
    });

    it("Should calc reward", async function () {
      const { staking } = await loadFixture(deploy);
      const stakeAmount = 2e4;
      const duration = 26;
      const hasNft = false;
      const weight = (await staking.calcWeight(stakeAmount, duration, hasNft)).toString();
      const diff = (await staking.calcRateDiff(stakeAmount, weight, duration)).toString();
      const result = (await staking.calcReward(stakeAmount, weight, duration)).toString();

      const totalWeight = (await staking.totalWeight()).toString();
      const stakeCoefficient = new BigNumber(weight).div(new BigNumber(weight).plus(totalWeight));
      const coefficientReward = stakeCoefficient.multipliedBy(stakeAmount);
      const apr = 
        new BigNumber(coefficientReward)
          .multipliedBy(10000).multipliedBy(duration)
          .div(52).div(stakeAmount);
      const calculatedDiff = new BigNumber(apr).minus(new BigNumber(DEPLOY_CONFIG.rates[0]).multipliedBy(100));

      const limiter = (await staking.getCoefficientLimiter(stakeAmount)).toString();
      const finalApr = 
        calculatedDiff
          .div(new BigNumber(DEPLOY_CONFIG.rates[2]).multipliedBy(100))
          .plus(DEPLOY_CONFIG.rates[0])
          .minus(limiter);

      const calculated =  finalApr.multipliedBy(stakeAmount).div(100);

      expect(stakeCoefficient).to.equal(1);
      expect(diff).to.equal(calculatedDiff);
      expect(result).to.be.bignumber.equal(calculated);
    });
  });
});