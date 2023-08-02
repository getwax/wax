import LinksPage from './LinksPage';
import usePath from './usePath';

const PageRouter = () => {
  const [path] = usePath();

  if (path === '/') {
    return <LinksPage />;
  }

  return <>Not found</>;
};

export default PageRouter;
