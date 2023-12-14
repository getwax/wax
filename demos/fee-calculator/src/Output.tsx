import './Output.scss';
import { ReactNode } from 'react';

const Output = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="output-wrapper">
    <div className="output">
      <div>{label}</div>
      <div style={{ flexGrow: 1 }} />
      <div>{children}</div>
    </div>
  </div>
);

export default Output;
