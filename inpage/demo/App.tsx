import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import './App.css';
import Button from '../src/Button';
import DemoContext from './DemoContext';
import Heading from '../src/Heading';
import assert from '../src/helpers/assert';

const App = () => {
  const demo = DemoContext.use();

  const [address, setAddress] = useState<string>();
  const [balance, setBalance] = useState<bigint>();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      if (address) {
        setBalance(await demo.provider.getBalance(address));
      }
    })();
  }, [demo, address]);

  const balanceDisplay = (() => {
    if (balance === undefined) {
      return undefined;
    }

    return `${ethers.formatEther(balance)} ETH`;
  })();

  return (
    <>
      <Heading>WAX</Heading>
      {address !== undefined && (
        <div>
          <table>
            <tbody>
              <tr>
                <td>Address</td>
                <td>
                  {(() => {
                    if (!address) {
                      return '';
                    }

                    return `${address.slice(0, 6)}..${address.slice(-4)}`;
                  })()}
                </td>
              </tr>
              <tr>
                <td>Balance</td>
                <td>{balanceDisplay}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {address === undefined && (
        <div>
          <Button
            style={{ display: 'inline-block' }}
            type="button"
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onClick={async () => {
              const response = await demo.ethereum.request({
                method: 'eth_requestAccounts',
              });

              // TODO: Better type information for EthereumApi
              assert(Array.isArray(response));
              assert(typeof response[0] === 'string');

              setAddress(response[0]);
            }}
          >
            Connect
          </Button>
        </div>
      )}
    </>
  );
};

export default App;
