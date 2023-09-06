import { useEffect, useState } from 'react';
import TypedEmitter from './helpers/TypedEmitter';

const events = new TypedEmitter<{ changed(): void }>();

const usePath = () => {
  const [path, setInternalPath] = useState(window.location.pathname);

  const setPath = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    events.emit('changed');
  };

  useEffect(() => {
    const onChanged = () => {
      setInternalPath(window.location.pathname);
    };

    window.addEventListener('popstate', onChanged);
    events.addListener('changed', onChanged);

    return () => {
      window.removeEventListener('popstate', onChanged);
      events.off('changed', onChanged);
    };
  }, []);

  return [path, setPath] as const;
};

export default usePath;
