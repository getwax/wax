import './LinksPage.css';
import { ethers } from 'ethers';
import Button from '../src/Button';
import usePath from './usePath';
import DemoContext from './DemoContext';
import runAsync from './helpers/runAsync';
import config from './config/config';

const addFundsDefault = (() => {
  if (config.rpcUrl === 'http://127.0.0.1:8545') {
    return '1.0';
  }

  return '0.002';
})();

const LinksPage = () => {
  const demo = DemoContext.use();
  const [, setPath] = usePath();
  const account = demo.useAccount();

  return (
    <div className="links-page">
      <Button
        secondary
        disabled={account === undefined}
        onPress={async () => {
          if (account === undefined) {
            return;
          }

          const admin = await demo.waxInPage.requestAdminAccount(
            'fund-new-account',
          );

          const { ownerAddress } = account.toData();

          await (
            await admin.sendTransaction({
              to: account.address,
              value: ethers.parseEther(
                config.addFundsEthAmount ?? addFundsDefault,
              ),
            })
          ).wait();

          // TODO: (merge-ok) ensure wallet is already funded
          await (
            await admin.sendTransaction({
              to: ownerAddress,
              value: ethers.parseEther(
                config.addFundsEthAmount ?? addFundsDefault,
              ),
            })
          ).wait();

          runAsync(() => demo.refreshBalance());
        }}
      >
        Add Funds
      </Button>
      <Button secondary onPress={() => setPath('/sendEth')}>
        Send ETH
      </Button>
      <Button secondary onPress={() => setPath('/greeter')}>
        Greeter dApp
      </Button>
      <Button
        secondary
        onPress={() => {
          setPath('/recovery');
        }}
      >
        Recovery Example
      </Button>
      <Button
        secondary
        onPress={async () => {
          const granted = await demo.waxInPage.requestPermission(
            'This will reset the in-page wallet, including the stored private key. Are you sure?',
          );

          if (granted) {
            await demo.clear();
          }
        }}
      >
        Reset
      </Button>
    </div>
  );
};

export default LinksPage;
