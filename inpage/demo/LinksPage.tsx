import './LinksPage.css';
import Button from '../src/Button';
import usePath from './usePath';
import DemoContext from './DemoContext';

const LinksPage = () => {
  const demo = DemoContext.use();
  const [, setPath] = usePath();

  return (
    <div className="links-page">
      <Button secondary onPress={() => setPath('/greeter')}>
        Greeter dApp
      </Button>
      <Button
        secondary
        onPress={async () => {
          const granted = await demo.waxInPage.requestPermission(
            'This will reset the in-page wallet, including the stored private key. Are you sure?',
          );

          if (granted) {
            await demo.clear();
          }
        }}
      >
        Reset
      </Button>
    </div>
  );
};

export default LinksPage;
