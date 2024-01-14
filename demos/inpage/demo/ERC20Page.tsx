import './ERC20Page.css';
import { useEffect, useRef, useState } from 'react';
import { ethers } from 'ethers';
import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';
import Loading from './Loading';
import useRefresh from './useRefresh';
import { ERC20Mock__factory, ERC20__factory } from '../hardhat/typechain-types';
import receiptOf from '../src/helpers/receiptOf';

const ERC20Page = () => {
  const demo = DemoContext.use();
  const contracts = demo.useContracts();
  const signer = demo.useSigner();
  const refresh = useRefresh();

  const [testTokenAddress, setTestTokenAddress] = useState(
    '(test token loading)',
  );
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenBalance, setTokenBalance] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const balanceRefreshTag = useRef(0);

  useEffect(() => {
    void (async () => {
      if (contracts) {
        const addr = await contracts.testToken.getAddress();
        setTestTokenAddress(addr);
        setTokenAddress(addr);
      }
    })();
  }, [contracts]);

  useEffect(() => {
    void (async () => {
      if (!(contracts && tokenAddress && signer)) {
        return;
      }

      const code = await demo.waxInPage.ethersProvider.getCode(tokenAddress);

      if (code === '0x') {
        setTokenBalance('');
        return;
      }

      const token = ERC20__factory.connect(tokenAddress, signer);
      const symbol = await token.symbol();
      const decimals = await token.decimals();
      const balance = await token.balanceOf(await signer.getAddress());

      setTokenBalance(`${ethers.formatUnits(balance, decimals)} ${symbol}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contracts,
    demo.waxInPage.ethersProvider,
    signer,
    tokenAddress,
    balanceRefreshTag.current,
  ]);

  if (!signer) {
    return (
      <Loading>
        <Heading>ERC20</Heading>
        <div>Waiting for signer</div>
      </Loading>
    );
  }

  if (!contracts) {
    return (
      <Loading>
        <Heading>ERC20</Heading>
        <div>Waiting for contracts</div>
        <Button onPress={() => demo.getContracts()}>Deploy</Button>
      </Loading>
    );
  }

  return (
    <div className="erc20-page">
      <Heading>ERC20</Heading>
      <div>
        <input
          type="text"
          onInput={(e) => setTokenAddress(e.currentTarget.value)}
          placeholder="Token address"
          value={tokenAddress}
        />
      </div>
      <div>
        <Button
          onPress={async () => {
            const testToken = ERC20Mock__factory.connect(
              testTokenAddress,
              signer,
            );

            await receiptOf(
              testToken.mint(
                await signer.getAddress(),
                10n ** (await testToken.decimals()),
              ),
            );

            balanceRefreshTag.current += 1;

            refresh();
          }}
          secondary={
            tokenAddress !== testTokenAddress || parseFloat(tokenBalance) > 0
          }
        >
          Mint
        </Button>
      </div>
      <div>
        Balance: <span>{tokenBalance}</span>
      </div>
      <div>
        <input
          type="text"
          onInput={(e) => setRecipient(e.currentTarget.value)}
          placeholder="Recipient address"
        />
      </div>
      <div>
        <input
          type="text"
          onInput={(e) => setAmount(e.currentTarget.value)}
          placeholder="Amount"
        />
      </div>
      <div>
        <Button
          onPress={async () => {
            const token = ERC20__factory.connect(tokenAddress, signer);

            await receiptOf(
              token.transfer(
                recipient,
                ethers.parseUnits(amount, await token.decimals()),
              ),
            );

            balanceRefreshTag.current += 1;

            refresh();
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
};

export default ERC20Page;
