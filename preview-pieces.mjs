const W = '\x1b[97m';
const B = '\x1b[30m';
const RST = '\x1b[0m';
const LIGHT = '\x1b[48;2;238;238;210m';
const DARK  = '\x1b[48;2;118;150;86m';

const WHITE_PIECES = {
  P: [' ▄█▄ ', '  █  ', ' ███ ', '█████'],
  N: ['▄███ ', '███▀ ', ' ███ ', '█████'],
  B: [' ▄█▄ ', ' ▀█▀ ', ' ███ ', '█████'],
  R: ['█▄█▄█', ' ███ ', ' ███ ', '█████'],
  Q: ['▄█▄█▄', '▀███▀', ' ███ ', '█████'],
  K: [' ▄█▄ ', '█████', ' ███ ', '█████'],
};
const BLACK_PIECES = {
  p: [' ▄█▄ ', '  █  ', ' ███ ', '█████'],
  n: ['▄███ ', '███▀ ', ' ███ ', '█████'],
  b: [' ▄█▄ ', ' ▀█▀ ', ' ███ ', '█████'],
  r: ['█▄█▄█', ' ███ ', ' ███ ', '█████'],
  q: ['▄█▄█▄', '▀███▀', ' ███ ', '█████'],
  k: [' ▄█▄ ', '█████', ' ███ ', '█████'],
};

const wkeys = ['P','N','B','R','Q','K'];
const bkeys = ['p','n','b','r','q','k'];
const names = ['Pawn  ','Knight','Bishop','Rook  ','Queen ','King  '];

console.log('\nWhite pieces (on dark square):');
for (let row = 0; row < 4; row++) {
  let line = '';
  for (const k of wkeys) line += DARK + W + WHITE_PIECES[k][row] + RST + '  ';
  console.log(line);
}
console.log('  ' + names.map(n => n.slice(0,6).padEnd(7)).join(''));

console.log('\nBlack pieces (on light square):');
for (let row = 0; row < 4; row++) {
  let line = '';
  for (const k of bkeys) line += LIGHT + B + BLACK_PIECES[k][row] + RST + '  ';
  console.log(line);
}
console.log('  ' + names.map(n => n.slice(0,6).padEnd(7)).join(''));
console.log();
