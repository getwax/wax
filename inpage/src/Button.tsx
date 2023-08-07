import jss from 'jss';
import color from 'color';
import React, { HTMLProps, useCallback, useState } from 'react';
import sheetsRegistry from './sheetsRegistry';
import { bgColor, dangerColor, fgColor } from './styleConstants';
import classes from './helpers/classes';
import runAsync from '../demo/helpers/runAsync';

const sheet = jss.createStyleSheet({
  Button: {
    '& > .button-content': {
      padding: '0.5em 1em',
    },

    textAlign: 'center',
    cursor: 'pointer',
    userSelect: 'none',

    background: color(fgColor).darken(0.1).toString(),
    border: `1px solid ${color(fgColor).darken(0.1).toString()}`,
    color: bgColor,

    position: 'relative',

    '&:hover > .hover-error': {
      display: 'inline-block',
    },
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

    '& .loading-marker': {
      background: fgColor,
    },
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
  ButtonError: {
    border: `1px solid ${dangerColor}`,
    color: dangerColor,

    '&:hover': {
      border: `1px solid ${dangerColor}`,
    },

    '&:active': {
      border: `1px solid ${dangerColor}`,
    },
  },
  HoverError: {
    display: 'none',
    width: '100%',
    position: 'absolute',
  },
  HoverErrorContent: {
    position: 'absolute',
    transform: 'translateX(-50%)',
    top: '-2.2em',

    display: 'block',
    background: bgColor,
  },
  LoadingMarker: {
    position: 'absolute',
    bottom: '0px',
    left: '0px',
    width: '3px',
    height: '3px',
    background: bgColor,
    animation: '$loading-marker 3s ease infinite',
  },
  '@keyframes loading-marker': {
    '0%, 100%': {
      left: 'max(0%, min(30%, calc(50% - 50px)))',
    },
    '50%': {
      left: 'min(calc(100% - 3px), max(70%, calc(50% + 50px)))',
    },
  },
});

sheetsRegistry.add(sheet);

const Button = ({
  children,
  secondary,
  errorStyle,
  disabled,
  onPress = () => undefined,
  ...props
}: Omit<HTMLProps<HTMLDivElement>, 'className' | 'onClick'> & {
  secondary?: boolean;
  errorStyle?: boolean;
  onPress?: (
    e?: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
  ) => unknown;
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();

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
        error || errorStyle ? sheet.classes.ButtonError : undefined,
      )}
    >
      {error ? (
        <div {...classes('hover-error', sheet.classes.HoverError)}>
          <div className={sheet.classes.HoverErrorContent}>
            <Button
              onPress={(e) => {
                e?.stopPropagation();

                // eslint-disable-next-line no-alert
                alert(error);
              }}
              secondary
              errorStyle
              style={{
                display: 'inline-block',
                whiteSpace: 'nowrap',
              }}
            >
              {shortErrorString(error)}
            </Button>
          </div>
        </div>
      ) : undefined}
      {loading && (
        <div {...classes('loading-marker', sheet.classes.LoadingMarker)} />
      )}
      <div className="button-content">{children}</div>
    </div>
  );
};

export default Button;

function shortErrorString(error: unknown) {
  const errStr =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : `Error: ${JSON.stringify(error)}`;

  if (errStr.length < 25) {
    return errStr;
  }

  return `${errStr.slice(0, 21)} ...`;
}
