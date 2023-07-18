import { useState } from 'react';
import type WaxInPage from '../src';
import './App.css';
import Button from '../src/Button';

declare const waxInPage: WaxInPage;

const App = () => {
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
          setResponse(await waxInPage.popup());
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
