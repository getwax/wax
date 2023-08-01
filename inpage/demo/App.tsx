import './App.css';
import Button from '../src/Button';
import DemoContext from './DemoContext';
import Heading from '../src/Heading';
import AccountTable from './AccountTable';

const globalRecord = globalThis as Record<string, unknown>;

const App = () => {
  const demo = DemoContext.use();
  const address = demo.useAddress();

  return (
    <>
      <Heading>WAX</Heading>
      {(() => {
        if (address) {
          return (
            <div>
              <AccountTable address={address} />
            </div>
          );
        }

        return (
          <Button
            style={{ display: 'inline-block' }}
            type="button"
            onPress={() => demo.requestAddress()}
          >
            Connect
          </Button>
        );
      })()}
      <Button
        secondary
        onPress={async () => {
          const signer = await demo.waxInPage.ethersProvider.getSigner();
          globalRecord.signer = signer;
        }}
      >
        window.signer
      </Button>
      <Button secondary onPress={() => demo.clear()}>
        Clear
      </Button>
    </>
  );
};

export default App;
