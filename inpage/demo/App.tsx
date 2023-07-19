import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import './App.css';
import Button from '../src/Button';
import DemoContext from './DemoContext';
import Heading from '../src/Heading';

const testAddr = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const App = () => {
  const demo = DemoContext.use();

  const [response, setResponse] = useState('pending');
  const [balance, setBalance] = useState<bigint>();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      setBalance(await demo.provider.getBalance(testAddr));
    })();
  }, [demo]);

  const balanceDisplay = (() => {
    if (balance === undefined) {
      return undefined;
    }

    return `${ethers.formatEther(balance)} ETH`;
  })();

  return (
    <>
      <Heading>WAX</Heading>
      <div>
        <table>
          <tbody>
            <tr>
              <td>Test addr</td>
              <td>
                {testAddr.slice(0, 6)}..{testAddr.slice(-4)}
              </td>
            </tr>
            <tr>
              <td>Balance</td>
              <td>{balanceDisplay}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <Button
          style={{ display: 'inline-block' }}
          type="button"
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={async () => {
            setResponse(await demo.waxInPage.popup());
          }}
        >
          Popup
        </Button>
        <div
          style={{
            visibility: response === 'pending' ? 'hidden' : 'initial',
          }}
        >
          Response: {response}
        </div>
      </div>
    </>
  );
};

export default App;
