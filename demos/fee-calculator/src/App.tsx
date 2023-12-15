import React, { useState } from 'react';
import './App.css';
import Parameter from './Parameter';
import Output from './Output';

const defaults = {
  ethPrice: 2200,
  l1GasPrice: 40,
  l2GasPrice: 0.01,
  l2CompressionRatio: 0.7,
  calldataCostReduction4844: 1,
  bundleSize: 5,
  bundlerProfitMargin: 0.05,
};

const constants = {
  transferGas: 21_000,
  transferEffectiveBytes: 120,
  gasPerByte: 16,
  l2FixedOverhead: 188, // Fixed overhead of L1 gas (before compression)
};

const App = () => {
  const [ethPrice, setEthPrice] = useState(defaults.ethPrice);
  const [l1GasPrice, setL1GasPrice] = useState(defaults.l1GasPrice);
  const [l2GasPrice, setL2GasPrice] = useState(defaults.l2GasPrice);

  const [l2CompressionRatio, setL2CompressionRatio] = useState(
    defaults.l2CompressionRatio,
  );

  const [calldataCostReduction4844, setCalldataCostReduction4844] = useState(
    defaults.calldataCostReduction4844,
  );

  const [bundleSize, setBundleSize] = useState(defaults.bundleSize);

  const [bundlerProfitMargin, setBundlerProfitMargin] = useState(
    defaults.bundlerProfitMargin,
  );

  const l1TransferFee = ethPrice * l1GasPrice * 1e-9 * constants.transferGas;

  const l2TransferFee = (() => {
    const l1Gas =
      (l2CompressionRatio / calldataCostReduction4844) *
      (constants.transferEffectiveBytes * constants.gasPerByte +
        constants.l2FixedOverhead);

    const l2Gas = constants.transferGas;

    return ethPrice * 1e-9 * (l1GasPrice * l1Gas + l2GasPrice * l2Gas);
  })();

  const l2TransferFee4337 = (() => {
    const bundleOverheadEffectiveBytes = 155;
    const addedEffectiveBytes = 455 - bundleOverheadEffectiveBytes;

    const effectiveBytesCharged =
      bundleOverheadEffectiveBytes / bundleSize + addedEffectiveBytes;

    const l1Gas =
      (l2CompressionRatio / calldataCostReduction4844) *
      (effectiveBytesCharged * constants.gasPerByte +
        constants.l2FixedOverhead);

    const bundleOverheadGas = 25937;
    const addedGas = 115195 - bundleOverheadGas;

    const l2GasCharged = bundleOverheadGas / bundleSize + addedGas;

    return (
      (1 + bundlerProfitMargin) *
      ethPrice *
      1e-9 *
      (l1GasPrice * l1Gas + l2GasPrice * l2GasCharged)
    );
  })();

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
          <Parameter
            label="4844 Calldata Cost Reduction"
            format={(value) => `${value.toFixed(1).toLocaleString()}x`}
            init={defaults.calldataCostReduction4844}
            scale={400}
            onChange={setCalldataCostReduction4844}
          />
          <Parameter
            label="Bundle Size"
            format={(value) => `${value.toFixed(0).toLocaleString()} user ops`}
            init={defaults.bundleSize}
            scale={100}
            onChange={setBundleSize}
          />
          <Parameter
            label="Bundler Profit Margin"
            format={(value) => `${(value * 100).toFixed(1).toLocaleString()}%`}
            init={defaults.bundlerProfitMargin}
            scale={10}
            onChange={setBundlerProfitMargin}
          />
        </div>

        <div className="outputs">
          <div>
            <h2>Fees</h2>
          </div>
          <Output label="L1 Transfer">${l1TransferFee.toFixed(4)}</Output>
          <Output label="L2 Transfer">${l2TransferFee.toFixed(4)}</Output>
          <Output label="L2 4337 Transfer">
            ${l2TransferFee4337.toFixed(4)}
          </Output>
        </div>
      </div>
    </div>
  );
};

export default App;
