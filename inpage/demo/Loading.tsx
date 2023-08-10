import { ReactNode, useEffect, useState } from 'react';

const Loading = ({ children }: { children?: ReactNode }) => {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const timerId = setTimeout(() => {
      setDelayed(true);
    }, 200);

    return () => {
      clearTimeout(timerId);
    };
  }, []);

  if (!delayed) {
    return [];
  }

  return children ?? 'Loading...';
};

export default Loading;
