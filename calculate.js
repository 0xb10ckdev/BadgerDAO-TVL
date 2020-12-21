const ethers = require('ethers');
const ethcall = require('ethcall');
const fetch = require('node-fetch');
const UNI_ABI = require('./abi/uni.json');
const DSTOKEN_ABI = require('./abi/dsToken.json');
const ERC20_ABI = require('./abi/erc20.json');
const BALANCER_POOL_ABI = require('./abi/balancerPool.json');
const JAR_ABI = require('./abi/jar.json');
const CURVE_SWAP_ABI = require('./abi/curveSwap.json');
const BADGER_UNI_ABI = require('./abi/badgerUni.json');
const BADGER_GEYSER_ABI = require('./abi/badgerGeyser');

global.atob = require('atob');

const ETHEREUM_NODE_URL = 'd3NzOi8vbWFpbm5ldC5pbmZ1cmEuaW8vd3MvdjMvZTYyOWM5YjY4NWUyNGQxNGI4Njc1NmYyYzIyYzZiZWM=';

const pools = [
  {
    name: "Badger/wBTC Uni-LP",
    tokenAddress: "0xcd7989894bc033581532d2cd88da5db0a4b12859",
    settAddress: "0x235c9e24D3FB2FAFd58a2E49D454Fdcd2DBf7FF1",
    geyserAddress: "0xA207D69Ea6Fb967E54baA8639c408c31767Ba62D",
  }, {
    name: "Badger",
    tokenAddress: "0x3472A5A71965499acd81997a54BBA8D852C6E53d",
    settAddress: "0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28",
    geyserAddress: "0xa9429271a28F8543eFFfa136994c0839E7d7bF77",
  }, {
    name: "curve.fi / renBTC",
    tokenAddress: "0x49849c98ae39fff122806c06791fa73784fb3675",
    settAddress: "0x6dEf55d2e18486B9dDfaA075bc4e4EE0B28c1545",
    geyserAddress: "0x2296f174374508278DC12b806A7f27c87D53Ca15",
  }, {
    name: "curve.fi / sBTC",
    tokenAddress: "0x075b1bb99792c9e1041ba13afef80c91a1e70fb3",
    settAddress: "0xd04c48A53c111300aD41190D63681ed3dAd998eC",
    geyserAddress: "0x10fC82867013fCe1bD624FafC719Bb92Df3172FC",
  }, {
    name: "curve.fi / tBTC",
    tokenAddress: "0x64eda51d3ad40d56b9dfc5554e06f94e1dd786fd",
    settAddress: "0xb9D076fDe463dbc9f915E5392F807315Bf940334",
    geyserAddress: "0x085A9340ff7692Ab6703F17aB5FfC917B580a6FD",
    swapAddress: "c25099792e9349c7dd09759744ea681c7de2cb66",
    baseToken: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599" //wBTC
  }, {
    name: "harvest.finance / renBTC",
    tokenAddress: "0x49849c98ae39fff122806c06791fa73784fb3675",
    settAddress: "0xAf5A1DECfa95BAF63E0084a35c62592B774A2A87",
    geyserAddress: "0xeD0B7f5d9F6286d00763b0FFCbA886D8f9d56d5e",
  },
];

const App = {}
var tokens = {};
var prices = {};

main();

async function getUniPool(pool, poolAddress) {
  const reserves = await pool.getReserves();
  const decimals = await pool.decimals();
  const token0 = await pool.token0();
  const token1 = await pool.token1();

  return {
    address: poolAddress,
    token0: token0,
    q0: reserves._reserve0,
    token1: token1,
    q1: reserves._reserve1,
    totalSupply: await pool.totalSupply() / 10 ** decimals,
    decimals: decimals,
    contract: pool,
    tokens: [token0, token1],
  };
}

async function getBalancerPool(pool, poolAddress, tokens) {
  const decimals = await pool.decimals();
  const poolTokens = await Promise.all(tokens.map(async (t) => {
    return {
      address: t,
      weight: await pool.getNormalizedWeight(t) / 1e18,
      balance: await pool.getBalance(t),
    };
  }));

  return {
    address: poolAddress,
    poolTokens: poolTokens, //address, weight and balance
    totalSupply: await pool.totalSupply() / 10 ** decimals,
    decimals: decimals,
    contract: pool,
    tokens: tokens, //just the token addresses to conform with the other pool types
  };
}

async function getJar(app, jar, address) {
  const decimals = await jar.decimals();
  const token = await getToken(app, await jar.token(), address);

  return {
    address: address,
    totalSupply: await jar.totalSupply(),
    decimals: decimals,
    token: token,
    balance: await jar.balance(),
    contract: jar,
    tokens: token.tokens,
  };
}

