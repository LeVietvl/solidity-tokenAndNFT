const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20-BEP20 sample token", function () {
    let[accountA, accountB, accountC] = []
    let token
    let amount = 100
    let totalSupply = 1000000
    beforeEach(async () => {
        [accountA, accountB, accountC] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("SampleToken");
        token = await Token.deploy()
        await token.deployed()
    })
    
    describe("common", function () {
        it("total supply should return right value", async function () {
            expect(await token.totalSupply()).to.be.equal(totalSupply)
        });
        it("balance of account A should return right value", async function () {
            expect(await token.balanceOf(accountA.address)).to.be.equal(totalSupply)
        });
        it("balance of account B should return right value", async function () {
            expect(await token.balanceOf(accountB.address)).to.be.equal(0)
        });
        it("allowance of account A to account B should return right value", async function () {
            expect(await token.allowance(accountA.address, accountB.address)).to.be.equal(0)
        });

    })
    describe("transfer", function () {
        it("transfer should revert if amount exceeds balance", async function () {    
            await expect(token.transfer(accountB.address, totalSupply + 1)).to.be.reverted        
        });   
        it("transfer should work correctly", async function () {         
            let transferTx = await token.transfer(accountB.address, amount) 
            expect(await token.balanceOf(accountA.address)).to.be.equal(totalSupply - amount)
            expect(await token.balanceOf(accountB.address)).to.be.equal(amount)  

            await expect(transferTx).to.emit(token, 'Transfer').withArgs(accountA.address, accountB.address, amount)            
        });  
    })   
    
    describe("transferFrom", function () {
        it("transferFrom should revert if amount exceeds balance", async function () { 
            await expect(token.connect(accountB).transferFrom(accountA.address, accountC.address, totalSupply + 1)).to.be.reverted            
        }); 
        it("transferFrom should revert if amount exceeds allowance amount", async function () {
            await expect(token.connect(accountB).transferFrom(accountA.address, accountC.address, amount)).to.be.reverted            
        });
        it("transferFrom should work correctly", async function () {    
            await token.approve(accountB.address, amount)
            let transferFromTx = await token.connect(accountB).transferFrom(accountA.address, accountC.address, amount)  
            expect(await token.balanceOf(accountA.address)).to.be.equal(totalSupply - amount)
            expect(await token.balanceOf(accountC.address)).to.be.equal(amount)

            await expect(transferFromTx).to.emit(token, 'Transfer').withArgs(accountA.address, accountC.address, amount)
        });   
    })  

    describe("approve", function () {
        it("approve should work correctly", async function () {
            const approveTx = await token.approve(accountB.address, amount)  
            expect(await token.allowance(accountA.address, accountB.address)).to.be.equal(amount)

            await expect(approveTx).to.emit(token, 'Approval').withArgs(accountA.address, accountB.address, amount)
                      
        });
    })  


})