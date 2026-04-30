const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("배포 지갑:", deployer.address);
  console.log("잔액:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  const Contract = await ethers.getContractFactory("SeongdongPass");
  const contract = await Contract.deploy(deployer.address);
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("✅ SeongdongPass 배포 완료:", addr);
  console.log("🔗 Etherscan:", `https://sepolia.etherscan.io/address/${addr}`);
  console.log("\n.env에 아래 값을 추가하세요:");
  console.log(`CONTRACT_ADDRESS=${addr}`);
}

main().catch(e => { console.error(e); process.exit(1); });
