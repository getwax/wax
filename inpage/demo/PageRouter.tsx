import usePath from './usePath';

const PageRouter = () => {
  const [path] = usePath();

  if (path === '/') {
    return <>Hello</>;
  }

  return <>Not found</>;
};

export default PageRouter;
