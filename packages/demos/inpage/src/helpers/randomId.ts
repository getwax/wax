// 25 digits of [a-z0-9], which is >128 bits of randomness
export default function randomId() {
  return [1, 2, 3]
    .map(() => Math.random().toString(36).slice(2, 12).padEnd(10, '0'))
    .join('')
    .slice(0, 25);
}
