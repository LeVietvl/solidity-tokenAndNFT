//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Reserve is Ownable {
    IERC20 public immutable token;
    uint256 public unlocktime;
    constructor(address _tokenAddress) {
        token = IERC20(_tokenAddress);
        unlocktime = block.timestamp + 24 weeks;
    }

    modifier checkTimestamp() {
        require(block.timestamp > unlocktime, "Reverse: Can not trade");
        _;
    }

    function withdrawTo(address _to, uint256 _value) public onlyOwner checkTimestamp {
        require(_to != address(0), "Reserve: Recipient address must be different from address(0)");
        require(token.balanceOf(address(this)) >= _value, "Reserve: Not enough token");

        token.transfer(_to, _value);
    }
}
