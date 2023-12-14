import { useState } from 'react';
import './App.css';
import Parameter from './Parameter';
import Output from './Output';

const defaults = {
  ethPrice: 2200,
  l1GasPrice: 40,
  l2GasPrice: 0.01,
  l2CompressionRatio: 0.7,
};

const App = () => {
  const [ethPrice, setEthPrice] = useState(defaults.ethPrice);
  const [l1GasPrice, setL1GasPrice] = useState(defaults.l1GasPrice);
  const [l2GasPrice, setL2GasPrice] = useState(defaults.l2GasPrice);

  const [l2CompressionRatio, setL2CompressionRatio] = useState(
    defaults.l2CompressionRatio,
  );

  return (
    <div className="calculator">
      <div>
        <h1>WAX Fee Calculator</h1>
      </div>

      <div className="io">
        <div className="parameters">
          <div>
            <h2>Parameters</h2>
          </div>
          <Parameter
            label="ETH Price"
            format={(value) => `$${Math.round(value).toLocaleString()}`}
            init={defaults.ethPrice}
            scale={100}
            onChange={setEthPrice}
          />
          <Parameter
            label="L1 Gas Price"
            format={(value) => `${value.toFixed(2).toLocaleString()} gwei`}
            init={defaults.l1GasPrice}
            scale={100}
            onChange={setL1GasPrice}
          />
          <Parameter
            label="L2 Gas Price"
            format={(value) => `${value.toFixed(4).toLocaleString()} gwei`}
            init={defaults.l2GasPrice}
            scale={100}
            onChange={setL2GasPrice}
          />
          <Parameter
            label="L2 Compression Ratio"
            format={(value) => `${value.toFixed(2).toLocaleString()}x`}
            init={defaults.l2CompressionRatio}
            scale={5}
            onChange={setL2CompressionRatio}
          />
        </div>

        <div className="outputs">
          <div>
            <h2>Fees</h2>
          </div>

          <Output label="L1 Transfer">
            ${(ethPrice * l1GasPrice * 1e-9 * 21000).toFixed(4)}
          </Output>
        </div>
      </div>
    </div>
  );
};

export default App;
