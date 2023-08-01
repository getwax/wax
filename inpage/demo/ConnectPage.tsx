import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';

const ConnectPage = () => {
  const demo = DemoContext.use();

  return (
    <>
      <Heading>WAX</Heading>
      <Button
        style={{ display: 'inline-block' }}
        type="button"
        onPress={() => demo.requestAddress()}
      >
        Connect
      </Button>
    </>
  );
};

export default ConnectPage;
