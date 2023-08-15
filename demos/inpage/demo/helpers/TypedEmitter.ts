import EventEmitter from 'events';
import TE, { EventMap } from 'typed-emitter';

const TypedEmitter = EventEmitter as {
  new <T extends EventMap>(): TE<T>;
};

type TypedEmitter = typeof TypedEmitter;

export default TypedEmitter;
