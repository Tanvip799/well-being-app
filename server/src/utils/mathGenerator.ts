export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export interface MathQuestion {
  text: string;
  answer: number;
  difficulty: Difficulty;
}

export function generateQuestion(): MathQuestion {
  const rand = Math.random();
  const difficulty: Difficulty =
    rand < 0.25 ? 'Easy' :
    rand < 0.58 ? 'Medium' :
    rand < 0.85 ? 'Hard' : 'Expert';
  return generateByDifficulty(difficulty);
}

function generateByDifficulty(difficulty: Difficulty): MathQuestion {
  switch (difficulty) {
    case 'Easy': {
      const useAdd = Math.random() < 0.5;
      let n1 = Math.floor(Math.random() * 18) + 2;  // 2–19
      let n2 = Math.floor(Math.random() * 18) + 2;
      if (!useAdd && n2 > n1) [n1, n2] = [n2, n1];
      return { text: `${n1} ${useAdd ? '+' : '−'} ${n2}`, answer: useAdd ? n1 + n2 : n1 - n2, difficulty };
    }
    case 'Medium': {
      const r = Math.random();
      if (r < 0.4) {
        // Multiply 2-9 × 2-9
        const n1 = Math.floor(Math.random() * 8) + 2;
        const n2 = Math.floor(Math.random() * 8) + 2;
        return { text: `${n1} × ${n2}`, answer: n1 * n2, difficulty };
      }
      const useAdd = r < 0.7;
      let n1 = Math.floor(Math.random() * 40) + 11;  // 11–50
      let n2 = Math.floor(Math.random() * 40) + 11;
      if (!useAdd && n2 > n1) [n1, n2] = [n2, n1];
      return { text: `${n1} ${useAdd ? '+' : '−'} ${n2}`, answer: useAdd ? n1 + n2 : n1 - n2, difficulty };
    }
    case 'Hard': {
      const r = Math.random();
      if (r < 0.45) {
        const n1 = Math.floor(Math.random() * 8) + 5;   // 5–12
        const n2 = Math.floor(Math.random() * 8) + 5;
        return { text: `${n1} × ${n2}`, answer: n1 * n2, difficulty };
      }
      const useAdd = r < 0.7;
      let n1 = Math.floor(Math.random() * 70) + 30;  // 30–99
      let n2 = Math.floor(Math.random() * 70) + 30;
      if (!useAdd && n2 > n1) [n1, n2] = [n2, n1];
      return { text: `${n1} ${useAdd ? '+' : '−'} ${n2}`, answer: useAdd ? n1 + n2 : n1 - n2, difficulty };
    }
    case 'Expert': {
      if (Math.random() < 0.5) {
        // Clean division
        const divisor = Math.floor(Math.random() * 10) + 3;   // 3–12
        const quotient = Math.floor(Math.random() * 12) + 3;  // 3–14
        return { text: `${divisor * quotient} ÷ ${divisor}`, answer: quotient, difficulty };
      }
      // Large × small
      const n1 = Math.floor(Math.random() * 88) + 12;  // 12–99
      const n2 = Math.floor(Math.random() * 9) + 2;    // 2–10
      return { text: `${n1} × ${n2}`, answer: n1 * n2, difficulty };
    }
  }
}
