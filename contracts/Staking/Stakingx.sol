// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StakingReserve.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Stakingx is Ownable {
    using Counters for Counters.Counter;
    StakingReserve public immutable stakingReserve;
    IERC20 public immutable gold;
    address public stakingReserveAddress; 
    event StakeUpdate(
        address indexed account,
        uint256 indexed packageId,
        uint256 amount,
        uint256 totalProfit
    );
    event StakeReleased(
        address indexed account,
        uint256 indexed packageId,
        uint256 amount,
        uint256 totalProfit
    );
    event PackageInfo (
        uint256 indexed packageId,
        uint256 rate,
        uint256 decimal,
        uint256 minStaking,
        uint256 lockTime,
        bool indexed isOffline
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
        bool isUnStake;
    }
    Counters.Counter private _stakePackageCount;
    mapping(uint256 => StakePackage) public stakePackages;
    mapping(address => mapping(uint256 => StakingInfo)) public stakes;

    /**
     * @dev Initialize
     * @notice This is the initialize function, run on deploy event
     * @param tokenAddr_ address of main token
     * @param stakingReserveAddress_ address of reserve contract
     */
    constructor(address tokenAddr_, address stakingReserveAddress_) {
        gold = IERC20(tokenAddr_);
        stakingReserve = StakingReserve(stakingReserveAddress_);
        stakingReserveAddress = stakingReserveAddress_;
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

        emit PackageInfo(packageId_, rate_, decimal_, minStaking_, lockTime_, false);
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

        emit PackageInfo(packageId_, stakePackage.rate, stakePackage.decimal, stakePackage.minStaking, stakePackage.lockTime, true);
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
        gold.transferFrom(_msgSender(), stakingReserveAddress, amount_);
        if (stakeTx.amount == 0) {
            stakeTx.startTime = block.timestamp;
            stakeTx.timePoint = block.timestamp + stakePackages[packageId_].lockTime;
            stakeTx.amount = amount_;
            stakeTx.totalProfit = 0;
            stakeTx.isUnStake = false;            
        } else {            
            stakeTx.totalProfit = calculateProfit(packageId_);
            stakeTx.startTime = block.timestamp;
            stakeTx.timePoint = block.timestamp + stakePackages[packageId_].lockTime;
            stakeTx.amount += amount_; 
            stakeTx.isUnStake = false;           
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
        require(!stakeTx.isUnStake, "Stakingx: your stake is already withdrawn");
        
        stakeTx.totalProfit += calculateProfit(packageId_);  
        stakeTx.isUnStake = true;      
        stakingReserve.distributeGold(_msgSender(), stakeTx.amount + stakeTx.totalProfit);
          
        emit StakeReleased(_msgSender(), packageId_, stakeTx.amount, stakeTx.totalProfit);          
    }
    /**
     * @dev calculate current profit of an package of user known packageId
     */

    function calculateProfit(uint256 packageId_)
        public
        view
        returns (uint256)
    {
        require(packageId_ <= _stakePackageCount.current(), "Stakingx: packageId not exist");        
        StakePackage storage stakePackage = stakePackages[packageId_];
        StakingInfo storage stakeTx = stakes[_msgSender()][packageId_];
        require(!stakeTx.isUnStake, "Stakingx: your stake is already withdrawn");       
        uint256 profitTx = stakeTx.amount*stakePackage.rate/10**(stakePackage.decimal+2)
        *(block.timestamp - stakeTx.startTime)/(86400*360); 
        return profitTx;       
    }

    function getAprOfPackage(uint256 packageId_)
        public
        view
        returns (uint256)
    {}   
}