import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';
import Loading from './Loading';
import RenderAsync from './RenderAsync';

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

  return (
    <div>
      <div>
        <RenderAsync
          promise={contracts.greeter.getAddress()}
          render={(addr) => addr}
        />
      </div>
      <div>
        Current greeting:&nbsp;
        <RenderAsync
          promise={contracts.greeter.greet()}
          render={(greeting) => `"${greeting}"`}
        />
      </div>
    </div>
  );
};

export default GreeterDApp;
