import jss from 'jss';
import { ReactNode } from 'react';
import sheetsRegistry from './sheetsRegistry';
import Button from './Button';
import Heading from './Heading';
import PopupPage from './PopupPage';

const sheet = jss.createStyleSheet({
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

const PermissionPopup = ({
  message,
  respond,
}: {
  message: ReactNode;
  respond: (response: boolean) => void;
}) => (
  <PopupPage>
    <Heading>Permission Request</Heading>
    <div>{message}</div>
    <div className={sheet.classes.ButtonRow}>
      <Button secondary onPress={() => respond(false)}>
        Deny
      </Button>
      <Button onPress={() => respond(true)}>Approve</Button>
    </div>
  </PopupPage>
);

export default PermissionPopup;
