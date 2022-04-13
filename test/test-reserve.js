const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("reserve", function() {
    let [admin, receiver, seller, buyer] = []
    let gold
    let reserve
    let address0 = "0x0000000000000000000000000000000000000000"
    let reserveBalance = ethers.utils.parseEther("1000")
    let oneWeek = 86400*7
    beforeEach(async () => {
        [admin, receiver, seller, buyer] = await ethers.getSigners()
        const Gold = await ethers.getContractFactory("Gold")
        gold = await Gold.deploy()
        await gold.deployed()
        const Reserve = await ethers.getContractFactory("Reserve")
        reserve = await Reserve.deploy(gold.address)
        await reserve.deployed()        
    })
    describe("withdrawTo", function() {
        beforeEach(async () => {
            await gold.transfer(reserve.address, reserveBalance)
        })
        it("should revert if the caller is not the contract owner", async function () {
            await expect(reserve.connect(receiver).withdrawTo(receiver.address, reserveBalance)).to.be.revertedWith("Ownable: caller is not the owner")
        });
        it("should revert if it has not reached unlock time", async function () {
            await expect(reserve.withdrawTo(receiver.address, reserveBalance)).to.be.revertedWith("Reverse: Can not trade")
        });           
        it("should revert if recipient is address(0)", async function () {
            await network.provider.send("evm_increaseTime", [oneWeek * 24])
            await expect(reserve.withdrawTo(address0, reserveBalance)).to.be.revertedWith("Reserve: Recipient address must be different from address(0)")
        });
        it("should revert if reserve contract does not have enough token", async function () {
            await network.provider.send("evm_increaseTime", [oneWeek * 24])
            await expect(reserve.withdrawTo(receiver.address, reserveBalance + 1)).to.be.revertedWith("Reserve: Not enough token")
        });
        it("should withdraw correctly", async function () {
            await network.provider.send("evm_increaseTime", [oneWeek * 24])
            expect (await gold.balanceOf(reserve.address)).to.be.equal(reserveBalance)            
            await reserve.withdrawTo(receiver.address, reserveBalance)            
            expect (await gold.balanceOf(reserve.address)).to.be.equal(0)
            expect (await gold.balanceOf(receiver.address)).to.be.equal(reserveBalance)
        });
    }) 
    describe("combine with marketplace contract", function() {
        it("should work correctly with marketplace", async function () { 
            let petty            
            let marketplace
            let defaultFeeRate = 10
            let defaultFeeDecimal = 0
            let feeRecipient = reserve.address
            let defaultPrice = ethers.utils.parseEther("100")
            let defaultBalance = ethers.utils.parseEther("10000")
            
            const Petty = await ethers.getContractFactory("Petty");
            petty = await Petty.deploy()
            await petty.deployed()            

            const Marketplace = await ethers.getContractFactory("MarketPlace");
            marketplace = await Marketplace.deploy(petty.address, defaultFeeDecimal, defaultFeeRate, feeRecipient)    
            await marketplace.deployed()

            await marketplace.addPaymentToken(gold.address)
            await gold.transfer(seller.address, defaultBalance)
            await gold.transfer(buyer.address, defaultBalance)

            await petty.mint(seller.address)        
                  
            await petty.connect(seller).setApprovalForAll(marketplace.address, true)
            await marketplace.connect(seller).addOrder(1, gold.address, defaultPrice)
            await gold.connect(buyer).approve(marketplace.address, defaultPrice)
            
            const excuteOrderTx = await marketplace.connect(buyer).executeOrder(1)
            await expect(excuteOrderTx).to.be.emit(marketplace, "OrderMatched").withArgs(1, seller.address, buyer.address, 1, gold.address, defaultPrice)                        
            const feeAmount = defaultPrice.mul(10).div(100)            
            expect (await gold.balanceOf(feeRecipient)).to.be.equal(feeAmount)
            expect (await gold.balanceOf(buyer.address)).to.be.equal(defaultBalance.sub(defaultPrice))
            expect (await gold.balanceOf(seller.address)).to.be.equal(defaultBalance.add(defaultPrice).sub(feeAmount))
            expect (await petty.ownerOf(1)).to.be.equal(buyer.address)

            await network.provider.send("evm_increaseTime", [oneWeek * 24])                  
            await reserve.withdrawTo(receiver.address, feeAmount)            
            expect (await gold.balanceOf(feeRecipient)).to.be.equal(0)
            expect (await gold.balanceOf(receiver.address)).to.be.equal(feeAmount)
        }); 
    })         
})