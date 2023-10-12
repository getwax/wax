import GreeterDApp from './GreeterDApp';
import LinksPage from './LinksPage';
import SendEthPage from './SendEthPage';
import usePath from './usePath';

const PageRouter = () => {
  const [path] = usePath();

  if (path === '/') {
    return <LinksPage />;
  }

  if (path === '/greeter') {
    return <GreeterDApp />;
  }

  if (path === '/sendEth') {
    return <SendEthPage />;
  }

  return <>Not found</>;
};

export default PageRouter;
