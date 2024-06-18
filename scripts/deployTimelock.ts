import { ethers } from "hardhat";
import CONFIG from "./argumentsTimelock";

async function main() {
  const TimeLock = await ethers.deployContract("TimeLock", CONFIG);

  await TimeLock.waitForDeployment();

  console.log(
    `TimeLock deployed to ${TimeLock.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
