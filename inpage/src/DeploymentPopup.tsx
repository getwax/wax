import jss from 'jss';
import { useState } from 'react';
import sheetsRegistry from './sheetsRegistry';
import Button from './Button';
import Heading from './Heading';

const sheet = jss.createStyleSheet({
  DeploymentPopup: {
    padding: '2em',
    display: 'flex',
    flexDirection: 'column',
    gap: '2em',
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
});

sheetsRegistry.add(sheet);

const DeploymentPopup = ({
  resolve,
  reject,
}: {
  resolve: (response: string) => void;
  reject: (error: Error) => void;
}) => {
  const [phrase, setPhrase] = useState(`${'test '.repeat(11)}junk`);

  return (
    <div className={sheet.classes.DeploymentPopup}>
      <Heading>Deploy Contracts</Heading>
      <div>
        Some of the WAX-related contracts have not been deployed on this
        network. Please enter a seed phrase with funds to pay for gas to deploy
        them.
      </div>
      <input
        type="text"
        value={phrase}
        onInput={(e) => {
          setPhrase(e.currentTarget.value);
        }}
      />
      <div className={sheet.classes.ButtonRow}>
        <Button secondary onPress={() => reject(new Error('Denied by user'))}>
          Deny
        </Button>
        <Button onPress={() => resolve(phrase)}>Approve</Button>
      </div>
    </div>
  );
};

export default DeploymentPopup;
