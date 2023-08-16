import { useState } from 'react';

const useRefresh = () => {
  const [, setNow] = useState<number>(Date.now());

  return () => setNow(Date.now());
};

export default useRefresh;
