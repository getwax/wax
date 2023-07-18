import jss from 'jss';
import color from 'color';
import { HTMLProps } from 'react';
import sheetsRegistry from './sheetsRegistry';
import { dangerColor, fgColor } from './styleConstants';
import classes from './helpers/classes';

const sheet = jss.createStyleSheet({
  Button: {
    padding: '0.5em 1em',
    textAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none',

    background: 'transparent',
    border: `1px solid ${fgColor}`,

    '&:hover': {
      background: color(fgColor).alpha(0.05).toString(),
    },

    '&:active': {
      background: color(fgColor).alpha(0.15).toString(),
    },
  },
  ButtonDanger: {
    background: 'transparent',
    border: `1px solid ${dangerColor}`,
    color: dangerColor,

    '&:hover': {
      background: color(dangerColor).alpha(0.05).toString(),
    },

    '&:active': {
      background: color(dangerColor).alpha(0.15).toString(),
    },
  },
});

sheetsRegistry.add(sheet);

const Button = ({
  children,
  danger,
  ...props
}: Omit<HTMLProps<HTMLDivElement>, 'className'> & { danger?: boolean }) => (
  <div
    {...props}
    {...classes(sheet.classes.Button, danger && sheet.classes.ButtonDanger)}
  >
    {children}
  </div>
);

export default Button;
