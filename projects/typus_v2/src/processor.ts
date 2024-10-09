import { SuiNetwork, SuiWrappedObjectProcessor } from "@sentio/sdk/sui";
import {
  auto_bid,
  typus_dov_single,
  tails_staking,
  tds_authorized_entry,
  tds_registry_authorized_entry,
} from "./types/sui/typus_dov_single.js";
import { tails_exp, combo_dice } from "./types/sui/dice.js";
import { safu } from "./types/sui/safu.js";
import { discount_mint, typus_nft } from "./types/sui/typus_nft.js";
import { normalizeSuiAddress } from "@mysten/sui.js/utils";
import { vault } from "./types/sui/0xb4f25230ba74837d8299e92951306100c4a532e8c48cc3d8828abe9b91c8b274.js";
import { getPriceBySymbol } from "@sentio/sdk/utils";
import { tails_staking as tails_staking_v2 } from "./types/sui/typus.js";
import { BcsReader } from "@mysten/bcs";
import { VaultSnapshot, VaultInfo, SafuInfo } from "./schema/store.js";

const startCheckpoint = BigInt(15970051);

const PORTFOLIO_VAULT_REGISTRY = "0xa1a186d050e3172ef4701c16048c99b11f785969874fa2642b9cbcf59cde7fc0";
const DEPOSIT_VAULT_REGISTRY = "0xd67cf93a0df61b4b3bbf6170511e0b28b21578d9b87a8f4adafec96322dd284d";
const SAFU_REGISTRY = "0xdc970d638d1489385e49ddb76889748011bac4616b95a51aa63633972b841706";

safu
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(25518308) })
  .onEventManagerEvent(async (event, ctx) => {
    const action = event.data_decoded.action;
    const log = event.data_decoded.log;
    const safu_info = await ctx.store.get(SafuInfo, log[0].toString());
    var token: string | undefined;
    switch (action) {
      case "new_vault":
        const bcs_padding = event.data_decoded.bcs_padding;
        const reader = new BcsReader(new Uint8Array(bcs_padding[0]));
        const tokenType = String.fromCharCode.apply(null, Array.from(reader.readBytes(reader.read8())));
        token = parse_token(tokenType);
        const index = log[0];
        const portfolioVaultIndex = log[2];
        ctx.eventLogger.emit("SafuNewVault", {
          distinctId: event.sender,
          index,
          portfolioVaultIndex,
          d_token: token,
        });
        const vaultInfo = await ctx.store.get(VaultInfo, portfolioVaultIndex.toString());
        const new_safu_info = new SafuInfo({
          id: index.toString(),
          d_token: token,
          dov_b_token: vaultInfo?.b_token,
          dov_d_token: vaultInfo?.d_token,
        });
        await ctx.store.upsert(new_safu_info);
        break;
      case "refresh":
        ctx.eventLogger.emit("SafuRefresh", {
          distinctId: event.sender,
          index: log[0],
          round: log[1],
          refresh_ts_ms: log[2],
          price_bp: log[3],
          active_share: log[4],
          deactivating_share: log[5],
          inactive_share: log[6],
          warmup_share: log[7],
        });
        break;
      case "post_exercise":
        token = safu_info?.dov_d_token!;
        var balance = Number(log[2]) / 10 ** token_decimal(token!);
        ctx.eventLogger.emit("SafuPostExercise", {
          distinctId: event.sender,
          index: log[0],
          round: log[1],
          balance,
          token,
        });
        var price = await getPriceBySymbol(token, ctx.timestamp);
        ctx.meter.Counter("SafuAccumulatedRewardGeneratedUSD").add(balance * price!, {
          coin_symbol: token,
        });
        break;
      case "post_bid_balance":
        token = safu_info?.d_token!;
        var balance = Number(log[2]) / 10 ** token_decimal(token!);
        var fee = Number(log[3]) / 10 ** token_decimal(token!);
        ctx.eventLogger.emit("SafuPostBidBalance", {
          distinctId: event.sender,
          index: log[0],
          round: log[1],
          balance,
          fee,
          token,
        });
        var price = await getPriceBySymbol(token, ctx.timestamp);
        ctx.meter.Counter("SafuAccumulatedRewardGeneratedUSD").add(balance * price!, {
          coin_symbol: token,
        });
        break;
      case "set_incentivise_fixed":
      case "set_incentivise_bp":
        // WARNING: SUI only
        token = "SUI";
        var balance = Number(log[2]) / 10 ** token_decimal(token!);
        ctx.eventLogger.emit("SafuSetIncentivise", {
          distinctId: event.sender,
          index: log[0],
          round: log[1],
          balance,
        });
        break;
      case "deposit_scallop_spool":
      case "deposit_scallop_basic":
      case "deposit_suilend":
      case "deposit_navi":
        token = safu_info?.d_token!;
        var balance = Number(log[2]) / 10 ** token_decimal(token!);
        var minted_coin_value = log.at(3) ? Number(log.at(3)) / 10 ** token_decimal(token!) : 0;
        ctx.eventLogger.emit("SafuDepositLending", {
          distinctId: event.sender,
          index: log[0],
          round: log[1],
          balance,
          minted_coin_value,
          protocol: action.slice("deposit_".length),
          token,
        });
        break;
      case "withdraw_scallop_spool":
      case "withdraw_scallop_basic":
      case "withdraw_suilend":
      case "withdraw_navi":
        token = safu_info?.d_token!;
        var share_supply = Number(log[2]) / 10 ** token_decimal(token!);
        var balance = Number(log[3]) / 10 ** token_decimal(token!);
        // SUI incentive only withdraw_scallop_spool
        var sui_reward = log.at(4) ? Number(log.at(4)) / 10 ** token_decimal("SUI") : 0;
        ctx.eventLogger.emit("SafuWithdrawLending", {
          distinctId: event.sender,
          index: log[0],
          round: log[1],
          share_supply,
          balance, // balance - share_supply = interest
          sui_reward, // in SUI
          protocol: action.slice("withdraw_".length),
          d_token: token,
        });
        break;
      case "reward_suilend":
      case "reward_navi":
        // don't know token
        ctx.eventLogger.emit("SafuWithdrawReward", {
          distinctId: event.sender,
          index: log[0],
          round: log[1],
          reward: log[2],
          protocol: action.slice("reward_".length),
        });
        break;
      case "safu_swap":
        ctx.eventLogger.emit("SafuSwap", {
          distinctId: event.sender,
          index: log[0],
          round: log[1],
          value_in_a: log[2],
          value_in_b: log[3],
          coin_out_a: log[4],
          coin_out_b: log[5],
          swapped: log[6] == BigInt(1) ? true : false,
        });
        break;
    }
  })
  .onEventUserEvent((event, ctx) => {
    const action = event.data_decoded.action;
    const log = event.data_decoded.log;
    const bcs_padding = event.data_decoded.bcs_padding;

    if (bcs_padding.length > 0) {
      const reader = new BcsReader(new Uint8Array(bcs_padding[0]));
      const tokenType = String.fromCharCode.apply(null, Array.from(reader.readBytes(reader.read8())));
      const token = parse_token(tokenType);

      switch (action) {
        case "raise_fund":
          if (log[2] + log[3] + log[4] > 0) {
            ctx.eventLogger.emit("SafuDeposit", {
              distinctId: event.sender,
              index: log[0],
              round: log[1],
              balance_value: log[2],
              deactivating_value: log[3],
              inactive_value: log[4],
              exp: log[6],
              token,
            });
          }
          if (log[5] > 0) {
            ctx.eventLogger.emit("SafuCompound", {
              distinctId: event.sender,
              index: log[0],
              round: log[1],
              reward_value: log[5],
              exp: log[6],
              token,
            });
          }
          break;
        case "reduce_fund":
          if (Number(log[2]) > 0) {
            ctx.eventLogger.emit("SafuWithdraw", {
              distinctId: event.sender,
              index: log[0],
              round: log[1],
              value: log[2],
              exp: log[6],
              token,
            });
          }
          if (Number(log[3]) > 0) {
            ctx.eventLogger.emit("SafuUnsubscribe", {
              distinctId: event.sender,
              index: log[0],
              round: log[1],
              value: log[3],
              exp: log[6],
              token,
            });
          }
          if (Number(log[4]) > 0) {
            ctx.eventLogger.emit("SafuClaim", {
              distinctId: event.sender,
              index: log[0],
              round: log[1],
              value: log[4],
              exp: log[6],
              token,
            });
          }
          break;
        case "claim_reward":
          ctx.eventLogger.emit("SafuHarvest", {
            distinctId: event.sender,
            index: log[0],
            round: log[1],
            value: log[2],
            token,
          });
          break;
      }
    }
  });

