import { useState } from 'react';
import type WaxInPage from '../src';
import './App.css';

declare const waxInPage: WaxInPage;

const App = () => {
  const [response, setResponse] = useState('');

  return (
    <>
      <h1>WAX</h1>
      <p>TODO</p>
      <button
        type="button"
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onClick={async () => {
          setResponse(await waxInPage.popup());
        }}
      >
        Popup
      </button>
      <div>{response && <>Response: {response}</>}</div>
    </>
  );
};

export default App;
