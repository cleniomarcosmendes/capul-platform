// Runner mínimo só p/ funções PURAS (canal→URL, throttle). Sem preset RN:
// essas funções não importam nada de expo/react-native, então basta transpilar TS via babel.
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
};
