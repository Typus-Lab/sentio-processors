import { SuiNetwork, SuiWrappedObjectProcessor } from "@sentio/sdk/sui";
import { normalizeSuiAddress, normalizeStructTag } from "@mysten/sui/utils";
import { getPriceBySymbol } from "@sentio/sdk/utils";
import { BcsReader } from "@mysten/bcs";

const startCheckpoint = BigInt(15970051);

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
