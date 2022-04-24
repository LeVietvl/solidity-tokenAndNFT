const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("staking", function() {
    let[admin, staker] = []
    let staking
    let stakingReserve
    let gold      
    let amount = ethers.utils.parseEther("100")
    let oneDay = 86400   
    let stakingReserveBalance = ethers.utils.parseEther("1000")
    let address0 = "0x0000000000000000000000000000000000000000"
    beforeEach(async () => {
        [admin, staker] = await ethers.getSigners();   
        const Gold =  await ethers.getContractFactory("Gold");
        gold = await Gold.deploy()
        await gold.deployed()

        const StakingReserve =  await ethers.getContractFactory("StakingReserve");
        stakingReserve = await StakingReserve.deploy(gold.address)
        await stakingReserve.deployed()

        const Stakingx =  await ethers.getContractFactory("Stakingx");
        staking = await Stakingx.deploy(gold.address, stakingReserve.address)
        await staking.deployed()

        await stakingReserve.setStakeAddress(staking.address)      
        await gold.transfer(staker.address, ethers.utils.parseEther("200"))
        await gold.transfer(stakingReserve.address, stakingReserveBalance)
        await gold.connect(staker).approve(staking.address, ethers.utils.parseEther("200"))              
    })

    describe("add staking package", function() {
        it("should revert if rate >= 10^(Decimal+2)", async function () {
            await expect(staking.addStakePackage(101, 0, ethers.utils.parseEther("100"), oneDay*180)).to.be.revertedWith("Stakingx: bad  interest rate")              
        });
        it("should add staking package correctly", async function () {
            const packageTx = await staking.addStakePackage(10, 0, ethers.utils.parseEther("100"), oneDay*180) 
            await expect(packageTx).to.be.emit(staking, "PackageInfo").withArgs(1, 10, 0, ethers.utils.parseEther("100"), oneDay*180, false)
            const packageTx2 = await staking.addStakePackage(20, 0, ethers.utils.parseEther("100"), oneDay*360) 
            await expect(packageTx2).to.be.emit(staking, "PackageInfo").withArgs(2, 20, 0, ethers.utils.parseEther("100"), oneDay*360, false)         
        });    
    })
    describe("remove stake package", function() {
        beforeEach(async () => {
            await staking.addStakePackage(10, 0, ethers.utils.parseEther("100"), oneDay*180)            
            
        })
        it("should revert if packageId not exist", async function () {
            await expect(staking.removeStakePackage(2)).to.be.revertedWith("Stakingx: packageId not exist")              
        });
        it("should remove staking package correctly", async function () {
            const packageTx = await staking.removeStakePackage(1)
            const package = await staking.stakePackages(1)
            expect (package.isOffline).to.be.equal(true)
            await expect(packageTx).to.be.emit(staking, "PackageInfo").withArgs(1, 10, 0, ethers.utils.parseEther("100"), oneDay*180, true)        
        });    
    })

    describe("add stake", function() {
        beforeEach(async () => {
            await staking.addStakePackage(10, 0, amount, oneDay*360)            
        })
        it("should revert if packageId not exist", async function () {
            await expect(staking.connect(staker).stake(amount, 2)).to.be.revertedWith("Stakingx: packageId not exist")              
        }); 
        it("should revert if packageId not available", async function () {
            await staking.removeStakePackage(1)
            await expect(staking.connect(staker).stake(amount, 1)).to.be.revertedWith("Stakingx: packageId is not available")
        });
        it("should revert if amount is less than min staking", async function () {            
            await expect(staking.connect(staker).stake(amount.sub(100), 1)).to.be.revertedWith("Stakingx: Your stake amount should be greater than minStaking")
        });
        it("should stake correctly when amount = 0", async function () {            
            const stakeTx1 = await staking.connect(staker).stake(amount, 1)
            await expect(stakeTx1).to.be.emit(staking, "StakeUpdate").withArgs(staker.address, 1, amount, 0)
            expect(await gold.balanceOf(staker.address)).to.be.equal(ethers.utils.parseEther("100"))
            expect(await gold.balanceOf(stakingReserve.address)).to.be.equal(amount.add(stakingReserveBalance))

            const blockNum = await ethers.provider.getBlockNumber();
            const block = await ethers.provider.getBlock(blockNum);            
            console.log("timestamp1: ", block.timestamp)

            await network.provider.send("evm_increaseTime", [oneDay* 180]);
            await network.provider.send('evm_mine', []);

            const blockNum1 = await ethers.provider.getBlockNumber();
            const block1 = await ethers.provider.getBlock(blockNum1);
            console.log("timestamp2: ", block1.timestamp) 

            const profitTx = amount.mul(10).div(100).mul(oneDay* 180).div(oneDay* 360)              
            expect(await staking.connect(staker).calculateProfit(1)).to.be.equal(profitTx)     
            console.log("ProfitTx: ", profitTx)    
        });               
        it("should stake correctly when amount > 0", async function () {
            await staking.connect(staker).stake(amount, 1)         
            await network.provider.send("evm_increaseTime", [oneDay* 180])
            await network.provider.send('evm_mine', []);
            const stakeTx2 = await staking.connect(staker).stake(amount, 1) 
            const stakeInfo = await staking.connect(staker).stakes(staker.address, 1)                  
            console.log("ProfitTemp: ", stakeInfo.totalProfit)    
            
            await expect(stakeTx2).to.be.emit(staking, "StakeUpdate").withArgs(staker.address, 1, amount.mul(2), stakeInfo.totalProfit)

            const blockNum = await ethers.provider.getBlockNumber()
            const block = await ethers.provider.getBlock(blockNum)          
            expect(stakeInfo.startTime).to.be.equal(block.timestamp)

        });
    })

    describe("unstake", function() {
        beforeEach(async () => {
            await staking.addStakePackage(10, 0, amount, oneDay*360)
            await staking.connect(staker).stake(amount, 1)
                    
        })
        it("should revert if packageId not exist", async function () {
            await network.provider.send("evm_increaseTime", [oneDay* 360])
            await network.provider.send('evm_mine', [])
            await expect(staking.connect(staker).unStake(2)).to.be.revertedWith("Stakingx: packageId not exist")              
        }); 
        it("should revert if stake is still in lock time", async function () {
            await network.provider.send("evm_increaseTime", [oneDay* 180])
            await network.provider.send('evm_mine', [])
            await expect(staking.connect(staker).unStake(1)).to.be.revertedWith("Stakingx: your stake is still in lock time")              
        }); 
        // it("should revert if stake is already withdrawn", async function () {
        //     await network.provider.send("evm_increaseTime", [oneDay* 360])
        //     await network.provider.send('evm_mine', [])
        //     await staking.connect(staker).unStake(1)
        //     await expect(staking.connect(staker).unStake(1)).to.be.revertedWith("Stakingx: your stake is already withdrawn or not exist")              
        // });
        it("should unstake correctly", async function () {
            await network.provider.send("evm_increaseTime", [oneDay* 360])
            await network.provider.send('evm_mine', [])
            const unStake1 = await staking.connect(staker).unStake(1)
            const totalProfit1 = amount.mul(10).div(100)
            console.log("totalProfit1: ", totalProfit1)
            const stakeInfo = await staking.connect(staker).stakes(staker.address, 1) 
            console.log("ProfitTemp: ", stakeInfo.totalProfit) 

            // expect(gold.balanceOf(stakingReserve.address)).to.be.equal(stakingReserveBalance.sub(totalProfit1))
            // await expect(unStake1).to.be.emit(staking, "StakeReleased").withArgs(staker.address, 1, amount, totalProfit1)
        });
    })

})