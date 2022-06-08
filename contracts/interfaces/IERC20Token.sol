// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

interface IERC20Token {
    function transferOwnerShip(address to) external;

    function mint(address to, uint256 amount) external;

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}
