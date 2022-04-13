const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("marketplace", function() {
    let[admin, seller, buyer, feeRecipient, samplePaymentToken] = []
    let petty
    let gold
    let marketplace;
    let defaultFeeRate = 10;
    let defaultFeeDecimal = 0;
    let defaultPrice = ethers.utils.parseEther("100")
    let defaultBalance = ethers.utils.parseEther("10000")
    let address0 = "0x0000000000000000000000000000000000000000"
    beforeEach(async () => {
        [admin, seller, buyer, feeRecipient, samplePaymentToken] = await ethers.getSigners();
        const Petty = await ethers.getContractFactory("Petty");
        petty = await Petty.deploy()
        await petty.deployed()

        const Gold =  await ethers.getContractFactory("Gold");
        gold = await Gold.deploy()
        await gold.deployed()

        const Marketplace = await ethers.getContractFactory("MarketPlace");
        marketplace = await Marketplace.deploy(petty.address, defaultFeeDecimal, defaultFeeRate, feeRecipient.address)    
        await marketplace.deployed()

        await marketplace.addPaymentToken(gold.address)
        await gold.transfer(seller.address, defaultBalance)
        await gold.transfer(buyer.address, defaultBalance)
    })

    describe("common", function() {
        it("feeDecimal should return correct value", async function () {
            expect (await marketplace.feeDecimal()).to.be.equal(defaultFeeDecimal)
            const balance = await ethers.provider.getBalance(seller.address);
            console.log(admin.address)
            console.log(balance);            
        });
        it("feeRate should return correct value", async function () {
            expect (await marketplace.feeRate()).to.be.equal(defaultFeeRate)
        });
        it("feeRecipient should return correct value", async function () {
            expect (await marketplace.feeRecipient()).to.be.equal(feeRecipient.address)
        });
    })

    describe("updateFeeRecipient", function() {
        it("should revert if the feeRecipient is address(0)", async function () {
            await expect(marketplace.updateFeeRecipient(address0)).to.be.revertedWith("NFTMarketPlace: nftAddress is zero address")
        });
        it("should revert if sender isn't contract owner", async function () {
            await expect(marketplace.connect(seller).updateFeeRecipient(buyer.address)).to.be.reverted
        });
        it("should update feeRecipient correctly", async function () {
            await marketplace.updateFeeRecipient(buyer.address)
            expect (await marketplace.feeRecipient()).to.be.equal(buyer.address)
        });
    })

    describe("updateFeeRate", function() {
        it("should revert if fee rate >= 10^(feeDecimal+2)", async function () {
            await expect(marketplace.updateFeeRate(0, 100)).to.be.revertedWith("NFTMarketPlace: bad fee rate")
        });    
        it("should revert if sender isn't contract owner", async function () {
            await expect(marketplace.connect(buyer).updateFeeRate(0, 10)).to.be.revertedWith("Ownable: caller is not the owner")
        });
        it("should update feeRate correctly", async function () {
            const FeeRateTx = await marketplace.updateFeeRate(0, 5)
            expect (await marketplace.feeRate()).to.be.equal(5)
            expect (await marketplace.feeDecimal()).to.be.equal(0)
            await expect(FeeRateTx).to.be.emit(marketplace, "FeeRateUpdated").withArgs(0, 5)
        });
    })    

    describe("addPaymentToken", function() {
        it("should revert if the paymentToken is address(0)", async function () {
            await expect(marketplace.addPaymentToken(address0)).to.be.revertedWith("NFTMarketPlace: paymentToken_ is zero address")
        });
        it("should revert if the paymentToken is aldready supported", async function () {
            await expect(marketplace.addPaymentToken(gold.address)).to.be.revertedWith("NFTMarketPlace: aldready supported")
        });
        it("should revert if sender isn't contract owner", async function () {
            await expect(marketplace.connect(buyer).addPaymentToken(samplePaymentToken.address)).to.be.revertedWith("Ownable: caller is not the owner")
        });
        it("should add paymentToken correctly", async function () {
            await marketplace.addPaymentToken(samplePaymentToken.address)
            expect (await marketplace.isPaymentTokenSupported(samplePaymentToken.address)).to.be.equal(true)
        });
    })    

    describe("addOrder", function() {
        beforeEach(async () => {
            await petty.mint(seller.address)
        })
        it("should revert if the paymentToken is not supported", async function () {
            await petty.connect(seller).setApprovalForAll(marketplace.address, true)
            await expect(marketplace.connect(seller).addOrder(1, samplePaymentToken.address, defaultPrice)).to.be.revertedWith("NFTMarketPlace: unsupported payment token")
        });
        it("should revert if the sender is not the owner of the nft", async function () {
            await petty.connect(seller).setApprovalForAll(marketplace.address, true)
            await expect(marketplace.connect(buyer).addOrder(1, gold.address, defaultPrice)).to.be.revertedWith("NFTMarketPlace: you are not the owner of this nft")
        });
        it("should revert if nft has not been approved for marketplace contract", async function () {
            await expect(marketplace.connect(seller).addOrder(1, gold.address, defaultPrice)).to.be.revertedWith("NFTMarketPlace: the contract is unauthorized to manage this token")
        });
        it("should revert if price = 0", async function () {
            await petty.connect(seller).setApprovalForAll(marketplace.address, true)
            await expect(marketplace.connect(seller).addOrder(1, gold.address, 0)).to.be.revertedWith("NFTMarketPlace: Price must be greeter than 0")
        });
        it("should add order correctly", async function () {
            await petty.connect(seller).setApprovalForAll(marketplace.address, true)
            const orderTx = await marketplace.connect(seller).addOrder(1, gold.address, defaultPrice)
            expect (await petty.ownerOf(1)).to.be.equal(marketplace.address)
            await expect(orderTx).to.be.emit(marketplace, "OrderAdded").withArgs(1, seller.address, 1, gold.address, defaultPrice)
        });    
    })
    
    describe("cancelOrder", function() {
        beforeEach(async () => {
            await petty.mint(seller.address)
            await petty.connect(seller).setApprovalForAll(marketplace.address, true)
            await marketplace.connect(seller).addOrder(1, gold.address, defaultPrice)
            
        })
        it("should revert if the order is aldready sold", async function () {
            await gold.connect(buyer).approve(marketplace.address, defaultPrice)
            await marketplace.connect(buyer).executeOrder(1)
            await expect(marketplace.connect(seller).cancelOrder(1)).to.be.revertedWith("NFTMarketPlace: This nftToken is already sold")
        });
        it("should revert if the sender is not the owner of the order", async function () {
            await expect(marketplace.connect(buyer).cancelOrder(1)).to.be.revertedWith("NFTMarketPlace: must be owner")
        });        
        it("should cancel order correctly", async function () {
            const cancelOrderTx = await marketplace.connect(seller).cancelOrder(1)            
            expect (await petty.ownerOf(1)).to.be.equal(seller.address)           
            await expect(cancelOrderTx).to.be.emit(marketplace, "OrderCancelled").withArgs(1)

            await petty.mint(seller.address)
            await petty.connect(seller).setApprovalForAll(marketplace.address, true)
            await marketplace.connect(seller).addOrder(2, gold.address, defaultPrice)

            const cancelOrderTx2 = await marketplace.connect(seller).cancelOrder(2)            
            expect (await petty.ownerOf(2)).to.be.equal(seller.address)           
            await expect(cancelOrderTx2).to.be.emit(marketplace, "OrderCancelled").withArgs(2)
        });        
    })

    describe("executeOrder", function() {
        beforeEach(async () => {
            await petty.mint(seller.address)
            await petty.connect(seller).setApprovalForAll(marketplace.address, true)
            await marketplace.connect(seller).addOrder(1, gold.address, defaultPrice)
            await gold.connect(buyer).approve(marketplace.address, defaultPrice)
        })
        it("should revert if the sender is the seller", async function () {
            await expect(marketplace.connect(seller).executeOrder(1)).to.be.revertedWith("NFTMarketPlace: buyer must be different from seller")
        });
        it("should revert if the order is aldready sold", async function () {
            await marketplace.connect(buyer).executeOrder(1)
            await expect(marketplace.connect(buyer).executeOrder(1)).to.be.revertedWith("NFTMarketPlace: This nftToken is already sold")
        });
        it("should revert if the order is aldready canceled", async function () {
            await marketplace.connect(seller).cancelOrder(1)
            await expect(marketplace.connect(buyer).executeOrder(1)).to.be.revertedWith("NFTMarketPlace: This order is already canceled")
        });
        it("should execute order correctly with default fee", async function () {                       
            const excuteOrderTx = await marketplace.connect(buyer).executeOrder(1)
            await expect(excuteOrderTx).to.be.emit(marketplace, "OrderMatched").withArgs(1, seller.address, buyer.address, 1, gold.address, defaultPrice)                        
            const feeAmout = defaultPrice.mul(10).div(100)
            console.log("Fee amount is", feeAmount)
            expect (await gold.balanceOf(feeRecipient.address)).to.be.equal(feeAmount)
            expect (await gold.balanceOf(buyer.address)).to.be.equal(defaultBalance.sub(defaultPrice))
            expect (await gold.balanceOf(seller.address)).to.be.equal(defaultBalance.add(defaultPrice).sub(feeAmount))
            expect (await petty.ownerOf(1)).to.be.equal(buyer.address)            
        });   
        it("should execute order correctly with 0 fee", async function () {
            await marketplace.updateFeeRate(0,0)
            const excuteOrderTx = await marketplace.connect(buyer).executeOrder(1)
            await expect(excuteOrderTx).to.be.emit(marketplace, "OrderMatched").withArgs(1, seller.address, buyer.address, 1, gold.address, defaultPrice)
            expect (await gold.balanceOf(feeRecipient.address)).to.be.equal(0)
            expect (await gold.balanceOf(buyer.address)).to.be.equal(defaultBalance.sub(defaultPrice))
            expect (await gold.balanceOf(seller.address)).to.be.equal(defaultBalance.add(defaultPrice))
            expect (await petty.ownerOf(1)).to.be.equal(buyer.address)
        });      
        it("should execute order correctly with fee 1 =99%", async function () {
            await marketplace.updateFeeRate(0,99)
            const excuteOrderTx = await marketplace.connect(buyer).executeOrder(1)
            await expect(excuteOrderTx).to.be.emit(marketplace, "OrderMatched").withArgs(1, seller.address, buyer.address, 1, gold.address, defaultPrice)
            const feeAmout = defaultPrice.mul(99).div(100)
            console.log("Fee amount is", feeAmout)
            expect (await gold.balanceOf(feeRecipient.address)).to.be.equal(feeAmout)
            expect (await gold.balanceOf(buyer.address)).to.be.equal(defaultBalance.sub(defaultPrice))
            expect (await gold.balanceOf(seller.address)).to.be.equal(defaultBalance.add(defaultPrice).sub(feeAmout))
            expect (await petty.ownerOf(1)).to.be.equal(buyer.address)
        }); 
        it("should execute order correctly with fee 2 =10.11111%", async function () {
            await marketplace.updateFeeRate(5,1011111)
            const excuteOrderTx = await marketplace.connect(buyer).executeOrder(1)
            await expect(excuteOrderTx).to.be.emit(marketplace, "OrderMatched").withArgs(1, seller.address, buyer.address, 1, gold.address, defaultPrice)
            const feeAmout = defaultPrice.mul(1011111).div(10000000)
            console.log("Fee amount is", feeAmout)
            expect (await gold.balanceOf(feeRecipient.address)).to.be.equal(feeAmout)
            expect (await gold.balanceOf(buyer.address)).to.be.equal(defaultBalance.sub(defaultPrice))
            expect (await gold.balanceOf(seller.address)).to.be.equal(defaultBalance.add(defaultPrice).sub(feeAmout))
            expect (await petty.ownerOf(1)).to.be.equal(buyer.address)
        }); 
    })
})

