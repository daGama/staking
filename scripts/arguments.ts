export const CONFIG = {
  test: {
    minStakeAmount: 10000,
    rates: [25, 12, 20, 5],
    periods: [600, 365 * 24 * 3600],
    durations: [16, 32, 52, 104],
    balanceBounds: [15000 * 10 ** 8, 50000 * 10 ** 8, 100000 * 10 ** 8],
    coefficientsMultiplier: [90, 110, 115, 120],
    coefficientsLimiter: [12, 8, 4, 0],
  },
  prod: {
    owner: '0x98F71F3c272092896F4134eA27b39365Ef966965',
    tokenContract: '0x7B433191A2A4E173AaB28Ed6B6993b69E40aB1C7',
    nftContract: '0x709019bdAf0B5384609DC9f27Ab4517E1B7ca6f5',
    minStakeAmount: 100,
    rates: [25, 12, 20, 5],
    periods: [60, 365 * 24 * 3600],
    durations: [16, 32, 52, 104],
    balanceBounds: [15000 * 10 ** 8, 50000 * 10 ** 8, 100000 * 10 ** 8],
    coefficientsMultiplier: [90, 110, 115, 120],
    coefficientsLimiter: [12, 8, 4, 0],
    timeLock: '0x49902D3439A57375Bcb83CA496A19bf9f7B76517',
  }
};

export default Object.values(CONFIG.prod);