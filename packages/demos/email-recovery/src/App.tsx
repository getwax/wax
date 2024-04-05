import './App.css'
import { ConfigureSafeModule } from './components/ConfigureSafeModule';
import { PerformRecovery } from './components/PerformRecovery';
import { Web3Provider } from "./providers/Web3Provider";
import { ConnectKitButton } from "connectkit";

function App() {
  return (
    <>
      <h1>Safe Email Recovery Demo</h1>
      <Web3Provider>
        <ConnectKitButton />
        <ConfigureSafeModule />
        <PerformRecovery />
      </Web3Provider>
    </>
  )
}

export default App
