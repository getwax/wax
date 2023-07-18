import jss, { SheetsRegistry } from 'jss';
import jssPresetDefault from 'jss-preset-default';

jss.setup(jssPresetDefault());

export default new SheetsRegistry();