async function getErc20(token, address) {
  const decimals = await token.decimals();
  const ret = {
    address: address,
    totalSupply: await token.totalSupply(),
    decimals: decimals,
    contract: token,
    tokens: [address],
  };

  return ret;
}

async function getDSToken(token, address) {
  const decimals = await token.decimals();
  const ret = {
    address: address,
    totalSupply: await token.totalSupply(),
    decimals: decimals,
    contract: token,
    tokens: [address],
  };

  return ret;
}

async function getToken(app, tokenAddress) {
  try {
    const pool = new ethers.Contract(tokenAddress, UNI_ABI, app.provider);
    const uniPool = await getUniPool(pool, tokenAddress);
    return uniPool;
  } catch (err) {
  }

  try {
    const bal = new ethers.Contract(tokenAddress, BALANCER_POOL_ABI, app.provider);
    const tokens = await bal.getFinalTokens();
    const balPool = await getBalancerPool(bal, tokenAddress, tokens);
    return balPool;
  } catch (err) {
  }

  try {
    const jar = new ethers.Contract(tokenAddress, JAR_ABI, app.provider);
    return await getJar(app, jar, tokenAddress);
  } catch (err) {
  }

  try {
    const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, app.provider);
    const erc20tok = await getErc20(erc20, tokenAddress);
    return erc20tok;
  } catch (err) {
  }

  const dsToken = new ethers.Contract(tokenAddress, DSTOKEN_ABI, app.provider);
  return await getDSToken(dsToken, tokenAddress);
}

function getParameterCaseInsensitive(object, key) {
  return object[Object.keys(object).find(k => k.toLowerCase() === key.toLowerCase())];
}

function getUniPrices(tokens, prices, pool) {
  var t0 = getParameterCaseInsensitive(tokens, pool.token0);
  var p0 = getParameterCaseInsensitive(prices, pool.token0) && getParameterCaseInsensitive(prices, pool.token0).usd;
  var t1 = getParameterCaseInsensitive(tokens, pool.token1);
  var p1 = getParameterCaseInsensitive(prices, pool.token1) && getParameterCaseInsensitive(prices, pool.token1).usd;

  if (!p0 && !p1) {
    return undefined;
  }

  var q0 = pool.q0 / 10 ** t0.decimals;
  var q1 = pool.q1 / 10 ** t1.decimals;

  if (!p0) {
    p0 = q1 * p1 / q0;
    prices[pool.token0] = { usd: p0 };
  }
  if (!p1) {
    p1 = q0 * p0 / q1;
    prices[pool.token1] = { usd: p1 };
  }

  var tvl = q0 * p0 + q1 * p1;
  var price = tvl / pool.totalSupply;
  prices[pool.address] = { usd: price };

  return {
    t0,
    p0,
    q0,
    t1,
    p1,
    q1,
    price,
  };
}

function getBalancerPrices(tokens, prices, pool) {
  var poolTokens = pool.poolTokens.map(t => getParameterCaseInsensitive(tokens, t.address));
  var poolPrices = pool.poolTokens.map(t => getParameterCaseInsensitive(prices, t.address) && getParameterCaseInsensitive(prices, t.address).usd);
  var quantities = poolTokens.map((t, i) => pool.poolTokens[i].balance / 10 ** t.decimals);
  var missing = poolPrices.filter(x => !x);

  if (missing.length === poolPrices.length) {
    throw 'Every price is missing';
  }

  var notMissing = poolPrices.findIndex(p => p);
  const getMissingPrice = (missingQuantity, missingWeight) =>
    quantities[notMissing] * poolPrices[notMissing] * missingWeight
    / pool.poolTokens[notMissing].weight / missingQuantity;
  missing.map((_, i) => {
    const newPrice = getMissingPrice(quantities[i], pool.poolTokens[i].weight);
    poolPrices[i] = newPrice;
    prices[poolTokens[i].address] = { usd: newPrice };
  });

  var tvl = poolPrices.map((p, i) => p * quantities[i]).reduce((x, y) => x + y, 0);
  var price = tvl / pool.totalSupply;
  prices[pool.address] = { usd: price };

  return {
    tokens: poolTokens,
    prices: poolPrices,
    quantities: quantities,
    price: price,
  };
}

