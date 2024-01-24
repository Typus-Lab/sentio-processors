import { Counter, Gauge } from "@sentio/sdk";
import { ERC20Processor } from "@sentio/sdk/eth/builtin";
import {
  FastLaneAuctionHandlerContext,
  FastLaneAuctionHandlerProcessor,
  RelayFlashBidEvent,
} from "./types/eth/fastlaneauctionhandler.js";
import { EthChainId } from "@sentio/sdk/eth";

const handleFlashBid = async (
  event: RelayFlashBidEvent,
  ctx: FastLaneAuctionHandlerContext
) => {
  ctx.eventLogger.emit("bid", {
    distinctId: event.args.searcherContractAddress,
    oppTxHash: event.args.oppTxHash,
    validator: event.args.validator,
    amount: event.args.amount.scaleDown(18),
  });
};

FastLaneAuctionHandlerProcessor.bind({
  address: "0xCACe8D78269ba00f1C4D5Fc3B1228C7DF0a7C8BA",
  network: EthChainId.POLYGON,
}).onEventRelayFlashBid(handleFlashBid);
