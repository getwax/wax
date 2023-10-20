import './Recovery.css';
import { useState } from 'react';
import { ethers } from 'ethers';
import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';
import Loading from './Loading';
import useRefresh from './useRefresh';
import SafeECDSAAccountWrapper from '../src/accounts/SafeECDSAAccountWrapper';
import Address from './Address';

const Recovery = () => {
  const demo = DemoContext.use();
  const contracts = demo.useContracts();
  const refresh = useRefresh();
  const account = demo.useAccount();

  const [recoveryAddress, setRecoveryAddress] = useState('');
  const [newOwnerPrivateKey, setNewOwnerPrivateKey] = useState('');
  const [recoveryAccountPrivateKey, setRecoveryAccountPrivateKey] =
    useState('');

  if (!contracts) {
    return (
      <Loading>
        <Heading>Recovery</Heading>
        <div>Waiting for contracts</div>
        <Button onPress={() => demo.getContracts()}>Deploy</Button>
      </Loading>
    );
  }

  const recoverySet =
    account instanceof SafeECDSAAccountWrapper &&
    account.toData().recoveryAddress;

  return (
    <div className="recovery">
      <section className="recovery-section">
        <div>
          Current Owner:{' '}
          {account instanceof SafeECDSAAccountWrapper && (
            <Address
              value={account.toData().ownerAddress ?? ethers.ZeroAddress}
              short={false}
            />
          )}
        </div>

        <div>
          Recovery account:{' '}
          {account instanceof SafeECDSAAccountWrapper && (
            <Address
              value={account.toData().recoveryAddress ?? ethers.ZeroAddress}
              short={false}
            />
          )}
        </div>
      </section>

      <section className="recovery-section">
        <Heading>Add recovery account</Heading>
        <div>
          New recovery address:{' '}
          <input
            type="text"
            onInput={(e) => setRecoveryAddress(e.currentTarget.value)}
          />
        </div>
        <Button
          disabled={!account}
          onPress={async () => {
            if (account instanceof SafeECDSAAccountWrapper) {
              await account.enableRecoveryModule(recoveryAddress);
            }

            refresh();
          }}
        >
          Add recovery address
        </Button>
      </section>

      {recoverySet && (
        <section className="recovery-section">
          <Heading>Recover account</Heading>
          <div>
            New owner account private key:{' '}
            <input
              type="text"
              onInput={(e) => setNewOwnerPrivateKey(e.currentTarget.value)}
            />
          </div>
          <div>
            Recovery account private key:{' '}
            <input
              type="text"
              onInput={(e) =>
                setRecoveryAccountPrivateKey(e.currentTarget.value)
              }
            />
          </div>
          <Button
            disabled={!account}
            onPress={async () => {
              if (account instanceof SafeECDSAAccountWrapper) {
                // TODO: (merge-ok) Handle recovery without passing seed phrases
                await account.recoverAccount(
                  newOwnerPrivateKey,
                  recoveryAccountPrivateKey,
                );
              }

              refresh();
            }}
          >
            Recover
          </Button>
        </section>
      )}
    </div>
  );
};

export default Recovery;
