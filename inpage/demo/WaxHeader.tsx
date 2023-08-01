import Heading from '../src/Heading';
import AccountTable from './AccountTable';
import Button from '../src/Button';
import DemoContext from './DemoContext';
import Loading from './Loading';

const WaxHeader = () => {
  const demo = DemoContext.use();
  const address = demo.useAddress();

  if (!address) {
    return <Loading>Error: missing address</Loading>;
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

export default WaxHeader;
