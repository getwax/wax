import './Parameter.scss';
import { useState } from 'react';
import ExponentialSlider from './ExponentialSlider';

const Parameter = ({
  label,
  format,
  init,
  min,
  max,
  onChange,
}: {
  label: string;
  format: (value: number) => string;
  init: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) => {
  const [value, setValue] = useState(init);

  return (
    <div className="parameter-wrapper">
      <div className="parameter">
        <div className="top-row">
          <div>{label}</div>
          <div style={{ flexGrow: 1 }} />
          <div>{format(value)}</div>
        </div>
        <div>
          <ExponentialSlider
            init={init}
            min={min}
            max={max}
            onChange={(newValue) => {
              setValue(newValue);
              onChange(newValue);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Parameter;
