
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type { String, Int, BigInt, Float, ID, Bytes, Timestamp, Boolean } from '@sentio/sdk/store'
import { Entity, Required, One, Many, Column, ListColumn, AbstractEntity } from '@sentio/sdk/store'
import { BigDecimal } from '@sentio/bigdecimal'
import { DatabaseSchema } from '@sentio/sdk'






@Entity("VaultSnapshot")
export class VaultSnapshot extends AbstractEntity  {

	@Required
	@Column("ID")
	id: ID

	@Required
	@Column("BigInt")
	deposit_balance: BigInt

	@Required
	@Column("BigInt")
	premium_balance: BigInt
  constructor(data: Partial<VaultSnapshot>) {super()}
}


const source = `type VaultSnapshot @entity {
  id: ID!
  deposit_balance: BigInt!
  premium_balance: BigInt!
}
`
DatabaseSchema.register({
  source,
  entities: {
    "VaultSnapshot": VaultSnapshot
  }
})
