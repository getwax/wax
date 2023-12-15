import React, { useState } from 'react';

const ExponentialSlider = ({
  init,
  min,
  max,
  onChange,
}: {
  init: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) => {
  const scale = Math.max(init / min, max / init);
  const [sliderValue, setSliderValue] = useState(0);

  const sliderMinDown1p5 = Math.log(min / init) / Math.log(scale);
  const sliderMin =
    Math.sign(sliderMinDown1p5) * Math.abs(sliderMinDown1p5) ** (1 / 1.5);

  const sliderMaxUp1p5 = Math.log(max / init) / Math.log(scale);
  const sliderMax =
    Math.sign(sliderMaxUp1p5) * Math.abs(sliderMaxUp1p5) ** (1 / 1.5);

  return (
    <div>
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        value={sliderValue}
        step={0.01}
        onInput={(e) => {
          const newSliderValue = parseFloat(e.currentTarget.value);
          setSliderValue(newSliderValue);
          onChange(
            scale **
              (Math.sign(newSliderValue) * Math.abs(newSliderValue) ** 1.5) *
              init,
          );
        }}
      />
    </div>
  );
};

export default ExponentialSlider;
