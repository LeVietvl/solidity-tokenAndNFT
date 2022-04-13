const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PETTY", function () {
    let [accountA,accountB,accountC] =[]
    let petty    
    let address0 = "0x0000000000000000000000000000000000000000"
    let uri = "sampleuri.com/"
    beforeEach(async () => {
        [accountA,accountB,accountC] = await ethers.getSigners();
        const Petty = await ethers.getContractFactory("Petty");
        petty = await Petty.deploy()
        await petty.deployed()
    })

    describe("mint", function() {
        it("should revert if mint to zero address", async function (){
            await expect(petty.mint(address0)).to.be.revertedWith("ERC721: mint to the zero address")
        });   
        it("should mint token correctly", async function (){            
            const minTx = await petty.mint(accountA.address)
            await expect(minTx).to.be.emit(petty, "Transfer").withArgs(address0, accountA.address, 1)
            expect(await petty.balanceOf(accountA.address)).to.be.equal(1)
            expect(await petty.ownerOf(1)).to.be.equal(accountA.address)            
        });   
    })

    describe("update Base Token URI", function() {
        it("should update Base Token URI correctly", async function (){
            await petty.mint(accountA.address)
            await petty.updateBaseTokenURI(uri)
            expect (await petty.tokenURI(1)).to.be.equal(uri+"1")
        }); 
    })
})