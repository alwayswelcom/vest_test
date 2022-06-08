import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ERC20Token, LinkToken, VRFCoordinatorV2Mock } from "../typechain";
import { beforeEach, describe, it } from "mocha";
import { Contract } from "ethers";

describe("module2", function () {
  let module2: Contract;
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let addrs: SignerWithAddress[];
  let linkToken: LinkToken;
  let mainToken: ERC20Token;
  let VRFCoordinatorV2Mock: VRFCoordinatorV2Mock;
  let keyHash =
    "0x6c3699283bda56ad74f6b855546325b68d482e983852a7a82979cc4807b641f4";
  beforeEach("deploying ... ", async () => {
    [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
    const LinkFactory = await ethers.getContractFactory("LinkToken");
    linkToken = await LinkFactory.deploy();
    await linkToken.deployed();
    const VRFFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock");
    VRFCoordinatorV2Mock = await VRFFactory.deploy(0, 0);
    await VRFCoordinatorV2Mock.deployed();
    const ERC20TokenFactory = await ethers.getContractFactory("ERC20Token");
    mainToken = await ERC20TokenFactory.deploy("main Token", "MT");
    await mainToken.deployed();
    const Module2Factory = await ethers.getContractFactory("MockModule2");
    module2 = await upgrades.deployProxy(Module2Factory, [
      VRFCoordinatorV2Mock.address,
      linkToken.address,
      mainToken.address,
      admin.address,
      keyHash,
      2000000,
      3,
    ]);
    await (await mainToken.mint(user1.address, 10000)).wait();
    await (await mainToken.mint(user2.address, 10000)).wait();
    await (await mainToken.mint(user3.address, 10000)).wait();
    await (await mainToken.transferOwnerShip(module2.address)).wait();
  });

  describe("create card", () => {
    it("anyone can create card", async () => {
      await (
        await mainToken.connect(user1).approve(module2.address, 10000)
      ).wait();
      await (
        await mainToken.connect(user2).approve(module2.address, 10000)
      ).wait();
      await (
        await mainToken.connect(user3).approve(module2.address, 10000)
      ).wait();
      await (await module2.connect(user1).createCard(10000, 1)).wait();
      await (await module2.connect(user2).createCard(10000, 2)).wait();
      await (await module2.connect(user3).createCard(10000, 3)).wait();
      await (
        await VRFCoordinatorV2Mock.fulfillRandomWords(1, module2.address)
      ).wait();
      await (
        await VRFCoordinatorV2Mock.fulfillRandomWords(2, module2.address)
      ).wait();
      await (
        await VRFCoordinatorV2Mock.fulfillRandomWords(3, module2.address)
      ).wait();
      let cards1 = await module2.cards(user1.address, 0);
      expect(cards1.initialPower.toNumber()).to.be.eq(10000);
    });

    it("create cards serveral times", async () => {
      await (
        await mainToken.connect(user1).approve(module2.address, 10000)
      ).wait();
      await (await module2.connect(user1).createCard(2000, 1)).wait();
      await (await module2.connect(user1).createCard(3000, 2)).wait();
      await (await module2.connect(user1).createCard(5000, 3)).wait();
      await (
        await VRFCoordinatorV2Mock.fulfillRandomWords(1, module2.address)
      ).wait();
      await (
        await VRFCoordinatorV2Mock.fulfillRandomWords(2, module2.address)
      ).wait();
      await (
        await VRFCoordinatorV2Mock.fulfillRandomWords(3, module2.address)
      ).wait();
      let cards1 = await module2.cards(user1.address, 0);
      expect(cards1.initialPower.toNumber()).to.be.eq(2000);
      cards1 = await module2.cards(user1.address, 1);
      expect(cards1.initialPower.toNumber()).to.be.eq(3000);
      cards1 = await module2.cards(user1.address, 2);
      expect(cards1.initialPower.toNumber()).to.be.eq(5000);
    });

    it("banish fails if no card exists", async () => {
      await expect(module2.connect(user1).banishCard(0)).to.be.revertedWith(
        "not exists"
      );
    });

    it("banish card with index", async () => {
      await (
        await mainToken.connect(user1).approve(module2.address, 10000)
      ).wait();
      await (
        await mainToken.connect(user2).approve(module2.address, 10000)
      ).wait();
      await (
        await mainToken.connect(user3).approve(module2.address, 10000)
      ).wait();
      await (await module2.connect(user1).createCard(10000, 1)).wait();
      await (await module2.connect(user2).createCard(10000, 2)).wait();
      await (await module2.connect(user3).createCard(10000, 3)).wait();
      await (
        await VRFCoordinatorV2Mock.fulfillRandomWords(1, module2.address)
      ).wait();
      await (
        await VRFCoordinatorV2Mock.fulfillRandomWords(2, module2.address)
      ).wait();
      await (
        await VRFCoordinatorV2Mock.fulfillRandomWords(3, module2.address)
      ).wait();
      let cards1 = await module2.cards(user1.address, 0);
      expect(cards1.initialPower.toNumber()).to.be.eq(10000);
      let initialPower = cards1.initialPower.toNumber();
      let increment1 = cards1.powerIncrement.toNumber();
      await (await module2.setCurrentTime(86400 * 2)).wait();
      await (await module2.connect(user1).banishCard(0)).wait();
      expect((await mainToken.balanceOf(user1.address)).toNumber()).to.be.eq(
        initialPower + 2 * increment1
      );
    });
  });
});
