import './ConnectPage.css';

import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';

const ConnectPage = () => {
  const demo = DemoContext.use();

  return (
    <div className="connect-page">
      <div>
        <Heading>WAX</Heading>
        <Button
          style={{ display: 'inline-block' }}
          type="button"
          onPress={() => demo.requestAddress()}
        >
          Connect
        </Button>
      </div>
    </div>
  );
};

export default ConnectPage;
