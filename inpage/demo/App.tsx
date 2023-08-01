import './App.css';
import Button from '../src/Button';
import DemoContext from './DemoContext';
import Heading from '../src/Heading';
import AccountTable from './AccountTable';
import ConnectPage from './ConnectPage';

const App = () => {
  const demo = DemoContext.use();
  const address = demo.useAddress();

  if (!address) {
    return <ConnectPage />;
  }

  return (
    <>
      <Heading>WAX</Heading>
      <div>
        <AccountTable address={address} />
      </div>
      <Button secondary onPress={() => demo.clear()}>
        Clear
      </Button>
    </>
  );
};

export default App;
