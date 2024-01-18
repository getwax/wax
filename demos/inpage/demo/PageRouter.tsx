import GreeterDApp from './GreeterDApp';
import LinksPage from './LinksPage';
import SendEthPage from './SendEthPage';
import Recovery from './Recovery';
import usePath from './usePath';
import RegisterAddressPage from './RegisterAddressPage';
import ERC20Page from './ERC20Page';

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

  if (path === '/erc20') {
    return <ERC20Page />;
  }

  if (path === '/recovery') {
    return <Recovery />;
  }

  if (path === '/registerAddress') {
    return <RegisterAddressPage />;
  }

  return <>Not found</>;
};

export default PageRouter;
