// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./IERC20.sol";

contract SampleToken is IERC20 {
    constructor() {
        _totalSupply = 1000000;
        _balances[msg.sender] = 1000000;
    }
    uint private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    function totalSupply() external override view returns (uint) {
        return _totalSupply;
    }

    function balanceOf(address account) external override view returns (uint) {
        return _balances[account];
    }

    function transfer(address recipient, uint amount) external override returns (bool) {
        require(_balances[msg.sender] >= amount, "not enough token");
        _balances[msg.sender] -= amount;
        _balances[recipient] += amount;

        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) external override view returns (uint) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint amount) external override returns (bool) {
        require(_balances[sender] >= amount, "not enough token");
        require(_allowances[sender][msg.sender] >= amount, "not enough allowances");
        _balances[sender] -= amount;
        _balances[recipient] += amount;

        emit Transfer(sender, recipient, amount);
        return true;
    }


}