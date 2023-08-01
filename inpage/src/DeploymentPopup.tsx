import jss from 'jss';
import { useState } from 'react';
import { ethers } from 'ethers';
import sheetsRegistry from './sheetsRegistry';
import Button from './Button';
import Heading from './Heading';

const sheet = jss.createStyleSheet({
  DeploymentPopup: {
    padding: '2em',
    display: 'flex',
    flexDirection: 'column',
    gap: '2em',

    '& textarea': {
      fontSize: '1em',
    },
  },
  ButtonRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: '1em',

    '& > *': {
      flexGrow: '1',
      flexBasis: '0',
    },
  },
  InputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25em',
  },
});

sheetsRegistry.add(sheet);

const DeploymentPopup = ({
  resolve,
  reject,
}: {
  resolve: (response: string) => void;
  reject: (error: Error) => void;
}) => {
  const [keyData, setKeyData] = useState(`${'test '.repeat(11)}junk`);

  let message = 'Invalid';

  if (ethers.Mnemonic.isValidMnemonic(keyData)) {
    message = 'Valid seed phrase';
  } else if (/^0x[0-9a-f]{64}$/i.test(keyData)) {
    message = 'Valid private key';
  }

  return (
    <div className={sheet.classes.DeploymentPopup}>
      <Heading>Deploy Contracts</Heading>
      <div>
        Some of the WAX-related contracts have not been deployed on this
        network. Please enter a private key or seed phrase with funds to pay for
        gas to deploy them.
      </div>
      <div className={sheet.classes.InputSection}>
        <textarea
          value={keyData}
          onInput={(e) => {
            setKeyData(e.currentTarget.value);
          }}
        />
        <div>{message}</div>
      </div>
      <div className={sheet.classes.ButtonRow}>
        <Button secondary onPress={() => reject(new Error('Denied by user'))}>
          Deny
        </Button>
        <Button
          disabled={message === 'Invalid'}
          onPress={() => resolve(keyData)}
        >
          Approve
        </Button>
      </div>
    </div>
  );
};

export default DeploymentPopup;
