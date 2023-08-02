import './GreeterDApp.css';
import { useState } from 'react';
import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';
import Loading from './Loading';
import RenderAsync from './RenderAsync';
import useRefresh from './useRefresh';

const GreeterDApp = () => {
  const demo = DemoContext.use();
  const contracts = demo.useContracts();
  const signer = demo.useSigner();
  const refresh = useRefresh();

  const [greetingInput, setGreetingInput] = useState('');

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
    <div className="greeter-dapp">
      <Heading>Greeter</Heading>
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
      <div>
        New greeting:{' '}
        <input
          type="text"
          onInput={(e) => setGreetingInput(e.currentTarget.value)}
        />
      </div>
      <Button
        disabled={!signer}
        onPress={async () => {
          await contracts.greeter.connect(signer).setGreeting(greetingInput);
          refresh();
        }}
      >
        Update
      </Button>
    </div>
  );
};

export default GreeterDApp;
