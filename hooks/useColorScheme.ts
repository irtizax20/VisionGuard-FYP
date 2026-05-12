import { useColorScheme as _useColorScheme, ColorSchemeName } from 'react-native';
import { useState, useEffect } from 'react';

export function useColorScheme(): { colorScheme: ColorSchemeName, toggleColorScheme: () => void } {
  const systemColorScheme = _useColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>(systemColorScheme);

  const toggleColorScheme = () => {
    setColorScheme((prevScheme) => (prevScheme === 'light' ? 'dark' : 'light'));
  };

  useEffect(() => {
    setColorScheme(systemColorScheme);
  }, [systemColorScheme]);

  return { colorScheme, toggleColorScheme };
}
