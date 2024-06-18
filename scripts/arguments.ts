export const CONFIG = {
  test: {
    minStakeAmount: 10000,
    rates: [25, 12, 20, 5],
    periods: [0, 365 * 24 * 3600],
    durations: [16, 32, 52, 104],
    balanceBounds: [15000 * 10 ** 8, 50000 * 10 ** 8, 100000 * 10 ** 8],
    coefficientsMultiplier: [90, 110, 115, 120],
    coefficientsLimiter: [12, 8, 4, 0],
  },
  prod: {
    owner: '0x0a698304C4326475E89E8f1Ebd093269621C9AE4',
    tokenContract: '0x331b07dd531CE95c4fF718F7CF1f89A087019438',
    nftContract: '0xc68819371ECb33C0F12Ff151118A77f9cCAb0C63',
    minStakeAmount: 100,
    rates: [25, 12, 20, 5],
    periods: [60, 365 * 24 * 3600],
    durations: [1, 16, 32, 52, 104],
    balanceBounds: [1, 15000 * 10 ** 8, 50000 * 10 ** 8, 100000 * 10 ** 8],
    coefficientsMultiplier: [90, 90, 110, 115, 120],
    coefficientsLimiter: [12, 12, 8, 4, 0],
    timeLock: '0xD45b47b5bB41CFd5d8CcEc4889F60B7bC6B317f7',
  }
};

export default Object.values(CONFIG.prod);