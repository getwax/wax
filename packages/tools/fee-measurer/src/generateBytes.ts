export default function generateBytes(size: number): string {
  let res = '0x';
  
  for (let i = 0; i < size; i++) {
    res += Math.floor(Math.random() * 255 + 1).toString(16).padStart(2, '0');
  }

  return res;
}
