import type WaxInPage from '../src';
import './App.css';

declare const waxInPage: WaxInPage;

function App() {
  return (
    <>
      <h1>WAX</h1>
      <p>TODO</p>
      <button
        type="button"
        onClick={() => {
          waxInPage.popup();
        }}
      >
        Popup
      </button>
    </>
  );
}

export default App;
