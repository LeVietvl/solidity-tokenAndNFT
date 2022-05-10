const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("staking", function () {
     let [admin, staker] = []
     let staking
     let stakingReserve
     let gold
     let amount = ethers.utils.parseEther("100")
     let oneDay = 86400
     let stakingReserveBalance = ethers.utils.parseEther("1000")
     let address0 = "0x0000000000000000000000000000000000000000"
     beforeEach(async () => {
          [admin, staker] = await ethers.getSigners();
          const Gold = await ethers.getContractFactory("Gold");
          gold = await Gold.deploy()
          await gold.deployed()

          const StakingReserve = await ethers.getContractFactory("StakingReserve");
          stakingReserve = await StakingReserve.deploy(gold.address)
          await stakingReserve.deployed()

          const Stakingx = await ethers.getContractFactory("Stakingx");
          staking = await Stakingx.deploy(gold.address, stakingReserve.address)
          await staking.deployed()

          await stakingReserve.setStakeAddress(staking.address)
          await gold.transfer(staker.address, ethers.utils.parseEther("200"))
          await gold.transfer(stakingReserve.address, stakingReserveBalance)
          await gold.connect(staker).approve(staking.address, ethers.utils.parseEther("200"))
     })
     describe("unstake", function () {
          beforeEach(async () => {
               await staking.addStakePackage(10, 0, amount, oneDay * 360)
               await staking.connect(staker).stake(amount, 1)
          })
          it("should unstake correctly when no stake update", async function () {
               const blockNumBefore = await ethers.provider.getBlockNumber()
               const blockBefore = await ethers.provider.getBlock(blockNumBefore)
               await network.provider.send("evm_increaseTime", [oneDay * 360])
               await network.provider.send('evm_mine', [])
               const profitTx = await staking.connect(staker).calculateProfit(1)
               console.log("Profit", profitTx.toString())

               const unstakingTx = await staking.connect(staker).unStake(1)
               const balanceOfStaker = await gold.balanceOf(staker.address)
               const totalProfit = balanceOfStaker.sub(amount.mul(2))
               console.log("Total profit by function: ", totalProfit.toString())
          });
     })
})