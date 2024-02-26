import jss from 'jss';
import { HTMLProps } from 'react';
import sheetsRegistry from './sheetsRegistry';

const sheet = jss.createStyleSheet({
  Heading: {
    textAlign: 'center',
    fontSize: '2em',
  },
});

sheetsRegistry.add(sheet);

const Heading = ({
  children,
  ...props
}: Omit<HTMLProps<HTMLDivElement>, 'className'>) => (
  <div {...props} className={sheet.classes.Heading}>
    {children}
  </div>
);

export default Heading;
