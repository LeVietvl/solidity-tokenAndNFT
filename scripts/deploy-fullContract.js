// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  let petty
  let gold
  let tokenSale
  let reserve
  let marketplace
  let defaultFeeRateMarketPlace = 0
  let defaultFeeDecimalMarketPlace = 0
  let defaultFeeRateTokenSale = 0
  let defaultFeeDecimalTokenSale = 0

    // deploy Petty contract
    const Petty = await ethers.getContractFactory("Petty");
    petty = await Petty.deploy()
    await petty.deployed()    
    console.log("Petty deployed to:", petty.address)

    // deploy Gold contract
    const Gold = await ethers.getContractFactory("Gold");
    gold = await Gold.deploy()
    await gold.deployed()    
    console.log("Gold deployed to:", gold.address)
    
    // deploy TokenSale contract
    const TokenSale = await ethers.getContractFactory("TokenSale");
    tokenSale = await TokenSale.deploy(gold.address, defaultFeeDecimalTokenSale, defaultFeeRateTokenSale)
    const tranfserTx = await gold.transfer(tokenSale.address, ethers.utils.parseEther("1000000"))
    await tranfserTx.wait()
    await tokenSale.deployed()
    console.log("TokenSale deployed to:", tokenSale.address)
    
    // deploy Reserve contract
    const Reserve = await ethers.getContractFactory("Reserve")
    reserve = await Reserve.deploy(gold.address)
    await reserve.deployed()
    console.log("Reserve deployed to:", reserve.address)

    // deploy MarketPlace 
    const Marketplace = await ethers.getContractFactory("MarketPlace");
    marketplace = await Marketplace.deploy(petty.address, defaultFeeDecimalMarketPlace, defaultFeeRateMarketPlace, reserve.address)    
    await marketplace.deployed()
    console.log("MarketPlace deployed to:", marketplace.address)

    const addPaymentTokenTx = await marketplace.addPaymentToken(gold.address)
    await addPaymentTokenTx.wait()

    console.log("Gold is payment token: True or False:", await marketplace.isPaymentTokenSupported(gold.address))
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
