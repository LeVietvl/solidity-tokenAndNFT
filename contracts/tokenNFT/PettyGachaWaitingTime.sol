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

contract PettyGachaWaitingTime is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCount;
    Counters.Counter private _gachaIdCount;

    string private _baseTokenURI;
    IERC20 public immutable gold;

    event OpenGacha(address indexed _caller, uint8 _gachaId, uint indexed _price);
    event RequestBreedPetties(address indexed _caller, uint256 tokeId1, uint256 tokenId2, uint256 newTokenId_, uint256 timeToClaim);
    event ClaimBreedPetties(address indexed _caller, uint256 newTokenId_);

    constructor(address goldAddress_) ERC721("Petty", "PET") {
        gold = IERC20(goldAddress_);
        _gachaIdCount.increment();
        _idToGacha[_gachaIdCount.current()] = Gacha(100*10**18, [60,40,0]);
        _gachaIdCount.increment();
        _idToGacha[_gachaIdCount.current()] = Gacha(200*10**18, [30,50,20]);
        _gachaIdCount.increment();
        _idToGacha[_gachaIdCount.current()] = Gacha(300*10**18, [10,40,50]);  
        _waitingTimeForRank[1] = 1 days;
        _waitingTimeForRank[2] = 1 days;
        _waitingTimeForRank[3] = 3 days;
    }
    
    struct Gacha {
        uint256 price;
        uint8[3] rankRate;
    }

    struct Petty {
        uint8 rank;
        uint8 stat;        
    }

    struct BreedPetties {
        uint256 startingTime;
        uint256 endingTime;
        bool isClaimed;
        uint8 rank;
    }

    uint8[3] public ranks = [1,2,3];
    mapping(uint256 => Gacha) public _idToGacha;
    mapping(uint256 => Petty) public _tokenIdToPetty;
    mapping(uint256 => uint256) public _waitingTimeForRank;
    mapping(uint256 => BreedPetties) public _PettyWaitingTime;
    mapping(uint256 => address) public _RequestBreedPettiesForAddress;

    function openGacha(uint8 gachaId_, uint256 price_) public returns(uint256) {
        require(_idToGacha[gachaId_].price > 0, "PettyGachaWaitingTime: invalid gacha");
        require(price_ == _idToGacha[gachaId_].price, "PettyGachaWaitingTime: price not match");

        gold.transferFrom(_msgSender(), address(this), price_);
        _tokenIdCount.increment();

        uint256 _tokenId = _tokenIdCount.current();
        uint8 _rank = _generateRandomRank(gachaId_);

        _mint(_msgSender(),_tokenId);
        _tokenIdToPetty[_tokenId] = Petty(_rank, 0);

        return _tokenId;

        emit OpenGacha(_msgSender(), gachaId_, price_);

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

    /** Practice - suggestion:
     * update hàm breed để hàm không mint Petty ngay lập tức
     * Các thông tin của lượt breed được lưu lại với một Id để User có thể claim khi breed time kết thúc
     * Gợi ý: Lưu breed dưới dạng mapping(tokenId => Struct)
     */

    function requestBreedPetties(uint256 tokenId1_, uint256 tokenId2_) public returns(uint256, uint256) {
        require(ownerOf(tokenId1_) == _msgSender() && ownerOf(tokenId2_) == _msgSender(), "PettyGachaWaitingTime: sender is not owner of token");
        require(getApproved(tokenId1_) == address(this) && getApproved(tokenId2_) == address(this) ||
        isApprovedForAll(_msgSender(), address(this)), "PettyGachaWaitingTime: This contract is not authorized to manage this token");
        require(_tokenIdToPetty[tokenId1_].rank == _tokenIdToPetty[tokenId2_].rank, "PettyGachaWaitingTime: two petties are not in the same rank");
        require(_tokenIdToPetty[tokenId1_].rank < 3, "PettyGachaWaitingTime: petty is in the highest rank");

        uint8 _newRank = _tokenIdToPetty[tokenId1_].rank + 1;
        _burn(tokenId1_);
        _burn(tokenId2_);
        delete _tokenIdToPetty[tokenId1_];
        delete _tokenIdToPetty[tokenId2_];
        _tokenIdCount.increment();
        uint256 _newTokenId = _tokenIdCount.current();

        _PettyWaitingTime[_newTokenId] = BreedPetties(block.timestamp, block.timestamp + _waitingTimeForRank[_newRank], false, _newRank);
        _RequestBreedPettiesForAddress[_newTokenId] = _msgSender();
        return(_waitingTimeForRank[_newRank], _newTokenId);

        emit RequestBreedPetties(_msgSender(), tokenId1_, tokenId2_, _newTokenId, _PettyWaitingTime[_newTokenId].endingTime);
    }

    function claimBreedPetties(uint tokenId_) public {
        require(block.timestamp > _PettyWaitingTime[tokenId_].endingTime, "PettyGachaWaitingTime: Not enough time");
        require(_PettyWaitingTime[tokenId_].isClaimed == false, "PettyGachaWaitingTime: This petty is aldready claimed");
        require(_RequestBreedPettiesForAddress[tokenId_] == _msgSender(), "PettyGachaWaitingTime: You are not the owner");     

        _mint(_msgSender(), tokenId_);
        _tokenIdToPetty[tokenId_] = Petty(_PettyWaitingTime[tokenId_].rank, 0);

        emit ClaimBreedPetties(_msgSender(), tokenId_);
    }  
}