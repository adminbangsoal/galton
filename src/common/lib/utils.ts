export function truncateLatexText(text: string) {
  // Truncate the text to a minimum of 30 characters
  let truncated = text.substring(0, 30);

  // Regular expression to find the start of a LaTeX expression within the truncated text
  const latexStartPattern = /\\(\(|\[)/g;
  let latexStartMatch;
  let lastLatexStartIndex = -1;
  let lastLatexEndSymbol = '';

  // Check for all LaTeX starts within the truncated text
  while ((latexStartMatch = latexStartPattern.exec(truncated)) !== null) {
    lastLatexStartIndex = latexStartMatch.index;
    lastLatexEndSymbol = latexStartMatch[1] === '(' ? '\\)' : '\\]';
  }

  // If a LaTeX expression starts within the first 30 characters
  if (lastLatexStartIndex !== -1) {
    // Find the end of the LaTeX expression in the original text
    const endOfLatex =
      text.indexOf(lastLatexEndSymbol, lastLatexStartIndex) + 2;
    // Extend the truncation to include the entire LaTeX expression
    truncated = text.substring(0, Math.min(endOfLatex, text.length));
  }

  return `${truncated}...`;
}

export function generateRandomString(length: number) {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
