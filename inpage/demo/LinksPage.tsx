import './LinksPage.css';
import Button from '../src/Button';
import usePath from './usePath';
import DemoContext from './DemoContext';
import runAsync from './helpers/runAsync';

const LinksPage = () => {
  const demo = DemoContext.use();
  const address = demo.useAddress();
  const [, setPath] = usePath();

  return (
    <div className="links-page">
      <Button
        secondary
        disabled={address === undefined}
        onPress={async () => {
          if (address === undefined) {
            return;
          }

          const admin = await demo.waxInPage.requestAdminAccount(
            'fund-new-account',
          );

          await (
            await admin.sendTransaction({
              to: address,
              value: 10n ** 18n,
            })
          ).wait();

          runAsync(() => demo.refreshBalance());
        }}
      >
        Add Funds
      </Button>
      <Button secondary onPress={() => setPath('/greeter')}>
        Greeter dApp
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