auto_bid
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(25518308) })
  .onEventNewStrategyEventV2((event, ctx) => {
    ctx.eventLogger.emit("NewStrategy", {
      distinctId: event.data_decoded.user,
      vault_index: event.data_decoded.vault_index,
      signal_index: event.data_decoded.signal_index,
      price_percentage: event.data_decoded.price_percentage,
      size: event.data_decoded.size,
      max_times: event.data_decoded.max_times,
      target_rounds: event.data_decoded.target_rounds.join(","),
      deposit_amount: event.data_decoded.deposit_amount,
    });
  })
  .onEventUpdateStrategyEvent((event, ctx) => {
    ctx.eventLogger.emit("UpdateStrategy", {
      distinctId: event.data_decoded.user,
      vault_index: event.data_decoded.vault_index,
      signal_index: event.data_decoded.signal_index,
      price_percentage: event.data_decoded.price_percentage,
      size: event.data_decoded.size,
      max_times: event.data_decoded.max_times,
      target_rounds: event.data_decoded.target_rounds.join(","),
      deposit_amount: event.data_decoded.deposit_amount,
    });
  })
  .onEventCloseStrategyEventV2((event, ctx) => {
    ctx.eventLogger.emit("CloseStrategy", {
      distinctId: event.data_decoded.user,
      vault_index: event.data_decoded.vault_index,
      signal_index: event.data_decoded.signal_index,
      price_percentage: event.data_decoded.price_percentage,
      size: event.data_decoded.size,
      max_times: event.data_decoded.max_times,
      target_rounds: event.data_decoded.target_rounds.join(","),
      bid_rounds: event.data_decoded.bid_rounds.join(","),
      balance: event.data_decoded.u64_padding.at(0),
      profit: event.data_decoded.u64_padding.at(1),
      accumulated_cost: event.data_decoded.u64_padding.at(2),
      accumulated_profit: event.data_decoded.accumulated_profit,
    });
  })
  .onEventWithdrawProfitEvent((event, ctx) => {
    ctx.eventLogger.emit("HarvestGain", {
      distinctId: event.data_decoded.user,
      vault_index: event.data_decoded.vault_index,
      signal_index: event.data_decoded.signal_index,
      profit: event.data_decoded.profit,
    });
  });

typus_nft
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(25518308) })
  .onEventExpUpEvent((event, ctx) => {
    ctx.eventLogger.emit("ExpUp", {
      nft_id: event.data_decoded.nft_id,
      number: event.data_decoded.number,
      exp_earn: event.data_decoded.exp_earn,
    });
  });

discount_mint
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(25518308) })
  .onEventDiscountEventV3((event, ctx) => {
    ctx.eventLogger.emit("DiscountMint", {
      distinctId: event.data_decoded.user,
      pool: event.data_decoded.pool,
      price: Number(event.data_decoded.price) / 10 ** 9,
      discount_pct: Number(event.data_decoded.discount_pct) / 100,
      discount_price: Number(event.data_decoded.discount_price) / 10 ** 9,
      level: event.data_decoded.level,
    });
  });

tails_exp
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint })
  .onEventNewGame((event, ctx) => {
    let token = parse_token(event.type_arguments[0]);
    let stake_amount = Number(event.data_decoded.stake_amount) / 10 ** token_decimal(token);
    ctx.eventLogger.emit("NewGame", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      game_id: event.data_decoded.game_id,
      stake_amount: stake_amount,
      token,
    });
  })
  .onEventPlayGuess((event, ctx) => {
    ctx.eventLogger.emit("PlayGuess", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      game_id: event.data_decoded.game_id,
      guess_1: event.data_decoded.guess_1,
      guess_2: event.data_decoded.guess_2,
      larger_than_1: event.data_decoded.larger_than_1,
      larger_than_2: event.data_decoded.larger_than_2,
    });
  })
  .onEventDraw((event, ctx) => {
    ctx.eventLogger.emit("Draw", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      game_id: event.data_decoded.game_id,
      // guess_1: event.data_decoded.guess_1,
      // guess_2: event.data_decoded.guess_2,
      // larger_than_1: event.data_decoded.larger_than_1,
      // larger_than_2: event.data_decoded.larger_than_2,
      answer_1: event.data_decoded.answer_1,
      answer_2: event.data_decoded.answer_2,
      result_1: event.data_decoded.result_1,
      result_2: event.data_decoded.result_2,
      // stake_amount: event.data_decoded.stake_amount,
      exp: event.data_decoded.exp,
    });
  });

