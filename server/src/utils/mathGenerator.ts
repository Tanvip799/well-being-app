export interface MathQuestion {
  text: string;
  answer: number;
}

export function generateQuestion(): MathQuestion {
  const operations = ['+', '-', '*'] as const;
  const op = operations[Math.floor(Math.random() * operations.length)]!;

  let num1 = 0;
  let num2 = 0;
  let text = '';
  let answer = 0;

  switch (op) {
    case '+':
      // Addition: numbers from 5 to 99
      num1 = Math.floor(Math.random() * 95) + 5;
      num2 = Math.floor(Math.random() * 95) + 5;
      text = `${num1} + ${num2}`;
      answer = num1 + num2;
      break;

    case '-':
      // Subtraction: positive result, numbers from 5 to 99
      num1 = Math.floor(Math.random() * 95) + 5;
      num2 = Math.floor(Math.random() * (num1 - 2)) + 2; // ensure num2 < num1 and >= 2
      text = `${num1} - ${num2}`;
      answer = num1 - num2;
      break;

    case '*':
      // Multiplication: numbers from 2 to 12
      num1 = Math.floor(Math.random() * 11) + 2;
      num2 = Math.floor(Math.random() * 11) + 2;
      text = `${num1} × ${num2}`;
      answer = num1 * num2;
      break;
  }

  return { text, answer };
}
