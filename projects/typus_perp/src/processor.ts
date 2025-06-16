import { SuiNetwork, SuiObjectContext, SuiObjectProcessor, SuiWrappedObjectProcessor } from "@sentio/sdk/sui";
import { normalizeSuiAddress, normalizeStructTag } from "@mysten/sui/utils";
import { getPriceBySymbol } from "@sentio/sdk/utils";
import { BcsReader } from "@mysten/bcs";
import { position, trading, lp_pool } from "./types/sui/typus_perp_mainnet.js";
import { stake_pool } from "./types/sui/stake.js";
import { leaderboard } from "./types/sui/0x4b0f4ee1a40ce37ec81c987cc4e76a665419e74b863319492fc7d26f708b835a.js";

const startCheckpoint = BigInt(129298199);

const network = SuiNetwork.MAIN_NET;

const LIQUIDITY_POOL_0 = "0x98110aae0ffaf294259066380a2d35aba74e42860f1e87ee9c201f471eb3ba03";

const USD_DECIMAL = 9;
const PRICE_DECIMAL = 8;
const TLP_DECIMAL = 9;
const PROTOCOL_FEE_SHARE = 0.3;
const TLP_FEE_SHARE = 0.7;

leaderboard.bind({ network: SuiNetwork.MAIN_NET, startCheckpoint }).onEventScoreEvent(async (event, ctx) => {
  ctx.eventLogger.emit("Score", {
    distinctId: event.data_decoded.user,
    score: event.data_decoded.log[0],
  });
});

stake_pool
  .bind({ network, startCheckpoint })
  .onEventHarvestPerUserShareEvent((event, ctx) => {
    let token_name = event.data_decoded.incentive_token_type.name;
    let token = parse_token(token_name);
    let decimal = token_decimal(token);
    let harvest_amount = Number(event.data_decoded.harvest_amount) / 10 ** decimal;

    ctx.eventLogger.emit("HarvestIncentive", {
      distinctId: event.data_decoded.sender,
      token,
      harvest_amount,
    });
  })
  .onEventStakeEvent((event, ctx) => {
    let index = event.data_decoded.index;
    let lp_token_type = event.data_decoded.lp_token_type.name;
    let stake_amount = Number(event.data_decoded.stake_amount) / 10 ** 9;
    ctx.eventLogger.emit("Stake", {
      distinctId: event.data_decoded.sender,
      stake_amount,
      index,
      lp_token_type,
    });
  })
  .onEventUnstakeEvent((event, ctx) => {
    let index = event.data_decoded.index;
    let lp_token_type = event.data_decoded.lp_token_type.name;
    let unstake_amount = Number(event.data_decoded.unstake_amount) / 10 ** 9;
    ctx.eventLogger.emit("Unstake", {
      distinctId: event.data_decoded.sender,
      unstake_amount,
      index,
      lp_token_type,
    });
  });

