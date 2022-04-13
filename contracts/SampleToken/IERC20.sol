// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

interface IERC20 {
    function totalSupply() external view returns (uint);

    function balanceOf(address _owner) external view returns (uint balance);

    function transfer(address _to, uint _value) external returns (bool success);

    function allowance(address _owner, address _spender) external view returns (uint remaining);

    function approve(address _spender, uint _value) external returns (bool success);

    function transferFrom(address _from, address _to, uint _value) external returns (bool success);

    event Transfer(address indexed _from, address indexed _to, uint _value);
    event Approval(address indexed _owner, address indexed _spender, uint _value);
}
