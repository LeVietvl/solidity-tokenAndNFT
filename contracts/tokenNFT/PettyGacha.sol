// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/** Practice:
 * Đề bài: Có một số game yêu cầu thời gian breed (thời gian ấp trứng) trước khi nft mới được sinh ra.
 * Hãy update thêm vào contract để có những chức năng sau:
 *  - Mỗi NFT với một rank khác nhau sẽ có breeding time khác nhau
 *  - Khi thực hiện breed, user sẽ mất một khoảng thời gian breeding time trước khi được quyền claim NFT mới
 */

contract PettyGacha is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCount;
    Counters.Counter private _gachaIdCount;

    string private _baseTokenURI;
    IERC20 public immutable gold;

    constructor(address goldAddress_) ERC721("Petty", "PET") {
        gold = IERC20(goldAddress_);
        _gachaIdCount.increment();
        _idToGacha[_gachaIdCount.current()] = Gacha(100*10**18, [60,40,0]);
        _gachaIdCount.increment();
        _idToGacha[_gachaIdCount.current()] = Gacha(200*10**18, [30,50,20]);
        _gachaIdCount.increment();
        _idToGacha[_gachaIdCount.current()] = Gacha(300*10**18, [10,40,50]);   
    }
    
    struct Gacha {
        uint256 price;
        uint8[3] rankRate;
    }

    struct Petty {
        uint8 rank;
        uint8 stat;
    }

    uint8[3] public ranks = [1,2,3];
    mapping(uint256 => Gacha) public _idToGacha;
    mapping(uint256 => Petty) public _tokenIdToPetty;

    function openGacha(uint8 gachaId_, uint256 price_) public returns(uint256) {
        require(_idToGacha[gachaId_].price > 0, "PettyGacha: invalid gacha");
        require(price_ == _idToGacha[gachaId_].price, "PettyGacha: price not match");

        gold.transferFrom(_msgSender(), address(this), price_);
        _tokenIdCount.increment();

        uint256 _tokenId = _tokenIdCount.current();
        uint8 _rank = _generateRandomRank(gachaId_);

        _mint(_msgSender(),_tokenId);
        _tokenIdToPetty[_tokenId] = Petty(_rank, 0);

    }

    function _generateRandomRank(uint256 gachaId_) public view returns (uint8) {
        uint num = uint256(keccak256(abi.encodePacked(block.timestamp, block.difficulty, msg.sender))) % 100;
        Gacha memory gacha = _idToGacha[gachaId_];
        if (num < gacha.rankRate[0]) {
           return 1;
        } else if (num >= (gacha.rankRate[0] + gacha.rankRate[1])) {
            return 3;
        } else {
            return 2;
        }
    }

    function breedPetties(uint256 tokenId1_, uint256 tokenId2_) public {
        require(ownerOf(tokenId1_) == _msgSender() && ownerOf(tokenId2_) == _msgSender(), "PettyGacha: sender is not owner of token");
        require(getApproved(tokenId1_) == address(this) && getApproved(tokenId2_) == address(this) ||
        isApprovedForAll(_msgSender(), address(this)), "PettyGacha: This contract is not authorized to manage this token");
        require(_tokenIdToPetty[tokenId1_].rank == _tokenIdToPetty[tokenId2_].rank, "PettyGacha: two petties are not in the same rank");
        require(_tokenIdToPetty[tokenId1_].rank < 3, "PettyGacha: petty is in the highest rank");

        uint8 _newRank = _tokenIdToPetty[tokenId1_].rank + 1;
        _burn(tokenId1_);
        _burn(tokenId2_);
        delete _tokenIdToPetty[tokenId1_];
        delete _tokenIdToPetty[tokenId2_];
        _tokenIdCount.increment();
        uint256 _newTokenId = _tokenIdCount.current();
        _mint(_msgSender(), _newTokenId);
        _tokenIdToPetty[_newTokenId] = Petty(_newRank, 0);
    }



 }