combo_dice
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(41546384) })
  .onEventNewGame((event, ctx) => {
    let token = parse_token(event.type_arguments[0]);
    let player_stake_amount = Number(event.data_decoded.player_stake_amount) / 10 ** token_decimal(token);
    let banker_stake_amount = Number(event.data_decoded.banker_stake_amount) / 10 ** token_decimal(token);
    ctx.eventLogger.emit("NewGame$", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      game_id: event.data_decoded.game_id,
      player_stake_amount,
      banker_stake_amount,
      token,
    });
  })
  .onEventPlayGuess((event, ctx) => {
    ctx.eventLogger.emit("PlayGuess$", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      game_id: event.data_decoded.game_id,
      guess_1: event.data_decoded.guess_1,
      guess_2: event.data_decoded.guess_2,
      larger_than_1: event.data_decoded.larger_than_1,
      larger_than_2: event.data_decoded.larger_than_2,
    });
  })
  .onEventDraw((event, ctx) => {
    let reward = Number(event.data_decoded.reward) / 10 ** token_decimal("SUI");
    ctx.eventLogger.emit("Draw$", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      game_id: event.data_decoded.game_id,
      answer_1: event.data_decoded.answer_1,
      answer_2: event.data_decoded.answer_2,
      result_1: event.data_decoded.result_1,
      result_2: event.data_decoded.result_2,
      exp: event.data_decoded.exp_amount,
      reward,
    });
  });

tails_staking_v2
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(38750342) })
  .onEventDailySignUpEvent((event, ctx) => {
    ctx.eventLogger.emit("DailyAttend", {
      distinctId: event.sender,
      numbers: event.data_decoded.tails.join(","),
      exp_earn: event.data_decoded.log[0],
    });
  })
  .onEventExpUpEvent((event, ctx) => {
    ctx.eventLogger.emit("Collect EXP", {
      distinctId: event.sender,
      nft_id: event.data_decoded.tails,
      number: event.data_decoded.log[0],
      exp_earn: event.data_decoded.log[1],
    });
  })
  .onEventLevelUpEvent((event, ctx) => {
    ctx.eventLogger.emit("LevelUp", {
      distinctId: event.sender,
      nft_id: event.data_decoded.tails,
      number: event.data_decoded.log[0],
      level: event.data_decoded.log[1],
    });
  })
  .onEventStakeTailsEvent((event, ctx) => {
    ctx.eventLogger.emit("StakeNft", {
      distinctId: event.sender,
      nft_id: event.data_decoded.tails,
      number: event.data_decoded.log[0],
    });
  })
  .onEventUnstakeTailsEvent((event, ctx) => {
    ctx.eventLogger.emit("UnstakeNft", {
      distinctId: event.sender,
      nft_id: event.data_decoded.tails,
      number: event.data_decoded.log[0],
    });
  })
  .onEventTransferTailsEvent((event, ctx) => {
    ctx.eventLogger.emit("TransferNft", {
      distinctId: event.sender,
      nft_id: event.data_decoded.tails,
      number: event.data_decoded.log[0],
      receiver: event.data_decoded.recipient,
    });
  })
  .onEventClaimProfitSharingEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.profit_asset.name);
    var amount = Number(event.data_decoded.log[0]) / 10 ** token_decimal(token);
    ctx.eventLogger.emit("ClaimProfitSharing", {
      distinctId: event.sender,
      numbers: event.data_decoded.tails,
      token: token,
      amount: amount,
    });
  });

tds_registry_authorized_entry
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint })
  .onEventNewPortfolioVaultEvent(
    async (event, ctx) => {
      // @ts-ignore
      const ObjectOwners = ctx.transaction.effects?.created?.filter((e) => e.owner.ObjectOwner)!;

      const df_portfolio_vault = ObjectOwners.find(
        // @ts-ignore
        (e) => e.owner.ObjectOwner == PORTFOLIO_VAULT_REGISTRY
      )?.reference.objectId;

      const df_deposit_vault = ObjectOwners.find(
        // @ts-ignore
        (e) => e.owner.ObjectOwner == DEPOSIT_VAULT_REGISTRY
      )?.reference.objectId;

      const portfolio_vault_object_id = ObjectOwners.find(
        // @ts-ignore
        (e) => e.owner.ObjectOwner == df_portfolio_vault
      )?.reference.objectId;

      const deposit_vault_object_id = ObjectOwners.find(
        // @ts-ignore
        (e) => e.owner.ObjectOwner == df_deposit_vault
      )?.reference.objectId;

      // const portfolio_vault = await ctx.client.getDynamicFieldObject({
      //   parentId: PORTFOLIO_VAULT_REGISTRY,
      //   name: {
      //     type: "u64",
      //     value: event.data_decoded.index.toString(),
      //   },
      // });
      // const deposit_vault = await ctx.client.getDynamicFieldObject({
      //   parentId: DEPOSIT_VAULT_REGISTRY,
      //   name: {
      //     type: "u64",
      //     value: event.data_decoded.index.toString(),
      //   },
      // });
      // const portfolio_vault_object_id = portfolio_vault.data?.objectId;
      // const deposit_vault_object_id = deposit_vault.data?.objectId;

      ctx.eventLogger.emit("NewPortfolioVault", {
        distinctId: event.sender,
        index: event.data_decoded.index,
        portfolio_vault_object_id,
        deposit_vault_object_id,
        // info
        option_type: event.data_decoded.info.option_type,
        period: event.data_decoded.info.period,
        deposit_token: event.data_decoded.info.deposit_token.name,
        bid_token: event.data_decoded.info.bid_token.name,
        settlement_base: event.data_decoded.info.settlement_base.name,
        settlement_quote: event.data_decoded.info.settlement_quote.name,
        d_token_decimal: event.data_decoded.info.d_token_decimal,
        b_token_decimal: event.data_decoded.info.b_token_decimal,
        o_token_decimal: event.data_decoded.info.o_token_decimal,
        create_ts_ms: event.data_decoded.info.create_ts_ms,
        // config
        oracle_id: event.data_decoded.config.oracle_id,
        deposit_lot_size: event.data_decoded.config.deposit_lot_size,
        bid_lot_size: event.data_decoded.config.bid_lot_size,
        min_deposit_size: event.data_decoded.config.min_deposit_size,
        min_bid_size: event.data_decoded.config.min_bid_size,
        max_deposit_entry: event.data_decoded.config.max_deposit_entry,
        max_bid_entry: event.data_decoded.config.max_bid_entry,
        deposit_fee_bp: event.data_decoded.config.deposit_fee_bp,
        bid_fee_bp: event.data_decoded.config.bid_fee_bp,
        capacity: event.data_decoded.config.capacity,
        leverage: event.data_decoded.config.leverage,
        risk_level: event.data_decoded.config.risk_level,
        // symbol
      });
      const d_token = parse_token(event.data_decoded.info.deposit_token.name);
      const b_token = parse_token(event.data_decoded.info.bid_token.name);
      const o_token = parse_token(event.data_decoded.info.settlement_base.name);
      const vault_info = new VaultInfo({
        id: event.data_decoded.index.toString(),
        d_token,
        b_token,
        o_token,
      });
      await ctx.store.upsert(vault_info);
    },
    { resourceChanges: true }
  );

