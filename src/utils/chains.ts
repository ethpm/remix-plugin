const chainIds = {
  'd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3': 'mainnet',
  'a3c565fc15c7478862d50ccd6561e3c06b24cc509bf388941c25ea985ce32cb9': 'kovan',
  '41941023680923e0fe4d74a34bdac8141f2540e3ae90623718e47d66d1ca4a2d': 'ropsten',
  '6341fd3daf94b748c72ced5a5b26028f2474f5f00d824504e4fa37a75767e177': 'rinkeby',
  'bf7e331f7f7c1dd2e05159666b3bf8bc7a8a3a9eb1d518969eab529dd9b88c1a': 'goerli',
};

export function getBlockchainFromUri(uri: any) {
  const parsedUrl = new URL(uri);
  const chainId = parsedUrl.pathname.split('/')[2];
  if (chainIds[chainId] === 'undefined') {
    alert(`${uri} is not a recognized chain ID.`);
  }
  return chainIds[chainId];
}
