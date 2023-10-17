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
  const [newOwnerAccountSeedPhrase, setNewOwnerAccountSeedPhrase] =
    useState('');
  const [recoveryAccountSeedPhrase, setRecoveryAccountSeedPhrase] =
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
          {account && account instanceof SafeECDSAAccountWrapper && (
            <Address
              value={account.toData().ownerAddress ?? ethers.ZeroAddress}
              short={false}
            />
          )}
        </div>

        <div>
          Recovery account:{' '}
          {account && account instanceof SafeECDSAAccountWrapper && (
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
            } else {
              // TODO: (merge-ok) handle this case
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
            New owner account seed phrase:{' '}
            <input
              type="text"
              onInput={(e) =>
                setNewOwnerAccountSeedPhrase(e.currentTarget.value)
              }
            />
          </div>
          <div>
            Recovery account seed phrase:{' '}
            <input
              type="text"
              onInput={(e) =>
                setRecoveryAccountSeedPhrase(e.currentTarget.value)
              }
            />
          </div>
          <Button
            disabled={!account}
            onPress={async () => {
              if (account instanceof SafeECDSAAccountWrapper) {
                // TODO: (merge-ok) Handle recovery without passing seed phrases
                await account.recoveryAccount(
                  newOwnerAccountSeedPhrase,
                  recoveryAccountSeedPhrase,
                );
              } else {
                // TODO: (merge-ok) handle this case
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
