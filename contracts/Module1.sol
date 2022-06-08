//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IERC20Token.sol";

contract Module1 is Initializable {
    address public admin; // need to be replaced with the multisig wallet

    address public token; // the token that users should stake and lock

    uint256 public vestingDuration;
    uint256 public slicingPeriod;

    mapping(address => StakeInfo) public stakeInfos;
    address[] internal stakers;
    mapping(address => LockInfo) public lockInfos;
    address[] internal lockers;

    address[] internal blackList;

    struct StakeInfo {
        uint256 index;
        uint256 amount;
    }

    struct LockInfo {
        uint256 index;
        uint256 amount;
        uint256 lastClaimedTime;
        uint256 startTime;
    }

    function initialize(
        address _token,
        uint256 _vestingDuration,
        uint256 _slicingPeriod
    ) public initializer {
        _transferOwnership(msg.sender);
        token = _token;
        vestingDuration = _vestingDuration;
        slicingPeriod = _slicingPeriod;
    }

    modifier onlyAdmin() {
        require(admin == msg.sender, "Err: not admin");
        _;
    }

    function transferOwnership(address to) public onlyAdmin {
        admin = to;
    }

    function _transferOwnership(address to) internal {
        admin = to;
    }

    function stake(uint256 amount) public {
        require(amount > 0, "not enough");
        StakeInfo storage info = stakeInfos[msg.sender];
        info.amount += amount;
        if (info.index > 0) {
            // already exists, do nothing
        } else {
            // new staker
            stakers.push(msg.sender);
            info.index = stakers.length;
        }
        IERC20Token(token).transferFrom(msg.sender, address(this), amount);
    }

    function unstake(address to) public {
        StakeInfo storage info = stakeInfos[to];
        require(info.index != 0, "not exists");
        require(info.index <= stakers.length, "invalid index");
        // move last element to that vacated key slot
        uint256 index = info.index - 1;
        uint256 lastIndex = stakers.length - 1;
        stakeInfos[stakers[lastIndex]].index = index + 1;
        stakers[index] = stakers[lastIndex];
        delete stakers[lastIndex];
        IERC20Token(token).transfer(to, info.amount);
        delete stakeInfos[to];
    }

    function lock(uint256 amount) public isNotBlackWallet {
        require(amount > 0, "not enough");
        LockInfo storage info = lockInfos[msg.sender];
        info.amount += amount;
        info.lastClaimedTime = getCurrentTime();
        info.startTime = getCurrentTime();
        if (info.index > 0) {
            // already exists, do nothing
        } else {
            // new locker
            lockers.push(msg.sender);
            info.index = lockers.length;
        }
        IERC20Token(token).transferFrom(msg.sender, address(this), amount);
    }

    function claim() public {
        LockInfo storage info = lockInfos[msg.sender];
        require(info.index != 0, "not exists");
        require(info.index <= lockers.length, "invalid index");
        uint256 percentVested = percentVestedFor(msg.sender);
        if (percentVested >= 10000) {
            uint256 index = info.index - 1;
            uint256 lastIndex = lockers.length - 1;
            lockInfos[lockers[lastIndex]].index = index + 1;
            lockers[index] = lockers[lastIndex];
            delete lockers[lastIndex];
            IERC20Token(token).transfer(msg.sender, info.amount);
            delete lockInfos[msg.sender];
        } else {
            uint256 amount = (info.amount * percentVested) / 10000;
            lockInfos[msg.sender] = LockInfo({
                index: info.index,
                amount: info.amount - amount,
                lastClaimedTime: getCurrentTime(),
                startTime: info.startTime
            });
            IERC20Token(token).transfer(msg.sender, amount);
        }
    }

    function percentVestedFor(address _user)
        public
        view
        returns (uint256 percentVested_)
    {
        LockInfo memory info = lockInfos[_user];
        uint256 denominator = vestingDuration -
            ((info.lastClaimedTime - info.startTime) / slicingPeriod) *
            slicingPeriod;
        uint256 numerator = ((
            (getCurrentTime() -
                info.startTime -
                ((info.lastClaimedTime - info.startTime) / slicingPeriod) *
                slicingPeriod)
        ) / slicingPeriod) * slicingPeriod;
        if (info.amount > 0) {
            percentVested_ = (numerator * 10000) / denominator;
        } else {
            percentVested_ = 0;
        }
    }

    function emergencyWithdraw() public onlyAdmin {
        if (stakers.length > 0) emergencyUnstake();
        if (lockers.length > 0) emergencyUnlock();
    }

    function emergencyUnstake() internal {
        for (uint256 i = stakers.length; i > 0; --i) {
            IERC20Token(token).transfer(
                stakers[i - 1],
                stakeInfos[stakers[i - 1]].amount
            );
            delete stakeInfos[stakers[i - 1]];
            delete stakers[i - 1];
        }
    }

    function emergencyUnlock() internal {
        for (uint256 i = lockers.length; i > 0; --i) {
            IERC20Token(token).transfer(
                lockers[i - 1],
                lockInfos[lockers[i - 1]].amount
            );
            delete lockInfos[lockers[i - 1]];
            delete lockers[i - 1];
        }
    }

    function addBlackList(address blackWallet) public onlyAdmin {
        blackList.push(blackWallet);
    }

    modifier isNotBlackWallet() {
        if (blackList.length > 0) {
            for (uint256 i = blackList.length; i > 0; --i) {
                require(msg.sender != blackList[i - 1], "You're in blacklist");
            }
        }
        _;
    }

    function getCurrentTime()
        internal
        view
        virtual
        returns (uint256 _currentTime)
    {
        _currentTime = block.timestamp;
    }
}
