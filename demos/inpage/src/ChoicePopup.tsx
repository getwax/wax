import jss from 'jss';
import { useState } from 'react';
import sheetsRegistry from './sheetsRegistry';
import Button from './Button';
import Heading from './Heading';
import PopupPage from './PopupPage';

const sheet = jss.createStyleSheet({
  ChoicePopup: {
    '& select': {
      fontSize: '1em',
      outline: 'none',
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

const ChoicePopup = <Choices extends string[]>({
  heading,
  text,
  choices,
  resolve,
}: {
  heading: string;
  text: string;
  choices: Choices;
  resolve: (choice: Choices[number]) => void;
}) => {
  const [choice, setChoice] = useState<Choices[number] | ''>('');

  return (
    <PopupPage className={sheet.classes.ChoicePopup}>
      <Heading>{heading}</Heading>
      <div>{text}</div>
      <div className={sheet.classes.InputSection}>
        <select onChange={(e) => setChoice(e.target.value)}>
          <option value="">-- Please select --</option>
          {choices.map((c) => (
            <option value={c} key={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className={sheet.classes.ButtonRow}>
        <Button disabled={choice === ''} onPress={() => resolve(choice)}>
          Submit
        </Button>
      </div>
    </PopupPage>
  );
};

export default ChoicePopup;
