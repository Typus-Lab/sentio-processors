
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

@Entity("VaultInfo")
export class VaultInfo extends AbstractEntity  {

	@Required
	@Column("ID")
	id: ID

	@Required
	@Column("String")
	d_token: String

	@Required
	@Column("String")
	b_token: String

	@Required
	@Column("String")
	o_token: String
  constructor(data: Partial<VaultInfo>) {super()}
}

@Entity("SafuInfo")
export class SafuInfo extends AbstractEntity  {

	@Required
	@Column("ID")
	id: ID

	@Required
	@Column("String")
	d_token: String

	@Required
	@Column("String")
	dov_d_token: String

	@Required
	@Column("String")
	dov_b_token: String
  constructor(data: Partial<SafuInfo>) {super()}
}


const source = `type VaultSnapshot @entity {
  id: ID!
  deposit_balance: BigInt!
  premium_balance: BigInt!
}

type VaultInfo @entity {
  id: ID!
  d_token: String!
  b_token: String!
  o_token: String!
}

type SafuInfo @entity {
  id: ID!
  d_token: String!
  dov_d_token: String!
  dov_b_token: String!
}
`
DatabaseSchema.register({
  source,
  entities: {
    "VaultSnapshot": VaultSnapshot,
		"VaultInfo": VaultInfo,
		"SafuInfo": SafuInfo
  }
})
