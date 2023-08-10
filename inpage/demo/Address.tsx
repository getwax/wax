import './Address.css';

export const Address = ({
  value,
  short = true,
}: {
  value: string;
  short?: boolean;
}) => {
  const str = short ? `${value.slice(0, 6)}..${value.slice(-4)}` : value;

  return (
    <span
      className="eth-address"
      role="button"
      tabIndex={0}
      onClick={() => {
        void navigator.clipboard.writeText(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          void navigator.clipboard.writeText(value);
        }
      }}
    >
      {str}
    </span>
  );
};

export default Address;
