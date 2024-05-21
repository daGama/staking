import { ethers } from "hardhat";

async function main() {

  const MockERC721Token = await ethers.deployContract("MockERC721Token", []);

  await MockERC721Token.waitForDeployment();

  console.log(
    `MockERC721Token deployed to ${MockERC721Token.target}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
