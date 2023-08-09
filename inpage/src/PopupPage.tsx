import jss from 'jss';
import { HTMLProps } from 'react';
import sheetsRegistry from './sheetsRegistry';
import classes from './helpers/classes';

const sheet = jss.createStyleSheet({
  PopupPage: {
    padding: '0 2em',
    display: 'flex',
    flexDirection: 'column',
    gap: '2em',
    width: '100%',
  },
  Spacer: {
    fontSize: '0.01px',
    color: 'transparent',
    userSelect: 'none',
    flexGrow: 1,
  },
});

sheetsRegistry.add(sheet);

const Spacer = () => <div className={sheet.classes.Spacer}>.</div>;

const PopupPage = ({ children, ...props }: HTMLProps<HTMLDivElement>) => (
  <div {...props} {...classes(props.className, sheet.classes.PopupPage)}>
    <Spacer />
    {children}
    <Spacer />
  </div>
);

export default PopupPage;
