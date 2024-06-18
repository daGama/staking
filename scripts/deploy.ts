import { ethers } from "hardhat";
import { CONFIG } from "./arguments";
const { prod: DEPLOY_CONFIG } = CONFIG;

async function main() {
  const {
    owner,
    tokenContract,
    nftContract,
    minStakeAmount,
    rates,
    periods,
    durations,
    balanceBounds,
    coefficientsMultiplier,
    coefficientsLimiter,
    timeLock,
  } = DEPLOY_CONFIG;

  const Staking = await ethers.deployContract("Staking", [
    owner,
    tokenContract,
    nftContract,
    minStakeAmount,
    rates,
    periods,
    durations,
    balanceBounds,
    coefficientsMultiplier,
    coefficientsLimiter,
    timeLock
  ]);

  await Staking.waitForDeployment();

  console.log(
    `Staking deployed to ${Staking.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
