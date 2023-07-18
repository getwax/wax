import jss from 'jss';
import sheetsRegistry from './sheetsRegistry';

const sheet = jss.createStyleSheet({
  SamplePopup: {
    padding: '2em',
  },
});

sheetsRegistry.add(sheet);

const SamplePopup = ({ respond }: { respond: (response: string) => void }) => (
  <div className={sheet.classes.SamplePopup}>
    <h1>Sample Popup</h1>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin non felis
      ipsum. Sed porttitor id leo fermentum ultrices. Pellentesque vitae lectus
      in velit aliquet hendrerit et et ex. Nunc vitae ornare lectus. Aenean nec
      metus volutpat, ornare odio commodo, pharetra sapien. Nam sit amet lectus
      at eros lacinia consequat.
    </p>
    <div>
      <button type="button" onClick={() => respond('deny')}>
        Deny
      </button>
      <button type="button" onClick={() => respond('approve')}>
        Approve
      </button>
    </div>
  </div>
);

export default SamplePopup;