function getWrapPrices(tokens, prices, pool) {
  const wrappedToken = pool.token;

  if (wrappedToken.token0) { //Uniswap
    const uniPrices = getUniPrices(tokens, prices, wrappedToken);
    const price = (pool.balance / 10 ** wrappedToken.decimals) * uniPrices.price / (pool.totalSupply / 10 ** pool.decimals);

    return { price };
  } else {
    const tokenPrice = getParameterCaseInsensitive(prices, wrappedToken.address) && getParameterCaseInsensitive(prices, wrappedToken.address).usd;
    const price = (pool.balance / 10 ** wrappedToken.decimals) * tokenPrice / (pool.totalSupply / 10 ** pool.decimals);

    return { price };
  }
}

function getErc20Prices(prices, pool) {
  var price = getParameterCaseInsensitive(prices, pool.address) && getParameterCaseInsensitive(prices, pool.address).usd;
  return { price };
}

function getPoolPrices(tokens, prices, pool) {
  if (pool.poolTokens) return getBalancerPrices(tokens, prices, pool);
  if (pool.token0) return getUniPrices(tokens, prices, pool);
  if (pool.token) return getWrapPrices(tokens, prices, pool);
  return getErc20Prices(prices, pool);
}

const lookUpTokenPrices = async function (id_array) {
  let ids = id_array.join('%2C')
  const response = await fetch('https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=' + ids + '&vs_currencies=usd');
  const json = await response.json();

  return json;
}

async function getPool(app, tokens, prices, pool) {
  const tokenAddress = pool.tokenAddress;
  const settAddress = pool.settAddress;
  const geyserAddress = pool.geyserAddress;

  const lpToken = await getToken(app, tokenAddress);
  var newPriceAddresses = lpToken.tokens.filter(x => !getParameterCaseInsensitive(prices, x));

  var newPrices = await lookUpTokenPrices(newPriceAddresses);

  for (const key in newPrices) {
    if (newPrices[key]) {
      prices[key] = newPrices[key];
    }
  }

  var newTokenAddresses = lpToken.tokens.filter(x => !getParameterCaseInsensitive(tokens, x));

  for (const address of newTokenAddresses) {
    tokens[address] = await getToken(app, address);
  }

  const poolPrices = getPoolPrices(tokens, prices, lpToken);

  if (!poolPrices.price && pool.swapAddress) {
    const swapContract = new ethers.Contract(pool.swapAddress, CURVE_SWAP_ABI, App.provider);
    const virtualPrice = await swapContract.get_virtual_price() / 1e18;
    const underlyingPrice = getParameterCaseInsensitive(prices, pool.baseToken) && getParameterCaseInsensitive(prices, pool.baseToken).usd;
    poolPrices.price = underlyingPrice * virtualPrice;
  }

  const SETT_CONTRACT = new ethers.Contract(settAddress, BADGER_UNI_ABI, App.provider);
  const BADGER_GEYSER = new ethers.Contract(geyserAddress, BADGER_GEYSER_ABI, App.provider);

  const totalStaked = await BADGER_GEYSER.totalStaked();
  const totalUniInBUni = await SETT_CONTRACT.balance();
  const ratio = totalUniInBUni / totalStaked;
  const stakeTokenPrice = poolPrices.price * ratio;
  prices[settAddress] = stakeTokenPrice;
  const staked_tvl = totalStaked / 1e18 * ratio * poolPrices.price;

  return staked_tvl;
}

function formatMoney(amount, decimalCount = 2, decimal = ".", thousands = ",") {
  try {
    decimalCount = Math.abs(decimalCount);
    decimalCount = isNaN(decimalCount) ? 2 : decimalCount;

    const negativeSign = amount < 0 ? "-" : "";

    let i = parseInt(amount = Math.abs(Number(amount) || 0).toFixed(decimalCount)).toString();
    let j = (i.length > 3) ? i.length % 3 : 0;

    return negativeSign + (j ? i.substr(0, j) + thousands : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousands) + (decimalCount ? decimal + Math.abs(amount - i).toFixed(decimalCount).slice(2) : "");
  } catch (e) {
    console.log(e)
  }
}

function twirlTimer() {
  var P = ["\\", "|", "/", "-"];
  var x = 0;
  return setInterval(function () {
    process.stdout.write("\r" + P[x++]);
    x &= 3;
  }, 250);
}

async function main() {
  App.provider = new ethers.providers.WebSocketProvider(atob(ETHEREUM_NODE_URL), "mainnet");
  App.ethcallProvider = new ethcall.Provider();
  await App.ethcallProvider.init(App.provider);

  const interval_id = twirlTimer();

  let tvl = 0;
  for (const pool of pools) {
    await getPool(App, tokens, prices, pool).then(val => { tvl += val; });
  }

  process.stdout.write("\r" + '');
  clearInterval(interval_id);

  console.log(`$${formatMoney(tvl, 0)}`);
}