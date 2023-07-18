import jss from 'jss';
import { HTMLProps } from 'react';
import sheetsRegistry from './sheetsRegistry';
import { fgColor } from './styleConstants';

const sheet = jss.createStyleSheet({
  Button: {
    padding: '0.5em 1em',
    border: `1px solid ${fgColor}`,
    textAlign: 'center',
  },
});

sheetsRegistry.add(sheet);

const Button = ({
  children,
  ...props
}: Omit<HTMLProps<HTMLDivElement>, 'className'>) => (
  <div {...props} className={sheet.classes.Button}>
    {children}
  </div>
);

export default Button;
