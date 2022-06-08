// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "./ERC20Callback.sol";

contract ERC20Token is ERC20Callback {
    address public admin;

    constructor(string memory name_, string memory symbol_)
        ERC20Callback(name_, symbol_)
    {
        _transferOwnerShip(msg.sender);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    function transferOwnerShip(address to) public onlyAdmin {
        admin = to;
    }

    function _transferOwnerShip(address to) internal {
        admin = to;
    }

    function mint(address to, uint256 amount) public onlyAdmin {
        _mint(to, amount);
    }
}
