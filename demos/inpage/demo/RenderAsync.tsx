import { ReactNode, useEffect, useState } from 'react';
import Loading from './Loading';

function RenderAsync<T extends NonNullable<unknown>>({
  promise,
  loading = () => <Loading />,
  render,
  renderError = (error) => {
    if (error instanceof Error) {
      return error.message;
    }

    return <>{JSON.stringify(error)}</>;
  },
}: {
  promise: Promise<T>;
  loading?: () => ReactNode;
  render: (value: T) => ReactNode;
  renderError?: (error: unknown) => ReactNode;
}) {
  const [value, setValue] = useState<T>();
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    promise.then(setValue, setError);
  }, [promise]);

  if (error !== undefined) {
    return renderError(error);
  }

  if (value !== undefined) {
    return render(value);
  }

  return loading();
}

export default RenderAsync;
