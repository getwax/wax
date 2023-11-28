import { Signer, ethers } from "ethers";

/** returns the 5 accounts funded by the fundAccounts.js script */
export const getSigners = () => {
  const mnemonic = process.env.MNEMONIC;

  if (!mnemonic) {
    throw new Error(
      "missing env var MNEMONIC. Make sure you have copied or created a .env file",
    );
  }

  const signers: Signer[] = [];

  for (let i = 0; i <= 4; i++) {
    const hdNodeWalletFromPhrase = ethers.HDNodeWallet.fromPhrase(
      mnemonic,
      "",
      `m/44'/60'/0'/0/${i}`,
    );

    signers.push(hdNodeWalletFromPhrase);
  }

  return signers;
};
