import { encodePseudoFloat } from '../src/helpers/encodeUtils';
import measureCalldataGas from '../src/measureCalldataGas';

// Accessible as window.debug
const windowDebug: Record<string, unknown> = {};

windowDebug.measureCalldataGas = measureCalldataGas;
windowDebug.encodePseudoFloat = encodePseudoFloat;

const windowRecord = window as unknown as Record<string, unknown>;
windowRecord.debug = windowDebug;

export default windowDebug;
