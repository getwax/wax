import './RegisterAddressPage.scss';
import { useState } from 'react';
import { ethers } from 'ethers';
import Button from '../src/Button';
import Heading from '../src/Heading';
import DemoContext from './DemoContext';
import Loading from './Loading';
import runAsync from './helpers/runAsync';
import { encodeRegIndex } from '../src/helpers/encodeUtils';

const RegisterAddressPage = () => {
  const demo = DemoContext.use();
  const contracts = demo.useContracts();
  const signer = demo.useSigner();

  const [addressInput, setAddressInput] = useState('');

  const [lookupResult, setLookupResult] = useState<{
    address: string;
    id: bigint | 'none';
  }>();

  const registeredId =
    lookupResult?.address === addressInput ? lookupResult.id : 'unknown';

  if (!contracts) {
    return (
      <Loading>
        <Heading>Register Address</Heading>
        <div>Waiting for contracts</div>
        <Button onPress={() => demo.getContracts()}>Deploy</Button>
      </Loading>
    );
  }

  const lookup = async () => {
    if (!ethers.isAddress(addressInput)) {
      throw new Error('Address is not valid');
    }

    const { addressRegistry } = contracts;
    const filter = addressRegistry.filters[
      'AddressRegistered(uint256,address)'
    ](undefined, addressInput);

    const event = (await addressRegistry.queryFilter(filter))[0];
    const id = event ? event.args[0] : 'none';

    setLookupResult({
      address: addressInput,
      id,
    });
  };

  return (
    <div className="register-address-page">
      <Heading>Register Address</Heading>
      <div>
        Address:{' '}
        <input
          type="text"
          onInput={(e) => setAddressInput(e.currentTarget.value)}
        />
      </div>
      {registeredId === 'unknown' && (
        <Button disabled={!signer} onPress={lookup}>
          Lookup
        </Button>
      )}
      {registeredId === 'none' && (
        <>
          <div>Not registered</div>
          <Button
            disabled={!signer}
            onPress={async () => {
              await contracts.addressRegistry
                .connect(signer)
                .register(addressInput);

              await lookup();
              runAsync(() => demo.refreshBalance());
            }}
          >
            Register
          </Button>
        </>
      )}
      {typeof registeredId === 'bigint' && (
        <div>Registered as {encodeRegIndex(registeredId)}</div>
      )}
    </div>
  );
};

export default RegisterAddressPage;
