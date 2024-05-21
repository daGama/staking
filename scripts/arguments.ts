export const CONFIG = {
  test: {
    minStakeAmount: 10000,
    rates: [25, 10, 20],
    periods: [0, 365 * 24 * 3600],
    durations: [16,26,32,72],
    balanceBounds: [15000, 50000, 100000],
    coefficientsMultiplier: [90, 110, 120, 150],
    coefficientsLimiter: [0, 4, 8, 12]
  },
  prod: {
    owner: '0x87fc1a011937872225006b35878171265819D400',
    tokenContract: '0xF4460c8738B770FC9e56bfc4E3E74E559B7610Ff',
    nftContract: '0x9ee06799Ba93258e75affC41C5B0feE9aFCfcE00',
    minStakeAmount: 100,
    rates: [25, 10, 20],
    periods: [60, 365 * 24 * 3600],
    durations: [16,32,72],
    balanceBounds: [15000, 50000, 100000],
    coefficientsMultiplier: [90, 110, 120, 150],
    coefficientsLimiter: [0, 4, 8, 12]
  }
};

export default Object.values(CONFIG.prod);