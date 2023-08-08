import './WaxHeader.css';
import { useEffect, useState } from 'react';
import Heading from '../src/Heading';
import Button from '../src/Button';
import DemoContext from './DemoContext';
import Loading from './Loading';
import runAsync from './helpers/runAsync';
import usePath from './usePath';
import formatRoundedEther from './helpers/formatRoundedEther';

const WaxHeader = () => {
  const demo = DemoContext.use();
  const address = demo.useAddress();

  const [, setPath] = usePath();

  const [balance, setBalance] = useState<bigint>();

  useEffect(() => {
    runAsync(async () => {
      if (address) {
        setBalance(await demo.waxInPage.ethersProvider.getBalance(address));
      } else {
        setBalance(undefined);
      }
    });
  }, [demo, address]);

  if (!address) {
    return <Loading>Error: missing address</Loading>;
  }

  return (
    <div className="wax-header">
      <Heading onClick={() => setPath('/')} style={{ cursor: 'pointer' }}>
        WAX
      </Heading>
      <div className="account-fields">
        <div>
          Address: {address.slice(0, 6)}..{address.slice(-4)}
        </div>
        <div>
          Balance: {balance ? `${formatRoundedEther(balance)} ETH` : ''}
        </div>
      </div>
      <div>
        <div style={{ display: 'inline-block' }}>
          <Button onPress={() => demo.clear()}>Disconnect</Button>
        </div>
      </div>
    </div>
  );
};

export default WaxHeader;