lp_pool
  .bind({ network, startCheckpoint })
  .onEventMintLpEvent((event, ctx) => {
    let liquidity_token_name = event.data_decoded.liquidity_token_type.name;
    let liquidity_token = parse_token(liquidity_token_name);
    let liquidity_token_decimal = token_decimal(liquidity_token);

    let deposit_amount = Number(event.data_decoded.deposit_amount) / 10 ** liquidity_token_decimal;
    let deposit_amount_usd = Number(event.data_decoded.deposit_amount_usd) / 10 ** USD_DECIMAL;
    let mint_fee_usd = Number(event.data_decoded.mint_fee_usd) / 10 ** USD_DECIMAL;
    let minted_lp_amount = Number(event.data_decoded.minted_lp_amount) / 10 ** TLP_DECIMAL;

    ctx.meter
      .Counter("protocol_fee")
      .add((mint_fee_usd * deposit_amount) / deposit_amount_usd, { coin_symbol: liquidity_token });
    ctx.meter.Counter("protocol_fee_usd").add(mint_fee_usd);

    ctx.eventLogger.emit("MintLp", {
      distinctId: event.data_decoded.sender,
      liquidity_token,
      deposit_amount,
      deposit_amount_usd,
      mint_fee_usd,
      minted_lp_amount,
    });
  })
  .onEventRedeemEvent((event, ctx) => {
    let share = Number(event.data_decoded.share) / 10 ** 9;
    ctx.eventLogger.emit("RedeemLp", {
      distinctId: event.data_decoded.sender,
      share,
    });
  })
  .onEventBurnLpEvent((event, ctx) => {
    let liquidity_token_name = event.data_decoded.liquidity_token_type.name;
    let liquidity_token = parse_token(liquidity_token_name);
    let liquidity_token_decimal = token_decimal(liquidity_token);

    let withdraw_token_amount =
      Number(event.data_decoded.withdraw_token_amount) / 10 ** liquidity_token_decimal;
    let burn_amount_usd = Number(event.data_decoded.burn_amount_usd) / 10 ** USD_DECIMAL;
    let burn_fee_usd = Number(event.data_decoded.burn_fee_usd) / 10 ** USD_DECIMAL;
    let burn_lp_amount = Number(event.data_decoded.burn_lp_amount) / 10 ** TLP_DECIMAL;

    // (burn_amount_usd - burn_fee_usd) / withdraw_token_amount = burn_fee_usd / burn_fee_amount
    // burn_fee_amount = burn_fee_usd * withdraw_token_amount / (burn_amount_usd - burn_fee_usd)
    ctx.meter
      .Counter("protocol_fee")
      .add((burn_fee_usd * withdraw_token_amount) / (burn_amount_usd - burn_fee_usd), {
        coin_symbol: liquidity_token,
      });
    ctx.meter.Counter("protocol_fee_usd").add(burn_fee_usd);

    ctx.eventLogger.emit("BurnLp", {
      distinctId: event.data_decoded.sender,
      liquidity_token,
      burn_lp_amount,
      burn_amount_usd,
      burn_fee_usd,
      withdraw_token_amount,
    });
  })
  .onEventSwapEvent((event, ctx) => {
    let from_token_name = event.data_decoded.from_token_type.name;
    let from_token = parse_token(from_token_name);
    let from_token_decimal = token_decimal(from_token);

    let to_token_name = event.data_decoded.to_token_type.name;
    let to_token = parse_token(to_token_name);
    let to_token_decimal = token_decimal(to_token);

    let from_amount = Number(event.data_decoded.from_amount) / 10 ** from_token_decimal;
    let to_amount = Number(event.data_decoded.actual_to_amount) / 10 ** to_token_decimal;
    let fee_amount = Number(event.data_decoded.fee_amount) / 10 ** from_token_decimal;
    let fee_amount_usd = Number(event.data_decoded.fee_amount_usd) / 10 ** USD_DECIMAL;

    ctx.meter.Counter("protocol_fee").add(fee_amount * PROTOCOL_FEE_SHARE, { coin_symbol: from_token });
    ctx.meter.Counter("protocol_fee_usd").add(fee_amount_usd * PROTOCOL_FEE_SHARE);
    ctx.meter.Counter("tlp_fee_usd").add(fee_amount_usd * TLP_FEE_SHARE);

    ctx.eventLogger.emit("Swap", {
      distinctId: event.data_decoded.sender,
      from_token,
      to_token,
      from_amount,
      to_amount,
      fee_amount,
      fee_amount_usd,
    });
  })
  .onEventWithdrawLendingEvent(async (event, ctx) => {
    let c_token_name = event.data_decoded.c_token_type.name;
    let c_token = parse_token(c_token_name);
    let c_token_decimal = token_decimal(c_token);
    const price_c_token = (await getPriceBySymbol(c_token, ctx.timestamp)) || 0;

    let r_token_name = event.data_decoded.r_token_type.name;
    let r_token = parse_token(r_token_name);
    let r_token_decimal = token_decimal(r_token);
    const price_r_token = (await getPriceBySymbol(r_token, ctx.timestamp)) || 0;

    let lending_interest = Number(event.data_decoded.lending_interest) / 10 ** c_token_decimal;
    let protocol_share = Number(event.data_decoded.protocol_share) / 10 ** c_token_decimal;

    let lending_reward = Number(event.data_decoded.lending_reward) / 10 ** r_token_decimal;
    let reward_protocol_share = Number(event.data_decoded.reward_protocol_share) / 10 ** r_token_decimal;

    ctx.meter.Counter("protocol_fee").add(protocol_share, { coin_symbol: c_token });
    ctx.meter.Counter("protocol_fee").add(reward_protocol_share, { coin_symbol: r_token });

    let protocol_fee_usd = protocol_share * price_c_token + reward_protocol_share * price_r_token;
    ctx.meter.Counter("protocol_fee_usd").add(protocol_fee_usd);

    ctx.eventLogger.emit("WithdrawLending", {
      c_token,
      r_token,
      lending_interest,
      protocol_share,
      lending_reward,
      reward_protocol_share,
      protocol_fee_usd,
    });
  });

