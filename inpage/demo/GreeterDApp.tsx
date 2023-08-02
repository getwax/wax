import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';
import Loading from './Loading';

const GreeterDApp = () => {
  const demo = DemoContext.use();
  const contracts = demo.useContracts();

  if (!contracts) {
    return (
      <Loading>
        <Heading>Greeter</Heading>
        <div>Waiting for contracts</div>
        <Button onPress={() => demo.getContracts()}>Deploy</Button>
      </Loading>
    );
  }

  return <>TODO</>;
};

export default GreeterDApp;
