//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract MarketPlace is Ownable {
    using Counters for Counters.Counter;
    using EnumerableSet for EnumerableSet.AddressSet;
    struct Order {
        address seller;
        address buyer;
        uint256 tokenId;
        address paymentToken;
        uint256 price;
    }
    Counters.Counter private _orderIdCount;
    IERC721 public immutable nftContract;
    mapping(uint256 => Order) public orders;
    uint256 public feeDecimal;
    uint public feeRate;
    address public feeRecipient;
    EnumerableSet.AddressSet private _supportedPaymentTokens;

    event OrderAdded(
        uint256 indexed orderId,
        address indexed seller,
        uint256 indexed tokenId,
        address paymentToken,
        uint256 price
    );

    event OrderCancelled(uint256 indexed orderId);

    event OrderMatched(uint256 orderId, 
    address seller, 
    address buyer, 
    uint256 tokenId, 
    address paymentToken,
    uint256 price
    );

    event FeeRateUpdated(uint256 feeDecimal, uint feeRate);

    constructor(
        address nftAddress_,
        uint256 feeDecimal_,
        uint256 feeRate_,
        address feeRecipient_
    ) {
        require(nftAddress_ != address(0), "NFTMarketPlace: nftAddress is zero address");
        require(feeRecipient_ != address(0), "NFTMarketPlace: nftAddress is zero address");

        nftContract = IERC721(nftAddress_);
        _updateFeeRecipient(feeRecipient_);
        _updateFeeRate(feeDecimal_, feeRate_);
        _orderIdCount.increment();
    }

    function _updateFeeRecipient(address feeRecipient_) internal {
        require(feeRecipient_ != address(0), "NFTMarketPlace: nftAddress is zero address");
        feeRecipient = feeRecipient_;
    }

    function updateFeeRecipient(address feeRecipient_) external onlyOwner {
        _updateFeeRecipient(feeRecipient_);
    }

    function _updateFeeRate(uint256 feeDecimal_, uint256 feeRate_) internal {
        require(feeRate_ < 10**(feeDecimal_ + 2), "NFTMarketPlace: bad fee rate");
        feeDecimal = feeDecimal_;
        feeRate = feeRate_;
    }
    function updateFeeRate(uint256 feeDecimal_, uint256 feeRate_) external onlyOwner {
        _updateFeeRate(feeDecimal_, feeRate_);
        emit FeeRateUpdated(feeDecimal_, feeRate_);
    }

    function _calculateFee(uint256 orderId_) private view returns(uint256) {
        Order storage _order = orders[orderId_];
        if (feeRate == 0) { 
            return 0;
        }
        return (feeRate*_order.price) / 10**(feeDecimal + 2);
    }

    function isSeller(uint256 orderId_, address seller_) public view returns (bool) {
        return orders[orderId_].seller == seller_;
    }

    function addPaymentToken(address paymentToken_) external onlyOwner {
        require(paymentToken_ != address(0),"NFTMarketPlace: paymentToken_ is zero address" );
        require(_supportedPaymentTokens.add(paymentToken_), "NFTMarketPlace: aldready supported");
        _supportedPaymentTokens.add(paymentToken_);
    }

    function isPaymentTokenSupported(address paymentToken_) public view returns(bool) {
        return _supportedPaymentTokens.contains(paymentToken_);
    }

    modifier onlySupportedPaymentToken(address paymentToken_) {
        require(isPaymentTokenSupported(paymentToken_), "NFTMarketPlace: unsupported payment token" );
        _;
    }

    function addOrder(uint256 tokenId_, address paymentToken_, uint256 price_) public onlySupportedPaymentToken(paymentToken_) {
        require(nftContract.ownerOf(tokenId_) == _msgSender(), "NFTMarketPlace: you are not the owner of this nft");
        require(nftContract.getApproved(tokenId_) == address(this) || nftContract.isApprovedForAll(_msgSender(), address(this)), "NFTMarketPlace: the contract is unauthorized to manage this token");
        require(price_ > 0, "NFTMarketPlace: Price must be greeter than 0");

        uint _orderId = _orderIdCount.current();
        orders[_orderId] = Order(_msgSender(), address(0), tokenId_, paymentToken_, price_);
        _orderIdCount.increment();

        nftContract.transferFrom(_msgSender(), address(this), tokenId_);
        emit OrderAdded(_orderId, _msgSender(), tokenId_, paymentToken_, price_);
    }

    function cancelOrder(uint orderId_) external {
        Order storage _order = orders[orderId_];
        require(_order.buyer == address(0), "NFTMarketPlace: This nftToken is already sold");
        require(_order.seller == _msgSender(), "NFTMarketPlace: must be owner");

        uint256 _tokenId = _order.tokenId;
        delete orders[orderId_];
        nftContract.transferFrom(address(this), _msgSender(), _tokenId);

        emit OrderCancelled(_tokenId);
    }

    function executeOrder(uint256 orderId_) external {
        require(!isSeller(orderId_, _msgSender()), "NFTMarketPlace: buyer must be different from seller");
        require(orders[orderId_].buyer == address(0), "NFTMarketPlace: This nftToken is already sold" );
        require(orders[orderId_].price > 0, "NFTMarketPlace: This order is already canceled");

        Order storage _order = orders[orderId_];
        _order.buyer = _msgSender();
        uint256 _feeAmount = _calculateFee(orderId_);

        // Transfer fee to feeRecipient.
        if(_feeAmount > 0) {
            IERC20(_order.paymentToken).transferFrom(_msgSender(), feeRecipient, _feeAmount);
        }

        // Transfer money to the seller.
        IERC20(_order.paymentToken).transferFrom(_msgSender(), _order.seller, _order.price - _feeAmount);

        nftContract.transferFrom(address(this), _msgSender(), _order.tokenId);
        emit OrderMatched(orderId_, _order.seller, _msgSender(), _order.tokenId, _order.paymentToken, _order.price);
    }

}