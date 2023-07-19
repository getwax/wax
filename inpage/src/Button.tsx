import jss from 'jss';
import color from 'color';
import { HTMLProps } from 'react';
import sheetsRegistry from './sheetsRegistry';
import { bgColor, fgColor } from './styleConstants';
import classes from './helpers/classes';

const sheet = jss.createStyleSheet({
  Button: {
    padding: '0.5em 1em',
    textAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none',

    background: color(fgColor).darken(0.1).toString(),
    border: `1px solid ${color(fgColor).darken(0.1).toString()}`,
    color: bgColor,

    '&:hover': {
      background: fgColor,
      border: `1px solid ${fgColor}`,
    },

    '&:active': {
      background: 'white',
      border: '1px solid white',
    },
  },
  ButtonSecondary: {
    background: 'transparent',
    border: `1px solid ${fgColor}`,
    color: fgColor,

    '&:hover': {
      background: color(fgColor).alpha(0.05).toString(),
    },

    '&:active': {
      background: color(fgColor).alpha(0.15).toString(),
    },
  },
});

sheetsRegistry.add(sheet);

const Button = ({
  children,
  secondary,
  ...props
}: Omit<HTMLProps<HTMLDivElement>, 'className'> & { secondary?: boolean }) => (
  <div
    {...props}
    {...classes(
      sheet.classes.Button,
      secondary && sheet.classes.ButtonSecondary,
    )}
  >
    {children}
  </div>
);

export default Button;
