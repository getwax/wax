import './LinksPage.css';
import Button from '../src/Button';
import usePath from './usePath';

const LinksPage = () => {
  const [, setPath] = usePath();

  return (
    <div className="links-page">
      <Button onPress={() => setPath('/greeter')}>Greeter dApp</Button>
    </div>
  );
};

export default LinksPage;
