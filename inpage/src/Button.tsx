import jss from 'jss';
import color from 'color';
import React, { HTMLProps, useCallback, useState } from 'react';
import assert from 'assert';
import sheetsRegistry from './sheetsRegistry';
import { bgColor, fgColor } from './styleConstants';
import classes from './helpers/classes';
import runAsync from '../demo/helpers/runAsync';

const sheet = jss.createStyleSheet({
  Button: {
    padding: '0.5em 1em',
    textAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none',

    background: color(fgColor).darken(0.1).toString(),
    border: `1px solid ${color(fgColor).darken(0.1).toString()}`,
    color: bgColor,
  },
  ButtonStates: {
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
  },
  ButtonSecondaryStates: {
    '&:hover': {
      background: color(fgColor).alpha(0.05).toString(),
    },

    '&:active': {
      background: color(fgColor).alpha(0.15).toString(),
    },
  },
  ButtonDisabled: {
    filter: 'brightness(50%)',
    cursor: 'initial',
  },
});

sheetsRegistry.add(sheet);

const Button = ({
  children,
  secondary,
  disabled,
  onPress = () => undefined,
  ...props
}: Omit<HTMLProps<HTMLDivElement>, 'className' | 'onClick'> & {
  secondary?: boolean;
  onPress?: (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) => unknown;
}) => {
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<unknown>();

  const handlePress = useCallback(
    (
      e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
    ) => {
      if (disabled || loading) {
        return;
      }

      runAsync(async () => {
        try {
          setLoading(true);
          await onPress(e);
          setError(undefined);
        } catch (newError) {
          // eslint-disable-next-line no-console
          console.error(newError);
          setError(newError);
        }

        setLoading(false);
      });
    },
    [disabled, loading, onPress],
  );

  const effectivelyDisabled = loading || disabled;

  return (
    <div
      role="button"
      tabIndex={0}
      {...props}
      onClick={handlePress}
      onKeyDown={handlePress}
      {...classes(
        sheet.classes.Button,
        secondary && sheet.classes.ButtonSecondary,
        !effectivelyDisabled &&
          (secondary
            ? sheet.classes.ButtonSecondaryStates
            : sheet.classes.ButtonStates),
        effectivelyDisabled && sheet.classes.ButtonDisabled,
      )}
    >
      {children}
    </div>
  );
};

export default Button;
