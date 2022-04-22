// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Reserve.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Staking is Ownable {
    using Counters for Counters.Counter;
    StakingReserve public immutable reserve;
    IERC20 public immutable gold;
    address public reserveAddress; 
    event StakeUpdate(
        address account,
        uint256 packageId,
        uint256 amount,
        uint256 totalProfit
    );
    event StakeReleased(
        address account,
        uint256 packageId,
        uint256 amount,
        uint256 totalProfit
    );
    struct StakePackage {
        uint256 rate;
        uint256 decimal;
        uint256 minStaking;
        uint256 lockTime;
        bool isOffline;
    }
    struct StakingInfo {
        uint256 startTime;
        uint256 timePoint;
        uint256 amount;
        uint256 totalProfit;
    }
    Counters.Counter private _stakePackageCount;
    mapping(uint256 => StakePackage) public stakePackages;
    mapping(address => mapping(uint256 => StakingInfo)) public stakes;

    /**
     * @dev Initialize
     * @notice This is the initialize function, run on deploy event
     * @param tokenAddr_ address of main token
     * @param reserveAddress_ address of reserve contract
     */
    constructor(address tokenAddr_, address reserveAddress_) {
        gold = IERC20(tokenAddr_);
        reserve = StakingReserve(reserveAddress_);
        reserveAddress = reserveAddress_;
    }

    /**
     * @dev Add new staking package
     * @notice New package will be added with an id
     */
    function addStakePackage(
        uint256 rate_,
        uint256 decimal_,
        uint256 minStaking_,
        uint256 lockTime_
    ) public onlyOwner {
        _stakePackageCount.increment();
        uint256 packageId_ = _stakePackageCount.current();
        StakePackage storage stakePackage = stakePackages[packageId_];
        require(rate_ < 10**(decimal_ + 2), "Stakingx: bad  interest rate");
        stakePackage.rate = rate_;
        stakePackage.decimal = decimal_;
        stakePackage.minStaking = minStaking_;
        stakePackage.lockTime = lockTime_;
        stakePackage.isOffline = false;
    }

    /**
     * @dev Remove an stake package
     * @notice A stake package with packageId will be set to offline
     * so none of new staker can stake to an offine stake package
     */
    function removeStakePackage(uint256 packageId_) public onlyOwner {
        require(packageId_ <= _stakePackageCount.current(), "Stakingx: packageId not exist");
        StakePackage storage stakePackage = stakePackages[packageId_];
        stakePackage.isOffline = true;
    }

    /**
     * @dev User stake amount of gold to stakes[address][packageId]
     * @notice if is there any amount of gold left in the stake package,
     * calculate the profit and add it to total Profit,
     * otherwise just add completely new stake. 
     */
    function stake(uint256 amount_, uint256 packageId_) external {
        StakingInfo storage stakeTx = stakes[_msgSender()][packageId_];       
        require(packageId_ <= _stakePackageCount.current(), "Stakingx: packageId not exist");
        require(!stakePackages[packageId_].isOffline, "Stakingx: packageId is not available");
        require(amount_ >= stakePackages[packageId_].minStaking, "Stakingx: Your stake amount should be greater than minStaking");
        gold.transferFrom(_msgSender(), reserveAddress, amount_);
        if (stakeTx.amount == 0) {
            stakeTx.startTime = block.timestamp;
            stakeTx.timePoint = block.timestamp + stakePackages[packageId_].lockTime;
            stakeTx.amount = amount_;
            stakeTx.totalProfit = 0;            
        } else {
            stakeTx.totalProfit = calculateProfit(packageId_);
            stakeTx.startTime = block.timestamp;
            stakeTx.timePoint = block.timestamp + stakePackages[packageId_].lockTime;
            stakeTx.amount += amount_;            
        }      
        
        emit StakeUpdate(_msgSender(), packageId_, stakeTx.amount, stakeTx.totalProfit);
    }
    /**
     * @dev Take out all the stake amount and profit of account's stake from reserve contract
     */
    function unStake(uint256 packageId_) external {
        // validate available package and approved amount
        StakingInfo storage stakeTx = stakes[_msgSender()][packageId_];
        require(packageId_ <= _stakePackageCount.current(), "Stakingx: packageId not exist");       
        require(stakeTx.timePoint <= block.timestamp, "Stakingx: your stake is still in lock time");
        require(stakeTx.amount > 0, "Stakingx: your stake is already withdrawn");
        
        stakeTx.totalProfit += calculateProfit(packageId_);
        uint256 totalAmountTx = stakeTx.amount;
        uint256 totalProfitTx = stakeTx.totalProfit;
        stakeTx.amount = 0;
        stakeTx.totalProfit = 0;
        reserve.distributeGold(_msgSender(), totalAmountTx + totalProfitTx);
          
        emit StakeReleased(_msgSender(), packageId_, totalAmountTx, totalProfitTx);          
    }
    /**
     * @dev calculate current profit of an package of user known packageId
     */

    function calculateProfit(uint256 packageId_)
        public
        view
        returns (uint256)
    {
        StakePackage memory stakePackage = stakePackages[packageId_];
        StakingInfo memory stakeTx = stakes[_msgSender()][packageId_];        
        uint256 profitTx = stakeTx.amount*stakePackage.rate/10**(stakePackage.decimal+2)
        *(block.timestamp - stakeTx.startTime)/stakePackage.lockTime; 
        return profitTx;       
    }

    function getAprOfPackage(uint256 packageId_)
        public
        view
        returns (uint256)
    {

    }
}
