import { useEffect, useState } from 'react';
import './App.css';
import Button from '../src/Button';
import DemoContext from './DemoContext';
import Heading from '../src/Heading';
import AccountTable from './AccountTable';

const globalRecord = globalThis as Record<string, unknown>;

const App = () => {
  const demo = DemoContext.use();

  const [address, setAddress] = useState<string>();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      if (!address) {
        const accounts = await demo.ethereum.request({
          method: 'eth_accounts',
        });

        if (accounts.length > 0) {
          setAddress(accounts[0]);
        }
      }
    })();
  }, [demo, address]);

  return (
    <>
      <Heading>WAX</Heading>
      {address !== undefined && (
        <div>
          <AccountTable address={address} />
        </div>
      )}
      {address === undefined && (
        <Button
          style={{ display: 'inline-block' }}
          type="button"
          onPress={async () => {
            const response = await demo.ethereum.request({
              method: 'eth_requestAccounts',
            });

            setAddress(response[0]);
          }}
        >
          Connect
        </Button>
      )}
      <Button
        secondary
        onPress={async () => {
          const signer = await demo.waxInPage.ethersProvider.getSigner();
          globalRecord.signer = signer;
        }}
      >
        window.signer
      </Button>
      <Button
        secondary
        onPress={async () => {
          await demo.waxInPage.storage.clear();
          setAddress(undefined);
        }}
      >
        Clear
      </Button>
    </>
  );
};

export default App;
