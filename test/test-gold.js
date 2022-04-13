const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GOLD", function () {
    let [accountA,accountB,accountC] =[]
    let token
    let amount = ethers.utils.parseUnits("100", "ether")
    let address0 = "0x00000000000000000000000000000000000000000"
    let totalSupply = ethers.utils.parseUnits("1000000", "ether")
    beforeEach(async () => {
        [accountA,accountB,accountC] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("Gold");
        token = await Token.deploy()
        await token.deployed()
    })

    describe("common", function() {
        it("total supply should return right value", async function (){
            expect(await token.totalSupply()).to.be.equal(totalSupply)
        });
        it("balance of account A should return right value", async function (){
            expect(await token.balanceOf(accountA.address)).to.be.equal(totalSupply)
        });
        it("balance of account B should return right value", async function (){
            expect(await token.balanceOf(accountB.address)).to.be.equal(0)
        });
        it("allowance of account A should return right value", async function (){
            expect(await token.allowance(accountA.address, accountB.address)).to.be.equal(0)
        });
    })
    describe("paused()", function() {
        it("should revert if not pauser role", async function (){
           await expect(token.connect(accountB).pause()).to.be.reverted
        });
        it("should revert if contract has been paused", async function (){
            await token.pause()
            await expect(token.pause()).to.be.revertedWith("Pausable: paused")            
        });
        it("should pause contract correctly", async function (){
            const pauseTx = await token.pause()
            await expect(pauseTx).to.be.emit(token, "Paused").withArgs(accountA.address)
            await expect(token.transfer(accountB.address, amount)).to.be.revertedWith("Pausable: paused")
        });
    })
    describe("unpaused()", function() {
        beforeEach(async () => {
            await token.pause()
        })
        it("should revert if not pauser role", async function (){
           await expect(token.connect(accountB).pause()).to.be.reverted
        });
        it("should revert if contract has been unpaused", async function (){
            await token.unpause()
            await expect(token.unpause()).to.be.revertedWith("Pausable: not paused")            
        });
        it("should unpause contract correctly", async function (){
            const unpauseTx = await token.unpause()
            await expect(unpauseTx).to.be.emit(token, "Unpaused").withArgs(accountA.address)
            let transferTx = await token.transfer(accountB.address, amount)
            await expect(transferTx).to.emit(token, "Transfer").withArgs(accountA.address, accountB.address, amount)
        });  
    })    
    describe("addToBlacklist()", function() {
        it("should revert add sender to blacklist", async function (){
            await expect(token.addToBlacklist(accountA.address)).to.be.revertedWith("Gold: must not add sender to blacklist")
        });
        it("should revert if account has been added to blacklist", async function (){
            await token.addToBlacklist(accountB.address)
            await expect(token.addToBlacklist(accountB.address)).to.be.revertedWith("Gold: account was on blacklist")
        });
        it("should revert if not admin role", async function (){
            await expect(token.connect(accountB).addToBlacklist(accountC.address)).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000")
        });
        it("should add to blacklist correctly", async function (){
            token.transfer(accountB.address, amount)
            token.transfer(accountC.address, amount)
            await token.addToBlacklist(accountB.address)
            await expect(token.connect(accountB).transfer(accountC.address, amount)).to.be.revertedWith("Gold: account sender was on blacklist")
            await expect(token.connect(accountC).transfer(accountB.address, amount)).to.be.revertedWith("Gold: account receiver was on blacklist")
        });
    })
    describe("removeFromBlacklist()", function() {
        beforeEach(async () => {
            token.transfer(accountB.address, amount)
            token.transfer(accountC.address, amount)
            await token.addToBlacklist(accountB.address)
        })
        it("should revert if account has not been added to blacklist", async function (){
            await token.removeFromBlacklist(accountB.address)
            await expect(token.removeFromBlacklist(accountB.address)).to.be.revertedWith("Gold: account was not on blacklist")
        });       
        it("should revert if not admin role", async function (){
            await expect(token.connect(accountB).addToBlacklist(accountC.address)).to.be.revertedWith("account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000")
        });
        it("should remove blacklist correctly", async function (){
            await token.removeFromBlacklist(accountB.address)
            let transferTx = await token.transfer(accountB.address, amount)
            await expect(transferTx).to.emit(token, "Transfer").withArgs(accountA.address, accountB.address, amount)
        });
    });     
})