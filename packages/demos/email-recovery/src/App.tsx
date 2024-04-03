import { EthereumProvider } from '@walletconnect/ethereum-provider'
import { useState, useCallback, useEffect } from 'react'
import './App.css'
import { Relayer } from './relayer'

const relayer = new Relayer(import.meta.env.VITE_RELAYER_URL);

function App() {
  const [provider, setProvider] = useState<EthereumProvider>()
  const [connecting, setConnecting] = useState(false)

  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [recoveryConfigured, setRecoveryConfigured] = useState(false);
  const [recoveryInProgress, setRecoveryInProgress] = useState(false);
  const [recoveryApproved, setRecoveryApproved] = useState(false);
  const [delayRemaining, setDelayRemaining] = useState(0);

  const connect = useCallback(async () => {
    if (provider) {
      return
    }

    try {
      setConnecting(true);

      const newProvider = await EthereumProvider.init({
        projectId: import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID,
        metadata: {
          name: 'Safe Email Recovery Demo',
          description: 'Safe Email Recovery Demo',
          url: 'http://localhost', // TODO move to env
          icons: ['https://i.imgur.com/46VRTCF.png']
        },
        showQrModal: true,
        optionalChains: [11155111], // Sepolia TODO move to env
      });
      // TODO Reset connecting state when modal is closed by user
      await newProvider.connect()
  
      setProvider(newProvider)
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(false);
    }
  }, [provider])

  const enableEmailRecoveryModule = useCallback(async () => {
    // TODO submit txn to enable module

    setModuleEnabled(true);
  }, [])

  const configureRecoveryAndRequestGuardian = useCallback(async () => {
    // TODO submit txn/userop to configure recovery
    // TODO Consider, could we enable the module & configure recovery in one step/txn/userop?

    await relayer.acceptanceRequest();

    setRecoveryConfigured(true);
  }, [])

  const requestRecovery = useCallback(async () => {
    await relayer.recoveryRequest();

    setRecoveryInProgress(true);
  }, [])

  const testRecoveryApprove = useCallback(() => {
    // TODO Instead, poll relayer.requestStatus until approval is complete

    setRecoveryApproved(true);
    setDelayRemaining(42);
  }, []);

  const testTimeTravel = useCallback(() => {
    setDelayRemaining(0);
  }, []);

  const completeRecovery = useCallback(async () => {
    // TODO Instead, poll relayer.requestStatus until complete recovery is complete

    setRecoveryConfigured(false);
    setRecoveryInProgress(false);
    setRecoveryApproved(false);
  }, []);

  useEffect(() => {
    if (!provider) {
      return;
    }

    // TODO check for module enablement on connected safe
  }, [provider]);

  return (
    <>
      <h1>Safe Email Recovery Demo</h1>
      {/* 1. Connect to Safe App */}
      {!provider && !connecting && (
        <div className="card">
          <button onClick={connect}>
            Connect to Safe App (Sepolia)
          </button>
        </div>
      )}
      {/* 2. Wait for connection */}
      {!provider && connecting && (
        <div>Connecting...</div>
      )}
      {provider && (
        <div>
          <div>Account: {provider.accounts[0]}</div>

          {/* 3. Enable Module */}
          {!moduleEnabled && (
            <div className="card">
              <button onClick={enableEmailRecoveryModule}>
                Enable Email Recovery Module
              </button>
            </div>
          )}
          {/* 4. Configure Recovery & Request Guardian */}
          {moduleEnabled && !recoveryConfigured && (
            <div>
              <label>
                Guardian's Email
                <input type='email' />
              </label>
              <label>
                Recovery Delay
                <input type='number' />
              </label>
              <div className="card">
                <button onClick={configureRecoveryAndRequestGuardian}>
                  Configure Recovery & Request Guardian
                </button>
              </div>
            </div>
          )}
          {/* 5. Start Recovery */}
          {recoveryConfigured && !recoveryInProgress && (
            <div className="card">
              <button onClick={requestRecovery}>
                Request Recovery
              </button>
            </div>
          )}
          {/* 6. Wait for guardian approval */}
          {recoveryInProgress && !recoveryApproved && (
            <div>
              <div>Awaiting Guardian Approval</div>

              <div className="card">
                <button onClick={testRecoveryApprove}>
                  TEST Approve
                </button>
              </div>
            </div>
          )}
          {/* 7. Wait for delay (timelock) */}
          {recoveryInProgress && recoveryApproved && delayRemaining && (
            <div>
              <div>Waiting until delay is finished... ({delayRemaining} time units)</div>
              <div className="card">
                  <button onClick={testTimeTravel}>
                    TEST Time Travel
                  </button>
              </div>
            </div>
          )}
          {/* 8. Complete Recovery */}
          {recoveryInProgress && recoveryApproved && !delayRemaining && (
            <div className="card">
              <button onClick={completeRecovery}>
                Complete Recovery
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default App
