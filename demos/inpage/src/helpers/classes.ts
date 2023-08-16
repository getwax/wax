export default function classes(...args: (string | false | undefined)[]) {
  return {
    className: args.filter((a) => a).join(' '),
  };
}
