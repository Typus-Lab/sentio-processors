# Typus

## Dov

### TVL

**SINGLE_DEPOSIT_VAULT_REGISTRY** 0xd67cf93a0df61b4b3bbf6170511e0b28b21578d9b87a8f4adafec96322dd284d

**REFUND_VAULT_REGISTRY** 0xf9acfc0a06094f6515c4392ffef84d40cd5f1d72bc74cbde3ee99dd7bca6cf3f

Reference:
[DefiLlama](https://github.com/DefiLlama/DefiLlama-Adapters/blob/3acd527aaecb6743223e60518d86d38851c3bb65/projects/typus-finance/index.js)

### Volume

1. 0x321848bf1ae327a9e022ccb3701940191e02fa193ab160d9c0e49cd3c003de3a::typus_dov_single::DeliveryEvent
2. 0x321848bf1ae327a9e022ccb3701940191e02fa193ab160d9c0e49cd3c003de3a::typus_dov_single::OtcEvent

Reference:
[DefiLlama](https://github.com/DefiLlama/dimension-adapters/blob/19ce30b5ef24504c4ad2268169694be3fe250d4b/options/typus/getChainData.ts)

### Fee

**totalBidderFee**

1. 0x321848bf1ae327a9e022ccb3701940191e02fa193ab160d9c0e49cd3c003de3a::typus_dov_single::DeliveryEvent

**harvestFee**

1. 0x321848bf1ae327a9e022ccb3701940191e02fa193ab160d9c0e49cd3c003de3a::typus_dov_single::ReduceFundEvent
2. 0x321848bf1ae327a9e022ccb3701940191e02fa193ab160d9c0e49cd3c003de3a::typus_dov_single::HarvestEvent

**compoundFee**

1. 0x321848bf1ae327a9e022ccb3701940191e02fa193ab160d9c0e49cd3c003de3a::typus_dov_single::CompoundEvent 2. 0x321848bf1ae327a9e022ccb3701940191e02fa193ab160d9c0e49cd3c003de3a::typus_dov_single::RaiseFundEvent

**SafuFee**

1. 0xa7bedeaa28ff3defa50d012812618178727f530bc5a70af5d03fc6424a984cc7::safu::ManagerEvent
2. 0xa7bedeaa28ff3defa50d012812618178727f530bc5a70af5d03fc6424a984cc7::safu::UserEvent

Reference:
[Sentio](https://github.com/Typus-Lab/sentio-processors/blob/09d329148c5b743151abcafb6455881cbf0fe895/projects/typus_v2/src/processor.ts)

### OI

## Perp

### TVL

**LIQUIDITY_POOL** 0x98110aae0ffaf294259066380a2d35aba74e42860f1e87ee9c201f471eb3ba03

Reference:
[DefiLlama](https://github.com/DefiLlama/DefiLlama-Adapters/blob/02b4ac2f4301d65f2a84e4d39253e2d721cba28f/projects/typus-perp/index.js)

### Volume

0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::position::OrderFilledEvent

Reference:
[DefiLlama](https://github.com/DefiLlama/dimension-adapters/blob/db663a566c1036d3411dbb478e3d5cc19c488f3c/dexs/typus-perp/index.ts)

### Fee

**protocol_fee**

1. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::lp_pool::MintLpEvent
2. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::lp_pool::BurnLpEvent
3. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::lp_pool::SwapEvent
4. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::lp_pool::WithdrawLendingEvent
5. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::trading::RealizeOptionPositionEvent
6. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::position::OrderFilledEvent

**tlp_fee**

1. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::lp_pool::SwapEvent
2. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::trading::LiquidateEvent
3. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::trading::RealizeOptionPositionEvent
4. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::position::OrderFilledEvent
5. 0xe27969a70f93034de9ce16e6ad661b480324574e68d15a64b513fd90eb2423e5::position::RealizeFundingEvent

Reference:
[Sentio](https://github.com/Typus-Lab/sentio-processors/blob/2f5f87bb6ca39ed3e36a3f1effa0f8cd37442efa/projects/typus_perp/src/processor.ts)

### OI

**MarketRegistry** 0x442cc2c27cadaf287a5f4413967b4dacc6532bc9063875efbc7b178e5add3e4e

| Trading Symbol                                                               | Market                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0746c122ecb19321768fb0dcfb34d237933fe306df05dc7bcd7140609a106ca5::hype::HYPE | 0xf3a9c94577a60c25415adb3c9669ec1c862a651e189b5b73d8f9100fe902e402 |
| b7844e289a8410e50fb3ca48d69eb9cf29e27d223ef90353fe1bd8e27ff8f3f8::coin::COIN | 0x37b7d5707a038d2d0841bb996991572029f469a907d00b2223dfc33d9660a224 |
| 188faaaa44e6276295ab92fdd3eb353e5f25fc35b9d965a5b8243f336af65b78::xrp::XRP   | 0x058f54008c1a869d00ef498592a1c99a433dd5b06ffbe676164b0a294f24eaca |
| 027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN | 0x34c72ea48883581706684f3f1ea4ebadbd4f9c4ca26f725d706378abf20f6a07 |
| 292dd8bc71bff5714f79dd7d9c15bfc6e22bbfb07ef40bf320d61cd050dad929::doge::DOGE | 0xd2ee1bce0bdb62586cdddb08c4823869670063da6b4398a1fff26e47c17bb632 |
| af8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN | 0x5d782f461ac1f4f656eb94167b73438575b71ff8a10ec941d21b20275e87940b |
| deeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP | 0x29c0951be30fc90d75937fe7530f8810c4019bf403060b624d684f00d6fb273e |
| 3a5143bb1196e3bcdfab6203d1683ae29edd26294fc8bfeafe4aaa9d2704df37::coin::COIN | 0x18943d9adec02f701b152104cbdf4541d9b1e4686716a6ffb59329b6f53eec06 |
| 0000000000000000000000000000000000000000000000000000000000000002::sui::SUI   | 0x31f3caee2f3f2d18dc4c7d1121d998d80774e65ecd3b0d1e94c225b784c3c319 |
| 732f66e6e97c0f6b7250a5f43dc3576e225ae6e7578862a9b122915f6ff63988::xau::XAU   | 0x50aa23ba6773e6cf9603a13de99a49bfc29363f2de000600e5c9739877c79132 |
| 356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL   | 0x3bc7f6f50202d21c064ac4f29a96c7511c0f63af24836a4bda952ebe7a2df07e |
