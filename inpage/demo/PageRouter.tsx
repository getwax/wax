import GreeterDApp from './GreeterDApp';
import LinksPage from './LinksPage';
import usePath from './usePath';

const PageRouter = () => {
  const [path] = usePath();

  if (path === '/') {
    return <LinksPage />;
  }

  if (path === '/greeter') {
    return <GreeterDApp />;
  }

  return <>Not found</>;
};

export default PageRouter;
