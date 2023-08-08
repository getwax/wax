import './App.css';
import DemoContext from './DemoContext';
import ConnectPage from './ConnectPage';
import WaxHeader from './WaxHeader';
import PageRouter from './PageRouter';

const App = () => {
  const demo = DemoContext.use();
  const address = demo.useAddress();

  if (!address) {
    return <ConnectPage />;
  }

  return (
    <div className="wax-app">
      <WaxHeader />
      <div className="page-wrapper">
        <PageRouter />
      </div>
    </div>
  );
};

export default App;