tails_staking
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint })
  .onEventDailyAttendEvent((event, ctx) => {
    ctx.eventLogger.emit("DailyAttend", {
      distinctId: event.data_decoded.sender,
      // nft_id: event.data_decoded.nft_id,
      numbers: event.data_decoded.number.toString(),
      exp_earn: event.data_decoded.exp_earn,
    });
  })
  .onEventSnapshotNftEvent((event, ctx) => {
    ctx.eventLogger.emit("Collect EXP", {
      distinctId: event.data_decoded.sender,
      nft_id: event.data_decoded.nft_id,
      number: event.data_decoded.number,
      exp_earn: event.data_decoded.exp_earn,
    });
  })
  .onEventLevelUpEvent((event, ctx) => {
    ctx.eventLogger.emit("LevelUp", {
      distinctId: event.data_decoded.sender,
      nft_id: event.data_decoded.nft_id,
      number: event.data_decoded.number,
      level: event.data_decoded.level,
    });
  })
  .onEventStakeNftEvent((event, ctx) => {
    ctx.eventLogger.emit("StakeNft", {
      distinctId: event.data_decoded.sender,
      nft_id: event.data_decoded.nft_id,
      number: event.data_decoded.number,
    });
  })
  .onEventUnstakeNftEvent((event, ctx) => {
    ctx.eventLogger.emit("UnstakeNft", {
      distinctId: event.data_decoded.sender,
      nft_id: event.data_decoded.nft_id,
      number: event.data_decoded.number,
    });
  })
  .onEventTransferNftEvent((event, ctx) => {
    ctx.eventLogger.emit("TransferNft", {
      distinctId: event.data_decoded.sender,
      nft_id: event.data_decoded.nft_id,
      number: event.data_decoded.number,
      receiver: event.data_decoded.receiver,
    });
  })
  .onEventClaimProfitSharingEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);
    var amount = Number(event.data_decoded.value) / 10 ** token_decimal(token);
    if (token == "FUD") {
      amount /= 10 ** 5;
    }
    ctx.eventLogger.emit("ClaimProfitSharing", {
      distinctId: event.data_decoded.sender,
      nft_id: event.data_decoded.nft_id,
      number: event.data_decoded.number,
      level: event.data_decoded.level,
      token: token,
      amount: amount,
    });
  })
  .onEventClaimProfitSharingEventV2((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);
    var amount = Number(event.data_decoded.value) / 10 ** token_decimal(token);
    if (token == "FUD") {
      amount /= 10 ** 5;
    }
    ctx.eventLogger.emit("ClaimProfitSharing", {
      distinctId: event.data_decoded.sender,
      nft_id: event.data_decoded.nft_id,
      number: event.data_decoded.number,
      level: event.data_decoded.level,
      token: token,
      amount: amount,
      name: event.data_decoded.name,
    });
  });

tds_authorized_entry
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(1651870) })
  .onEventUpdateStrikeEvent((event, ctx) => {
    const decimal = Number(event.data_decoded.oracle_price_decimal);
    const strikes = event.data_decoded.vault_config.payoff_configs
      .map((config) => (Number(config.strike!) / 10 ** decimal).toString())
      .join("   ");
    ctx.eventLogger.emit("UpdateStrike", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      oracle_price: Number(event.data_decoded.oracle_price) / 10 ** decimal,
      strikes,
      round: event.data_decoded.vault_config.u64_padding.at(0),
    });
  })
  .onEventDepositScallop((event, ctx) => {
    ctx.eventLogger.emit("DepositScallop", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      active_balance_value: event.data_decoded.u64_padding.at(0),
      deactivating_balance_value: event.data_decoded.u64_padding.at(1),
      minted_coin_value: event.data_decoded.u64_padding.at(2),
      round: event.data_decoded.u64_padding.at(3),
    });
  })
  .onEventWithdrawScallop(async (event, ctx) => {
    const index = Number(event.data_decoded.index);
    const round = event.data_decoded.u64_padding.at(-1);
    const u64_padding = event.data_decoded.u64_padding.slice(0, -1);
    if (u64_padding.at(1)) {
      try {
        const price = await getPriceBySymbol("SUI", ctx.timestamp);
        ctx.meter
          .Counter("AccumulatedRewardGeneratedUSD")
          .add((Number(u64_padding.at(1)) / 10 ** 9) * price!, {
            index: index.toString(),
            coin_symbol: "SUI",
          });
        ctx.meter.Counter("withdrawScallop").add((Number(u64_padding.at(1)) / 10 ** 9) * price!, {
          index: index.toString(),
          coin_symbol: "SUI",
        });
      } catch (e) {
        //console log coin symbol and tx hash
        console.log("coin symbol: SUI, tx hash: ", event.id);
      }
    }
    ctx.eventLogger.emit("WithdrawScallop", {
      distinctId: event.data_decoded.signer,
      index,
      balance_value: u64_padding.at(0),
      reward_value: u64_padding.at(1),
      active_share_supply: u64_padding.at(2),
      deactivating_share_supply: u64_padding.at(3),
      fee_amount: u64_padding.at(4),
      fee_share_amount: u64_padding.at(5),
      round,
    });
  })
  .onEventDepositScallopBasicLending((event, ctx) => {
    ctx.eventLogger.emit("DepositScallopBasicLending", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      active_balance_value: event.data_decoded.u64_padding.at(0),
      deactivating_balance_value: event.data_decoded.u64_padding.at(1),
      minted_coin_value: event.data_decoded.u64_padding.at(2),
      round: event.data_decoded.u64_padding.at(3),
    });
  })
  .onEventWithdrawScallopBasicLending(async (event, ctx) => {
    const index = Number(event.data_decoded.index);
    const round = event.data_decoded.u64_padding.at(-1);
    const u64_padding = event.data_decoded.u64_padding.slice(0, -1);
    if (u64_padding.at(1)) {
      try {
        //getPrice
        const price = await getPriceBySymbol("SCA", ctx.timestamp);
        ctx.meter
          .Counter("AccumulatedRewardGeneratedUSD")
          .add((Number(u64_padding.at(1)) / 10 ** 9) * price!, {
            index: index.toString(),
            coin_symbol: "SCA",
          });
        ctx.meter.Counter("withdrawScallop").add((Number(u64_padding.at(1)) / 10 ** 9) * price!, {
          index: index.toString(),
          coin_symbol: "SCA",
        });
      } catch (e) {
        //console log coin symbol and tx hash
        console.log("coin symbol: SCA, tx hash: ", event.id);
      }
    }
    ctx.eventLogger.emit("WithdrawScallopBasicLending", {
      distinctId: event.data_decoded.signer,
      index,
      balance_value: u64_padding.at(0),
      reward_value: u64_padding.at(1),
      active_share_supply: u64_padding.at(2),
      deactivating_share_supply: u64_padding.at(3),
      round,
    });
  });

