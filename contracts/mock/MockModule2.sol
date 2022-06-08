//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../Module2.sol";

contract MockModule2 is Module2 {
    uint256 private currentTime;

    function getCurrentTime()
        internal
        view
        override
        returns (uint256 _currentTime)
    {
        _currentTime = currentTime;
    }

    function setCurrentTime(uint256 _currentTime) external {
        currentTime = _currentTime;
    }
}
