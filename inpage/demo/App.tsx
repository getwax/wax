import './App.css';
import DemoContext from './DemoContext';
import ConnectPage from './ConnectPage';
import WaxHeader from './WaxHeader';

const App = () => {
  const demo = DemoContext.use();
  const address = demo.useAddress();

  if (!address) {
    return <ConnectPage />;
  }

  return (
    <div className="wax-app">
      <WaxHeader />
    </div>
  );
};

export default App;
