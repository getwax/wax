import './ChooseAccountPage.css';

import { useEffect } from 'react';
import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';
import config from './config/config';

const ChooseAccountPage = () => {
  const demo = DemoContext.use();

  useEffect(() => {
    if (config.requirePermission === false) {
      void demo.requestAddressWithoutAutoCreate();
    }
  }, [demo]);

  return (
    <div className="choose-account-page">
      <div>
        <Heading>WAX</Heading>
        <div>Choose an account type</div>
        <div style={{ display: 'inline-block' }}>
          <div className="account-types">
            <Button
              style={{ display: 'inline-block' }}
              type="button"
              onPress={async () => {
                demo.waxInPage.preferredAccountType = 'SafeECDSAAccount';
                await demo.requestAddress();
              }}
            >
              <div>
                <b>Recovery</b>
              </div>
              <div>
                <ul style={{ textAlign: 'left' }}>
                  <li>Key Rotation</li>
                  <li>ECDSA</li>
                  <li>Multi-Action</li>
                  <li>(Built-in Safe)</li>
                </ul>
              </div>
            </Button>
            <Button
              style={{ display: 'inline-block' }}
              type="button"
              onPress={async () => {
                demo.waxInPage.preferredAccountType = 'SafeCompressionAccount';
                await demo.requestAddress();
              }}
            >
              <div>
                <b>Compression</b>
              </div>
              <div>
                <ul style={{ textAlign: 'left' }}>
                  <li>L2 Optimized</li>
                  <li>ECDSA</li>
                  <li>Multi-Action</li>
                  <li>(Built-in Safe)</li>
                </ul>
              </div>
            </Button>
            <Button style={{ display: 'inline-block' }} type="button" disabled>
              <div>
                <b>ZK Password (coming soon)</b>
              </div>
              <div>
                <ul style={{ textAlign: 'left' }}>
                  <li>Password auth</li>
                  <li>(Built-in Safe)</li>
                </ul>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChooseAccountPage;