typus_dov_single
  .bind({ network: SuiNetwork.MAIN_NET, startCheckpoint: BigInt(1651870) })
  .onEventDepositEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);
    let amount = Number(event.data_decoded.amount) / 10 ** token_decimal(token);

    // ctx.meter.Counter("totalDeposit").add(amount, {
    //     index: event.data_decoded.index.toString(),
    //     coin_symbol: token,
    // });
    ctx.eventLogger.emit("Deposit", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      coin_symbol: token,
      amount: amount,
    });
  })
  .onEventWithdrawEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);
    let amount = Number(event.data_decoded.amount) / 10 ** token_decimal(token);

    // ctx.meter.Counter("totalWithdraw").add(amount, {
    //     index: event.data_decoded.index.toString(),
    //     coin_symbol: token,
    // });
    ctx.eventLogger.emit("Withdraw", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      coin_symbol: token,
      amount: amount,
    });
  })
  .onEventUnsubscribeEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);
    let amount = Number(event.data_decoded.amount) / 10 ** token_decimal(token);

    // ctx.meter.Counter("totalUnsubscribe").add(amount, {
    //     index: event.data_decoded.index.toString(),
    //     coin_symbol: token,
    // });
    ctx.eventLogger.emit("Unsubscribe", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      coin_symbol: token,
      amount: amount,
    });
  })
  .onEventClaimEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);
    let amount = Number(event.data_decoded.amount) / 10 ** token_decimal(token);

    // ctx.meter.Counter("totalClaim").add(amount, {
    //     index: event.data_decoded.index.toString(),
    //     coin_symbol: token,
    // });
    ctx.eventLogger.emit("Claim", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      coin_symbol: token,
      amount: amount,
    });
  })
  .onEventHarvestEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);

    const fee_amount = Number(event.data_decoded.fee_amount) / 10 ** token_decimal(token);

    ctx.meter.Counter("harvestFee").add(fee_amount, {
      index: event.data_decoded.index.toString(),
      coin_symbol: token,
    });
    // ctx.meter.Counter("totalHarvest").add(Number(event.data_decoded.amount) / 10 ** token_decimal(token), {
    //     index: event.data_decoded.index.toString(),
    //     coin_symbol: token,
    // });
    ctx.eventLogger.emit("Harvest", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      coin_symbol: token,
      amount: Number(event.data_decoded.amount) / 10 ** token_decimal(token),
      fee_amount,
    });
  })
  .onEventRedeemEvent(async (event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);
    const price = await getPriceBySymbol(token, ctx.timestamp);
    ctx.eventLogger.emit("DepositorRewardClaimed", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      coin_symbol: token,
      price,
      amount: Number(event.data_decoded.amount) / 10 ** token_decimal(token),
      fee_amount: Number(event.data_decoded.u64_padding[0]) / 10 ** token_decimal(token),
      fee_share_amount: Number(event.data_decoded.u64_padding[1]) / 10 ** token_decimal(token),
    });
  })
  .onEventCompoundEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);

    let temp = event.data_decoded.u64_padding.at(0);
    let fee_amount = Number(temp ? temp : 0) / 10 ** token_decimal(token);
    ctx.meter.Counter("compoundFee").add(fee_amount, {
      index: event.data_decoded.index.toString(),
      coin_symbol: token,
    });

    // ctx.meter.Counter("totalCompound").add(Number(event.data_decoded.amount) / 10 ** token_decimal(token), {
    //     index: event.data_decoded.index.toString(),
    //     coin_symbol: token,
    // });
    ctx.eventLogger.emit("Compound", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      coin_symbol: token,
      amount: Number(event.data_decoded.amount) / 10 ** token_decimal(token),
      fee_amount,
    });
  })
  .onEventExerciseEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);

    ctx.eventLogger.emit("Exercise", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      coin_symbol: token,
      amount: Number(event.data_decoded.amount) / 10 ** token_decimal(token),
      raw_share: event.data_decoded.u64_padding.pop(),
      is_autobid: event.data_decoded.signer != event.sender,
    });
  })
  .onEventRefundEvent((event, ctx) => {
    let token = parse_token(event.data_decoded.token.name);

    ctx.eventLogger.emit("Refund", {
      distinctId: event.data_decoded.signer,
      coin_symbol: token,
      amount: Number(event.data_decoded.amount) / 10 ** token_decimal(token),
    });
  })
  .onEventDeliveryEvent(async (event, ctx) => {
    let b_token = parse_token(event.data_decoded.b_token.name);
    let o_token = parse_token(event.data_decoded.o_token.name);

    let bidder_bid_value = Number(event.data_decoded.bidder_bid_value) / 10 ** token_decimal(b_token);
    let bidder_fee = Number(event.data_decoded.bidder_fee) / 10 ** token_decimal(b_token);
    let delivery_price = Number(event.data_decoded.delivery_price) / 10 ** token_decimal(b_token);
    let delivery_size = Number(event.data_decoded.delivery_size) / 10 ** token_decimal(o_token);
    let incentive_bid_value = Number(event.data_decoded.incentive_bid_value) / 10 ** token_decimal(b_token);
    let incentive_fee = Number(event.data_decoded.incentive_fee) / 10 ** token_decimal(b_token);

    ctx.meter.Counter("totalBidderFee").add(bidder_fee + incentive_fee, {
      index: event.data_decoded.index.toString(),
      coin_symbol: b_token,
    });
    ctx.meter
      .Counter("AccumulatedPremium")
      .add(bidder_bid_value + bidder_fee + incentive_bid_value + incentive_fee, {
        index: event.data_decoded.index.toString(),
        coin_symbol: b_token,
      });
    ctx.meter.Counter("AccumulatedDeliverySize").add(delivery_size, {
      index: event.data_decoded.index.toString(),
      coin_symbol: o_token,
    });

    const price_o_token = await getPriceBySymbol(o_token, ctx.timestamp);
    try {
      //getPrice
      if (price_o_token) {
        ctx.meter.Counter("AccumulatedNotionalVolumeUSD").add(delivery_size * price_o_token, {
          index: event.data_decoded.index.toString(),
          coin_symbol: o_token,
        });
      }
    } catch (e) {
      //console log coin symbol and tx hash
      console.log("coin symbol: ", o_token, ", tx hash: ", event.id);
    }

    const sui_price = await getPriceBySymbol("SUI", ctx.timestamp);

    // SCA and SUI decimal both are 9
    const depositor_incentive_value = Number(event.data_decoded.depositor_incentive_value) / 10 ** 9;

    if (o_token == "SCA") {
      const price = await getPriceBySymbol("SCA", ctx.timestamp);
      ctx.meter.Counter("AccumulatedRewardGeneratedUSD").add(depositor_incentive_value * price!, {
        index: event.data_decoded.index.toString(),
        coin_symbol: "SCA",
      });
      // ctx.meter.Counter("depositor_incentive_value").add(depositor_incentive_value * price!, {
      //     index: event.data_decoded.index.toString(),
      //     coin_symbol: "SCA",
      // });
    } else {
      ctx.meter.Counter("AccumulatedRewardGeneratedUSD").add(depositor_incentive_value * sui_price!, {
        index: event.data_decoded.index.toString(),
        coin_symbol: "SUI",
      });
      // ctx.meter.Counter("depositor_incentive_value").add(depositor_incentive_value * sui_price!, {
      //     index: event.data_decoded.index.toString(),
      //     coin_symbol: "SUI",
      // });
    }

    const price_b_token = await getPriceBySymbol(b_token, ctx.timestamp);
    try {
      //getPrice
      if (price_b_token) {
        ctx.meter
          .Counter("AccumulatedPremiumUSD")
          .add((bidder_bid_value + bidder_fee + incentive_bid_value + incentive_fee) * price_b_token, {
            index: event.data_decoded.index.toString(),
            coin_symbol: b_token,
          });
        ctx.meter
          .Counter("AccumulatedRewardGeneratedUSD")
          .add((bidder_bid_value + incentive_bid_value) * price_b_token, {
            index: event.data_decoded.index.toString(),
            coin_symbol: b_token,
          });
      }
    } catch (e) {
      //console log coin symbol and tx hash
      console.log("coin symbol: ", b_token, ", tx hash: ", event.id);
    }

    var deposit_incentive_bp = 0;
    var bid_incentive_bp = 0;
    if (event.data_decoded.u64_padding.at(3) != undefined) {
      deposit_incentive_bp =
        Number(event.data_decoded.u64_padding.at(2)) / 10 ** Number(event.data_decoded.u64_padding.at(3));
      bid_incentive_bp = Number(event.data_decoded.u64_padding.at(4));
    }

    const fixed_incentive_amount = event.data_decoded.u64_padding.at(0)
      ? Number(event.data_decoded.u64_padding.at(0)) / 10 ** token_decimal("SUI")
      : undefined;

    if (fixed_incentive_amount) {
      ctx.meter.Counter("AccumulatedRewardGeneratedUSD").add(fixed_incentive_amount * sui_price!, {
        index: event.data_decoded.index.toString(),
        coin_symbol: "SUI",
      });
      // ctx.meter.Counter("fixed_incentive_amount").add(fixed_incentive_amount * sui_price!, {
      //     index: event.data_decoded.index.toString(),
      //     coin_symbol: "SUI",
      // });
    }

    const max_size = event.data_decoded.u64_padding.at(1)
      ? Number(event.data_decoded.u64_padding.at(1)) / 10 ** token_decimal(o_token)
      : undefined;

    ctx.eventLogger.emit("Delivery", {
      index: event.data_decoded.index,
      b_token,
      o_token,
      distinctId: event.data_decoded.signer,
      round: event.data_decoded.round,
      delivery_price,
      delivery_size,
      bidder_bid_value,
      bidder_fee,
      incentive_bid_value,
      incentive_fee,
      depositor_incentive_value,
      fixed_incentive_amount,
      max_size,
      deposit_incentive_bp,
      bid_incentive_bp,
      price_o_token,
      price_b_token,
    });
  })
  .onEventNewBidEvent(async (event, ctx) => {
    let b_token = parse_token(event.data_decoded.b_token.name);
    let o_token = parse_token(event.data_decoded.o_token.name);

    const price_b_token = await getPriceBySymbol(b_token, ctx.timestamp);
    const price_o_token = await getPriceBySymbol(o_token, ctx.timestamp);

    // ctx.meter.Counter("totalNewBid").add(Number(event.data_decoded.size) / 10 ** token_decimal(o_token), {
    //     index: event.data_decoded.index.toString(),
    //     coin_symbol: o_token,
    // });
    const size = Number(event.data_decoded.size) / 10 ** token_decimal(o_token);
    const bidder_balance = Number(event.data_decoded.bidder_balance) / 10 ** token_decimal(b_token);
    const incentive_balance = Number(event.data_decoded.incentive_balance) / 10 ** token_decimal(b_token);

    ctx.eventLogger.emit("NewBid", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      b_token,
      o_token,
      bid_index: event.data_decoded.bid_index,
      price: Number(event.data_decoded.price) / 10 ** token_decimal(b_token),
      size,
      bidder_balance,
      incentive_balance,
      notional_value_usd: size * price_o_token!,
      amount_usd: (bidder_balance + incentive_balance) * price_b_token!,
      ts_ms: event.data_decoded.ts_ms,
      is_autobid: event.data_decoded.signer != event.sender,
    });
  })
  .onEventSettleEvent(async (event, ctx) => {
    let d_token = parse_token(event.data_decoded.d_token.name);
    const price_d_token = await getPriceBySymbol(d_token, ctx.timestamp);
    ctx.eventLogger.emit("Settle", {
      index: event.data_decoded.index,
      d_token,
      distinctId: event.data_decoded.signer,
      round: event.data_decoded.round,
      oracle_price:
        Number(event.data_decoded.oracle_price) / 10 ** Number(event.data_decoded.oracle_price_decimal),
      share_price: Number(event.data_decoded.share_price) / 10 ** 8,
      settle_balance:
        Number(event.data_decoded.settle_balance) / 10 ** Number(event.data_decoded.d_token_decimal),
      settled_balance:
        Number(event.data_decoded.settled_balance) / 10 ** Number(event.data_decoded.d_token_decimal),
      price_d_token,
    });
  })
  .onEventActivateEvent(async (event, ctx) => {
    let bp_incentive_amount;
    if (event.data_decoded.u64_padding.at(0)) {
      bp_incentive_amount = event.data_decoded.u64_padding.at(0)! / BigInt(10 ** 9);
    }
    let fixed_incentive_amount;
    if (event.data_decoded.u64_padding.at(1)) {
      fixed_incentive_amount = event.data_decoded.u64_padding.at(1)! / BigInt(10 ** 9);
    }
    const index = event.data_decoded.index;
    const vaultSnapshot = await ctx.store.get(VaultSnapshot, index.toString());
    ctx.eventLogger.emit("Activate", {
      index,
      distinctId: event.data_decoded.signer,
      round: event.data_decoded.round,
      oracle_info: event.data_decoded.oracle_info,
      activate_deposit_amount:
        event.data_decoded.deposit_amount / BigInt(10) ** event.data_decoded.d_token_decimal,
      contract_size: event.data_decoded.contract_size / BigInt(10) ** event.data_decoded.o_token_decimal,
      bp_incentive_amount,
      fixed_incentive_amount,
      deposit_balance: vaultSnapshot?.deposit_balance,
      premium_balance: vaultSnapshot?.premium_balance,
    });
  })
  .onEventNewAuctionEvent((event, ctx) => {
    const decimal = Number(event.data_decoded.oracle_info.decimal);
    const strikes = event.data_decoded.vault_config.payoff_configs
      .map((config) => (Number(config.strike!) / 10 ** decimal).toString())
      .join("   ");
    ctx.eventLogger.emit("NewAuction", {
      index: event.data_decoded.index,
      distinctId: event.data_decoded.signer,
      round: event.data_decoded.round,
      start_ts_ms: event.data_decoded.start_ts_ms,
      end_ts_ms: event.data_decoded.end_ts_ms,
      size: event.data_decoded.size,
      oracle_info: event.data_decoded.oracle_info,
      strike_bps: event.data_decoded.vault_config.payoff_configs
        .map((config) => config.strike_bp?.toString())
        .join("   "),
      strikes,
      weights: event.data_decoded.vault_config.payoff_configs.map((config) => config.weight).join("   "),
      is_buyers: event.data_decoded.vault_config.payoff_configs.map((config) => config.is_buyer).join("   "),
      strike_increment: event.data_decoded.vault_config.strike_increment,
      decay_speed: event.data_decoded.vault_config.decay_speed,
      initial_price: event.data_decoded.vault_config.initial_price,
      final_price: event.data_decoded.vault_config.final_price,
    });
  })
  .onEventRaiseFundEvent((event, ctx) => {
    let index = event.data_decoded.log[0];
    let token = parse_token(event.data_decoded.token.name);
    if (event.data_decoded.log[4] > 0) {
      // deposit
      let amount = Number(event.data_decoded.log[4]) / 10 ** token_decimal(token)!;
      ctx.eventLogger.emit("Deposit", {
        distinctId: event.data_decoded.signer,
        index,
        coin_symbol: token,
        amount: amount,
      });
    } else if (event.data_decoded.log[5] > 0) {
      // compound
      let fee_amount = Number(event.data_decoded.log[6]) / 10 ** token_decimal(token);
      ctx.meter.Counter("compoundFee").add(fee_amount, {
        index: index.toString(),
        coin_symbol: token,
      });
      ctx.eventLogger.emit("Compound", {
        distinctId: event.data_decoded.signer,
        index,
        coin_symbol: token,
        amount: Number(event.data_decoded.log[5]) / 10 ** token_decimal(token),
        fee_amount,
      });
    }
  })
  .onEventReduceFundEvent(async (event, ctx) => {
    let index = event.data_decoded.log[0];
    let d_token = parse_token(event.data_decoded.d_token.name);
    let b_token = parse_token(event.data_decoded.b_token.name);
    let i_token = parse_token(event.data_decoded.i_token.name);

    if (event.data_decoded.log[4] > 0) {
      // withdraw
      let amount = Number(event.data_decoded.log[4]) / 10 ** token_decimal(d_token)!;
      ctx.eventLogger.emit("Withdraw", {
        distinctId: event.data_decoded.signer,
        index,
        coin_symbol: d_token,
        amount: amount,
      });
    }
    if (event.data_decoded.log[5] > 0) {
      // unsubscribe
      let amount = Number(event.data_decoded.log[5]) / 10 ** token_decimal(d_token)!;
      ctx.eventLogger.emit("Unsubscribe", {
        distinctId: event.data_decoded.signer,
        index,
        coin_symbol: d_token,
        amount: amount,
      });
    }
    if (event.data_decoded.log[9] > 0) {
      // claim
      let amount = Number(event.data_decoded.log[9]) / 10 ** token_decimal(d_token)!;
      ctx.eventLogger.emit("Claim", {
        distinctId: event.data_decoded.signer,
        index,
        coin_symbol: d_token,
        amount: amount,
      });
    }
    if (event.data_decoded.log[6] > 0) {
      // harvest
      const fee_amount = Number(event.data_decoded.log[7]) / 10 ** token_decimal(b_token);

      ctx.meter.Counter("harvestFee").add(fee_amount, {
        index: index.toString(),
        coin_symbol: b_token,
      });
      ctx.eventLogger.emit("Harvest", {
        distinctId: event.data_decoded.signer,
        index,
        coin_symbol: b_token,
        amount: Number(event.data_decoded.log[6]) / 10 ** token_decimal(b_token),
        fee_amount,
      });
    }
    if (event.data_decoded.log[10] > 0) {
      // redeem
      const price = await getPriceBySymbol(i_token, ctx.timestamp);
      ctx.eventLogger.emit("DepositorRewardClaimed", {
        distinctId: event.data_decoded.signer,
        index,
        coin_symbol: i_token,
        price,
        amount: Number(event.data_decoded.log[10]) / 10 ** token_decimal(i_token),
        fee_amount: Number(event.data_decoded.log[11]) / 10 ** token_decimal(i_token),
        fee_share_amount: Number(event.data_decoded.log[12]) / 10 ** token_decimal(i_token),
      });
    }
  })
  .onEventRefreshDepositSnapshotEvent((event, ctx) => {
    let coin_symbol = parse_token(event.data_decoded.token.name);
    ctx.eventLogger.emit("RefreshDepositSnapshotEvent", {
      distinctId: event.data_decoded.signer,
      coin_symbol,
      amount: Number(event.data_decoded.log[4]) / 10 ** token_decimal(coin_symbol),
    });
    // emit(RefreshDepositSnapshotEvent {
    //     signer: tx_context::sender(ctx),
    //     token: portfolio_vault.info.deposit_token,
    //     log: vector[
    //         portfolio_vault.info.index,
    //         portfolio_vault.info.round,
    //         portfolio_vault.info.oracle_info.price,
    //         portfolio_vault.info.oracle_info.decimal,
    //         snapshot,
    //     ],
    // });
  })
  .onEventOtcEvent(async (event, ctx) => {
    let b_token_decimal = Number(event.data_decoded.b_token_decimal);
    let o_token_decimal = Number(event.data_decoded.o_token_decimal);

    let bidder_bid_value = Number(event.data_decoded.bidder_bid_value) / 10 ** b_token_decimal;
    let bidder_fee = Number(event.data_decoded.bidder_fee) / 10 ** b_token_decimal;
    let delivery_price = Number(event.data_decoded.delivery_price) / 10 ** b_token_decimal;
    let delivery_size = Number(event.data_decoded.delivery_size) / 10 ** o_token_decimal;

    const vaultInfo = await ctx.store.get(VaultInfo, event.data_decoded.index.toString());
    const coin_symbol = vaultInfo?.b_token;

    ctx.eventLogger.emit("SafuOtc", {
      distinctId: event.data_decoded.signer,
      index: event.data_decoded.index,
      round: event.data_decoded.round,
      delivery_price,
      delivery_size,
      bidder_bid_value,
      bidder_fee,
      coin_symbol,
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
      return "USDC";
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
    case "USDT":
    case "MFUD":
    case "MBLUB":
    case "MLIQ":
      return 6;
    case "FUD": // actual 5
    case "LIQ": // actual 6
    case "BLUB": // actual 2
      return 0;
    default:
      return 9;
  }
}

SuiWrappedObjectProcessor.bind({
  network: SuiNetwork.MAIN_NET,
  startCheckpoint,
  objectId: DEPOSIT_VAULT_REGISTRY,
}).onTimeInterval(
  async (objects, ctx) => {
    // ctx.meter.Gauge("num_of_vaults").record(objects.length);
    for (const object of objects) {
      // console.log("object", JSON.stringify(object))
      const newDepositVault = await ctx.coder.decodedType(object, vault.DepositVault.type());
      // console.log("decoded vault", JSON.stringify(newDepositVault));
      // decoded vault {"id":{"id":"0xd0f9ec19081ca68abad17a0c1ae80f167dc08859cd66813e8cf28cda3986ceae"},"deposit_token":{"name":"5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"},"bid_token":{"name":"5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"},"incentive_token":null,"index":"10","fee_bp":"1000","fee_share_bp":"0","shared_fee_pool":null,"active_share_supply":"0","deactivating_share_supply":"0","inactive_share_supply":"0","warmup_share_supply":"0","premium_share_supply":"0","incentive_share_supply":"0","has_next":true,"metadata":"ETH-Daily-Put","u64_padding":[],"bcs_padding":[]}
      const index = newDepositVault!.index.toString();
      const deposit_token = parse_token("0x" + newDepositVault!.deposit_token.name);
      const bid_token = parse_token("0x" + newDepositVault!.bid_token.name);

      const deposit_balance =
        (newDepositVault!.active_share_supply +
          newDepositVault!.deactivating_share_supply +
          newDepositVault!.inactive_share_supply +
          newDepositVault!.warmup_share_supply) /
        BigInt(10 ** token_decimal(deposit_token));

      const premium_balance = newDepositVault!.premium_share_supply / BigInt(10 ** token_decimal(bid_token));

      const vaultSnapshot = new VaultSnapshot({
        id: newDepositVault?.index.toString(),
        deposit_balance,
        premium_balance,
      });
      await ctx.store.upsert(vaultSnapshot);

      ctx.meter.Gauge("deposit_share").record(deposit_balance, {
        index, // need this for seperating log!
        coin_symbol: deposit_token,
      });

      ctx.meter.Gauge("premium_share").record(premium_balance, {
        index,
        coin_symbol: bid_token,
      });
    }
  },
  60,
  60,
  undefined,
  { owned: true }
);

SuiWrappedObjectProcessor.bind({
  network: SuiNetwork.MAIN_NET,
  startCheckpoint: BigInt(54910325),
  objectId: SAFU_REGISTRY,
}).onTimeInterval(
  async (objects, ctx) => {
    for (const object of objects) {
      // console.log(object.type);
      if (object.type.includes("Vault")) {
        // console.log("safu object", JSON.stringify(object));
        const safuVault = object.fields as any;
        const index = safuVault.info[0].toString();
        const deposit_token = parse_token("0x" + safuVault.deposit_token.fields.name);

        const share_supply = safuVault.share_supply;
        // deposit_token
        const total_share =
          Number(share_supply[0]) +
          Number(share_supply[1]) +
          Number(share_supply[2]) +
          Number(share_supply[3]);
        const price_deposit_token = await getPriceBySymbol(deposit_token, ctx.timestamp);
        var tvl = (Number(total_share) / 10 ** token_decimal(deposit_token)) * price_deposit_token!;

        // reward_tokens
        var n = 0;
        for (const type_name of safuVault.reward_tokens) {
          const reward_token = parse_token("0x" + type_name.fields.name);
          const price_reward_token = await getPriceBySymbol(reward_token, ctx.timestamp);
          tvl += (Number(share_supply[n + 5]) / 10 ** token_decimal(reward_token)) * price_reward_token!;
          n += 1;
        }
        ctx.meter.Gauge("SafuTvl_USD").record(tvl, {
          index,
        });
      }
    }
  },
  60,
  60,
  undefined,
  { owned: true }
);
