import { encodePseudoFloat } from '../src/helpers/encodeUtils';
import measureCalldataGas from '../src/measureCalldataGas';

const debug: Record<string, unknown> = {};

debug.measureCalldataGas = measureCalldataGas;
debug.encodePseudoFloat = encodePseudoFloat;

const windowRecord = window as unknown as Record<string, unknown>;
windowRecord.debug = debug;
