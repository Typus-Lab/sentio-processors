import { SuiNetwork, SuiWrappedObjectProcessor } from "@sentio/sdk/sui";
import { normalizeSuiAddress, normalizeStructTag } from "@mysten/sui/utils";
import { getPriceBySymbol } from "@sentio/sdk/utils";
import { BcsReader } from "@mysten/bcs";
import { position, trading } from "./types/sui/testnet/typus_perp.js";

const startCheckpoint = BigInt(159664608);

trading.bind({ network: SuiNetwork.TEST_NET, startCheckpoint }).onEventLiquidateEvent((event, ctx) => {
  let collateral_token_name = event.data_decoded.collateral_token.name;
  let collateral_token = parse_token(collateral_token_name);
  let collateral_decimal = token_decimal(collateral_token);
  let base_token_name = event.data_decoded.base_token.name;
  let base_token = parse_token(base_token_name);
  let position_id = event.data_decoded.position_id;
  let collateral_price = Number(event.data_decoded.collateral_price) / 10 ** 9;
  let trading_price = Number(event.data_decoded.trading_price) / 10 ** 9;
  let liquidator_fee = Number(event.data_decoded.realized_liquidator_fee) / 10 ** collateral_decimal;
  let value_for_lp_pool = Number(event.data_decoded.realized_value_for_lp_pool) / 10 ** collateral_decimal;

  ctx.eventLogger.emit("Liquidate", {
    distinctId: event.data_decoded.user,
    position_id,
    collateral_token,
    trading_token: base_token,
    collateral_price,
    trading_price,
    liquidator_fee,
    value_for_lp_pool,
  });
});

position.bind({ network: SuiNetwork.TEST_NET, startCheckpoint }).onEventOrderFilledEvent((event, ctx) => {
  let collateral_token_name = event.data_decoded.collateral_token.name;
  let collateral_token = parse_token(collateral_token_name);
  let collateral_decimal = token_decimal(collateral_token);
  let base_token_name = event.data_decoded.symbol.base_token.name;
  let base_token = parse_token(base_token_name);
  let order_id = event.data_decoded.order_id;
  let position_id;
  let order_type;

  if (event.data_decoded.linked_position_id) {
    position_id = event.data_decoded.linked_position_id;
    order_type = "Close";
  } else {
    position_id = event.data_decoded.new_position_id;
    order_type = "Open";
  }

  var filled_size = Number(event.data_decoded.filled_size) / 10 ** token_decimal(base_token)!;
  var filled_price = Number(event.data_decoded.filled_price) / 10 ** 8;
  var side = event.data_decoded.position_side ? "Long" : "Short";

  var realized_trading_fee =
    Number(event.data_decoded.realized_trading_fee) + Number(event.data_decoded.realized_borrow_fee);
  var realized_fee_in_usd = Number(event.data_decoded.realized_fee_in_usd) / 10 ** 9;
  var realized_amount = event.data_decoded.realized_amount_sign
    ? Number(event.data_decoded.realized_amount)
    : -Number(event.data_decoded.realized_amount);
  var realized_pnl = ((realized_amount - realized_trading_fee) * realized_fee_in_usd) / realized_trading_fee;

  ctx.eventLogger.emit("OrderFilled", {
    distinctId: event.data_decoded.user,
    collateral_token,
    trading_token: base_token,
    order_id,
    position_id,
    order_type,
    filled_size,
    filled_price,
    side,
    realized_trading_fee: realized_trading_fee / 10 ** collateral_decimal,
    realized_fee_in_usd,
    realized_amount: realized_amount / 10 ** collateral_decimal,
    realized_pnl,
  });
});

function parse_token(name: string): string {
  let typeArgs = name.split("::");
  if (typeArgs[2] == "MFUD") {
    return "FUD";
  } else if (typeArgs[2] == "MBLUB") {
    return "BLUB";
  } else if (typeArgs[2] == "MLIQ") {
    return "LIQ";
  }
  switch (normalizeSuiAddress(typeArgs[0])) {
    case "0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881":
      return "BTC";
    case "0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5":
      return "ETH";
    case "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf":
      return "WUSDC";
    case "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c":
      return "USDT";
    case "0xb7844e289a8410e50fb3ca48d69eb9cf29e27d223ef90353fe1bd8e27ff8f3f8":
      return "SOL";
    case "0x5d1f47ea69bb0de31c313d7acf89b890dbb8991ea8e03c6c355171f84bb1ba4a":
      return "TURBOS";
    case "0x3a5143bb1196e3bcdfab6203d1683ae29edd26294fc8bfeafe4aaa9d2704df37":
      return "APT";
    case "0x76cb819b01abed502bee8a702b4c2d547532c12f25001c9dea795a5e631c26f1":
      return "FUD";
    case "0xf325ce1300e8dac124071d3152c5c5ee6174914f8bc2161e88329cf579246efc":
      return "AFSUI";
    case "0x549e8b69270defbfafd4f94e17ec44cdbdd99820b33bda2278dea3b9a32d3f55":
      return "VSUI";
    case "0x8993129d72e733985f7f1a00396cbd055bad6f817fee36576ce483c8bbb8b87b":
      return "HIPPO";
    case "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7":
      return "USDC";
    default:
      return typeArgs[2];
  }
}

function token_decimal(token: string): number {
  switch (token) {
    case "SUI":
    case "VSUI":
    case "HASUI":
    case "BUCK":
    case "AFSUI":
    case "CETUS":
    case "TURBOS":
    case "SCA":
    case "HIPPO":
    case "TYPUS":
      return 9;
    case "BTC":
    case "ETH":
    case "SOL":
    case "APT":
    case "INJ":
    case "SEI":
    case "JUP":
      return 8;
    case "USDC":
    case "WUSDC":
    case "USDT":
    case "MFUD":
    case "MBLUB":
    case "MLIQ":
    case "DEEP":
      return 6;
    case "FUD": // actual 5
    case "LIQ": // actual 6
    case "BLUB": // actual 2
      return 0;
    default:
      return 9;
  }
}
