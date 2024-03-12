export const CONFIG = {
  test: {
    minStakeAmount: 10000,
    rates: [25, 10, 20],
    periods: [0, 365 * 24 * 3600],
    balanceBounds: [15000, 50000, 100000],
    coefficientsMultiplier: [90, 110, 120, 150],
    coefficientsLimiter: [0, 4, 8, 12]
  },
  prod: {
    owner: '0x87fc1a011937872225006b35878171265819D400',
    tokenContract: '0xda517744d51e5028db6624b5048acc9c6be67a7e',
    nftContract: '0xda517744d51e5028db6624b5048acc9c6be67a7e',
    minStakeAmount: 10000,
    rates: [25, 10, 20],
    periods: [60, 365 * 24 * 3600],
    balanceBounds: [15000, 50000, 100000],
    coefficientsMultiplier: [90, 110, 120, 150],
    coefficientsLimiter: [0, 4, 8, 12]
  }
};

export default Object.values(CONFIG.prod);