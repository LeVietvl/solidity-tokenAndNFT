const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenSale", function () {
    let [accountA,accountB,accountC] =[]
    let gold
    let tokenSale    
    let tokenSaleBalance = ethers.utils.parseEther("10")
    let defaultFeeRate = 10;
    let defaultFeeDecimal = 0;     
    beforeEach(async () => {
        [accountA,accountB,accountC] = await ethers.getSigners();

        const Gold = await ethers.getContractFactory("Gold");
        gold = await Gold.deploy()
        await gold.deployed()

        const TokenSale = await ethers.getContractFactory("TokenSale");
        tokenSale = await TokenSale.deploy(gold.address, defaultFeeDecimal, defaultFeeRate)
        await tokenSale.deployed()

        await gold.transfer(tokenSale.address, tokenSaleBalance)
    })

    describe("buy token", function() {
        it("should revert if msg.value does not reach min cap", async function (){
            await expect(tokenSale.buy({value: ethers.utils.parseEther("0.001")})).to.be.revertedWith("TokenSale: Not reach min cap")
        });
        it("should revert if caller's token amount exceeds hard cap", async function (){
            await expect(tokenSale.buy({value: ethers.utils.parseEther("1.1")})).to.be.revertedWith("TokenSale: exceed hard cap")
        });
        it("should revert if TokenSale contract does not have enough token", async function (){
            await tokenSale.buy({value: ethers.utils.parseEther("0.6")})
            await expect(tokenSale.connect(accountB).buy({value: ethers.utils.parseEther("0.5")})).to.be.revertedWith("TokenSale: exceed token balance")
        });
        it("should buy token correctly", async function (){
            await tokenSale.connect(accountB).buy({value: ethers.utils.parseEther("0.7")})
            expect (await tokenSale.connect(accountB).checkContribution()).to.be.equal(ethers.utils.parseEther("7"))

            await tokenSale.connect(accountC).buy({value: ethers.utils.parseEther("0.1")})
            expect (await tokenSale.connect(accountC).checkContribution()).to.be.equal(ethers.utils.parseEther("1"))          

            await tokenSale.buy({value: ethers.utils.parseEther("0.2")})
            expect (await tokenSale.checkContribution()).to.be.equal(ethers.utils.parseEther("2"))

            expect (await gold.balanceOf(tokenSale.address)).to.be.equal(ethers.utils.parseEther("0"))
        });
    })

    describe("sell token", function() {
        beforeEach(async () => {
            await tokenSale.connect(accountB).buy({value: ethers.utils.parseEther("0.8")})
        })
        it("should revert if not enough token in contribution", async function (){
            await expect(tokenSale.connect(accountB).sell(ethers.utils.parseEther("9"))).to.be.revertedWith("TokenSale: Your contribution do not have enough token")
        });
        it("should sell token correctly", async function (){
            await gold.connect(accountB).approve(tokenSale.address,ethers.utils.parseEther("8"))
            await tokenSale.connect(accountB).sell(ethers.utils.parseEther("8"))

            expect (await gold.balanceOf(tokenSale.address)).to.be.equal(ethers.utils.parseEther("10"))
            expect (await tokenSale.connect(accountB).checkContribution()).to.be.equal(ethers.utils.parseEther("0"))
        });

    })    
})