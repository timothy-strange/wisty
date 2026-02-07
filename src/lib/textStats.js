export const getTextStats = (text) => {
  const trimmedText = text.trim();
  const words = trimmedText === "" ? 0 : trimmedText.split(/\s+/).length;
  const characters = text.length;
  return { words, characters };
};
