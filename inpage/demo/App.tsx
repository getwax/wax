import { useState } from 'react';
import './App.css';
import Button from '../src/Button';
import DemoContext from './DemoContext';

const App = () => {
  const demo = DemoContext.use();

  const [response, setResponse] = useState('pending');

  return (
    <>
      <h1>WAX</h1>
      <p>TODO</p>
      <Button
        style={{ display: 'inline-block' }}
        type="button"
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={async () => {
          setResponse(await demo.waxInPage.popup());
        }}
      >
        Popup
      </Button>
      <div
        style={{
          visibility: response === 'pending' ? 'hidden' : 'initial',
        }}
      >
        Response: {response}
      </div>
    </>
  );
};

export default App;