trading
  .bind({ network, startCheckpoint })
  .onEventLiquidateEvent((event, ctx) => {
    let collateral_token_name = event.data_decoded.collateral_token.name;
    let collateral_token = parse_token(collateral_token_name);
    let collateral_decimal = token_decimal(collateral_token);
    let base_token_name = event.data_decoded.base_token.name;
    let base_token = parse_token(base_token_name);
    let position_id = event.data_decoded.position_id;
    let collateral_price = Number(event.data_decoded.collateral_price) / 10 ** PRICE_DECIMAL;
    let trading_price = Number(event.data_decoded.trading_price) / 10 ** PRICE_DECIMAL;
    let liquidator_fee = Number(event.data_decoded.realized_liquidator_fee) / 10 ** collateral_decimal;
    let value_for_lp_pool = Number(event.data_decoded.realized_value_for_lp_pool) / 10 ** collateral_decimal;

    var position_size = undefined;
    if (event.data_decoded.u64_padding.length > 0) {
      position_size = Number(event.data_decoded.u64_padding[0]) / 10 ** token_decimal(base_token)!;
    }

    var estimated_liquidation_price = undefined;
    if (event.data_decoded.u64_padding.length > 1) {
      estimated_liquidation_price = Number(event.data_decoded.u64_padding[1]) / 10 ** PRICE_DECIMAL;
    }

    let liquidator_fee_usd = liquidator_fee * collateral_price;
    ctx.meter.Counter("insurance_fee").add(liquidator_fee, { coin_symbol: collateral_token });
    ctx.meter.Counter("protocol_fee_usd").add(liquidator_fee_usd);
    let value_for_lp_pool_usd = value_for_lp_pool * collateral_price;
    ctx.meter.Counter("tlp_fee_usd").add(value_for_lp_pool_usd);

    if (position_size) {
      ctx.meter
        .Counter("trading_volume_usd")
        .add(position_size * trading_price, { side: "Liquidate", base_token });
    }

    ctx.eventLogger.emit("Liquidate", {
      distinctId: event.data_decoded.user,
      position_id,
      collateral_token,
      base_token,
      collateral_price,
      trading_price,
      liquidator_fee,
      liquidator_fee_usd,
      value_for_lp_pool,
      value_for_lp_pool_usd,
      position_size,
      estimated_liquidation_price,
    });
  })
  .onEventCreateTradingOrderEvent((event, ctx) => {
    var base_token = parse_token(event.data_decoded.base_token.name);
    var collateral_token = parse_token(event.data_decoded.collateral_token.name);

    var size = Number(event.data_decoded.size) / 10 ** token_decimal(base_token)!;
    var collateral = Number(event.data_decoded.collateral_amount) / 10 ** token_decimal(collateral_token)!;
    // Number(event.data_decoded.collateral_in_deposit_token) / 10 ** token_decimal(collateral_token)!;

    var order_type = "Limit";
    var price = event.data_decoded.trigger_price;
    if (event.data_decoded.filled) {
      order_type = "Market";
      price = event.data_decoded.filled_price!;
    } else if (event.data_decoded.reduce_only && !event.data_decoded.is_stop_order) {
      order_type = "TP";
    } else if (event.data_decoded.reduce_only && event.data_decoded.is_stop_order) {
      order_type = "SL";
    }

    ctx.eventLogger.emit("PlaceOrder", {
      distinctId: event.data_decoded.user,
      order_id: event.data_decoded.order_id,
      position_id: event.data_decoded.linked_position_id,
      base_token,
      side: event.data_decoded.is_long ? "Long" : "Short",
      order_type,
      status: event.data_decoded.filled ? "Filled" : "Open",
      size,
      size_usd: (size * Number(price)) / 10 ** PRICE_DECIMAL,
      collateral,
      collateral_token,
      price: Number(price) / 10 ** PRICE_DECIMAL, // WARNING: fixed decimal
    });
  })
  .onEventCreateTradingOrderWithBidReceiptsEvent((event, ctx) => {
    var base_token = parse_token(event.data_decoded.base_token.name);
    var collateral_token = parse_token(event.data_decoded.collateral_token.name);

    var size = Number(event.data_decoded.size) / 10 ** token_decimal(base_token)!;
    var collateral =
      Number(event.data_decoded.collateral_in_deposit_token) / 10 ** token_decimal(collateral_token)!;

    var order_type = "Limit";
    var price = event.data_decoded.trigger_price;
    if (event.data_decoded.filled) {
      order_type = "Market";
      price = event.data_decoded.filled_price!;
    }

    var dov_index = event.data_decoded.dov_index;

    ctx.eventLogger.emit("PlaceOrderWithBidReceipt", {
      distinctId: event.data_decoded.user,
      order_id: event.data_decoded.order_id,
      base_token,
      side: event.data_decoded.is_long ? "Long" : "Short",
      order_type,
      status: event.data_decoded.filled ? "Filled" : "Open",
      size,
      collateral,
      collateral_token,
      price: Number(price) / 10 ** PRICE_DECIMAL, // WARNING: fixed decimal
      dov_index,
    });
  })
  .onEventRealizeOptionPositionEvent((event, ctx) => {
    var base_token = parse_token(event.data_decoded.trading_symbol.name);
    var collateral_token = parse_token(event.data_decoded.realize_balance_token_type.name);

    var exercise_balance_value =
      Number(event.data_decoded.exercise_balance_value) / 10 ** token_decimal(collateral_token)!;
    // borrow, trading fee
    var fee_value = Number(event.data_decoded.fee_value) / 10 ** token_decimal(collateral_token)!;

    var user_remaining_value =
      Number(event.data_decoded.user_remaining_value) / 10 ** token_decimal(collateral_token)!;
    var user_remaining_in_usd = Number(event.data_decoded.user_remaining_in_usd) / 10 ** USD_DECIMAL;

    var realized_loss_value =
      Number(event.data_decoded.realized_loss_value) / 10 ** token_decimal(collateral_token)!;

    var fee_usd = user_remaining_value > 0 ? (fee_value * user_remaining_in_usd) / user_remaining_value : 0;

    ctx.meter.Counter("protocol_fee").add(fee_value * PROTOCOL_FEE_SHARE, { coin_symbol: collateral_token });
    ctx.meter.Counter("protocol_fee_usd").add(fee_usd * PROTOCOL_FEE_SHARE);
    ctx.meter.Counter("tlp_fee_usd").add(fee_usd * TLP_FEE_SHARE);

    ctx.eventLogger.emit("RealizeOption", {
      distinctId: event.data_decoded.position_user,
      position_id: event.data_decoded.position_id,
      base_token,
      collateral_token,
      exercise_balance_value, // from option exercise profit
      fee_value,
      fee_usd,
      realized_loss_value,
      user_remaining_value,
      user_remaining_in_usd,
    });
  })
  .onEventCancelTradingOrderEvent((event, ctx) => {
    var base_token = parse_token(event.data_decoded.base_token.name);
    var collateral_token = parse_token(event.data_decoded.collateral_token.name);
    var released_collateral_amount =
      Number(event.data_decoded.released_collateral_amount) / 10 ** token_decimal(collateral_token)!;

    ctx.eventLogger.emit("CancelOrder", {
      distinctId: event.data_decoded.user,
      order_id: event.data_decoded.order_id,
      base_token,
      collateral_token,
      released_collateral_amount,
    });
  })
  .onEventReleaseCollateralEvent((event, ctx) => {
    var base_token = parse_token(event.data_decoded.base_token.name);
    var collateral_token = parse_token(event.data_decoded.collateral_token.name);
    var released_collateral_amount =
      Number(event.data_decoded.released_collateral_amount) / 10 ** token_decimal(collateral_token)!;
    var remaining_collateral_amount =
      Number(event.data_decoded.remaining_collateral_amount) / 10 ** token_decimal(collateral_token)!;

    ctx.eventLogger.emit("ReleaseCollateral", {
      distinctId: event.data_decoded.user,
      position_id: event.data_decoded.position_id,
      base_token,
      collateral_token,
      released_collateral_amount,
      remaining_collateral_amount,
    });
  })
  .onEventIncreaseCollateralEvent((event, ctx) => {
    var base_token = parse_token(event.data_decoded.base_token.name);
    var collateral_token = parse_token(event.data_decoded.collateral_token.name);
    var increased_collateral_amount =
      Number(event.data_decoded.increased_collateral_amount) / 10 ** token_decimal(collateral_token)!;
    var remaining_collateral_amount =
      Number(event.data_decoded.remaining_collateral_amount) / 10 ** token_decimal(collateral_token)!;

    ctx.eventLogger.emit("IncreaseCollateral", {
      distinctId: event.data_decoded.user,
      position_id: event.data_decoded.position_id,
      base_token,
      collateral_token,
      increased_collateral_amount,
      remaining_collateral_amount,
    });
  })
  .onEventUpdateFundingRateEvent((event, ctx) => {
    var base_token = parse_token(event.data_decoded.base_token.name);
    var new_funding_ts_ms = event.data_decoded.new_funding_ts_ms;
    var intervals_count = event.data_decoded.intervals_count;
    var previous_cumulative_funding_rate_index = event.data_decoded
      .previous_cumulative_funding_rate_index_sign
      ? event.data_decoded.previous_cumulative_funding_rate_index
      : -event.data_decoded.previous_cumulative_funding_rate_index;
    var cumulative_funding_rate_index = event.data_decoded.cumulative_funding_rate_index_sign
      ? event.data_decoded.cumulative_funding_rate_index
      : -event.data_decoded.cumulative_funding_rate_index;

    ctx.eventLogger.emit("UpdateFundingRate", {
      base_token,
      new_funding_ts_ms,
      intervals_count,
      previous_cumulative_funding_rate_index,
      cumulative_funding_rate_index,
    });
  });

