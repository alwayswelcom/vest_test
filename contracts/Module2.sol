//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./VRFConsumerBaseV2Upgradeable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "./interfaces/IERC20Token.sol";

contract Module2 is Initializable, VRFConsumerBaseV2Upgradeable {
    VRFCoordinatorV2Interface private COORDINATOR;
    LinkTokenInterface private LINKTOKEN;
    bytes32 private keyHash;
    uint32 private callbackGasLimit;
    uint16 private requestConfirmations;

    uint64 public s_subscriptionId;

    address public mainToken;

    address public admin;

    mapping(address => Card[]) public cards;
    mapping(uint256 => CardInfo) private randomnessRequest;

    struct Card {
        uint256 initialPower; // 100 * real_power
        uint256 createTime;
        uint256 powerIncrement; // 100 * real_increment( = evolution * (InitialCardPower * (tier number + color + symbol)))
        uint256 price;
    }

    struct CardInfo {
        address owner;
        uint256 index;
    }

    function initialize(
        address vrfCoordinator_,
        address linkToken_,
        address mainToken_,
        address admin_,
        bytes32 keyHash_,
        uint32 callbackGasLimit_,
        uint16 requestConfirmations_
    ) public initializer {
        __VRFBaseInitialize(vrfCoordinator_);
        COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator_);
        LINKTOKEN = LinkTokenInterface(linkToken_);
        mainToken = mainToken_;
        admin = admin_;
        keyHash = keyHash_;
        callbackGasLimit = callbackGasLimit_;
        requestConfirmations = requestConfirmations_;
        createSubscription();
    }

    modifier onlyAdmin() {
        require(admin == msg.sender, "Err: not admin");
        _;
    }

    function transferOwnership(address to) public onlyAdmin {
        admin = to;
    }

    function createCard(uint256 amount, uint256 price_) public {
        Card[] storage userCard = cards[msg.sender];
        Card memory card = Card({
            initialPower: amount,
            createTime: getCurrentTime(),
            powerIncrement: 0,
            price: price_
        });
        userCard.push(card);
        uint256 requestId = COORDINATOR.requestRandomWords(
            keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            4
        );
        CardInfo storage cardInfo = randomnessRequest[requestId];
        cardInfo.owner = msg.sender;
        cardInfo.index = userCard.length;
        IERC20Token(mainToken).transferFrom(msg.sender, address(this), amount);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords)
        internal
        override
    {
        CardInfo memory cardInfo = randomnessRequest[requestId];
        Card[] storage usercards = cards[cardInfo.owner];
        uint256 color = (randomWords[0] % 3) + 1;
        uint256 symbol = (randomWords[1] % 4 == 3)
            ? (randomWords[1] % 4) * 2 + 1
            : (randomWords[1] % 4) * 2;
        uint256 tier = (randomWords[2] % 5) + 1;
        uint256 evolution = (randomWords[3] % 100) + 1; // percent
        usercards[cardInfo.index - 1].powerIncrement =
            ((usercards[cardInfo.index - 1].initialPower *
                (tier + color + symbol)) * evolution) /
            100;
    }

    function banishCard(uint256 index) public {
        Card[] storage userCards = cards[msg.sender];
        require(userCards.length > index, "not exists");
        Card storage card = userCards[index];
        uint256 oneDay = 86400;
        uint256 power = card.powerIncrement *
            ((getCurrentTime() - card.createTime) / oneDay);
        IERC20Token(mainToken).mint(msg.sender, power);
        IERC20Token(mainToken).transfer(msg.sender, card.initialPower);
        uint256 lastIndex = userCards.length - 1;
        userCards[index] = userCards[lastIndex];
        delete userCards[lastIndex];
    }

    function createSubscription() internal {
        s_subscriptionId = COORDINATOR.createSubscription();
        // COORDINATOR.addConsumer(s_subscriptionId, address(this));
    }

    // Assumes this contract owns link.
    // 1000000000000000000 = 1 LINK
    function topUpSubscription(uint256 amount) external onlyAdmin {
        LINKTOKEN.transferAndCall(
            address(COORDINATOR),
            amount,
            abi.encode(s_subscriptionId)
        );
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
