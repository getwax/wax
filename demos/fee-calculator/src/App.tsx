import { useState } from 'react';
import './App.css';

const defaults = {
  ethPrice: 2200,
  l1GasPrice: 40,
  l2GasPrice: 0.01,
};

const App = () => {
  const [ethSlider, setEthSlider] = useState(0);
  const [l1GasSlider, setL1GasSlider] = useState(0);

  const ethPrice = 100 ** (ethSlider ** 3) * defaults.ethPrice;
  const l1GasPrice = 100 ** (l1GasSlider ** 3) * defaults.l1GasPrice;

  return (
    <>
      <h1>WAX Fee Calculator</h1>

      <div>
        <h2>Parameters</h2>
        <div>
          <div>ETH Price: ${Math.round(ethPrice).toLocaleString()}</div>
          <div>
            <input
              type="range"
              min="-1"
              max="1"
              value={ethSlider}
              step={0.01}
              onInput={(e) => {
                setEthSlider(parseFloat(e.currentTarget.value));
              }}
            />
          </div>
        </div>
        <div>
          <div>L1 Gas Price: {l1GasPrice.toFixed(2).toLocaleString()}</div>
          <div>
            <input
              type="range"
              min="-1"
              max="1"
              value={l1GasSlider}
              step={0.01}
              onInput={(e) => {
                setL1GasSlider(parseFloat(e.currentTarget.value));
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
