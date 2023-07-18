import jss from 'jss';
import sheetsRegistry from './sheetsRegistry';
import Button from './Button';
import Heading from './Heading';

const sheet = jss.createStyleSheet({
  SamplePopup: {
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

const SamplePopup = ({ respond }: { respond: (response: string) => void }) => (
  <div className={sheet.classes.SamplePopup}>
    <Heading>Sample Popup</Heading>
    <div>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin non felis
      ipsum. Sed porttitor id leo fermentum ultrices. Pellentesque vitae lectus
      in velit aliquet hendrerit et et ex. Nunc vitae ornare lectus. Aenean nec
      metus volutpat, ornare odio commodo, pharetra sapien. Nam sit amet lectus
      at eros lacinia consequat.
    </div>
    <div className={sheet.classes.ButtonRow}>
      <Button danger onClick={() => respond('deny')}>
        Deny
      </Button>
      <Button onClick={() => respond('approve')}>Approve</Button>
    </div>
  </div>
);

export default SamplePopup;
