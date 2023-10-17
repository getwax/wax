import './GreeterDApp.css';
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
  const signer = demo.useSigner();
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

  return (
    <div className="greeter-dapp">
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

      <Heading>Add recovery account</Heading>
      <div>
        New recovery address:{' '}
        <input
          type="text"
          onInput={(e) => setRecoveryAddress(e.currentTarget.value)}
        />
      </div>
      <Button
        disabled={!signer}
        onPress={async () => {
          // const account = await demo.waxInPage._getAccount(waxPrivate);
          if (account instanceof SafeECDSAAccountWrapper) {
            await account.enableRecoveryModule(recoveryAddress);
          } else {
            // TODO: handle this case
          }

          refresh();
        }}
      >
        Add recovery address
      </Button>

      {/* {if (accountRecoverySet) && ()}  */}
      {/* //     const moduleEnabled = await safeProxy.isModuleEnabled(
      recoveryPluginAddress,
    ); */}
      <Heading>Recover account</Heading>
      <div>
        New owner account seed phrase:{' '}
        <input
          type="text"
          onInput={(e) => setNewOwnerAccountSeedPhrase(e.currentTarget.value)}
        />
      </div>
      <div>
        Recovery account seed phrase:{' '}
        <input
          type="text"
          onInput={(e) => setRecoveryAccountSeedPhrase(e.currentTarget.value)}
        />
      </div>
      <Button
        disabled={!signer}
        onPress={async () => {
          // const account = await demo.waxInPage._getAccount(waxPrivate);
          if (account instanceof SafeECDSAAccountWrapper) {
            await account.recoveryAccount(
              newOwnerAccountSeedPhrase,
              recoveryAccountSeedPhrase,
            );
          } else {
            // TODO: handle this case
          }

          refresh();
        }}
      >
        Recover
      </Button>
    </div>
  );
};

export default Recovery;