position
  .bind({ network, startCheckpoint })
  .onEventOrderFilledEvent((event, ctx) => {
    let collateral_token_name = event.data_decoded.collateral_token.name;
    let collateral_token = parse_token(collateral_token_name);
    let collateral_decimal = token_decimal(collateral_token);
    let base_token_name = event.data_decoded.symbol.base_token.name;
    let base_token = parse_token(base_token_name);
    let order_id = event.data_decoded.order_id;
    let position_id;
    let order_type;

    if (event.data_decoded.linked_position_id == undefined) {
      position_id = event.data_decoded.new_position_id;
      order_type = "Open";
    } else {
      position_id = event.data_decoded.linked_position_id;
      order_type = "Close";
    }

    var filled_size = Number(event.data_decoded.filled_size) / 10 ** token_decimal(base_token)!;
    var filled_price = Number(event.data_decoded.filled_price) / 10 ** PRICE_DECIMAL;
    var side = event.data_decoded.position_side ? "Long" : "Short";

    var realized_trading_fee = Number(event.data_decoded.realized_trading_fee) / 10 ** collateral_decimal;
    var realized_borrow_fee = Number(event.data_decoded.realized_borrow_fee) / 10 ** collateral_decimal;
    var realized_fee = realized_trading_fee + realized_borrow_fee;
    var realized_fee_in_usd = Number(event.data_decoded.realized_fee_in_usd) / 10 ** USD_DECIMAL;

    var realized_amount = event.data_decoded.realized_amount_sign
      ? Number(event.data_decoded.realized_amount) / 10 ** collateral_decimal
      : -Number(event.data_decoded.realized_amount) / 10 ** collateral_decimal;

    var realized_pnl =
      realized_fee > 0 ? ((realized_amount - realized_fee) * realized_fee_in_usd) / realized_fee : 0;
    // no need to calculate realized_amount w/o fee, usually happended when option is exercised ITM
    // the realized_amount is actually unrealized and it will be calculated in RealizeOption

    ctx.meter
      .Counter("protocol_fee")
      .add(realized_fee * PROTOCOL_FEE_SHARE, { coin_symbol: collateral_token });
    ctx.meter.Counter("protocol_fee_usd").add(realized_fee_in_usd * PROTOCOL_FEE_SHARE);
    ctx.meter.Counter("tlp_fee_usd").add(realized_fee_in_usd * TLP_FEE_SHARE);
    ctx.meter.Counter("trading_volume_usd").add(filled_size * filled_price, { side, base_token });

    ctx.eventLogger.emit("OrderFilled", {
      distinctId: event.data_decoded.user,
      collateral_token,
      base_token,
      order_id,
      position_id,
      order_type,
      filled_size,
      filled_price,
      side,
      realized_trading_fee,
      realized_borrow_fee,
      realized_fee,
      realized_fee_in_usd,
      realized_amount,
      realized_pnl,
    });
  })
  .onEventRealizeFundingEvent((event, ctx) => {
    let collateral_token_name = event.data_decoded.collateral_token.name;
    let collateral_token = parse_token(collateral_token_name);
    let collateral_decimal = token_decimal(collateral_token);

    let base_token_name = event.data_decoded.symbol.base_token.name;
    let base_token = parse_token(base_token_name);

    let realized_funding_fee = event.data_decoded.realized_funding_sign
      ? Number(event.data_decoded.realized_funding_fee) / 10 ** collateral_decimal
      : -Number(event.data_decoded.realized_funding_fee) / 10 ** collateral_decimal;

    let realized_funding_fee_usd = event.data_decoded.realized_funding_sign
      ? Number(event.data_decoded.realized_funding_fee_usd) / 10 ** USD_DECIMAL
      : -Number(event.data_decoded.realized_funding_fee_usd) / 10 ** USD_DECIMAL;

    ctx.meter.Counter("tlp_fee_usd").add(realized_funding_fee_usd);

    ctx.eventLogger.emit("RealizeFunding", {
      distinctId: event.data_decoded.user,
      collateral_token,
      base_token,
      realized_funding_fee,
      realized_funding_fee_usd,
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
    case "0x3e8e9423d80e1774a7ca128fccd8bf5f1f7753be658c5e645929037f7c819040":
      return "LBTC";
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
    case "SPSUI":
    case "NAVX":
    case "BLUE":
    case "sSCA":
    case "STSUI":
    case "WAL":
    case "JPY":
    case "XAU":
      return 9;
    case "BTC":
    case "ETH":
    case "SOL":
    case "APT":
    case "INJ":
    case "SEI":
    case "JUP":
    case "LBTC":
      return 8;
    case "USDC":
    case "WUSDC":
    case "USDT":
    case "MFUD":
    case "MBLUB":
    case "MLIQ":
    case "DEEP":
    case "NS":
      return 6;
    case "FUD": // actual 5
    case "LIQ": // actual 6
    case "BLUB": // actual 2
      return 0;
    default:
      return 9;
  }
}

SuiObjectProcessor.bind({
  network,
  startCheckpoint,
  objectId: LIQUIDITY_POOL_0,
}).onTimeInterval(
  async (object, df, ctx) => {
    const liquidityPool = await ctx.coder.decodeType(object, lp_pool.LiquidityPool.type());
    const tvl_usd = liquidityPool?.pool_info.tvl_usd!;
    ctx.meter.Gauge("tvl_usd").record(Number(tvl_usd) / 10 ** USD_DECIMAL);
    const total_share_supply = liquidityPool?.pool_info.total_share_supply!;
    if (total_share_supply > 0) {
      const price = Number(tvl_usd) / Number(total_share_supply);
      ctx.meter.Gauge("tlp_price").record(price);
    }
    if (liquidityPool?.token_pools) {
      for (let token_pool of liquidityPool?.token_pools) {
        // token_pool.config.spot_config.target_weight_bp;
        let token = parse_token("0x" + token_pool.token_type.name);
        var value = Number(token_pool.state.liquidity_amount) / 10 ** token_decimal(token);
        ctx.meter.Gauge("tvl").record(value, { coin_symbol: token });
        var value = Number(token_pool.state.reserved_amount) / 10 ** token_decimal(token);
        ctx.meter.Gauge("reserved_amount").record(value, { coin_symbol: token });
      }
    }
    // let balances = df as any;
    // for (let balance of balances) {
    //   if (balance.type.includes("Balance")) {
    //     let token = parse_token("0x" + balance.fields.name.fields.name);
    //     let value = Number(balance.fields.value) / 10 ** token_decimal(token);
    //     ctx.meter.Gauge("tvl").record(value, { coin_symbol: token });
    //   }
    // }
  },
  60,
  60,
  undefined,
  { owned: true }
);

// SuiObjectProcessor.bind({
//   network,
//   startCheckpoint,
//   objectId: "0x622309553dce4c4b19ef186fefc35bda5e2b4755f27c76b63f2a1d7df881e7e8",
// }).onTimeInterval(
//   async (object, df, ctx) => {
//     console.log("object ", object);
//     console.log("df ", df);
//   },
//   60,
//   60,
//   undefined,
//   { owned: true }
// );

// SuiWrappedObjectProcessor.bind({
//   network: SuiNetwork.MAIN_NET,
//   startCheckpoint,
//   objectId: "0x622309553dce4c4b19ef186fefc35bda5e2b4755f27c76b63f2a1d7df881e7e8",
// }).onTimeInterval(
//   async (objects, ctx) => {
//     for (const object of objects) {
//       console.log(object.type);
//       console.log("SymbolMarket", JSON.stringify(object));
//       // SymbolMarket {"dataType":"moveObject","type":"0x2::dynamic_field::Field<0x2::dynamic_object_field::Wrapper<0x1::type_name::TypeName>, 0x2::object::ID>","hasPublicTransfer":false,
//       // "fields":{"id":{"id":"0x182d865332e5926a74b09a3da047ac1e83af98d2b60dc66a4313d4e24611725f"},
//       // "name":{"type":"0x2::dynamic_object_field::Wrapper<0x1::type_name::TypeName>",
//       // "fields":{"name":{"type":"0x1::type_name::TypeName","fields":{"name":"b7844e289a8410e50fb3ca48d69eb9cf29e27d223ef90353fe1bd8e27ff8f3f8::coin::COIN"}}}},
//       // "value":"0x37b7d5707a038d2d0841bb996991572029f469a907d00b2223dfc33d9660a224"}}
//     }
//   },
//   60,
//   60,
//   undefined,
//   { owned: true }
// );
