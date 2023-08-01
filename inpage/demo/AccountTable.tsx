import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import DemoContext from './DemoContext';

const AccountTable = ({ address }: { address: string }) => {
  const demo = DemoContext.use();

  const [balance, setBalance] = useState<bigint>();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => {
      setBalance(await demo.waxInPage.ethersProvider.getBalance(address));
    })();
  }, [demo, address]);

  const balanceDisplay = (() => {
    if (balance === undefined) {
      return undefined;
    }

    return `${ethers.formatEther(balance)} ETH`;
  })();

  return (
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
  );
};

export default AccountTable;
