import './SendEthPage.css';
import { useState } from 'react';
import { ethers } from 'ethers';
import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';
import Loading from './Loading';
import useRefresh from './useRefresh';
import runAsync from './helpers/runAsync';

const SendEthPage = () => {
  const demo = DemoContext.use();
  const signer = demo.useSigner();
  const refresh = useRefresh();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  if (!signer) {
    return (
      <Loading>
        <Heading>Send ETH</Heading>
        <div>Waiting for signer</div>
      </Loading>
    );
  }

  return (
    <div className="send-eth-page">
      <Heading>Send ETH</Heading>
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
            await (
              await signer.sendTransaction({
                to: recipient,
                value: ethers.parseEther(amount),
              })
            ).wait();

            runAsync(() => demo.refreshBalance());
            refresh();
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
};

export default SendEthPage;
