import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ERC20Token, MockModule1, Module2 } from "../typechain";
import { beforeEach, describe, it } from "mocha";
import { Contract } from "ethers";

describe("module1", function () {
  let token: ERC20Token;
  let module1: Contract;
  let admin: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let addrs: SignerWithAddress[];

  beforeEach("deploying ... ", async () => {
    [admin, user1, user2, user3, ...addrs] = await ethers.getSigners();
    const TokenFactory = await ethers.getContractFactory("ERC20Token");
    token = await TokenFactory.deploy("mock token", "MT");
    await token.deployed();
    // console.log("token is deployed to ", token.address);

    const Module1Factory = await ethers.getContractFactory("MockModule1");
    module1 = await upgrades.deployProxy(Module1Factory, [
      token.address,
      86400 * 360,
      86400 * 30,
    ]);
    await (await token.mint(user1.address, 10000)).wait();
    await (await token.mint(user2.address, 10000)).wait();
    await (await token.mint(user3.address, 10000)).wait();
  });

  describe("stake and unstake", () => {
    it("users can stake if they approve the tokens to the contract", async () => {
      await (await token.connect(user1).approve(module1.address, 10000)).wait();
      await (await token.connect(user2).approve(module1.address, 10000)).wait();
      await (await token.connect(user3).approve(module1.address, 10000)).wait();
      await (await module1.connect(user1).stake(10000)).wait();
      await (await module1.connect(user2).stake(10000)).wait();
      await (await module1.connect(user3).stake(10000)).wait();
      let user1Info = await module1.stakeInfos(user1.address);
      let user2Info = await module1.stakeInfos(user2.address);
      let user3Info = await module1.stakeInfos(user3.address);
      expect(user1Info.index.toNumber()).to.be.eq(1);
      expect(user2Info.index.toNumber()).to.be.eq(2);
      expect(user3Info.index.toNumber()).to.be.eq(3);
      expect(user1Info.amount.toNumber()).to.be.eq(10000);
      expect(user2Info.amount.toNumber()).to.be.eq(10000);
      expect(user3Info.amount.toNumber()).to.be.eq(10000);
    });

    it("unstake anyone for anybody but the owner will receive", async () => {
      await (await token.connect(user1).approve(module1.address, 10000)).wait();
      await (await token.connect(user2).approve(module1.address, 10000)).wait();
      await (await token.connect(user3).approve(module1.address, 10000)).wait();
      await (await module1.connect(user1).stake(10000)).wait();
      await (await module1.connect(user2).stake(10000)).wait();
      await (await module1.connect(user3).stake(10000)).wait();
      let _User2Amount = (await token.balanceOf(user2.address)).toNumber();
      expect(_User2Amount).to.be.eq(0);
      await (await module1.connect(user1).unstake(user2.address)).wait();
      let User2Amount = (await token.balanceOf(user2.address)).toNumber();
      expect(User2Amount).to.be.eq(10000);
      let user3Index = (
        await module1.stakeInfos(user3.address)
      ).index.toNumber();
      expect(user3Index).to.be.eq(2);
    });
  });

  describe("lock and unlock", () => {
    it("cannot lock if in the blacklist", async () => {
      await (await module1.addBlackList(user1.address)).wait();
      await (await token.connect(user1).approve(module1.address, 10000)).wait();
      await expect(module1.connect(user1).lock(10000)).to.be.revertedWith(
        "You're in blacklist"
      );
    });

    it("lock users with approved amounts", async () => {
      await (await token.connect(user1).approve(module1.address, 10000)).wait();
      await (await token.connect(user2).approve(module1.address, 10000)).wait();
      await (await token.connect(user3).approve(module1.address, 10000)).wait();
      await (await module1.connect(user1).lock(10000)).wait();
      await (await module1.connect(user2).lock(10000)).wait();
      await (await module1.connect(user3).lock(10000)).wait();
      let info1 = await module1.lockInfos(user1.address);
      expect(info1.index.toNumber()).to.be.eq(1);
      expect(info1.amount.toNumber()).to.be.eq(10000);
      expect(info1.startTime.toNumber()).to.be.eq(0);
      expect(info1.lastClaimedTime.toNumber()).to.be.eq(0);
      let info2 = await module1.lockInfos(user2.address);
      expect(info2.index.toNumber()).to.be.eq(2);
      let info3 = await module1.lockInfos(user3.address);
      expect(info3.index.toNumber()).to.be.eq(3);
    });

    it("can lock serveral times", async () => {
      await (await token.connect(user1).approve(module1.address, 10000)).wait();
      await (await module1.connect(user1).lock(5000)).wait();
      await (await module1.connect(user1).lock(5000)).wait();
      let info = await module1.lockInfos(user1.address);
      expect(info.index.toNumber()).to.be.eq(1);
      expect(info.amount.toNumber()).to.be.eq(10000);
      expect(info.startTime.toNumber()).to.be.eq(0);
      expect(info.lastClaimedTime.toNumber()).to.be.eq(0);
    });

    it("unlock fails if not locked", async () => {
      await expect(module1.connect(user1).claim()).to.be.revertedWith(
        "not exists"
      );
    });

    it("unlock all if locked and fully vested", async () => {
      await (await token.connect(user1).approve(module1.address, 10000)).wait();
      await (await token.connect(user2).approve(module1.address, 10000)).wait();
      await (await token.connect(user3).approve(module1.address, 10000)).wait();
      await (await module1.connect(user1).lock(10000)).wait();
      await (await module1.connect(user2).lock(10000)).wait();
      await (await module1.connect(user3).lock(10000)).wait();
      await (await module1.setCurrentTime(86400 * 365 + 1)).wait();
      await (await module1.connect(user1).claim()).wait();
      expect(
        (await module1.lockInfos(user1.address)).index.toNumber()
      ).to.be.eq(0);
      expect(
        (await module1.lockInfos(user3.address)).index.toNumber()
      ).to.be.eq(1);
    });

    it("unlock portion of locked and not fully vested", async () => {
      await (await token.connect(user1).approve(module1.address, 10000)).wait();
      await (await token.connect(user2).approve(module1.address, 10000)).wait();
      await (await token.connect(user3).approve(module1.address, 10000)).wait();
      await (await module1.connect(user1).lock(10000)).wait();
      await (await module1.connect(user2).lock(10000)).wait();
      await (await module1.connect(user3).lock(10000)).wait();
      await (await module1.setCurrentTime(86400 * 90 + 1)).wait();
      await (await module1.connect(user1).claim()).wait();
      expect(
        (await module1.lockInfos(user1.address)).index.toNumber()
      ).to.be.eq(1);
      expect(
        (await module1.lockInfos(user3.address)).index.toNumber()
      ).to.be.eq(3);
      let user1bal = await token.balanceOf(user1.address);
      expect(user1bal.toNumber()).to.be.eq(2500);
    });
  });

  describe("emergency withdraw", () => {
    it("emergency withdraw fails if not admin", async () => {
      await (await token.connect(user1).approve(module1.address, 10000)).wait();
      await (await token.connect(user2).approve(module1.address, 10000)).wait();
      await (await token.connect(user3).approve(module1.address, 10000)).wait();
      await (await module1.connect(user1).stake(5000)).wait();
      await (await module1.connect(user2).stake(5000)).wait();
      await (await module1.connect(user3).stake(5000)).wait();
      await (await module1.connect(user1).lock(5000)).wait();
      await (await module1.connect(user2).lock(5000)).wait();
      await (await module1.connect(user3).lock(5000)).wait();
      await expect(
        module1.connect(addrs[0]).emergencyWithdraw()
      ).to.be.revertedWith("Err: not admin");
    });

    it("emergency withdraw fails if not admin", async () => {
      await (await token.connect(user1).approve(module1.address, 10000)).wait();
      await (await token.connect(user2).approve(module1.address, 10000)).wait();
      await (await token.connect(user3).approve(module1.address, 10000)).wait();
      await (await module1.connect(user1).stake(5000)).wait();
      await (await module1.connect(user2).stake(5000)).wait();
      await (await module1.connect(user3).stake(5000)).wait();
      await (await module1.connect(user1).lock(5000)).wait();
      await (await module1.connect(user2).lock(5000)).wait();
      await (await module1.connect(user3).lock(5000)).wait();
      await (await module1.emergencyWithdraw()).wait();
      expect((await token.balanceOf(user1.address)).toNumber()).to.be.equal(
        10000
      );
      expect((await token.balanceOf(user2.address)).toNumber()).to.be.equal(
        10000
      );
      expect((await token.balanceOf(user3.address)).toNumber()).to.be.equal(
        10000
      );
    });
  });
});
