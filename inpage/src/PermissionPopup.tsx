import jss from 'jss';
import sheetsRegistry from './sheetsRegistry';
import Button from './Button';
import Heading from './Heading';

const sheet = jss.createStyleSheet({
  PermissionPopup: {
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

const PermissionPopup = ({
  message,
  respond,
}: {
  message: string;
  respond: (response: boolean) => void;
}) => (
  <div className={sheet.classes.PermissionPopup}>
    <Heading>Permission Request</Heading>
    <div>{message}</div>
    <div className={sheet.classes.ButtonRow}>
      <Button secondary onPress={() => respond(false)}>
        Deny
      </Button>
      <Button onPress={() => respond(true)}>Approve</Button>
    </div>
  </div>
);

export default PermissionPopup;
