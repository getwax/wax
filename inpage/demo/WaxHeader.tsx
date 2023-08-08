import './WaxHeader.css';
import Heading from '../src/Heading';
import Button from '../src/Button';
import DemoContext from './DemoContext';
import Loading from './Loading';
import usePath from './usePath';
import formatRoundedEther from './helpers/formatRoundedEther';
import Address from './Address';

const WaxHeader = () => {
  const demo = DemoContext.use();
  const address = demo.useAddress();
  const balance = demo.useBalance();

  const [, setPath] = usePath();

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
          Address: <Address value={address} />
        </div>
        <div>
          Balance:{' '}
          {balance !== undefined ? `${formatRoundedEther(balance)} ETH` : ''}
        </div>
      </div>
      <div>
        <div style={{ display: 'inline-block' }}>
          <Button onPress={() => demo.disconnect()}>Disconnect</Button>
        </div>
      </div>
    </div>
  );
};

export default WaxHeader;
